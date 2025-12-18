#!/bin/bash
set -e

source .env

SERVICE_HOST="${SERVICE_HOST:-host.docker.internal}"
NACOS_URL="http://localhost:8848"
NACOS_USERNAME="nacos"
NACOS_PASSWORD="${MYSQL_NACOS_PASSWORD}" # Nacos uses this password? No, Nacos console login uses nacos/nacos or what?

# Check deploy.sh:
# NACOS_USERNAME="${NACOS_USERNAME:-nacos}"
# NACOS_PASSWORD="${NACOS_PASSWORD:-nacos}"
# It defaults to nacos/nacos.
# But init-passwords.sh sets MYSQL_NACOS_PASSWORD (db password).
# Nacos default user is nacos/nacos.
# Unless changed. deploy.sh doesn't seem to change Nacos console password.
NACOS_CONSOLE_USER="nacos"
NACOS_CONSOLE_PASSWORD="nacos"

echo "Getting Access Token..."
ACCESS_TOKEN=$(curl -s -X POST "${NACOS_URL}/nacos/v1/auth/users/login" -d "username=${NACOS_CONSOLE_USER}&password=${NACOS_CONSOLE_PASSWORD}" | sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p')

if [ -z "$ACCESS_TOKEN" ]; then
    echo "Failed to get access token. Nacos might be down or credentials wrong."
    # Try without token (if auth disabled)
fi

TMP_DIR=$(mktemp -d)

publish_config() {
    local data_id="$1"
    local file_path="$2"
    local file_type="${3:-yaml}"
    local url="${NACOS_URL}/nacos/v1/cs/configs"

    if [ -n "$ACCESS_TOKEN" ]; then
        url="${url}?accessToken=${ACCESS_TOKEN}"
    fi

    echo "Publishing ${data_id}..."
    http_code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$url" \
        --data-urlencode "dataId=${data_id}" \
        --data-urlencode "group=DEFAULT_GROUP" \
        --data-urlencode "type=${file_type}" \
        --data-urlencode "content@${file_path}")

    if [ "$http_code" != "200" ]; then
        echo "Error: Failed to publish ${data_id} (HTTP ${http_code})"
        return 1
    fi
    echo "Success: ${data_id}"
    return 0
}

ZIP_FILE=$(ls -t ../nacos/nacos_config_export_*.zip 2>/dev/null | head -n 1 || true)
if [ -z "$ZIP_FILE" ]; then
    echo "Zip file not found"
    exit 1
fi

unzip -p "$ZIP_FILE" DEFAULT_GROUP/common.yml > "${TMP_DIR}/common.yml"
unzip -p "$ZIP_FILE" DEFAULT_GROUP/luohuo-gateway-server.yml > "${TMP_DIR}/luohuo-gateway-server.yml"

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
    access-key: 'earthearth'
    secret-key: 'mq000000'
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

rm -rf "$TMP_DIR"
