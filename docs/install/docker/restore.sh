#!/bin/bash

# HuLa-Server 数据恢复脚本
# 使用方法: bash restore.sh [backup_date]
# 示例: bash restore.sh 20251216_020000

set -e

# 加载环境变量
if [ -f ".env" ]; then
    source .env
fi

DOCKER="docker"

init_docker_cmd() {
    if docker ps >/dev/null 2>&1; then
        DOCKER="docker"
        return 0
    fi

    if sudo -n docker ps >/dev/null 2>&1; then
        DOCKER="sudo docker"
        return 0
    fi

    DOCKER="sudo docker"
}

# 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 配置
BACKUP_DIR="${BACKUP_DIR:-/home/backup/hula}"
MYSQL_USER="root"
MYSQL_PASSWORD="${MYSQL_ROOT_PASSWORD:-123456}"
REDIS_PWD="${REDIS_PASSWORD:-luo123456}"

# 参数检查
if [ -z "$1" ]; then
    echo -e "${YELLOW}可用的备份:${NC}"
    ls -la $BACKUP_DIR/mysql/*.sql.gz 2>/dev/null | awk '{print $NF}' | xargs -I {} basename {} .sql.gz | sed 's/hula_mysql_//'
    echo ""
    echo "使用方法: bash restore.sh [backup_date]"
    echo "示例: bash restore.sh 20251216_020000"
    exit 1
fi

BACKUP_DATE=$1

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  HuLa-Server 数据恢复${NC}"
echo -e "${GREEN}  备份日期: ${BACKUP_DATE}${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

init_docker_cmd

# 确认操作
echo -e "${RED}警告: 此操作将覆盖当前数据库数据!${NC}"
read -p "确认恢复? (yes/NO): " confirm
if [ "$confirm" != "yes" ]; then
    echo "取消操作"
    exit 0
fi

# 检查备份文件
MYSQL_BACKUP="$BACKUP_DIR/mysql/hula_mysql_$BACKUP_DATE.sql.gz"
REDIS_BACKUP="$BACKUP_DIR/redis/dump_$BACKUP_DATE.rdb.gz"

if [ ! -f "$MYSQL_BACKUP" ]; then
    echo -e "${RED}错误: MySQL备份文件不存在: $MYSQL_BACKUP${NC}"
    exit 1
fi

# 恢复MySQL
echo -e "${YELLOW}[1/3] 恢复MySQL数据库...${NC}"
gunzip -c $MYSQL_BACKUP | ${DOCKER} exec -i mysql mysql -u$MYSQL_USER -p$MYSQL_PASSWORD
echo -e "${GREEN}✓ MySQL恢复完成${NC}"

# 恢复Redis (如果存在)
if [ -f "$REDIS_BACKUP" ]; then
    echo -e "${YELLOW}[2/3] 恢复Redis数据...${NC}"
    
    # 停止Redis
    ${DOCKER} stop redis
    
    # 解压并复制备份
    gunzip -c $REDIS_BACKUP > /tmp/dump.rdb
    ${DOCKER} cp /tmp/dump.rdb redis:/data/dump.rdb
    rm /tmp/dump.rdb
    
    # 启动Redis
    ${DOCKER} start redis
    sleep 5
    
    echo -e "${GREEN}✓ Redis恢复完成${NC}"
else
    echo -e "${YELLOW}[2/3] 跳过Redis恢复 (备份文件不存在)${NC}"
fi

# 验证恢复
echo -e "${YELLOW}[3/3] 验证恢复...${NC}"

# 检查MySQL
TABLES=$(${DOCKER} exec mysql mysql -u$MYSQL_USER -p$MYSQL_PASSWORD -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema IN ('nacos', 'luohuo_dev', 'luohuo_im_01');" 2>/dev/null || echo "0")
echo "MySQL表数量: $TABLES"

# 检查Redis
KEYS=$(${DOCKER} exec redis redis-cli -a "$REDIS_PWD" DBSIZE 2>/dev/null | awk '{print $2}')
echo "Redis键数量: $KEYS"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  恢复完成!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}建议: 重启应用服务以确保数据一致性${NC}"
echo "bash all-stop.sh && bash all-start.sh"
