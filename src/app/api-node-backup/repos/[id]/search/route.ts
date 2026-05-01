import { NextRequest, NextResponse } from "next/server";
import { hybridSearch } from "@/lib/rag/retriever";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { query } = await req.json();
  const results = await hybridSearch(Number(params.id), query, 20);
  return NextResponse.json(results);
}
