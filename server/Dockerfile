# ===== 构建阶段 =====
FROM node:22-alpine AS builder

WORKDIR /app

# 安装依赖
COPY package*.json ./
RUN npm install --no-audit --no-fund

# 复制源码并构建
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ===== 运行阶段 =====
FROM node:22-alpine

WORKDIR /app

# 仅拷贝生产依赖与构建产物
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY --from=builder /app/dist ./dist

# 数据目录（连接、AI 配置等持久化）
RUN mkdir -p /app/data

# 环境变量（可通过 docker run -e 覆盖）
ENV NODE_ENV=production
ENV PORT=13305
ENV DATA_DIR=/app/data

EXPOSE 13305

# 健康检查
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:13305/api/health || exit 1

CMD ["node", "dist/app.js"]
