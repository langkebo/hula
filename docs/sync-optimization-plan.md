# HuLa 前后端同步稳定性优化方案

**日期**: 2026-04-28
**作者**: Claude Code
**参考**: Element Web (https://github.com/element-hq/element-web), Matrix Spec v1.11

## 一、问题定位

### 1.1 现象
- 客户端持续显示"正在重新连接"
- 控制台报错 `M_LIMIT_EXCEEDED: MatrixError: [408] Request timeout`
- 设置在线状态报错 `Matrix client connection timeout`
- 头像状态指示器一直显示离线
- Vant 图标字体被 CSP 阻断 (`http://at.alicdn.com/...woff`)

### 1.2 根本原因(按严重性排序)

#### **【致命 / 后端 BUG】synapse-rust 全局请求超时中间件错误**
位置: `synapse-rust/src/web/middleware.rs:1689-1716` (`request_timeout_middleware`)

```rust
let timeout_secs: u64 = std::env::var("REQUEST_TIMEOUT_SECS")
    .ok().and_then(|s| s.parse().ok())
    .unwrap_or(30);  // 默认 30 秒

let result = tokio::time::timeout(
    std::time::Duration::from_secs(timeout_secs),
    next.run(request),
).await;

match result {
    Err(_) => (
        StatusCode::REQUEST_TIMEOUT,  // 408
        Json(json!({
            "errcode": "M_LIMIT_EXCEEDED",  // 错误的 errcode!
            "error": "Request timeout",
            "retry_after_ms": timeout_secs * 1000
        })),
    ).into_response()
}
```

**问题**:
1. `/sync` 是长轮询接口,客户端用 `timeout=30000` 告诉服务器"我愿意等 30 秒"。中间件在 30 秒时硬性 abort,导致客户端永远拿不到完整长轮询响应
2. 408 (Request Timeout) 不应该使用 `M_LIMIT_EXCEEDED` 错误码,这违反 Matrix 规范
3. 中间件没有路径白名单,所有 endpoint 都受同样限制

**影响**: 客户端每次 sync 都会在 ~30 秒收到 408,然后认为是限流(因为 errcode 是 M_LIMIT_EXCEEDED),进入 RECONNECTING 状态,反复重试,导致连接永远不稳定。

#### **【严重 / 前端架构】Sliding Sync 死代码与配置混乱**
- `MatrixClientService` 充斥 Sliding Sync 相关代码,但 `enableSlidingSync` 标志在生产代码路径中**从未被设为 true**(只在测试文件中)
- `MatrixSlidingSyncService.initialize()` 也从未在生产代码中被调用
- 这造成"代码假装支持 Sliding Sync,实际只跑经典 sync"的混乱状态

#### **【中等 / 前端配置】缺少 Element Web 的关键 startClient 选项**
当前调用:
```ts
client.startClient({
  initialSyncLimit: 20,
  pendingEventOrdering: PendingEventOrdering.Detached,
  slidingSync: this.slidingSyncInstance ?? undefined  // 永远 undefined
})
```

缺失:
- `lazyLoadMembers: true` — 首次同步不加载所有房间成员(Element Web 必备)
- `clientWellKnownPollPeriod: 7200` — well-known 信息每 2 小时刷新一次
- `threadSupport: true` — 启用线程支持

#### **【中等 / 前端】使用 MemoryStore,无持久化**
matrix-js-sdk 默认使用 `MemoryStore`,意味着:
- 每次 App 重启都做完整初始同步
- 给后端带来不必要压力
- 网络抖动后所有缓存丢失

Element Web 用 `IndexedDBStore` + `dbName: 'riot-web-sync'`。

#### **【次要 / 前端】HTTP 超时设置干扰 SDK**
我们之前加了 `localTimeoutMs: 60000`,但 SDK 默认 80 秒。Element Web **不覆盖此值**,完全信任 SDK 默认。

#### **【次要 / 前端】CSP `font-src` 阻断 Vant 图标字体**
`tauri.conf.json:49` 的 base CSP `font-src 'self' data:` 阻止 Vant 自带的 `at.alicdn.com` 字体。虽然平台 override 都设了 `csp: null`,但开发模式或某些环境下基础 CSP 仍然生效。

---

## 二、优化方案

### 2.1 后端修复 (synapse-rust)

#### Fix 1: sync 端点豁免全局请求超时
**文件**: `synapse-rust/src/web/middleware.rs:1689`

**方案 A (推荐)**: 修改 `request_timeout_middleware` 跳过长轮询端点。

```rust
pub async fn request_timeout_middleware(request: Request<Body>, next: Next) -> Response {
    let path = request.uri().path();

    // 长轮询端点跳过全局超时,由各自处理器内部管理超时
    if is_long_polling_endpoint(path) {
        return next.run(request).await;
    }

    let timeout_secs: u64 = std::env::var("REQUEST_TIMEOUT_SECS")
        .ok().and_then(|s| s.parse().ok())
        .unwrap_or(30);
    // ... 现有逻辑
}

fn is_long_polling_endpoint(path: &str) -> bool {
    path.ends_with("/sync") ||
    path.contains("/sync.") ||  // sliding sync /sync.json/* 之类
    path.ends_with("/events") ||
    path.contains("/_matrix/client/v1/sync")
}
```

#### Fix 2: 408 不再使用 M_LIMIT_EXCEEDED 错误码
继续在同一中间件:

```rust
Err(_) => (
    StatusCode::REQUEST_TIMEOUT,  // 408
    Json(json!({
        "errcode": "M_UNKNOWN",  // 408 timeout 不是限流,Matrix 规范无专用 errcode
        "error": format!("Request exceeded server timeout of {}s", timeout_secs)
    })),
).into_response()
```

#### Fix 3: 调整 sync 速率限制配置
**文件**: `synapse-rust/src/web/routes/handlers/sync.rs:78`

当前默认 `per_second: 8, burst_size: 16` 对长轮询客户端不够友好(假设客户端断线重连可能瞬间发出多次请求)。建议:
- 长轮询场景应该按"请求并发度"而非"请求速率"限制
- 或针对 sync 端点提高 burst,例如 `per_second: 20, burst_size: 60`

#### Fix 4: 服务端 sync 内部超时与客户端 timeout 参数解耦
**文件**: `synapse-rust/src/web/routes/handlers/sync.rs:124`

当前:
```rust
let sync_result = tokio::time::timeout(
    std::time::Duration::from_secs(60),  // 硬编码 60s
    params.state.services.sync_service.sync_with_request(...)
).await;
```

应该:
```rust
// 服务器超时 = 客户端要求的 timeout + 缓冲
let server_timeout = Duration::from_millis(timeout.saturating_add(15_000));
let sync_result = tokio::time::timeout(server_timeout, ...).await;
```

### 2.2 前端重构 (hula)

#### Refactor 1: 移除 Sliding Sync 死代码
**文件**: `src/services/matrix/MatrixClientService.ts`

删除以下成员和方法:
- `slidingSyncInstance` 字段
- `createSlidingSync()` 方法
- `getSlidingSync()` 方法
- `resetSlidingSyncInstance()` 方法
- `MatrixClientConfig.enableSlidingSync` 字段
- `startClient()` 中的 sliding sync 逻辑

可以保留 `MatrixSlidingSyncService.ts` 但加注释说明"未启用,留作未来 SSS 支持时用"。

#### Refactor 2: 简化 `startClient()` 与 `syncListener`,对齐 Element Web
```ts
async startClient(): Promise<void> {
  if (!this.client) throw new Error('客户端未初始化')
  try {
    await this.client.startClient({
      initialSyncLimit: 20,
      pendingEventOrdering: PendingEventOrdering.Detached,
      lazyLoadMembers: true,
      clientWellKnownPollPeriod: 2 * 60 * 60,
      threadSupport: true
    })
    this.setupEventListeners()
  } catch (err) {
    this.setConnectionState('ERROR')
    throw err
  }
}

private readonly syncListener = (state: string, prevState?: string, data?: unknown) => {
  this.emit('sync', { state, prevState, data })

  switch (state) {
    case 'PREPARED':
    case 'SYNCING':
      this.setConnectionState('CONNECTED')
      break
    case 'RECONNECTING':
      this.setConnectionState('RECONNECTING')
      break
    case 'ERROR':
      this.setConnectionState('ERROR')
      logger.error(`同步错误`, { prevState, error: data })
      break
    case 'STOPPED':
      this.setConnectionState('DISCONNECTED')
      break
  }
}
```

#### Refactor 3: 移除自定义 `localTimeoutMs`
信任 SDK 默认 80 秒。

#### Refactor 4: 添加 IndexedDBStore 持久化 (可选,渐进式)
```ts
import { IndexedDBStore, MemoryStore } from 'matrix-js-sdk'

const store = (() => {
  try {
    if (typeof indexedDB !== 'undefined') {
      const idbStore = new IndexedDBStore({
        indexedDB: window.indexedDB,
        dbName: 'hula-matrix-sync',
        workerFactory: () => new Worker(/* worker URL */)
      })
      return idbStore
    }
  } catch (e) {
    logger.warn('IndexedDB 初始化失败, fallback 到 MemoryStore', e)
  }
  return new MemoryStore()
})()

const clientOpts: ICreateClientOpts = {
  ...,
  store,
  // ...
}

await store.startup()  // 必须在 createClient 之前
```

#### Refactor 5: 修复 Vant 字体 CSP (双重保险)

**保险 1**: 用本地字体替换 Vant CDN 字体 (`src/styles/vendor/vant-icon-override.scss`):
```scss
@font-face {
  font-family: 'vant-icon';
  src: url('/fonts/vant-icon.woff') format('woff');  /* 本地副本 */
  font-display: swap;
}
```

将 Vant 字体下载到 `public/fonts/vant-icon.woff` 并在 main.ts 早于 vant 之前导入这个 scss。

**保险 2**: 保持 `tauri.conf.json` 的 CSP 已添加 `at.alicdn.com` 白名单(已完成)。

#### Refactor 6: 移除 `useConnectionStatus.ts` 的复杂初始化逻辑
对齐 Element Web 的极简版本:
```ts
import { ref, onMounted, onUnmounted } from 'vue'
import { matrixClientService } from '@/services/matrix/MatrixClientService'

export type ConnectionState = 'online' | 'offline' | 'reconnecting' | 'error'

export function useConnectionStatus() {
  const state = ref<ConnectionState>('online')

  const handleSync = (data: unknown) => {
    const { state: syncState } = data as { state: string }
    switch (syncState) {
      case 'PREPARED':
      case 'SYNCING':
      case 'CATCHUP':
        state.value = 'online'
        break
      case 'RECONNECTING':
        state.value = 'reconnecting'
        break
      case 'ERROR':
        state.value = 'error'
        break
    }
  }

  onMounted(() => matrixClientService.on('sync', handleSync))
  onUnmounted(() => matrixClientService.off('sync', handleSync))

  return { state }
}
```

不再监听 `connectionState` 事件,不再监听浏览器 online/offline(SDK 内部已处理)。

### 2.3 国际化补全
**文件**: `locales/zh-CN/auth.json`, `locales/en/auth.json`
- 添加 `auth.onlineStatus.states.离线` 翻译(已完成 zh-CN,需补 en)

---

## 三、实施顺序

| # | 改动 | 风险 | 优先级 |
|---|------|------|--------|
| 1 | 后端 Fix 1: sync 豁免全局超时 | 中(需要重启后端) | **P0** |
| 2 | 后端 Fix 2: 408 改用 M_UNKNOWN | 低 | **P0** |
| 3 | 前端 Refactor 2: 简化 startClient + syncListener | 中 | **P0** |
| 4 | 前端 Refactor 3: 移除自定义 localTimeoutMs | 低 | **P1** |
| 5 | 前端 Refactor 1: 移除 Sliding Sync 死代码 | 中(代码量大) | **P1** |
| 6 | 前端 Refactor 5: Vant 字体本地化 | 低 | **P2** |
| 7 | 后端 Fix 3: sync 速率限制调整 | 低 | **P2** |
| 8 | 前端 Refactor 4: IndexedDBStore | 高(需大量测试) | **P3** |
| 9 | 后端 Fix 4: 服务端超时与 timeout 参数解耦 | 中 | **P3** |
| 10 | i18n 补全 | 低 | **P3** |

P0 是必须的,完成后即可恢复同步稳定。其余按计划逐步执行。

---

## 四、Element Web 经验总结

| 维度 | Element Web 做法 | HuLa 现状 | 建议 |
|------|------------------|-----------|------|
| Sliding Sync | 默认关闭, labs 实验 | 死代码,从未启用 | 移除死代码,保留扩展点 |
| HTTP 超时 | 不设置, 用 SDK 默认 | 设了 60s | 移除 |
| sync 重连 | 完全交给 SDK 处理 | 自定义 reconnectManager | 移除自定义重连 |
| Store | IndexedDBStore + Worker | MemoryStore | 升级到 IndexedDB |
| 限流处理 | 调用点就地 sleep retry_after_ms | 无 | 关键调用点加重试 |
| lazyLoadMembers | true | 未设置 (默认 false) | 启用 |
| pendingEventOrdering | Detached | Detached | 一致 |
| initialSyncLimit | 20 | 20 | 一致 |

---

## 五、回归验证清单

- [ ] 登录后 5 秒内 syncListener 收到 `PREPARED` 事件
- [ ] 房间列表加载完毕
- [ ] 控制台不再出现 `M_LIMIT_EXCEEDED` / 408
- [ ] 控制台不再出现 `at.alicdn.com` CSP 拒绝
- [ ] "正在重新连接" 横幅消失
- [ ] 头像在线状态指示器正常显示绿色
- [ ] 设置在线状态成功(不再 `Matrix client connection timeout`)
- [ ] 长轮询保持 ~30 秒后服务端正常返回 200(空 changes)
- [ ] 关闭网络 → 客户端进入 reconnecting → 恢复网络 → 自动恢复 online
- [ ] 重启 App 后,得益于 IndexedDBStore,首次同步显著加快(P3 完成后)
