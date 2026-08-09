# keys/query 429 风暴根因分析

日期：2026-08-09
分析者：Code Review
状态：已修复、重建镜像、重新部署、运行时 A/B 验证通过（2026-08-09）

---

## 一、结论先行

`keys/query` 的 429 风暴**不是限流配置太严**，而是**客户端陷入了满速死循环**，
而循环的触发者是 **synapse-rust 的一个规范偏差**：`/keys/query` 会把"与调用者
没有共同房间"的用户从响应中**静默丢弃**，导致客户端的"设备列表已过期"标记
永远无法清除，于是无限重查。

**我上一轮的判断是错的。** 上一轮我推测"服务端 keys/query 桶太小"并建议放宽限流，
那是**未经实测的推断**。本轮实测数据完全推翻了它：服务端限流配置健康，放宽限流
只会掩盖一个正在满速烧 CPU 和带宽的客户端死循环。**已撤销**对
`docker/config/rate_limit.yaml` 的修改（且该文件本就未被容器加载，见第五节）。

---

## 二、实测证据链

### 1. 服务端令牌桶是健康的

先耗尽 `keys/query` 的桶，再观察回填：

| 时间点 | x-ratelimit-remaining |
| --- | --- |
| 耗尽后立即 | 0（429） |
| +1s | 50 |
| +3s | 151 |
| +6s | 299 |

配置为 `per_second: 50 / burst_size: 300`，实测**精确按 50/s 回填**，无异常。
桶 key 为 `ratelimit:ip:{ip}:/_matrix/client/v3/keys/query`，**独立**不与其他端点共用。

结论：要让 `remaining` 持续为 0，客户端必须稳定每秒发出 50 次以上。

### 2. 客户端确实在满速轰炸

nginx 访问日志统计：

```
09/Aug/2026:07:44:03   107 次/秒
09/Aug/2026:07:44:02   103 次/秒
09/Aug/2026:08:05:29   100 次/秒
```

- 持续时长：`06:59:50` → `08:16:05` UTC，**76 分钟未中断**
- 累计请求：**112,218 次**
- 响应分布：`200 / 117 字节` × 112,218（**空结果**）、`429` × 339、`200 / 14523 字节` × **1**

即：11 万次请求里只有**第一次**拿到了真实数据，之后全是空响应。

### 3. 429 来自应用层，不是 nginx

- nginx 日志 `lrs="PASSED"`，`limit_req` 放行
- 应用层 WARN：`rate limit rejected request ip=192.168.117.5 endpoint=/_matrix/client/v3/keys/query per_second=50 burst_size=300`
- 客户端 `runtimeFetch.ts:171-177` 早有注释记录该判别法：nginx 的 429 不带
  `x-ratelimit-remaining`，而日志中该头有值

### 4. 请求体：始终在查同一个用户

临时给 nginx 加 `$request_body` 日志（已还原），4 秒采样：

```
225 次  body={"device_keys":{"@test3:matrix.test":[]}}
```

**225 次请求，请求体 100% 一致。**

### 5. 数据库：test3 是 invite 而非 join

```
room_id                                 test3_membership   test1_membership
!BmdGlkNyIAHxnCkqq3qvxgcl:matrix.test   invite             join
!JGGoFjl9V_vv2jyVHd0DNE9E:matrix.test   invite             join
!fb-J00YZMYgIhsZNr6oSwAfA:matrix.test   invite             join
!xSE9L-IL8d2uP6SfLnyTKQak:matrix.test   invite             join
!wKM4QjS2bSFk4BRvZ6p69hlO:matrix.test   invite             join   ← 原始日志中的房间
```

两人实际共处 5 个房间，只是 test3 尚未接受邀请。

---

## 三、完整因果链

```
1. @test1 邀请 @test3 进入 5 个房间（含 !wKM4QjS2bSFk4BRvZ6p69hlO）
        ↓
2. rust-crypto 需要 @test3 的设备密钥才能为被邀请者加密
   → POST /keys/query {"device_keys":{"@test3:matrix.test":[]}}
        ↓
3. 服务端 keys.rs::query_keys 调用 filter_users_with_shared_rooms
   → share_common_rooms_batch 的 SQL 要求 m2.membership = 'join'
   → @test3 是 invite，被排除
        ↓
4. @test3 被静默移出查询，响应为 device_keys:{}（117 字节），
   failures 里也没有它 —— 客户端完全不知道发生了什么
        ↓
5. rust-crypto 只为"响应中出现过的用户"清除过期标记
   → @test3 的标记永不清除 → 立刻重发同一请求
        ↓
6. ~100 次/秒无退避死循环 → 打空 300 容量的桶 → 持续 429
```

### 关键代码位置

**`src/web/routes/e2ee/keys.rs:236-246`** — 静默丢弃：

```rust
} else {
    let mut filtered = serde_json::Map::new();
    if let Some(obj) = device_keys_raw.as_object() {
        for (uid, val) in obj {
            if allowed_users.contains(uid) {   // 不在白名单 → 直接消失
                filtered.insert(uid.clone(), val.clone());
            }
        }
    }
    serde_json::Value::Object(filtered)
};
```

