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
- **AI SQL 优化**：SSE 流式输出优化后的 SQL 语句
- **多套 AI 配置**：可同时保存多组 API Key / Base URL / Model，一键切换激活配置
- **AI 对话历史**：自动记录每次生成，支持按连接过滤、逐条删除、一键清空
- **AI SQL 业务解释**：一键为当前 SQL 在首行生成中文业务含义注释（不影响原 SQL 缩进）
- **AI SQL 性能分析**：先对 SQL 执行 EXPLAIN，再由大模型给出可执行的优化建议，表格中对 type / rows / filtered / Extra / key 等关键列做绿/黄/红染色，并附带中文字段含义 tooltip
- **分析历史 & 缓存**：相同 SQL 的分析结果会命中本地缓存（`cached` 标识），分析历史可随时回看与清空
- **持久化状态**：连接选择、数据库选择、查询结果高度自动持久化到本地存储，刷新页面不丢失
- **表勾选自动同步**：侧边栏勾选的表自动显示在 AI 助手关联表区域
- **SQL 安全限制**：执行接口禁止危险 DDL / 权限操作（DROP、TRUNCATE、GRANT、REVOKE）
- **可自定义提示词**：支持在线编辑 `generate_sql / analyze_sql / explain_sql / optimize_sql` 四类提示词模板，并可一键重置为默认
- **配额/套餐管理**：Free/Pro/Team/Enterprise 多级套餐，月度使用量限制
- **用户反馈**：内置反馈系统，支持 Bug 报告和功能建议
- **操作审计**：所有关键操作记录审计日志

<img width="1921" height="1062" alt="image" src="https://github.com/user-attachments/assets/d4d2cda2-a29a-427e-a510-743b5d0efc6e" />
<img width="906" height="853" alt="image" src="https://github.com/user-attachments/assets/191bb61d-8a80-4078-8f5b-715a3e61a200" />
<img width="1232" height="519" alt="image" src="https://github.com/user-attachments/assets/c5f4c2fc-cb31-4ab5-b984-d7b8cb315164" />
<img width="1921" height="1062" alt="image" src="https://github.com/user-attachments/assets/1f3069ae-98e7-4fdd-99f5-221f6b47e372" />
更多细节功能，可进行探索。


## 🏗 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Vue 3 + TypeScript + Vite + Vue Router + Pinia + Element Plus + Monaco Editor + Axios + dayjs + highlight.js + sql-formatter |
| 后端 | Node.js + TypeScript + Express + MySQL2 + bcryptjs + crypto-js + nodemailer |
| AI | 任意 OpenAI `/chat/completions` 兼容接口（内置 DeepSeek、LongCat，支持自定义） |
| 数据存储 | 连接配置、AI 配置、AI 历史、提示词模板等通过本地 JSON 文件持久化 |

## 📁 项目结构

```
quick-auto-sql/
├── server/                      # 后端服务
│   ├── src/
│   │   ├── app.ts               # Express 入口 + /api/health 健康检查 + 优雅关闭
│   │   ├── config/              # 环境变量（端口、加密密钥、SMTP、查询限制等）
│   │   ├── routes/              # 9 个路由模块
│   │   │   ├── auth.ts          # 注册、登录、退出、个人资料、修改密码
│   │   │   ├── connection.ts    # 连接管理（CRUD + 测试）
│   │   │   ├── database.ts      # 数据库/表/字段浏览 + DDL
│   │   │   ├── query.ts         # SQL 查询 + 执行历史
│   │   │   ├── ai.ts            # AI 配置 / 流式生成 / 优化 / 分析 / 解释 / 提示词模板
│   │   │   ├── audit.ts         # 审计日志
│   │   │   ├── quota.ts         # 配额/套餐
│   │   │   ├── pay.ts           # 支付订单
│   │   │   └── feedback.ts      # 用户反馈
│   │   ├── services/            # 10 个服务模块（业务逻辑）
│   │   ├── middleware/          # 5 个中间件（鉴权、限流、CSRF、配额、错误处理）
│   │   ├── store/               # JSON 持久化 + 提示词模板 + 分析缓存 + 配额存储
│   │   ├── utils/               # MySQL 错误码统一处理
│   │   └── types/               # TypeScript 类型定义
│   └── data/                    # 运行时数据目录（自动创建，含 12 个 JSON 文件）
│
└── client/                      # 前端应用
    └── src/
        ├── api/                 # API 请求层（8 个模块）
        ├── stores/              # Pinia 状态管理（7 个 store）
        ├── views/               # 8 个视图目录
        ├── components/          # 6 个组件目录（布局/数据库树/编辑器/AI/配额/设置）
        ├── router/              # 路由配置
        ├── styles/              # 全局样式
        └── utils/               # request / SSE / SQL 格式化 / 套餐定义
```

