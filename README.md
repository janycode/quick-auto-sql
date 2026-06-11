# Quick Auto SQL

> 基于大语言模型的智能 SQL 生成与数据库管理工具，通过自然语言一句话生成所需 SQL 语句。
>
> 核心目标：简单、易用。

## ✨ 功能特性

- **数据库连接管理**：支持 MySQL 数据库连接配置、测试、增删改查，密码 AES 加密存储
- **数据库浏览**：树形结构展示数据库、表、字段，支持查看表结构与 DDL
- **SQL 查询控制台**：Monaco Editor 语法高亮编辑器，查询结果表格展示，支持 CSV 导出，可拖拽调整高度，支持切换列备注显示
- **AI SQL 生成**：支持多 AI 服务商（DeepSeek / LongCat / 自定义 OpenAI 兼容接口），通过自然语言描述自动生成格式化的 SQL 语句
  - SSE 流式输出，实时看到生成过程
  - 自动注入选中表的完整结构信息（DDL + 字段注释），确保 SQL 字段准确
  - 自动拉取服务商模型列表，也可手动输入模型名
  - 多表关联时给出性能风险提示（超过 3 个表 join 时高亮警告）
- **多套 AI 配置**：可同时保存多组 API Key / Base URL / Model，一键切换激活配置
- **AI 对话历史**：自动记录每次生成，支持按连接过滤、逐条删除、一键清空
- **AI SQL 业务解释**：一键为当前 SQL 在首行生成中文业务含义注释（不影响原 SQL 缩进）
- **AI SQL 性能分析**：先对 SQL 执行 EXPLAIN，再由大模型给出可执行的优化建议，表格中对 type / rows / filtered / Extra / key 等关键列做绿/黄/红染色，并附带中文字段含义 tooltip
- **分析历史 & 缓存**：相同 SQL 的分析结果会命中本地缓存（`cached` 标识），分析历史可随时回看与清空
- **持久化状态**：连接选择、数据库选择、查询结果高度自动持久化到本地存储，刷新页面不丢失
- **表勾选自动同步**：侧边栏勾选的表自动显示在 AI 助手关联表区域
- **SQL 安全限制**：执行接口禁止 DDL / 权限操作（DROP、TRUNCATE、ALTER、GRANT、REVOKE）
- **可自定义提示词**：支持在线编辑 `generate_sql / analyze_sql / explain_sql` 三类提示词模板，并可一键重置为默认

## 🏗 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Vue 3 + TypeScript + Vite + Vue Router + Pinia + Element Plus + Monaco Editor + Axios + dayjs + highlight.js |
| 后端 | Node.js + TypeScript + Express + MySQL2 |
| AI | 任意 OpenAI `/chat/completions` 兼容接口（内置 DeepSeek、LongCat，支持自定义） |
| 数据存储 | 连接配置、AI 配置、AI 历史、提示词模板通过本地 JSON 文件持久化 |

## 📁 项目结构

```
quick-auto-sql/
├── server/                      # 后端服务
│   ├── src/
│   │   ├── app.ts               # Express 入口 + /api/health 健康检查
│   │   ├── config/              # 环境变量（端口、加密密钥、默认模型、默认提示词等）
│   │   ├── routes/              # 4 个路由模块
│   │   │   ├── connection.ts    # 连接管理（CRUD + 测试）
│   │   │   ├── database.ts      # 数据库/表/字段浏览 + DDL
│   │   │   ├── query.ts         # SQL 查询（含 DDL 拦截、EXPLAIN）
│   │   │   └── ai.ts            # 服务商 / 多配置 / 历史 / 流式生成 / 分析 / 解释 / 提示词模板
│   │   ├── services/            # 4 个服务模块（业务逻辑）
│   │   ├── middleware/          # 错误处理 + async 包装
│   │   ├── store/               # JSON 持久化（单对象→多配置的迁移、分析缓存、提示词存储）
│   │   └── types/               # TypeScript 类型定义（Provider、Config、History、Prompt、Cache 等）
│   └── data/                    # 运行时数据目录（自动创建）
│
└── client/                      # 前端应用
    └── src/
        ├── api/                 # API 请求层（含 AI 服务商、多配置、历史、分析、解释、提示词等）
        ├── stores/              # Pinia 状态管理（连接/数据库/AI 配置与生成）
        ├── views/               # 工作区（含连接管理弹窗） / AI 设置
        ├── components/          # 布局 / 数据库树 / SQL 编辑器 / 查询结果 / AiChat / TableSelector
        ├── router/              # /workspace、/settings/ai
        ├── styles/              # 全局样式
        └── utils/               # request / SSE / SQL 格式化
```

