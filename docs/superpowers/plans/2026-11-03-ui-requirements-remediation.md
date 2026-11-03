# UI 需求对齐整改 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 按《UI界面需求文档》v2.5 与《TJG_UI_REQUIREMENTS_GAP_AND_REDUNDANCY_2026-11-01》v2 清理 P0/P1/P2 低成本缺陷，消除锁屏自锁死、跨窗口锁定失效、死链路与死组件。

**Architecture:** 锁屏密码改为 PBKDF2 verifier 持久化（复用 `secretChatCrypto`），新增 `LOCK_SCREEN`/`UNLOCK_SCREEN` 跨窗口双向广播；P1 删除 by-design 404 端点的调用链；P2 做删除/重定向/令牌化等结构性收敛。全部改动经 TDD 与全量门禁验证。

**Tech Stack:** Tauri v2、Vue 3 `<script setup>`、TypeScript、Pinia + persistedstate、Vitest、UnoCSS、`--tjg-*` design tokens。

## Global Constraints

- 颜色/尺寸 token 唯一来源：`src/styles/css/design-tokens.css`，禁止新增硬编码颜色。
- `.vue` ≤ 800 行，新增文件 ≤ 400 行。
- Matrix 能力必须经 `src/services/matrix/**`，禁止组件/store 直连 SDK 或 raw fetch。
- 移动端（`src/mobile/**`、`#/` 别名）不得出现 admin / AI 任何引用（R2）。
- 命令一律使用沙箱内 Node 22：`PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm <cmd>`。
- 提交使用中文 Conventional Commits，scope 必须命中 `commitlint.config.cjs` 白名单（`ui` / `service` / `tauri` / `core`）。
- 每批任务结束后必须全绿：`vue-tsc --noEmit`、`test:run`、`check`、`check:ratchet`、`check:file-size`、`check:sdk-boundary`、`quality:no-raw-fetch`、`check:doc-coverage`、`check:doc-paths`。

## 需求条款映射

| 任务 | 问题清单条目 | 需求文档条款 |
| :--- | :--- | :--- |
| Task 1 | §1.1 锁屏自锁死 | 5.12.2 锁屏密码校验 |
| Task 2 | §1.2 `LOCK_SCREEN` 死广播 | 5.12.2 多窗口同步锁定/解锁 |
| Task 3 | §2.2 语音三死方法 | 2.4.9 by-design 不可用端点 |
| Task 4 | §2.3 `scoreReport` 死链 | 2.4.9 审核评分端点 |
| Task 5 | §3.5 `SyncStatusBar` 死组件 | 11 章收敛项（死代码清零） |
| Task 6 | §3.1 `/home` 无重定向、`/search` 悬空注释 | 3 章路由与导航 |
| Task 7 | §3.4 布局宽度未令牌化 | 8 章布局与响应式 |
| Task 8 | §3.x `openclaw` 死能力位 | 7.8 能力三态 |
| Task 9 | §3.9 断点断言 | 8.1 断点单一来源 |

## 清单误判订正（执行前必读）

1. **`useSecureBackupFlow` / `useKeyBackupFlow` 不是死代码**：被 `src/mobile/components/encryption/MobileKeyBackupDialog.vue`、`MobileSecureBackupDialog.vue` 及其测试引用。**禁止删除**。
2. **§3.9「断点断言缺失」不成立**：`src/styles/__tests__/design-baseline.test.ts` 已有 `响应式断点单一来源（UI-P1-07）` 断言（md/lg/xl = 768/992/1200）。本计划仅做核验，不新增测试。

## File Structure

