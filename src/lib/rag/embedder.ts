import { createEmbeddings } from "../deepseek";
import { addChunks } from "../chromadb";
import { db, schema } from "../db";
import type { Chunk } from "./chunker";

const BATCH_SIZE = 50;

export async function embedChunks(repoId: number, chunks: Chunk[]): Promise<void> {
  let hasVectors = false;

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);

    // Try embedding; continue without vectors on failure
    let embeddings: number[][] | null = null;
    try {
      const texts = batch.map((c) => c.content);
      embeddings = await createEmbeddings(texts);
      hasVectors = true;
    } catch (e: any) {
      console.warn(`Embedding failed for batch ${i}, continuing without vectors:`, e.message || String(e));
    }

    // Only push to ChromaDB if embeddings succeeded
    if (embeddings) {
      try {
        const chromaItems = batch.map((chunk, idx) => ({
          id: `repo_${repoId}_chunk_${i + idx}`,
          embedding: embeddings![idx],
          metadata: {
            filePath: chunk.filePath,
            startLine: String(chunk.startLine),
            endLine: String(chunk.endLine),
            chunkType: chunk.chunkType,
            symbolName: chunk.symbolName || "",
          },
          document: chunk.content,
        }));
        await addChunks(repoId, chromaItems);
      } catch (e: any) {
        console.warn(`ChromaDB insert failed for batch ${i}:`, e.message || String(e));
      }
    }

    // Always insert into SQLite (FTS works without vectors)
    for (let j = 0; j < batch.length; j++) {
      db.insert(schema.chunks).values({
        repoId,
        filePath: batch[j].filePath,
        startLine: batch[j].startLine,
        endLine: batch[j].endLine,
        chunkType: batch[j].chunkType,
        symbolName: batch[j].symbolName,
        content: batch[j].content,
        embeddingId: `repo_${repoId}_chunk_${i + j}`,
      }).run();
    }
  }

  // Update index status to reflect whether vectors are available
  if (!hasVectors) {
    console.warn(`Repo ${repoId}: indexed without vectors (embedding API unavailable), using FTS-only search`);
  }
}
