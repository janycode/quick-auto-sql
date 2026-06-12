# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 提供本仓库的开发指南。

## 项目概述

Quick Auto SQL 是一款基于大语言模型的智能 SQL 生成与数据库管理工具，支持通过自然语言描述自动生成 SQL 语句。项目采用前后端分离架构，类似 Chat2DB。

**主要功能：**
- MySQL 数据库连接管理（多连接，密码 AES 加密）
- 自然语言生成 SQL（基于可配置的提示词模板，SSE 流式输出）
- SQL 执行与结果展示（含字段注释、执行时间）
- SQL 性能分析（EXPLAIN + AI 建议，带内容哈希缓存）
- SQL 业务解释（生成中文业务描述）
- AI 配置多套管理（支持切换激活配置）
- 支持 DeepSeek / LongCat 等多个 OpenAI 兼容模型服务商
- AI 对话历史与分析历史持久化

## 技术栈

- **前端：** Vue 3.5 + TypeScript + Vite 8 + Vue Router 4 + Pinia 3 + Element Plus 2 + Monaco Editor + highlight.js + dayjs + lodash-es
- **后端：** Node.js + TypeScript + Express 4 + mysql2 + uuid + dotenv + cors + crypto-js
- **AI：** DeepSeek / LongCat 等 OpenAI `/chat/completions` 兼容协议
- **存储：** 本地 JSON 文件（`server/data/` 下的多个 JSON 文件）

## 常用命令

### 后端（server/）
```bash
cd server
npm install        # 安装依赖
npm run dev        # nodemon + ts-node 启动开发服务器（http://localhost:3000）
npm run build      # tsc 编译 TypeScript 到 dist/
npm start          # 运行编译后的 dist/app.js
```

### 前端（client/）
```bash
cd client
pnpm install       # 安装依赖
pnpm dev           # Vite 开发服务器（http://localhost:5173）
pnpm build         # vue-tsc 类型检查 + Vite 生产构建
pnpm preview       # 预览生产构建
```

### 开发环境启动
1. 先启动后端：`cd server && npm run dev`
2. 再启动前端：`cd client && pnpm dev`
3. 打开 http://localhost:5173
4. 在 `设置 / AI 配置` 页面添加并激活一个 AI 配置（API Key + 模型）

## 架构设计

### 后端结构（`server/src/`）

```
app.ts                      # Express 应用入口：中间件、路由注册、健康检查 /api/health
config/
  index.ts                  # 环境变量配置（PORT、ENCRYPT_KEY、DATA_DIR、DeepSeek 默认值、查询限制）
routes/
  connection.ts             # MySQL 连接的增删改查 + 测试连接
  database.ts               # 数据库/表/字段列表查询，获取 DDL（SHOW CREATE TABLE）
  query.ts                  # 执行 SQL 查询（POST /api/query/execute）
  ai.ts                     # AI 配置、SSE 流式 SQL 生成、提示词模板、历史、性能分析、业务解释
services/
  connection.ts             # 连接池按 ID 缓存、AES 加解密、CRUD 操作
  database.ts               # INFORMATION_SCHEMA 查询，为 AI Prompt 生成表结构与字段注释
  query.ts                  # 查询执行 + 字段注释提取 + EXPLAIN；MySQL 连接异常码包装
  ai.ts                     # Provider registry、模型列表代理、SSE 生成、历史、提示词、分析缓存
middleware/
  async-handler.ts          # 异步路由处理器包装器 + success/fail 响应辅助函数
  error-handler.ts          # 全局错误处理器（识别 MYSQL_UNAVAILABLE 等 code）
store/
  json-store.ts             # JsonStore<T> 泛型类 + 提示词模板读写 + SQL 分析缓存 + AI 配置单例
types/
  index.ts                  # 所有 TypeScript 接口（IConnection、IColumn、IQueryResult、IAi*、IPrompt* 等）
```

**核心设计模式：**
- **服务-路由分离：** 路由层处理 HTTP 请求/响应，服务层处理业务逻辑
- **连接池缓存：** 按 connectionId 在内存中缓存 MySQL 连接池（`getPoolById`）
- **JSON 持久化：** 多个独立 JSON 文件存储不同领域数据：
  - `connections.json` — 连接列表（密码 AES 加密）
  - `ai-config.json` — AI 多配置（含 `activeId`，兼容旧版单对象的自动迁移）
  - `ai-history.json` — AI 对话历史
  - `ai-prompts.json` — 提示词模板（generate_sql / analyze_sql / explain_sql）
  - `ai-sql-analysis-cache.json` — SQL 性能分析缓存（最多 200 条，按 SQL 内容稳定 hash 命中）
- **SSE 流式传输：** AI 生成 SQL 使用 Server-Sent Events，Content-Type `text/event-stream`
- **密码加密：** crypto-js AES，密钥通过 `ENCRYPT_KEY` 环境变量
- **AI Provider registry：** 内置 DeepSeek / LongCat，新增只需在 `services/ai.ts` 的 `AI_PROVIDERS` 添加条目；支持自定义 `modelsUrl`

### 前端结构（`client/src/`）