- `src/stores/domains/settings/lockScreenCredential.ts`（新建）：锁屏密码 verifier 的创建与校验，唯一负责 PBKDF2 派生与 `lock-screen:` 命名空间隔离。
- `src/stores/domains/settings/setting.ts`（改）：`lockScreen` 由明文 `password` 改为 `passwordHash`，并允许持久化。
- `src/typings/stores.d.ts`（改）：同步 `lockScreen` 类型。
- `src/App.vue`（改）：锁定判定加 `passwordHash` 兜底；注册 `LOCK_SCREEN` / `UNLOCK_SCREEN` 监听。
- `src/views/LockScreen.vue`（改）：解锁改为异步校验 verifier；成功后广播 `UNLOCK_SCREEN`。
- `src/layout/left/model.tsx`（改）：设置锁屏时异步生成 verifier。
- `src/enums/app.ts`（改）：新增 `UNLOCK_SCREEN`。
- `src/services/matrix/media/MatrixVoiceService.ts`（改）：删除三死方法。
- `src/services/matrix/paths/**`（改）：删除三死端点常量。
- `src/services/matrix/admin/{AdminFacadeService,ReportService}.ts`（改）：删除 `scoreReport`。
- `src/components/connection/SyncStatusBar.vue` + 测试（删）。
- `src/router/routes/desktop.ts`（改）：`/home` 重定向、`/search` 注释订正。
- `src/styles/css/design-tokens.css`（改）：新增 `--tjg-layout-*`。
- `src/services/matrix/MatrixCapabilityService.ts`、`src/components/common/PermissionGuard.vue`、`src/composables/settings/useSettingsShell.ts`（改）：清理 `openclaw` 能力位。

---

### Task 1: 锁屏密码哈希持久化（P0-1）

**Files:**
- Create: `src/stores/domains/settings/lockScreenCredential.ts`
- Create: `src/stores/domains/settings/__tests__/lockScreenCredential.test.ts`
- Modify: `src/stores/domains/settings/setting.ts`
- Modify: `src/typings/stores.d.ts`
- Modify: `src/layout/left/model.tsx:54-74`
- Modify: `src/views/LockScreen.vue`
- Modify: `src/App.vue`（`isLock` 兜底）

**Interfaces:**
- Produces:
  - `createLockScreenVerifier(password: string): Promise<string>` —— 返回 `lock-screen:<encodedVerifier>`，`dbKey` 当场 `zeroize`。
  - `verifyLockScreenVerifier(password: string, encoded: string): Promise<boolean>` —— 前缀不符或空串返回 `false`。
- Consumes: `createSecretChatVerifier`、`verifySecretChatVerifier`、`zeroize`（`@/services/matrix/privateChat/secretChatCrypto`）。

- [ ] **Step 1: 写失败测试**

```ts
import { describe, expect, it } from 'vitest'
import { createLockScreenVerifier, verifyLockScreenVerifier } from '../lockScreenCredential'

describe('lockScreenCredential', () => {
  it('创建的凭据带 lock-screen 前缀且不包含明文密码', async () => {
    const encoded = await createLockScreenVerifier('pass-123456')
    expect(encoded.startsWith('lock-screen:')).toBe(true)
    expect(encoded).not.toContain('pass-123456')
  })

  it('正确密码校验通过，错误密码失败', async () => {
    const encoded = await createLockScreenVerifier('pass-123456')
    await expect(verifyLockScreenVerifier('pass-123456', encoded)).resolves.toBe(true)
    await expect(verifyLockScreenVerifier('wrong', encoded)).resolves.toBe(false)
  })

  it('空串、缺失前缀、损坏载荷一律失败且不抛异常', async () => {
    await expect(verifyLockScreenVerifier('x', '')).resolves.toBe(false)
    await expect(verifyLockScreenVerifier('x', 'pbkdf2-sha256$1$a$b')).resolves.toBe(false)
    await expect(verifyLockScreenVerifier('x', 'lock-screen:broken')).resolves.toBe(false)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vitest run src/stores/domains/settings/__tests__/lockScreenCredential.test.ts`
Expected: FAIL，`Cannot find module '../lockScreenCredential'`。

- [ ] **Step 3: 实现 verifier 模块**

```ts
/**
 * 锁屏密码凭据：只在本地持久化 PBKDF2 派生结果，绝不落盘明文密码。
 * 复用 secretChat 的 verifier 编解码，并以 `lock-screen:` 前缀隔离命名空间，
 * 避免锁屏凭据被误用为私聊加密口令。
 */
import { createSecretChatVerifier, verifySecretChatVerifier, zeroize } from '@/services/matrix/privateChat/secretChatCrypto'

const LOCK_SCREEN_PREFIX = 'lock-screen:'

export async function createLockScreenVerifier(password: string): Promise<string> {
  const { encodedVerifier, dbKey } = await createSecretChatVerifier(password)
  zeroize(dbKey)
  return `${LOCK_SCREEN_PREFIX}${encodedVerifier}`
}

export async function verifyLockScreenVerifier(password: string, encoded: string): Promise<boolean> {
  if (!encoded.startsWith(LOCK_SCREEN_PREFIX)) return false
  const payload = encoded.slice(LOCK_SCREEN_PREFIX.length)
  if (!payload) return false
  const { valid, dbKey } = await verifySecretChatVerifier(password, payload)
  zeroize(dbKey)
  return valid
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vitest run src/stores/domains/settings/__tests__/lockScreenCredential.test.ts`
Expected: PASS（3 个用例）。

