# AGENTS.md

## 项目概述

Quick Auto SQL — 基于大语言模型的智能 SQL 生成与数据库管理工具（MySQL）。两个独立包：`client/`（Vue 3 + Vite）和 `server/`（Express + TypeScript）。

## 常用命令

### 后端（`server/`）
```bash
cd server
npm install        # 安装依赖
npm run dev        # nodemon + ts-node，http://localhost:3000
npm run build      # tsc → dist/
```

### 前端（`client/`）
```bash
cd client
pnpm install       # 注意：使用 pnpm，不是 npm
pnpm dev           # Vite 开发服务器，http://localhost:5173
pnpm build         # vue-tsc 类型检查 + vite 构建
```

### 开发环境启动顺序
1. 先启动后端：`cd server && npm run dev`
2. 再启动前端：`cd client && pnpm dev`
3. Vite 会将 `/api/**` 代理到 `http://localhost:3000`

## 代码验证

项目没有测试套件、linter 或 formatter。唯一的构建时检查：
- **后端**：`cd server && npx tsc --noEmit`（类型检查）
- **前端**：`cd client && pnpm build`（执行 `vue-tsc -b && vite build`）

修改代码后运行以上命令以捕获类型错误。

## 架构设计

### 后端（`server/src/`）
- **入口**：`app.ts` — Express 应用，注册路由、挂载中间件、优雅关闭（SIGTERM/SIGINT）
- **鉴权**：基于会话（`middleware/auth.ts`），Bearer token 通过 `Authorization` 头、`X-Auth-Token` 头传递。`/api/auth/*` 不需要鉴权；所有 `/api/connections`、`/api/databases`、`/api/query`、`/api/ai`、`/api/quota`、`/api/pay`、`/api/audit` 均需鉴权；`/api/feedback` 无需鉴权
- **路由 → 服务**：路由层处理 HTTP 请求；服务层封装业务逻辑
- **持久化**：`server/data/` 下的 JSON 文件（12 个）。密码通过 `ENCRYPT_KEY` 环境变量进行 AES 加密；AI API Key 同样加密存储
- **SSE**：AI 生成和优化使用 Server-Sent Events（`text/event-stream`）
- **AI 服务商**：`services/ai.ts` 中的 `AI_PROVIDERS` 注册表；支持 DeepSeek、LongCat、自定义 OpenAI 兼容端点
- **配额/套餐**：`services/quota.ts` + `middleware/quota.ts` 实现月度使用限制（Free/Pro/Team/Enterprise）
- **密码哈希**：使用 bcrypt（盐值轮数 10），自动兼容旧版 SHA256 哈希
- **JSON 写入**：使用 tmp + rename 原子写入，防止并发写入导致数据损坏

### 前端（`client/src/`）
- **自动导入**：Vue/Vue Router/Pinia API 和 Element Plus 组件已自动导入，无需手动 import
- **路径别名**：`@/` → `src/`
- **状态管理**：Pinia stores 管理连接、数据库、AI 配置、标签页、主题、工作区；活跃连接 ID 持久化到 localStorage
- **API 响应格式**：`{ code, message, data }` — `code: 0` 表示成功；非零自动弹出错误提示（请求带 `_silentError: true` 可抑制）

### 注意事项
- `server/data/*.json` 是运行时数据文件，已 gitignore，首次运行自动创建
- `ai-config.json` 会自动从旧版单对象格式迁移到多配置格式
- Docker 部署：后端端口 13305，前端端口 13306（Nginx 反代 `/api` 到后端）
- SMTP 为可选配置 — `EMAIL_DEV_MODE=true` 时邮件内容仅打印到控制台，不会真实发送
- `ENCRYPT_KEY` 必须设置，否则数据库密码和 AI API Key 无法加密
- 首次启动时控制台会打印管理员初始密码，请登录后立即修改
