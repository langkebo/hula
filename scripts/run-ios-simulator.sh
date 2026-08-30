#!/usr/bin/env bash
# 一键在 iOS 模拟器中启动 TJG。
#
# 背景：本机 ~/.gitconfig 配置了 http/https 代理 127.0.0.1:7897（Clash/Mihomo），
# 若该代理未运行，cargo 下载依赖与 swift-rs 的 git 克隆都会失败。
# 本脚本在进程内临时绕过代理（不修改 ~/.gitconfig），直连 rsproxy.cn 与 GitHub。
#
# 用法：
#   ./scripts/run-ios-simulator.sh              # 默认设备 iPhone 17
#   ./scripts/run-ios-simulator.sh "iPhone 17 Pro"
set -euo pipefail

# 切到项目根目录
cd "$(dirname "$0")/.."

DEVICE="${1:-iPhone 17}"

# 绕过代理：cargo 直连 rsproxy.cn、git 直连 GitHub
export HTTP_PROXY= HTTPS_PROXY= ALL_PROXY= NO_PROXY='*'
export http_proxy= https_proxy= all_proxy= no_proxy='*'

# 覆盖 ~/.gitconfig 中的 http/https 代理（仅本进程生效）
export GIT_CONFIG_COUNT=2
export GIT_CONFIG_KEY_0="http.proxy"
export GIT_CONFIG_VALUE_0=""
export GIT_CONFIG_KEY_1="https.proxy"
export GIT_CONFIG_VALUE_1=""

echo "==> 启动 iOS 模拟器并运行 TJG（设备: ${DEVICE}）"
pnpm idev "$DEVICE"
