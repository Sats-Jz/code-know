import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, desc } from "drizzle-orm";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const convs = db.select().from(schema.conversations).where(eq(schema.conversations.repoId, Number(params.id))).orderBy(desc(schema.conversations.createdAt)).all();
  return NextResponse.json(convs);
}
