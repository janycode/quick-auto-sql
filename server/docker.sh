#!/bin/bash

name="quick-auto-sql-server"
port=13305
data_dir="$(pwd)/data"

echo "你的项目名是: $name"
echo "使用端口: $port"
echo "数据目录: $data_dir"

echo "停止旧容器: $name"
docker stop "$name" 2>/dev/null || true

echo "删除旧容器: $name"
docker rm -f "$name" 2>/dev/null || true

echo "删除旧镜像: $name"
docker rmi -f "$name" 2>/dev/null || true

echo "构建新镜像: $name"
docker build -t "$name:latest" .

echo "创建数据目录（用于持久化 MySQL 连接、AI 配置等）: $data_dir"
mkdir -p "$data_dir"

echo "启动新容器: $name"
docker run -d \
  --name "$name" \
  -p "$port:13305" \
  -v "$data_dir:/app/data" \
  --restart unless-stopped \
  "$name:latest"

sleep 2

if docker ps | grep "$name" | grep -q Up; then
  echo "========================================"
  echo "  运行成功！"
  echo "  后端地址: http://192.168.33.180:$port"
  echo "  健康检查: http://192.168.33.180:$port/api/health"
  echo "  数据卷挂载: $data_dir -> /app/data"
  echo "========================================"
else
  echo "容器未成功启动，查看日志："
  docker logs "$name" --tail 50
  exit 1
fi