**`synapse-storage/src/membership/mod.rs:490-497`** — 只认 join：

```sql
SELECT DISTINCT m2.user_id
FROM room_memberships m1
JOIN room_memberships m2 ON m1.room_id = m2.room_id
WHERE m1.user_id = $1 AND m1.membership = 'join'
  AND m2.user_id = ANY($2) AND m2.membership = 'join'   -- ← invite 被排除
```

### 一处佐证性的不一致

同一个 `query_keys` 函数里，**空请求分支**（`keys.rs:233`）显式把调用者自己加回：

```rust
shared.push(auth_user.user_id.clone());
```

而**非空请求分支**没有任何兜底。两个分支对"请求的用户必须出现在响应里"这件事
处理不一致，正是这类静默丢弃 bug 的典型气味。

---

## 四、修复建议

### 补丁 A：invite 成员应可查询（正确性，必须）

Matrix 规范要求向**被邀请成员**加密（history visibility 为 `invited` / `shared` 时），
因此其设备必须可查。否则"邀请后在对方接受前发加密消息"这一基本流程不可能成立。

建议**不要**直接改 `share_common_rooms_batch`（它是多处复用的公共 helper，
改动面波及用户目录、资料可见性等）。应在 `/keys/query` 这一层单独放宽，
或新增一个 `share_common_rooms_batch_including_invites` 供 E2EE 路径使用。

### 补丁 B：绝不静默丢弃（健壮性，同样必须）

即便某用户确实不该被查询，也**必须让它出现在响应里**——要么给一个空的设备表，
要么按规范放进 `failures`。静默丢弃会让任何 rust-crypto 客户端陷入死循环，
这是一个会打垮服务端的互操作性地雷，与本次是不是 invite 无关。

补丁 A 解决当前这一例，补丁 B 才是防止同类问题复发的护栏。**两者都要。**

### 不建议做的事

- ❌ 放宽 `keys/query` 限流：掩盖问题，生产环境照样炸
- ❌ 修改客户端 `MatrixRateLimitInterceptor`：客户端行为符合规范，不是它的错

---

## 五、踩坑记录：仓库有两套配置树，只有 deploy/ 是活的

排查中我最初改了 `docker/config/rate_limit.yaml`，**完全无效**——因为运行中的容器
挂载的是另一份：

```
compose 文件： docker/deploy/docker-compose.yml
限流配置：     docker/deploy/config/rate_limit.yaml  → /app/config/rate_limit.yaml
nginx 主配置： docker/deploy/nginx/nginx.conf
nginx 站点配置：docker/deploy/nginx/conf.d/
```

`docker/config/` 与 `docker/nginx/` 下的同名文件是**未生效的历史副本**。

**教训：改容器配置前先 `docker inspect <容器> --format '{{range .Mounts}}...'`
确认真实挂载，不要从仓库里的 compose 文件推断。**

---

## 六、附带发现：sliding sync 自激循环

同期观测（最近 20 秒）：

| 指标 | 次数 | 折算 |
| --- | --- | --- |
| `keys/query` | 1,011 | ~50/s |
| `simplified_msc3575/sync` | 212 | ~10.6/s |
| 应用日志 `Updating presence for user` | 221 | ~11/s |

sliding sync 是长轮询，正常应为 30 秒级一次，实测 **10.6 次/秒**。
且 presence 更新次数与 sync 次数近乎 1:1，指向一个自激回路：

```
sync 请求 → 触发 presence 更新 → presence 变更本身构成"有变化"
       → 下一次 sync 立即返回 → 再次触发 presence 更新 → ...
```

这是**独立于 keys/query 的第二个问题**，建议单独立项排查
（`synapse-services/src/sliding_sync_service/mod.rs:275` 附近）。

---

## 七、本轮客户端侧已修复的两个问题

与 429 无关、但同批日志暴露出来的两个客户端 bug，已修复并有测试覆盖：

| 问题 | 文件 | 修复 |
| --- | --- | --- |
| `createRoom` 400 | `MatrixSpaceService.ts` | 移除 `initial_state` 里的 `m.room.create`（该事件由服务端生成，客户端提供会被拒） |
| 阅读回执重复发送 | `MatrixReceiptService.ts` | 新增 `lastSentReceiptEventId` 按房间去重，`clearCache()` 同步清理 |

验收：`vue-tsc --noEmit` 0 错误；biome clean；
`MatrixReceiptService` 17/17、`MatrixSpaceService` 11/11、`space.contract` 12/12 全绿。

---

## 八、当前状态

- 服务端补丁**已应用**（见第九节），死循环根因已消除。
- 镜像已用 `--no-cache` 清除缓存重新编译并重新部署，运行时 A/B 验证通过。
- 所有诊断期间的临时改动（nginx `$request_body` 日志、`docker/config/rate_limit.yaml`）
  **均已逐字节还原并验证**。

---

## 九、修复实施与运行时验证（2026-08-09）

### 9.1 改动点（`synapse-rust/src/web/routes/e2ee/keys.rs`）

