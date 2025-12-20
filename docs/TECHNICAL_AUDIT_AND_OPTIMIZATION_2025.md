# HuLa-Server 技术审计与质量评估报告

## 1. 代码质量方面

- **异常处理缺失**：
  - 发现 `luohuo-cloud/luohuo-im/luohuo-im-controller/src/main/java/com/luohuo/flex/im/controller/system/domain/Server.java` 文件中存在多处未处理的异常情况（如 `catch (UnknownHostException e) {}` 空代码块），导致系统出错时无法有效追踪问题。
  - `AiVideoServiceImpl.java` 中部分逻辑缺乏细粒度的异常捕获，仅作通用处理。

- **代码耦合度高**：
  - `luohuo-im` 模块的代码耦合度过高，例如 `com.luohuo.flex.im.controller.system` 包下的 `Server` 类混合了系统底层监控逻辑与即时通讯业务逻辑，缺乏模块化设计，建议将系统监控功能剥离至独立的监控模块。

- **硬编码配置**：
  - 多处存在硬编码配置，例如 `Server.java` 中硬编码了 IP 地址 `"127.0.0.1"` 和 `"未知"` 字符串。
  - `application-prod.yml` 中日志路径硬编码为 `/var/log/hula/hula-im.log`。
  - 建议将这些配置迁移到 Nacos 配置中心或环境变量中管理。

- **文档缺失**：
  - 缺少必要的代码注释和文档说明，特别是核心业务逻辑如 `ResourceBiz.java` 中的权限判断逻辑，虽然有 Javadoc 但缺乏对业务流程的详细注释。

## 2. 数据库方面

- **索引缺失**：
  - `hula_im` (对应 `luohuo_dev.sql`) 数据库缺少必要的索引优化。例如 `ai_api_key` 表的 `user_id` 和 `platform` 字段未建立索引，将严重影响查询性能。

- **数据冗余**：
  - 发现 `ai_audio` 和 `ai_chat_conversation` 表存在数据冗余问题，例如同时存储 `model_id` 和 `model` (模型名称)，一旦模型名称变更需要维护多处数据一致性。

- **连接池配置**：
  - 数据库连接池配置不合理，`application-prod.yml` 中 `maximum-pool-size` 设置为 `50`，对于高并发场景可能过大导致数据库连接耗尽，或过小导致应用排队，建议根据实际压测结果调整。

- **备份缺失**：
  - 缺少定期的数据库备份策略，`scripts/` 目录下未发现自动备份脚本。

## 3. 项目权限管理

- **角色权限**：
  - `TENANT_ADMIN` 角色的权限设置过于宽松，在 `ResourceBiz.java` 中直接跳过权限检查 (`if (isAdmin) ...`)，建议细化管理员权限。

- **审计日志**：
  - 敏感操作缺少操作日志记录，如 `AiVideoServiceImpl` 中的视频生成操作未记录操作审计日志。

- **API鉴权**：
  - 部分 API 接口（如 `Server.java` 对应的系统监控接口）在代码层面未见明确的 `@PreAuthorize` 注解，可能依赖 URL 拦截，存在安全隐患。

- **密钥管理**：
  - SSH 密钥管理不规范，`deploy.sh` 脚本未涉及密钥的安全分发与回收，服务器上可能存在未回收的临时密钥。

## 4. 路径管理问题

- **部署路径**：
  - 项目部署路径当前依赖 `deploy.sh` 执行目录，建议规范化为 `/opt/hula` 或符合公司运维规范的固定路径。

- **日志路径**：
  - 日志文件路径 `/var/log/hula/hula-im.log` 权限设置不当，默认可能需要 root 权限写入，建议调整为应用用户目录或通过 Docker 卷挂载。

- **临时文件**：
  - 临时文件（如 `target/` 构建产物）在 `deploy.sh` 中未及时清理，长期运行可能占用磁盘空间。

- **配置文件**：
  - 配置文件路径分散在 `luohuo-im`, `luohuo-support`, `luohuo-generator` 等多个模块的 `src/main/resources` 及 `install/nacos` 中，至少分散在 5 个不同位置，维护成本高。

## 5. 其他运维问题

- **监控覆盖**：
  - 监控系统对 `hula-im` 服务的覆盖不完整，仅开启了基础的 Prometheus 端点，缺乏对业务指标（如消息发送延迟、AI 生成成功率）的监控。

- **告警阈值**：
  - 告警阈值设置不合理，代码中存在如 `OSHI_WAIT_SECOND = 1000` 这样的硬编码等待时间。

- **CI/CD**：
  - CI/CD 流水线缺失，未找到有效的 `Jenkinsfile` 或 GitHub Actions 配置，`deploy.sh` 仅为本地部署脚本，缺少必要的单元测试和代码质量门禁（SonarQube）。

- **资源使用**：
  - 系统资源使用率配置中，文件上传限制为 `50MB`，对于大视频生成场景可能接近预警值，需评估调整。

请后端开发团队针对以上问题逐一进行优化和完善，建议优先处理高风险问题。
