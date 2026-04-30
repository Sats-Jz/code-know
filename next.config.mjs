/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["better-sqlite3", "tree-sitter", "chromadb", "@chroma-core/default-embed"],
  },
};

export default nextConfig;