## 🚀 快速开始

### 环境要求

- Node.js >= 18
- pnpm（前端）/ npm（后端）
- MySQL 数据库实例（用于查询功能）

### 启动后端（开发环境 · 端口 3000）

```bash
cd server
npm install
npm run dev
# 服务启动在 http://localhost:3000
```

可选：在 `server/.env` 中自定义以下配置（参考 `.env.example`）：

```dotenv
# ==================== 服务 ====================
PORT=3000

# ==================== 加密（必填） ====================
# 数据库连接密码和 AI API Key 的 AES 加密密钥（请替换为随机字符串）
ENCRYPT_KEY=your-random-secret-key

# ==================== 数据目录 ====================
DATA_DIR=./data

# ==================== AI · 默认 DeepSeek ====================
DEEPSEEK_API_URL=https://api.deepseek.com/v1/chat/completions
DEEPSEEK_MODEL=deepseek-chat

# ==================== CORS ====================
# 允许的前端来源（逗号分隔，留空允许所有）
CORS_ORIGINS=

# ==================== SMTP · 邮件（可选） ====================
SMTP_HOST=smtp.example.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-smtp-username
SMTP_PASS=your-smtp-password-or-api-key
SMTP_FROM="Quick Auto SQL <no-reply@example.com>"
EMAIL_DEV_MODE=true

# ==================== 其他 ====================
ADMIN_EMAIL=
CSRF_SECRET=
```

> **重要**：`ENCRYPT_KEY` 必须设置，否则数据库密码和 AI API Key 无法加密存储。生产部署请务必设置强随机密钥。

### 启动前端（开发环境 · 端口 5173）

```bash
cd client
pnpm install
pnpm dev
# 应用启动在 http://localhost:5173
```

前端 Vite 已配置代理：`/api/**` 自动转发到后端 `http://localhost:3000`。

### 健康检查

后端启动后可访问 `GET http://localhost:3000/api/health` 验证服务状态。

## 🐳 Docker 部署（生产环境 · 端口 13305 / 13306）

### 使用 docker-compose（推荐）

```bash
# 复制并编辑环境变量
cp server/.env.example server/.env
# 编辑 server/.env 设置 ENCRYPT_KEY 等

# 一键启动
docker-compose up -d
```

### 手动部署

```bash
# 1. 部署后端
cd server
chmod +x docker.sh
./docker.sh

# 2. 部署前端
cd ../client
chmod +x docker.sh
./docker.sh
```

部署成功后：
- 前端访问：`http://your-server:13306`
- 后端健康检查：`http://your-server:13305/api/health`

### 数据持久化

后端容器会挂载 `server/data/` 目录到容器内的 `/app/data`，所有 JSON 数据文件会持久化到宿主机。

## 📖 使用流程

1. **打开应用** → 进入"工作区"，在左侧点击按钮打开"连接管理"弹窗，添加一个 MySQL 数据库连接
2. **选择连接和数据库** → 左侧选择已保存的连接，展开数据库与表结构
3. **勾选表** → 在左侧树形结构中勾选需要查询的表（表会自动同步到右侧 AI 面板；超过 3 个表会有 join 性能风险提示）
4. **AI 生成 SQL** → 右侧 AI 助手中输入自然语言描述，点击"生成 SQL"，表结构信息会自动注入提示词
5. **使用 SQL** → 生成完成后点击"使用此 SQL"，SQL 自动填入编辑器，点击"执行"即可查询
6. **AI 解释 / 分析 / 优化**（可选）：
   - 点击「AI SQL 解释」，大模型会把这段 SQL 的业务含义写成中文注释
   - 点击「AI SQL 分析」，系统先执行 EXPLAIN 再交给大模型分析
   - 点击「AI SQL 优化」，系统会给出优化后的等价 SQL

## 🤖 AI 配置（多配置 · 多服务商 · 可自定义提示词）

1. 进入 `/settings/ai` 页面
2. 选择一个服务商标签（DeepSeek / LongCat / 自定义），或点击"+ 自定义"接入任意 OpenAI 兼容接口
3. 填写 API Key、API URL、获取模型 URL（自定义服务商时必填）
4. 输入 API Key 后失焦或选择其他服务商时，会通过后端代理自动拉取模型列表
5. 手动选择或输入模型名，点击"添加配置"
6. 在上方列表中点击"使用"切换当前激活配置，或点击"×"删除

