# Code-Know Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a web-based personal AI code tutor that ingests code repos, indexes them with RAG, and provides AI-powered Q&A with call-chain diagram generation.

**Architecture:** Next.js 14 App Router monolith with API Routes for backend logic. ChromaDB runs as a local Docker sidecar. SQLite (better-sqlite3 + drizzle-orm) stores business data. DeepSeek API provides LLM and Embedding. The RAG pipeline uses tree-sitter AST chunking + ChromaDB vector search + SQLite FTS5 keyword search with RRF fusion.

**Tech Stack:** Next.js 14, React, Tailwind CSS, shadcn/ui, Shiki, ECharts, tree-sitter, ChromaDB (Docker), better-sqlite3, drizzle-orm, DeepSeek API, isomorphic-git, Biome, pnpm

---

## File Structure

```
src/
├── app/
│   ├── layout.tsx                    # Root layout with providers
│   ├── globals.css                   # Tailwind + base styles
│   ├── page.tsx                      # Home - repo list
│   ├── repo/[id]/
│   │   ├── page.tsx                  # Repo detail/overview
│   │   ├── layout.tsx                # Repo sub-layout (tabs)
│   │   ├── chat/page.tsx             # AI chat interface
│   │   ├── files/page.tsx            # File browser + viewer
│   │   └── graphs/page.tsx           # Saved charts view
│   └── settings/page.tsx             # Settings form
├── components/
│   ├── ui/                           # shadcn/ui primitives
│   ├── repo-card.tsx                 # Repo list card
│   ├── import-dialog.tsx             # 3-way import modal
│   ├── file-tree.tsx                 # Recursive file tree
│   ├── code-viewer.tsx               # Shiki syntax highlight
│   ├── chat-panel.tsx                # Chat messages + input
│   ├── chat-message.tsx              # Single chat bubble
│   ├── chart-viewer.tsx              # ECharts renderer
│   └── sidebar.tsx                   # App sidebar nav
├── lib/
│   ├── db/
│   │   ├── index.ts                  # SQLite connection
│   │   └── schema.ts                 # Drizzle schema
│   ├── rag/
│   │   ├── importer.ts               # Code import (local/git/zip)
│   │   ├── chunker.ts                # AST + sliding window chunker
│   │   ├── embedder.ts               # DeepSeek Embedding batch
│   │   ├── retriever.ts              # Hybrid search + RRF
│   │   └── llm.ts                    # DeepSeek V4 chat (SSE)
│   ├── chromadb.ts                   # ChromaDB client wrapper
│   ├── deepseek.ts                   # DeepSeek API client
│   ├── git.ts                        # isomorphic-git wrapper
│   └── config.ts                     # Env-based config loader
├── api/
│   ├── repos/
│   │   ├── route.ts                  # GET list + POST create
│   │   └── [id]/
│   │       ├── route.ts              # GET detail + DELETE
│   │       ├── reindex/route.ts      # POST reindex
│   │       ├── tree/route.ts         # GET file tree
│   │       ├── file/route.ts         # GET file content
│   │       ├── chat/route.ts         # POST SSE chat
│   │       ├── conversations/route.ts    # GET list
│   │       ├── conversations/[cid]/route.ts  # GET detail
│   │       ├── search/route.ts       # POST semantic search
│   │       └── graph/route.ts        # POST generate graph
│   ├── compare/route.ts              # POST cross-repo SSE
│   └── settings/
│       ├── route.ts                  # GET + PUT config
│       └── test-connection/route.ts  # POST test LLM/ChromaDB
├── repos/                            # Cloned repos data dir (gitignored)
├── chroma-data/                      # ChromaDB persistence (gitignored)
├── docker-compose.yml
└── .env.local
```

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.mjs`, `biome.json`, `.env.local`, `docker-compose.yml`, `src/app/layout.tsx`, `src/app/globals.css`, `src/app/page.tsx`

- [ ] **Step 1: Initialize Next.js project**

```bash
cd D:/AICode/code-know
pnpm init
pnpm add next@14 react@18 react-dom@18
pnpm add -D typescript @types/react @types/node
pnpm add tailwindcss postcss autoprefixer @tailwindcss/typography
pnpm add next-themes lucide-react
pnpm add -D @biomejs/biome
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Create next.config.ts**

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["better-sqlite3", "tree-sitter"],
  },
};

export default nextConfig;
```

- [ ] **Step 4: Create tailwind.config.ts**

```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: { extend: {} },
  plugins: [require("@tailwindcss/typography")],
};
export default config;
```

- [ ] **Step 5: Create postcss.config.mjs**

```javascript
/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: { tailwindcss: {}, autoprefixer: {} },
};
export default config;
```

- [ ] **Step 6: Create biome.json**

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
  "organizeImports": { "enabled": true },
  "linter": { "enabled": true, "rules": { "recommended": true } },
  "formatter": { "enabled": true, "indentStyle": "space", "indentWidth": 2 }
}
```

- [ ] **Step 7: Create .env.local**

```
DEEPSEEK_API_KEY=your-api-key-here
DEEPSEEK_BASE_URL=https://api.deepseek.com
CHROMADB_URL=http://localhost:8000
DATA_DIR=./repos
CHROMA_DIR=./chroma-data
```

- [ ] **Step 8: Create docker-compose.yml**

```yaml
version: "3.9"
services:
  chromadb:
    image: chromadb/chroma:latest
    ports:
      - "8000:8000"
    volumes:
      - ./chroma-data:/chroma/chroma
    environment:
      - IS_PERSISTENT=TRUE
      - ANONYMIZED_TELEMETRY=FALSE
    command: uvicorn chromadb.app:app --host 0.0.0.0 --port 8000
```

- [ ] **Step 9: Create src/app/globals.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 10: Create src/app/layout.tsx**

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Code-Know",
  description: "Personal AI Code Tutor & Repo Parser",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">{children}</body>
    </html>
  );
}
```

- [ ] **Step 11: Create src/app/page.tsx (placeholder)**

```tsx
export default function Home() {
  return (
    <main className="max-w-5xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-4">Code-Know</h1>
      <p className="text-zinc-400">个人 AI 代码导师与大型 Repo 解析器</p>
    </main>
  );
}
```

- [ ] **Step 12: Add package.json scripts**

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "biome check .",
    "format": "biome format --write ."
  }
}
```

- [ ] **Step 13: Verify dev server starts**

```bash
pnpm dev
```
Open http://localhost:3000, confirm the placeholder page renders.

- [ ] **Step 14: Commit**

```bash
git add -A && git commit -m "feat: scaffold Next.js project with Tailwind, Biome, Docker Compose"
```

---

### Task 2: Database Setup

**Files:**
- Create: `src/lib/db/schema.ts`, `src/lib/db/index.ts`
- Create: `src/lib/config.ts`

- [ ] **Step 1: Install dependencies**

```bash
pnpm add better-sqlite3 drizzle-orm
pnpm add -D @types/better-sqlite3 drizzle-kit
```

- [ ] **Step 2: Create src/lib/config.ts**

```typescript
import { resolve } from "node:path";

export const config = {
  deepseekApiKey: process.env.DEEPSEEK_API_KEY || "",
  deepseekBaseUrl: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
  chromadbUrl: process.env.CHROMADB_URL || "http://localhost:8000",
  dataDir: resolve(process.cwd(), process.env.DATA_DIR || "./repos"),
  chromaDir: resolve(process.cwd(), process.env.CHROMA_DIR || "./chroma-data"),
};
```

- [ ] **Step 3: Create src/lib/db/schema.ts**