**① `query_keys`：移除"按共同房间（仅 join）过滤 requested_users"**

删除了 `filter_users_with_shared_rooms(...)` 调用及其后的 `else` 静默过滤分支，非空分支改为
原样回显全部被查用户：

```rust
// NOTE: 不再用 filter_users_with_shared_rooms 过滤 requested_users。
// 静默丢弃被查用户会让客户端 SDK 永远清不掉"设备列表过期"标记 → keys/query 死循环。
let device_keys = if requested_users.is_empty() {
    // ……（空请求分支不变，仍 push 自己）
} else {
    // B 修复：把每个被请求用户原样回显进查询，
    // query_keys 内部按 user_id 直接从 DB 取设备密钥，无房间门控。
    device_keys_raw.clone()
};
```

**② `claim_keys`：移除 `one_time_keys.retain(...)` 过滤（保留 `allowed_users` 给 federation 远端领取门控）**

```rust
// 删除：
// if let Some(one_time_keys) = request.one_time_keys.as_object_mut() {
//     one_time_keys.retain(|user_id, _| allowed_users.iter().any(|a| a == user_id));
// }
// 改为：不再因"未共享 join 房间"丢弃被邀请方的一次性密钥。
```

同时把 `let mut request: …KeyClaimRequest` 改为 `let request`（移除已无用的 `mut`，编译零警告）。

**设计取舍**：按第四节建议，**未动**公共 helper `share_common_rooms_batch` / storage / trait，
改动面收敛在 E2EE 的 HTTP 层，避免波及其他复用方（用户目录、资料可见性等）。
`filter_users_with_shared_rooms` 在 `claim_keys`、`device-list` 仍有引用，无 unused import。

### 9.2 构建与部署

```bash
# 清除缓存重新编译（cargo release 全量重编，权威编译验收）
docker build -f docker/Dockerfile.local -t synapse-rust:local --target tools --no-cache .
# → exit 0，Finished release，naming to docker.io/library/synapse-rust:local（sha256:21abd247…）
# → 无任何 warning（含清理后的 unused_mut）

# 用新镜像重建容器
docker compose -f docker/deploy/docker-compose.yml up -d --force-recreate synapse
# → Container synapse-app Recreated / Started
```

> 生效配置树仍是 `docker/deploy/`（非 `docker/config/`）。本次只改了 `src/web/routes/e2ee/keys.rs`，
> 未触碰任何容器配置文件。

### 9.3 运行时 A/B 验证

**场景搭建**（注册两个测试用户，复现原始死循环的邀请关系）：

- `@vfya` 建私有房并邀请 `@vfyb`，`@vfyb` **保持 invite、不 join**（与原始 `@test1`→`@test3` 同构）
- `@vfyb` 上传设备密钥（`POST /keys/upload`，服务端对 device key 签名宽松已验证接受）
- 请求体与原始死循环一致：`POST /keys/query {"device_keys":{"@vfyb:matrix.test":[]}}`

**结果对比**：

| 镜像 | `vfyb` 是否出现在 `device_keys` | 含义 |
| --- | --- | --- |
| 旧镜像 `21ab…`? 前（`@ 00:35:29`） | ❌ 完全 OMITTED，`device_keys: {}` | 静默丢弃 → SDK 永不清脏标记 → 死循环（**原 bug**） |
| 新镜像 `@ 08:49:54` | ✅ PRESENT，含完整设备密钥 | 用户出现在响应里 → SDK 清脏标记 → **循环终止**（**修复生效**） |

新镜像下 `/keys/query` 响应节选：

```json
{
  "device_keys": {
    "@vfyb:matrix.test": {
      "6bdiPdgkz8iMCtHj": {
        "algorithms": ["m.olm.v1.curve25519-aes-sha2", "m.megolm.v1.aes-sha2"],
        "device_id": "6bdiPdgkz8iMCtHj",
        "keys": { "ed25519:VFYBDEV": "VFYBPUBKEYplaceholderAAAA" },
        "signatures": { "@vfyb:matrix.test": { "ed25519:VFYBDEV": "fake" } },
        "user_id": "@vfyb:matrix.test"
      }
    }
  },
  "failures": {},
  "master_keys": {}, "self_signing_keys": {}, "user_signing_keys": {}, "verified_devices": {}
}
```

**`/keys/claim` 同步验证**：`vfya` 对 `vfyb` 发 claim（vfyb 仍为 invitee），
修复前 vfyb 会被整条丢弃；修复后 vfyb **出现在 `one_time_keys` 响应里**（present=true）。
（注：本验证用的占位一次性密钥因签名校验未被入库，故值显示为空 `{}`，但"不被丢弃"这一关键行为已确认。）

### 9.4 验证遗留物（如需清理）

为本次验证在 `matrix.test` 创建了测试用户：`@vfya`、`@vfyb`、`@probe_dummy_x`
（含对应房间 `!X0rHI0Xh8ydITk3TiGaqN-hl:matrix.test` 的 invite 关系）。
均为本地开发数据，可按需通过管理接口清理。