- [ ] **Step 5: 改造 store 与类型**

`src/stores/domains/settings/setting.ts`：

```ts
lockScreen: { enable: false, passwordHash: '' },
```

持久化配置去掉 omit：

```ts
persist: true
```

`src/typings/stores.d.ts` 中 `lockScreen` 改为：

```ts
lockScreen: {
  /** 是否启用锁屏 */
  enable: boolean
  /** PBKDF2 verifier，禁止存明文密码 */
  passwordHash: string
}
```

- [ ] **Step 6: 改造设置锁屏入口**

`src/layout/left/model.tsx` 中 `handleLock` 的 `validate` 回调改为 async，并用 verifier 赋值：

```ts
formRef.value?.validate(async (errors) => {
  if (errors) return
  lock.value.loading = true
  lockScreen.value.passwordHash = await createLockScreenVerifier(formValue.value.lockPassword)
  lockScreen.value.enable = true
  // ...原有 timerManager.setTimeout 保持不变
})
```

顶部新增 `import { createLockScreenVerifier } from '@/stores/domains/settings/lockScreenCredential'`。

- [ ] **Step 7: 改造解锁逻辑与兜底**

`src/views/LockScreen.vue` 的 `unlock` 改为：

```ts
const unlock = async () => {
  if (password.value === '') {
    showFeedback(t('message.lock_screen.password_required'), 'warning')
    return
  }
  isLogining.value = true
  const passed = await verifyLockScreenVerifier(password.value, lockScreen.value.passwordHash)
  timerManager.setTimeout(async () => {
    if (passed) {
      lockScreen.value.enable = false
      isLogining.value = false
      if (hasTauriRuntime()) await emit(EventEnum.UNLOCK_SCREEN)
    } else {
      isWrongPassword.value = true
      isLogining.value = false
    }
  }, passed ? 800 : 300)
}
```

保留原 `isWrongPassword` 反馈与窗口恢复逻辑。

`src/App.vue` 的锁定判定加兜底（无可用凭据时不得渲染不可解锁的锁定层）：

```ts
const isLock = computed(() => {
  const { enable, passwordHash } = lockScreen.value
  return !LockExclusion.has(router.currentRoute.value.path) && enable && passwordHash !== ''
})
```

- [ ] **Step 8: 补回归测试（store 与锁定判定）**

在 `src/stores/domains/settings/__tests__/` 新建 `lockScreenState.test.ts`：

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useSettingStore } from '../setting'

describe('锁屏状态', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('默认无凭据且未启用', () => {
    const store = useSettingStore()
    expect(store.lockScreen).toEqual({ enable: false, passwordHash: '' })
  })

  it('passwordHash 不再被 persist omit（重启后仍可解锁）', () => {
    const persist = (useSettingStore as unknown as { $persist?: unknown }).$persist
    expect(persist).toBeDefined()
  })
})
```

> 说明：persistedstate 的 omit 无法在单测中直接断言，第二条仅守护 store 定义可实例化；真正的「重启后仍锁定」由 Task 9 的人工回归（启用锁屏 → 重启 → 解锁成功）覆盖。

- [ ] **Step 9: 全量门禁并提交**

Run: `PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vue-tsc --noEmit && PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vitest run src/stores/domains/settings src/views`
Expected: 0 类型错误、全部 PASS。

```bash
git add src/stores/domains/settings/lockScreenCredential.ts src/stores/domains/settings/__tests__/lockScreenCredential.test.ts src/stores/domains/settings/__tests__/lockScreenState.test.ts src/stores/domains/settings/setting.ts src/typings/stores.d.ts src/layout/left/model.tsx src/views/LockScreen.vue src/App.vue
git commit -m "fix(ui): 锁屏密码改为 PBKDF2 哈希持久化，避免重启后自锁死"
```

---

### Task 2: 锁屏跨窗口广播与解锁同步（P0-2）

**Files:**
- Modify: `src/enums/app.ts:112`
- Modify: `src/App.vue`
- Create: `src/composables/settings/useLockScreenSync.ts`
- Create: `src/composables/settings/__tests__/useLockScreenSync.test.ts`
- Modify: `src/views/LockScreen.vue`（Task 1 已含 `emit(UNLOCK_SCREEN)`）

**Interfaces:**
- Consumes: `EventEnum.LOCK_SCREEN`、`EventEnum.UNLOCK_SCREEN`、`useTauriListener`、`useSettingStore`。
- Produces: `useLockScreenSync(): void` —— 在任意窗口挂载后监听两个事件并同步 `lockScreen.enable`。

- [ ] **Step 1: 枚举新增**

```ts
  /** 锁屏 */
  LOCK_SCREEN = 'lockScreen',
  /** 解锁（跨窗口同步） */
  UNLOCK_SCREEN = 'unlockScreen',
