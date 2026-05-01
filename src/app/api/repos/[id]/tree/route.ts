import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import fs from "node:fs";
import path from "node:path";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const repo = db.select().from(schema.repos).where(eq(schema.repos.id, Number(params.id))).get();
  if (!repo || !repo.path) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const dir = req.nextUrl.searchParams.get("dir") || "";
  const fullPath = path.join(repo.path, dir);
  if (!fs.existsSync(fullPath)) return NextResponse.json({ error: "Directory not found" }, { status: 404 });
  const entries = fs.readdirSync(fullPath, { withFileTypes: true });
  const ignore = new Set(["node_modules", ".git", "dist", "build", ".next", "target", "__pycache__"]);
  const tree = entries.filter((e) => !ignore.has(e.name) && !e.name.startsWith("."))
    .map((e) => ({ name: e.name, path: dir ? dir + "/" + e.name : e.name, type: e.isDirectory() ? "directory" as const : "file" as const }))
    .sort((a, b) => { if (a.type !== b.type) return a.type === "directory" ? -1 : 1; return a.name.localeCompare(b.name); });
  return NextResponse.json(tree);
}
