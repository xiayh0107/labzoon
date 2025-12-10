#!/bin/bash

# LabZoon Quick Start Script
# 这个脚本帮助快速设置和启动应用

set -e

echo "========================================"
echo "LabZoon 应用设置和启动"
echo "========================================"

# 1. 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 错误: Node.js 未安装"
    exit 1
fi
echo "✅ Node.js 已安装: $(node -v)"

# 2. 检查 .env 文件
if [ ! -f ".env" ]; then
    echo "❌ 错误: .env 文件不存在"
    echo "请运行以下命令创建:"
    echo "  cp .env.example .env"
    echo "然后编辑 .env 文件填入 Supabase 凭证"
    exit 1
fi
echo "✅ .env 文件已存在"

# 3. 检查是否需要安装依赖
if [ ! -d "node_modules" ]; then
    echo "📦 安装依赖中..."
    npm install
else
    echo "✅ 依赖已安装"
fi

# 4. 显示运行选项
echo ""
echo "请选择运行模式:"
echo "1) 开发模式（前端 + 后端）"
echo "2) 仅前端开发服务器"
echo "3) 仅后端开发服务器"
echo ""

read -p "请输入选择 (1-3): " choice

case $choice in
    1)
        echo "🚀 启动前端 + 后端开发服务器..."
        echo "前端将运行在: http://localhost:3000"
        echo "后端将运行在: http://localhost:5000"
        npm run dev:full
        ;;
    2)
        echo "🚀 启动前端开发服务器..."
        echo "前端将运行在: http://localhost:3000"
        echo "确保后端服务器已在其他终端运行"
        npm run dev
        ;;
    3)
        echo "🚀 启动后端开发服务器..."
        echo "后端将运行在: http://localhost:5000"
        npm run dev:server
        ;;
    *)
        echo "❌ 无效选择"
        exit 1
        ;;
esac