```typescript
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const repos = sqliteTable("repos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  path: text("path"),
  gitUrl: text("git_url"),
  language: text("language"),
  fileCount: integer("file_count").default(0),
  lineCount: integer("line_count").default(0),
  indexStatus: text("index_status").default("pending"),
  createdAt: text("created_at").default(new Date().toISOString()),
  updatedAt: text("updated_at").default(new Date().toISOString()),
});

export const conversations = sqliteTable("conversations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  repoId: integer("repo_id").references(() => repos.id, { onDelete: "cascade" }).notNull(),
  title: text("title").default("新对话"),
  mode: text("mode").default("explain"),
  createdAt: text("created_at").default(new Date().toISOString()),
});

export const messages = sqliteTable("messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  conversationId: integer("conversation_id").references(() => conversations.id, { onDelete: "cascade" }).notNull(),
  role: text("role", { enum: ["user", "assistant"] }).notNull(),
  content: text("content").notNull(),
  tokensUsed: integer("tokens_used").default(0),
  createdAt: text("created_at").default(new Date().toISOString()),
});

export const chunks = sqliteTable("chunks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  repoId: integer("repo_id").references(() => repos.id, { onDelete: "cascade" }).notNull(),
  filePath: text("file_path").notNull(),
  startLine: integer("start_line").notNull(),
  endLine: integer("end_line").notNull(),
  chunkType: text("chunk_type").notNull(),
  symbolName: text("symbol_name"),
  content: text("content").notNull(),
  embeddingId: text("embedding_id").notNull(),
  createdAt: text("created_at").default(new Date().toISOString()),
});
```

- [ ] **Step 4: Create src/lib/db/index.ts**

```typescript
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import { resolve } from "node:path";

const sqlite = new Database(resolve(process.cwd(), "code-know.db"));
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
export { schema };
```

- [ ] **Step 5: Run migration to create tables**

Create `src/lib/db/migrate.ts`:

```typescript
import Database from "better-sqlite3";
import { resolve } from "node:path";

const sqlite = new Database(resolve(process.cwd(), "code-know.db"));
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS repos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    path TEXT,
    git_url TEXT,
    language TEXT,
    file_count INTEGER DEFAULT 0,
    line_count INTEGER DEFAULT 0,
    index_status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    repo_id INTEGER NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
    title TEXT DEFAULT '新对话',
    mode TEXT DEFAULT 'explain',
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    tokens_used INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS chunks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    repo_id INTEGER NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    start_line INTEGER NOT NULL,
    end_line INTEGER NOT NULL,
    chunk_type TEXT NOT NULL,
    symbol_name TEXT,
    content TEXT NOT NULL,
    embedding_id TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(file_path, symbol_name, content, content=chunks, content_rowid=id);
`);
console.log("Migration complete.");
```

Run:
```bash
pnpm tsx src/lib/db/migrate.ts
```

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: add SQLite database schema and migration"
```

---

### Task 3: ChromaDB Client

**Files:**
- Create: `src/lib/chromadb.ts`

- [ ] **Step 1: Install dependency**

```bash
pnpm add chromadb
```

- [ ] **Step 2: Create src/lib/chromadb.ts**

```typescript
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
    return await c.getCollection({ name });
  } catch {
    return await c.createCollection({ name });
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
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: add ChromaDB client wrapper"
```

---

### Task 4: DeepSeek API Client

**Files:**
- Create: `src/lib/deepseek.ts`

- [ ] **Step 1: Install dependency**

```bash
pnpm add openai
```

- [ ] **Step 2: Create src/lib/deepseek.ts**

```typescript
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
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: add DeepSeek API client with embedding support"
```

---

### Task 5: Code Importer

**Files:**
- Create: `src/lib/rag/importer.ts`
- Create: `src/lib/git.ts`

- [ ] **Step 1: Install dependencies**

```bash
pnpm add isomorphic-git decompress
pnpm add -D @types/decompress
```

- [ ] **Step 2: Create src/lib/git.ts**

```typescript
import git from "isomorphic-git";
import http from "isomorphic-git/http/node";
import fs from "node:fs";
import { config } from "./config";

export async function cloneRepo(gitUrl: string, repoName: string): Promise<string> {
  const dir = `${config.dataDir}/${repoName}`;
  await fs.promises.mkdir(dir, { recursive: true });
  await git.clone({ fs, http, dir, url: gitUrl, depth: 1, singleBranch: true });
  return dir;
}

export async function getGitUrlName(url: string): Promise<string> {
  const parts = url.split("/");
  const last = parts[parts.length - 1] || parts[parts.length - 2] || "repo";
  return last.replace(/\.git$/, "");
}
```

- [ ] **Step 3: Create src/lib/rag/importer.ts**

```typescript
import fs from "node:fs";
import path from "node:path";
import { config } from "../config";
import { cloneRepo, getGitUrlName } from "../git";

export type ImportSource =
  | { type: "local"; localPath: string }
  | { type: "git"; gitUrl: string }
  | { type: "upload"; filePath: string };

export async function importRepo(source: ImportSource): Promise<{ repoPath: string; repoName: string }> {
  let repoPath: string;
  let repoName: string;

  if (source.type === "local") {
    repoName = path.basename(source.localPath);
    repoPath = `${config.dataDir}/${repoName}`;
    await copyDir(source.localPath, repoPath);
  } else if (source.type === "git") {
    repoName = await getGitUrlName(source.gitUrl);
    repoPath = await cloneRepo(source.gitUrl, repoName);
  } else {
    throw new Error("Upload import not yet implemented");
  }

  return { repoPath, repoName };
}

export async function getRepoFiles(repoPath: string): Promise<string[]> {
  const files: string[] = [];
  const ignorePatterns = await loadGitignore(repoPath);

  async function walk(dir: string) {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relPath = path.relative(repoPath, fullPath);

      if (shouldIgnore(relPath, ignorePatterns)) continue;

      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        if (isCodeFile(relPath)) {
          files.push(relPath);
        }
      }
    }
  }

  await walk(repoPath);
  return files;
}

const CODE_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".py", ".rs", ".go", ".java", ".sol",
  ".c", ".cpp", ".h", ".hpp", ".cs", ".rb", ".php", ".swift", ".kt",
  ".scala", ".r", ".m", ".mm", ".vue", ".svelte", ".astro",
]);

function isCodeFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return CODE_EXTENSIONS.has(ext);
}

async function loadGitignore(repoPath: string): Promise<string[]> {
  const patterns: string[] = ["node_modules", ".git", "dist", "build", ".next", "target", "__pycache__", "*.lock", "*.json", "*.toml"];
  try {
    const content = await fs.promises.readFile(path.join(repoPath, ".gitignore"), "utf-8");
    patterns.push(...content.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#")));
  } catch {
    // no .gitignore
  }
  return patterns;
}

function shouldIgnore(relPath: string, patterns: string[]): boolean {
  const parts = relPath.replace(/\\/g, "/").split("/");
  for (const pattern of patterns) {
    if (parts.includes(pattern) || relPath.startsWith(pattern)) return true;
    if (pattern.endsWith("/") && relPath.startsWith(pattern)) return true;
  }
  return false;
}

async function copyDir(src: string, dest: string): Promise<void> {
  await fs.promises.mkdir(dest, { recursive: true });
  const entries = await fs.promises.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await fs.promises.copyFile(srcPath, destPath);
    }
  }
}

export function detectLanguage(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    ".ts": "typescript", ".tsx": "tsx", ".js": "javascript", ".jsx": "javascript",
    ".py": "python", ".rs": "rust", ".go": "go", ".java": "java", ".sol": "solidity",
    ".c": "c", ".cpp": "cpp", ".rb": "ruby", ".php": "php", ".swift": "swift",
    ".kt": "kotlin", ".vue": "vue", ".svelte": "svelte",
  };
  return map[ext] || "text";
}

export function countRepoStats(repoPath: string, files: string[]): { fileCount: number; lineCount: number; language: string } {
  let lineCount = 0;
  const langCount = new Map<string, number>();
  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(repoPath, file), "utf-8");
      lineCount += content.split("\n").length;
      const lang = detectLanguage(file);
      langCount.set(lang, (langCount.get(lang) || 0) + 1);
    } catch {
      // skip
    }
  }
  const language = [...langCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "unknown";
  return { fileCount: files.length, lineCount, language };
}
```

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: add code importer with local and git support"
```

---

### Task 6: Code Chunker (Mixed Strategy)

**Files:**
- Create: `src/lib/rag/chunker.ts`

- [ ] **Step 1: Install dependencies**

```bash
pnpm add tree-sitter
pnpm add -D tree-sitter-typescript tree-sitter-python tree-sitter-rust tree-sitter-go tree-sitter-java
```

- [ ] **Step 2: Create src/lib/rag/chunker.ts**

```typescript
import fs from "node:fs";
import path from "node:path";
import Parser from "tree-sitter";

