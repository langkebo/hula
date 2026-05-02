#!/bin/bash

# hula 项目一键启动与环境检查脚本
# 版本: v1.0.0
# 用法: chmod +x scripts/bootstrap.sh && ./scripts/bootstrap.sh

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}>>> 正在启动 hula 项目初始化程序...${NC}"

# 1. 检查 Node.js 版本
echo -e "${YELLOW}[1/6] 检查 Node.js 版本...${NC}"
NODE_VERSION=$(node -v)
echo "当前 Node 版本: $NODE_VERSION"

# 2. 检查 PNPM
echo -e "${YELLOW}[2/6] 检查 PNPM...${NC}"
if ! command -v pnpm &> /dev/null; then
    echo -e "${RED}错误: 未安装 pnpm。请执行 'npm install -g pnpm' 后重试。${NC}"
    exit 1
fi

# 3. 检查 Rust 环境
echo -e "${YELLOW}[3/6] 检查 Rust/Cargo 环境...${NC}"
if ! command -v cargo &> /dev/null; then
    echo -e "${RED}错误: 未安装 Rust/Cargo。请访问 https://rustup.rs/ 安装。${NC}"
    exit 1
fi

# 4. 安装依赖
echo -e "${YELLOW}[4/6] 正在安装依赖包...${NC}"
pnpm install

# 5. 运行基础检查
echo -e "${YELLOW}[5/6] 正在运行静态检查与 i18n 生成...${NC}"
pnpm check

# 6. 建议后续操作
echo -e "${GREEN}>>> 初始化完成！${NC}"
echo -e "您可以选择以下方式启动项目："
echo -e "1. ${YELLOW}pnpm dev${NC}          - 启动前端开发服务器 (Web)"
echo -e "2. ${YELLOW}pnpm tauri:dev${NC}   - 启动桌面端应用程序 (Tauri)"
echo -e "3. ${YELLOW}pnpm test:run${NC}    - 运行单元测试"
echo -e "4. ${YELLOW}pnpm help${NC}        - 查看更多命令"

echo -e "\n${YELLOW}提示: 如果您是第一次运行项目，请确保已安装平台相关的开发依赖 (如 Xcode 或 Visual Studio)。${NC}"
