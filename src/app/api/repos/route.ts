import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { importRepo, getRepoFiles, countRepoStats } from "@/lib/rag/importer";
import { chunkRepo } from "@/lib/rag/chunker";
import { embedChunks } from "@/lib/rag/embedder";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  const repos = db.select().from(schema.repos).orderBy(desc(schema.repos.updatedAt)).all();
  return NextResponse.json(repos);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { type, localPath, gitUrl } = body;
  let source;
  if (type === "local") source = { type: "local" as const, localPath };
  else if (type === "git") source = { type: "git" as const, gitUrl };
  else return NextResponse.json({ error: "Unsupported import type" }, { status: 400 });
  const { repoPath, repoName } = await importRepo(source);
  const files = await getRepoFiles(repoPath);
  const stats = countRepoStats(repoPath, files);
  const repo = db.insert(schema.repos).values({
    name: repoName, path: repoPath, gitUrl: gitUrl || null,
    language: stats.language, fileCount: stats.fileCount,
    lineCount: stats.lineCount, indexStatus: "indexing",
  }).returning().get();
  indexRepoAsync(repo.id, repoPath, files);
  return NextResponse.json(repo, { status: 201 });
}

async function indexRepoAsync(repoId: number, repoPath: string, files: string[]) {
  try {
    const chunks = await chunkRepo(repoPath, files);
    await embedChunks(repoId, chunks);
    db.update(schema.repos).set({ indexStatus: "ready", updatedAt: new Date().toISOString() }).where(eq(schema.repos.id, repoId)).run();
  } catch (e) {
    console.error("Index failed:", e);
    db.update(schema.repos).set({ indexStatus: "error", updatedAt: new Date().toISOString() }).where(eq(schema.repos.id, repoId)).run();
  }
}