const MAX_CHUNK_LINES = 60;
const WINDOW_LINES = 30;
const OVERLAP_LINES = 8;

let tsParser: Parser | null = null;
const loadedGrammars = new Map<string, unknown>();

function getParser(): Parser {
  if (!tsParser) tsParser = new Parser();
  return tsParser;
}

async function loadGrammar(lang: string): Promise<unknown | null> {
  if (loadedGrammars.has(lang)) return loadedGrammars.get(lang)!;

  const grammarMap: Record<string, string> = {
    typescript: "tree-sitter-typescript",
    tsx: "tree-sitter-typescript",
    python: "tree-sitter-python",
    rust: "tree-sitter-rust",
    go: "tree-sitter-go",
    java: "tree-sitter-java",
  };

  const pkgName = grammarMap[lang];
  if (!pkgName) return null;

  try {
    const grammar = await import(pkgName);
    loadedGrammars.set(lang, grammar.default || grammar);
    return grammar.default || grammar;
  } catch {
    return null;
  }
}

export interface Chunk {
  filePath: string;
  startLine: number;
  endLine: number;
  chunkType: string;
  symbolName: string | null;
  content: string;
}

export async function chunkFile(repoPath: string, filePath: string): Promise<Chunk[]> {
  const fullPath = path.join(repoPath, filePath);
  const content = fs.readFileSync(fullPath, "utf-8");
  const lines = content.split("\n");
  const ext = path.extname(filePath).toLowerCase();
  const lang = extToLang(ext);

  const chunks = await tryAstChunk(content, filePath, lang, lines);
  if (chunks.length > 0) return chunks;

  return windowChunk(filePath, lines);
}

function extToLang(ext: string): string {
  const map: Record<string, string> = {
    ".ts": "typescript", ".tsx": "tsx", ".js": "typescript", ".jsx": "tsx",
    ".py": "python", ".rs": "rust", ".go": "go", ".java": "java",
  };
  return map[ext] || ext.slice(1);
}

async function tryAstChunk(
  content: string,
  filePath: string,
  lang: string,
  lines: string[],
): Promise<Chunk[]> {
  const grammar = await loadGrammar(lang);
  if (!grammar) return [];

  const parser = getParser();
  parser.setLanguage(grammar as Parser.Language);

  const tree = parser.parse(content);
  const chunks: Chunk[] = [];

  const definitionTypes = new Set([
    "function_declaration", "method_definition", "class_declaration",
    "interface_declaration", "struct_item", "impl_item", "trait_item",
    "function_item", "method_declaration", "constructor", "contract_declaration",
    "function_definition", "class_definition",
  ]);

  function walk(node: Parser.SyntaxNode) {
    if (definitionTypes.has(node.type)) {
      const startRow = node.startPosition.row + 1;
      const endRow = node.endPosition.row + 1;
      const chunkLines = endRow - startRow + 1;

      let name: string | null = null;
      const nameChild = node.childForFieldName?.("name") ?? node.namedChildren.find(
        (c) => c.type === "identifier" || c.type === "property_identifier",
      );
      if (nameChild) name = nameChild.text;

      if (chunkLines <= MAX_CHUNK_LINES) {
        chunks.push({
          filePath,
          startLine: startRow,
          endLine: endRow,
          chunkType: node.type,
          symbolName: name,
          content: lines.slice(startRow - 1, endRow).join("\n"),
        });
      } else {
        const subChunks = windowChunkSlices(lines.slice(startRow - 1, endRow), startRow);
        for (const sc of subChunks) {
          chunks.push({ ...sc, filePath, chunkType: node.type, symbolName: name });
        }
      }
    }
    for (const child of node.namedChildren) {
      walk(child);
    }
  }

  walk(tree.rootNode);
  return chunks;
}

function windowChunk(filePath: string, lines: string[]): Chunk[] {
  return windowChunkSlices(lines, 1).map((c) => ({
    ...c,
    filePath,
    chunkType: "block",
    symbolName: null,
  }));
}

function windowChunkSlices(lines: string[], startRow: number): { startLine: number; endLine: number; content: string }[] {
  const slices: { startLine: number; endLine: number; content: string }[] = [];
  let i = 0;
  while (i < lines.length) {
    const end = Math.min(i + WINDOW_LINES, lines.length);
    slices.push({
      startLine: startRow + i,
      endLine: startRow + end - 1,
      content: lines.slice(i, end).join("\n"),
    });
    i += WINDOW_LINES - OVERLAP_LINES;
  }
  return slices;
}

export async function chunkRepo(repoPath: string, files: string[]): Promise<Chunk[]> {
  const allChunks: Chunk[] = [];
  for (const file of files) {
    const chunks = await chunkFile(repoPath, file);
    allChunks.push(...chunks);
  }
  return allChunks;
}
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: add AST + sliding window code chunker"
```

---

### Task 7: Embedder

**Files:**
- Create: `src/lib/rag/embedder.ts`

- [ ] **Step 1: Create src/lib/rag/embedder.ts**

```typescript
import { createEmbeddings } from "../deepseek";
import { addChunks } from "../chromadb";
import { db, schema } from "../db";
import type { Chunk } from "./chunker";

const BATCH_SIZE = 50;

