#!/bin/bash

# HuLa-Server 自动化部署脚本
# 使用方法: bash deploy.sh [dev|prod]

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 默认环境
ENV=${1:-dev}

SERVICE_HOST=${SERVICE_HOST:-host.docker.internal}

MYSQL_ROOT_PASSWORD=""
REDIS_PASSWORD=""
ROCKETMQ_BROKER_IP=""
ROCKETMQ_ACCESS_KEY=""
ROCKETMQ_SECRET_KEY=""

DOCKER="docker"
DOCKER_COMPOSE="docker compose"

init_docker_cmd() {
    if docker ps >/dev/null 2>&1; then
        DOCKER="docker"
        DOCKER_COMPOSE="docker compose"
        return 0
    fi

    if sudo -n docker ps >/dev/null 2>&1; then
        DOCKER="sudo -n docker"
        DOCKER_COMPOSE="sudo -n docker compose"
        return 0
    fi

    if [ ! -t 0 ]; then
        echo -e "${RED}错误: 当前用户无 Docker 权限，且无法使用 sudo（非交互环境）${NC}"
        echo -e "${YELLOW}解决: 将用户加入 docker 组并重新登录，或使用 sudo 运行脚本${NC}"
        exit 1
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

    if [ -z "$REDIS_PASSWORD" ]; then
        REDIS_PASSWORD=$(load_value_from_env_file "REDIS_PASSWORD" "env/redis.env")
    fi

    if [ -z "$REDIS_PASSWORD" ] && [ -f "redis/redis.conf" ]; then
        REDIS_PASSWORD=$(grep -E "^requirepass\s+" redis/redis.conf | head -n 1 | awk '{print $2}' | tr -d '"' || true)
    fi

    if [ -z "$ROCKETMQ_BROKER_IP" ]; then
        ROCKETMQ_BROKER_IP=$(load_value_from_env_file "ROCKETMQ_BROKER_IP" ".env")
    fi

    if [ -z "$ROCKETMQ_ACCESS_KEY" ]; then
        ROCKETMQ_ACCESS_KEY=$(load_value_from_env_file "ROCKETMQ_ACCESS_KEY" ".env")
    fi

    if [ -z "$ROCKETMQ_SECRET_KEY" ]; then
        ROCKETMQ_SECRET_KEY=$(load_value_from_env_file "ROCKETMQ_SECRET_KEY" ".env")
    fi

    if [ -z "$ROCKETMQ_ACCESS_KEY" ] || [ -z "$ROCKETMQ_SECRET_KEY" ]; then
        ROCKETMQ_ACCESS_KEY="${ROCKETMQ_ACCESS_KEY:-earthearth}"
        ROCKETMQ_SECRET_KEY="${ROCKETMQ_SECRET_KEY:-mq000000}"
        echo -e "${YELLOW}警告: 未配置 RocketMQ ACL 密钥，使用默认值（生产环境请运行 init-passwords.sh 生成强密钥）${NC}"
    fi
}

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  HuLa-Server 自动化部署脚本${NC}"
echo -e "${GREEN}  环境: ${ENV}${NC}"
echo -e "${GREEN}========================================${NC}"

# 检查Docker
check_docker() {
    echo -e "${YELLOW}[1/8] 检查Docker环境...${NC}"
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}错误: Docker未安装${NC}"
        exit 1
    fi
    init_docker_cmd
    echo -e "${GREEN}✓ Docker环境正常${NC}"
}

# 设置目录权限
setup_permissions() {
    echo -e "${YELLOW}[2/8] 设置目录权限...${NC}"
    chmod -R 777 rocketmq/ 2>/dev/null || true
    chmod -R 755 mysql/ 2>/dev/null || true
    chmod -R 755 redis/ 2>/dev/null || true
    chmod -R 755 nacos/ 2>/dev/null || true
    chmod -R 755 minio/ 2>/dev/null || true
    echo -e "${GREEN}✓ 目录权限设置完成${NC}"
}

