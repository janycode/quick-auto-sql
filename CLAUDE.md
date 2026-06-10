# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 提供本仓库的开发指南。

## 项目概述

Quick Auto SQL 是一款基于大语言模型的智能 SQL 生成与数据库管理工具，支持通过自然语言描述自动生成 SQL 语句。项目采用前后端分离架构，类似 Chat2DB。

**技术栈：**
- **前端：** Vue 3 + TypeScript + Vite + Vue Router + Pinia + Element Plus + Monaco Editor
- **后端：** Node.js + TypeScript + Express + MySQL2
- **AI：** DeepSeek API（兼容 OpenAI `/chat/completions` 协议）
- **存储：** 本地 JSON 文件存储连接配置和 AI 设置（密码 AES 加密）

## 常用命令

### 后端（server/）
```bash
cd server
npm install        # 安装依赖
npm run dev        # 使用 nodemon 启动开发服务器（http://localhost:3000）
npm run build      # 编译 TypeScript 到 dist/
npm start          # 运行编译后的 JS
```

### 前端（client/）
```bash
cd client
pnpm install       # 安装依赖
pnpm dev           # 启动 Vite 开发服务器（http://localhost:5173）
pnpm build         # 类型检查 + 生产构建
pnpm preview       # 预览生产构建
```

### 开发环境启动
1. 先启动后端：`cd server && npm run dev`
2. 再启动前端：`cd client && pnpm dev`
3. 打开 http://localhost:5173
4. 在设置页面配置 AI API Key

## 架构设计

### 后端结构（`server/src/`）

```
app.ts                    # Express 应用入口，中间件配置，路由注册
config/
  index.ts                # 环境变量配置（PORT、ENCRYPT_KEY、DeepSeek 默认值）
routes/
  connection.ts           # MySQL 连接的增删改查 + 测试
  database.ts             # 数据库/表/字段列表查询，获取 DDL
  query.ts                # 执行 SQL 查询
  ai.ts                   # AI 配置 + SSE 流式 SQL 生成
services/
  connection.ts           # 连接池管理、AES 加解密、CRUD 操作
  database.ts             # INFORMATION_SCHEMA 查询，为 AI Prompt 生成 DDL
  query.ts                # 查询执行 + 字段注释提取
  ai.ts                   # DeepSeek API 集成、SSE 流处理、Prompt 构建
middleware/
  async-handler.ts        # 异步路由处理器包装器，success/fail 响应辅助函数
  error-handler.ts        # 全局错误处理器
store/
  json-store.ts           # 通用 JSON 文件存储类 + 连接/AI 配置的单例实例
types/
  index.ts                # 所有 TypeScript 接口定义（IConnection、IColumn、IQueryResult 等）
```

**核心设计模式：**
- **服务-路由分离：** 路由层处理 HTTP 请求/响应，服务层处理业务逻辑
- **连接池缓存：** 按连接 ID 在内存中缓存 MySQL 连接池
- **JSON 持久化：** `JsonStore<T>` 泛型类实现基于文件的 CRUD，用于连接数组和 AI 配置对象
- **SSE 流式传输：** AI 生成使用 Server-Sent Events，Content-Type 为 `text/event-stream`
- **密码加密：** 使用 `crypto-js` 进行 AES 加密，密钥通过 `ENCRYPT_KEY` 环境变量配置

### 前端结构（`client/src/`）

```
main.ts                   # 应用启动：Vue + Pinia + Element Plus + 图标注册
router/index.ts           # 路由配置：/workspace、/settings/ai
api/
  connection.ts           # 连接 API 客户端 + 类型定义
  database.ts             # 数据库 API 客户端 + 类型定义
  query.ts                # 查询 API 客户端 + 类型定义
  ai.ts                   # AI 配置 API 客户端
stores/
  connection.ts           # Pinia Store：连接列表、活跃连接、localStorage 持久化
  database.ts             # Pinia Store：数据库/表/字段、选中的表、当前数据库持久化
  ai.ts                   # Pinia Store：AI 配置、生成的 SQL 累加器
components/
  layout/                 # AppHeader、AppSidebar
  database/               # DbTree（表树形结构）、TableInfo
  editor/                 # SqlEditor（Monaco）、QueryResult
  ai/                     # AiChat、TableSelector
views/
  workspace/              # 主工作区页面（组合所有组件）
  connection/             # 连接管理弹窗
  settings/               # AI 设置页面
utils/
  request.ts              # Axios 实例，响应拦截器（code !== 0 → 错误提示）
  sse.ts                  # 基于 Fetch 的 SSE 客户端，用于 AI 流式传输
  sql-formatter.ts        # SQL 格式化工具
```

**核心设计模式：**
- **自动导入：** `unplugin-auto-import` 自动导入 Vue、Vue Router、Pinia API
- **组件自动发现：** `unplugin-vue-components` 自动注册 Element Plus 组件
- **路径别名：** `@/` 映射到 `src/`
- **状态持久化：** 活跃连接 ID 和当前数据库保存到 localStorage
- **API 响应格式：** `{ code: 0, message: string, data: T }` — 拦截器对非零 code 自动显示错误提示

## API 响应约定

所有后端响应格式：
```typescript
{ code: 0, message: string, data: T }
```
- `code: 0` = 成功
- `code: -1` = 错误
- 前端 axios 拦截器在 code 非零时自动将 message 显示为错误提示

## 环境变量（server/.env）

```
PORT=3000                    # 服务器端口
ENCRYPT_KEY=...              # AES 加密密钥
DATA_DIR=./data              # JSON 存储目录
DEEPSEEK_API_URL=...        # DeepSeek 聊天补全端点
DEEPSEEK_MODEL=deepseek-chat # 默认模型
```

## 数据存储

运行时数据存储在 `server/data/` 目录：
- `connections.json` — MySQL 连接配置（密码 AES 加密）
- `ai-config.json` — DeepSeek API 密钥、模型、端点

## AI Prompt 设计

`services/ai.ts` 中的系统 Prompt 强制要求：
- 只返回可执行 SQL，不包含解释说明
- 必须使用 DDL 中存在的字段（禁止编造）
- MySQL 兼容语法
- 用户 Prompt 包含选中表的完整 `SHOW CREATE TABLE` DDL + 字段注释

## Vite 代理

前端开发服务器将 `/api/**` 代理到 `http://localhost:3000`（详见 `vite.config.ts`）。
