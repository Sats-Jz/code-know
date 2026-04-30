import OpenAI from "openai";
import { config } from "./config";

let embeddingClient: OpenAI | null = null;

function getClient(): OpenAI {
  if (!embeddingClient) {
    embeddingClient = new OpenAI({
      apiKey: config.siliconflowApiKey,
      baseURL: config.siliconflowBaseUrl,
    });
  }
  return embeddingClient;
}

export async function embedText(text: string): Promise<number[]> {
  const client = getClient();
  const res = await client.embeddings.create({
    model: config.embeddingModel,
    input: text,
  });
  return res.data[0].embedding;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const client = getClient();
  const res = await client.embeddings.create({
    model: config.embeddingModel,
    input: texts,
  });
  return res.data.map((d) => d.embedding);
}
