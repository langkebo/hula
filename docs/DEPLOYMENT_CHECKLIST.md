# HuLa-Server 生产部署检查清单

**版本**: 3.0.6
**更新日期**: 2025-12-16

---

## ✅ 一份文档完成部署（推荐顺序）

### 0. 目录与顺序
- [ ] 0) 服务器与网络准备（端口/域名/证书）
- [ ] 1) 准备部署目录 `/home/docker/install` 并拷贝 `docs/install/`
- [ ] 2) 初始化密码与关键变量（MySQL/Redis/MinIO/Nacos/PII/SRS）
- [ ] 3) 启动基础设施（MySQL/Redis/Nacos/RocketMQ/MinIO/SRS）
- [ ] 4) 初始化数据库（Nacos + 业务库）
- [ ] 5) 初始化 Nacos 配置（含 PII 加密、Gateway 白名单）
- [ ] 6) 编译并启动服务端应用（按 Gateway→OAuth→Base→System→IM→WS）
- [ ] 7) 可选：部署 TURN 服务（语音/视频在复杂网络下更稳定）
- [ ] 8) 部署后验证与回归（健康检查/关键功能/日志）

## ✅ 部署前检查

### 环境准备
- [ ] 服务器满足最低配置要求 (8核/16GB/200GB SSD)
- [ ] 安装 Docker 20.10+
- [ ] 安装 Docker Compose 2.0+
- [ ] 安装 JDK 21
- [ ] 安装 Maven 3.8+
- [ ] 确认 Docker 守护进程运行 `sudo systemctl status docker`
- [ ] 确认当前用户可用 Docker（或使用 sudo 执行脚本）
- [ ] 配置防火墙规则

### 安全配置
- [ ] 修改 MySQL root 密码 (不使用默认 123456)
- [ ] 修改 Redis 密码 (不使用默认 luo123456)
- [ ] 修改 MinIO 密码 (不使用默认 mini.123huo)
- [ ] 修改 Nacos 认证密钥
- [ ] 生成 MySQL SSL 证书
- [ ] 生成 PII 加密密钥

### 配置修改
- [ ] 修改 `broker.conf` 中的 `brokerIP1`
- [ ] 修改 `docker-compose.yml` 中的 SRS CANDIDATE IP
- [ ] 配置 Nacos 中的数据库连接
- [ ] 配置 Nacos 中的 Redis 连接
- [ ] 配置邮箱服务密钥
- [ ] 配置 `/actuator/**` 加入鉴权白名单 (参考 `luohuo-cloud/install/nacos/common-gateway.yml`)
- [ ] 禁用未部署组件的健康检查 (参考 `luohuo-cloud/install/nacos/hula-im-server.yml`)
- [ ] 确认 `NACOS_NAMESPACE` 环境变量正确 (prod默认使用public命名空间)

---

## ✅ 部署步骤

### 1. 基础设施部署
- [ ] 上传 `docs/install/` 到服务器（建议放到 `/home/docker/install`）
- [ ] 进入 `/home/docker/install/docker` 目录
- [ ] 生产环境先执行密码初始化 `bash init-passwords.sh`
- [ ] 确认 RocketMQ `broker.conf` 中 `brokerIP1` 为服务器IP（或在 `.env` 设置 `ROCKETMQ_BROKER_IP`）
- [ ] 确认 `.env` 中 `SRS_CANDIDATE` 为公网IP（或能被客户端访问的IP）
- [ ] 启动基础设施
  - 开发/测试：`docker compose up -d`
  - 生产：`docker compose -f docker-compose.prod.yml up -d`
- [ ] 等待服务就绪（约60秒）
- [ ] 初始化数据库（推荐用脚本，一次性导入 Nacos + 业务库）
  - `bash deploy.sh`

## ✅ 常见问题

### Docker 权限
- [ ] 报错 `permission denied while trying to connect to the docker API`：把用户加入 docker 组并重新登录 `sudo usermod -aG docker $USER`

### Docker Hub 拉取镜像失败
- [ ] 报错包含 `auth.docker.io`/`no route to host`/`timeout`：优先检查 DNS 与出口网络（可在 `/etc/systemd/resolved.conf` 配置 DNS 后重启 `systemd-resolved`）

### 2. 应用编译
- [ ] 编译 luohuo-util `mvn clean install -DskipTests`
- [ ] 编译 luohuo-cloud `mvn clean install -DskipTests`

