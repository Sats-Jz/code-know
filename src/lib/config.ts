import { resolve } from "node:path";

export const config = {
  deepseekApiKey: process.env.DEEPSEEK_API_KEY || "",
  deepseekBaseUrl: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
  siliconflowApiKey: process.env.SILICONFLOW_API_KEY || "",
  siliconflowBaseUrl: process.env.SILICONFLOW_BASE_URL || "https://api.siliconflow.cn/v1",
  embeddingModel: process.env.EMBEDDING_MODEL || "BAAI/bge-m3",
  chromadbUrl: process.env.CHROMADB_URL || "http://localhost:8000",
  dataDir: resolve(process.cwd(), process.env.DATA_DIR || "./repos"),
  chromaDir: resolve(process.cwd(), process.env.CHROMA_DIR || "./chroma-data"),
};
