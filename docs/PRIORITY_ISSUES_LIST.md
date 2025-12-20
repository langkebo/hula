# 优先级问题清单 (Priority Issues List)

## P0 - 紧急 (Blocker/Critical)
> 必须立即修复，否则存在严重安全风险或导致核心功能不可用。

1.  **[安全] 敏感配置硬编码**
    - **位置**: `resources/*.yml`, `docs/.../nacos/.../*.yml`
    - **描述**: 数据库、Redis、RocketMQ 密码明文存储。
    - **行动**: 替换为环境变量，并在部署脚本中注入。

2.  **[部署] Linux 环境网络连接失败**
    - **位置**: `docker-compose.services.yml`
    - **描述**: 使用 `host.docker.internal` 导致 Linux 服务器上服务无法连接中间件。
    - **行动**: 配置 `extra_hosts` 或改用 Docker Bridge 网络别名。

3.  **[数据] 分布式事务失效**
    - **位置**: `BaseEmployeeBiz.java`
    - **描述**: `@GlobalTransactional` 被注释，多表操作（用户表、员工表、租户关联表）缺乏事务保证。
    - **行动**: 恢复 Seata 配置并测试事务回滚。

## P1 - 高 (Major)
> 严重影响开发效率或系统稳定性。

4.  **[性能] 推送服务 N+1 查询**
    - **位置**: `PushServiceImpl.java`
    - **描述**: `pushToUsers` 循环调用数据库查询。
    - **行动**: 实现批量查询设备接口。

5.  **[质量] 静态检查被禁用**
    - **位置**: `pom.xml`
    - **描述**: `<checkstyle.skip>true</checkstyle.skip>`。
    - **行动**: 开启检查并修复现有严重警告。

## P2 - 中 (Minor)
> 影响维护成本或存在潜在隐患。

6.  **[维护] 部署脚本冗余**
    - **位置**: `one_click_deploy.sh` vs `docs/install/docker/deploy.sh`
    - **描述**: 维护两套逻辑不一致的脚本。
    - **行动**: 合并脚本。

7.  **[功能] 统计接口未实现**
    - **位置**: `PushServiceImpl.getStatistics`
    - **描述**: 返回 Mock 数据。
    - **行动**: 实现真实的 SQL 统计逻辑。

## P3 - 低 (Trivial)
> 优化项。

8.  **[体验] 部署过程无进度条**
    - **描述**: `mvn install` 输出过多日志，缺乏清晰进度。
    - **行动**: 优化脚本输出，使用 `mvn -q`。