export async function embedChunks(repoId: number, chunks: Chunk[]): Promise<void> {
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const texts = batch.map((c) => c.content);
    const embeddings = await createEmbeddings(texts);

    const chromaItems = batch.map((chunk, idx) => {
      const id = `repo_${repoId}_chunk_${i + idx}`;
      return {
        id,
        embedding: embeddings[idx],
        metadata: {
          filePath: chunk.filePath,
          startLine: String(chunk.startLine),
          endLine: String(chunk.endLine),
          chunkType: chunk.chunkType,
          symbolName: chunk.symbolName || "",
        },
        document: chunk.content,
      };
    });

    await addChunks(repoId, chromaItems);

    const sqlRows = batch.map((chunk, idx) => ({
      repoId,
      filePath: chunk.filePath,
      startLine: chunk.startLine,
      endLine: chunk.endLine,
      chunkType: chunk.chunkType,
      symbolName: chunk.symbolName,
      content: chunk.content,
      embeddingId: `repo_${repoId}_chunk_${i + idx}`,
    }));

    for (const row of sqlRows) {
      db.insert(schema.chunks).values(row).run();
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat: add batch embedder with ChromaDB + SQLite dual storage"
```

---

### Task 8: Retriever (Hybrid Search + RRF)

**Files:**
- Create: `src/lib/rag/retriever.ts`

- [ ] **Step 1: Create src/lib/rag/retriever.ts**

```typescript
import { createEmbedding } from "../deepseek";
import { queryChunks } from "../chromadb";
import { db, schema } from "../db";
import { sql } from "drizzle-orm";

export interface SearchResult {
  chunkId: number;
  filePath: string;
  startLine: number;
  endLine: number;
  chunkType: string;
  symbolName: string | null;
  content: string;
  score: number;
}

export async function hybridSearch(repoId: number, query: string, topK: number = 15): Promise<SearchResult[]> {
  const [vectorResults, ftsResults] = await Promise.all([
    vectorSearch(repoId, query, 20),
    ftsSearch(repoId, query, 20),
  ]);

  const rrfScores = new Map<number, number>();
  const allResults = new Map<number, SearchResult>();

  const addToRRF = (results: SearchResult[], rankWeight: number) => {
    results.forEach((r, idx) => {
      const score = 1 / (60 + idx + 1);
      rrfScores.set(r.chunkId, (rrfScores.get(r.chunkId) || 0) + score * rankWeight);
      allResults.set(r.chunkId, r);
    });
  };

  addToRRF(vectorResults, 1.0);
  addToRRF(ftsResults, 1.0);

  const ranked = [...rrfScores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topK)
    .map(([id]) => allResults.get(id)!)
    .filter(Boolean);

  return ranked;
}

async function vectorSearch(repoId: number, query: string, topK: number): Promise<SearchResult[]> {
  const embedding = await createEmbedding(query);
  const result = await queryChunks(repoId, embedding, topK);

  const searchResults: SearchResult[] = [];
  const chunkRecords = db
    .select()
    .from(schema.chunks)
    .where(sql`repo_id = ${repoId}`)
    .all();

  for (let i = 0; i < result.ids.length; i++) {
    const embId = result.ids[i];
    const chunk = chunkRecords.find((c) => c.embeddingId === embId);
    if (chunk) {
      searchResults.push({
        chunkId: chunk.id,
        filePath: chunk.filePath,
        startLine: chunk.startLine,
        endLine: chunk.endLine,
        chunkType: chunk.chunkType,
        symbolName: chunk.symbolName,
        content: chunk.content,
        score: 1 - (result.distances[i] || 0),
      });
    }
  }
  return searchResults;
}

async function ftsSearch(repoId: number, query: string, topK: number): Promise<SearchResult[]> {
  const rows = db
    .select()
    .from(schema.chunks)
    .where(
      sql`repo_id = ${repoId} AND rowid IN (SELECT rowid FROM chunks_fts WHERE chunks_fts MATCH ${query} LIMIT ${topK})`,
    )
    .limit(topK)
    .all();

  return rows.map((r) => ({
    chunkId: r.id,
    filePath: r.filePath,
    startLine: r.startLine,
    endLine: r.endLine,
    chunkType: r.chunkType,
    symbolName: r.symbolName,
    content: r.content,
    score: 0.8,
  }));
}
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat: add hybrid retriever with RRF fusion"
```

---

### Task 9: LLM Chat Service

**Files:**
- Create: `src/lib/rag/llm.ts`

- [ ] **Step 1: Create src/lib/rag/llm.ts**

```typescript
import { getDeepSeekClient } from "../deepseek";
import { hybridSearch, type SearchResult } from "./retriever";

const SYSTEM_PROMPT = `你是一个资深代码架构师。基于提供的代码片段回答用户问题。

回答要求：
- 引用具体文件路径和行号，格式: \`[file:path/to/file.ts:42]\`
- 如需展示调用链或架构关系，用 [chart:类型]...[/chart] 包裹 Mermaid 代码
- 代码示例使用标准 Markdown 代码块，标注语言
- 解释要清晰深入，逐层分析
- 如果信息不足，明确指出`;

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export async function* chatStream(
  repoId: number,
  query: string,
  history: ChatMessage[] = [],
): AsyncGenerator<{ type: "text" | "chart" | "references" | "done"; data: unknown }> {
  const results = await hybridSearch(repoId, query, 15);
  const context = buildContext(results);

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history.slice(-10),
    { role: "user", content: `${context}\n\n用户问题: ${query}` },
  ];

  const client = getDeepSeekClient();
  const stream = await client.chat.completions.create({
    model: "deepseek-chat",
    messages,
    stream: true,
    temperature: 0.3,
    max_tokens: 8192,
  });

  let fullText = "";

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) {
      fullText += delta;
      yield { type: "text", data: delta };
    }
  }

  const chartMatch = fullText.match(/\[chart:(\w+)\]([\s\S]*?)\[\/chart\]/g);
  if (chartMatch) {
    for (const m of chartMatch) {
      const typeMatch = m.match(/\[chart:(\w+)\]/);
      const bodyMatch = m.match(/\[chart:\w+\]([\s\S]*?)\[\/chart\]/);
      if (typeMatch && bodyMatch) {
        yield { type: "chart", data: { chartType: typeMatch[1], mermaid: bodyMatch[1].trim() } };
      }
    }
  }

  const fileRefs = extractFileRefs(fullText);
  if (fileRefs.length > 0) {
    yield { type: "references", data: fileRefs };
  }

  yield { type: "done", data: { tokensUsed: fullText.length } };
}

function buildContext(results: SearchResult[]): string {
  const grouped = new Map<string, SearchResult[]>();
  for (const r of results) {
    const existing = grouped.get(r.filePath) || [];
    existing.push(r);
    grouped.set(r.filePath, existing);
  }

  let ctx = "以下是相关代码片段：\n\n";
  for (const [file, chunks] of grouped) {
    ctx += `### ${file}\n`;
    for (const c of chunks) {
      const name = c.symbolName ? ` [${c.symbolName}]` : "";
      ctx += `\`\`\`${c.chunkType} L${c.startLine}-L${c.endLine}${name}\n${c.content}\n\`\`\`\n\n`;
    }
  }
  return ctx;
}

function extractFileRefs(text: string): string[] {
  const matches = text.matchAll(/\[file:([^\]]+)\]/g);
  return [...matches].map((m) => m[1]);
}
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat: add streaming LLM chat with context building"
```

---

### Task 10: API Routes - Repos CRUD

**Files:**
- Create: `src/api/repos/route.ts`, `src/api/repos/[id]/route.ts`

- [ ] **Step 1: Create src/api/repos/route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { importRepo, getRepoFiles, countRepoStats, detectLanguage } from "@/lib/rag/importer";
import { chunkRepo } from "@/lib/rag/chunker";
import { embedChunks } from "@/lib/rag/embedder";
import { eq, desc } from "drizzle-orm";
import { unlink, rmdir } from "node:fs/promises";
import { existsSync } from "node:fs";

export async function GET() {
  const repos = db.select().from(schema.repos).orderBy(desc(schema.repos.updatedAt)).all();
  return NextResponse.json(repos);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { type, localPath, gitUrl } = body;

  let source;
  if (type === "local") {
    source = { type: "local" as const, localPath };
  } else if (type === "git") {
    source = { type: "git" as const, gitUrl };
  } else {
    return NextResponse.json({ error: "Unsupported import type" }, { status: 400 });
  }

  const { repoPath, repoName } = await importRepo(source);

  const files = await getRepoFiles(repoPath);
  const stats = countRepoStats(repoPath, files);

  const repo = db
    .insert(schema.repos)
    .values({
      name: repoName,
      path: repoPath,
      gitUrl: gitUrl || null,
      language: stats.language,
      fileCount: stats.fileCount,
      lineCount: stats.lineCount,
      indexStatus: "indexing",
    })
    .returning()
    .get();

  indexRepoAsync(repo.id, repoPath, files);

  return NextResponse.json(repo, { status: 201 });
}

async function indexRepoAsync(repoId: number, repoPath: string, files: string[]) {
  try {
    const chunks = await chunkRepo(repoPath, files);
    await embedChunks(repoId, chunks);
    db.update(schema.repos)
      .set({ indexStatus: "ready", updatedAt: new Date().toISOString() })
      .where(eq(schema.repos.id, repoId))
      .run();
  } catch (e) {
    console.error("Index failed:", e);
    db.update(schema.repos)
      .set({ indexStatus: "error", updatedAt: new Date().toISOString() })
      .where(eq(schema.repos.id, repoId))
      .run();
  }
}
```

