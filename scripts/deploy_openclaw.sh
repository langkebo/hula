#!/usr/bin/env bash

# deploy_openclaw.sh
# 完整的部署流程：环境配置、打包构建、版本管理和发布验证
# 用于 OpenClaw 增强版 UI 部署

set -e

echo "======================================"
echo "🚀 开始部署 OpenClaw 增强版 UI..."
echo "======================================"

# 1. 环境配置检查
echo "🔧 [1/4] 检查环境配置..."
if ! command -v node &> /dev/null; then
    echo "❌ 错误: 未安装 Node.js"
    exit 1
fi
if ! command -v pnpm &> /dev/null; then
    echo "❌ 错误: 未安装 pnpm，正在尝试安装..."
    npm install -g pnpm
fi

NODE_VERSION=$(node -v | cut -d 'v' -f 2 | cut -d '.' -f 1)
if [ "$NODE_VERSION" -lt 22 ]; then
    echo "⚠️ 警告: 推荐使用 Node.js 22 或以上版本 (当前版本: $NODE_VERSION)"
fi

echo "✅ 环境检查通过"

# 2. 依赖安装与更新
echo "📦 [2/4] 安装并更新依赖..."
pnpm install
echo "✅ 依赖安装完成"

# 3. 打包构建
echo "🔨 [3/4] 开始打包构建..."
# 清理旧的构建文件
rm -rf dist src-tauri/target/release/bundle

# 执行前端检查
pnpm check
pnpm vue-tsc --noEmit

# 执行 Tauri 构建
echo "正在编译客户端..."
pnpm tauri build

echo "✅ 打包构建完成"

# 4. 发布验证
echo "🔍 [4/4] 发布验证..."
if [ -d "src-tauri/target/release/bundle" ]; then
    echo "✅ 构建产物已生成:"
    ls -lh src-tauri/target/release/bundle/
else
    echo "❌ 构建产物验证失败: 找不到 bundle 目录"
    exit 1
fi

echo "======================================"
echo "🎉 部署流程执行完毕，发布验证通过！"
echo "您可以从 src-tauri/target/release/bundle 获取安装包"
echo "======================================"
