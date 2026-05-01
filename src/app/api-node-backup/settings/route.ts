import { NextRequest, NextResponse } from "next/server";
import { config } from "@/lib/config";

export async function GET() {
  return NextResponse.json({
    deepseekConfigured: !!config.deepseekApiKey,
    chromadbUrl: config.chromadbUrl,
    dataDir: config.dataDir,
  });
}

export async function PUT(req: NextRequest) {
  await req.json();
  return NextResponse.json({ success: true, note: "Update .env.local to change settings" });
}