- [ ] **Step 2: Create src/api/repos/[id]/route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { deleteCollection } from "@/lib/chromadb";
import { eq } from "drizzle-orm";
import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const repo = db.select().from(schema.repos).where(eq(schema.repos.id, Number(params.id))).get();
  if (!repo) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(repo);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  const repo = db.select().from(schema.repos).where(eq(schema.repos.id, id)).get();
  if (!repo) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await deleteCollection(id);
  db.delete(schema.chunks).where(eq(schema.chunks.repoId, id)).run();
  db.delete(schema.conversations).where(eq(schema.conversations.repoId, id)).run();
  db.delete(schema.repos).where(eq(schema.repos.id, id)).run();

  if (repo.path && existsSync(repo.path)) {
    await rm(repo.path, { recursive: true, force: true });
  }

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: add repo CRUD API with async indexing"
```

---

### Task 11: API Routes - File Browsing

**Files:**
- Create: `src/api/repos/[id]/tree/route.ts`, `src/api/repos/[id]/file/route.ts`

- [ ] **Step 1: Create src/api/repos/[id]/tree/route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import fs from "node:fs";
import path from "node:path";

interface TreeNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: TreeNode[];
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const repo = db.select().from(schema.repos).where(eq(schema.repos.id, Number(params.id))).get();
  if (!repo || !repo.path) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const dir = req.nextUrl.searchParams.get("dir") || "";
  const fullPath = path.join(repo.path, dir);

  if (!fs.existsSync(fullPath)) {
    return NextResponse.json({ error: "Directory not found" }, { status: 404 });
  }

  const entries = fs.readdirSync(fullPath, { withFileTypes: true });
  const ignore = new Set(["node_modules", ".git", "dist", "build", ".next", "target", "__pycache__"]);

  const tree: TreeNode[] = entries
    .filter((e) => !ignore.has(e.name) && !e.name.startsWith("."))
    .map((e) => ({
      name: e.name,
      path: dir ? `${dir}/${e.name}` : e.name,
      type: e.isDirectory() ? "directory" as const : "file" as const,
    }))
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

  return NextResponse.json(tree);
}
```

- [ ] **Step 2: Create src/api/repos/[id]/file/route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import fs from "node:fs";
import path from "node:path";
import { detectLanguage } from "@/lib/rag/importer";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const repo = db.select().from(schema.repos).where(eq(schema.repos.id, Number(params.id))).get();
  if (!repo || !repo.path) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const filePath = req.nextUrl.searchParams.get("path");
  if (!filePath) return NextResponse.json({ error: "path required" }, { status: 400 });

  const fullPath = path.join(repo.path, filePath);
  if (!fs.existsSync(fullPath)) return NextResponse.json({ error: "File not found" }, { status: 404 });

  const content = fs.readFileSync(fullPath, "utf-8");
  const language = detectLanguage(filePath);

  return NextResponse.json({ path: filePath, content, language });
}
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: add file tree and file content API"
```

---

### Task 12: API Routes - Chat

**Files:**
- Create: `src/api/repos/[id]/chat/route.ts`, `src/api/repos/[id]/conversations/route.ts`, `src/api/repos/[id]/conversations/[cid]/route.ts`

- [ ] **Step 1: Create src/api/repos/[id]/chat/route.ts**

```typescript
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

  db.insert(schema.messages).values({
    conversationId: convId,
    role: "user",
    content: JSON.stringify({ text: message, mode }),
    createdAt: new Date().toISOString(),
  }).run();

  const historyRows = db
    .select()
    .from(schema.messages)
    .where(eq(schema.messages.conversationId, convId))
    .orderBy(schema.messages.createdAt)
    .all();

  const history: ChatMessage[] = historyRows.map((r) => ({
    role: r.role as "user" | "assistant",
    content: r.content,
  }));

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      const parts: { type: string; data: unknown }[] = [];
      try {
        for await (const chunk of chatStream(repoId, message, history)) {
          parts.push(chunk);
          controller.enqueue(encoder.encode(`event: ${chunk.type}\ndata: ${JSON.stringify(chunk.data)}\n\n`));
        }

        db.insert(schema.messages).values({
          conversationId: convId,
          role: "assistant",
          content: JSON.stringify(parts),
        }).run();

        controller.enqueue(encoder.encode("event: done\ndata: {}\n\n"));
        controller.close();
      } catch (e) {
        controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ error: String(e) })}\n\n`));
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
```

- [ ] **Step 2: Create src/api/repos/[id]/conversations/route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, desc } from "drizzle-orm";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const convs = db
    .select()
    .from(schema.conversations)
    .where(eq(schema.conversations.repoId, Number(params.id)))
    .orderBy(desc(schema.conversations.createdAt))
    .all();
  return NextResponse.json(convs);
}
```

- [ ] **Step 3: Create src/api/repos/[id]/conversations/[cid]/route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

export async function GET(_req: NextRequest, { params }: { params: { id: string; cid: string } }) {
  const messages = db
    .select()
    .from(schema.messages)
    .where(eq(schema.messages.conversationId, Number(params.cid)))
    .orderBy(schema.messages.createdAt)
    .all();
  return NextResponse.json(messages);
}
```

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: add SSE chat API with conversation history"
```

---

### Task 13: API Routes - Search, Graph, Compare, Settings

**Files:**
- Create: `src/api/repos/[id]/search/route.ts`, `src/api/repos/[id]/graph/route.ts`, `src/api/compare/route.ts`, `src/api/settings/route.ts`, `src/api/settings/test-connection/route.ts`

- [ ] **Step 1: Create src/api/repos/[id]/search/route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { hybridSearch } from "@/lib/rag/retriever";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { query } = await req.json();
  const results = await hybridSearch(Number(params.id), query, 20);
  return NextResponse.json(results);
}
```

- [ ] **Step 2: Create src/api/repos/[id]/graph/route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getDeepSeekClient } from "@/lib/deepseek";
import { hybridSearch } from "@/lib/rag/retriever";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { target, graphType = "call-chain" } = await req.json();
  const results = await hybridSearch(Number(params.id), target, 10);

  const context = results.map((r) => `[${r.filePath}:${r.startLine}] ${r.content}`).join("\n\n");

  const client = getDeepSeekClient();
  const res = await client.chat.completions.create({
    model: "deepseek-chat",
    messages: [
      {
        role: "system",
        content: `Generate a ${graphType} graph as a Mermaid diagram. Context:\n${context}`,
      },
      { role: "user", content: target },
    ],
    temperature: 0.2,
    max_tokens: 4096,
  });

  const mermaid = res.choices[0]?.message?.content || "";
  return NextResponse.json({ mermaid, graphType });
}
```

- [ ] **Step 3: Create src/api/compare/route.ts**

```typescript
import { NextRequest } from "next/server";
import { db, schema } from "@/lib/db";
import { hybridSearch } from "@/lib/rag/retriever";
import { getDeepSeekClient } from "@/lib/deepseek";
import { sql } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const { repoIds, question } = await req.json();

  const repos = db
    .select()
    .from(schema.repos)
    .where(sql`id IN (${repoIds.join(",")})`)
    .all();

  const contexts = await Promise.all(
    repos.map(async (repo) => {
      const results = await hybridSearch(repo.id, question, 10);
      return { repo: repo.name, chunks: results };
    }),
  );

  let context = "";
  for (const { repo, chunks } of contexts) {
    context += `\n## ${repo}\n`;
    context += chunks.map((c) => `[${c.filePath}:${c.startLine}] ${c.content}`).join("\n\n");
  }

  const client = getDeepSeekClient();
  const stream = await client.chat.completions.create({
    model: "deepseek-chat",
    messages: [
      { role: "system", content: "Compare the following codebases based on the user's question." },
      { role: "user", content: `${context}\n\nQuestion: ${question}` },
    ],
    stream: true,
    temperature: 0.3,
    max_tokens: 8192,
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta })}\n\n`));
        }
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  });
}
```

- [ ] **Step 4: Create src/api/settings/route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { config } from "@/lib/config";