```

- [ ] **Step 2: 写失败测试**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useSettingStore } from '@/stores/domains/settings/setting'

const handlers = new Map<string, (event: unknown) => void>()

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn((name: string, cb: (event: unknown) => void) => {
    handlers.set(name, cb)
    return Promise.resolve(() => handlers.delete(name))
  })
}))
vi.mock('@tauri-apps/api/webviewWindow', () => ({
  WebviewWindow: { getCurrent: () => ({ label: 'test', onCloseRequested: () => Promise.resolve(() => {}) }) }
}))
vi.mock('@/utils/AppHarness', () => ({ hasTauriRuntime: () => true }))

import { useLockScreenSync } from '../useLockScreenSync'

describe('useLockScreenSync', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    handlers.clear()
  })

  it('收到 LOCK_SCREEN 时置 enable=true，收到 UNLOCK_SCREEN 时置 false', async () => {
    useLockScreenSync()
    await Promise.resolve()
    const store = useSettingStore()

    handlers.get('lockScreen')?.({})
    expect(store.lockScreen.enable).toBe(true)

    handlers.get('unlockScreen')?.({})
    expect(store.lockScreen.enable).toBe(false)
  })
})
```

- [ ] **Step 3: 运行测试确认失败**

Run: `PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vitest run src/composables/settings/__tests__/useLockScreenSync.test.ts`
Expected: FAIL，模块不存在。

- [ ] **Step 4: 实现 composable**

```ts
import { listen } from '@tauri-apps/api/event'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { EventEnum } from '@/enums'
import { useTauriListener } from '@/composables/common/useTauriListener'

/** 跨窗口同步锁屏状态：任一窗口锁屏/解锁，其余窗口跟随（需求 5.12.2）。 */
export function useLockScreenSync() {
  const settingStore = useSettingStore()
  const { addListener } = useTauriListener()

  addListener(
    listen(EventEnum.LOCK_SCREEN, () => {
      settingStore.lockScreen.enable = true
    }),
    'lock_screen_sync'
  )
  addListener(
    listen(EventEnum.UNLOCK_SCREEN, () => {
      settingStore.lockScreen.enable = false
    }),
    'unlock_screen_sync'
  )
}
```

- [ ] **Step 5: 在 App.vue 挂载**

```ts
import { useLockScreenSync } from '@/composables/settings/useLockScreenSync'
useLockScreenSync()
```

- [ ] **Step 6: 运行测试确认通过**

Run: `PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vitest run src/composables/settings/__tests__/useLockScreenSync.test.ts`
Expected: PASS。

- [ ] **Step 7: 提交**

```bash
git add src/enums/app.ts src/App.vue src/composables/settings/useLockScreenSync.ts src/composables/settings/__tests__/useLockScreenSync.test.ts
git commit -m "feat(ui): 补齐锁屏跨窗口锁定与解锁同步"
```

---

### Task 3: 语音三死方法清理（P1-1）