## 🚀 快速开始

### 环境要求

- Node.js >= 18
- pnpm（前端）/ npm（后端）
- MySQL 数据库实例（用于查询功能）

### 启动后端

```bash
cd server
npm install
npm run dev
# 服务启动在 http://localhost:3000
```

可选：在 `server/.env` 中自定义以下配置（均有默认值）：

```
PORT=3000
ENCRYPT_KEY=your-encrypt-key
DATA_DIR=./data
DEEPSEEK_API_URL=https://api.deepseek.com/v1/chat/completions
DEEPSEEK_MODEL=deepseek-chat
```

### 启动前端

```bash
cd client
pnpm install
pnpm dev
# 应用启动在 http://localhost:5173
```

前端 Vite 已配置代理：`/api/**` 自动转发到后端 `http://localhost:3000`。

### 健康检查

后端启动后可访问 `GET http://localhost:3000/api/health` 验证服务状态。

## 📖 使用流程

1. **打开应用** → 进入"工作区"，在左侧点击按钮打开"连接管理"弹窗，添加一个 MySQL 数据库连接
2. **选择连接和数据库** → 左侧选择已保存的连接，展开数据库与表结构
3. **勾选表** → 在左侧树形结构中勾选需要查询的表（表会自动同步到右侧 AI 面板；超过 3 个表会有 join 性能风险提示）
4. **AI 生成 SQL** → 右侧 AI 助手中输入自然语言描述，点击"生成 SQL"，表结构信息会自动注入提示词
5. **使用 SQL** → 生成完成后点击"使用此 SQL"，SQL 自动填入编辑器，点击"执行"即可查询
6. **AI 解释 / 分析**（可选）：
   - 在编辑器工具栏点击「AI SQL 解释」，大模型会把这段 SQL 的业务含义写成中文注释，自动追加到 SQL 首行
   - 点击「AI SQL 分析」，系统先执行 EXPLAIN 再交给大模型分析，并在弹窗中以表格+染色+提示词形式展示执行计划与优化建议；相同 SQL 会命中本地缓存
   - 点击「分析历史」可回看所有已执行的分析，或一键清空

## 🤖 AI 配置（多配置 · 多服务商 · 可自定义提示词）

1. 进入 `/settings/ai` 页面
2. 选择一个服务商标签（DeepSeek / LongCat / 自定义），或点击"+ 自定义"接入任意 OpenAI 兼容接口
3. 填写 API Key、API URL、获取模型 URL（自定义服务商时必填）
4. 输入 API Key 后失焦或选择其他服务商时，会通过后端代理自动拉取模型列表
5. 手动选择或输入模型名，点击"添加配置"
6. 在上方列表中点击"使用"切换当前激活配置，或点击"×"删除
7. （可选）访问 `/settings/ai` 下方的"提示词模板"区域，在线编辑 `generate_sql / analyze_sql / explain_sql` 三类提示词，可随时重置为默认

### 内置 AI 服务商

| 名称 | chatUrl | modelsUrl | 默认模型 |
|------|---------|-----------|----------|
| DeepSeek | `https://api.deepseek.com/v1/chat/completions` | `https://api.deepseek.com/models` | `deepseek-chat` |
| LongCat | `https://api.longcat.chat/openai/v1/chat/completions` | `https://api.longcat.chat/openai/v1/models` | `LongCat-2.0-Preview` |

> 自定义服务商时，chatUrl 必须返回与 OpenAI `/chat/completions` 兼容的 JSON；支持 `stream=true`。

### Prompt 设计要点

- System Prompt 明确角色定位，强调字段准确性，禁止编造不存在的字段
- User Prompt 注入选中表的完整 `SHOW CREATE TABLE` DDL，包含字段类型、索引、约束
- 针对中文场景优化，兼容中文表名和中文列名
- 性能分析 Prompt 要求聚焦 EXPLAIN 的 type / rows / filtered / Extra / possible_keys / key 等关键字段，输出可执行建议
- 三类提示词均可在前端在线编辑并持久化到 `server/data/ai-prompts.json`

## 🔧 API 接口

