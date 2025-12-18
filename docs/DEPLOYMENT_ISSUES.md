# 部署问题总结与解决方案

## 1. RocketMQ 启动失败 (NullPointerException)
**问题描述**: RocketMQ Broker 容器启动后立即退出，日志显示 `java.lang.NullPointerException at org.apache.rocketmq.broker.schedule.ScheduleMessageService.configFilePath`。
**原因分析**: RocketMQ 5.x 开启了任意延迟消息功能 (`timerWheelEnable=true`)，需要访问 `timerwheel` 目录。如果该目录不存在或权限不足，会导致 NPE。同时 `store` 目录也需要预先创建并授权。
**解决方案**:
- 在启动前手动创建目录并赋予 777 权限：
  ```bash
  mkdir -p rocketmq/namesrv/store rocketmq/broker/store rocketmq/timerwheel
  chmod -R 777 rocketmq/
  ```
- 已更新 `HuLa-Server-Ubuntu部署指南.md` 添加此步骤。

## 2. Docker 容器网络连接问题
**问题描述**: 应用服务 (Gateway, OAuth) 无法连接到 Nacos、MySQL 或 Redis。
**原因分析**:
- `deploy.sh` 脚本生成的 Nacos 配置文件默认使用 `127.0.0.1`。
- Docker 容器内的 `127.0.0.1` 指向容器自身，而非宿主机或基础设施容器。
- `bootstrap.yml` 中的 `@nacos.ip@` 占位符在构建时被替换为 `127.0.0.1` (dev profile)，导致应用尝试连接本地 Nacos。
**解决方案**:
- 修改 `deploy.sh`，支持使用 `SERVICE_HOST` 环境变量（默认为 `host.docker.internal`）生成 Nacos 配置。
- 修改 `docker-compose.services.yml`，为所有服务添加 `NACOS_IP=host.docker.internal` 和 `NACOS_PORT=8848` 环境变量，覆盖 `bootstrap.yml` 的默认值。
- 确保所有服务容器配置了 `extra_hosts: - "host.docker.internal:host-gateway"`。

## 3. 缺失 Dockerfile
**问题描述**: `luohuo-base` 和 `luohuo-ws` 模块缺少 `Dockerfile`，导致 `docker-compose build` 失败。
**解决方案**:
- 为这两个模块创建了 `Dockerfile`，参考了 `luohuo-gateway` 的配置并调整了端口 (Base: 18763, WS: 9501)。

## 4. 数据库密码不一致
**问题描述**: `deploy.sh` 导入数据库时报 `Access denied`。
**原因分析**: `mysql/data` 卷中残留了旧的数据库数据（使用旧密码），而 `.env` 文件被重新生成（新密码），导致连接失败。
**解决方案**:
- 停止容器并删除 `mysql/data` 等数据目录，重新运行 `deploy.sh` 进行初始化。

## 5. Nacos 命名空间问题
**问题描述**: 应用默认尝试连接到 `bootstrap.yml` 中硬编码的 UUID 命名空间，而新部署的 Nacos 只有 `public` 命名空间。
**解决方案**:
- 在 `docker-compose.services.yml` 中设置 `NACOS_NAMESPACE=` (空字符串)，强制应用使用 public 命名空间。

## 6. 服务启动慢
**问题描述**: `hula-oauth` 等服务启动较慢，可能导致健康检查超时或依赖服务连接失败。
**解决方案**:
- 调整 `docker-compose` 的 `healthcheck` 参数（增加 `start_period` 和 `retries`）。
- 确保所有依赖服务（MySQL, Redis, RocketMQ, Nacos）均已就绪且网络可达。
