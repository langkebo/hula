# HuLa-Server 综合部署指南

**版本**: 3.0.7  
**更新日期**: 2025-12-20  
**适用系统**: Ubuntu 20.04+ / Debian 11+ / CentOS 7+  
**Java版本**: JDK 21  
**生产就绪度**: 9.5/10

---

## 📋 目录

1. [快速开始（5分钟）](#1-快速开始5分钟)
2. [详细部署步骤](#2-详细部署步骤)
3. [部署失败排查指南](#3-部署失败排查指南)
   - [3.1 网络连接问题](#31-网络连接问题)
   - [3.2 RocketMQ 启动失败](#32-rocketmq-启动失败)
   - [3.3 Nacos 配置问题](#33-nacos-配置问题)
   - [3.4 数据库连接问题](#34-数据库连接问题)
   - [3.5 健康检查失败](#35-健康检查失败)
   - [3.6 部署失败深度分析](#36-部署失败深度分析)
4. [生产环境配置](#4-生产环境配置)
5. [常见问题 FAQ](#5-常见问题-faq)
6. [附录](#6-附录)

---

## 1. 快速开始（5分钟）

### 1.1 环境要求

| 组件 | 最低版本 | 检查命令 |
|------|---------|---------|
| Docker | 20.10+ | `docker --version` |
| Docker Compose | 2.0+ | `docker compose version` |
| JDK | 21+ | `java -version` |
| Maven | 3.8+ | `mvn -version` |
| Git | 2.25+ | `git --version` |

**服务器配置要求**:
- **最小配置**: 4核 CPU / 8GB 内存 / 100GB SSD
- **推荐配置**: 8核 CPU / 16GB 内存 / 200GB SSD

### 1.2 一键部署命令

```bash
# 1. 克隆项目
git clone https://github.com/langkebo/hula.git
cd HuLa-Server

# 2. 进入 Docker 配置目录
cd docs/install/docker

# 3. 初始化密码（生产环境必须执行）
bash init-passwords.sh --ip $(hostname -I | awk '{print $1}')

# 4. 创建 RocketMQ 目录并设置权限（重要！）
sudo mkdir -p rocketmq/namesrv/store rocketmq/broker/store rocketmq/timerwheel
sudo chmod -R 777 rocketmq/

# 5. 启动基础设施
bash deploy.sh

# 6. 等待服务启动（约60秒）
sleep 60

# 7. 验证部署
bash health-check.sh
```

### 1.3 验证部署

```bash
# 检查基础设施
curl -sf http://localhost:8848/nacos/v1/console/health/readiness && echo "Nacos OK"
docker exec mysql mysqladmin ping -uroot -p$(grep MYSQL_ROOT_PASSWORD .env | cut -d= -f2) && echo "MySQL OK"

# 检查应用服务（编译启动后）
curl -sf http://localhost:18760/actuator/health && echo "Gateway OK"
curl -sf http://localhost:18761/actuator/health && echo "OAuth OK"
curl -sf http://localhost:18762/actuator/health && echo "IM OK"
curl -sf http://localhost:9501/actuator/health && echo "WS OK"
```

---

## 2. 详细部署步骤

### 2.1 环境准备

#### 2.1.1 系统更新与基础工具

```bash
# Ubuntu/Debian
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget git vim net-tools ufw unzip

# CentOS
sudo yum update -y
sudo yum install -y curl wget git vim net-tools firewalld unzip
```

#### 2.1.2 安装 Docker

```bash
# 卸载旧版本
sudo apt remove docker docker-engine docker.io containerd runc 2>/dev/null

# 安装 Docker（使用阿里云镜像加速）
curl -fsSL https://get.docker.com | bash -s docker --mirror Aliyun

# 启动并设置开机自启
sudo systemctl start docker
sudo systemctl enable docker

# 配置非 Root 用户权限（需要重新登录生效）
sudo usermod -aG docker $USER
newgrp docker

# 验证安装
docker --version
docker compose version
```

#### 2.1.3 安装 JDK 21

```bash
# Ubuntu/Debian
sudo apt install -y openjdk-21-jdk

# 或手动安装
wget https://download.oracle.com/java/21/latest/jdk-21_linux-x64_bin.tar.gz
sudo tar -xzf jdk-21_linux-x64_bin.tar.gz -C /opt
echo 'export JAVA_HOME=/opt/jdk-21' >> ~/.bashrc
echo 'export PATH=$JAVA_HOME/bin:$PATH' >> ~/.bashrc
source ~/.bashrc

# 验证
java -version
```

#### 2.1.4 安装 Maven

```bash
wget https://dlcdn.apache.org/maven/maven-3/3.9.6/binaries/apache-maven-3.9.6-bin.tar.gz
sudo tar -xzf apache-maven-3.9.6-bin.tar.gz -C /opt
echo 'export MAVEN_HOME=/opt/apache-maven-3.9.6' >> ~/.bashrc
echo 'export PATH=$MAVEN_HOME/bin:$PATH' >> ~/.bashrc
source ~/.bashrc

# 验证
mvn -version
```

### 2.2 基础设施部署

#### 2.2.1 获取代码

```bash
mkdir -p ~/projects
cd ~/projects
git clone https://github.com/langkebo/hula.git 
cd HuLa-Server
```

#### 2.2.2 初始化配置

```bash
cd docs/install/docker

# 生成随机强密码和 .env 配置文件
# --ip 参数指定服务器 IP（用于 RocketMQ 和 SRS）
bash init-passwords.sh --ip $(hostname -I | awk '{print $1}')

# 检查生成的配置
cat .env
```

**重要配置项说明**:

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| `MYSQL_ROOT_PASSWORD` | MySQL root 密码 | 自动生成 |
| `REDIS_PASSWORD` | Redis 密码 | 自动生成 |
| `NACOS_AUTH_TOKEN` | Nacos 认证令牌 | 自动生成 |
| `ROCKETMQ_BROKER_IP` | RocketMQ Broker IP | 服务器 IP |
| `SRS_CANDIDATE` | SRS 候选 IP | 服务器 IP |
| `PII_ENCRYPTION_KEY` | PII 加密密钥 | 自动生成 |

#### 2.2.3 创建必要目录

```bash
# RocketMQ 目录（必须！否则启动失败）
sudo mkdir -p rocketmq/namesrv/store rocketmq/broker/store rocketmq/timerwheel
sudo chmod -R 777 rocketmq/

# Nacos 目录
sudo mkdir -p nacos/data nacos/logs
sudo chmod -R 777 nacos/
```

#### 2.2.4 启动基础设施

```bash
# 开发环境
docker compose up -d

# 生产环境（推荐）
docker compose -f docker-compose.prod.yml up -d

# 或使用一键部署脚本
bash deploy.sh        # 开发环境
bash deploy.sh prod   # 生产环境
```

#### 2.2.5 验证基础设施

```bash
# 查看容器状态
docker compose ps

# 运行健康检查
bash health-check.sh
```

### 2.3 数据库初始化

数据库初始化通常由 `deploy.sh` 脚本自动完成。如需手动执行：

```bash
# 导入 Nacos 数据库
docker exec -i mysql mysql -uroot -p$(grep MYSQL_ROOT_PASSWORD .env | cut -d= -f2) < ../mysql-schema.sql

# 导入业务数据库
docker exec -i mysql mysql -uroot -p$(grep MYSQL_ROOT_PASSWORD .env | cut -d= -f2) < ../sql/luohuo_dev.sql
docker exec -i mysql mysql -uroot -p$(grep MYSQL_ROOT_PASSWORD .env | cut -d= -f2) < ../sql/luohuo_im_01.sql
```

### 2.4 Nacos 配置

#### 2.4.1 访问 Nacos 控制台

- **地址**: `http://服务器IP:8848/nacos`
- **账号**: nacos
- **密码**: 查看 `.env` 文件中的 `NACOS_AUTH_PASSWORD`

#### 2.4.2 导入配置

配置文件模板位于 `luohuo-cloud/install/nacos/` 目录：

| 配置文件 | 说明 |
|---------|------|
| `mysql.yml` | 数据库连接配置 |
| `common-gateway.yml` | Gateway 白名单配置 |
| `hula-im-server.yml` | IM 服务配置 |
| `common-pii-encryption.yml` | PII 加密配置 |

**重要**: 确保 `mysql.yml` 中的数据库地址正确：
- Docker 部署使用 `host.docker.internal` 或容器名
- 本地部署使用 `127.0.0.1` 或实际 IP

### 2.5 应用服务部署

#### 2.5.1 编译项目

```bash
cd ~/projects/HuLa-Server

# 1. 编译工具模块（必须先编译）
cd luohuo-util
mvn clean install -DskipTests

# 2. 编译微服务模块
cd ../luohuo-cloud
mvn clean install -DskipTests
```

#### 2.5.2 启动服务

```bash
cd luohuo-cloud/src/main/bin

# 启动所有服务
bash all-start.sh

# 或手动启动单个服务
cd ../luohuo-gateway/luohuo-gateway-server
mvn spring-boot:run
```

**服务启动顺序**: Gateway → OAuth → Base → System → IM → WS

#### 2.5.3 验证服务

```bash
# 检查进程
jps -l | grep luohuo

# 检查健康状态
curl http://localhost:18760/actuator/health  # Gateway
curl http://localhost:18761/actuator/health  # OAuth
curl http://localhost:18762/actuator/health  # IM
curl http://localhost:9501/actuator/health   # WS

# 检查 Nacos 服务注册
curl "http://localhost:8848/nacos/v1/ns/service/list"
```

### 2.6 Turn 服务部署（可选）

WebRTC 音视频通话需要 Turn 服务器进行 NAT 穿透。

```bash
# 使用 Docker 部署 Coturn
cd docs/install/docker/turn

# 设置公网 IP
export EXTERNAL_IP=$(curl -s ifconfig.me)

# 启动服务
docker compose up -d

# 验证
# 使用在线工具: https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/
# STUN URI: stun:YOUR_IP:3478
# TURN URI: turn:YOUR_IP:3478
```

---

## 3. 部署失败排查指南

### 3.1 网络连接问题

**症状**: 应用服务无法连接 Nacos/MySQL/Redis/RocketMQ

**原因分析**:
1. Docker 容器使用 `host.docker.internal`，但 Linux 不原生支持
2. Nacos 配置中的 IP 地址与实际部署环境不匹配
3. 防火墙/安全组未开放必要端口

**解决方案**:

```bash
# 方案1: 添加 extra_hosts 映射（推荐）
# 在 docker-compose.yml 中添加：
extra_hosts:
  - "host.docker.internal:host-gateway"

# 方案2: 使用宿主机网关 IP
export NACOS_IP=172.17.0.1
export SERVICE_HOST=172.17.0.1

# 方案3: 使用 Docker 网络别名
# 将应用服务与基础设施加入同一个 Docker 网络
```

**端口检查**:
```bash
# 检查端口是否开放
nc -zv localhost 13306  # MySQL
nc -zv localhost 16379  # Redis
nc -zv localhost 8848   # Nacos
nc -zv localhost 10911  # RocketMQ Broker
```

### 3.2 RocketMQ 启动失败

**症状**: RocketMQ Broker 启动后立即退出，日志显示 `NullPointerException`

**原因分析**:
1. RocketMQ 5.x 需要 `timerwheel` 目录存在且有写入权限
2. `broker.conf` 中 `brokerIP1` 未配置或配置错误
3. `store` 目录权限不足

**解决方案**:

```bash
# 1. 创建必要目录
sudo mkdir -p rocketmq/namesrv/store rocketmq/broker/store rocketmq/timerwheel
sudo chmod -R 777 rocketmq/

# 2. 检查 broker.conf 配置
cat rocketmq/broker/conf/broker.conf | grep brokerIP1
# 确保 brokerIP1 设置为服务器实际 IP

# 3. 手动修改（如果需要）
sed -i "s/^brokerIP1=.*/brokerIP1=$(hostname -I | awk '{print $1}')/" rocketmq/broker/conf/broker.conf

# 4. 重启 RocketMQ
docker compose restart rocketmq-namesrv rocketmq-broker
```

**验证**:
```bash
# 检查 Broker 是否正常
docker logs rocketmq-broker --tail 50
nc -zv localhost 10911
```

### 3.3 Nacos 配置问题

**症状**: 应用启动报错 `Failed to configure a DataSource`

**原因分析**:
1. Nacos 中的 `mysql.yml` 配置不完整或 IP 地址错误
2. Nacos 命名空间不匹配（应用使用 UUID，但 Nacos 只有 public）
3. Nacos 数据库未初始化

**解决方案**:

```bash
# 1. 确保导入 Nacos 数据库
docker exec -i mysql mysql -uroot -p密码 < ../mysql-schema.sql

# 2. 使用 public 命名空间
# 在 docker-compose.services.yml 中设置：
environment:
  - NACOS_NAMESPACE=

# 3. 检查 mysql.yml 配置
# 确保包含以下标准属性：
spring:
  datasource:
    url: jdbc:mysql://host.docker.internal:13306/luohuo_dev?...
    username: root
    password: ${MYSQL_ROOT_PASSWORD}
```

**验证**:
```bash
# 检查 Nacos 配置
curl "http://localhost:8848/nacos/v1/cs/configs?dataId=mysql.yml&group=DEFAULT_GROUP"
```

### 3.4 数据库连接问题

**症状**: `Access denied` 或 `Connection refused`

**原因分析**:
1. `mysql/data` 目录残留旧数据（使用旧密码）
2. `.env` 文件密码与实际 MySQL 密码不一致
3. MySQL SSL 证书配置问题

**解决方案**:

```bash
# 方案1: 清理旧数据重新初始化
docker compose down
sudo rm -rf mysql/data
bash init-passwords.sh --ip $(hostname -I | awk '{print $1}')
docker compose up -d

# 方案2: 重置 MySQL 密码
docker exec -it mysql mysql -uroot -p旧密码
ALTER USER 'root'@'%' IDENTIFIED BY '新密码';
FLUSH PRIVILEGES;

# 方案3: 检查 SSL 配置
docker exec mysql mysql -uroot -p密码 -e "SHOW STATUS LIKE 'Ssl_cipher';"
```

### 3.5 健康检查失败

**症状**: Gateway 健康检查返回 406 或 DOWN

**原因分析**:
1. `/actuator/**` 未加入鉴权白名单
2. Elasticsearch 健康检查启用但 ES 未部署
3. 服务启动慢，健康检查超时

**解决方案**:

```yaml
# 1. 在 common-gateway.yml 中添加白名单
sa-token:
  not-match:
    - /actuator/**

# 2. 在 hula-im-server.yml 中禁用 ES 健康检查
management:
  health:
    elasticsearch:
      enabled: false

# 3. 增加 healthcheck 超时时间
healthcheck:
  start_period: 120s
  retries: 5
  interval: 30s
  timeout: 10s
```

### 3.6 部署失败深度分析

本节提供编译成功但部署失败的根本原因深度分析，帮助快速定位和解决问题。

#### 3.6.1 网络连接问题深度分析

**问题现象**:
- 应用日志显示 `Connection refused` 或 `No route to host`
- 服务注册到 Nacos 失败
- 数据库连接超时

**根本原因分析**:

| 原因 | 说明 | 影响范围 |
|------|------|---------|
| Docker 网络隔离 | 容器内 `127.0.0.1` 指向容器自身，非宿主机 | 所有服务 |
| `host.docker.internal` 不支持 | Linux 原生不支持此域名解析 | Linux 部署 |
| 防火墙规则 | 云安全组或主机防火墙阻断 | 跨网络访问 |
| DNS 解析失败 | 容器内无法解析服务名 | 服务发现 |

**完整解决方案**:

```bash
# 1. 检查 Docker 网络
docker network ls
docker network inspect bridge

# 2. 测试容器间连通性
docker exec -it hula-gateway ping mysql
docker exec -it hula-gateway nc -zv host.docker.internal 13306

# 3. 配置 extra_hosts（docker-compose.yml）
services:
  hula-gateway:
    extra_hosts:
      - "host.docker.internal:host-gateway"
      - "mysql:172.17.0.1"
      - "redis:172.17.0.1"

# 4. 或使用 Docker 自定义网络
docker network create hula-network
# 在 docker-compose.yml 中配置所有服务使用同一网络

# 5. 防火墙配置
sudo ufw allow from 172.17.0.0/16  # 允许 Docker 网络
sudo iptables -A INPUT -i docker0 -j ACCEPT
```

**验证脚本**:
```bash
#!/bin/bash
# network-check.sh
echo "=== 网络连通性检查 ==="
for port in 13306 16379 8848 9876 10911; do
  nc -zv localhost $port 2>&1 | grep -q "succeeded" && echo "Port $port: OK" || echo "Port $port: FAILED"
done
```

#### 3.6.2 RocketMQ 启动失败深度分析

**问题现象**:
- Broker 容器启动后立即退出（Exit Code 1）
- 日志显示 `java.lang.NullPointerException at org.apache.rocketmq.broker.schedule.ScheduleMessageService.configFilePath`
- 应用报错 `No route info of this topic`

**根本原因分析**:

RocketMQ 5.x 引入了任意延迟消息功能（`timerWheelEnable=true`），需要访问 `timerwheel` 目录。启动流程如下：

```
Broker 启动
    ↓
加载 ScheduleMessageService
    ↓
检查 timerwheel 目录 ← 目录不存在或无权限导致 NPE
    ↓
初始化失败，进程退出
```

**完整解决方案**:

```bash
# 1. 创建完整目录结构
sudo mkdir -p rocketmq/{namesrv,broker}/{store,logs}
sudo mkdir -p rocketmq/timerwheel
sudo mkdir -p rocketmq/broker/conf

# 2. 设置权限（RocketMQ 容器以 root 运行）
sudo chmod -R 777 rocketmq/
sudo chown -R $(id -u):$(id -g) rocketmq/

# 3. 检查 broker.conf 关键配置
cat > rocketmq/broker/conf/broker.conf << EOF
brokerClusterName = DefaultCluster
brokerName = broker-a
brokerId = 0
deleteWhen = 04
fileReservedTime = 48
brokerRole = ASYNC_MASTER
flushDiskType = ASYNC_FLUSH
# 关键：设置为服务器实际 IP
brokerIP1 = $(hostname -I | awk '{print $1}')
# 禁用 timerWheel（如果不需要延迟消息）
# timerWheelEnable = false
EOF

# 4. 重启并查看日志
docker compose restart rocketmq-broker
docker logs -f rocketmq-broker --tail 100
```

**诊断命令**:
```bash
# 检查 Broker 状态
docker exec rocketmq-broker sh -c "mqadmin clusterList -n localhost:9876"

# 检查 Topic 列表
docker exec rocketmq-broker sh -c "mqadmin topicList -n localhost:9876"

# 检查消费者组
docker exec rocketmq-broker sh -c "mqadmin consumerProgress -n localhost:9876"
```

#### 3.6.3 Nacos 配置问题深度分析

**问题现象**:
- 应用启动报错 `Failed to configure a DataSource`
- Nacos 控制台无法登录
- 配置拉取失败

**根本原因分析**:

| 问题类型 | 原因 | 解决方案 |
|---------|------|---------|
| 数据库未初始化 | `mysql-schema.sql` 未导入 | 手动导入 SQL |
| 命名空间不匹配 | 应用使用 UUID，Nacos 只有 public | 设置 `NACOS_NAMESPACE=` |
| 配置格式错误 | YAML 缩进或语法错误 | 使用 YAML 校验工具 |
| 认证失败 | Token 过期或密码错误 | 检查 `.env` 配置 |

**完整解决方案**:

```bash
# 1. 检查 Nacos 数据库
docker exec mysql mysql -uroot -p密码 -e "SHOW DATABASES;" | grep nacos

# 2. 手动初始化（如果不存在）
docker exec -i mysql mysql -uroot -p密码 << EOF
CREATE DATABASE IF NOT EXISTS nacos DEFAULT CHARACTER SET utf8mb4;
USE nacos;
SOURCE /docker-entrypoint-initdb.d/mysql-schema.sql;
EOF

# 3. 检查配置是否存在
curl -X GET "http://localhost:8848/nacos/v1/cs/configs?dataId=mysql.yml&group=DEFAULT_GROUP" \
  -H "Authorization: Bearer $(curl -s 'http://localhost:8848/nacos/v1/auth/login' -d 'username=nacos&password=密码' | jq -r '.accessToken')"

# 4. 修复 mysql.yml 配置（确保包含标准属性）
cat > /tmp/mysql.yml << 'EOF'
spring:
  datasource:
    driver-class-name: com.mysql.cj.jdbc.Driver
    url: jdbc:mysql://host.docker.internal:13306/luohuo_dev?useUnicode=true&characterEncoding=utf8&zeroDateTimeBehavior=convertToNull&useSSL=false&serverTimezone=Asia/Shanghai&allowPublicKeyRetrieval=true
    username: root
    password: ${MYSQL_ROOT_PASSWORD:123456}
    druid:
      initial-size: 5
      min-idle: 5
      max-active: 20
EOF

# 5. 发布配置到 Nacos
curl -X POST "http://localhost:8848/nacos/v1/cs/configs" \
  -d "dataId=mysql.yml&group=DEFAULT_GROUP&content=$(cat /tmp/mysql.yml | jq -sRr @uri)"
```

#### 3.6.4 数据库连接问题深度分析

**问题现象**:
- `Access denied for user 'root'@'%'`
- `Connection refused`
- `SSL connection error`

**根本原因分析**:

```
密码不一致问题流程：
1. 首次部署：MySQL 使用 .env 中的密码初始化
2. 修改 .env：生成新密码
3. 重启容器：MySQL 使用旧数据卷（旧密码）
4. 应用连接：使用新密码 → Access denied
```

**完整解决方案**:

```bash
# 方案1: 完全重置（推荐首次部署）
docker compose down -v  # 删除所有卷
sudo rm -rf mysql/data redis/data nacos/data
bash init-passwords.sh --ip $(hostname -I | awk '{print $1}')
docker compose up -d

# 方案2: 同步密码（保留数据）
# 获取当前 MySQL 密码
docker exec mysql cat /run/secrets/mysql_root_password 2>/dev/null || \
  docker exec mysql printenv MYSQL_ROOT_PASSWORD

# 更新 .env 文件
sed -i "s/MYSQL_ROOT_PASSWORD=.*/MYSQL_ROOT_PASSWORD=实际密码/" .env

# 方案3: 重置 MySQL 密码
docker exec -it mysql mysql -uroot -p旧密码 << EOF
ALTER USER 'root'@'%' IDENTIFIED BY '新密码';
ALTER USER 'root'@'localhost' IDENTIFIED BY '新密码';
FLUSH PRIVILEGES;
EOF

# 方案4: SSL 问题处理
# 检查 SSL 状态
docker exec mysql mysql -uroot -p密码 -e "SHOW VARIABLES LIKE '%ssl%';"

# 禁用 SSL（开发环境）
# 在连接字符串中添加: useSSL=false&allowPublicKeyRetrieval=true
```

#### 3.6.5 健康检查失败深度分析

**问题现象**:
- Gateway 返回 HTTP 406
- 健康检查返回 `{"status":"DOWN"}`
- 服务启动超时

**根本原因分析**:

| HTTP 状态码 | 原因 | 解决方案 |
|------------|------|---------|
| 406 | Accept 头不匹配 | 添加 `/actuator/**` 到白名单 |
| 503 | 依赖服务不可用 | 检查 MySQL/Redis/Nacos |
| DOWN (ES) | ES 健康检查失败 | 禁用 ES 健康检查 |
| 超时 | 服务启动慢 | 增加 `start_period` |

**完整解决方案**:

```yaml
# 1. common-gateway.yml - 添加白名单
sa-token:
  not-match:
    - /actuator/**
    - /swagger-resources/**
    - /v3/api-docs/**

# 2. hula-im-server.yml - 禁用不需要的健康检查
management:
  health:
    elasticsearch:
      enabled: false
    redis:
      enabled: true
    db:
      enabled: true
  endpoint:
    health:
      show-details: always

# 3. docker-compose.yml - 优化健康检查配置
services:
  hula-gateway:
    healthcheck:
      test: ["CMD-SHELL", "curl -sf http://localhost:18760/actuator/health || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 5
      start_period: 120s  # 给服务足够的启动时间
```

**快速验证脚本**:
```bash
#!/bin/bash
# health-deep-check.sh
echo "=== 深度健康检查 ==="

# 基础设施
echo "--- 基础设施 ---"
curl -sf http://localhost:8848/nacos/v1/console/health/readiness && echo "Nacos: OK" || echo "Nacos: FAILED"
docker exec mysql mysqladmin ping -uroot -p$(grep MYSQL_ROOT_PASSWORD .env | cut -d= -f2) 2>/dev/null && echo "MySQL: OK" || echo "MySQL: FAILED"
docker exec redis redis-cli -a $(grep REDIS_PASSWORD .env | cut -d= -f2) ping 2>/dev/null | grep -q PONG && echo "Redis: OK" || echo "Redis: FAILED"

# 应用服务
echo "--- 应用服务 ---"
for svc in "Gateway:18760" "OAuth:18761" "IM:18762" "WS:9501"; do
  name=$(echo $svc | cut -d: -f1)
  port=$(echo $svc | cut -d: -f2)
  status=$(curl -sf http://localhost:$port/actuator/health | jq -r '.status' 2>/dev/null)
  echo "$name: ${status:-FAILED}"
done
```

#### 3.6.6 快速诊断流程图

```
部署失败
    │
    ├─ 容器未启动 ──→ docker compose ps ──→ 检查日志
    │                                        │
    │                                        ├─ Exit 1 ──→ 权限/配置问题
    │                                        └─ OOM ──→ 增加内存限制
    │
    ├─ 容器运行但服务不可用 ──→ 健康检查
    │                           │
    │                           ├─ 406 ──→ 添加白名单
    │                           ├─ 503 ──→ 检查依赖服务
    │                           └─ DOWN ──→ 查看详细状态
    │
    └─ 服务可用但功能异常 ──→ 检查日志
                              │
                              ├─ Connection refused ──→ 网络问题
                              ├─ Access denied ──→ 密码问题
                              └─ No route info ──→ RocketMQ 问题
```

---

## 4. 生产环境配置

### 4.1 安全加固

#### 4.1.1 密码安全

```bash
# 使用 init-passwords.sh 生成强密码
bash init-passwords.sh --ip 服务器IP

# 定期轮换密码
# 修改 .env 文件后重启服务
```

#### 4.1.2 网络安全

```bash
# 配置防火墙（UFW）
sudo ufw allow 22/tcp      # SSH
sudo ufw allow 18760/tcp   # Gateway
sudo ufw allow 9501/tcp    # WebSocket
sudo ufw enable

# 内部端口不对外开放
# MySQL(13306), Redis(16379), Nacos(8848) 等仅内网访问
```

#### 4.1.3 SSL/TLS 配置

```bash
# MySQL SSL 已默认配置
# 验证 SSL 连接
docker exec mysql mysql -uroot -p密码 -e "SHOW STATUS LIKE 'Ssl_cipher';"
```

### 4.2 性能优化

#### 4.2.1 JVM 参数优化

```bash
# 在启动脚本中配置
export JAVA_OPTS="-Xms512M -Xmx1024M -XX:+UseG1GC -XX:MaxGCPauseMillis=200"
```

#### 4.2.2 数据库优化

```sql
-- 执行索引优化脚本
source luohuo-cloud/install/sql/optimize_indexes.sql;
```

### 4.3 监控告警

#### 4.3.1 启动监控服务

```bash
cd docs/install/docker/monitoring
docker compose -f docker-compose.monitoring.yml up -d
```

#### 4.3.2 访问监控面板

| 服务 | 地址 | 说明 |
|------|------|------|
| Prometheus | http://IP:9090 | 指标收集 |
| Grafana | http://IP:3000 | 可视化仪表盘 |

### 4.4 备份恢复

#### 4.4.1 手动备份

```bash
cd docs/install/docker
bash backup.sh
```

#### 4.4.2 定时备份

```bash
# 添加定时任务（每天凌晨2点）
crontab -e
# 添加: 0 2 * * * /home/docker/install/docker/backup.sh
```

#### 4.4.3 数据恢复

```bash
bash restore.sh 20251220_020000
```

---

## 5. 常见问题 FAQ

### Q1: RocketMQ 启动失败，日志显示 NullPointerException
**A**: 创建 `timerwheel` 目录并设置权限：
```bash
sudo mkdir -p rocketmq/timerwheel
sudo chmod -R 777 rocketmq/
```

### Q2: Nacos 启动失败
**A**: 确保已导入 `mysql-schema.sql` 到 MySQL，并检查数据库连接配置。

### Q3: 编译失败
**A**: 确保先编译 `luohuo-util`，再编译 `luohuo-cloud`。

### Q4: 服务无法连接数据库
**A**: 检查 Nacos 中 `mysql.yml` 的数据库地址配置，Docker 部署使用 `host.docker.internal`。

### Q5: Gateway 健康检查返回 406
**A**: 在 Nacos 的 `common-gateway.yml` 中将 `/actuator/**` 添加到鉴权白名单。

### Q6: Docker 权限报错
**A**: 将用户加入 docker 组：
```bash
sudo usermod -aG docker $USER
newgrp docker
```

### Q7: 应用启动慢（超过60秒）
**A**: 
1. 检查 `/etc/hosts` 是否配置了主机名解析
2. 安装 `haveged` 提供熵源：`sudo apt install haveged`

### Q8: WebSocket 连接失败
**A**: 检查 9501 端口是否开放，确保 WS 服务已启动。

---

## 6. 附录

### 6.1 端口清单

| 服务 | 端口 | 说明 |
|------|------|------|
| MySQL | 13306 | 数据库 |
| Redis | 16379 | 缓存 |
| Nacos | 8848, 9848, 9849 | 配置中心 |
| RocketMQ NameSrv | 9876 | 消息队列 |
| RocketMQ Broker | 10909, 10911, 10912 | 消息队列 |
| MinIO | 9000, 9001 | 对象存储 |
| Gateway | 18760 | API 网关 |
| OAuth | 18761 | 认证服务 |
| IM | 18762 | IM 服务 |
| WebSocket | 9501 | WebSocket |
| Jenkins | 20000 | CI/CD（可选）|
| Prometheus | 9090 | 监控（可选）|
| Grafana | 3000 | 仪表盘（可选）|

### 6.2 重要文件位置

| 文件 | 路径 | 说明 |
|------|------|------|
| Docker 配置 | `docs/install/docker/` | 基础设施配置 |
| Nacos 建表 SQL | `docs/install/mysql-schema.sql` | Nacos 初始化 |
| 业务 SQL | `docs/install/sql/` | 业务库初始化 |
| Nacos 配置模板 | `luohuo-cloud/install/nacos/` | Gateway 白名单、PII 配置等 |
| 部署脚本 | `docs/install/docker/deploy.sh` | 一键部署脚本 |
| 健康检查 | `docs/install/docker/health-check.sh` | 服务健康检查 |
| 备份脚本 | `docs/install/docker/backup.sh` | 数据备份脚本 |
| 启动脚本 | `luohuo-cloud/src/main/bin/all-start.sh` | 应用启动脚本 |

### 6.3 部署检查清单

#### 部署前
- [ ] 服务器满足最低配置要求
- [ ] 安装 Docker 20.10+
- [ ] 安装 Docker Compose 2.0+
- [ ] 安装 JDK 21
- [ ] 安装 Maven 3.8+
- [ ] 配置防火墙规则

#### 基础设施
- [ ] 执行 `init-passwords.sh` 初始化密码
- [ ] 创建 RocketMQ 目录并设置权限
- [ ] 修改 `broker.conf` 中的 `brokerIP1`
- [ ] 启动 Docker 容器
- [ ] 导入数据库

#### 应用服务
- [ ] 编译 `luohuo-util`
- [ ] 编译 `luohuo-cloud`
- [ ] 启动应用服务
- [ ] 验证健康检查

#### 部署后
- [ ] 所有服务健康检查通过
- [ ] 用户注册/登录功能正常
- [ ] WebSocket 连接正常
- [ ] 消息发送接收正常

---

**文档维护**: Kiro AI Assistant  
**最后更新**: 2025-12-20