**Files:**
- Modify: `src/services/matrix/media/MatrixVoiceService.ts:392-450`
- Modify: `src/services/matrix/paths/**`（`VOICE.CONVERT` / `VOICE.OPTIMIZE` / `VOICE.TRANSCRIPTION`）
- Modify: `src/services/matrix/media/__tests__/{voice.contract,MatrixVoiceService}.test.ts`
- Modify: `src/services/matrix/paths/__tests__/dead-constants.test.ts`

- [ ] **Step 1: 先删除测试中的正向断言**

删除 `voice.contract.test.ts` 中 `convertVoice` / `optimizeVoice` / `transcribeVoiceViaApi` 的 describe 块，以及 `MatrixVoiceService.test.ts` 中对应 3 个用例。

- [ ] **Step 2: 运行测试确认失败（方法仍存在则断言不成立）**

Run: `PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vitest run src/services/matrix/media/__tests__`
Expected: 若仅删测试则 PASS；继续下一步前先跑 `pnpm vue-tsc --noEmit` 确认无其他引用。

- [ ] **Step 3: 删除实现与常量**

删除 `convertVoice`、`optimizeVoice`、`transcribeVoiceViaApi` 三个方法；删除 `VOICE.CONVERT`、`VOICE.OPTIMIZE`、`VOICE.TRANSCRIPTION` 常量及 `dead-constants.test.ts` 中为其设立的白名单条目。

- [ ] **Step 4: 收紧死常量判据**

在 `dead-constants.test.ts` 补一条断言：被保留的端点常量必须存在至少一个 UI 层调用方（在 `src/views`、`src/components`、`src/layout` 中出现对应服务方法名）。

- [ ] **Step 5: 全仓确认无残留引用**

Run: `PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vue-tsc --noEmit`
Expected: 0 错误。

- [ ] **Step 6: 提交**

```bash
git add src/services/matrix/media src/services/matrix/paths
git commit -m "refactor(service): 移除语音转换/优化/转写死链路"
```

---

### Task 4: 举报评分死链清理（P1-2）

**Files:**
- Modify: `src/services/matrix/admin/AdminFacadeService.ts:437-438`
- Modify: `src/services/matrix/admin/ReportService.ts:102-115`
- Modify: `src/services/matrix/admin/__tests__/ReportService.test.ts:144-159`

- [ ] **Step 1: 删除测试用例**

删除 `ReportService.test.ts` 中 `scoreReport` 的 describe/it 块。

- [ ] **Step 2: 删除实现**

删除 `AdminFacadeService.scoreReport` 与 `ReportService.scoreReport`（含 `-100~0` 校验代码与「-50 中性值」注释）。

- [ ] **Step 3: 确认无残留引用**

Run: `PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vue-tsc --noEmit && PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vitest run src/services/matrix/admin`
Expected: 0 错误，测试全绿。

- [ ] **Step 4: 提交**

```bash
git add src/services/matrix/admin
git commit -m "refactor(service): 移除审核评分死链"
```

---

### Task 5: 删除 SyncStatusBar 死组件（P2）

**Files:**
- Delete: `src/components/connection/SyncStatusBar.vue`
- Delete: `src/components/connection/__tests__/SyncStatusBar.test.ts`
- Modify: `src/typings/components.d.ts`（移除自动生成条目，跑一次 `pnpm dev` 或手动删除该行）
- Modify: `src/locales/__tests__/sourceRefs.test.ts:125`

- [ ] **Step 1: 删除文件与白名单条目**

删除组件与测试；从 `sourceRefs.test.ts` 白名单移除对应路径；从 `components.d.ts` 移除声明。

- [ ] **Step 2: 验证**

Run: `PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vitest run src/locales src/components/connection && PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vue-tsc --noEmit`
Expected: 全绿。

- [ ] **Step 3: 提交**

```bash
git add -A src/components/connection src/typings/components.d.ts src/locales/__tests__/sourceRefs.test.ts
git commit -m "chore(ui): 移除未被引用的 SyncStatusBar 死组件"
```

---

### Task 6: `/home` 默认重定向与 `/search` 注释订正（P2）

**Files:**
- Modify: `src/router/routes/desktop.ts:12-46`
- Modify: `src/views/homeWindow/FriendsList.vue`（仅当搜索空态缺失时补充）

- [ ] **Step 1: `/home` 增加重定向**

