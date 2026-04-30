# Code-Know

个人 AI 代码导师与大型 Repo 解析器。

面对动辄数十万行的开源项目，利用长文本 LLM 结合本地 RAG（检索增强生成）技术，让 AI 读取整个代码仓库。支持项目架构问答、调用链路图绘制、核心算法逐行解释。

## 功能

- **代码仓库导入** — 支持本地路径 / Git URL / zip、tar.gz 上传三种方式
- **AI 智能问答** — 基于完整代码库的混合检索（向量 + 全文），DeepSeek V4 Pro 流式回复
- **调用链路图** — 输入函数名自动生成交互式 ECharts 调用关系图
- **文件浏览** — 文件树 + Shiki 语法高亮
- **对话历史** — 自动保存，支持多轮切换
- **跨仓库对比** — 同时检索多个仓库，对比实现差异
- **多语言解析** — TypeScript / Python / Rust / Go / Java / Solidity 等

## 技术栈

| 层级 | 选型 |
|------|------|
| 框架 | Next.js 14 (App Router) |
| UI | React + Tailwind CSS + shadcn/ui |
| 代码高亮 | Shiki |
| 图表 | ECharts |
| AST 解析 | tree-sitter (node 绑定) |
| 向量数据库 | ChromaDB (Docker) |
| Embedding | 硅基流动 BAAI/bge-m3 |
| 业务数据库 | SQLite + better-sqlite3 + drizzle-orm |
| LLM | DeepSeek V4 Pro |
| Git 操作 | isomorphic-git |
| 代码规范 | Biome |

## 系统架构

```
浏览器 (React)
    │  SSE 流式
    ▼
Next.js 服务端
    ├── API Routes    →  repos / chat / search / graph / compare / settings
    ├── RAG 引擎      →  导入器 → 分块器 → Embedder → 检索器 → LLM
    ├── SQLite        →  repos / conversations / messages / chunks (FTS5)
    └── ChromaDB 客户端 →  向量存储 + 语义检索
    │
    ▼
ChromaDB (Docker 本地进程)
```

## RAG 检索流程

```
用户提问
    │
    ├──→ 向量检索 (ChromaDB + BGE-M3)     top_k=20
    ├──→ 全文检索 (SQLite FTS5 + BM25)     top_k=20
    └──→ 符号索引 (函数名/类名精确匹配)     top_k=10
    │
    ▼
RRF 混合重排序 → top 15 chunks
    │
    ▼
DeepSeek V4 Pro 流式生成 (SSE)
```

## 代码分块策略

三层递进：
1. **tree-sitter AST** — 按函数/类/方法/结构体精准切割
2. **正则匹配** — 不支持 AST 的语言回退到模式匹配
3. **滑动窗口** — 最后兜底（30行/窗口，8行重叠）

## 快速开始

### 环境要求

- Node.js 18+
- pnpm
- Docker Desktop
- DeepSeek API Key
- 硅基流动 API Key（免费注册）

### 1. 克隆项目

```bash
git clone https://github.com/Sats-Jz/code-know.git
cd code-know
```

### 2. 安装依赖

```bash
pnpm install
```

### 3. 配置环境变量

编辑 `.env.local`：

```env
DEEPSEEK_API_KEY=sk-your-deepseek-key
DEEPSEEK_BASE_URL=https://api.deepseek.com
SILICONFLOW_API_KEY=sk-your-siliconflow-key
SILICONFLOW_BASE_URL=https://api.siliconflow.cn/v1
EMBEDDING_MODEL=BAAI/bge-m3
CHROMADB_URL=http://localhost:8000
DATA_DIR=./repos
CHROMA_DIR=./chroma-data
```

获取 API Key：
- DeepSeek：https://platform.deepseek.com → API Keys
- 硅基流动：https://cloud.siliconflow.cn → API 密钥（新用户送免费额度）

### 4. 启动 ChromaDB

```bash
docker compose up -d
```

### 5. 初始化数据库

```bash
pnpm db:migrate
```

### 6. 启动开发服务器

```bash
pnpm dev
```

打开 http://localhost:3000

### 7. 切换后端（可选）

项目支持两种后端，通过环境变量一键切换：

```bash
# Node.js 后端（Next.js 内置 API Routes，默认）
NEXT_PUBLIC_BACKEND=node pnpm dev

# Spring 后端（需要先在 code-know-server 目录启动 mvn spring-boot:run）
pnpm dev
# 不设变量时默认使用 Spring，API 请求代理到 localhost:8080
```

| 后端 | 启动命令 | 端口 | 适用场景 |
|------|---------|------|------|
| Node.js | `NEXT_PUBLIC_BACKEND=node pnpm dev` | 3000（内置） | 快速开发，不需要 Java |
| Spring | `pnpm dev`（默认） | 3000 → 8080 代理 | 生产级部署，Swagger 文档 |

## 使用说明

### 导入仓库

点击「导入仓库」按钮，支持三种方式：

- **本地路径**：输入本地文件夹绝对路径
- **Git URL**：粘贴 GitHub/GitLab 仓库地址（建议先用 `git clone` 到本地再用路径导入，避免超时）
- **上传**：拖拽 .zip / .tar.gz 压缩包

导入后卡片会显示「导入中 → 索引中 → 就绪」状态，页面自动轮询刷新。

### AI 对话

进入仓库 → 对话标签，输入问题即可：

- 「解释这个项目的认证流程」
- 「analyze 函数的调用链路」
- 「这段代码的性能瓶颈在哪」

左侧对话历史栏可切换、新建对话，刷新页面不丢失。

### 调用链路图

进入仓库 → 图表标签，输入函数名或模块名，AI 自动生成交互式 ECharts 力导向图。

### 跨仓库对比

侧边栏 → 对比图标，勾选至少 2 个仓库，输入对比问题（如「这两个项目的数据库层实现有什么不同？」）。

## 项目结构

```
src/
├── app/                        # Next.js App Router 页面
│   ├── layout.tsx              # 根布局 + 侧边栏
│   ├── page.tsx                # 首页 - 仓库列表
│   ├── repo/[id]/              # 仓库详情/对话/文件/图表
│   ├── compare/                # 跨仓库对比
│   ├── settings/               # 设置页
│   └── api/                    # 12 个 API 端点
├── components/                 # React 组件
│   ├── ui/                     # shadcn 基础组件
│   ├── chat-panel.tsx          # 对话面板
│   ├── file-tree.tsx           # 文件树
│   ├── code-viewer.tsx         # 代码查看器
│   ├── chart-viewer.tsx        # ECharts 图表
│   └── import-dialog.tsx       # 导入对话框
└── lib/                        # 后端核心逻辑
    ├── db/                     # SQLite 数据库
    ├── rag/                    # RAG 管道
    │   ├── importer.ts         # 代码导入
    │   ├── chunker.ts          # AST + 正则 + 滑动窗口分块
    │   ├── embedder.ts         # Embedding 生成 + ChromaDB 写入
    │   ├── retriever.ts        # 混合检索 + RRF 融合
    │   └── llm.ts              # DeepSeek 流式对话
    ├── chromadb.ts             # ChromaDB 客户端
    ├── deepseek.ts             # DeepSeek API 客户端
    ├── local-embed.ts          # 硅基流动 Embedding
    └── config.ts               # 环境配置
```

## License

MIT
