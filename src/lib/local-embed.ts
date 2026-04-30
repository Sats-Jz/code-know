let pipeline: any = null;

export async function getEmbeddingModel() {
  if (pipeline) return pipeline;
  const { pipeline: pp } = await import("@xenova/transformers");
  pipeline = await pp("feature-extraction", "Xenova/all-MiniLM-L6-v2");
  console.log("Local embedding model loaded: Xenova/all-MiniLM-L6-v2");
  return pipeline;
}

export async function embedText(text: string): Promise<number[]> {
  const model = await getEmbeddingModel();
  const output = await model(text, { pooling: "mean", normalize: true });
  return Array.from(output.data);
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const model = await getEmbeddingModel();
  const results: number[][] = [];
  for (const text of texts) {
    const output = await model(text, { pooling: "mean", normalize: true });
    results.push(Array.from(output.data));
  }
  return results;
}
