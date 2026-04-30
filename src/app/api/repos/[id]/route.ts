import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { deleteCollection } from "@/lib/chromadb";
import { eq } from "drizzle-orm";
import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const repo = db.select().from(schema.repos).where(eq(schema.repos.id, Number(params.id))).get();
  if (!repo) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(repo);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  const repo = db.select().from(schema.repos).where(eq(schema.repos.id, id)).get();
  if (!repo) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await deleteCollection(id);
  db.delete(schema.chunks).where(eq(schema.chunks.repoId, id)).run();
  db.delete(schema.conversations).where(eq(schema.conversations.repoId, id)).run();
  db.delete(schema.repos).where(eq(schema.repos.id, id)).run();
  if (repo.path && existsSync(repo.path)) await rm(repo.path, { recursive: true, force: true });
  return NextResponse.json({ success: true });
}
