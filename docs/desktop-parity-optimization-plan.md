# HuLa 桌面端对标 Element Web 优化方案

**日期**: 2026-04-28
**作者**: Claude Code
**参考**: element-hq/element-web (含已合并的 matrix-react-sdk) + element-hq/element-desktop
**前置文档**: `docs/sync-optimization-plan.md`(同步稳定性已修)

---

## 一、整体定位

HuLa 与 Element Web 都基于 matrix-js-sdk,但壳不同:Element Web 在浏览器跑,Desktop 用 Electron 二壳;HuLa 直接用 Tauri v2 + Vue 3 一体化。这意味着部分能力 HuLa **天生更强**(Rust 后端、安全沙箱、bundle 更小),部分能力 **天生更弱或缺失**(没有 Compound 设计系统、没有 RovingTabIndex 基建、没有 rageshake/Seshat)。

下表为对标矩阵(✅ 已具备,⚠️ 部分具备,❌ 缺失):

| 维度 | Element Web/Desktop | HuLa 现状 | 差距 |
|---|---|---|---|
| Crypto: Rust crypto WASM | `initRustCrypto` 默认启用 | SDK 默认走 libolm | ⚠️ |
| Crypto: SSSS 引导 UI | `SetupEncryptionStore` + Toast | 加密 settings 存在但无引导 | ⚠️ |
| Crypto: UTD 重试与上报 | `DecryptionFailureBody` + `DecryptionFailureTracker` | `MatrixCryptoService` 有但 UI 简陋 | ⚠️ |
| Crypto: Cross-signing key 备份 | DeviceListener toast | 无 | ❌ |
| Store: IndexedDBStore + Worker | `indexeddb.worker.ts` | MemoryStore | ❌ |
| Pickle key 走 OS keychain | Electron `safeStorage` | localStorage 明文 | ❌ |
| 房间列表 v3 算法 | `RoomListStoreV3` 服务端过滤 | 自有 Pinia store + Sliding Sync 死代码 | ⚠️ |
| Timeline 双向分页 | `TimelinePanel` paginate | 房间内分页存在 | ✅ |
| 启动分阶段加载 | 3 阶段 + 并行 | 同步入口加载所有 | ⚠️ |
| ErrorBoundary | 全局 fallback UI + 报告按钮 | 无全局兜底 | ❌ |
| Rageshake 环形日志 | IndexedDB ring buffer + 上传 | Logger 写文件,无环形截窗 | ⚠️ |
| OIDC + refresh token | `TokenRefresher` + soft logout | 仅基础登录 | ❌ |
| Network resilience | 浏览器 online/offline + retryImmediately | 已加 (上一轮修复) | ✅ |
| System tray badge overlay | tray 未读角标 | Tauri tray 存在,无未读 badge | ⚠️ |
| Native notifications | Howler 声音 + Action Center | tauri-plugin-notification 存在 | ⚠️ |
| Auto-updater 签名 | electron-updater + Squirrel/NSIS | tauri-plugin-updater 已配置 | ✅ |
| Deep link `matrix.to` | `app.setAsDefaultProtocolClient` | tauri-plugin-deep-link 未启用 | ❌ |
| Window state 持久化 | electron-window-state | 无,启动用默认 size | ❌ |
| Spell check | Electron `setSpellCheckerLanguages` | WebView2/WKWebView 默认行为,无控制 UI | ⚠️ |
| Native 全文搜索 | Seshat (Rust) | 无,仅 Matrix `/search` | ❌ |
| Keyboard navigation 基建 | `RovingTabIndex` + `KeyBindingsManager` | 散落 `@keydown` | ❌ |
| Screen reader 支持 | `aria-live` + Compound a11y | Naive UI/Vant 部分覆盖 | ⚠️ |
| i18n RTL 支持 | 完整 | 仅 zh/en,无 RTL CSS | ⚠️ |
| Unit + E2E 测试 | Jest + Playwright + Synapse fixture | Vitest + Playwright + 部分 fixture | ⚠️ |
| 类型 strict | `strict + exactOptionalPropertyTypes` | `strict` 部分 | ⚠️ |
| Bundle 分析 | `bundlewatch` CI | `pnpm metrics:bundle` 已有 | ✅ |

