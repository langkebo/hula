#!/bin/bash

# HuLa-Server Nacos 配置生成脚本
# 使用方法: bash generate-nacos-config.sh
# 此脚本会生成基础的 Nacos 配置，用于首次部署

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  HuLa-Server Nacos 配置生成脚本${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# 加载环境变量
if [ -f ".env" ]; then
    set -a
    . ./.env
    set +a
else
    echo -e "${RED}错误: .env 文件不存在，请先运行 init-passwords.sh${NC}"
    exit 1
fi

SERVICE_HOST=${SERVICE_HOST:-host.docker.internal}
NACOS_URL="${NACOS_URL:-http://localhost:8848}"
NACOS_USERNAME="${NACOS_USERNAME:-nacos}"
NACOS_PASSWORD="${NACOS_PASSWORD:-nacos}"

# 等待 Nacos 就绪
echo -e "${YELLOW}等待 Nacos 服务就绪...${NC}"
for i in {1..30}; do
    if curl -sf "${NACOS_URL}/nacos/v1/console/health/readiness" >/dev/null 2>&1; then
        echo -e "${GREEN}✓ Nacos 已就绪${NC}"
        break
    fi
    if curl -sf "${NACOS_URL}/nacos/" >/dev/null 2>&1; then
        echo -e "${GREEN}✓ Nacos 已就绪${NC}"
        break
    fi
    echo -n "."
    sleep 2
done

# 获取 Access Token
echo -e "${YELLOW}获取 Nacos Access Token...${NC}"
ACCESS_TOKEN=$(curl -s -X POST "${NACOS_URL}/nacos/v1/auth/users/login" \
    -d "username=${NACOS_USERNAME}&password=${NACOS_PASSWORD}" \
    | sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p' | head -n 1 || true)

if [ -z "$ACCESS_TOKEN" ]; then
    echo -e "${YELLOW}警告: 无法获取 Access Token，尝试无认证模式${NC}"
fi

# 发布配置函数
publish_config() {
    local data_id="$1"
    local content="$2"
    local file_type="${3:-yaml}"
    local url="${NACOS_URL}/nacos/v1/cs/configs"

    if [ -n "$ACCESS_TOKEN" ]; then
        url="${url}?accessToken=${ACCESS_TOKEN}"
    fi

    echo -n "发布 ${data_id}..."
    http_code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$url" \
        --data-urlencode "dataId=${data_id}" \
        --data-urlencode "group=DEFAULT_GROUP" \
        --data-urlencode "type=${file_type}" \
        --data-urlencode "content=${content}" || true)

    if [ "$http_code" = "200" ]; then
        echo -e " ${GREEN}✓${NC}"
        return 0
    else
        echo -e " ${RED}✗ (HTTP ${http_code})${NC}"
        return 1
    fi
}

# 生成 common.yml
COMMON_YML=$(cat <<EOF
# HuLa-Server 公共配置
# 自动生成时间: $(date)

server:
  servlet:
    encoding:
      charset: UTF-8
      enabled: true
      force: true

spring:
  main:
    allow-bean-definition-overriding: true
  servlet:
    multipart:
      max-file-size: 100MB
      max-request-size: 100MB

logging:
  level:
    root: INFO
    com.luohuo: DEBUG
EOF
)

# 生成 redis.yml
REDIS_YML=$(cat <<EOF
# HuLa-Server Redis 配置
# 自动生成时间: $(date)

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
)

# 生成 mysql.yml
MYSQL_YML=$(cat <<EOF
# HuLa-Server MySQL 配置
# 自动生成时间: $(date)

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
)

# 生成 rocketmq.yml
ROCKETMQ_YML=$(cat <<EOF
# HuLa-Server RocketMQ 配置
# 自动生成时间: $(date)

luohuo:
  rocketmq:
    enabled: true
    ip: ${SERVICE_HOST}
    port: 9876
    access-key: '${ROCKETMQ_ACCESS_KEY:-earthearth}'
    secret-key: '${ROCKETMQ_SECRET_KEY:-mq000000}'

rocketmq:
  ip: \${luohuo.rocketmq.ip}
  port: \${luohuo.rocketmq.port}
  access-key: \${luohuo.rocketmq.access-key}
  secret-key: \${luohuo.rocketmq.secret-key}
  name-server: \${luohuo.rocketmq.ip}:\${luohuo.rocketmq.port}
EOF
)

# 生成 luohuo-gateway-server.yml
GATEWAY_YML=$(cat <<EOF
# HuLa-Server Gateway 配置
# 自动生成时间: $(date)

server:
  port: 18760

spring:
  cloud:
    gateway:
      discovery:
        locator:
          enabled: true
          lower-case-service-id: true
      routes:
        - id: luohuo-oauth-server
          uri: lb://luohuo-oauth-server
          predicates:
            - Path=/api/oauth/**
          filters:
            - StripPrefix=2
        - id: luohuo-base-server
          uri: lb://luohuo-base-server
          predicates:
            - Path=/api/base/**
          filters:
            - StripPrefix=2
        - id: luohuo-im-server
          uri: lb://luohuo-im-server
          predicates:
            - Path=/api/im/**
          filters:
            - StripPrefix=2
EOF
)

# 发布配置
echo ""
echo -e "${YELLOW}发布 Nacos 配置...${NC}"
publish_config "common.yml" "$COMMON_YML" "yaml" || true
publish_config "redis.yml" "$REDIS_YML" "yaml" || true
publish_config "mysql.yml" "$MYSQL_YML" "yaml" || true
publish_config "rocketmq.yml" "$ROCKETMQ_YML" "yaml" || true
publish_config "luohuo-gateway-server.yml" "$GATEWAY_YML" "yaml" || true
publish_config "luohuo-gateway-server-prod.yml" "$GATEWAY_YML" "yaml" || true

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Nacos 配置生成完成!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}已发布的配置:${NC}"
echo "  - common.yml"
echo "  - redis.yml"
echo "  - mysql.yml"
echo "  - rocketmq.yml"
echo "  - luohuo-gateway-server.yml"
echo "  - luohuo-gateway-server-prod.yml"
echo ""
echo -e "${YELLOW}提示: 如需自定义配置，请登录 Nacos 控制台修改${NC}"
echo "  URL: ${NACOS_URL}/nacos"
echo "  用户名: ${NACOS_USERNAME}"
echo "  密码: ${NACOS_PASSWORD}"
