import { NextRequest, NextResponse } from "next/server";
import { testDeepSeekConnection } from "@/lib/deepseek";
import { testChromaConnection } from "@/lib/chromadb";

export async function POST() {
  const [deepseekOk, chromaOk] = await Promise.all([
    testDeepSeekConnection().catch(() => false),
    testChromaConnection().catch(() => false),
  ]);
  return NextResponse.json({ deepseek: deepseekOk, chromadb: chromaOk });
}