---

## 二、问题清单(按优先级)

### P0 — 影响日常使用 / 安全性

#### P0-1: Pickle key 与 access token 明文存储
- **现状**: `localStorage` 直接存 `access_token`、`device_id`、加密相关 pickle key。Tauri WebView 隔离比浏览器强,但仍可被 XSS / DevTools 抓走。
- **风险**: 一台被植入恶意 npm 包的开发机可在 dev mode 下窃取 token;生产环境 WebView2 缓存外泄会暴露所有会话。
- **方案**: 用 Tauri `tauri-plugin-stronghold` 或 `keyring` 把 token + pickle key 写入 OS keychain(macOS Keychain / Windows Credential Manager / Linux Secret Service)。前端只持有 short-lived 拷贝。

#### P0-2: 没有 ErrorBoundary 全局兜底
- **现状**: Vue `app.config.errorHandler` 只有 logger,组件 throw 后整树白屏。
- **风险**: 任何一个组件 render 抛错都把整个 App 干掉,用户只能强退。
- **方案**: 顶层包一层 `ErrorBoundary.vue`(Vue 3 用 `errorCaptured` + `onErrorCaptured`),报错时显示降级 UI,提供"复制日志/重启 App/清缓存重登"按钮,与 rageshake 链路打通。

#### P0-3: 没有 IndexedDBStore,每次重启全量同步
- **现状**: matrix-js-sdk 默认 MemoryStore,App 关闭后所有 timeline、房间状态丢失。
- **影响**: 启动到房间列表可见 ≥ 5s(需要等 initial sync),给后端造成不必要的全量负载,网络抖动后体验差。
- **方案**: `createClient` 传入 `IndexedDBStore`,数据库名 `hula-matrix-sync`,worker 端用 `IndexedDBStoreWorker`(独立于现有 `matrixSdk.worker.ts`,避免互相阻塞)。Element Web 同款 `pollTimeout: 30000` + `dbName` 命名空间。

#### P0-4: Sliding Sync 死代码污染
- **现状**: 经上一轮已部分清理,但 `MatrixSlidingSyncService.ts`、`SlidingSyncReconnectManager.ts`、`stores/domains/chat/room.ts` 中的 `registerCallbacks`、`RealtimeService.ts` 的 `applySlidingSyncUnreadCounts` 仍调用永不执行的代码。
- **影响**: 维护负担,新人困惑,IDE 误导。
- **方案**: 整体删除 `sync/` 目录,清理所有引用;未读计数改走经典 sync 的 `Room.getUnreadNotificationCount()`(已可用)。日后真要上 SSS,从 `MatrixClientService` 一处接入即可。

### P1 — 显著影响体验 / 桌面感

#### P1-1: 没有 Window state 持久化
- **现状**: 每次启动用 `tauri.conf.json` 默认尺寸/位置。
- **方案**: 用 `tauri-plugin-window-state`(官方插件,已稳定),Cargo.toml 加依赖,主进程注册即可。覆盖 size、position、maximized、fullscreen。

#### P1-2: 没有 deep link 协议处理
- **现状**: `matrix.to` URL、`element://` 链接外部点击只能在浏览器打开。
- **方案**: 启用 `tauri-plugin-deep-link`,注册 `matrix:` / `hula:` scheme,前端 `Window.onDeepLink` 解析后路由到对应房间/用户。

#### P1-3: Tray 没有未读 badge
- **现状**: Tauri tray icon 存在,但 dock/taskbar 上不显示未读小红点。
- **方案**: 收到新消息时聚合所有房间 `notification_count`,通过 Tauri command 调用 `app.set_badge_count`(macOS)+ tray icon overlay(Windows/Linux 用动态 PNG)。Element Desktop 实现可参考。

