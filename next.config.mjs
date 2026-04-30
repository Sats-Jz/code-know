/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: [
      "better-sqlite3", "tree-sitter", "chromadb", "@chroma-core/default-embed",
      "adm-zip", "tar-fs", "tree-sitter-typescript", "tree-sitter-python",
      "tree-sitter-rust", "tree-sitter-go", "tree-sitter-java",
      "@xenova/transformers", "onnxruntime-node", "sharp",
    ],
  },
};

export default nextConfig;
