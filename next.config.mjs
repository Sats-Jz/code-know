/** @type {import('next').NextConfig} */
const nextConfig = {
  // Proxy /api/* to Spring backend (port 8080)
  // Set NEXT_PUBLIC_BACKEND=node to use built-in API routes instead
  rewrites: async () => {
    const backend = process.env.NEXT_PUBLIC_BACKEND || "spring";
    if (backend === "node") return [];
    return [
      { source: "/api/:path*", destination: "http://localhost:8080/api/:path*" },
    ];
  },
  experimental: {
    serverComponentsExternalPackages: [
      "better-sqlite3", "tree-sitter", "chromadb", "@chroma-core/default-embed",
      "adm-zip", "tar-fs", "tree-sitter-typescript", "tree-sitter-python",
      "tree-sitter-rust", "tree-sitter-go", "tree-sitter-java",
    ],
  },
};

export default nextConfig;
