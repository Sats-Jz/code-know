import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import fs from "node:fs";
import path from "node:path";
import { detectLanguage } from "@/lib/rag/importer";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const repo = db.select().from(schema.repos).where(eq(schema.repos.id, Number(params.id))).get();
  if (!repo || !repo.path) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const filePath = req.nextUrl.searchParams.get("path");
  if (!filePath) return NextResponse.json({ error: "path required" }, { status: 400 });
  const fullPath = path.join(repo.path, filePath);
  if (!fs.existsSync(fullPath)) return NextResponse.json({ error: "File not found" }, { status: 404 });
  const content = fs.readFileSync(fullPath, "utf-8");
  const language = detectLanguage(filePath);
  return NextResponse.json({ path: filePath, content, language });
}
