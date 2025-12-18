#!/bin/bash

# HuLa-Server Mac本地开发环境初始化脚本
# 使用方法: bash init-local.sh
# 此脚本会配置本地开发环境所需的所有文件

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  HuLa-Server Mac本地开发环境初始化${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# 获取本机IP
get_local_ip() {
    local ip=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "127.0.0.1")
    echo "$ip"
}

LOCAL_IP=$(get_local_ip)
echo -e "${BLUE}检测到本机IP: ${LOCAL_IP}${NC}"
echo ""

# 创建必要的目录
echo -e "${YELLOW}创建必要目录...${NC}"
mkdir -p mysql/data
mkdir -p redis/data
mkdir -p redis/logs
mkdir -p nacos/logs
mkdir -p nacos/data
mkdir -p rocketmq/namesrv/logs
mkdir -p rocketmq/namesrv/store
mkdir -p rocketmq/broker/logs
mkdir -p rocketmq/broker/store
mkdir -p rocketmq/broker/conf
mkdir -p rocketmq/timerwheel
mkdir -p minio/data
mkdir -p minio/config

# 创建 .env.local 文件
echo -e "${YELLOW}创建环境变量文件...${NC}"
cat > .env.local << EOF
# HuLa-Server Mac本地开发环境配置
# 生成时间: $(date)

# ==================== 基础配置 ====================
LOCAL_IP=${LOCAL_IP}
NACOS_VERSION=v3.0.2

# ==================== MySQL ====================
MYSQL_ROOT_PASSWORD=root123456
MYSQL_NACOS_PASSWORD=nacos123456

# ==================== Redis ====================
REDIS_PASSWORD=redis123456

# ==================== MinIO ====================
MINIO_ROOT_USER=admin
MINIO_ROOT_PASSWORD=minio123456

# ==================== Nacos Auth ====================
NACOS_AUTH_TOKEN=SecretKey012345678901234567890123456789012345678901234567890123456789
NACOS_AUTH_IDENTITY_VALUE=localdev

# ==================== RocketMQ ====================
ROCKETMQ_BROKER_IP=${LOCAL_IP}
EOF

# 创建本地Redis配置
echo -e "${YELLOW}创建Redis配置...${NC}"
cat > redis/redis-local.conf << EOF
# HuLa-Server Redis 本地开发配置

# 网络配置
bind 0.0.0.0
port 6379
protected-mode yes

# 认证配置
requirepass redis123456

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

# 内存配置 (本地开发降低内存使用)
maxmemory 512mb
maxmemory-policy allkeys-lru

# 日志配置
loglevel notice
logfile "/logs/redis.log"

# 连接配置
timeout 300
tcp-keepalive 300
maxclients 1000

# 性能优化
tcp-backlog 511
databases 16
EOF

# 创建本地RocketMQ Broker配置
echo -e "${YELLOW}创建RocketMQ Broker配置...${NC}"
cat > rocketmq/broker/conf/broker-local.conf << EOF
# HuLa-Server RocketMQ Broker 本地开发配置

brokerClusterName=DefaultCluster
brokerName=broker-a
brokerId=0
namesrvAddr=rocketmq-namesrv:9876

# 重要: 设置为本机IP
brokerIP1=${LOCAL_IP}

# Topic配置
defaultTopicQueueNums=4
autoCreateTopicEnable=true
enableAutoCreateSystemTopic=true
enableAutoCreateSubscriptionGroup=true
autoCreateSubscriptionGroup=true

# 端口配置
listenPort=10911

# 安全配置 (本地开发关闭ACL)
aclEnable=false

# 存储配置
deleteWhen=04
fileReservedTime=48
mappedFileSizeCommitLog=1073741824
mappedFileSizeConsumeQueue=300000
diskMaxUsedSpaceRatio=88

# 存储路径
storePathRootDir=/home/rocketmq/store
storePathCommitLog=/home/rocketmq/store/commitlog
storePathConsumeQueue=/home/rocketmq/store/consumequeue
storePathIndex=/home/rocketmq/store/index
storeCheckpoint=/home/rocketmq/store/checkpoint
abortFile=/home/rocketmq/store/abort

# 消息配置
maxMessageSize=65536

# 延迟消息配置
timerWheelEnable=true
enableScheduleMessage=true
messageDelayLevel=1s 3s 5s 10s 30s 1m 2m 3m 4m 5m 6m 7m 8m 9m 10m 20m 30m 1h 2h
timerStorePath=/home/rocketmq/timerwheel
timerFlushIntervalMs=1000
timerPrecisionMs=1000
scheduleMessageServiceThreadPoolNums=4

# 复制模式
brokerRole=ASYNC_MASTER
flushDiskType=ASYNC_FLUSH

# 内存配置 (本地开发降低)
maxDirectMemorySize=512m
EOF

# 创建plain_acl.yml (如果不存在)
if [ ! -f "rocketmq/broker/conf/plain_acl.yml" ]; then
    echo -e "${YELLOW}创建RocketMQ ACL配置...${NC}"
    cat > rocketmq/broker/conf/plain_acl.yml << EOF
# RocketMQ ACL配置 (本地开发禁用)
globalWhiteRemoteAddresses:
  - '*'

accounts:
  - accessKey: rocketmq
    secretKey: 12345678
    whiteRemoteAddress: '*'
    admin: true
    defaultTopicPerm: PUB|SUB
    defaultGroupPerm: PUB|SUB
EOF
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  初始化完成!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}本机IP: ${LOCAL_IP}${NC}"
echo ""
echo -e "${YELLOW}服务访问地址:${NC}"
echo "  Nacos:    http://localhost:8848/nacos  (nacos/nacos)"
echo "  MinIO:    http://localhost:9001        (admin/minio123456)"
echo "  MySQL:    localhost:13306              (root/root123456)"
echo "  Redis:    localhost:16379              (redis123456)"
echo "  RocketMQ: localhost:9876"
echo ""
echo -e "${YELLOW}启动命令:${NC}"
echo "  docker compose --env-file .env.local -f docker-compose.local.yml up -d"
echo ""
echo -e "${YELLOW}停止命令:${NC}"
echo "  docker compose -f docker-compose.local.yml down"
echo ""
echo -e "${YELLOW}查看日志:${NC}"
echo "  docker compose -f docker-compose.local.yml logs -f"
echo ""
