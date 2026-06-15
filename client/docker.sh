#!/bin/bash

name="quick-auto-sql-client"
port=13306

echo "你的项目名是: $name"
echo "使用端口: $port"

echo "停止旧容器: $name"
docker stop "$name" 2>/dev/null || true

echo "删除旧容器: $name"
docker rm -f "$name" 2>/dev/null || true

echo "删除旧镜像: $name"
docker rmi -f "$name" 2>/dev/null || true

echo "构建新镜像: $name"
docker build -t "$name:latest" .

echo "启动新容器: $name"
# host-gateway 由 Docker 自动解析为宿主机 IP，替代硬编码 192.168.33.180，
# 确保 /api 请求在容器内 Nginx 中能找到宿主机的后端。
docker run -d \
  --name "$name" \
  -p "$port:13306" \
  --add-host quick-auto-sql-server:host-gateway \
  --restart unless-stopped \
  "$name:latest"

sleep 2

if docker ps | grep "$name" | grep -q Up; then
  echo "========================================"
  echo "  运行成功！"
  echo "  访问地址: http://$(hostname -I 2>/dev/null | awk '{print $1}'):$port"
  echo "  API 代理: quick-auto-sql-server -> 宿主机 13305"
  echo "========================================"
else
  echo "容器未成功启动，查看日志："
  docker logs "$name" --tail 50
  exit 1
fi
