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
