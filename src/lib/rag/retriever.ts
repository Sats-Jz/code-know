import { queryChunks } from "../chromadb";
import { db, schema } from "../db";
import { sql } from "drizzle-orm";
import { embedText } from "../local-embed";

export interface SearchResult {
  chunkId: number;
  filePath: string;
  startLine: number;
  endLine: number;
  chunkType: string;
  symbolName: string | null;
  content: string;
  score: number;
}

export async function hybridSearch(repoId: number, query: string, topK: number = 15): Promise<SearchResult[]> {
  const [vectorResults, ftsResults] = await Promise.all([
    vectorSearch(repoId, query, 20),
    ftsSearch(repoId, query, 20),
  ]);

  const rrfScores = new Map<number, number>();
  const allResults = new Map<number, SearchResult>();

  vectorResults.forEach((r, idx) => {
    rrfScores.set(r.chunkId, 1 / (60 + idx + 1));
    allResults.set(r.chunkId, r);
  });

  ftsResults.forEach((r, idx) => {
    const prev = rrfScores.get(r.chunkId) || 0;
    rrfScores.set(r.chunkId, prev + 1 / (60 + idx + 1));
    allResults.set(r.chunkId, r);
  });

  const ranked = [...rrfScores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topK)
    .map(([id]) => allResults.get(id)!)
    .filter(Boolean);

  return ranked;
}

async function vectorSearch(repoId: number, query: string, topK: number): Promise<SearchResult[]> {
  try {
    const embedding = await embedText(query);
    const result = await queryChunks(repoId, embedding, topK);

    const chunkRecords = db.select().from(schema.chunks).where(sql`repo_id = ${repoId}`).all();

    const results: SearchResult[] = [];
    for (let i = 0; i < result.ids.length; i++) {
      const chunk = chunkRecords.find((c) => c.embeddingId === result.ids[i]);
      if (chunk) {
        results.push({
          chunkId: chunk.id, filePath: chunk.filePath, startLine: chunk.startLine,
          endLine: chunk.endLine, chunkType: chunk.chunkType,
          symbolName: chunk.symbolName, content: chunk.content,
          score: 1 - (result.distances[i] || 0),
        });
      }
    }
    return results;
  } catch {
    return [];
  }
}

async function ftsSearch(repoId: number, query: string, topK: number): Promise<SearchResult[]> {
  try {
    const rows = db
      .select()
      .from(schema.chunks)
      .where(
        sql`repo_id = ${repoId} AND rowid IN (SELECT rowid FROM chunks_fts WHERE chunks_fts MATCH ${query} LIMIT ${topK})`,
      )
      .limit(topK)
      .all();

    return rows.map((r) => ({
      chunkId: r.id,
      filePath: r.filePath,
      startLine: r.startLine,
      endLine: r.endLine,
      chunkType: r.chunkType,
      symbolName: r.symbolName,
      content: r.content,
      score: 0.8,
    }));
  } catch {
    return [];
  }
}