### 3. 应用启动
- [ ] 启动 Gateway 服务
- [ ] 启动 OAuth 服务
- [ ] 启动 Base 服务
- [ ] 启动 System 服务
- [ ] 启动 IM 服务
- [ ] 启动 WS 服务

---

## ✅ 数据库迁移与优化

### 初始化（必须）
- [ ] Nacos 库：导入 `docs/install/mysql-schema.sql`
- [ ] 业务库：导入 `docs/install/sql/luohuo_dev.sql`、`docs/install/sql/luohuo_im_01.sql`

### PII 加密（生产建议）
- [ ] Nacos 配置中启用 `pii.encryption.enabled=true` 并通过环境变量提供 `PII_ENCRYPTION_KEY`
- [ ] 字段扩容（迁移前执行）：`luohuo-cloud/install/sql/pii-field-expand.sql`
- [ ] 迁移前验证：`luohuo-cloud/install/sql/pii-migration-verify.sql`
- [ ] 迁移后验证：`luohuo-cloud/install/sql/pii-migration-post-verify.sql`

### 性能优化（可选）
- [ ] IM 索引优化：`luohuo-cloud/install/sql/optimize_indexes.sql`

## ✅ 部署后验证

### 健康检查
- [ ] MySQL 连接正常
- [ ] Redis 连接正常
- [ ] Nacos 服务正常
- [ ] RocketMQ 服务正常
- [ ] MinIO 服务正常

### 应用检查
- [ ] 所有服务进程运行中 `jps -l | grep luohuo`
- [ ] Gateway 健康检查通过 `curl http://localhost:18760/actuator/health`
- [ ] OAuth 健康检查通过 `curl http://localhost:18761/actuator/health`
- [ ] IM 健康检查通过 `curl http://localhost:18762/actuator/health`
- [ ] WS 健康检查通过 `curl http://localhost:9501/actuator/health`
- [ ] 服务已注册到 Nacos `curl "http://localhost:8848/nacos/v1/ns/service/list"`

### 功能验证
- [ ] 用户注册功能正常
- [ ] 用户登录功能正常
- [ ] WebSocket 连接正常
- [ ] 消息发送接收正常
- [ ] 文件上传下载正常

---

## ✅ 运维配置

### 监控
- [ ] 配置日志轮转
- [ ] 配置 Prometheus 监控 (可选)
- [ ] 配置 Grafana 仪表盘 (可选)
- [ ] 配置告警规则 (可选)

### 备份
- [ ] 配置数据库自动备份
- [ ] 配置 Redis 数据备份
- [ ] 配置 Nacos 配置备份
- [ ] 测试备份恢复流程

### 安全
- [ ] 配置 SSL/TLS 证书
- [ ] 配置 HTTPS
- [ ] 配置访问日志
- [ ] 配置安全审计

---

## 📝 重要文件位置

| 文件 | 路径 | 说明 |
|------|------|------|
| Docker配置 | `docs/install/docker/` | 基础设施配置 |
| Nacos建表SQL | `docs/install/mysql-schema.sql` | Nacos初始化 |
| 业务SQL | `docs/install/sql/` | 业务库初始化 |
| 数据库迁移/优化SQL | `luohuo-cloud/install/sql/` | PII迁移、索引优化 |
| Nacos配置模板 | `luohuo-cloud/install/nacos/` | Gateway白名单、PII配置等 |
| 部署脚本 | `docs/install/docker/deploy.sh` | 一键部署脚本 |
| 健康检查 | `docs/install/docker/health-check.sh` | 服务健康检查 |
| 备份脚本 | `docs/install/docker/backup.sh` | 数据备份脚本 |
| 启动脚本 | `luohuo-cloud/src/main/bin/all-start.sh` | 应用启动脚本 |
| 停止脚本 | `luohuo-cloud/src/main/bin/all-stop.sh` | 应用停止脚本 |
| Gateway配置模板 | `luohuo-cloud/install/nacos/common-gateway.yml` | Nacos Gateway配置 |
| IM Server配置 | `luohuo-cloud/install/nacos/hula-im-server.yml` | ES禁用配置 |
| Prod环境配置 | `luohuo-cloud/src/main/filters/config-prod.properties` | 生产环境参数 |

---

## 🔗 相关文档

- [快速开始指南](install/QUICK_START.md)
- [Ubuntu部署指南](HuLa-Server-Ubuntu部署指南.md)
- [服务端部署文档](install/服务端部署文档.md)
- [生产部署评估](PRODUCTION_DEPLOYMENT_ASSESSMENT.md)
