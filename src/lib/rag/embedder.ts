import { createEmbeddings } from "../deepseek";
import { addChunks } from "../chromadb";
import { db, schema } from "../db";
import type { Chunk } from "./chunker";

const BATCH_SIZE = 50;

export async function embedChunks(repoId: number, chunks: Chunk[]): Promise<void> {
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const texts = batch.map((c) => c.content);
    const embeddings = await createEmbeddings(texts);

    const chromaItems = batch.map((chunk, idx) => {
      const id = `repo_${repoId}_chunk_${i + idx}`;
      return {
        id,
        embedding: embeddings[idx],
        metadata: {
          filePath: chunk.filePath,
          startLine: String(chunk.startLine),
          endLine: String(chunk.endLine),
          chunkType: chunk.chunkType,
          symbolName: chunk.symbolName || "",
        },
        document: chunk.content,
      };
    });

    await addChunks(repoId, chromaItems);

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
}
