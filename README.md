# Quick Auto SQL

> 基于大语言模型的智能 SQL 生成与数据库管理工具，通过自然语言一句话生成所需 SQL 语句。
> 
> 核心目标：简单、易用。

## ✨ 功能特性

- **数据库连接管理**：支持 MySQL 数据库连接配置、测试、增删改查，密码 AES 加密存储
- **数据库浏览**：树形结构展示数据库、表、字段，支持查看表结构与 DDL
- **SQL 查询控制台**：Monaco Editor 语法高亮编辑器，查询结果表格展示，支持 CSV 导出，可拖拽调整高度
- **AI SQL 生成**：基于 DeepSeek 大模型，通过自然语言描述自动生成格式化的 SQL 语句
  - SSE 流式输出，实时看到生成过程
  - 自动注入选中表的完整结构信息（DDL + 字段注释），确保 SQL 字段准确
- **持久化状态**：连接选择、数据库选择自动持久化到本地存储，刷新页面不丢失
- **表勾选自动同步**：侧边栏勾选的表自动显示在 AI 助手关联表区域

## 🏗 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Vue 3 + TypeScript + Vite + Vue Router + Pinia + Element Plus + Monaco Editor |
| 后端 | Node.js + TypeScript + Express + MySQL2 |
| AI | DeepSeek API（`/chat/completions` 兼容 OpenAI 协议） |
| 数据存储 | 连接配置和 AI 配置通过本地 JSON 文件持久化 |

## 📁 项目结构

```
quick-auto-sql/
├── server/                      # 后端服务
│   ├── src/
│   │   ├── app.ts               # 应用入口
│   │   ├── config/              # 配置（AES 密钥、端口等）
│   │   ├── routes/              # 4 个路由模块
│   │   │   ├── connection.ts    # 连接管理
│   │   │   ├── database.ts      # 数据库/表/字段浏览
│   │   │   ├── query.ts         # SQL 查询
│   │   │   └── ai.ts            # AI SQL 生成
│   │   ├── services/            # 4 个服务模块（业务逻辑）
│   │   ├── middleware/          # 错误处理 + async 包装
│   │   ├── store/               # JSON 文件持久化存储
│   │   └── types/               # TypeScript 类型定义
│   └── data/                    # 运行时数据目录（自动创建）
│
└── client/                      # 前端应用
    └── src/
        ├── api/                 # API 请求层（4 个模块）
        ├── stores/              # Pinia 状态管理（连接/数据库/AI）
        ├── views/               # 页面视图（连接管理/工作区/AI 配置）
        ├── components/          # 可复用组件（布局/数据库/编辑器/AI）
        ├── router/              # 路由配置
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

### 启动前端

```bash
cd client
pnpm install
pnpm dev
# 应用启动在 http://localhost:5173
```

前端 Vite 已配置代理：`/api/**` 自动转发到后端 `http://localhost:3000`。

## 📖 使用流程

1. **打开应用** → 进入"连接管理"，添加一个 MySQL 数据库连接
2. **切换到"工作区"** → 左侧选择连接和数据库，展开表结构
3. **勾选表** → 在左侧树形结构中勾选需要查询的表
4. **AI 生成 SQL** → 右侧 AI 助手中输入自然语言描述，点击"生成 SQL"，表结构信息会自动注入提示词
5. **使用 SQL** → 生成完成后点击"使用 SQL"，SQL 自动填入编辑器，点击"执行"即可查询

## 🤖 AI 配置

1. 进入"AI 配置"页面
2. 填入 DeepSeek API Key（获取地址：<https://platform.deepseek.com>）
3. 可选修改：Base URL、Model、Temperature、Max Tokens
4. 点击"保存配置"

### Prompt 设计要点

- System Prompt 明确角色定位，强调字段准确性，禁止编造不存在的字段
- User Prompt 注入选中表的完整 `SHOW CREATE TABLE` DDL，包含字段类型、索引、约束
- 针对中文场景优化，兼容中文表名和中文列名

## 🔧 API 接口

| 模块 | 方法 | 路径 | 说明 |
|------|------|------|------|
| 连接 | GET | `/api/connections` | 获取连接列表 |
| 连接 | POST | `/api/connections` | 创建连接 |
| 连接 | PUT | `/api/connections/:id` | 更新连接 |
| 连接 | DELETE | `/api/connections/:id` | 删除连接 |
| 连接 | POST | `/api/connections/test` | 测试连接 |
| 连接 | POST | `/api/connections/:id/test` | 测试已保存的连接 |
| 数据库 | GET | `/api/databases/:connectionId` | 获取数据库列表 |
| 数据库 | GET | `/api/databases/:connectionId/:database/tables` | 获取表列表 |
| 数据库 | GET | `/api/databases/:connectionId/:database/:table/columns` | 获取字段列表 |
| 数据库 | GET | `/api/databases/:connectionId/:database/:table/ddl` | 获取 DDL |
| 查询 | POST | `/api/query/execute` | 执行 SQL |
| AI | GET | `/api/ai/config` | 获取 AI 配置 |
| AI | POST | `/api/ai/config` | 保存 AI 配置 |
| AI | POST | `/api/ai/generate` | 生成 SQL（SSE 流式） |
| AI | POST | `/api/ai/test` | 测试 AI 配置 |

## 🗂 数据存储

- 所有配置保存在 `server/data/` 目录下的 JSON 文件中
- `connections.json`：数据库连接信息（密码 AES 加密）
- `ai-config.json`：AI API 配置
- 数据仅存储在本地，不会上传到任何第三方服务

## 📝 License

MIT
