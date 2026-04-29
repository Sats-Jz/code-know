# Code-Know: 个人 AI 代码导师与大型 Repo 解析器

## 目标

打造一个 Web 应用，利用长文本 LLM + 本地 RAG 技术，让 AI 读取整个代码仓库（数十万行级别），支持架构问答、调用链路图绘制、核心算法逐行解释。目标是打破学习陡峭技术栈的壁垒，提升源码阅读和 PR 贡献效率。

## 技术栈

| 层级 | 选型 |
|------|------|
| 框架 | Next.js 14 (App Router) |
| UI | Tailwind CSS + shadcn/ui |
| 代码高亮 | Shiki |
| 图表 | ECharts + Mermaid.js |
| AST 解析 | tree-sitter (node 绑定) |
| 向量数据库 | ChromaDB (Docker 本地进程) |
| 业务数据库 | SQLite + better-sqlite3 + drizzle-orm |
| LLM | DeepSeek V4 Pro (OpenAI 兼容 SDK) |
| Embedding | DeepSeek Embedding API |
| Git 操作 | isomorphic-git |
| 包管理 | pnpm |
| 代码规范 | Biome |
| 部署 | 本地 localhost（个人工具） |

## 架构

Next.js 全栈单体应用，三层结构：

1. **浏览器层**：React 前端，包含仓库管理、代码浏览、AI 对话、图表渲染四大模块
2. **Next.js 服务端**：API Routes + RAG 引擎（导入器/分块器/检索器）+ 外部服务调用（DeepSeek API + ChromaDB）+ SQLite
3. **ChromaDB 本地进程**：Docker 容器运行，每仓库一个 Collection，存 chunk embedding

## 路由结构

```
/                         首页 - 仓库列表总览
/repo/[id]                仓库详情 - 文件树 + 概览
/repo/[id]/chat           仓库对话 - AI 问答主界面
/repo/[id]/files          文件浏览 - 源码高亮阅读
/repo/[id]/graphs         图表示图 - 调用链路/架构图
/settings                 设置 - API Key / ChromaDB 配置
```

## API 端点

- `POST/GET/DELETE /api/repos` — 仓库 CRUD（支持本地路径、Git URL、上传压缩包三种导入）
- `GET /api/repos/[id]/tree` + `/file` — 文件树与内容
- `POST /api/repos/[id]/chat` — AI 对话（SSE 流式，支持 explain/trace/compare 模式）
- `GET /api/repos/[id]/conversations` — 对话历史
- `POST /api/repos/[id]/search` — 语义搜索
- `POST /api/repos/[id]/graph` — 生成调用链路图
- `POST /api/compare` — 跨仓库对比提问
- `GET/PUT /api/settings` — 配置管理

## 数据模型 (SQLite)

- **repos**: id, name, path, git_url, language, file_count, line_count, index_status
- **conversations**: id, repo_id, title, mode
- **messages**: id, conversation_id, role, content (JSON), tokens_used
- **chunks**: id, repo_id, file_path, start_line, end_line, chunk_type, symbol_name, content, embedding_id

## RAG Pipeline（5 阶段）

### 1. 代码导入
三种入口（本地路径 / Git clone / 上传解压）统一归一化到 repos/ 目录，过滤 .gitignore 和二进制文件，检测编程语言。

### 2. 混合分块
- 支持的语言（TS/JS/Python/Rust/Go/Solidity/Java 等）：tree-sitter AST 解析，按 function/class/method/struct/contract 切割
- 超长定义（>1024 tokens）：二次滑动窗口（512 token, 128 重叠）
- 不支持 AST 的语言：固定窗口（512 token, 128 重叠）

### 3. Embedding 与存储
- DeepSeek Embedding API 生成向量（1536 dims）
- ChromaDB 存向量 + metadata，SQLite 存元数据和原文
- 批量处理：每 50 条一批，限速控制

### 4. 混合检索
- 向量检索 (ChromaDB, top_k=20) + BM25 全文 (SQLite FTS5, top_k=20) + 符号索引 (top_k=10)
- RRF (Reciprocal Rank Fusion) 融合去重，取 top 15

### 5. LLM 调用与后处理
- 构建 System Prompt + 15 个相关 chunks（按文件分组）→ DeepSeek V4 Pro 流式输出
- 解析 `[chart:...][/chart]` 标记转 ECharts 配置
- 提取文件引用变可点击链接

## 功能特性

- 多仓库管理 + 跨仓库对比提问
- 流式 AI 对话（SSE），三种模式：解释 / 追踪 / 对比
- 交互式调用链路图（ECharts，支持缩放/拖拽/导出）
- 代码文件树浏览 + Shiki 语法高亮
- 对话历史保留，按仓库隔离
