#!/bin/bash

# HuLa-Server 密码初始化脚本
# 使用方法: bash init-passwords.sh
# 此脚本会生成随机强密码并创建 .env 文件

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

FORCE=0
QUIET=0
SERVER_IP_OVERRIDE=""

while [ $# -gt 0 ]; do
    case "$1" in
        --force|-f)
            FORCE=1
            ;;
        --quiet|-q)
            QUIET=1
            ;;
        --ip)
            shift
            SERVER_IP_OVERRIDE="$1"
            ;;
    esac
    shift || true
done

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  HuLa-Server 密码初始化脚本${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# 检查是否已存在 .env 文件
if [ -f ".env" ]; then
    echo -e "${YELLOW}警告: .env 文件已存在${NC}"
    if [ "$FORCE" -ne 1 ]; then
        read -p "是否覆盖? (y/N): " confirm
        if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
            echo "取消操作"
            exit 0
        fi
    fi
fi

# 生成随机密码函数
generate_password() {
    openssl rand -base64 32 | tr -d '/+=' | head -c 32
}

# 生成各项密码
MYSQL_ROOT_PWD=$(generate_password)
MYSQL_NACOS_PWD=$(generate_password)
REDIS_PWD=$(generate_password)
MINIO_PWD=$(generate_password)
NACOS_TOKEN=$(openssl rand -base64 32)
NACOS_IDENTITY=$(generate_password)
PII_KEY=$(openssl rand -base64 32)

# 获取服务器IP
if [ -n "$SERVER_IP_OVERRIDE" ]; then
    SERVER_IP="$SERVER_IP_OVERRIDE"
else
    SERVER_IP=$(hostname -I | awk '{print $1}' 2>/dev/null || echo "YOUR_SERVER_IP")
fi

echo -e "${YELLOW}生成密码中...${NC}"

# 创建 .env 文件
cat > .env << EOF
# HuLa-Server 环境变量配置
# 生成时间: $(date)
# 警告: 请妥善保管此文件，不要提交到版本控制!

# ==================== Nacos ====================
NACOS_VERSION=v3.0.2

# ==================== MySQL ====================
MYSQL_ROOT_PASSWORD=${MYSQL_ROOT_PWD}
MYSQL_NACOS_PASSWORD=${MYSQL_NACOS_PWD}

# ==================== Redis ====================
REDIS_PASSWORD=${REDIS_PWD}

# ==================== MinIO ====================
MINIO_ROOT_USER=admin
MINIO_ROOT_PASSWORD=${MINIO_PWD}

# ==================== Nacos Auth ====================
NACOS_AUTH_TOKEN=${NACOS_TOKEN}
NACOS_AUTH_IDENTITY_KEY=serverIdentity
NACOS_AUTH_IDENTITY_VALUE=${NACOS_IDENTITY}

# ==================== PII 加密 ====================
PII_ENCRYPTION_KEY=${PII_KEY}

# ==================== SRS WebRTC ====================
SRS_CANDIDATE=${SERVER_IP}

# ==================== RocketMQ ====================
ROCKETMQ_BROKER_IP=${SERVER_IP}
EOF

# 更新 mysql.env
cat > env/mysql.env << EOF
# MySQL 环境变量配置
# 生成时间: $(date)

MYSQL_ROOT_PASSWORD=${MYSQL_ROOT_PWD}
MYSQL_DATABASE=nacos
MYSQL_USER=nacos
MYSQL_PASSWORD=${MYSQL_NACOS_PWD}
LANG=C.UTF-8
MYSQL_ROOT_HOST=%
MYSQL_CHARSET=utf8mb4
MYSQL_COLLATION=utf8mb4_unicode_ci
EOF

# 更新 nacos-standalone-mysql.env
cat > env/nacos-standalone-mysql.env << EOF
# Nacos 环境变量配置
# 生成时间: $(date)

PREFER_HOST_MODE=mysql
MODE=standalone
SPRING_DATASOURCE_PLATFORM=mysql
MYSQL_SERVICE_HOST=mysql
MYSQL_SERVICE_DB_NAME=nacos
MYSQL_SERVICE_PORT=3306
MYSQL_SERVICE_USER=nacos
MYSQL_SERVICE_PASSWORD=${MYSQL_NACOS_PWD}
MYSQL_SERVICE_DB_PARAM=characterEncoding=utf8&connectTimeout=1000&socketTimeout=3000&autoReconnect=true&useUnicode=true&useSSL=false&serverTimezone=Asia/Shanghai&allowPublicKeyRetrieval=true
NACOS_AUTH_IDENTITY_KEY=serverIdentity
NACOS_AUTH_IDENTITY_VALUE=${NACOS_IDENTITY}
NACOS_AUTH_TOKEN=${NACOS_TOKEN}
EOF

# 更新 redis.conf
cat > redis/redis.conf << EOF
# HuLa-Server Redis 配置文件
# 生成时间: $(date)

# 网络配置
bind 0.0.0.0
port 6379
protected-mode yes

# 认证配置
requirepass ${REDIS_PWD}

# 持久化配置
appendonly yes
appendfsync everysec
appendfilename "appendonly.aof"

# RDB快照配置
save 900 1
save 300 10
save 60 10000
dbfilename dump.rdb
dir /data

# 内存配置
maxmemory 2gb
maxmemory-policy allkeys-lru

# 日志配置
loglevel notice
logfile "/logs/redis.log"

# 连接配置
timeout 300
tcp-keepalive 300
maxclients 10000

# 安全配置
rename-command FLUSHDB ""
rename-command FLUSHALL ""
rename-command DEBUG ""
rename-command CONFIG ""

# 性能优化
tcp-backlog 511
databases 16
EOF

# 设置文件权限
chmod 600 .env
chmod 600 env/mysql.env
chmod 600 env/nacos-standalone-mysql.env

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  密码初始化完成!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
if [ "$QUIET" -ne 1 ]; then
    echo -e "${YELLOW}重要: 请保存以下密码信息!${NC}"
    echo ""
    echo "MySQL Root 密码:    ${MYSQL_ROOT_PWD}"
    echo "MySQL Nacos 密码:   ${MYSQL_NACOS_PWD}"
    echo "Redis 密码:         ${REDIS_PWD}"
    echo "MinIO 密码:         ${MINIO_PWD}"
    echo "PII 加密密钥:       ${PII_KEY}"
    echo ""
    echo -e "${YELLOW}服务器IP: ${SERVER_IP}${NC}"
    echo -e "${YELLOW}请确认IP正确，如需修改请编辑 .env 文件${NC}"
    echo ""
    echo -e "${RED}警告: 请将以上密码保存到安全的地方!${NC}"
    echo -e "${RED}警告: 不要将 .env 文件提交到版本控制!${NC}"
else
    echo -e "${YELLOW}已写入: $(pwd)/.env${NC}"
    echo -e "${YELLOW}已写入: $(pwd)/env/mysql.env${NC}"
    echo -e "${YELLOW}已写入: $(pwd)/env/nacos-standalone-mysql.env${NC}"
    echo -e "${YELLOW}已写入: $(pwd)/redis/redis.conf${NC}"
fi
