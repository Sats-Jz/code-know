# Code-Know Server (Spring Boot)

基于 Spring AI 的代码仓库 RAG 分析后端，提供 REST API 和 SSE 流式对话。

## 技术栈

| 组件 | 选型 |
|------|------|
| 框架 | Spring Boot 3.4 + Spring AI 1.0.0-M4 |
| LLM | DeepSeek V4 Pro（OpenAI 兼容协议） |
| Embedding | 硅基流动 BAAI/bge-m3（1024 维） |
| 向量存储 | ChromaDB（HTTP 直连） |
| 数据库 | H2（内嵌文件模式） |
| API 文档 | SpringDoc OpenAPI + Swagger UI |
| 构建 | Maven 3.9+, Java 17 |

## 项目结构

```
code-know-server/
├── pom.xml
├── src/main/java/com/codeknow/
│   ├── CodeKnowApplication.java      # Spring Boot 入口
│   ├── config/
│   │   ├── DeepSeekConfig.java       # DeepSeek V4 Pro 客户端
│   │   ├── SiliconFlowConfig.java    # 硅基流动 Embedding 客户端
│   │   └── WebConfig.java            # CORS 跨域配置
│   ├── controller/
│   │   ├── RepoController.java       # 仓库 CRUD
│   │   ├── FileController.java       # 文件树 + 代码浏览
│   │   ├── ChatController.java       # AI 对话（SSE 流）+ 对话历史
│   │   └── SettingsController.java   # 配置查看 + 连接测试
│   ├── model/
│   │   ├── Repo.java                 # 仓库实体
│   │   ├── Conversation.java         # 对话实体
│   │   ├── Message.java              # 消息实体
│   │   └── *Repository.java          # Spring Data JPA 接口
│   └── service/
│       ├── RepoService.java          # 导入/索引/文件浏览
│       ├── ChatService.java          # RAG 检索 + LLM 对话
│       └── ChromaDBService.java      # ChromaDB HTTP 客户端
└── src/main/resources/
    ├── application.yml               # 主配置（提交 Git）
    └── application-local.yml         # 本地密钥（不提交 Git）
```

## 快速开始

### 环境要求

- Java 17
- Maven 3.9+
- Docker Desktop（运行 ChromaDB）

### 1. 配置密钥

创建 `src/main/resources/application-local.yml`：

```yaml
deepseek:
  api-key: sk-your-deepseek-key
  base-url: https://api.deepseek.com

siliconflow:
  api-key: sk-your-siliconflow-key
  base-url: https://api.siliconflow.cn/v1

chromadb:
  url: http://localhost:8000
```

此文件已在 `.gitignore` 中，不会提交。

### 2. 启动 ChromaDB

```bash
# 在项目根目录
docker compose up -d
```

### 3. 启动 Spring 后端

```bash
cd code-know-server
mvn spring-boot:run
```

服务启动在 **http://localhost:8080**

### 4. 启动前端（可选）

```bash
# 在项目根目录
pnpm dev
```

前端已配置 `rewrites` 代理，`/api/*` 请求自动转发到 Spring 后端。

## API 文档

启动后端后访问：

**Swagger UI:** http://localhost:8080/swagger-ui.html

**OpenAPI JSON:** http://localhost:8080/v3/api-docs

### 端点一览

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/repos` | 仓库列表 |
| `POST` | `/api/repos` | 导入仓库（`{"type":"local/git",...}`） |
| `GET` | `/api/repos/{id}` | 仓库详情 |
| `DELETE` | `/api/repos/{id}` | 删除仓库 |
| `GET` | `/api/repos/{id}/tree?dir=` | 文件树 |
| `GET` | `/api/repos/{id}/file?path=` | 文件内容 |
| `POST` | `/api/repos/{id}/chat` | AI 对话（SSE 流式） |
| `GET` | `/api/repos/{id}/conversations` | 对话列表 |
| `GET` | `/api/repos/{id}/conversations/{cid}` | 对话消息 |
| `GET` | `/api/settings` | 系统配置 |
| `POST` | `/api/settings/test-connection` | 测试连接 |

### SSE 事件格式

对话接口 `/api/repos/{id}/chat` 返回 Server-Sent Events：

```
event: meta
data: {"conversation_id": 1}

event: text
data: "这是流式输出的文字"

event: chart
data: {"chartType":"call-chain","mermaid":"graph TD\n  A-->B"}

event: done
data: {}
```

## 与 Next.js 版本对比

| | Spring 版本 | Next.js 版本 |
|------|---------|---------|
| LLM 调用 | Spring AI `OpenAiChatModel` | 手写 `openai` SDK |
| Embedding | Spring AI `OpenAiEmbeddingModel` | 手写 `openai` SDK |
| 数据库 | H2 + Spring Data JPA | better-sqlite3 + drizzle-orm |
| 向量存储 | `ChromaDBService` HTTP 直连 | `chromadb` npm 包 |
| 分块 | 滑动窗口（可扩展 AST） | tree-sitter + 正则 + 滑动窗口 |
| API 文档 | Swagger UI | 无 |
| 检索 | 向量检索 | 向量 + FTS + RRF 混合检索 |
| 流式 | `Flux<String>` | `ReadableStream` |