# 检查配置文件
check_config() {
    echo -e "${YELLOW}[3/8] 检查配置文件...${NC}"
    
    # 检查broker.conf
    if [ ! -f "rocketmq/broker/conf/broker.conf" ]; then
        echo -e "${RED}错误: rocketmq/broker/conf/broker.conf 不存在${NC}"
        exit 1
    fi
    
    # 检查brokerIP1配置
    BROKER_IP=$(grep -E "^brokerIP1=" rocketmq/broker/conf/broker.conf | head -n 1 | cut -d'=' -f2-)
    if [ -z "$BROKER_IP" ] || [ "$BROKER_IP" == "YOUR_SERVER_IP" ]; then
        if [ -n "$ROCKETMQ_BROKER_IP" ] && [ "$ROCKETMQ_BROKER_IP" != "YOUR_SERVER_IP" ]; then
            if grep -qE "^brokerIP1=" rocketmq/broker/conf/broker.conf; then
                sed -i "s/^brokerIP1=.*/brokerIP1=${ROCKETMQ_BROKER_IP}/" rocketmq/broker/conf/broker.conf
            else
                echo "brokerIP1=${ROCKETMQ_BROKER_IP}" >> rocketmq/broker/conf/broker.conf
            fi
            echo -e "${GREEN}✓ 已自动设置 brokerIP1=${ROCKETMQ_BROKER_IP}${NC}"
        else
            echo -e "${RED}错误: 请在 broker.conf 中配置 brokerIP1${NC}"
            echo -e "${YELLOW}提示: 将 brokerIP1 设置为服务器的实际IP地址${NC}"
            exit 1
        fi
    fi
    
    echo -e "${GREEN}✓ 配置文件检查通过${NC}"
}

# 启动服务
start_services() {
    echo -e "${YELLOW}[4/8] 启动Docker服务...${NC}"

    if [ "$ENV" == "prod" ]; then
        if ! ${DOCKER_COMPOSE} -f docker-compose.prod.yml up -d; then
            echo -e "${RED}错误: Docker 启动失败（常见原因：镜像拉取失败/网络不可达）${NC}"
            echo -e "${YELLOW}提示: 若无法访问 Docker Hub，请配置 Docker 镜像加速器或使用可访问的镜像源${NC}"
            exit 1
        fi
    else
        if ! ${DOCKER_COMPOSE} up -d; then
            echo -e "${RED}错误: Docker 启动失败（常见原因：镜像拉取失败/网络不可达）${NC}"
            echo -e "${YELLOW}提示: 若无法访问 Docker Hub，请配置 Docker 镜像加速器或使用可访问的镜像源${NC}"
            exit 1
        fi
    fi

    echo -e "${GREEN}✓ Docker服务启动命令已执行${NC}"
}

# 等待服务就绪
wait_for_services() {
    echo -e "${YELLOW}[5/8] 等待服务就绪...${NC}"
    
    # 等待MySQL
    echo -n "等待MySQL..."
    for i in {1..30}; do
        if [ -n "$MYSQL_ROOT_PASSWORD" ]; then
            if ${DOCKER} exec mysql mysqladmin ping -h localhost -u root -p"${MYSQL_ROOT_PASSWORD}" --silent 2>/dev/null; then
                echo -e " ${GREEN}✓${NC}"
                break
            fi
        else
            if ${DOCKER} exec mysql mysqladmin ping -h localhost --silent 2>/dev/null; then
                echo -e " ${GREEN}✓${NC}"
                break
            fi
        fi
        echo -n "."
        sleep 2
    done
    
    # 等待Redis
    echo -n "等待Redis..."
    for i in {1..15}; do
        if [ -n "$REDIS_PASSWORD" ]; then
            if ${DOCKER} exec redis redis-cli -a "${REDIS_PASSWORD}" ping 2>/dev/null | grep -q "PONG"; then
                echo -e " ${GREEN}✓${NC}"
                break
            fi
        else
            if ${DOCKER} exec redis redis-cli ping 2>/dev/null | grep -q "PONG"; then
                echo -e " ${GREEN}✓${NC}"
                break
            fi
        fi
        echo -n "."
        sleep 2
    done
    
    # 等待Nacos
    echo -n "等待Nacos..."
    for i in {1..30}; do
        if curl -sf http://localhost:8848/nacos/v1/console/health/readiness >/dev/null 2>&1; then
            echo -e " ${GREEN}✓${NC}"
            break
        fi
        if curl -sf http://localhost:8848/nacos/actuator/prometheus >/dev/null 2>&1; then
            echo -e " ${GREEN}✓${NC}"
            break
        fi
        if curl -sf http://localhost:8848/nacos/ >/dev/null 2>&1; then
            echo -e " ${GREEN}✓${NC}"
            break
        fi
        echo -n "."
        sleep 2
    done
    
    echo -e "${GREEN}✓ 所有服务已就绪${NC}"
}

