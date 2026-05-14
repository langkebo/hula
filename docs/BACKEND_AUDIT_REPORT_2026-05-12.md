# HuLa 前后端联调后端审查报告

> 审查日期：2026-05-12
> 审查范围：`/Users/ljf/Desktop/hu_ts/hula/docs/BACKEND_ISSUES_2026-05-12.md` 中全部后端相关问题
> 被审查项目：`/Users/ljf/Desktop/hu_ts/synapse-rust`
> 审查基线：在当前工作树基础上继续，不回退用户已有未提交改动

## 1. 审查结论

本次对 `BACKEND_ISSUES_2026-05-12.md` 的逐项复核结果如下：

- 已确认闭环：11 项
- 条件性闭环：1 项
- 已降级为低优先级治理项：1 项
- 审查过程中新增发现并已修复：1 项

严格按当前后端代码、Docker 部署配置、容器运行态和真实 HTTP 响应复核后，结论与原始问题文档存在两处差异：

1. `C-05` 并非单纯“代码已修复”，而是此前仍存在部署配置漂移，导致应用层限流在部署栈中被整体绕过；本轮已修复并完成运行态验证。
2. `M-08` 不应继续按“线上故障”处理。静态 nginx 配置中虽存在重复定义风险，但当前真实响应未复现重复 `Referrer-Policy`。

此外，本轮在重建部署镜像时额外暴露出一个未在原问题单中记录的启动级问题：

- `e2ee_routes` 与 `verification_routes`、`key_backup` 存在重复路由 ownership，fresh build 会在路由台账校验阶段直接 panic，导致 `synapse-app` 无法启动。
- 该问题已在本轮清理，且已通过路由台账测试和容器重建验证。

## 2. 审查方法

本次审查按以下流程执行：

1. 逐条阅读原始问题单，提取全部后端问题编号与期望行为。
2. 在 `synapse-rust` 中按“路由 -> handler -> service -> storage/配置”的链路追溯真实实现。
3. 对已标注“已修复”的项再次检查是否只是代码存在，还是运行态真实可用。
4. 对部署相关问题同时核对以下对象：
   - `docker/deploy/docker-compose.yml`
   - `docker/deploy/config/rate_limit.yaml`
   - `docker/deploy/nginx/nginx.conf`
   - `docker/deploy/nginx/conf.d/default.conf`
   - 容器内实际挂载文件
   - `https://matrix.test` 的真实响应头与状态码
5. 对关键变更补充编译、测试、镜像重建与运行态回归验证。

## 3. 逐项审查结果

| 编号 | 原问题 | 当前结论 | 说明 |
|---|---|---|---|
| `C-05` | 速率限制未实际生效 | 已确认修复 | 根因是部署配置把 `/_matrix/client/` 整体加入 `exempt_path_prefixes`，本轮已移除并完成运行态验证 |
| `H-04` | HTML `formatted_body` 过度清理 | 已确认修复 | 现为白名单净化，不再“去标签化”误伤正常富文本 |
| `H-05` | 修改密码撤销当前设备 Token | 已确认修复 | 当前设备 session 保留，仅撤销其他设备 |
| `H-06` | 好友搜索端点返回 `405` | 已确认修复 | 路由存在，且兼容前端常用的 `query` 参数别名 |
| `M-04` | 验证码 API 契约变更 | 已确认修复 | 后端契约稳定，前端已完成适配 |
| `M-05` | 阅后即焚端点未实现 | 已确认修复 | 路由存在且已挂入有效路由树 |
| `M-06` | 创建私聊端点返回 `405` | 已确认修复 | 私聊创建 POST 路由已存在 |
| `M-07` | 安全备份列表端点返回 `405` | 已确认修复 | 现在不仅可访问，而且返回前端可消费的数据结构 |
| `M-08` | `Referrer-Policy` 响应头重复 | 降级为治理项 | 静态配置存在重复定义风险，但当前线上响应只返回 1 条头 |
| `M-09` | SSO 端点返回 `404` | 条件性闭环 | 代码与 feature 已具备，但是否可用仍依赖部署时 feature 与运行时 IdP 配置 |
| `M-10` | 语音配置端点返回 `404` | 已确认修复 | `v1`/`r0`/`v3` 均已支持，且运行态已验证 |
| `L-02` | SAS/QR 验证 REST 端点未实现 | 已确认修复 | 路由由专门验证模块接管，避免重复定义 |
| `L-03` | 密钥恢复 REST 端点未实现 | 已确认修复 | 路由由 `key_backup` 模块接管并保持可用 |

## 4. 关键证据

### 4.1 `C-05` 部署限流真实根因

原始部署配置文件：

