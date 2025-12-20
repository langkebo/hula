# 部署指南

## 1. 环境准备
确保服务器已安装以下环境：
- JDK 21
- Maven 3.8+
- Docker & Docker Compose
- MySQL 8.0+
- Redis 6.0+
- Nacos 2.x

## 2. 获取代码
```bash
git clone https://github.com/langkebo/hula.git
cd HuLa-Server
```

## 3. 配置修改
### 3.1 数据库配置
修改 `luohuo-cloud/luohuo-support/luohuo-boot-server/src/main/resources/config/dev/mysql.yml`，配置您的数据库连接信息。

### 3.2 中间件配置
确保 Nacos、Redis 等中间件已启动。如果是 Docker 部署，请参考 `docs/install/docker` 目录下的说明。

**注意：权限问题**
如果在启动 Nacos 容器时遇到权限错误，请执行以下命令修复挂载目录权限：
```bash
sudo chown -R $(id -u):$(id -g) docs/install/docker/nacos/data
```

## 4. 编译打包
```bash
mvn clean package -DskipTests
```

## 5. 启动服务
进入对应的服务目录，执行：
```bash
java -jar target/luohuo-boot-server.jar
```
或者使用 Docker Compose 一键启动所有服务。

## 6. 验证
访问 Swagger 文档地址：
- 本地开发：`http://localhost:8760/doc.html`
- 检查页脚和联系人信息是否显示为 `langkebo/hula` 相关信息。