### 内置 AI 服务商

| 名称 | chatUrl | 默认模型 |
|------|---------|----------|
| DeepSeek | `https://api.deepseek.com/v1/chat/completions` | `deepseek-chat` |
| LongCat | `https://api.longcat.chat/openai/v1/chat/completions` | `LongCat-2.0-Preview` |

## 🔧 API 接口

统一响应格式：`{ code: number, message: string, data: T }`。`code === 0` 表示成功，非 0 为失败并附带 message。

### 认证

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/register` | 注册（邮箱 + 密码 + 验证码） |
| POST | `/api/auth/login` | 登录 |
| POST | `/api/auth/logout` | 退出 |
| GET | `/api/auth/me` | 当前用户信息 |
| GET | `/api/auth/profile` | 个人资料 |
| PUT | `/api/auth/profile` | 更新个人资料 |
| PUT | `/api/auth/password` | 修改密码 |
| POST | `/api/auth/email/send-code` | 发送验证码 |
| POST | `/api/auth/email/check` | SMTP 自检 |

### 连接

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/connections` | 获取连接列表 |
| POST | `/api/connections` | 创建连接 |
| PUT | `/api/connections/:id` | 更新连接 |
| DELETE | `/api/connections/:id` | 删除连接 |
| POST | `/api/connections/test` | 测试未保存的连接 |
| POST | `/api/connections/:id/test` | 测试已保存的连接 |

### 数据库

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/databases?connectionId=xxx` | 数据库列表 |
| GET | `/api/databases/tables?connectionId=xxx&database=xxx` | 表列表 |
| GET | `/api/databases/columns?connectionId=xxx&database=xxx&table=xxx` | 字段列表 |
| GET | `/api/databases/ddl?connectionId=xxx&database=xxx&table=xxx` | DDL |

### 查询

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/query/execute` | 执行 SQL |
| GET | `/api/query/history` | 查询历史（分页） |
| DELETE | `/api/query/history/:id` | 删除单条历史 |
| DELETE | `/api/query/history` | 清空历史 |

### AI

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/ai/providers` | 服务商列表 |
| POST | `/api/ai/models` | 拉取模型列表 |
| GET/POST/DELETE | `/api/ai/configs` | AI 配置 CRUD |
| POST | `/api/ai/configs/:id/activate` | 激活配置 |
| POST | `/api/ai/test` | 测试 AI 连接 |
| POST | `/api/ai/generate` | SSE 流式生成 SQL |
| POST | `/api/ai/optimize` | SSE 流式优化 SQL |
| POST | `/api/ai/analyze` | EXPLAIN + AI 分析 |
| POST | `/api/ai/explain` | 业务解释 |
| GET/POST/DELETE | `/api/ai/history` | 对话历史 CRUD |
| GET/PUT/POST | `/api/ai/prompts` | 提示词模板管理 |
| GET/DELETE | `/api/ai/analysis-history` | 分析历史 |

### 配额/套餐

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/quota` | 获取配额信息 |
| POST | `/api/quota/upgrade` | 升级套餐 |

### 支付

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/pay/create` | 创建订单 |
| GET | `/api/pay/status/:orderId` | 查询状态 |
| POST | `/api/pay/confirm` | 确认支付 |
| POST | `/api/pay/cancel` | 取消订单 |

### 反馈

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/feedback` | 提交反馈 |
| GET | `/api/feedback` | 反馈列表 |
| PUT | `/api/feedback/:id/status` | 更新状态 |
| DELETE | `/api/feedback/:id` | 删除反馈 |

### 审计日志

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/audit` | 审计日志（分页） |
| DELETE | `/api/audit` | 清空日志 |

## 🗂 数据存储

所有配置与历史均保存在 `server/data/` 目录下的 JSON 文件中（可通过 `DATA_DIR` 环境变量更改）：

- `users.json` — 用户列表（密码 bcrypt 哈希 + 角色）
- `sessions.json` — 登录会话（7 天 TTL）
- `connections.json` — 数据库连接信息（密码 AES 加密）
- `ai-config.json` — AI 配置（API Key AES 加密）
- `ai-history.json` — AI 生成历史记录
- `ai-prompts.json` — 四类提示词模板
- `ai-sql-analysis-cache.json` — SQL 分析结果缓存
- `query-history.json` — SQL 执行历史
- `audit-log.json` — 操作审计日志
- `usage-records.json` — 用户配额用量
- `feedbacks.json` — 用户反馈
- `pay-orders.json` — 支付订单

数据仅存储在本地，不会上传到任何第三方服务。

## 📝 License

MIT
