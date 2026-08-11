# S8 完成概览：EventNotifier Redis 跨实例扇出

## 任务
S8: `EventNotifier` Redis 扇出从未接线（`with_redis` 零调用、无订阅端、60 行死代码），多实例长轮询必然 30s 延迟。

## 完成内容（TDD 全流程）

### S8-A/B: handle_redis_message（Red → Green）
- 提取 `notify_room_local` / `notify_user_local`（仅本地 `notify_waiters()`，不回 Redis）
- `notify_room` / `notify_user` 重构为 local + publish 两步
- 新增 `handle_redis_message(&self, msg)`: 跳过自回声（`sender_instance == self.instance_id`）→ 路由到 local notify
- TDD: 3 个测试（跨实例 room 唤醒、跨实例 user 唤醒、自回声抑制）

### S8-C: start_redis_subscriber 后台任务
- `start_redis_subscriber()`: 创建 `redis::Client`，spawn tokio 任务
- `subscribe_and_listen()`: 订阅 `synapse:events:notify` 频道 → 反序列化 `EventNotifyMessage` → 调 `handle_redis_message`
- 断线 1s 自动重连
- 无 Redis 时安全 no-op（返回 `Ok(())`）
- TDD: 1 个测试验证无 Redis 时 no-op

### S8-D: 容器接线
- `container.rs` `build_domains`: 当 `config.redis.enabled` 时自动创建 Redis pool → `with_redis` + `start_redis_subscriber`
- 失败降级为 `EventNotifier::new()`（纯本地通知）
- 不改 `ServiceContainer::new` 签名，避免影响 60+ 个调用方

## 测试结果
- event_notifier 模块: **23 passed, 0 failed** (原 19 + 新增 4)
- 全 synapse-services: **1422 passed, 1 flaky** (media test，单独运行通过，与 S8 无关)

## 修改的文件
- `synapse-services/src/event_notifier.rs` — 核心实现 + 4 个新测试
- `synapse-services/src/container.rs` — 容器接线
- `synapse-rust-问题确认与优化方案.md` — S8 标记 ✅已修复
