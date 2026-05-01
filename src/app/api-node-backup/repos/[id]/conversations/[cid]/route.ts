import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

export async function GET(_req: NextRequest, { params }: { params: { id: string; cid: string } }) {
  const messages = db.select().from(schema.messages).where(eq(schema.messages.conversationId, Number(params.cid))).orderBy(schema.messages.createdAt).all();
  return NextResponse.json(messages);
}