export async function GET() {
  return NextResponse.json({
    deepseekConfigured: !!config.deepseekApiKey,
    chromadbUrl: config.chromadbUrl,
    dataDir: config.dataDir,
  });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  // Settings are managed via .env.local for now
  return NextResponse.json({ success: true, note: "Update .env.local to change settings" });
}
```

- [ ] **Step 5: Create src/api/settings/test-connection/route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { testDeepSeekConnection } from "@/lib/deepseek";
import { testChromaConnection } from "@/lib/chromadb";

export async function POST() {
  const [deepseekOk, chromaOk] = await Promise.all([
    testDeepSeekConnection().catch(() => false),
    testChromaConnection().catch(() => false),
  ]);
  return NextResponse.json({ deepseek: deepseekOk, chromadb: chromaOk });
}
```

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: add search, graph, compare, settings API routes"
```

---

### Task 14: Frontend Foundation (shadcn/ui + Layout)

**Files:**
- Create: `components.json`, `src/lib/utils.ts`
- Create: `src/components/ui/button.tsx`, `src/components/ui/input.tsx`, `src/components/ui/dialog.tsx`, `src/components/ui/textarea.tsx`, `src/components/ui/scroll-area.tsx`
- Modify: `src/app/layout.tsx`, `src/app/page.tsx`

- [ ] **Step 1: Init shadcn/ui**

```bash
pnpm dlx shadcn-ui@latest init -y --defaults
pnpm dlx shadcn-ui@latest add button input dialog textarea scroll-area tabs card
```

- [ ] **Step 2: Update src/app/layout.tsx with sidebar**

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";

export const metadata: Metadata = {
  title: "Code-Know",
  description: "Personal AI Code Tutor & Repo Parser",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className="dark" suppressHydrationWarning>
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
        <div className="flex h-screen">
          <Sidebar />
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Create src/components/sidebar.tsx**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Settings, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-16 border-r border-zinc-800 flex flex-col items-center py-4 gap-2">
      <Link href="/">
        <BookOpen className="h-6 w-6 text-zinc-400 hover:text-zinc-100" />
      </Link>
      <div className="flex-1" />
      <Link href="/">
        <Button variant={pathname === "/" ? "secondary" : "ghost"} size="icon" title="仓库">
          <Home className="h-5 w-5" />
        </Button>
      </Link>
      <Link href="/settings">
        <Button variant={pathname === "/settings" ? "secondary" : "ghost"} size="icon" title="设置">
          <Settings className="h-5 w-5" />
        </Button>
      </Link>
    </aside>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: add shadcn/ui foundation and sidebar layout"
```

---

### Task 15: Frontend - Home Page (Repo List)

**Files:**
- Create: `src/components/repo-card.tsx`, `src/components/import-dialog.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Create src/components/repo-card.tsx**

```tsx
"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, MessageCircle, FolderOpen } from "lucide-react";
import Link from "next/link";

interface Repo {
  id: number;
  name: string;
  language: string;
  fileCount: number;
  lineCount: number;
  indexStatus: string;
  updatedAt: string;
}

