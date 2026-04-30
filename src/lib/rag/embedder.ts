import { embedTexts } from "../local-embed";
import { addChunks } from "../chromadb";
import { db, schema } from "../db";
import type { Chunk } from "./chunker";

const BATCH_SIZE = 20;

export async function embedChunks(repoId: number, chunks: Chunk[]): Promise<void> {
  let hasVectors = false;

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);

    let embeddings: number[][] | null = null;
    try {
      embeddings = await embedTexts(batch.map((c) => c.content));
      hasVectors = true;
    } catch (e: any) {
      console.warn(`Local embedding failed for batch ${i}:`, e.message || String(e));
    }

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

  if (!hasVectors) console.warn(`Repo ${repoId}: indexed without vectors, using FTS-only search`);
}
