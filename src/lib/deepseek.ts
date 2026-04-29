import OpenAI from "openai";
import { config } from "./config";

let client: OpenAI | null = null;

export function getDeepSeekClient(): OpenAI {
  if (!client) {
    client = new OpenAI({
      apiKey: config.deepseekApiKey,
      baseURL: config.deepseekBaseUrl,
    });
  }
  return client;
}

export async function createEmbedding(text: string): Promise<number[]> {
  const c = getDeepSeekClient();
  const res = await c.embeddings.create({
    model: "deepseek-embedding",
    input: text,
  });
  return res.data[0].embedding;
}

export async function createEmbeddings(texts: string[]): Promise<number[][]> {
  const c = getDeepSeekClient();
  const res = await c.embeddings.create({
    model: "deepseek-embedding",
    input: texts,
  });
  return res.data.map((d) => d.embedding);
}

export async function testDeepSeekConnection(): Promise<boolean> {
  try {
    const c = getDeepSeekClient();
    await c.models.list();
    return true;
  } catch {
    return false;
  }
}
