#!/bin/bash

# HuLa-Server 数据备份脚本
# 使用方法: bash backup.sh
# 建议添加到crontab: 0 2 * * * /home/docker/backup.sh

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

# 配置
BACKUP_DIR="${BACKUP_DIR:-/home/backup/hula}"
DATE=$(date +%Y%m%d_%H%M%S)
MYSQL_USER="root"
MYSQL_PASSWORD="${MYSQL_ROOT_PASSWORD:-123456}"
REDIS_PWD="${REDIS_PASSWORD:-luo123456}"
RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-7}

# 颜色
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  HuLa-Server 数据备份${NC}"
echo -e "${GREEN}  时间: $(date)${NC}"
echo -e "${GREEN}========================================${NC}"

init_docker_cmd

# 创建备份目录
mkdir -p $BACKUP_DIR/mysql
mkdir -p $BACKUP_DIR/redis
mkdir -p $BACKUP_DIR/nacos

# 备份MySQL
echo -e "${YELLOW}[1/4] 备份MySQL数据库...${NC}"
${DOCKER} exec mysql mysqldump -u$MYSQL_USER -p$MYSQL_PASSWORD \
    --databases nacos luohuo_dev luohuo_im_01 \
    --single-transaction \
    --quick \
    --lock-tables=false \
    > $BACKUP_DIR/mysql/hula_mysql_$DATE.sql

gzip $BACKUP_DIR/mysql/hula_mysql_$DATE.sql
echo -e "${GREEN}✓ MySQL备份完成: hula_mysql_$DATE.sql.gz${NC}"

# 备份Redis
echo -e "${YELLOW}[2/4] 备份Redis数据...${NC}"
${DOCKER} exec redis redis-cli -a "$REDIS_PWD" BGSAVE 2>/dev/null
sleep 5
${DOCKER} cp redis:/data/dump.rdb $BACKUP_DIR/redis/dump_$DATE.rdb
gzip $BACKUP_DIR/redis/dump_$DATE.rdb
echo -e "${GREEN}✓ Redis备份完成: dump_$DATE.rdb.gz${NC}"

# 备份Nacos配置
echo -e "${YELLOW}[3/4] 备份Nacos配置...${NC}"
curl -s "http://localhost:8848/nacos/v1/cs/configs?export=true&group=DEFAULT_GROUP&tenant=" \
    -o $BACKUP_DIR/nacos/nacos_config_$DATE.zip
echo -e "${GREEN}✓ Nacos配置备份完成: nacos_config_$DATE.zip${NC}"

# 清理旧备份
echo -e "${YELLOW}[4/4] 清理旧备份 (保留${RETENTION_DAYS}天)...${NC}"
find $BACKUP_DIR -name "*.gz" -mtime +$RETENTION_DAYS -delete
find $BACKUP_DIR -name "*.zip" -mtime +$RETENTION_DAYS -delete
echo -e "${GREEN}✓ 旧备份清理完成${NC}"

# 显示备份结果
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  备份完成!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "备份文件:"
ls -lh $BACKUP_DIR/mysql/hula_mysql_$DATE.sql.gz
ls -lh $BACKUP_DIR/redis/dump_$DATE.rdb.gz
ls -lh $BACKUP_DIR/nacos/nacos_config_$DATE.zip
echo ""
echo "备份目录总大小:"
du -sh $BACKUP_DIR
