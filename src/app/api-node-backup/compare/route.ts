import { NextRequest } from "next/server";
import { db, schema } from "@/lib/db";
import { hybridSearch } from "@/lib/rag/retriever";
import { getDeepSeekClient } from "@/lib/deepseek";
import { sql } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const { repoIds, question } = await req.json();

  const repos = db.select().from(schema.repos).where(sql`id IN (${repoIds.join(",")})`).all();
  const contexts = await Promise.all(repos.map(async (repo) => {
    const results = await hybridSearch(repo.id, question, 10);
    return { repo: repo.name, chunks: results };
  }));

  let context = "";
  for (const { repo, chunks } of contexts) {
    context += `\n## ${repo}\n`;
    context += chunks.map((c) => `[${c.filePath}:${c.startLine}] ${c.content}`).join("\n\n");
  }

  const client = getDeepSeekClient();
  const stream = await client.chat.completions.create({
    model: "deepseek-v4-pro",
    messages: [
      { role: "system", content: "Compare the following codebases based on the user's question." },
      { role: "user", content: `${context}\n\nQuestion: ${question}` },
    ],
    stream: true, temperature: 0.3, max_tokens: 8192,
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta })}\n\n`));
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  });
}
