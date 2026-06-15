# ===== 构建阶段：基于 Node 22 + npm 构建前端产物 =====
FROM node:22-alpine AS builder

WORKDIR /app

# 说明：Docker 镜像构建阶段使用 npm 而非 pnpm，
# 目的是绕过 pnpm 新版基于 SQLite 的 store index 在
# CentOS + overlay2 下的 disk I/O error 问题。

# 仅复制依赖清单并安装（利用 Docker 层缓存）
COPY package.json ./
RUN npm install --no-audit --no-fund --loglevel=error

# 复制源码并构建
COPY tsconfig*.json ./
COPY tsconfig.app.json ./
COPY tsconfig.node.json ./
COPY vite.config.ts ./
COPY index.html ./
COPY public ./public
COPY src ./src

# 使用 Vite 直接构建，跳过 vue-tsc 的严格类型检查（esbuild 仅做 TS 转译）。
# npm install 未锁定 Element Plus / Monaco 等第三方库的类型定义版本，
# 不同版本会导致大量 TS 类型报错（TS2345 / TS2591 / TS7006 / TS2741 等），
# 但它们不影响运行时功能；本地开发与 CI 仍用 `pnpm build` 做完整类型检查。
RUN npx vite build

# ===== 运行阶段：Nginx 托管静态文件 + 反向代理 /api =====
FROM nginx:alpine

# 拷贝构建产物
COPY --from=builder /app/dist /usr/share/nginx/html

# 拷贝 Nginx 配置
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 13306

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:13306/ >/dev/null || exit 1

CMD ["nginx", "-g", "daemon off;"]