#### P1-4: 没有 RovingTabIndex / 键盘导航基建
- **现状**: Tab 键序逻辑随 DOM 顺序;⌘K/Ctrl+K 没有快速搜索;消息列表 ↑↓ 没有导航。
- **方案**:
  - 写一个 `useRovingTabIndex` composable(类似 React 版),房间列表/上下文菜单/快捷面板都接入。
  - 集中快捷键定义到 `src/accessibility/keybindings.ts`,在 `App.vue` 顶层 `useKeyBindings()` 注册。
  - 至少实现:Ctrl+K 房间快搜、Ctrl+/ 快捷键帮助、Esc 关闭模态、↑↓ 房间列表导航。

#### P1-5: Rageshake 环形日志
- **现状**: `Logger` 直接写 Tauri plugin-log,日志一旦上限就丢失,问题反馈时拿不到崩溃前 N 条上下文。
- **方案**:
  - 在 `Logger` 之外加一层 IndexedDB ring buffer(最近 10 万行,自动 evict)。
  - 全局 `console.error`、`window.onerror`、`unhandledrejection` 全部捕获写入 ring buffer。
  - "提交反馈"按钮一键打包 ring buffer + sysinfo + git sha 给后端 / 邮件。

#### P1-6: 启动分阶段优化
- **现状**: `main.ts` 按顺序加载 i18n、Pinia、theme、router、SDK,首屏 paint 等所有 init 完。
- **方案**: 拆 3 阶段:
  - **Stage 1 (sync-blocking)**: i18n 默认包、theme tokens、router → 立即渲染 splash + 登录页。
  - **Stage 2 (post-paint)**: Pinia hydrate、Tauri plugin init。
  - **Stage 3 (lazy)**: SDK init、IndexedDBStore、room list service。
  - 用 `requestIdleCallback` 调度 Stage 3,让登录页更快可交互。

### P2 — 长期质量 / 体验细节

#### P2-1: Crypto 引导流程缺失
- **现状**: `MatrixCryptoService`、`MatrixVerificationService`、`MatrixKeyBackupService` 都在,但没有 Element 那种"启动后自动检测未验证设备 / 未备份秘钥 → 弹 Toast 引导"的链路。
- **方案**: 写一个 `useDeviceListener` composable 对应 Element 的 `DeviceListener`:
  - 监听 `crypto.devicesUpdated`、`crypto.userTrustStatusChanged`、`crypto.keyBackupStatus`。
  - 三种 Toast:`SetupEncryption`(首次开启 SSSS)、`UnverifiedSession`(本设备未验证)、`KeyBackupNeeded`(没启用备份)。

#### P2-2: 解密失败提示
- **现状**: 解密失败的消息直接显示空 / "无法解密",用户不知道原因。
- **方案**: 写 `DecryptionFailureBody.vue`,根据 `withheldReason`/`failureCode` 给出"等待密钥/请求密钥/会话过期"等可操作建议;30 秒后自动 retry decrypt。

#### P2-3: Cross-signing 密钥备份 toast
- **现状**: 设置里有备份页,但用户不会主动去开。
- **方案**: 见 P2-1 中的 `KeyBackupNeeded` Toast。

#### P2-4: OIDC + refresh token
- **现状**: `MatrixOidcService` 已存在但未走 token refresh 链路;access token 过期会直接登出。
- **方案**: 实现 `OidcTokenRefresher` 等价物:
  - SDK `createClient` 传 `tokenRefreshFunction`。
  - 401 + `M_UNKNOWN_TOKEN` + `soft_logout: true` 时进入"软登出"UI(保留缓存,密码重登)。

#### P2-5: 房间列表算法对齐
- **现状**: HuLa 房间列表用 Pinia store 维护数组,排序为最近活跃。Element v3 多维度:invites/favourites/dms/untagged/low priority,带置顶、人工排序。
- **方案**: 重构 `stores/domains/chat/room.ts`,引入 5 个 sublist + per-sublist 排序模式。复用 Element 的 ordering 算法即可(`recent`、`alphabetic`、`manual`)。

#### P2-6: 全文搜索本地索引
- **现状**: `MatrixSearchService` 走服务端 `/search`,断网无效,大房间慢。
- **方案**: 类比 Seshat,在 Tauri Rust 端开一个 `tauri-plugin-search`,用 `tantivy`(Rust 全文搜索引擎)做本地索引;事件入库时同步索引。可作为独立专项(工程量大)。

