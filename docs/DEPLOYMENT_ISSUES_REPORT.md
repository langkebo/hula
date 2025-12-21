# Hula-servrr 部署问题深度排查报告

## 概述

本报告对 Hula-servrr 项目的部署配置进行了深度排查，发现了多个可能导致部署失败的问题。

**更新**: 以下问题已在本次修复中解决。

---

## ✅ 已修复问题

### 1. MySQL SSL 配置冲突 (已修复)

**问题描述**: `docker-compose.local.yml` 强制要求 SSL 连接，但 Nacos 配置使用 `useSSL=false`

**修复**: 移除了 `docker-compose.local.yml` 中的 `--require_secure_transport=ON` 参数

---

### 2. RocketMQ Broker IP 硬编码 (已修复)

**问题描述**: `broker.conf` 中 `brokerIP1` 硬编码为特定 IP

**修复**: 
- 将 `brokerIP1` 改为占位符 `YOUR_SERVER_IP`
- 更新 `init-passwords.sh` 自动替换为服务器实际 IP

---

### 3. Nacos 配置导出文件缺失 (已修复)

**问题描述**: `deploy.sh` 依赖 `nacos_config_export_*.zip` 文件，但该文件不在 Git 仓库中

**修复**: 
- 创建了 `generate-nacos-config.sh` 脚本自动生成基础配置
- 更新 `deploy.sh` 在找不到配置文件时自动调用生成脚本

---

### 4. Redis 配置文件缺少密码 (已修复)

**问题描述**: `redis/redis.conf` 中没有 `requirepass` 配置

**修复**: 添加了默认密码配置 `requirepass changeme`

---

### 5. Nacos 健康检查端点不一致 (已修复)

**问题描述**: 不同文件使用不同的 Nacos 健康检查端点

**修复**: 统一使用 `http://localhost:8848/nacos/v1/console/health/readiness`

---

### 6. SRS WebRTC CANDIDATE 硬编码 (已修复)

**问题描述**: `srs_conf_7088.conf` 中 `candidate` 硬编码为特定 IP

**修复**: 
- 改为使用环境变量 `$CANDIDATE`
- 更新 `init-passwords.sh` 自动替换

---

### 7. Jenkins 数据目录硬编码 (已修复)

**问题描述**: `docker-compose.prod.yml` 中 Jenkins 数据目录硬编码

**修复**: 改为使用环境变量 `${JENKINS_HOME:-./jenkins/data}`

---

### 8. Redis 健康检查缺少密码 (已修复)

**问题描述**: `docker-compose.yml` 中 Redis 健康检查没有使用密码

**修复**: 添加了 `-a "${REDIS_PASSWORD}"` 参数

---

## 建议的部署流程

1. **克隆仓库后**:
   ```bash
   cd docs/install/docker
   bash init-passwords.sh --ip YOUR_SERVER_IP
   ```

2. **检查配置**:
   ```bash
   # 确认 broker.conf 中的 IP
   grep brokerIP1 rocketmq/broker/conf/broker.conf
   
   # 确认 .env 文件已生成
   cat .env
   ```

3. **启动服务**:
   ```bash
   # 开发环境
   docker compose --env-file .env.local -f docker-compose.local.yml up -d
   
   # 生产环境
   docker compose -f docker-compose.prod.yml up -d
   ```

4. **验证服务**:
   ```bash
   bash health-check.sh
   ```

---

*报告生成时间: 2025-12-21*