统一响应格式：`{ code: number, message: string, data: T }`。`code === 0` 表示成功，非 0 为失败并附带 message。

### 连接

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/connections` | 获取连接列表 |
| POST | `/api/connections` | 创建连接 |
| PUT | `/api/connections/:id` | 更新连接 |
| DELETE | `/api/connections/:id` | 删除连接 |
| POST | `/api/connections/test` | 测试未保存的连接 |
| POST | `/api/connections/:id/test` | 测试已保存的连接 |

### 数据库（query 参数）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/databases?connectionId=xxx` | 获取数据库列表 |
| GET | `/api/databases/tables?connectionId=xxx&database=xxx` | 获取表列表 |
| GET | `/api/databases/columns?connectionId=xxx&database=xxx&table=xxx` | 获取字段列表 |
| GET | `/api/databases/ddl?connectionId=xxx&database=xxx&table=xxx` | 获取 DDL |

### 查询

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/query/execute` | 执行 SQL（body: `{ connectionId, database, sql }`，默认限制最多 1000 行 / 30s 超时，禁止 DDL 与权限操作） |

### AI · 服务商 & 模型

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/ai/providers` | 获取内置 AI 服务商列表 |
| POST | `/api/ai/models` | 通过后端代理拉取指定服务商/自定义 URL 的模型列表（body: `{ provider, apiKey, modelsUrl? }`） |

### AI · 多配置管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/ai/configs` | 获取配置列表（含 `activeId`） |
| GET | `/api/ai/config` | 获取当前激活的单条配置 |
| POST | `/api/ai/configs` | 新增配置（body: `{ apiKey, apiUrl?, model? }`；首个配置自动激活） |
| DELETE | `/api/ai/configs/:id` | 删除配置 |
| POST | `/api/ai/configs/:id/activate` | 激活指定配置 |

> 历史遗留的单对象 `ai-config.json` 会在首次启动时自动迁移为多配置格式。

### AI · 历史对话（生成历史）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/ai/history` | 获取全部生成历史；可选 `?connectionId=xxx` 过滤 |
| POST | `/api/ai/history` | 新增一条生成历史（body: `{ connectionId, database, tables, question, sql }`） |
| DELETE | `/api/ai/history/:id` | 删除单条历史 |
| DELETE | `/api/ai/history` | 清空全部生成历史 |

### AI · 流式 SQL 生成

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/ai/generate` | 流式生成 SQL（SSE，Content-Type: `text/event-stream`；body: `{ connectionId, database, tables, question }`） |

SSE 事件消息结构：`{ type: 'thinking' | 'sql' | 'done' | 'error', content: string }`。

### AI · SQL 业务解释

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/ai/explain` | 用中文解释 SQL 的业务含义（body: `{ sql }`；返回 `{ explanation }`） |

### AI · SQL 性能分析

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/ai/analyze` | 先 EXPLAIN 再由 AI 给出优化建议（body: `{ connectionId, database, sql }`；相同 SQL 会命中本地缓存并返回 `cached: true`） |
| GET | `/api/ai/analysis-history` | 获取分析历史（返回 `{ items, total }`） |
| DELETE | `/api/ai/analysis-history` | 清空分析历史（返回 `{ cleared }`） |

### AI · 提示词模板

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/ai/prompts` | 获取三类提示词（返回 Record\<type, IPromptTemplate\>） |
| GET | `/api/ai/prompts/:type` | 获取指定类型提示词（type: `generate_sql` / `analyze_sql` / `explain_sql`） |
| PUT | `/api/ai/prompts/:type` | 更新指定类型提示词（body: `{ prompt }`；不允许清空） |
| POST | `/api/ai/prompts/:type/reset` | 重置为默认提示词 |

## 🗂 数据存储

所有配置与历史均保存在 `server/data/` 目录下的 JSON 文件中（可通过 `DATA_DIR` 环境变量更改）：

- `connections.json` — 数据库连接信息（密码 AES 加密）
- `ai-config.json` — AI 配置（多配置列表 + 当前激活 ID；兼容旧版单对象并自动迁移）
- `ai-history.json` — AI 生成历史记录
- `ai-prompts.json` — 三类提示词模板（支持在线编辑与重置）
- `ai-analysis-cache.json` — SQL 分析结果缓存（加速相同 SQL 的重复分析）

数据仅存储在本地，不会上传到任何第三方服务。

## 📝 License

MIT