#### P2-7: i18n 完整性 + RTL
- **现状**: 仅 zh-CN / en-US,无阿拉伯语/希伯来语。CSS 没用 `logical properties`(`margin-inline-start`)。
- **方案**: 重要弹窗/按钮做 RTL 验证;styles 把 `padding-left/right` 替换为 `padding-inline-start/end`;新增 `ar`、`he` locale 骨架。

### P3 — 长期工程质量

#### P3-1: TypeScript 严格度
- **现状**: `tsconfig.json` 启用 `strict` 但没启 `exactOptionalPropertyTypes`、`noUncheckedIndexedAccess`。
- **方案**: 渐进开启,先用 `// @ts-expect-error` 锁定边界,逐文件迁移。

#### P3-2: Test fixture 完善
- **现状**: 单元测试有,但缺"真实 Synapse 本地启动 + 自动登录"的 E2E fixture。
- **方案**: 在 `playwright/` 加一个 `synapse-rust` Docker fixture(`docker-compose.test.yml`),Playwright `globalSetup` 启停。

#### P3-3: 性能监控
- **现状**: `WebVitalsObserver`、`PerformanceReporter` 已有但没有上报后端聚合。
- **方案**: 写一个 `/_synapse/admin/v1/metrics/client` 接口接收前端指标,Grafana 面板可视化(P0 同步 latency、P95 房间列表渲染、内存峰值)。

---

## 三、推荐实施顺序与工时估算

| # | 项目 | 优先级 | 工时(人日) | 风险 |
|---|---|---|---|---|
| 1 | P0-3 IndexedDBStore | P0 | 2-3 | 中,要写 worker + 序列化测试 |
| 2 | P0-2 ErrorBoundary 全局 | P0 | 0.5 | 低 |
| 3 | P0-1 Token/pickle 入 keychain | P0 | 2 | 中,跨平台测试 |
| 4 | P0-4 删除 SlidingSync 死代码 | P0 | 1 | 低,要回归未读计数 |
| 5 | P1-5 Rageshake ring buffer | P1 | 1 | 低 |
| 6 | P1-1 Window state 插件 | P1 | 0.5 | 低 |
| 7 | P1-2 Deep link | P1 | 1 | 低 |
| 8 | P1-3 Tray badge | P1 | 1 | 中,跨平台 |
| 9 | P1-4 RovingTabIndex + KeyBindings | P1 | 3 | 中 |
| 10 | P1-6 启动分阶段 | P1 | 1 | 低 |
| 11 | P2-1/2/3 Crypto 引导 | P2 | 4 | 高,加密路径敏感 |
| 12 | P2-4 OIDC refresh | P2 | 2 | 中 |
| 13 | P2-5 房间列表算法 v3 | P2 | 3 | 中 |
| 14 | P2-7 RTL + i18n | P2 | 2 | 低 |
| 15 | P2-6 Tantivy 全文搜索 | P2 | 5+ | 高,独立专项 |
| 16 | P3 工程化 | P3 | 持续 | 低 |

**总计**: P0 约 5.5 人日,P1 约 7 人日,P2 约 16+ 人日。建议两周内完成 P0+P1。

---

## 四、关键技术对照表

### 4.1 IndexedDBStore 集成示例

```ts
// src/services/matrix/store/createMatrixStore.ts
import { IndexedDBStore, MemoryStore } from 'matrix-js-sdk'

export async function createMatrixStore() {
  if (typeof indexedDB === 'undefined') {
    return new MemoryStore({ localStorage: window.localStorage })
  }

  try {
    const store = new IndexedDBStore({
      indexedDB: window.indexedDB,
      dbName: 'hula-matrix-sync',
      localStorage: window.localStorage,
      // worker 实例化函数,Element Web 同款延迟创建
      workerFactory: () => new Worker(
        new URL('./indexeddb.worker.ts', import.meta.url),
        { type: 'module' }
      )
    })
    await store.startup()
    return store
  } catch (e) {
    console.warn('[MatrixStore] IndexedDB failed, fallback to MemoryStore', e)
    return new MemoryStore({ localStorage: window.localStorage })
  }
}
```