- [rate_limit.yaml](file:///Users/ljf/Desktop/hu_ts/synapse-rust/docker/deploy/config/rate_limit.yaml)

在修复前存在如下错误配置：

```yaml
exempt_path_prefixes:
  - "/_matrix/client/"
```

这会导致部署栈中所有客户端 API 都绕过应用层限流中间件，直接解释以下现象：

- `whoami` 等普通客户端接口没有 `x-ratelimit-*` 头
- 应用层精细化限流看起来“代码存在但运行不生效”

本轮修复后，部署配置改为：

```yaml
exempt_path_prefixes:
  []
```

运行态验证结果：

- `GET /_matrix/client/v3/account/whoami` 返回 `401`
- 同时返回 `x-ratelimit-limit: 100`
- 同时返回 `x-ratelimit-remaining: 99`
- 同时返回 `x-ratelimit-retry-after: 0`

外层 nginx 限流也保持有效：

- 连续 8 次错误登录请求返回：`403 403 403 403 429 429 429 429`

结论：

- 应用层限流已恢复
- nginx 外层限流仍正常工作
- `C-05` 现在属于代码层和部署层同时闭环

### 4.2 `M-07` 安全备份列表不再是空壳

修复文件：

- [e2ee_routes.rs](file:///Users/ljf/Desktop/hu_ts/synapse-rust/src/web/routes/e2ee_routes.rs)

核心修复点：

- `GET /_matrix/client/v3/keys/backup/secure` 不再返回空对象 stub
- handler 现在真正调用 `secure_backup_service.list_backups()`
- 返回结构按 `backup_id` 作为对象键，和前端消费方式对齐

这意味着 `M-07` 不是单纯“405 变 200”，而是功能语义也真正闭环。

### 4.3 `M-10` 语音配置已进入运行态

修复文件：

- [voice.rs](file:///Users/ljf/Desktop/hu_ts/synapse-rust/src/web/routes/voice.rs)

当前已支持：

- `/_matrix/client/r0/voice/config`
- `/_matrix/client/v1/voice/config`
- `/_matrix/client/v3/voice/config`

运行态验证：

- `GET https://matrix.test/_matrix/client/v1/voice/config` 返回 `200`
- 返回体包含前端期望字段：
  - `max_duration`
  - `allowed_formats`
  - `auto_transcribe`
- 响应头同时包含：
  - `x-ratelimit-limit`
  - `x-ratelimit-remaining`
  - `x-ratelimit-retry-after`

### 4.4 `M-08` 当前不再复现

虽然 nginx 静态配置中仍可见多个 `Referrer-Policy` 定义来源，但当前部署链路的真实验证结果为：

```text
referrer-policy: strict-origin-when-cross-origin
```

只返回 1 条头。

因此，本项更准确的分类应为：

- 不是当前线上阻塞缺陷
- 是一个配置归并与治理问题

### 4.5 `M-09` 需要区分“代码存在”和“部署启用”

SSO 相关代码在后端仓内已经存在，且 Docker 构建参数已包含：

- `cas-sso`
- `saml-sso`

但该类能力仍受两层约束：

1. 编译时 feature 是否被实际启用
2. 运行时 CAS / SAML / OIDC 配置是否完整

因此，本项不能简单写成“永远已修复”，更准确说法是：

- 后端实现已具备
- 部署未启用或 IdP 配置缺失时，仍可能对外表现为 `404`

## 5. 本轮新增发现与修复

### 5.1 Fresh build 启动级阻塞：重复路由注册

在重建 `synapse-rust:local` 并强制重建 `synapse-app` 时，容器一度进入持续重启，日志中出现：

```text
route manifest contains duplicate entries
```

重复来源包括：

- `e2ee_routes`
- `verification_routes`
- `key_backup`

它们对同一组路径重复声明 ownership，导致路由台账校验拒绝启动。

本轮处理：

- 清理 [e2ee_routes.rs](file:///Users/ljf/Desktop/hu_ts/synapse-rust/src/web/routes/e2ee_routes.rs) 中已由专门模块接管的验证/密钥恢复重复路由
- 保留 `secure backup` 等确属该模块所有的接口
- 删除已失效的重复 handler，避免 dead code 和 ownership 混淆

验证结果：

- 集成测试 `declared_route_manifest_validates_with_no_duplicates` 通过
- 新镜像重建后 `synapse-app` 重新进入 `healthy`

这项问题不在原始问题单中，但属于高优先级工程风险，建议纳入后续治理台账。

## 6. 代码与部署侧改动清单

本轮直接涉及并已验证的关键文件如下：

- [docker/deploy/config/rate_limit.yaml](file:///Users/ljf/Desktop/hu_ts/synapse-rust/docker/deploy/config/rate_limit.yaml)
- [src/web/routes/e2ee_routes.rs](file:///Users/ljf/Desktop/hu_ts/synapse-rust/src/web/routes/e2ee_routes.rs)
- [src/web/routes/voice.rs](file:///Users/ljf/Desktop/hu_ts/synapse-rust/src/web/routes/voice.rs)
- [src/web/middleware.rs](file:///Users/ljf/Desktop/hu_ts/synapse-rust/src/web/middleware.rs)
- [tests/integration/api_route_ledger_tests.rs](file:///Users/ljf/Desktop/hu_ts/synapse-rust/tests/integration/api_route_ledger_tests.rs)

此前已经完成、并在本轮复核中被确认有效的关键文件如下：

- [src/common/sanitizer_v2.rs](file:///Users/ljf/Desktop/hu_ts/synapse-rust/src/common/sanitizer_v2.rs)
- [src/auth/mod.rs](file:///Users/ljf/Desktop/hu_ts/synapse-rust/src/auth/mod.rs)
- [src/web/routes/account_compat.rs](file:///Users/ljf/Desktop/hu_ts/synapse-rust/src/web/routes/account_compat.rs)
- [src/web/routes/friend_room.rs](file:///Users/ljf/Desktop/hu_ts/synapse-rust/src/web/routes/friend_room.rs)
- [src/web/routes/burn_after_read.rs](file:///Users/ljf/Desktop/hu_ts/synapse-rust/src/web/routes/burn_after_read.rs)
- [src/web/routes/room.rs](file:///Users/ljf/Desktop/hu_ts/synapse-rust/src/web/routes/room.rs)
- [src/web/routes/handlers/room.rs](file:///Users/ljf/Desktop/hu_ts/synapse-rust/src/web/routes/handlers/room.rs)

## 7. 验证记录

### 7.1 测试与构建

- `cargo test --all-features --locked --test integration declared_route_manifest_validates_with_no_duplicates -- --nocapture`
- `docker build -t synapse-rust:local -f docker/Dockerfile .`
- `docker compose -f docker/deploy/docker-compose.yml up -d --force-recreate synapse`

### 7.2 运行态 HTTP 验证

- `GET https://matrix.test/_matrix/client/v1/voice/config`
- `GET https://matrix.test/_matrix/client/v3/account/whoami`
- `GET https://matrix.test/_matrix/client/versions`
- 连续错误请求 `POST https://matrix.test/_matrix/client/v3/login`

### 7.3 关键结果

- `synapse-app` 当前为 `healthy`
- `voice/config` 返回 `200`
- `whoami` 返回限流头
- `login` 仍触发 nginx `429`
- `Referrer-Policy` 当前只返回 1 条

## 8. 最终实施清单

### 已完成

- [x] 修复部署侧 `rate_limit.yaml` 误豁免客户端 API 的问题
- [x] 恢复应用层限流头在真实请求中的可见性
- [x] 保持 nginx 外层登录限流有效
- [x] 完成 `voice v1` 路由和字段兼容验证
- [x] 将安全备份列表接口补齐为可消费实现
- [x] 清理 fresh build 下的重复路由注册，恢复新镜像可启动性

### 建议尽快继续

- [ ] 为 `M-09` 增加一份单独的 SSO 部署验收清单，覆盖 feature、运行时开关、IdP 元数据、回调地址、自检接口
- [ ] 为部署流水线补一条 smoke test，自动检查 `/_matrix/client/v3/account/whoami` 是否返回 `x-ratelimit-*`
- [ ] 为 fresh image 启动增加一次路由台账验收，避免重复路由只在部署时暴露

### 低优先级治理

- [ ] 将 `Referrer-Policy` 的来源收敛到单一 nginx 配置文件，避免环境差异导致重复头偶发回归
- [ ] 为 nginx 生成的 `429` 响应统一补充 `Retry-After`，与应用层限流语义保持一致

## 9. 最终结论

如果只看“代码是否存在”，原问题单对后端问题的修复判断大体方向是对的；但如果按“真实部署是否生效、接口是否真正可消费、fresh build 是否可启动”这一更严格标准复核，则需要做如下修正：

- `C-05` 原先并未彻底闭环，本轮才完成部署层修复和运行态闭环
- `M-08` 不是当前线上故障，应降级为配置治理项
- `M-09` 不应表述为无条件闭环，应明确依赖部署启用条件
- 新增发现的“重复路由导致 fresh build 启动失败”属于高优先级工程风险，已在本轮修复

综合判断：

- `synapse-rust` 已能支撑当前 HuLa 联调所需的大多数后端能力
- 本轮修复后，联调阻塞项已基本清空
- 剩余工作主要从“补接口”转向“部署治理、配置收敛、发布门禁”
