# HuLa-Server 快速开始指南

本指南帮助您在 5 分钟内启动 HuLa-Server 开发环境。

## 📋 前置要求

- Docker 20.10+
- Docker Compose 2.0+
- JDK 21
- Maven 3.8+
- Git

## 🚀 快速启动

### 1. 克隆项目

```bash
git clone https://gitee.com/user/HuLa-Server.git
cd HuLa-Server-master
```

### 2. 启动基础设施

```bash
# 进入docker配置目录
cd docs/install/docker

# 修改RocketMQ配置 (重要!)
# 编辑 rocketmq/broker/conf/broker.conf
# 将 brokerIP1 改为你的服务器IP
sed -i "s/^brokerIP1=.*/brokerIP1=$(hostname -I | awk '{print $1}')/" rocketmq/broker/conf/broker.conf

# 设置目录权限
chmod -R 777 rocketmq/

# 启动所有服务
docker compose up -d

# 等待服务启动 (约60秒)
sleep 60

# 检查服务状态
docker compose ps
```

### 3. 导入数据库

```bash
# 导入Nacos数据库
docker exec -i mysql mysql -uroot -p123456 < ../mysql-schema.sql

# 导入业务数据库 (如果有)
# docker exec -i mysql mysql -uroot -p123456 < ../sql/luohuo_dev.sql
```

### 4. 编译项目

```bash
# 返回项目根目录
cd ../../..

# 确认 Java 版本为 21
java -version

# 编译luohuo-util
cd luohuo-util
mvn clean install -DskipTests

# 编译luohuo-cloud
cd ../luohuo-cloud
mvn clean install -DskipTests
```

### 5. 启动服务

```bash
# 使用启动脚本
bash src/main/bin/all-start.sh

# 或者手动启动单个服务
# cd luohuo-gateway/luohuo-gateway-server
# mvn spring-boot:run
```

### 6. 验证部署

```bash
# 检查Gateway
curl http://localhost:18760/actuator/health

# 检查Nacos
curl http://localhost:8848/nacos/v1/console/health/readiness
```

## 📝 服务端口

| 服务 | 端口 | 说明 |
|------|------|------|
| Gateway | 18760 | API网关 |
| OAuth | 18761 | 认证服务 |
| IM | 18762 | IM服务 |
| WS | 9501 | WebSocket |
| Nacos | 8848 | 配置中心 |
| MySQL | 13306 | 数据库 |
| Redis | 16379 | 缓存 |
| MinIO | 9000/9001 | 对象存储 |

## 🔧 常见问题

### Q: RocketMQ启动失败
A: 检查 `broker.conf` 中的 `brokerIP1` 是否正确配置为服务器IP

### Q: Nacos启动失败
A: 确保已导入 `mysql-schema.sql` 到MySQL

### Q: 编译失败
A: 确保先编译 `luohuo-util`，再编译 `luohuo-cloud`

## 📚 更多文档

- [Ubuntu部署指南](../HuLa-Server-Ubuntu部署指南.md)
- [服务端部署文档](服务端部署文档.md)
- [生产部署评估](../PRODUCTION_DEPLOYMENT_ASSESSMENT.md)