```ts
// src/workers/indexeddb.worker.ts
import { IndexedDBStoreWorker } from 'matrix-js-sdk/lib/store/indexeddb-store-worker'

const worker = new IndexedDBStoreWorker(postMessage as never)
self.addEventListener('message', worker.onMessage)
```

`createClient` 调用点:
```ts
const store = await createMatrixStore()
const clientOpts: ICreateClientOpts = { ..., store }
this.client = createClient(clientOpts)
```

### 4.2 ErrorBoundary 示例

```vue
<!-- src/components/common/ErrorBoundary.vue -->
<script setup lang="ts">
import { ref, onErrorCaptured } from 'vue'

const error = ref<Error | null>(null)

onErrorCaptured((err) => {
  error.value = err as Error
  // 上报 ring buffer
  window.__hulaCrash?.(err)
  return false
})

function reset() {
  error.value = null
  window.location.reload()
}
</script>

<template>
  <div v-if="error" class="error-fallback">
    <h2>{{ $t('error.crashed') }}</h2>
    <pre>{{ error.message }}</pre>
    <button @click="reset">{{ $t('error.restart') }}</button>
  </div>
  <slot v-else />
</template>
```

`App.vue` 顶层 `<ErrorBoundary><RouterView /></ErrorBoundary>`。

### 4.3 Tauri keychain 集成

```rust
// src-tauri/src/command/secure_storage.rs
use keyring::Entry;

#[tauri::command]
pub fn store_secret(service: &str, key: &str, value: &str) -> Result<(), String> {
    Entry::new(service, key).map_err(|e| e.to_string())?
        .set_password(value).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_secret(service: &str, key: &str) -> Result<Option<String>, String> {
    match Entry::new(service, key).map_err(|e| e.to_string())?.get_password() {
        Ok(v) => Ok(Some(v)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string())
    }
}
```

前端:
```ts
import { invoke } from '@tauri-apps/api/core'

export async function setAccessToken(token: string) {
  await invoke('store_secret', { service: 'hula', key: 'access_token', value: token })
}
```

### 4.4 RovingTabIndex composable 示例

```ts
// src/composables/useRovingTabIndex.ts
import { ref, onMounted, onUnmounted, type Ref } from 'vue'

export function useRovingTabIndex(containerRef: Ref<HTMLElement | null>, itemSelector = '[role="option"]') {
  const activeIndex = ref(0)

  const onKeydown = (e: KeyboardEvent) => {
    if (!containerRef.value) return
    const items = Array.from(containerRef.value.querySelectorAll<HTMLElement>(itemSelector))
    if (!items.length) return

    let next = activeIndex.value
    switch (e.key) {
      case 'ArrowDown': next = (activeIndex.value + 1) % items.length; e.preventDefault(); break
      case 'ArrowUp': next = (activeIndex.value - 1 + items.length) % items.length; e.preventDefault(); break
      case 'Home': next = 0; e.preventDefault(); break
      case 'End': next = items.length - 1; e.preventDefault(); break
      default: return
    }

    items.forEach((el, i) => el.tabIndex = i === next ? 0 : -1)
    items[next].focus()
    activeIndex.value = next
  }

  onMounted(() => containerRef.value?.addEventListener('keydown', onKeydown))
  onUnmounted(() => containerRef.value?.removeEventListener('keydown', onKeydown))

  return { activeIndex }
}
```

### 4.5 Rageshake ring buffer 示例