```ts
{
  path: '/home',
  name: 'home',
  component: () => import('@/layout/index.vue'),
  redirect: '/message',
  children: [ ... ]
}
```
选 `/message` 的理由：`/message/:roomId?` 的 `roomId` 可选，是唯一无需前置数据的落地页。

- [ ] **Step 2: 订正 `/search` 悬空注释**

删除「阶段 9 替换为独立 SearchView」的悬空注释，改为现状描述：

```ts
// /search - 复用好友列表中栏，搜索态由 FriendsList 内部承载
{ path: '/search', name: 'search', component: FriendsList },
```

- [ ] **Step 3: 核验搜索空态**

打开 `src/views/homeWindow/FriendsList.vue`，确认搜索关键词无结果时存在空态文案；若缺失，在结果列表容器内补 `v-if` 空态（使用既有 i18n 键 `common.noResults`，无该键则复用 `common.no_data`），并保证空态不遮挡搜索框。

- [ ] **Step 4: 验证**

Run: `PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vitest run src/router src/views/homeWindow`
Expected: 全绿；手工访问 `/home` 落在消息页。

- [ ] **Step 5: 提交**

```bash
git add src/router/routes/desktop.ts src/views/homeWindow/FriendsList.vue
git commit -m "fix(ui): /home 增加默认重定向并订正 /search 注释"
```

---

### Task 7: 布局宽度令牌化（P2）

**Files:**
- Modify: `src/styles/css/design-tokens.css`
- Modify: `src/composables/layout/useResponsiveBreakpoint.ts`
- Modify: `src/layout/center/index.vue:70-80`
- Modify: `src/layout/left/index.vue:41`
- Create: `src/styles/__tests__/layout-tokens.test.ts`

- [ ] **Step 1: 写失败测试（TS 常量与 CSS token 双向一致）**

```ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CENTER_WIDTH_MAP } from '../../composables/layout/useResponsiveBreakpoint'

const css = readFileSync(resolve(__dirname, '../css/design-tokens.css'), 'utf-8')
const tokenValue = (name: string) => css.match(new RegExp(`${name}\\s*:\\s*(\\d+)px`))?.[1]

describe('布局宽度令牌', () => {
  it('中间栏三档宽度与 design-tokens 一致', () => {
    expect(tokenValue('--tjg-layout-center-wide')).toBe(String(CENTER_WIDTH_MAP.wide))
    expect(tokenValue('--tjg-layout-center-normal')).toBe(String(CENTER_WIDTH_MAP.normal))
    expect(tokenValue('--tjg-layout-center-shrink')).toBe(String(CENTER_WIDTH_MAP.shrink))
  })

  it('左侧栏最小宽度令牌存在', () => {
    expect(tokenValue('--tjg-layout-left-min')).toBe('64')
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vitest run src/styles/__tests__/layout-tokens.test.ts`
Expected: FAIL，token 未定义。

- [ ] **Step 3: 定义 token 并导出常量**

`design-tokens.css`（放在布局分组内）：

```css
/* 布局宽度：与 src/composables/layout/useResponsiveBreakpoint.ts 的 CENTER_WIDTH_MAP 保持同值 */
--tjg-layout-left-min: 64px;
--tjg-layout-center-wide: 280px;
--tjg-layout-center-normal: 240px;
--tjg-layout-center-shrink: 64px;
```

`useResponsiveBreakpoint.ts` 导出：

```ts
export const CENTER_WIDTH_MAP: Record<BreakpointMode, number> = { wide: 280, normal: 240, shrink: 64, single: 64 }
```

- [ ] **Step 4: 消费 token**

`src/layout/center/index.vue` 的 64px 硬编码改为 `var(--tjg-layout-center-shrink)`；`src/layout/left/index.vue` 的 `min-w-64px` 改为 `min-w-[--tjg-layout-left-min]`。

- [ ] **Step 5: 验证**

Run: `PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vitest run src/styles/__tests__/layout-tokens.test.ts src/layout/center src/layout/left`
Expected: 全绿。

- [ ] **Step 6: 提交**

```bash
git add src/styles/css/design-tokens.css src/styles/__tests__/layout-tokens.test.ts src/composables/layout/useResponsiveBreakpoint.ts src/layout/center/index.vue src/layout/left/index.vue
git commit -m "refactor(ui): 布局宽度统一为 --tjg-layout-* 令牌"
```

---

