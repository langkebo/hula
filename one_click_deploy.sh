#!/bin/bash

# HuLa-Server 一键部署脚本
# 功能：
# 1. 环境检查 (Docker, Java, Maven)
# 2. 基础设施部署 (MySQL, Redis, Nacos, RocketMQ, MinIO)
# 3. 密码初始化与权限修复
# 4. 项目编译打包
# 5. 应用服务部署 (Gateway, Auth, Base, IM, WS)
# 6. 自动验证

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

WORKDIR=$(pwd)
INFRA_DIR="$WORKDIR/docs/install/docker"
APP_DIR="$WORKDIR/luohuo-cloud"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  HuLa-Server 一键部署与验证脚本${NC}"
echo -e "${GREEN}========================================${NC}"

# 1. 环境检查
check_env() {
    echo -e "${YELLOW}[1/6] 检查系统环境...${NC}"
    
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}错误: Docker 未安装${NC}"
        exit 1
    fi
    
    if ! command -v mvn &> /dev/null; then
        echo -e "${RED}错误: Maven 未安装${NC}"
        exit 1
    fi
    
    if ! command -v java &> /dev/null; then
        echo -e "${RED}错误: Java 未安装${NC}"
        exit 1
    fi

    # 检查 Docker 权限
    if ! docker ps >/dev/null 2>&1; then
        if ! sudo docker ps >/dev/null 2>&1; then
            echo -e "${RED}错误: 当前用户无权运行 Docker，且无法使用 sudo${NC}"
            exit 1
        fi
    fi

    echo -e "${GREEN}✓ 环境检查通过${NC}"
}

# 2. 基础设施部署
deploy_infra() {
    echo -e "${YELLOW}[2/6] 部署基础设施 (MySQL, Redis, Nacos, RocketMQ)...${NC}"
    cd "$INFRA_DIR"

    # 初始化密码 (如果不存在 .env)
    if [ ! -f ".env" ]; then
        echo "初始化密码配置..."
        bash init-passwords.sh --quiet --force
    fi

    # 修复权限并启动服务
    # 注意: deploy.sh 内部已包含 setup_permissions (chown)
    bash deploy.sh prod

    cd "$WORKDIR"
}

# 3. 编译项目
build_project() {
    echo -e "${YELLOW}[3/6] 编译项目源码...${NC}"
    
    echo "编译 luohuo-util..."
    cd "$WORKDIR/luohuo-util"
    if ! mvn clean install -DskipTests -T 4; then
        echo -e "${RED}错误: luohuo-util 编译失败${NC}"
        exit 1
    fi
    
    echo "编译 luohuo-cloud..."
    cd "$APP_DIR"
    if ! mvn clean install -DskipTests -T 4; then
        echo -e "${RED}错误: luohuo-cloud 编译失败${NC}"
        exit 1
    fi
    
    cd "$WORKDIR"
    echo -e "${GREEN}✓ 项目编译完成${NC}"
}

# 4. 应用服务部署
deploy_apps() {
    echo -e "${YELLOW}[4/6] 部署应用服务...${NC}"
    cd "$APP_DIR"
    
    # 构建并启动容器
    # 使用 sudo 如果需要
    DOCKER_CMD="docker"
    if ! docker ps >/dev/null 2>&1; then
        DOCKER_CMD="sudo docker"
    fi
    
    echo "构建并启动应用容器..."
    $DOCKER_CMD compose -f docker-compose.services.yml up -d --build
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}错误: 应用服务启动失败${NC}"
        exit 1
    fi
    
    cd "$WORKDIR"
    echo -e "${GREEN}✓ 应用服务启动命令已执行${NC}"
}

# 5. 健康检查验证
verify_deployment() {
    echo -e "${YELLOW}[5/6] 验证服务健康状态...${NC}"
    
    # 等待一段时间让服务启动
    echo "等待应用服务启动 (预计 60秒)..."
    sleep 10
    
    SERVICES=("gateway:18760" "oauth:18761" "base:18763" "im:18762" "ws:9501")
    
    for service in "${SERVICES[@]}"; do
        name=${service%%:*}
        port=${service##*:}
        
        echo -n "检查 $name ($port)... "
        
        for i in {1..30}; do
            if curl -s "http://localhost:$port/actuator/health" | grep -q "UP"; then
                echo -e "${GREEN}UP${NC}"
                break
            fi
            
            if [ $i -eq 30 ]; then
                echo -e "${RED}TIMEOUT (请检查日志: docker logs hula-$name)${NC}"
            else
                echo -n "."
                sleep 2
            fi
        done
    done
}

# 6. 输出汇总
summary() {
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}  部署完成!${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo "基础设施:"
    echo "  - Nacos: http://localhost:8848/nacos"
    echo "  - MinIO: http://localhost:9001"
    echo ""
    echo "应用服务:"
    echo "  - Gateway: http://localhost:18760"
    echo "  - Auth:    http://localhost:18761"
    echo "  - Base:    http://localhost:18763"
    echo ""
    echo "查看日志命令:"
    echo "  docker logs -f hula-gateway"
    echo "  docker logs -f hula-base"
    echo "  docker logs -f nacos"
}

# 主流程
main() {
    check_env
    deploy_infra
    build_project
    deploy_apps
    verify_deployment
    summary
}

main
