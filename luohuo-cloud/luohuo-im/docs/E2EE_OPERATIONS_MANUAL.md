# HuLa E2EE 端到端加密 - 运维手册

## 📋 目录

- [系统概述](#系统概述)
- [部署指南](#部署指南)
- [日常运维](#日常运维)
- [监控告警](#监控告警)
- [故障处理](#故障处理)
- [性能调优](#性能调优)
- [安全加固](#安全加固)
- [备份恢复](#备份恢复)
- [常见问题](#常见问题)

---

## 系统概述

### 架构说明

HuLa E2EE是基于零信任架构的端到端加密系统，主要组件包括：

- **数据库层**: MySQL存储密钥和加密消息
- **缓存层**: Redis多级缓存（本地缓存 + Redis）
- **消息队列**: RocketMQ处理异步消息路由
- **应用层**: Spring Boot微服务
- **监控层**: Prometheus + Grafana

### 技术栈

- Spring Boot 3.x + Spring Cloud 2024
- MySQL 8.0+
- Redis 6.0+
- RocketMQ 4.9+
- Prometheus + Grafana

### 系统要求

**最低配置**:
- CPU: 4核
- 内存: 8GB
- 磁盘: 100GB SSD
- 网络: 100Mbps

**推荐配置**:
- CPU: 8核
- 内存: 16GB
- 磁盘: 500GB SSD
- 网络: 1Gbps

---

## 部署指南

### 1. 环境准备

#### 1.1 安装MySQL

```bash
# 安装MySQL 8.0
sudo apt-get install mysql-server-8.0

# 创建数据库
mysql -u root -p
CREATE DATABASE hula_im CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'hula'@'%' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON hula_im.* TO 'hula'@'%';
FLUSH PRIVILEGES;
```

#### 1.2 安装Redis

```bash
# 安装Redis 6.0+
sudo apt-get install redis-server

# 配置Redis
sudo vi /etc/redis/redis.conf
# 设置以下配置:
# maxmemory 4gb
# maxmemory-policy allkeys-lru
# save 900 1
# save 300 10
# save 60 10000

# 重启Redis
sudo systemctl restart redis
```

#### 1.3 安装RocketMQ

```bash
# 下载RocketMQ
wget https://archive.apache.org/dist/rocketmq/4.9.4/rocketmq-all-4.9.4-bin-release.zip
unzip rocketmq-all-4.9.4-bin-release.zip
cd rocketmq-4.9.4

# 启动NameServer
nohup sh bin/mqnamesrv &

# 启动Broker
nohup sh bin/mqbroker -n localhost:9876 &

# 验证
sh bin/mqadmin clusterList -n localhost:9876
```

### 2. 数据库初始化

#### 2.1 执行迁移脚本

```bash
# 进入项目目录
cd /path/to/HuLa-Server-master/luohuo-cloud/luohuo-im

# 执行SQL脚本
mysql -u hula -p hula_im < sql/e2ee_migration.sql

# 验证表创建
mysql -u hula -p hula_im -e "SHOW TABLES LIKE 'im_%';"
```

#### 2.2 验证表结构

```sql
-- 验证关键表
DESC im_user_public_keys;
DESC im_session_key_packages;
DESC im_message_encrypted;
DESC im_key_backup;
DESC im_key_recovery_request;

-- 检查索引
SHOW INDEX FROM im_user_public_keys;
SHOW INDEX FROM im_message_encrypted;
```

### 3. 应用配置

#### 3.1 application.yml配置

```yaml
spring:
  datasource:
    url: jdbc:mysql://localhost:3306/hula_im?useSSL=false&serverTimezone=Asia/Shanghai
    username: hula
    password: your_password
    driver-class-name: com.mysql.cj.jdbc.Driver

  redis:
    host: localhost
    port: 6379
    password: your_redis_password
    database: 0
    lettuce:
      pool:
        max-active: 20
        max-idle: 10
        min-idle: 5

rocketmq:
  name-server: localhost:9876
  producer:
    group: e2ee-producer-group
    send-message-timeout: 3000
```

#### 3.2 application-e2ee.yml配置

```yaml
e2ee:
  enabled: true
  encryption:
    default-algorithm: AES-GCM
    aes-key-size: 256
    rsa-key-size: 2048
  cache:
    enabled: true
    public-key-ttl: 30d
  performance:
    batch-query-max-size: 100
    metrics-enabled: true
  audit:
    enabled: true
    retention-days: 90
```

### 4. 启动应用

#### 4.1 构建应用

```bash
# 进入项目根目录
cd /path/to/HuLa-Server-master

# 编译打包
mvn clean package -DskipTests

# 检查生成的jar包
ls -lh luohuo-cloud/luohuo-im/luohuo-im-biz/target/*.jar
```

#### 4.2 启动服务

```bash
# 创建运行脚本
cat > start-e2ee.sh << 'EOF'
#!/bin/bash
JAVA_OPTS="-Xms2g -Xmx4g -XX:+UseG1GC -XX:MaxGCPauseMillis=200"
APP_OPTS="--spring.profiles.active=prod,e2ee"
LOG_DIR="/var/log/hula"

nohup java $JAVA_OPTS -jar luohuo-im-biz.jar $APP_OPTS \
  > $LOG_DIR/e2ee.log 2>&1 &

echo $! > /var/run/hula-e2ee.pid
echo "E2EE service started, PID: $(cat /var/run/hula-e2ee.pid)"
EOF

chmod +x start-e2ee.sh
./start-e2ee.sh
```

#### 4.3 验证启动

```bash
# 检查进程
ps aux | grep luohuo-im-biz

# 检查日志
tail -f /var/log/hula/e2ee.log

# 健康检查
curl http://localhost:8080/e2ee/health
```

---

## 日常运维

### 1. 服务管理

#### 1.1 启动服务

```bash
./start-e2ee.sh
```

#### 1.2 停止服务

```bash
# 优雅停止
kill -15 $(cat /var/run/hula-e2ee.pid)

# 强制停止（仅在必要时使用）
kill -9 $(cat /var/run/hula-e2ee.pid)
```

#### 1.3 重启服务

```bash
# 创建重启脚本
cat > restart-e2ee.sh << 'EOF'
#!/bin/bash
echo "Stopping E2EE service..."
kill -15 $(cat /var/run/hula-e2ee.pid)
sleep 5

echo "Starting E2EE service..."
./start-e2ee.sh
EOF

chmod +x restart-e2ee.sh
./restart-e2ee.sh
```

### 2. 日志管理

#### 2.1 查看实时日志

```bash
# 查看应用日志
tail -f /var/log/hula/e2ee.log

# 查看错误日志
tail -f /var/log/hula/e2ee.log | grep ERROR

# 查看审计日志（Redis）
redis-cli LRANGE e2ee:audit:$(date +%Y-%m-%d) 0 -1
```

#### 2.2 日志轮转配置

```bash
# 创建logrotate配置
sudo vi /etc/logrotate.d/hula-e2ee

# 添加以下内容:
/var/log/hula/e2ee.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 644 hula hula
    sharedscripts
    postrotate
        kill -USR1 $(cat /var/run/hula-e2ee.pid)
    endscript
}
```

### 3. 定时任务监控

#### 3.1 检查定时任务状态

```bash
# 查看定时任务日志
grep "E2EEScheduledTasks" /var/log/hula/e2ee.log | tail -50

# 检查最近的清理操作
grep "cleanup" /var/log/hula/e2ee.log | tail -20
```

#### 3.2 手动触发定时任务

```bash
# 手动清理过期密钥
curl -X POST http://localhost:8080/e2ee/admin/maintenance/cleanup

# 手动生成每日报告
curl -X POST http://localhost:8080/e2ee/admin/reports/daily
```

### 4. 缓存管理

#### 4.1 查看缓存状态

```bash
# 连接Redis
redis-cli

# 查看E2EE相关的key数量
KEYS e2ee:*

# 查看公钥缓存
KEYS e2ee:public-key:*

# 查看会话密钥缓存
KEYS e2ee:session-key:*
```

#### 4.2 清理缓存

```bash
# 清理所有E2EE缓存（谨慎操作）
redis-cli --scan --pattern 'e2ee:*' | xargs redis-cli DEL

# 清理特定用户缓存
redis-cli DEL "e2ee:public-key:user:10001"

# 预热缓存（通过API）
curl -X POST http://localhost:8080/e2ee/admin/cache/warmup
```

### 5. 数据库维护

#### 5.1 查询统计信息

```sql
-- 查看各表数据量
SELECT
    'im_user_public_keys' as table_name,
    COUNT(*) as row_count
FROM im_user_public_keys
UNION ALL
SELECT
    'im_message_encrypted',
    COUNT(*)
FROM im_message_encrypted
UNION ALL
SELECT
    'im_session_key_packages',
    COUNT(*)
FROM im_session_key_packages;

-- 查看活跃公钥数量
SELECT COUNT(*) FROM im_user_public_keys WHERE is_valid = 1;

-- 查看今日加密消息数量
SELECT COUNT(*) FROM im_message_encrypted
WHERE DATE(create_time) = CURDATE();
```

#### 5.2 优化表性能

```sql
-- 分析表
ANALYZE TABLE im_user_public_keys;
ANALYZE TABLE im_message_encrypted;
ANALYZE TABLE im_session_key_packages;

-- 优化表
OPTIMIZE TABLE im_user_public_keys;
OPTIMIZE TABLE im_message_encrypted;
```

#### 5.3 清理历史数据

```sql
-- 清理90天前的审计日志
-- 注意：审计日志存储在Redis，使用定时任务自动清理

-- 清理过期的密钥包（已由定时任务处理）
DELETE FROM im_session_key_packages
WHERE status = 'EXPIRED'
AND create_time < DATE_SUB(NOW(), INTERVAL 30 DAY);
```

---

## 监控告警

### 1. Prometheus配置

#### 1.1 安装Prometheus

```bash
# 下载Prometheus
wget https://github.com/prometheus/prometheus/releases/download/v2.45.0/prometheus-2.45.0.linux-amd64.tar.gz
tar xvfz prometheus-2.45.0.linux-amd64.tar.gz
cd prometheus-2.45.0.linux-amd64

# 配置prometheus.yml
cat > prometheus.yml << 'EOF'
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'hula-e2ee'
    static_configs:
      - targets: ['localhost:8080']
    metrics_path: '/actuator/prometheus'
EOF

# 启动Prometheus
nohup ./prometheus --config.file=prometheus.yml &
```

#### 1.2 访问Prometheus

访问 `http://localhost:9090` 查看Prometheus控制台

### 2. 关键指标监控

#### 2.1 性能指标

```promql
# 平均加密延迟
rate(e2ee_encryption_time_seconds_sum[5m]) / rate(e2ee_encryption_time_seconds_count[5m])

# 平均解密延迟
rate(e2ee_decryption_time_seconds_sum[5m]) / rate(e2ee_decryption_time_seconds_count[5m])

# 每秒加密消息数
rate(e2ee_messages_encrypted_total[1m])

# 缓存命中率
rate(e2ee_cache_hit_total[5m]) / (rate(e2ee_cache_hit_total[5m]) + rate(e2ee_cache_miss_total[5m]))
```

#### 2.2 错误监控

```promql
# 错误率
rate(e2ee_errors_total[5m])

# 按类型分组的错误
sum by (error_type) (rate(e2ee_errors_total[5m]))

# 清理操作失败次数
e2ee_cleanup_failures_total
```

### 3. Grafana仪表盘

#### 3.1 安装Grafana

```bash
# 安装Grafana
sudo apt-get install -y software-properties-common
sudo add-apt-repository "deb https://packages.grafana.com/oss/deb stable main"
wget -q -O - https://packages.grafana.com/gpg.key | sudo apt-key add -
sudo apt-get update
sudo apt-get install grafana

# 启动Grafana
sudo systemctl start grafana-server
sudo systemctl enable grafana-server
```

#### 3.2 配置数据源

1. 访问 `http://localhost:3000` (默认账号: admin/admin)
2. 添加Prometheus数据源：Configuration → Data Sources → Add data source
3. 选择Prometheus，URL填写 `http://localhost:9090`

#### 3.3 导入仪表盘

创建以下面板：

**面板1: 加密性能监控**
- 加密延迟趋势图
- 解密延迟趋势图
- 每分钟加密消息数

**面板2: 缓存性能**
- 缓存命中率百分比
- 缓存未命中率
- 缓存大小趋势

**面板3: 错误监控**
- 错误率折线图
- 错误类型分布饼图
- 最近错误列表

**面板4: 系统健康**
- 活跃用户数
- 活跃会话数
- 服务状态指示器

### 4. 告警配置

#### 4.1 Prometheus告警规则

```yaml
# 创建alerts.yml
groups:
  - name: e2ee_alerts
    interval: 30s
    rules:
      # 加密延迟告警
      - alert: HighEncryptionLatency
        expr: rate(e2ee_encryption_time_seconds_sum[5m]) / rate(e2ee_encryption_time_seconds_count[5m]) > 0.2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "E2EE加密延迟过高"
          description: "平均加密延迟超过200ms，当前值: {{ $value }}s"

      # 错误率告警
      - alert: HighErrorRate
        expr: rate(e2ee_errors_total[5m]) > 0.05
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "E2EE错误率过高"
          description: "错误率超过5%，当前值: {{ $value }}"

      # 缓存命中率告警
      - alert: LowCacheHitRate
        expr: rate(e2ee_cache_hit_total[5m]) / (rate(e2ee_cache_hit_total[5m]) + rate(e2ee_cache_miss_total[5m])) < 0.8
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "E2EE缓存命中率过低"
          description: "缓存命中率低于80%，当前值: {{ $value }}"

      # 服务不可用告警
      - alert: E2EEServiceDown
        expr: up{job="hula-e2ee"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "E2EE服务不可用"
          description: "E2EE服务已停止响应"
```

#### 4.2 配置AlertManager

```yaml
# 创建alertmanager.yml
global:
  resolve_timeout: 5m
  smtp_smarthost: 'smtp.example.com:587'
  smtp_from: 'alert@hula.com'
  smtp_auth_username: 'alert@hula.com'
  smtp_auth_password: 'your_password'

route:
  group_by: ['alertname']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 1h
  receiver: 'email-notifications'

receivers:
  - name: 'email-notifications'
    email_configs:
      - to: 'ops@hula.com'
        headers:
          Subject: 'HuLa E2EE Alert: {{ .GroupLabels.alertname }}'
```

---

## 故障处理

### 1. 常见故障场景

#### 1.1 服务无法启动

**症状**: 应用启动失败，日志中出现错误

**排查步骤**:
```bash
# 1. 检查端口占用
netstat -tulpn | grep 8080

# 2. 检查数据库连接
mysql -u hula -p -h localhost hula_im -e "SELECT 1"

# 3. 检查Redis连接
redis-cli ping

# 4. 检查RocketMQ连接
telnet localhost 9876

# 5. 查看详细错误日志
tail -n 100 /var/log/hula/e2ee.log
```

**解决方案**:
- 确保MySQL、Redis、RocketMQ服务正常运行
- 检查配置文件中的连接参数
- 确保有足够的系统资源（内存、磁盘）

#### 1.2 加密延迟过高

**症状**: Grafana显示加密延迟超过200ms

**排查步骤**:
```bash
# 1. 检查CPU使用率
top -p $(cat /var/run/hula-e2ee.pid)

# 2. 检查数据库慢查询
mysql -u hula -p -e "SHOW FULL PROCESSLIST;"

# 3. 检查Redis响应时间
redis-cli --latency

# 4. 检查JVM GC情况
jstat -gcutil $(cat /var/run/hula-e2ee.pid) 1000 10
```

**解决方案**:
- 增加JVM堆内存: `-Xms4g -Xmx8g`
- 优化数据库索引
- 扩容Redis内存
- 启用缓存预热

#### 1.3 消息发送失败

**症状**: 加密消息无法发送

**排查步骤**:
```bash
# 1. 检查RocketMQ状态
sh bin/mqadmin clusterList -n localhost:9876

# 2. 查看消费组状态
sh bin/mqadmin consumerProgress -n localhost:9876 -g e2ee-producer-group

# 3. 检查Topic状态
sh bin/mqadmin topicStatus -n localhost:9876 -t chat_private_encrypted_send

# 4. 查看应用日志
grep "E2EEMsgSendConsumer" /var/log/hula/e2ee.log | tail -50
```

**解决方案**:
- 重启RocketMQ Broker
- 清理消息积压
- 增加消费者线程数

#### 1.4 缓存命中率低

**症状**: 缓存命中率低于80%

**排查步骤**:
```bash
# 1. 查看Redis内存使用
redis-cli INFO memory

# 2. 查看缓存key数量
redis-cli DBSIZE

# 3. 查看缓存过期情况
redis-cli --scan --pattern 'e2ee:*' | wc -l

# 4. 检查缓存配置
grep "cache" application-e2ee.yml
```

**解决方案**:
- 增加Redis内存
- 调整缓存TTL: `public-key-ttl: 7d`
- 启用缓存预热
- 优化缓存预热策略

### 2. 数据恢复

#### 2.1 数据库恢复

```bash
# 从备份恢复
mysql -u hula -p hula_im < /backup/hula_im_backup_2025-01-01.sql

# 验证数据
mysql -u hula -p hula_im -e "SELECT COUNT(*) FROM im_user_public_keys"
```

#### 2.2 Redis恢复

```bash
# 从RDB文件恢复
sudo cp /backup/dump.rdb /var/lib/redis/
sudo chown redis:redis /var/lib/redis/dump.rdb
sudo systemctl restart redis

# 验证数据
redis-cli KEYS e2ee:* | wc -l
```

---

## 性能调优

### 1. JVM调优

#### 1.1 推荐JVM参数

```bash
JAVA_OPTS="
  -Xms4g
  -Xmx8g
  -XX:+UseG1GC
  -XX:MaxGCPauseMillis=200
  -XX:InitiatingHeapOccupancyPercent=45
  -XX:G1ReservePercent=10
  -XX:+ParallelRefProcEnabled
  -XX:+HeapDumpOnOutOfMemoryError
  -XX:HeapDumpPath=/var/log/hula/heap_dump.hprof
  -verbose:gc
  -XX:+PrintGCDetails
  -XX:+PrintGCDateStamps
  -Xloggc:/var/log/hula/gc.log
"
```

#### 1.2 GC日志分析

```bash
# 安装GCViewer
wget https://github.com/chewiebug/GCViewer/releases/download/1.36/gcviewer-1.36.jar

# 分析GC日志
java -jar gcviewer-1.36.jar /var/log/hula/gc.log
```

### 2. 数据库调优

#### 2.1 索引优化

```sql
-- 检查索引使用情况
SELECT
    TABLE_NAME,
    INDEX_NAME,
    SEQ_IN_INDEX,
    COLUMN_NAME,
    CARDINALITY
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = 'hula_im'
AND TABLE_NAME LIKE 'im_%'
ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX;

-- 分析慢查询
SELECT
    query_time,
    lock_time,
    rows_examined,
    sql_text
FROM mysql.slow_log
WHERE sql_text LIKE '%im_%'
ORDER BY query_time DESC
LIMIT 20;
```

#### 2.2 连接池优化

```yaml
spring:
  datasource:
    hikari:
      minimum-idle: 10
      maximum-pool-size: 50
      connection-timeout: 30000
      idle-timeout: 600000
      max-lifetime: 1800000
      connection-test-query: SELECT 1
```

### 3. Redis调优

#### 3.1 内存优化

```bash
# 配置Redis最大内存
redis-cli CONFIG SET maxmemory 8gb
redis-cli CONFIG SET maxmemory-policy allkeys-lru

# 启用持久化
redis-cli CONFIG SET save "900 1 300 10 60 10000"
redis-cli CONFIG SET appendonly yes
```

#### 3.2 连接池优化

```yaml
spring:
  redis:
    lettuce:
      pool:
        max-active: 20
        max-idle: 10
        min-idle: 5
        max-wait: 1000ms
      shutdown-timeout: 100ms
```

### 4. 应用层调优

#### 4.1 线程池配置

```yaml
e2ee:
  thread-pool:
    # 通用异步任务线程池
    task-executor:
      core-pool-size: 10
      max-pool-size: 30
      queue-capacity: 1000
    # 缓存预热线程池
    cache-warmup:
      core-pool-size: 5
      max-pool-size: 15
    # 审计日志线程池
    audit-log:
      core-pool-size: 5
      max-pool-size: 15
```

#### 4.2 批量操作优化

```yaml
e2ee:
  performance:
    # 增加批量查询大小
    batch-query-max-size: 200
    # 降低异步处理阈值
    async-process-threshold: 5
```

---

## 安全加固

### 1. 访问控制

#### 1.1 启用IP白名单

```yaml
e2ee:
  security:
    # IP白名单
    ip-whitelist:
      - 192.168.1.0/24
      - 10.0.0.0/8
    # 管理接口IP限制
    admin-ip-whitelist:
      - 192.168.1.100
      - 10.0.1.50
```

#### 1.2 API访问频率限制

```yaml
e2ee:
  security:
    # 限流配置
    rate-limit:
      # 每分钟最大请求数
      requests-per-minute: 100
      # 每小时最大请求数
      requests-per-hour: 5000
```

### 2. 密钥安全

#### 2.1 强制密钥轮换

```yaml
e2ee:
  key-management:
    # 启用自动密钥轮换
    auto-rotation: true
    # 密钥轮换周期（60天）
    key-rotation-days: 60
    # 强制轮换阈值（90天）
    force-rotation-days: 90
```

#### 2.2 密钥恢复审批

```yaml
e2ee:
  security:
    # 启用多因素认证
    require-mfa-for-recovery: true
    # 密钥恢复需要审批
    recovery-require-approval: true
    # 审批超时时间（24小时）
    recovery-approval-timeout-hours: 24
```

### 3. 审计加强

#### 3.1 详细审计日志

```yaml
e2ee:
  audit:
    # 启用详细日志
    detailed-logging: true
    # 记录IP和UserAgent
    log-request-info: true
    # 审计所有操作
    audit-actions:
      - KEY_UPLOAD
      - KEY_ROTATION
      - KEY_REVOKE
      - MESSAGE_ENCRYPT
      - MESSAGE_DECRYPT
      - RECOVERY_REQUEST
      - RECOVERY_APPROVE
      - ADMIN_ACTION
```

#### 3.2 审计日志备份

```bash
# 每日备份审计日志
cat > /etc/cron.daily/backup-e2ee-audit << 'EOF'
#!/bin/bash
DATE=$(date +%Y-%m-%d)
redis-cli --scan --pattern "e2ee:audit:*" | \
  xargs redis-cli DUMP > /backup/e2ee_audit_$DATE.rdb
EOF

chmod +x /etc/cron.daily/backup-e2ee-audit
```

### 4. 网络安全

#### 4.1 启用HTTPS

```yaml
server:
  port: 8443
  ssl:
    enabled: true
    key-store: classpath:keystore.p12
    key-store-password: your_password
    key-store-type: PKCS12
    key-alias: hula
```

#### 4.2 防火墙配置

```bash
# 只允许特定IP访问
sudo ufw allow from 192.168.1.0/24 to any port 8443
sudo ufw allow from 10.0.0.0/8 to any port 8443
sudo ufw deny 8443
```

---

## 备份恢复

### 1. 数据库备份

#### 1.1 自动备份脚本

```bash
cat > /usr/local/bin/backup-e2ee-db.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/backup/mysql"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="hula_im"

# 创建备份目录
mkdir -p $BACKUP_DIR

# 备份数据库
mysqldump -u hula -p'your_password' \
  --single-transaction \
  --quick \
  --lock-tables=false \
  $DB_NAME > $BACKUP_DIR/hula_im_$DATE.sql

# 压缩备份
gzip $BACKUP_DIR/hula_im_$DATE.sql

# 删除30天前的备份
find $BACKUP_DIR -name "hula_im_*.sql.gz" -mtime +30 -delete

echo "Database backup completed: $BACKUP_DIR/hula_im_$DATE.sql.gz"
EOF

chmod +x /usr/local/bin/backup-e2ee-db.sh
```

#### 1.2 定时备份

```bash
# 配置cron任务（每天凌晨1点备份）
crontab -e
0 1 * * * /usr/local/bin/backup-e2ee-db.sh >> /var/log/backup.log 2>&1
```

### 2. Redis备份

#### 2.1 RDB备份

```bash
# 手动触发RDB备份
redis-cli BGSAVE

# 检查备份状态
redis-cli LASTSAVE

# 复制RDB文件
cp /var/lib/redis/dump.rdb /backup/redis/dump_$(date +%Y%m%d).rdb
```

#### 2.2 AOF备份

```bash
# 启用AOF
redis-cli CONFIG SET appendonly yes

# 重写AOF
redis-cli BGREWRITEAOF

# 备份AOF文件
cp /var/lib/redis/appendonly.aof /backup/redis/appendonly_$(date +%Y%m%d).aof
```

### 3. 配置文件备份

```bash
cat > /usr/local/bin/backup-e2ee-config.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/backup/config"
DATE=$(date +%Y%m%d)
APP_DIR="/path/to/HuLa-Server-master"

mkdir -p $BACKUP_DIR/$DATE

# 备份配置文件
cp $APP_DIR/luohuo-cloud/luohuo-im/luohuo-im-biz/src/main/resources/application*.yml \
   $BACKUP_DIR/$DATE/

# 打包备份
tar -czf $BACKUP_DIR/config_$DATE.tar.gz -C $BACKUP_DIR $DATE

# 删除临时目录
rm -rf $BACKUP_DIR/$DATE

echo "Config backup completed: $BACKUP_DIR/config_$DATE.tar.gz"
EOF

chmod +x /usr/local/bin/backup-e2ee-config.sh
```

### 4. 完整恢复流程

#### 4.1 数据库恢复

```bash
# 停止应用
./stop-e2ee.sh

# 恢复数据库
gunzip < /backup/mysql/hula_im_20250101_010000.sql.gz | \
  mysql -u hula -p hula_im

# 验证恢复
mysql -u hula -p hula_im -e "SELECT COUNT(*) FROM im_user_public_keys"
```

#### 4.2 Redis恢复

```bash
# 停止Redis
sudo systemctl stop redis

# 恢复RDB文件
sudo cp /backup/redis/dump_20250101.rdb /var/lib/redis/dump.rdb
sudo chown redis:redis /var/lib/redis/dump.rdb

# 启动Redis
sudo systemctl start redis

# 验证恢复
redis-cli KEYS e2ee:* | wc -l
```

#### 4.3 启动应用

```bash
# 启动应用
./start-e2ee.sh

# 验证服务
curl http://localhost:8080/e2ee/health
```

---

## 常见问题

### Q1: 如何查看E2EE功能是否正常运行？

**答**: 执行以下健康检查：

```bash
# 1. 服务健康检查
curl http://localhost:8080/e2ee/health

# 2. 检查定时任务日志
grep "E2EEScheduledTasks" /var/log/hula/e2ee.log | tail -10

# 3. 检查性能指标
curl http://localhost:8080/actuator/metrics/e2ee.encryption.time
```

### Q2: 如何排查加密消息发送失败？

**答**: 按以下步骤排查：

```bash
# 1. 检查应用日志
grep "ERROR" /var/log/hula/e2ee.log | tail -20

# 2. 检查RocketMQ状态
sh bin/mqadmin clusterList -n localhost:9876

# 3. 检查数据库连接
mysql -u hula -p hula_im -e "SELECT 1"

# 4. 检查用户公钥是否存在
curl http://localhost:8080/e2ee/keys/{userId}
```

### Q3: 缓存命中率低怎么办？

**答**: 执行以下优化步骤：

```yaml
# 1. 增加缓存TTL
e2ee:
  cache:
    public-key-ttl: 60d
    session-key-ttl: 48h

# 2. 启用缓存预热
e2ee:
  cache:
    warmup-enabled: true
    warmup-hot-user-count: 200

# 3. 增加Redis内存
redis-cli CONFIG SET maxmemory 16gb
```

### Q4: 如何处理密钥过期问题？

**答**: 系统会自动清理过期密钥，也可手动处理：

```bash
# 查看过期密钥数量
mysql -u hula -p hula_im -e "
  SELECT COUNT(*) FROM im_user_public_keys
  WHERE expires_at < NOW()"

# 手动清理过期密钥（由定时任务处理）
curl -X POST http://localhost:8080/e2ee/admin/maintenance/cleanup
```

### Q5: 如何监控E2EE性能？

**答**: 使用Prometheus + Grafana：

```bash
# 1. 访问Prometheus
http://localhost:9090

# 2. 查询关键指标
rate(e2ee_encryption_time_seconds_sum[5m]) / rate(e2ee_encryption_time_seconds_count[5m])

# 3. 访问Grafana仪表盘
http://localhost:3000
```

### Q6: 如何进行灰度发布？

**答**: 使用管理接口控制灰度：

```bash
# 1. 设置灰度百分比（10%）
curl -X POST 'http://localhost:8080/e2ee/admin/feature-toggle/rollout?percentage=10'

# 2. 添加白名单用户
curl -X POST http://localhost:8080/e2ee/admin/feature-toggle/whitelist/10001

# 3. 检查用户E2EE状态
curl http://localhost:8080/e2ee/admin/feature-toggle/check/10001

# 4. 逐步增加百分比
curl -X POST 'http://localhost:8080/e2ee/admin/feature-toggle/rollout?percentage=50'
```

### Q7: 如何备份和恢复E2EE数据？

**答**: 使用自动备份脚本：

```bash
# 1. 执行数据库备份
/usr/local/bin/backup-e2ee-db.sh

# 2. 备份Redis数据
redis-cli BGSAVE
cp /var/lib/redis/dump.rdb /backup/redis/

# 3. 恢复数据库
gunzip < /backup/mysql/hula_im_backup.sql.gz | mysql -u hula -p hula_im

# 4. 恢复Redis
sudo cp /backup/redis/dump.rdb /var/lib/redis/
sudo systemctl restart redis
```

---

## 附录

### A. 运维检查清单

**每日检查**:
- [ ] 检查服务运行状态
- [ ] 查看错误日志
- [ ] 检查性能指标
- [ ] 验证定时任务执行

**每周检查**:
- [ ] 分析慢查询日志
- [ ] 检查磁盘使用率
- [ ] 优化数据库表
- [ ] 清理临时文件

**每月检查**:
- [ ] 审查审计日志
- [ ] 数据库备份测试
- [ ] 性能压测
- [ ] 安全漏洞扫描

### B. 紧急联系方式

- 运维团队: ops@hula.com
- 开发团队: dev@hula.com
- 安全团队: security@hula.com
- 7x24小时热线: 400-xxx-xxxx

### C. 参考文档

- [E2EE API使用指南](./E2EE_API_GUIDE.md)
- [E2EE开发完成报告](./E2EE_README.md)
- [私密聊天后端开发方案](../../../docs/私密聊天后端开发方案.md)

---

**文档版本**: v1.0.0
**最后更新**: 2025-01-01
**维护团队**: HuLa DevOps Team