```
main.ts                    # 应用启动：Vue + Pinia + Element Plus + 图标全局注册
router/index.ts            # 路由：/workspace、/settings/ai、/settings/prompts
api/
  connection.ts            # 连接 API 客户端 + 类型
  database.ts              # 数据库/表 API 客户端 + 类型
  query.ts                 # 查询执行 API 客户端 + 类型
  ai.ts                    # AI 配置、历史、Provider、模型、提示词、分析、解释 API 客户端
stores/
  connection.ts            # Pinia：连接列表、活跃连接 ID（localStorage 持久化）
  database.ts              # Pinia：数据库/表/字段、选中表、当前数据库
  ai.ts                    # Pinia：AI 配置列表 + activeId、生成 SQL、历史、提示词模板
components/
  layout/                  # AppHeader、AppSidebar
  database/                # DbTree（树形结构）、TableInfo
  editor/                  # SqlEditor（Monaco）、QueryResult
  ai/                      # AiChat、PromptConfigDialog、TableSelector
views/
  workspace/               # Workspace（主工作区，组合所有组件）
  connection/              # ConnectionManager（弹窗管理 MySQL 连接）
  settings/                # AiSettings（多套 AI 配置管理）、PromptSettings（提示词模板编辑）
utils/
  request.ts               # Axios 实例，/api 代理；code !== 0 自动错误提示
  sse.ts                   # 基于 Fetch 的 SSE 客户端，处理流式消息
  sql-formatter.ts         # SQL 格式化
styles/
  index.scss               # 全局样式入口（含 index.css、index.min.css）
```

**核心设计模式：**
- **自动导入：** `unplugin-auto-import` 自动导入 Vue / Vue Router / Pinia API
- **组件自动发现：** `unplugin-vue-components` 自动注册 Element Plus 组件
- **路径别名：** `@/` 映射到 `src/`
- **状态持久化：** 活跃连接 ID 存 localStorage（key: `quick-auto-sql-active-connection-id`）
- **API 响应格式：** `{ code: number, message: string, data: T }` — `code: 0` 成功；前端拦截器对非零 code 展示错误提示（请求带 `_silentError: true` 可抑制）

## 主要 API

所有接口前缀 `/api`，由 Vite 代理到 `http://localhost:3000`。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/health` | 健康检查 |
| GET/POST/PUT/DELETE | `/connections/*` | MySQL 连接 CRUD + 测试 |
| GET | `/databases?connectionId=` | 数据库列表 / 表列表 / 字段 / DDL |
| POST | `/query/execute` | `{ connectionId, database, sql }` → 执行并返回结果（含 columnComments） |
| GET | `/ai/providers` | AI 服务商列表（DeepSeek、LongCat…） |
| POST | `/ai/models` | `{ provider, apiKey, modelsUrl? }` → 代理拉取模型列表 |
| GET | `/ai/configs` | AI 配置列表 + activeId |
| GET | `/ai/config` | 当前激活配置 |
| POST | `/ai/configs` | 新增 AI 配置（首个自动激活） |
| DELETE | `/ai/configs/:id` | 删除配置 |
| POST | `/ai/configs/:id/activate` | 激活指定配置 |
| POST | `/ai/generate` | SSE 流式生成 SQL；消息类型：thinking/sql/done/error |
| GET/POST/DELETE | `/ai/history[?connectionId=]` | AI 对话历史 CRUD |
| GET | `/ai/prompts` | 所有提示词模板（generate_sql / analyze_sql / explain_sql） |
| PUT | `/ai/prompts/:type` | 更新某个提示词模板 |
| POST | `/ai/prompts/:type/reset` | 重置为默认提示词 |
| POST | `/ai/analyze` | `{ connectionId, database, sql }` → EXPLAIN + AI 分析（命中缓存时 cached=true） |
| GET/DELETE | `/ai/analysis-history` | SQL 性能分析历史列表 / 清空 |
| POST | `/ai/explain` | `{ sql }` → 中文业务描述（单行，40~120 字） |

## 环境变量（server/.env）

```
PORT=3000                         # 服务器端口
ENCRYPT_KEY=your-secret-key       # AES 加密密钥（密码存储使用）
DATA_DIR=./data                   # JSON 存储目录
DEEPSEEK_API_URL=https://api.deepseek.com/v1/chat/completions
DEEPSEEK_MODEL=deepseek-chat
```

`config.query.maxRows = 1000`，`config.query.timeout = 30000`（毫秒），均在代码中硬编码为合理默认值。

## AI Prompt 模板

提示词可在前端「设置 / 提示词配置」页面编辑与重置，文件落盘到 `server/data/ai-prompts.json`。

三类模板及可用占位符：

- **`generate_sql`**：占位符 `${schema}`（表结构）、`${question}`（用户需求）
- **`analyze_sql`**：占位符 `${sql}`、`${explain}`（每行一个 EXPLAIN 的 JSON 对象）
- **`explain_sql`**：占位符 `${sql}`

默认模板位于 `server/src/store/json-store.ts` 的 `DEFAULT_*_PROMPT` 常量，在运行时从文件读取；若文件不存在或某个类型缺失，则使用默认值初始化并落盘。

## Vite 代理

`client/vite.config.ts` 将 `/api/**` 代理到 `http://localhost:3000`（changeOrigin: true）。
