import { ChromaClient, type Collection } from "chromadb";
import { config } from "./config";

let client: ChromaClient | null = null;

export function getChromaClient(): ChromaClient {
  if (!client) {
    client = new ChromaClient({ path: config.chromadbUrl });
  }
  return client;
}

const COLLECTION_PREFIX = "repo_";

export async function getCollection(repoId: number): Promise<Collection> {
  const c = getChromaClient();
  const name = `${COLLECTION_PREFIX}${repoId}`;
  try {
    return await c.getCollection({ name, embeddingFunction: undefined as any });
  } catch {
    return await c.createCollection({ name, embeddingFunction: undefined as any });
  }
}

export async function deleteCollection(repoId: number): Promise<void> {
  const c = getChromaClient();
  const name = `${COLLECTION_PREFIX}${repoId}`;
  try {
    await c.deleteCollection({ name });
  } catch {
    // collection might not exist
  }
}

export async function addChunks(
  repoId: number,
  items: { id: string; embedding: number[]; metadata: Record<string, string>; document: string }[],
) {
  const col = await getCollection(repoId);
  await col.add({
    ids: items.map((i) => i.id),
    embeddings: items.map((i) => i.embedding),
    metadatas: items.map((i) => i.metadata),
    documents: items.map((i) => i.document),
  });
}

export async function queryChunks(
  repoId: number,
  embedding: number[],
  topK: number = 20,
) {
  const col = await getCollection(repoId);
  const result = await col.query({ queryEmbeddings: [embedding], nResults: topK });
  return {
    ids: result.ids[0] || [],
    distances: result.distances?.[0] || [],
    metadatas: result.metadatas?.[0] || [],
    documents: result.documents?.[0] || [],
  };
}

export async function testChromaConnection(): Promise<boolean> {
  try {
    const c = getChromaClient();
    await c.listCollections();
    return true;
  } catch {
    return false;
  }
}