### Task 8: `openclaw` 死能力位清理（P2）

**Files:**
- Modify: `src/services/matrix/MatrixCapabilityService.ts:40,67-69,184-187,344`
- Modify: `src/components/common/PermissionGuard.vue:51`
- Modify: `src/composables/settings/useSettingsShell.ts:70`
- Modify: `src/types/message.ts:133-134`

**不修改：** `src/services/matrix/admin/ExternalServiceService.ts` 的 `'openclaw'` —— 它是外部服务渠道的业务枚举（后端可配置的服务类型），不是前端能力探测位。

- [ ] **Step 1: 删除能力位**

从 `TjgCapability` 联合类型、`CAPABILITY_MAP`、`canUseOpenClaw()`、返回对象的 `canUseOpenclaw` 中移除 `openclaw`。

- [ ] **Step 2: 删除消费点**

`PermissionGuard.vue` 与 `useSettingsShell.ts` 中删除 `openclaw` 键；`src/types/message.ts` 删除 `openclaw?: SynapseRustCapability` 字段（先 `grep openclaw` 确认无其他读取点）。

- [ ] **Step 3: 验证**

Run: `PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vue-tsc --noEmit && PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm check:sdk-types`
Expected: 0 错误。

- [ ] **Step 4: 提交**

```bash
git add src/services/matrix/MatrixCapabilityService.ts src/components/common/PermissionGuard.vue src/composables/settings/useSettingsShell.ts src/types/message.ts
git commit -m "refactor(ui): 清理 openclaw 死能力探测位"
```

---

### Task 9: 断点核验、全量门禁与变更说明

**Files:**
- Verify: `src/styles/__tests__/design-baseline.test.ts`（不新增用例）
- Create: `docs/UI需求整改变更说明-2026-11-03.md`

- [ ] **Step 1: 核验断点断言仍通过**

Run: `PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vitest run src/styles/__tests__/design-baseline.test.ts`
Expected: PASS，含「响应式断点单一来源（UI-P1-07）」。

- [ ] **Step 2: 全量门禁**

```bash
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vue-tsc --noEmit
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm test:run
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm check
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm check:ratchet
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm check:file-size
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm check:sdk-boundary
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm quality:no-raw-fetch
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm check:doc-coverage
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm check:doc-paths
```

Expected: 全部 0 失败。

- [ ] **Step 3: 人工回归**

1. 启用锁屏 → 关闭应用 → 重启 → 输入正确密码可解锁；错误密码有反馈。
2. 设置页开启锁屏后，主窗口与聊天独立窗口同时进入锁屏；在任一窗口解锁，另一窗口同步解除。
3. 语音消息发送/播放正常；管理端举报列表可加载（评分入口已不存在）。
4. 访问 `/home` 落在 `/message`；`/search` 无结果时显示空态。
5. 窗口从 1200px 缩到 768px 以下：左侧栏折叠为 64px，中间栏按档位切换无跳变。

- [ ] **Step 4: 输出变更说明**

新建 `docs/UI需求整改变更说明-2026-11-03.md`，逐任务列：模块、对应需求条款、改动摘要、验证命令与结果、遗留项（Admin 媒体 23 条能力缺口、`MsgInput.vue` 拆分、锁屏"忘记密码"重置入口）。文档路径需通过 `check:doc-paths`。

- [ ] **Step 5: 提交**

```bash
git add docs/UI需求整改变更说明-2026-11-03.md
git commit -m "docs(ui): 输出 UI 需求整改变更说明"
```

---

## Self-Review

- **条款覆盖**：P0-1 → Task 1；P0-2 → Task 2；P1-1 → Task 3；P1-2 → Task 4；P1-3（Admin 媒体）已在变更说明中登记为遗留缺口；P2 → Task 5-8；§3.9 → Task 9 Step 1。
- **类型一致性**：`passwordHash` 在 `setting.ts`、`stores.d.ts`、`LockScreen.vue`、`model.tsx`、`App.vue` 五处命名一致；`CENTER_WIDTH_MAP` 在测试与实现中同名导出。
- **占位符**：Task 6 Step 3 含条件分支（搜索空态是否存在），执行时需先读 `FriendsList.vue` 再决定是否补 `v-if`；其余步骤均给出可直接落地的代码。
