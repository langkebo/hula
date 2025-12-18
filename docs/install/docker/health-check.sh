#!/bin/bash

# 进入脚本所在目录，确保能找到配置文件
cd "$(dirname "$0")"

# HuLa-Server 健康检查脚本
# 使用方法: bash health-check.sh

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "=========================================="
echo "  HuLa-Server 健康检查"
echo "=========================================="
echo ""

MYSQL_ROOT_PASSWORD=""
REDIS_PASSWORD=""

DOCKER="docker"
DOCKER_COMPOSE="docker compose"

init_docker_cmd() {
    if docker ps >/dev/null 2>&1; then
        DOCKER="docker"
        DOCKER_COMPOSE="docker compose"
        return 0
    fi

    if sudo -n docker ps >/dev/null 2>&1; then
        DOCKER="sudo docker"
        DOCKER_COMPOSE="sudo docker compose"
        return 0
    fi

    DOCKER="sudo docker"
    DOCKER_COMPOSE="sudo docker compose"
}

load_value_from_env_file() {
    local key="$1"
    local file="$2"
    if [ ! -f "$file" ]; then
        return 0
    fi
    grep -E "^${key}=" "$file" | head -n 1 | cut -d'=' -f2- | tr -d '"' || true
}

load_runtime_config() {
    if [ -f ".env" ]; then
        set -a
        . ./.env
        set +a
    fi

    if [ -z "$MYSQL_ROOT_PASSWORD" ]; then
        MYSQL_ROOT_PASSWORD=$(load_value_from_env_file "MYSQL_ROOT_PASSWORD" "env/mysql.env")
    fi

    if [ -z "$REDIS_PASSWORD" ]; then
        REDIS_PASSWORD=$(load_value_from_env_file "REDIS_PASSWORD" ".env")
    fi

    if [ -z "$REDIS_PASSWORD" ] && [ -f "redis/redis.conf" ]; then
        REDIS_PASSWORD=$(grep -E "^requirepass\s+" redis/redis.conf | head -n 1 | awk '{print $2}' | tr -d '"' || true)
    fi
}

# 检查函数
check_service() {
    local name=$1
    local check_cmd=$2
    
    printf "%-20s" "$name"
    if eval "$check_cmd" > /dev/null 2>&1; then
        echo -e "${GREEN}[OK]${NC}"
        return 0
    else
        echo -e "${RED}[FAIL]${NC}"
        return 1
    fi
}

# 基础设施检查
echo "=== 基础设施 ==="
init_docker_cmd
load_runtime_config
if [ -n "$MYSQL_ROOT_PASSWORD" ]; then
    check_service "MySQL" "${DOCKER} exec mysql mysqladmin ping -h localhost -u root -p\"$MYSQL_ROOT_PASSWORD\" --silent"
else
    check_service "MySQL" "${DOCKER} exec mysql mysqladmin ping -h localhost --silent"
fi

if [ -n "$REDIS_PASSWORD" ]; then
    check_service "Redis" "${DOCKER} exec redis redis-cli -a \"$REDIS_PASSWORD\" ping | grep -q PONG"
else
    check_service "Redis" "${DOCKER} exec redis redis-cli ping | grep -q PONG"
fi
check_service "Nacos" "curl -sf http://localhost:8848/nacos/v1/console/health/readiness >/dev/null || curl -sf http://localhost:8848/nacos/actuator/prometheus >/dev/null || curl -sf http://localhost:8848/nacos/ >/dev/null"
check_service "RocketMQ-NameSrv" "bash -c 'echo > /dev/tcp/localhost/9876'"
check_service "RocketMQ-Broker" "bash -c 'echo > /dev/tcp/localhost/10911'"
check_service "MinIO" "curl -sf http://localhost:9000/minio/health/live"

echo ""
echo "=== 应用服务 ==="
check_service "Gateway" "curl -sf http://localhost:18760/actuator/health | grep -q UP"
check_service "OAuth" "curl -sf http://localhost:18761/actuator/health | grep -q UP"
check_service "IM" "curl -sf http://localhost:18762/actuator/health | grep -q UP"
check_service "WebSocket" "curl -sf http://localhost:9501/actuator/health | grep -q UP"

echo ""
echo "=== Docker容器状态 ==="
${DOCKER_COMPOSE} ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "=== 资源使用 ==="
${DOCKER} stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"

echo ""
echo "=========================================="
echo "  检查完成"
echo "=========================================="
