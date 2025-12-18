# HuLa Server Ubuntu 部署指南

**版本**: v3.0.7
**更新时间**: 2025-12-18
**适用系统**: Ubuntu 20.04+ / Debian 11+
**Java版本**: JDK 21
**生产就绪度**: 9.5/10

---

## 📋 目录

0. [部署前准备清单](#0-部署前准备清单)
1. [系统要求](#1-系统要求)
2. [环境准备](#2-环境准备)
3. [基础设施部署](#3-基础设施部署)
4. [P0安全加固配置](#4-p0安全加固配置)
5. [Turn服务器部署](#5-turn服务器部署)
6. [应用服务部署](#6-应用服务部署)
7. [功能验证](#7-功能验证)
8. [监控与运维](#8-监控与运维)
9. [故障排查与部署总结](#9-故障排查与部署总结)

---

## 0. 部署前准备清单

### 0.1 系统环境要求（必选）

- **操作系统**：Ubuntu 20.04+（推荐 Ubuntu 22.04 LTS）/ Debian 11+，64 位
- **时间同步**：开启 NTP（`systemd-timesyncd` / `chrony` 均可），避免 JWT/证书/缓存过期异常
- **资源建议**：
  - **最小配置**：4 核 CPU / 8GB 内存 / 100GB SSD
  - **推荐配置**：8 核 CPU / 16GB 内存 / 200GB SSD（容器 + 多个 Java 服务同机部署时，内存越大越稳定）

### 0.2 依赖软件版本（必选）

- **Docker Engine**：20.10+（本仓库 Docker Compose 配置兼容新版本）
- **Docker Compose**：2.0+（使用 `docker compose` 子命令）
- **JDK**：21.0+ (OpenJDK 21 或 Oracle JDK 21)
- **Maven**：3.8+（推荐 3.9.x）
- **Git**：2.25+

### 0.3 权限与目录（必选）

- **Root/Sudo 权限**：安装系统软件和 Docker 需要 sudo 权限
- **Docker 权限**：执行部署账号必须具备 Docker 权限（推荐加入 `docker` 组）：
  ```bash
  sudo usermod -aG docker $USER
  newgrp docker
  ```
- **部署目录**：建议 `/home/docker/install` 或项目内的 `docs/install/docker`

### 0.4 网络与端口（必选）

- **服务器 IP**：
  - `ROCKETMQ_BROKER_IP` 必须设置为客户端可直连的 IP（一般为内网 IP；跨公网访问则需公网 IP 或 NAT 映射）
  - `SRS_CANDIDATE` 必须设置为客户端可访问的 IP（公网部署通常填公网 IP）
- **端口放行**（云安全组 + 主机防火墙都要放行）：
  - **基础设施**：
    - MySQL: `13306`
    - Redis: `16379`
    - Nacos: `8848`, `9848`, `9849`
    - RocketMQ: `9876` (NameSrv), `10909`, `10911`, `10912` (Broker)
    - MinIO: `9000` (API), `9001` (Console)
    - Turn Server: `3478` (UDP/TCP), `49152-65535` (UDP)
  - **应用服务**：
    - Gateway: `18760`
    - OAuth: `18761`
    - IM: `18762`
    - WebSocket: `9501`
  - **WebRTC/SRS**（启用时）：`1935/tcp`, `1985/tcp`, `7088/tcp`, `1989/tcp`, `8443/tcp`, `8000/udp`, `61100-61200/udp`
  - **Jenkins**（可选）：`20000/tcp`

### 0.5 数据库初始化与迁移（自动化支持）

- **自动化部署**：使用 `deploy.sh` 脚本会自动检测并导入以下数据库：
  - Nacos 库：`mysql-schema.sql`
  - 业务库：`sql/luohuo_dev.sql`、`sql/luohuo_im_01.sql`
- **手动迁移**（如自动化失败）：
  - 需手动进入 MySQL 容器导入上述 SQL 文件

---

## 1. 系统要求

| 组件 | 最低配置 | 推荐配置 | 生产环境 |
|------|---------|---------|---------|
| **CPU** | 4核 | 8核 | 16核+ |
| **内存** | 8GB | 16GB | 32GB+ |
| **硬盘** | 100GB SSD | 500GB SSD | 1TB+ SSD |
| **网络** | 100Mbps | 1Gbps | 10Gbps |

---

## 2. 环境准备

### 2.1 更新系统与安装基础工具

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget git vim net-tools ufw unzip
```

### 2.2 安装 Docker 和 Docker Compose

```bash
# 卸载旧版本
sudo apt remove docker docker-engine docker.io containerd runc

# 安装 Docker
curl -fsSL https://get.docker.com | bash -s docker --mirror Aliyun

# 启动 Docker
sudo systemctl start docker
sudo systemctl enable docker

# 配置非 Root 用户权限 (需要重新登录生效)
sudo usermod -aG docker $USER

# 验证
docker compose version
```

### 2.3 安装 JDK 21

```bash
sudo apt install -y openjdk-21-jdk
java -version
```

### 2.4 安装 Maven 3.9

```bash
wget https://dlcdn.apache.org/maven/maven-3/3.9.6/binaries/apache-maven-3.9.6-bin.tar.gz
sudo tar -xzf apache-maven-3.9.6-bin.tar.gz -C /opt
echo 'export MAVEN_HOME=/opt/apache-maven-3.9.6' >> ~/.bashrc
echo 'export PATH=$MAVEN_HOME/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
mvn -version
```

---

## 3. 基础设施部署

### 3.1 获取代码

```bash
mkdir -p ~/projects
cd ~/projects
git clone https://gitee.com/your-org/HuLa-Server.git
# 或上传源码包并解压
cd HuLa-Server
```

### 3.2 初始化配置与密码

**重要**：生产环境必须重置默认密码！

```bash
cd docs/install/docker

# 1. 生成随机强密码和 .env 配置文件
# --ip 参数指定服务器 IP (用于 RocketMQ 和 SRS)
bash init-passwords.sh --ip $(hostname -I | awk '{print $1}')

# 2. 检查生成的 .env 文件
cat .env
```

### 3.3 启动基础设施服务

使用 `deploy.sh` 脚本进行一键部署。

**注意**: 首次部署前，需手动创建 RocketMQ 数据目录以避免权限问题：
```bash
cd docs/install/docker
sudo mkdir -p rocketmq/namesrv/store rocketmq/broker/store rocketmq/timerwheel
sudo chmod -R 777 rocketmq/
```

```bash
# 生产环境部署 (使用 docker-compose.prod.yml)
bash deploy.sh prod

# 脚本会自动执行：
# 1. 检查 Docker 环境
# 2. 设置目录权限 (需要 sudo 权限)
# 3. 检查并修正配置文件 (如 broker.conf)
# 4. 启动 Docker 容器 (MySQL, Redis, Nacos, RocketMQ, MinIO)
# 5. 等待服务健康检查通过
# 6. 自动导入 Nacos 数据库和业务数据库
# 7. 自动导入 Nacos 配置中心配置
```

### 3.4 验证部署状态

```bash
# 查看容器运行状态
docker compose -f docker-compose.prod.yml ps

# 查看服务健康状态
bash health-check.sh
```

---

## 4. P0安全加固配置

### 4.1 确认 PII 加密配置
检查 `.env` 文件中 `PII_ENCRYPTION_KEY` 是否已生成。
确认 Nacos 中的配置已启用加密（脚本自动导入的配置默认根据 `.env` 生成）。

### 4.2 MySQL SSL 连接
`docker-compose.prod.yml` 默认配置 MySQL 开启 SSL。
验证：
```bash
docker exec mysql mysql -uroot -p$(grep MYSQL_ROOT_PASSWORD .env | cut -d= -f2) -e "SHOW STATUS LIKE 'Ssl_cipher';"
```

### 4.3 确认 Nacos 鉴权
Nacos 默认开启鉴权，账号密码在 `.env` 中定义。
登录 Nacos 控制台：`http://IP:8848/nacos`
验证是否需要登录。

---

## 5. Turn服务器部署

WebRTC 音视频通话需要 Turn 服务器进行 NAT 穿透。推荐使用 `Coturn`。

### 5.1 使用 Docker 部署 Coturn

创建 `docker-compose.turn.yml`:

```yaml
version: '3'
services:
  coturn:
    image: coturn/coturn
    container_name: coturn
    restart: always
    network_mode: host
    environment:
      - REALM=hula.com
      - LISTENING_PORT=3478
      - MIN_PORT=49152
      - MAX_PORT=65535
      - EXTERNAL_IP=${EXTERNAL_IP} # 替换为公网IP
      - USER=hula:hula123          # 替换为自定义账号密码
    volumes:
      - ./turnserver.conf:/etc/coturn/turnserver.conf
```

启动 Turn 服务：
```bash
export EXTERNAL_IP=$(curl -s ifconfig.me)
docker compose -f docker-compose.turn.yml up -d
```

### 5.2 验证 Turn 服务

可以使用在线工具 (如 https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/) 验证：
- STUN URI: `stun:YOUR_IP:3478`
- TURN URI: `turn:YOUR_IP:3478`
- Username/Password: `hula` / `hula123`

---

## 6. 应用服务部署

### 6.1 编译后端代码

```bash
cd ~/projects/HuLa-Server

# 1. 编译工具模块
cd luohuo-util
mvn clean install -DskipTests

# 2. 编译微服务模块
cd ../luohuo-cloud
mvn clean install -DskipTests
```

### 6.2 启动应用服务

```bash
cd luohuo-cloud/src/main/bin

# 启动所有服务
bash all-start.sh

# 查看日志
tail -f ../../luohuo-gateway/luohuo-gateway-server/logs/application.log
```

---

## 7. 功能验证

### 7.1 服务可用性测试

| 服务 | 检查方法 | 预期结果 |
|------|---------|---------|
| **Nacos** | `curl -I http://localhost:18848/index.html` | HTTP 200 |
| **MinIO** | `curl -I http://localhost:9001/` | HTTP 200 |
| **Gateway** | `curl http://localhost:18760/actuator/health` | `{"status":"UP",...}` |
| **Auth** | `curl http://localhost:18761/actuator/health` | `{"status":"UP",...}` |

### 7.2 性能基准测试 (简单)

```bash
# 压测 Gateway 健康检查接口
ab -n 1000 -c 50 http://localhost:18760/actuator/health
```
**指标检查点**：
- RPS > 2000 (视配置而定)
- P99 延迟 < 50ms

---

## 8. 监控与运维

### 8.1 常用运维命令

- **查看所有服务日志**：
  ```bash
  cd ~/projects/HuLa-Server/luohuo-cloud/src/main/bin
  bash view-logs.sh
  ```
- **备份数据**：
  ```bash
  cd ~/projects/HuLa-Server/docs/install/docker
  bash backup.sh
  ```

### 8.2 监控指标检查点

- **系统负载**：`htop` 或 `top`，关注 CPU Load 和 Memory 使用率。
- **Java 进程**：`jps -l` 确保所有微服务进程存在。
- **Docker 容器**：`docker stats` 检查中间件资源占用。

---

## 9. 故障排查与部署总结

### 9.1 部署过程常见问题总结

1. **Nacos 版本兼容性**
   - **问题**: 早期版本 `.env` 配置了 Nacos v3.0.2，导致客户端连接失败。
   - **解决**: 降级至 v2.4.3 并清理旧数据。

2. **Nacos 配置导入失败**
   - **问题**: `deploy.sh` 脚本在网络隔离环境下无法通过 HTTP 导入配置，或配置中 IP 地址不正确。
   - **解决**: 使用 `generate_nacos_sql.py` 或手动 SQL 直接注入 MySQL 数据库；确保 `mysql.yml` 中的数据库地址使用 `host.docker.internal` 或正确容器 IP。

3. **数据库连接异常**
   - **问题**: `hula-im` 启动报错 `Failed to configure a DataSource`。
   - **原因**: Nacos 中的 `mysql.yml` 缺少 `spring.datasource.url` 等标准属性（仅有 `spring.datasource.druid`），或 Namespace 配置不匹配。
   - **解决**: 修正 `mysql.yml`，补全标准 JDBC 属性，并确保应用使用的 Nacos Namespace 与配置发布位置一致（默认 public）。

### 9.2 常见问题解决方案

1. **MySQL 启动失败**
   - **现象**：`docker compose ps` 显示 MySQL `Exit 1`。
   - **解决**：检查 `mysql/data` 目录权限，或检查端口 13306 是否被占用。
   
2. **Nacos 连接数据库失败**
   - **现象**：Nacos 日志报错 `Connection refused` 或 `Access denied`。
   - **解决**：检查 `.env` 中的 `MYSQL_NACOS_PASSWORD` 是否与 MySQL 实际密码一致；检查防火墙是否允许 Docker 容器间通信。

3. **RocketMQ Broker 无法连接 / 启动失败**
   - **现象**：应用报错 `No route info of this topic` 或 `Broker not available`。Docker 日志显示 `java.lang.NullPointerException`。
   - **原因**：RocketMQ 5.x 需要 `store` 和 `timerwheel` 目录存在且有写入权限。
   - **解决**：
     - 执行命令手动创建目录并授权：
       ```bash
       sudo mkdir -p rocketmq/namesrv/store rocketmq/broker/store rocketmq/timerwheel
       sudo chmod -R 777 rocketmq/
       ```
     - 检查 `rocketmq/broker/conf/broker.conf` 中的 `brokerIP1` 是否为客户端可访问的真实 IP（Docker 部署时推荐使用 `host.docker.internal` 或宿主机 IP）。
   - **验证**：使用 `bash health-check.sh` 确认 Broker 端口 10911 可通。

4. **应用服务连接 Nacos/MySQL 失败**
   - **现象**：应用启动时报错连接拒绝 (Connection refused)。
   - **解决**：
     - 确保 Nacos 中的配置文件 (`mysql.yml`, `redis.yml` 等) 使用了正确的 IP 地址。
     - 如果应用运行在 Docker 中，建议使用 `host.docker.internal` 作为服务地址，并确保 `docker-compose.services.yml` 中配置了 `extra_hosts`。
     - 检查 `docker-compose.services.yml` 中的 `NACOS_IP` 和 `NACOS_PORT` 环境变量是否正确。

5. **Docker 权限报错**
   - **现象**：`permission denied while trying to connect to the Docker daemon socket`。
   - **解决**：
     - 方案 A：使用 `sudo` 执行脚本：`sudo bash deploy.sh prod`。
     - 方案 B：将用户加入 `docker` 组并重新登录：`sudo usermod -aG docker $USER && newgrp docker`。

6. **应用启动慢**
   - **现象**：Spring Boot 启动耗时超过 60s。
   - **解决**：检查 `/etc/hosts` 是否配置了主机名解析；检查 Entropy 源（安装 `haveged`）。
