import { NextRequest } from "next/server";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { chatStream, type ChatMessage } from "@/lib/rag/llm";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const repoId = Number(params.id);
  const repo = db.select().from(schema.repos).where(eq(schema.repos.id, repoId)).get();
  if (!repo) return new Response("Not found", { status: 404 });
  const body = await req.json();
  const { message, conversation_id, mode = "explain" } = body;
  let convId = conversation_id;
  if (!convId) {
    const conv = db.insert(schema.conversations).values({ repoId, mode, title: message.slice(0, 50) }).returning().get();
    convId = conv.id;
  }
  db.insert(schema.messages).values({ conversationId: convId, role: "user", content: JSON.stringify({ text: message, mode }), createdAt: new Date().toISOString() }).run();
  const historyRows = db.select().from(schema.messages).where(eq(schema.messages.conversationId, convId)).orderBy(schema.messages.createdAt).all();
  const history: ChatMessage[] = historyRows.map((r) => ({ role: r.role as "user" | "assistant", content: r.content }));
  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      const parts: { type: string; data: unknown }[] = [];
      try {
        for await (const chunk of chatStream(repoId, message, history)) {
          parts.push(chunk);
          controller.enqueue(encoder.encode("event: " + chunk.type + "\ndata: " + JSON.stringify(chunk.data) + "\n\n"));
        }
        db.insert(schema.messages).values({ conversationId: convId, role: "assistant", content: JSON.stringify(parts) }).run();
        controller.enqueue(encoder.encode("event: done\ndata: {}\n\n"));
        controller.close();
      } catch (e) {
        controller.enqueue(encoder.encode("event: error\ndata: " + JSON.stringify({ error: String(e) }) + "\n\n"));
        controller.close();
      }
    },
  });
  return new Response(readable, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" } });
}