```ts
// src/utils/rageshake.ts
const DB_NAME = 'hula-rageshake'
const STORE = 'logs'
const MAX_ENTRIES = 100_000

let dbPromise: Promise<IDBDatabase> | null = null

function getDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1)
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { autoIncrement: true })
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }
  return dbPromise
}

export async function appendLog(level: string, args: unknown[]) {
  const db = await getDb()
  const tx = db.transaction(STORE, 'readwrite')
  tx.objectStore(STORE).add({ ts: Date.now(), level, args: args.map(safeStringify) })
  // evict 简化:每 1000 次插入清理一次
  if (Math.random() < 0.001) await evictOld(db)
}

async function evictOld(db: IDBDatabase) {
  const tx = db.transaction(STORE, 'readwrite')
  const store = tx.objectStore(STORE)
  const count = await new Promise<number>((res, rej) => {
    const r = store.count(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error)
  })
  if (count > MAX_ENTRIES) {
    const cur = store.openCursor()
    let removed = 0
    cur.onsuccess = () => {
      const c = cur.result
      if (c && removed < count - MAX_ENTRIES) { c.delete(); removed++; c.continue() }
    }
  }
}

export async function exportLogs(): Promise<string> {
  const db = await getDb()
  return new Promise((resolve, reject) => {
    const all: unknown[] = []
    const cur = db.transaction(STORE, 'readonly').objectStore(STORE).openCursor()
    cur.onsuccess = () => {
      const c = cur.result
      if (c) { all.push(c.value); c.continue() } else resolve(JSON.stringify(all))
    }
    cur.onerror = () => reject(cur.error)
  })
}
```

`main.ts` 早期 hook console:
```ts
['log','info','warn','error','debug'].forEach(level => {
  const orig = console[level]
  console[level] = (...args) => { appendLog(level, args); orig(...args) }
})
window.addEventListener('error', e => appendLog('error', [e.message, e.error?.stack]))
window.addEventListener('unhandledrejection', e => appendLog('error', ['unhandledrejection', e.reason]))
```

---

## 五、回归验证清单

P0 完成后:
- [ ] 关闭 App 后再开,房间列表 < 1 秒可见(IndexedDB 命中)
- [ ] 任意子组件 throw,App 不白屏,显示降级 UI
- [ ] localStorage 无 access_token 字段(已迁 keychain)
- [ ] `grep -r "matrixSlidingSyncService" src/` 返回 0 条

P1 完成后:
- [ ] 移动窗口/调整大小后重启,位置/尺寸保留
- [ ] 系统浏览器打开 `matrix:r/!abc:matrix.org` 唤起 HuLa
- [ ] 收到新消息时 dock/taskbar 显示未读小红点
- [ ] Tab 键能完整遍历主界面;Ctrl+K 弹出快搜;Ctrl+/ 弹出快捷键帮助
- [ ] 反馈对话框能导出最近日志,文件包含崩溃前 100k 行

P2 完成后:
- [ ] 首次登录后 5 秒内自动弹出"开启加密备份"Toast
- [ ] 解密失败的消息显示具体原因,30 秒后自动重试成功
- [ ] access token 过期不再登出,自动 refresh 后继续
- [ ] 阿拉伯语环境下 UI 镜像正常,文本对齐右侧

---

## 六、Element Web 关键文件参考清单

加密:
- `src/utils/MatrixClientPeg.ts` — `initRustCrypto` 初始化
- `src/SecurityManager.ts` — SSSS 访问包装
- `src/DeviceListener.ts` — 启动后加密状态监听
- `src/components/views/messages/DecryptionFailureBody.tsx` — UTD UI

性能:
- `src/utils/createMatrixClient.ts` — IndexedDBStore + worker
- `src/stores/room-list-v3/RoomListStoreV3.ts` — 房间列表算法
- `src/components/structures/TimelinePanel.tsx` — Timeline 分页

可靠性:
- `src/components/views/elements/ErrorBoundary.tsx` — 全局错误兜底
- `src/rageshake/rageshake.ts` — ring buffer 日志
- `src/utils/oidc/TokenRefresher.ts` — token 刷新

桌面:
- `element-desktop/src/electron-main.ts` — deep link / second-instance
- `element-desktop/src/tray.ts` — tray badge
- `element-desktop/src/seshat.ts` — Rust 全文搜索

可访问性:
- `src/accessibility/RovingTabIndex.tsx`
- `src/KeyBindingsManager.ts`
- `src/accessibility/KeyboardShortcuts.ts`

---

## 七、与上一份方案的关系

`docs/sync-optimization-plan.md` 解决"前后端同步不稳定"(P0:全局超时中间件 BUG、Sliding Sync 死代码、startClient 监听器顺序)。本方案在同步稳定的基础上,推进**桌面体验和工程质量**对齐 Element Web。两份合并即是 HuLa 短中期完整路线图。
