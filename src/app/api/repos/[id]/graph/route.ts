import { NextRequest, NextResponse } from "next/server";
import { getDeepSeekClient } from "@/lib/deepseek";
import { hybridSearch } from "@/lib/rag/retriever";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { target, graphType = "call-chain" } = await req.json();
  const results = await hybridSearch(Number(params.id), target, 10);
  const context = results.map((r) => "[" + r.filePath + ":" + r.startLine + "] " + r.content).join("\n\n");
  const client = getDeepSeekClient();
  const res = await client.chat.completions.create({
    model: "deepseek-v4-pro",
    messages: [{ role: "system", content: "Generate a " + graphType + " graph as a Mermaid diagram. Context:\n" + context }, { role: "user", content: target }],
    temperature: 0.2, max_tokens: 4096,
  });
  const mermaid = res.choices[0]?.message?.content || "";
  return NextResponse.json({ mermaid, graphType });
}
