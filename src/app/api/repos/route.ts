import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { importRepo, getRepoFiles, countRepoStats } from "@/lib/rag/importer";
import { chunkRepo } from "@/lib/rag/chunker";
import { embedChunks } from "@/lib/rag/embedder";
import { eq, desc } from "drizzle-orm";
import { getGitUrlName } from "@/lib/git";

export async function GET() {
  const repos = db.select().from(schema.repos).orderBy(desc(schema.repos.updatedAt)).all();
  return NextResponse.json(repos);
}

export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") || "";

  // File upload
  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file") as File;
    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

    const uploadDir = `${process.env.DATA_DIR || "./repos"}/_uploads`;
    await import("node:fs/promises").then((fs) => fs.mkdir(uploadDir, { recursive: true }));
    const filePath = `${uploadDir}/${file.name}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    await import("node:fs/promises").then((fs) => fs.writeFile(filePath, buffer));

    const name = file.name.replace(/\.(zip|tar\.gz|tgz|tar)$/i, "");
    const repo = db.insert(schema.repos).values({
      name, path: null, gitUrl: null,
      language: null, fileCount: 0, lineCount: 0, indexStatus: "importing",
    }).returning().get();
    processImportAsync(repo.id, { type: "upload" as const, filePath, fileName: file.name });
    return NextResponse.json(repo, { status: 201 });
  }

  // JSON body for local/git
  const body = await req.json();
  const { type, localPath, gitUrl } = body;

  let name = "unknown";
  if (type === "local") name = localPath.split("/").pop() || localPath.split("\\").pop() || "repo";
  else if (type === "git") name = await getGitUrlName(gitUrl);

  const repo = db.insert(schema.repos).values({
    name, path: null, gitUrl: gitUrl || null,
    language: null, fileCount: 0, lineCount: 0, indexStatus: "importing",
  }).returning().get();

  if (type === "local") {
    processImportAsync(repo.id, { type: "local" as const, localPath });
  } else if (type === "git") {
    processImportAsync(repo.id, { type: "git" as const, gitUrl });
  }

  return NextResponse.json(repo, { status: 201 });
}

async function processImportAsync(repoId: number, source: { type: "local"; localPath: string } | { type: "git"; gitUrl: string } | { type: "upload"; filePath: string; fileName: string }) {
  try {
    const { repoPath, repoName } = await importRepo(source);
    const files = await getRepoFiles(repoPath);
    const stats = countRepoStats(repoPath, files);
    db.update(schema.repos).set({
      path: repoPath, name: repoName,
      language: stats.language, fileCount: stats.fileCount,
      lineCount: stats.lineCount, indexStatus: "indexing",
      updatedAt: new Date().toISOString(),
    }).where(eq(schema.repos.id, repoId)).run();

    const chunks = await chunkRepo(repoPath, files);
    await embedChunks(repoId, chunks);
    db.update(schema.repos).set({ indexStatus: "ready", updatedAt: new Date().toISOString() }).where(eq(schema.repos.id, repoId)).run();
  } catch (e) {
    console.error("Index failed:", e);
    db.update(schema.repos).set({ indexStatus: "error", updatedAt: new Date().toISOString() }).where(eq(schema.repos.id, repoId)).run();
  }
}