export function RepoCard({ repo, onDelete }: { repo: Repo; onDelete: (id: number) => void }) {
  return (
    <Card className="p-4 bg-zinc-900 border-zinc-800 hover:border-zinc-700 transition-colors">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-zinc-500" />
            {repo.name}
            {repo.indexStatus === "indexing" && (
              <span className="text-xs bg-yellow-900/50 text-yellow-400 px-2 py-0.5 rounded">索引中...</span>
            )}
            {repo.indexStatus === "error" && (
              <span className="text-xs bg-red-900/50 text-red-400 px-2 py-0.5 rounded">失败</span>
            )}
          </h3>
          <p className="text-sm text-zinc-500 mt-1">
            {repo.language} · {repo.fileCount.toLocaleString()} 文件 · {repo.lineCount.toLocaleString()} 行
          </p>
        </div>
        <div className="flex gap-1">
          {repo.indexStatus === "ready" && (
            <Link href={`/repo/${repo.id}/chat`}>
              <Button variant="ghost" size="icon" title="对话">
                <MessageCircle className="h-4 w-4" />
              </Button>
            </Link>
          )}
          <Button variant="ghost" size="icon" onClick={() => onDelete(repo.id)} title="删除">
            <Trash2 className="h-4 w-4 text-red-500" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
```

- [ ] **Step 2: Create src/components/import-dialog.tsx**

```tsx
"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Folder, Globe, Upload } from "lucide-react";

export function ImportDialog({ onImport }: { onImport: () => void }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function importRepo(type: string, value: string) {
    setLoading(true);
    const body = type === "local" ? { type: "local", localPath: value } : { type: "git", gitUrl: value };
    await fetch("/api/repos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setLoading(false);
    setOpen(false);
    onImport();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" /> 导入仓库
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md bg-zinc-900 border-zinc-800">
        <DialogHeader>
          <DialogTitle>导入代码仓库</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="local" className="mt-4">
          <TabsList className="grid grid-cols-3 bg-zinc-800">
            <TabsTrigger value="local" className="gap-1"><Folder className="h-3 w-3" /> 本地</TabsTrigger>
            <TabsTrigger value="git" className="gap-1"><Globe className="h-3 w-3" /> Git</TabsTrigger>
            <TabsTrigger value="upload" disabled className="gap-1"><Upload className="h-3 w-3" /> 上传</TabsTrigger>
          </TabsList>
          <TabsContent value="local">
            <ImportForm type="local" label="本地路径" placeholder="/path/to/project" loading={loading} onSubmit={importRepo} />
          </TabsContent>
          <TabsContent value="git">
            <ImportForm type="git" label="Git URL" placeholder="https://github.com/user/repo.git" loading={loading} onSubmit={importRepo} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function ImportForm({ type, label, placeholder, loading, onSubmit }: {
  type: string; label: string; placeholder: string; loading: boolean;
  onSubmit: (type: string, value: string) => void;
}) {
  const [value, setValue] = useState("");
  return (
    <div className="space-y-3 mt-2">
      <Input placeholder={placeholder} value={value} onChange={(e) => setValue(e.target.value)} className="bg-zinc-800 border-zinc-700" />
      <Button onClick={() => onSubmit(type, value)} disabled={!value || loading} className="w-full">
        {loading ? "导入中..." : "导入"}
      </Button>
    </div>
  );
}
```

- [ ] **Step 3: Update src/app/page.tsx**

```tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { RepoCard } from "@/components/repo-card";
import { ImportDialog } from "@/components/import-dialog";

export default function Home() {
  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchRepos = useCallback(async () => {
    const res = await fetch("/api/repos");
    setRepos(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchRepos(); }, [fetchRepos]);

  const handleDelete = async (id: number) => {
    await fetch(`/api/repos/${id}`, { method: "DELETE" });
    fetchRepos();
  };

  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Code-Know</h1>
          <p className="text-zinc-500 mt-1">个人 AI 代码导师与大型 Repo 解析器</p>
        </div>
        <ImportDialog onImport={fetchRepos} />
      </div>

      {loading ? (
        <p className="text-zinc-500">加载中...</p>
      ) : repos.length === 0 ? (
        <div className="text-center py-20 text-zinc-500">
          <p className="text-lg mb-2">还没有导入任何仓库</p>
          <p>点击「导入仓库」开始</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {repos.map((repo: any) => <RepoCard key={repo.id} repo={repo} onDelete={handleDelete} />)}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: add repo list home page with import dialog"
```

---

### Task 16: Frontend - File Browser + Code Viewer

**Files:**
- Create: `src/components/file-tree.tsx`, `src/components/code-viewer.tsx`
- Create: `src/app/repo/[id]/page.tsx`, `src/app/repo/[id]/files/page.tsx`, `src/app/repo/[id]/layout.tsx`

- [ ] **Step 1: Create src/app/repo/[id]/layout.tsx**

```tsx
"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";

const tabs = [
  { name: "概览", href: "" },
  { name: "对话", href: "/chat" },
  { name: "文件", href: "/files" },
  { name: "图表", href: "/graphs" },
];

export default function RepoLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const params = useParams();

  return (
    <div className="h-full flex flex-col">
      <div className="border-b border-zinc-800 px-6 py-2 flex gap-1">
        {tabs.map((tab) => {
          const href = `/repo/${params.id}${tab.href}`;
          const active = pathname === href;
          return (
            <Link key={tab.name} href={href}>
              <Button variant={active ? "secondary" : "ghost"} size="sm">{tab.name}</Button>
            </Link>
          );
        })}
      </div>
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
}
```

- [ ] **Step 2: Create src/app/repo/[id]/page.tsx**

```tsx
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

export default function RepoDetail() {
  const params = useParams();
  const [repo, setRepo] = useState<any>(null);

  useEffect(() => {
    fetch(`/api/repos/${params.id}`).then((r) => r.json()).then(setRepo);
  }, [params.id]);

  if (!repo) return <div className="p-8 text-zinc-500">加载中...</div>;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">{repo.name}</h1>
      <div className="grid grid-cols-3 gap-4 mt-4">
        <StatCard label="语言" value={repo.language} />
        <StatCard label="文件数" value={repo.fileCount.toLocaleString()} />
        <StatCard label="代码行数" value={repo.lineCount.toLocaleString()} />
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
      <p className="text-sm text-zinc-500">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}
```

- [ ] **Step 3: Create src/components/file-tree.tsx**

```tsx
"use client";

import { useEffect, useState } from "react";
import { ChevronRight, Folder, File, FolderOpen } from "lucide-react";

interface TreeNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: TreeNode[];
}

export function FileTree({ repoId, onSelectFile }: { repoId: string; onSelectFile: (path: string) => void }) {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch(`/api/repos/${repoId}/tree`).then((r) => r.json()).then(setTree);
  }, [repoId]);

  return (
    <div className="text-sm">
      {tree.map((node) => (
        <TreeNodeItem key={node.path} node={node} depth={0} expanded={expanded} setExpanded={setExpanded} repoId={repoId} onSelectFile={onSelectFile} />
      ))}
    </div>
  );
}

function TreeNodeItem({ node, depth, expanded, setExpanded, repoId, onSelectFile }: {
  node: TreeNode; depth: number; expanded: Set<string>; setExpanded: (s: Set<string>) => void;
  repoId: string; onSelectFile: (path: string) => void;
}) {
  const isOpen = expanded.has(node.path);

  const toggle = async () => {
    if (node.type === "file") { onSelectFile(node.path); return; }
    if (isOpen) { const next = new Set(expanded); next.delete(node.path); setExpanded(next); }
    else {
      const res = await fetch(`/api/repos/${repoId}/tree?dir=${node.path}`);
      node.children = await res.json();
      const next = new Set(expanded); next.add(node.path); setExpanded(next);
    }
  };

  return (
    <div>
      <button
        onClick={toggle}
        className="flex items-center gap-1 w-full text-left px-2 py-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-100"
        style={{ paddingLeft: depth * 16 + 8 }}
      >
        {node.type === "directory" ? (
          isOpen ? <FolderOpen className="h-3.5 w-3.5 shrink-0" /> : <Folder className="h-3.5 w-3.5 shrink-0" />
        ) : (
          <File className="h-3.5 w-3.5 shrink-0" />
        )}
        <span className="truncate">{node.name}</span>
      </button>
      {isOpen && node.children?.map((child) => (
        <TreeNodeItem key={child.path} node={child} depth={depth + 1} expanded={expanded} setExpanded={setExpanded} repoId={repoId} onSelectFile={onSelectFile} />
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Create src/components/code-viewer.tsx**

```tsx
"use client";

import { useEffect, useState } from "react";
import { codeToHtml } from "shiki";

export function CodeViewer({ content, language }: { content: string; language: string }) {
  const [html, setHtml] = useState("");

  useEffect(() => {
    codeToHtml(content, { lang: language, theme: "github-dark" }).then(setHtml);
  }, [content, language]);

  return <div dangerouslySetInnerHTML={{ __html: html }} className="text-sm leading-relaxed" />;
}
```

- [ ] **Step 5: Create src/app/repo/[id]/files/page.tsx**

```tsx
"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { FileTree } from "@/components/file-tree";
import { CodeViewer } from "@/components/code-viewer";

export default function FilesPage() {
  const params = useParams();
  const [file, setFile] = useState<{ path: string; content: string; language: string } | null>(null);

  async function handleSelectFile(path: string) {
    const res = await fetch(`/api/repos/${params.id}/file?path=${path}`);
    setFile(await res.json());
  }

  return (
    <div className="flex h-full">
      <div className="w-72 border-r border-zinc-800 overflow-auto p-2">
        <FileTree repoId={params.id as string} onSelectFile={handleSelectFile} />
      </div>
      <div className="flex-1 overflow-auto p-6">
        {file ? (
          <div>
            <p className="text-sm text-zinc-500 mb-3">{file.path}</p>
            <CodeViewer content={file.content} language={file.language} />
          </div>
        ) : (
          <p className="text-zinc-500 text-center mt-20">选择文件查看代码</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Install Shiki**

```bash
pnpm add shiki
```

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: add file browser with Shiki syntax highlighting"
```

---

### Task 17: Frontend - Chat Interface

**Files:**
- Create: `src/components/chat-panel.tsx`, `src/components/chat-message.tsx`
- Create: `src/app/repo/[id]/chat/page.tsx`

- [ ] **Step 1: Create src/components/chat-message.tsx**

```tsx
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Bot, User } from "lucide-react";

interface Props {
  role: "user" | "assistant";
  content: string;
}

export function ChatMessage({ role, content }: Props) {
  return (
    <div className={`flex gap-3 py-4 ${role === "assistant" ? "bg-zinc-900/50" : ""} px-4`}>
      <div className={`shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${role === "assistant" ? "bg-green-900/50 text-green-400" : "bg-blue-900/50 text-blue-400"}`}>
        {role === "assistant" ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
      </div>
      <div className="flex-1 min-w-0 prose prose-invert prose-sm max-w-none">
        <ReactMarkdown
          components={{
            code({ className, children, ...props }) {
              const match = /language-(\w+)/.exec(className || "");
              const code = String(children).replace(/\n$/, "");
              if (match) {
                return (
                  <SyntaxHighlighter style={oneDark} language={match[1]} PreTag="div" customStyle={{ borderRadius: 8, fontSize: 13 }}>
                    {code}
                  </SyntaxHighlighter>
                );
              }
              return <code className={className} {...props}>{children}</code>;
            },
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create src/components/chat-panel.tsx**

```tsx
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { ChatMessage } from "./chat-message";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2 } from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export function ChatPanel({ repoId }: { repoId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || streaming) return;
    const userMsg: Message = { id: Date.now().toString(), role: "user", content: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setStreaming(true);

    const aiMsg: Message = { id: (Date.now() + 1).toString(), role: "assistant", content: "" };
    setMessages((prev) => [...prev, aiMsg]);

    const res = await fetch(`/api/repos/${repoId}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: input }),
    });

    const reader = res.body?.getReader();
    const decoder = new TextDecoder();
    if (!reader) return;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value);
      const lines = text.split("\n");
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.delta) {
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last.role === "assistant") last.content += data.delta;
                return updated;
              });
            }
          } catch {}
        }
      }
    }
    setStreaming(false);
  }, [input, repoId, streaming]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto">
        {messages.length === 0 && (
          <div className="text-center text-zinc-500 mt-32">
            <p className="text-lg">向 AI 提问关于这个仓库的任何问题</p>
            <p className="text-sm mt-2">例如：「解释认证流程」「画出核心调用链」「这个函数做了什么」</p>
          </div>
        )}
        {messages.map((msg) => <ChatMessage key={msg.id} role={msg.role} content={msg.content} />)}
        <div ref={bottomRef} />
      </div>
      <div className="border-t border-zinc-800 p-4">
        <div className="flex gap-2 max-w-3xl mx-auto">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder="输入问题... (Enter 发送, Shift+Enter 换行)"
            className="bg-zinc-900 border-zinc-700 min-h-[44px] max-h-[120px]"
            rows={1}
            disabled={streaming}
          />
          <Button onClick={sendMessage} disabled={streaming || !input.trim()} size="icon" className="shrink-0">
            {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create src/app/repo/[id]/chat/page.tsx**

```tsx
"use client";

import { useParams } from "next/navigation";
import { ChatPanel } from "@/components/chat-panel";

export default function ChatPage() {
  const params = useParams();
  return <ChatPanel repoId={params.id as string} />;
}
```

- [ ] **Step 4: Install markdown deps**

```bash
pnpm add react-markdown react-syntax-highlighter
pnpm add -D @types/react-syntax-highlighter
```

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add streaming chat interface with markdown rendering"
```

---

### Task 18: Frontend - Chart Viewer + Settings

**Files:**
- Create: `src/components/chart-viewer.tsx`
- Create: `src/app/repo/[id]/graphs/page.tsx`
- Modify: `src/app/settings/page.tsx`

- [ ] **Step 1: Install ECharts**

```bash
pnpm add echarts echarts-for-react
```

- [ ] **Step 2: Create src/components/chart-viewer.tsx**

```tsx
"use client";

import ReactECharts from "echarts-for-react";

interface Props {
  mermaid: string;
  chartType: string;
}

export function ChartViewer({ mermaid, chartType }: Props) {
  // Convert simple mermaid text to ECharts nodes/links for call graphs
  const lines = mermaid.split("\n").filter(Boolean);
  const nodes: { name: string }[] = [];
  const links: { source: string; target: string }[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    const parts = line.split(/-->|->|-->/).map((s) => s.trim().replace(/[|\[\]()]/g, ""));
    if (parts.length === 2) {
      const [from, to] = parts;
      if (!seen.has(from)) { nodes.push({ name: from }); seen.add(from); }
      if (!seen.has(to)) { nodes.push({ name: to }); seen.add(to); }
      links.push({ source: from, target: to });
    }
  }

  if (nodes.length === 0) {
    return <pre className="text-sm text-zinc-400 p-4">{mermaid}</pre>;
  }

  const option = {
    tooltip: {},
    series: [{
      type: "graph",
      layout: "force",
      roam: true,
      data: nodes,
      links: links,
      force: { repulsion: 200, edgeLength: [100, 300] },
      label: { show: true, color: "#a6adc8", fontSize: 12 },
      lineStyle: { color: "#45475a", curveness: 0.2 },
    }],
  };

  return <ReactECharts option={option} style={{ height: 500 }} />;
}
```

- [ ] **Step 3: Create src/app/repo/[id]/graphs/page.tsx**

```tsx
"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChartViewer } from "@/components/chart-viewer";
import { Loader2 } from "lucide-react";

export default function GraphsPage() {
  const params = useParams();
  const [target, setTarget] = useState("");
  const [loading, setLoading] = useState(false);
  const [chart, setChart] = useState<{ mermaid: string; graphType: string } | null>(null);

  async function generate() {
    setLoading(true);
    const res = await fetch(`/api/repos/${params.id}/graph`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target, graphType: "call-chain" }),
    });
    setChart(await res.json());
    setLoading(false);
  }

  return (
    <div className="p-8">
      <div className="flex gap-2 mb-6">
        <Input
          placeholder="输入要追踪的函数或模块名..."
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          className="bg-zinc-900 border-zinc-700 max-w-md"
          onKeyDown={(e) => { if (e.key === "Enter") generate(); }}
        />
        <Button onClick={generate} disabled={!target || loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
          生成图表
        </Button>
      </div>
      {chart && <ChartViewer mermaid={chart.mermaid} chartType={chart.graphType} />}
      {!chart && (
        <div className="text-center text-zinc-500 mt-20">
          <p className="text-lg">生成调用链路图或架构图</p>
          <p className="text-sm mt-2">输入函数名或模块名，AI 会自动分析并生成交互式图表</p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Update src/app/settings/page.tsx**

```tsx
"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

export default function SettingsPage() {
  const [status, setStatus] = useState<Record<string, boolean | null>>({ deepseek: null, chromadb: null });
  const [testing, setTesting] = useState(false);

  async function testConnections() {
    setTesting(true);
    const res = await fetch("/api/settings/test-connection", { method: "POST" });
    setStatus(await res.json());
    setTesting(false);
  }

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">设置</h1>

      <Card className="p-6 bg-zinc-900 border-zinc-800 space-y-4">
        <h2 className="font-semibold">连接状态</h2>

        <div className="flex items-center justify-between">
          <span>DeepSeek API</span>
          {status.deepseek === null ? (
            <span className="text-zinc-500">未测试</span>
          ) : status.deepseek ? (
            <span className="flex items-center gap-1 text-green-400"><CheckCircle className="h-4 w-4" /> 正常</span>
          ) : (
            <span className="flex items-center gap-1 text-red-400"><XCircle className="h-4 w-4" /> 失败</span>
          )}
        </div>

        <div className="flex items-center justify-between">
          <span>ChromaDB</span>
          {status.chromadb === null ? (
            <span className="text-zinc-500">未测试</span>
          ) : status.chromadb ? (
            <span className="flex items-center gap-1 text-green-400"><CheckCircle className="h-4 w-4" /> 正常</span>
          ) : (
            <span className="flex items-center gap-1 text-red-400"><XCircle className="h-4 w-4" /> 失败</span>
          )}
        </div>

        <Button onClick={testConnections} disabled={testing} className="w-full">
          {testing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
          测试连接
        </Button>
      </Card>
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add ECharts chart viewer and settings page"
```

---

### Task 19: Integration Verification

**Files:**
- None (verification only)

- [ ] **Step 1: Start ChromaDB**

```bash
docker compose up -d
```
Expected: ChromaDB running on http://localhost:8000

- [ ] **Step 2: Verify dev server**

```bash
pnpm dev
```
Expected: Next.js running on http://localhost:3000

- [ ] **Step 3: Test API - Create repo**

```bash
curl -X POST http://localhost:3000/api/repos \
  -H "Content-Type: application/json" \
  -d '{"type":"local","localPath":"./src"}'
```
Expected: 201 with repo JSON

- [ ] **Step 4: Test API - List repos**

```bash
curl http://localhost:3000/api/repos
```
Expected: Array containing the created repo

- [ ] **Step 5: Test API - File tree**

```bash
curl http://localhost:3000/api/repos/1/tree
```
Expected: File tree JSON array

- [ ] **Step 6: Test API - Settings**

```bash
curl -X POST http://localhost:3000/api/settings/test-connection
```
Expected: `{"deepseek": true/false, "chromadb": true/false}`

- [ ] **Step 7: Open browser and verify**

Open http://localhost:3000, verify:
- Home page shows repo list
- Import dialog works
- File browser loads with tree
- Chat page loads and can send messages (if DeepSeek key configured)
- Settings page works

- [ ] **Step 8: Commit any final fixes**

```bash
git add -A && git commit -m "chore: integration verification and fixes"
```

---

### Task 20: README + Gitignore Finalization

**Files:**
- Create: `README.md`
- Modify: `.gitignore`

- [ ] **Step 1: Add .gitignore entries**

```
node_modules/
.next/
*.db
repos/
chroma-data/
.env.local
.superpowers/
```

- [ ] **Step 2: Create README.md**

```markdown
# Code-Know

个人 AI 代码导师与大型 Repo 解析器。

## 快速开始

### 1. 安装依赖
```bash
pnpm install
```

### 2. 启动 ChromaDB
```bash
docker compose up -d
```

### 3. 配置环境变量

复制 `.env.local.example` 为 `.env.local`，填入 DeepSeek API Key。

### 4. 运行开发服务器
```bash
pnpm db:migrate
pnpm dev
```

打开 http://localhost:3000

## 功能

- 导入代码仓库（本地路径 / Git URL）
- AI 问答（基于完整代码库的 RAG 检索）
- 流式对话（SSE）
- 交互式调用链路图（ECharts）
- 代码文件浏览（Shiki 语法高亮）
- 多仓库管理与跨仓库对比

## 技术栈

Next.js 14 · TypeScript · Tailwind CSS · shadcn/ui · ChromaDB · SQLite · DeepSeek API · tree-sitter · ECharts
```

- [ ] **Step 3: Add db:migrate script to package.json**

```json
"db:migrate": "tsx src/lib/db/migrate.ts"
```

- [ ] **Step 4: Final commit**

```bash
git add -A && git commit -m "docs: add README and finalize .gitignore"
```