# 导入数据库
import_database() {
    echo -e "${YELLOW}[6/8] 检查数据库...${NC}"
    
    if [ -z "$MYSQL_ROOT_PASSWORD" ]; then
        echo -e "${YELLOW}警告: 未获取到 MYSQL_ROOT_PASSWORD，跳过数据库导入，请手动导入${NC}"
        return 0
    fi

    # 检查nacos数据库是否已初始化
    TABLES=$(${DOCKER} exec mysql mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'nacos';" 2>/dev/null || echo "0")
    
    if [ "$TABLES" -lt "10" ]; then
        echo "导入Nacos数据库..."
        if [ -f "../mysql-schema.sql" ]; then
            ${DOCKER} exec mysql mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" -e "CREATE DATABASE IF NOT EXISTS nacos DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" >/dev/null 2>&1 || true
            ${DOCKER} exec -i mysql mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" nacos < ../mysql-schema.sql
            echo -e "${GREEN}✓ Nacos数据库导入完成${NC}"
        else
            echo -e "${YELLOW}警告: mysql-schema.sql 不存在，请手动导入${NC}"
        fi
    else
        echo -e "${GREEN}✓ Nacos数据库已存在${NC}"
    fi

    echo "检查业务数据库..."
    ${DOCKER} exec mysql mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" -e "CREATE DATABASE IF NOT EXISTS luohuo_dev DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" >/dev/null 2>&1 || true
    ${DOCKER} exec mysql mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" -e "CREATE DATABASE IF NOT EXISTS luohuo_im_01 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" >/dev/null 2>&1 || true

    DEV_TABLES=$(${DOCKER} exec mysql mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'luohuo_dev';" 2>/dev/null || echo "0")
    if [ "$DEV_TABLES" -lt "10" ]; then
        if [ -f "../sql/luohuo_dev.sql" ]; then
            echo "导入业务数据库 luohuo_dev..."
            ${DOCKER} exec -i mysql mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" luohuo_dev < ../sql/luohuo_dev.sql
            echo -e "${GREEN}✓ luohuo_dev 导入完成${NC}"
        else
            echo -e "${YELLOW}警告: ../sql/luohuo_dev.sql 不存在，请手动导入${NC}"
        fi
    else
        echo -e "${GREEN}✓ luohuo_dev 已存在${NC}"
    fi

    IM_TABLES=$(${DOCKER} exec mysql mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'luohuo_im_01';" 2>/dev/null || echo "0")
    if [ "$IM_TABLES" -lt "10" ]; then
        if [ -f "../sql/luohuo_im_01.sql" ]; then
            echo "导入业务数据库 luohuo_im_01..."
            ${DOCKER} exec -i mysql mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" luohuo_im_01 < ../sql/luohuo_im_01.sql
            echo -e "${GREEN}✓ luohuo_im_01 导入完成${NC}"
        else
            echo -e "${YELLOW}警告: ../sql/luohuo_im_01.sql 不存在，请手动导入${NC}"
        fi
    else
        echo -e "${GREEN}✓ luohuo_im_01 已存在${NC}"
    fi
}

import_nacos_config() {
    echo -e "${YELLOW}[7/8] 导入Nacos配置...${NC}"

    if ! command -v unzip >/dev/null 2>&1; then
        echo -e "${YELLOW}警告: unzip 未安装，跳过Nacos配置导入${NC}"
        return 0
    fi

    ZIP_FILE=$(ls -t ../nacos/nacos_config_export_*.zip 2>/dev/null | head -n 1 || true)
    if [ -z "$ZIP_FILE" ]; then
        echo -e "${YELLOW}警告: 未找到 ../nacos/nacos_config_export_*.zip，跳过Nacos配置导入${NC}"
        return 0
    fi

    # 尝试获取 Nacos 容器 IP
    NACOS_CONTAINER_IP=$(${DOCKER} inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' nacos 2>/dev/null || echo "")
    if [ -n "$NACOS_CONTAINER_IP" ]; then
        NACOS_URL="http://${NACOS_CONTAINER_IP}:8848"
    else
        NACOS_URL="${NACOS_URL:-http://${SERVICE_HOST}:8848}"
    fi

    NACOS_USERNAME="${NACOS_USERNAME:-nacos}"
    NACOS_PASSWORD="${NACOS_PASSWORD:-nacos}"

    ACCESS_TOKEN=$(curl -s -X POST "${NACOS_URL}/nacos/v1/auth/users/login" -d "username=${NACOS_USERNAME}&password=${NACOS_PASSWORD}" | sed -n 's/.*\"accessToken\":\"\\([^\"]*\\)\".*/\\1/p' | head -n 1 || true)

    TMP_DIR=$(mktemp -d)

    publish_config() {
        local data_id="$1"
        local file_path="$2"
        local file_type="${3:-yaml}"
        local url="${NACOS_URL}/nacos/v1/cs/configs"

        if [ -n "$ACCESS_TOKEN" ]; then
            url="${url}?accessToken=${ACCESS_TOKEN}"
        fi

        http_code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$url" \
            --data-urlencode "dataId=${data_id}" \
            --data-urlencode "group=DEFAULT_GROUP" \
            --data-urlencode "type=${file_type}" \
            --data-urlencode "content@${file_path}" || true)

        if [ "$http_code" != "200" ]; then
            echo -e "${YELLOW}警告: Nacos 配置发布失败 dataId=${data_id} (HTTP ${http_code})${NC}"
            return 1
        fi
        return 0
    }

    unzip -p "$ZIP_FILE" DEFAULT_GROUP/common.yml > "${TMP_DIR}/common.yml" 2>/dev/null || true
    unzip -p "$ZIP_FILE" DEFAULT_GROUP/luohuo-gateway-server.yml > "${TMP_DIR}/luohuo-gateway-server.yml" 2>/dev/null || true
    unzip -p "$ZIP_FILE" DEFAULT_GROUP/luohuo-oauth-server.yml > "${TMP_DIR}/luohuo-oauth-server.yml" 2>/dev/null || true
    unzip -p "$ZIP_FILE" DEFAULT_GROUP/luohuo-base-server.yml > "${TMP_DIR}/luohuo-base-server.yml" 2>/dev/null || true
    unzip -p "$ZIP_FILE" DEFAULT_GROUP/luohuo-im-server.yml > "${TMP_DIR}/luohuo-im-server.yml" 2>/dev/null || true
    unzip -p "$ZIP_FILE" DEFAULT_GROUP/luohuo-ws-server.yml > "${TMP_DIR}/luohuo-ws-server.yml" 2>/dev/null || true
    unzip -p "$ZIP_FILE" DEFAULT_GROUP/luohuo-ai-server.yml > "${TMP_DIR}/luohuo-ai-server.yml" 2>/dev/null || true

    cat > "${TMP_DIR}/redis.yml" <<EOF
luohuo:
  cache:
    type: REDIS
    serializer-type: JACK_SON
  redis:
    ip: ${SERVICE_HOST}
    port: 16379
    password: '${REDIS_PASSWORD}'
    database: 1
spring:
  cache:
    type: GENERIC
  data:
    redis:
      host: \${luohuo.redis.ip}
      password: \${luohuo.redis.password}
      port: \${luohuo.redis.port}
      database: \${luohuo.redis.database}
EOF

    cat > "${TMP_DIR}/mysql.yml" <<EOF
luohuo:
  mysql: &db-mysql
    filters: stat,wall
    db-type: mysql
    validation-query: SELECT 'x'
    username: 'root'
    password: '${MYSQL_ROOT_PASSWORD}'
    driverClassName: com.mysql.cj.jdbc.Driver
    url: jdbc:mysql://${SERVICE_HOST}:13306/luohuo_dev?serverTimezone=Asia/Shanghai&characterEncoding=utf8&useUnicode=true&useSSL=false&autoReconnect=true&zeroDateTimeBehavior=convertToNull&allowMultiQueries=true&nullCatalogMeansCurrent=true&allowPublicKeyRetrieval=true
  database:
    multiTenantType: NONE
    isDataScope: true
    isBlockAttack: false
    isIllegalSql: false
    isSeata: false
    p6spy: false
spring:
  datasource:
    dynamic:
      enabled: false
    druid:
      enable: true
      <<: *db-mysql
      initialSize: 10
      minIdle: 10
      maxActive: 200
      max-wait: 60000
      pool-prepared-statements: true
      max-pool-prepared-statement-per-connection-size: 20
      test-on-borrow: false
      test-on-return: false
      test-while-idle: true
      time-between-eviction-runs-millis: 60000
      min-evictable-idle-time-millis: 300000
      filters: stat,wall
mybatis-plus:
  mapper-locations:
    - classpath*:mapper**/**/**/*Mapper.xml
  typeAliasesPackage: com.luohuo.flex.*.entity;com.luohuo.basic.database.mybatis.typehandler
  typeEnumsPackage: com.luohuo.flex.*.enumeration
  global-config:
    db-config:
      id-type: INPUT
      insert-strategy: NOT_NULL
      update-strategy: NOT_NULL
      where-strategy: NOT_EMPTY
  configuration:
    map-underscore-to-camel-case: true
    cache-enabled: false
    jdbc-type-for-null: 'null'
    default-enum-type-handler: com.luohuo.basic.database.mybatis.handlers.MybatisEnumTypeHandler
EOF

    cat > "${TMP_DIR}/rocketmq.yml" <<EOF
luohuo:
  rocketmq:
    enabled: true
    ip: ${SERVICE_HOST}
    port: 9876
    access-key: '${ROCKETMQ_ACCESS_KEY}'
    secret-key: '${ROCKETMQ_SECRET_KEY}'
rocketmq:
  ip: \${luohuo.rocketmq.ip}
  port: \${luohuo.rocketmq.port}
  access-key: \${luohuo.rocketmq.access-key}
  secret-key: \${luohuo.rocketmq.secret-key}
  name-server: \${luohuo.rocketmq.ip}:\${luohuo.rocketmq.port}
EOF

    publish_config "common.yml" "${TMP_DIR}/common.yml" "yaml" || true
    publish_config "redis.yml" "${TMP_DIR}/redis.yml" "yaml" || true
    publish_config "mysql.yml" "${TMP_DIR}/mysql.yml" "yaml" || true
    publish_config "rocketmq.yml" "${TMP_DIR}/rocketmq.yml" "yaml" || true
    publish_config "luohuo-gateway-server.yml" "${TMP_DIR}/luohuo-gateway-server.yml" "yaml" || true
    publish_config "luohuo-gateway-server-prod.yml" "${TMP_DIR}/luohuo-gateway-server.yml" "yaml" || true
    publish_config "luohuo-gateway-server" "${TMP_DIR}/luohuo-gateway-server.yml" "yaml" || true
    publish_config "luohuo-oauth-server.yml" "${TMP_DIR}/luohuo-oauth-server.yml" "yaml" || true
    publish_config "luohuo-base-server.yml" "${TMP_DIR}/luohuo-base-server.yml" "yaml" || true
    publish_config "luohuo-im-server.yml" "${TMP_DIR}/luohuo-im-server.yml" "yaml" || true
    publish_config "luohuo-ws-server.yml" "${TMP_DIR}/luohuo-ws-server.yml" "yaml" || true
    publish_config "luohuo-ai-server.yml" "${TMP_DIR}/luohuo-ai-server.yml" "yaml" || true

    echo "Nacos 配置临时目录: ${TMP_DIR}"
    # rm -rf "$TMP_DIR"
    echo -e "${GREEN}✓ Nacos配置导入完成${NC}"
}

# 显示状态
show_status() {
    echo -e "${YELLOW}[8/8] 服务状态...${NC}"
    echo ""
    ${DOCKER_COMPOSE} ps
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}  部署完成!${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo "服务访问地址:"
    echo "  - Nacos:  http://localhost:8848/nacos (nacos/nacos)"
    echo "  - MinIO:  http://localhost:9001"
    echo "  - MySQL:  localhost:13306"
    echo "  - Redis:  localhost:16379"
    echo ""
    echo "下一步:"
    echo "  1. 编译项目: cd luohuo-util && mvn install -DskipTests"
    echo "  2. 编译项目: cd luohuo-cloud && mvn install -DskipTests"
    echo "  3. 启动服务: bash src/main/bin/all-start.sh"
}

# 主流程
main() {
    load_runtime_config
    check_docker
    setup_permissions
    check_config
    start_services
    wait_for_services
    import_database
    import_nacos_config
    show_status
}

main
