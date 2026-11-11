# 私密聊天 E2EE 打通 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让「私密聊天」在桌面端与移动端真正落到 Matrix E2EE 上——启动即引导 crypto、设为私密即强制开启房间加密、双端可见加密状态与密钥备份风险、加密房间不再把链接交给服务端抓取预览。

**Architecture:** 不新增任何协议实现，全部复用现有 `matrix-js-sdk`（Rust Crypto）与 `src/services/matrix/crypto/**` 服务层。改动集中在四处：① 客户端 `startClient` 之后接上已有的 `MatrixE2EEBootstrapService.bootstrapE2EE()`；② `usePrivateRoomActions` 在写私密登记表之前先确保房间已开启 `m.room.encryption`；③ 新增两个只读 composable 把「房间是否加密 / 密钥备份是否就绪」暴露给双端 UI；④ 在链接预览入口按当前房间加密状态短路。

**Tech Stack:** Vue 3 `<script setup>`、Pinia setup store、Vant 4（移动）、Naive UI（桌面）、vue-i18n、Vitest + @vue/test-utils、matrix-js-sdk（Rust Crypto）、UnoCSS + `--tjg-*` design tokens。

---

## Global Constraints

- **R1 SDK 优先**：禁止新增平行协议实现、禁止组件/store 内裸 `fetch`。房间加密只能走 `matrixCryptoService.enableEncryption()` → `client.sendStateEvent(roomId, 'm.room.encryption', { algorithm })`；已确认 `client.setRoomEncryption` 在 js-sdk v38 起移除、`Room.enableEncryption` 在 js-sdk 中不存在，不要调用。
- **R2 移动端裁剪**：本计划不得引入任何 `@/views/admin`、`@/plugins/robot`、`@/services/matrix/ai`、`@/services/siliconflow`、`@/services/trendradar` 引用，`src/mobile/**` 内尤其禁止。
- **禁止运行时平台分支**：不得新增 `isMobile()` 内联判断；双端差异只能通过 `src/mobile/**` 独立实现或平台无关的共享组件表达。
- **颜色**：只用 `--tjg-*` token；本计划使用 `--tjg-color-warning-bg`、`--tjg-color-warning-700`、`--tjg-status-encryption-verified`、`--tjg-status-encryption-unverified`。禁止 `#xxx` / `rgb()` / `rgba()` 新增值。
- **图标**：必须 SVG（内联 `<svg>` 或 Iconify），线宽 1.5px，禁止 div 拼图标。
- **文案**：`.vue` 内不得出现中文字面量；新增 key 必须同时写 `locales/zh-CN/*.json` 与 `locales/en/*.json`。改完运行 `pnpm gen:i18n` 刷新 `src/typings/i18n.d.ts`。
- **单文件上限**：任何 `.vue` 不得超过 800 行。
- **提交**：Conventional Commits，scope 只允许 `core|ui|chat|mobile|plugin|hook|service|util|i18n|config|ci|test|tauri`；不 emoji；不 `--no-verify`。
- **验收命令**（每个任务结束至少跑与本任务相关的单测 + `pnpm vue-tsc --noEmit`；Task 6 跑全量）：
  `pnpm vue-tsc --noEmit`、`pnpm test:run`、`pnpm check:ratchet`、`pnpm check:doc-coverage`、`pnpm check:doc-paths`、`pnpm check:sdk-boundary`、`pnpm quality:no-raw-fetch`、`pnpm check`。

---

## Scope Check

本期只做「私密聊天 → E2EE 闭环」，共 6 个任务，单个 PR 可评审。以下内容**明确不在本期**，不要在实现中顺手加：

| 延后项 | 原因 |
| :--- | :--- |
| 逐设备（per-device）未验证提示 | 需要枚举房间成员再对每个用户 `/keys/query`，成本高；本期先用「密钥备份未就绪」覆盖最大风险 |
| 首登强制备份恢复闸门（阻塞式） | 阻塞式弹窗会挡住新用户进入应用，需单独设计降级路径；本期改为横幅提示 |
| 桌面端「设为私密」入口 | 桌面当前无会话右键菜单承载该动作（已实测），属独立产品改造，不在 E2EE 闭环内 |
| 存量明文历史消息迁移 | Matrix 加密不可追溯，只能靠「新消息加密 + 边界说明」，无法把旧事件重写为 `m.room.encrypted` |
| 本地 SQLite `im_message.body` 落盘加密 | Matrix 消息链路未调用 `save_msg`；legacy IM 链路需单独评估，不属本计划 |
| 客户端本地 URL 抓取（替代服务端预览） | 需要新增网络栈与 SSRF 防护，工作量独立；本期只做「加密房间禁用预览」 |

---

## 现状差距（对照 element-hq 实践实测）

| 能力 | 现状 | 结论 |
| :--- | :--- | :--- |
| Rust Crypto 初始化 | `MatrixCryptoStateTracker` 已实现 | 可用 |
| 启动引导 `bootstrapE2EE()` | 实现完整，**生产零调用** | 必须接线（Task 1） |
| 健康巡检 `CryptoHealthMonitor.start()` | 只在 `bootstrapE2EE` 内调用，因此同样空转 | Task 1 一并激活 |
| 新 DM 默认加密 | `MatrixDirectMessageService` 已开 | 可用 |
| 存量房间开启加密 | `matrixCryptoService.enableEncryption()` 存在，仅测试引用 | Task 2 接入私密流程 |
| 私密标记与加密绑定 | 完全无关联，只写 account data + `session.hide` | Task 2 |
| 私密列表加密徽标 | 无 | Task 3 |
| 房间加密状态 / 备份风险提示 | 仅设置页可见 | Task 4 |
| 加密房间 URL 预览 | 照片/文件已加密，但链接预览仍服务端抓取 | Task 5 |
| 附件加密 | `useMsgInputFileUpload` / `useVoiceInput` 已实现 | 回归守护即可 |
| UTD 重试 | `DecryptionFailureCard` 已有重试 | 不新增 |
| 后端 `/keys/*`、`/room_keys/*`、`sendToDevice` | synapse-rust 已实现 | 无后端改造 |

---

## File Structure

**新增**

| 文件 | 职责 |
| :--- | :--- |
| `src/services/matrix/crypto/e2eeStartup.ts` | 启动/登出两个入口，吞掉引导异常，避免循环依赖 |
| `src/composables/secretChat/usePrivateRoomEncryption.ts` | 批量查询私密房间加密状态（只读缓存） |
| `src/components/encryption/EncryptionLockBadge.vue` | 加密锁徽标（纯展示，双端共用） |
| `src/composables/encryption/useRoomEncryptionStatus.ts` | 单房间加密状态 + 备份风险告警键 |
| `src/components/encryption/RoomEncryptionBanner.vue` | 加密风险横幅（纯展示，双端共用） |

**修改**

| 文件 | 改动 |
| :--- | :--- |
| `src/services/matrix/MatrixClientLifecycle.ts` | `doStartClient` 末尾引导 E2EE；`stopClient` 复位 |
| `src/composables/secretChat/usePrivateRoomActions.ts` | 设为私密前强制 `enableEncryption` |
| `src/mobile/composables/useMobileMessageActions.ts` | 私密开关传入加密二次确认 |
| `src/views/homeWindow/SecretChatPage.vue` | 列表项渲染加密徽标 |
| `src/mobile/views/secretChat/SecretChatPage.vue` | 列表项渲染加密徽标 |
| `src/components/rightBox/chatBox/index.vue` | 挂载 `RoomEncryptionBanner` |
| `src/mobile/layout/chat-room/ChatRoomLayout.vue` | 挂载 `RoomEncryptionBanner` |
| `src/components/rightBox/linkPreview/LinkPreviewPane.vue` | 加密房间短路预览 |
| `locales/zh-CN/{menu,home,chat}.json`、`locales/en/{menu,home,chat}.json` | 新增文案 |

**测试**

`src/services/matrix/crypto/__tests__/e2eeStartup.test.ts`、`src/composables/secretChat/__tests__/usePrivateRoomActions.test.ts`（改）、`src/composables/secretChat/__tests__/usePrivateRoomEncryption.test.ts`、`src/components/encryption/__tests__/EncryptionLockBadge.test.ts`、`src/composables/encryption/__tests__/useRoomEncryptionStatus.test.ts`、`src/components/encryption/__tests__/RoomEncryptionBanner.test.ts`、`src/components/rightBox/linkPreview/__tests__/LinkPreviewPane.test.ts`（改）。

---

### Task 1: 客户端启动后引导 E2EE，登出时复位

**Files:**
- Create: `src/services/matrix/crypto/e2eeStartup.ts`
- Modify: `src/services/matrix/MatrixClientLifecycle.ts`（`doStartClient` 中 `await client.startClient(startOpts)` 之后；`stopClient` 中 `cryptoTracker.resetState()` 之后）
- Test: `src/services/matrix/crypto/__tests__/e2eeStartup.test.ts`

**Interfaces:**
- Consumes: `matrixE2EEBootstrapService.bootstrapE2EE(): Promise<void>`、`matrixE2EEBootstrapService.reset(): void`
- Produces: `startE2EE(): Promise<void>`、`stopE2EE(): void`

- [ ] **Step 1: 写失败测试**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  bootstrapE2EE: vi.fn(),
  reset: vi.fn()
}))

vi.mock('../MatrixE2EEBootstrapService', () => ({
  matrixE2EEBootstrapService: {
    bootstrapE2EE: mocks.bootstrapE2EE,
    reset: mocks.reset
  }
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })
}))

import { startE2EE, stopE2EE } from '../e2eeStartup'

describe('e2eeStartup', () => {
  beforeEach(() => {
    mocks.bootstrapE2EE.mockReset().mockResolvedValue(undefined)
    mocks.reset.mockReset()
  })

  it('启动时调用一次 bootstrapE2EE', async () => {
    await startE2EE()
    expect(mocks.bootstrapE2EE).toHaveBeenCalledTimes(1)
  })

  it('bootstrapE2EE 抛错时不向调用方冒泡', async () => {
    mocks.bootstrapE2EE.mockRejectedValueOnce(new Error('crypto unavailable'))
    await expect(startE2EE()).resolves.toBeUndefined()
  })

  it('停止时复位 E2EE 状态', () => {
    stopE2EE()
    expect(mocks.reset).toHaveBeenCalledTimes(1)
  })

  it('reset 抛错时不影响调用方', () => {
    mocks.reset.mockImplementationOnce(() => {
      throw new Error('boom')
    })
    expect(() => stopE2EE()).not.toThrow()
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run src/services/matrix/crypto/__tests__/e2eeStartup.test.ts`
Expected: FAIL，`Failed to resolve import "../e2eeStartup"`

- [ ] **Step 3: 写最小实现**

`src/services/matrix/crypto/e2eeStartup.ts`：

```ts
import { createLogger } from '@/utils/Logger'
import { matrixE2EEBootstrapService } from './MatrixE2EEBootstrapService'

const logger = createLogger('E2EEStartup')

/**
 * 客户端启动后的 E2EE 引导入口。
 *
 * 独立成模块的原因：
 * 1. 引导失败不能阻断登录与收发消息（ADR-003 乐观渲染）；
 * 2. MatrixClientLifecycle 与 MatrixClientService 存在循环依赖，
 *    收敛到这里后由 lifecycle 动态 import，模块初始化期不触发环。
 */
export const startE2EE = async (): Promise<void> => {
  try {
    await matrixE2EEBootstrapService.bootstrapE2EE()
  } catch (err) {
    logger.warn(`E2EE 启动引导失败，已降级为明文可用: ${err}`)
  }
}

/** 登出/换号时复位 E2EE：停止健康巡检、清 crypto 缓存、复位初始化标记。 */
export const stopE2EE = (): void => {
  try {
    matrixE2EEBootstrapService.reset()
  } catch (err) {
    logger.warn(`E2EE 状态重置失败: ${err}`)
  }
}
```

在 `MatrixClientLifecycle.ts` 的 `doStartClient` 中，紧接 `await client.startClient(startOpts)` 之后插入：

```ts
    // crypto 后端随 startClient 建立；这里只做引导，不阻塞启动。
    const { startE2EE } = await import('./crypto/e2eeStartup')
    void startE2EE()
```

在 `stopClient` 内、`cryptoTracker.resetState()` 之后插入：

```ts
    const { stopE2EE } = await import('./crypto/e2eeStartup')
    stopE2EE()
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm vitest run src/services/matrix/crypto/__tests__/e2eeStartup.test.ts && pnpm vue-tsc --noEmit`
Expected: 4 passed；类型检查 0 错误

- [ ] **Step 5: 提交**

```bash
git add src/services/matrix/crypto/e2eeStartup.ts src/services/matrix/crypto/__tests__/e2eeStartup.test.ts src/services/matrix/MatrixClientLifecycle.ts
git commit -m "feat(service): 客户端启动后引导 E2EE 并巡检密钥健康状态"
```

---

### Task 2: 设为私密前强制开启房间加密

**Files:**
- Modify: `src/composables/secretChat/usePrivateRoomActions.ts`
- Modify: `src/mobile/composables/useMobileMessageActions.ts`（`handleTogglePrivate`）
- Modify: `src/composables/secretChat/__tests__/usePrivateRoomActions.test.ts`
- Modify: `locales/zh-CN/home.json`、`locales/en/home.json`、`locales/zh-CN/menu.json`、`locales/en/menu.json`

**Interfaces:**
- Consumes: `matrixCryptoService.isRoomEncrypted(roomId): Promise<boolean>`、`matrixCryptoService.enableEncryption(roomId): Promise<void>`
- Produces: `togglePrivateRoom(item: SessionItem, options?: TogglePrivateRoomOptions): Promise<boolean>`；`TogglePrivateRoomOptions { confirmEnableEncryption?: () => Promise<boolean> }`

- [ ] **Step 1: 写失败测试**

在 `usePrivateRoomActions.test.ts` 顶部补 mock（保留已有 `vi.hoisted` 结构，向 `mocks` 增加字段）：

```ts
  isRoomEncrypted: vi.fn(),
  enableEncryption: vi.fn()
```

```ts
vi.mock('@/services/matrix/crypto/MatrixCryptoService', () => ({
  matrixCryptoService: {
    isRoomEncrypted: mocks.isRoomEncrypted,
    enableEncryption: mocks.enableEncryption
  }
}))
```

在 `beforeEach` 中补默认值（**关键**：已有用例不感知加密，默认视为已加密，避免旧断言被新逻辑打断）：

```ts
    mocks.isRoomEncrypted.mockResolvedValue(true)
    mocks.enableEncryption.mockResolvedValue(undefined)
```

新增用例：

```ts
  it('未加密的房间在设为私密前会开启加密', async () => {
    mocks.isRoomEncrypted.mockResolvedValueOnce(false)
    const { togglePrivateRoom } = usePrivateRoomActions()
    const ok = await togglePrivateRoom(singleItem)
    expect(mocks.enableEncryption).toHaveBeenCalledWith(SINGLE_ROOM)
    expect(mocks.markRoomPrivate).toHaveBeenCalledWith(SINGLE_ROOM)
    expect(ok).toBe(true)
  })

  it('用户拒绝开启加密时放弃设为私密', async () => {
    mocks.isRoomEncrypted.mockResolvedValueOnce(false)
    const confirmEnableEncryption = vi.fn().mockResolvedValue(false)
    const { togglePrivateRoom } = usePrivateRoomActions()
    const ok = await togglePrivateRoom(singleItem, { confirmEnableEncryption })
    expect(confirmEnableEncryption).toHaveBeenCalledTimes(1)
    expect(mocks.enableEncryption).not.toHaveBeenCalled()
    expect(mocks.markRoomPrivate).not.toHaveBeenCalled()
    expect(ok).toBe(false)
  })

  it('开启加密失败时不写私密标记', async () => {
    mocks.isRoomEncrypted.mockResolvedValueOnce(false)
    mocks.enableEncryption.mockRejectedValueOnce(new Error('power level too low'))
    const { togglePrivateRoom } = usePrivateRoomActions()
    const ok = await togglePrivateRoom(singleItem)
    expect(mocks.markRoomPrivate).not.toHaveBeenCalled()
    expect(ok).toBe(false)
  })

  it('已加密房间不再重复开启加密', async () => {
    mocks.isRoomEncrypted.mockResolvedValueOnce(true)
    const { togglePrivateRoom } = usePrivateRoomActions()
    await togglePrivateRoom(singleItem)
    expect(mocks.enableEncryption).not.toHaveBeenCalled()
    expect(mocks.markRoomPrivate).toHaveBeenCalledWith(SINGLE_ROOM)
  })

  it('取消私密不会关闭房间加密', async () => {
    mocks.isRoomEncrypted.mockResolvedValueOnce(true)
    const { togglePrivateRoom } = usePrivateRoomActions()
    await togglePrivateRoom({ ...singleItem, roomId: PRIVATE_ROOM })
    expect(mocks.unmarkRoomPrivate).toHaveBeenCalledWith(PRIVATE_ROOM)
    expect(mocks.enableEncryption).not.toHaveBeenCalled()
  })
```

（`singleItem` / `PRIVATE_ROOM` 按文件里已有夹具命名调整；若不存在，直接复用已有用例里的 `SessionItem` 常量。）

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run src/composables/secretChat/__tests__/usePrivateRoomActions.test.ts`
Expected: FAIL，新增用例断言 `enableEncryption` 未被调用

- [ ] **Step 3: 写最小实现**

`usePrivateRoomActions.ts` 顶部加：

```ts
import { matrixCryptoService } from '@/services/matrix/crypto/MatrixCryptoService'

export interface TogglePrivateRoomOptions {
  /** 用户确认「开启不可逆的房间加密」；返回 false 则放弃设为私密。 */
  confirmEnableEncryption?: () => Promise<boolean>
}
```

`togglePrivateRoom` 改为：

```ts
  const togglePrivateRoom = async (
    item: SessionItem,
    options: TogglePrivateRoomOptions = {}
  ): Promise<boolean> => {
    if (!item.roomId) return false

    if (item.type !== RoomTypeEnum.SINGLE) {
      showFeedback(t('home.secret_chat.single_only'), 'warning')
      return false
    }
    if (!settingStore.isSecretChatConfigured()) {
      showFeedback(t('home.secret_chat.no_password'), 'warning')
      return false
    }
    if (!isSecretChatUnlocked()) {
      showFeedback(t('home.secret_chat.locked_hint'), 'warning')
      openSecretChatUnlock()
      return false
    }

    const roomId = item.roomId
    const marked = isPrivateRoom(roomId)
    let encryptedNow = false

    // 只能单向：Matrix 房间加密不可关闭，取消私密不撤销加密。
    if (!marked) {
      const alreadyEncrypted = await matrixCryptoService.isRoomEncrypted(roomId)
      if (!alreadyEncrypted) {
        if (options.confirmEnableEncryption && !(await options.confirmEnableEncryption())) {
          return false
        }
        try {
          await matrixCryptoService.enableEncryption(roomId)
          encryptedNow = true
        } catch (e) {
          logger.error('开启房间加密失败:', e)
          showFeedback(t('home.secret_chat.encryption_failed'), 'error')
          return false
        }
      }
    }

    try {
      if (marked) {
        await unmarkRoomPrivate(roomId)
      } else {
        await markRoomPrivate(roomId)
      }
      chatStore.updateSession(roomId, { hide: !marked })
      if (hasTauriRuntime()) {
        await invokeWithErrorHandler('hide_contact_command', {
          data: { roomId, hide: !marked }
        })
      }
      const successKey = marked
        ? 'menu.secret_chat_cancel'
        : encryptedNow
          ? 'menu.secret_chat_success_encrypted'
          : 'menu.secret_chat_success'
      showFeedback(t(successKey), 'success')
      return true
    } catch (e) {
      logger.error('切换私密房间标记失败:', e)
      showFeedback(String(e), 'error')
      return false
    }
  }
```

移动端 `useMobileMessageActions.handleTogglePrivate`：

```ts
  const handleTogglePrivate = async (item: SessionItem | null) => {
    if (!item) return
    try {
      await togglePrivateRoom(item, {
        confirmEnableEncryption: async () => {
          try {
            await showConfirmDialog({
              title: t('home.secret_chat.encryption_confirm_title'),
              message: t('home.secret_chat.encryption_confirm_message'),
              confirmButtonText: t('home.secret_chat.encryption_confirm_ok'),
              cancelButtonText: t('home.secret_chat.encryption_confirm_cancel')
            })
            return true
          } catch {
            return false
          }
        }
      })
    } catch (error) {
      logger.error('切换私密会话失败:', error)
    } finally {
      opts.maskHandler.close()
    }
  }
```

该文件需补 `import { showConfirmDialog } from 'vant'` 与 `const { t } = useI18n()`（若已有 `t` 则复用）。

文案（zh-CN / en 成对写入）：

| key | zh-CN | en |
| :--- | :--- | :--- |
| `menu.secret_chat_success_encrypted` | 已设为私密聊天，并开启端到端加密 | Set as private chat with end-to-end encryption enabled |
| `home.secret_chat.encryption_failed` | 开启端到端加密失败，未设为私密 | Failed to enable end-to-end encryption; not set as private |
| `home.secret_chat.encryption_confirm_title` | 开启端到端加密 | Enable end-to-end encryption |
| `home.secret_chat.encryption_confirm_message` | 设为私密将同时开启端到端加密，此操作不可撤销，仅对此后发送的新消息生效。 | Making this chat private also enables end-to-end encryption. This cannot be undone and only affects new messages. |
| `home.secret_chat.encryption_confirm_ok` | 开启并设为私密 | Enable and set private |
| `home.secret_chat.encryption_confirm_cancel` | 取消 | Cancel |

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm gen:i18n && pnpm vitest run src/composables/secretChat/__tests__/usePrivateRoomActions.test.ts src/mobile/composables/__tests__/useMobileMessageActions.private.test.ts && pnpm vue-tsc --noEmit`
Expected: 全部 passed；类型检查 0 错误

- [ ] **Step 5: 提交**

```bash
git add src/composables/secretChat/usePrivateRoomActions.ts src/composables/secretChat/__tests__/usePrivateRoomActions.test.ts src/mobile/composables/useMobileMessageActions.ts locales/zh-CN/home.json locales/en/home.json locales/zh-CN/menu.json locales/en/menu.json src/typings/i18n.d.ts
git commit -m "feat(chat): 设为私密前强制开启房间端到端加密"
```

---

### Task 3: 私密列表展示加密徽标

**Files:**
- Create: `src/composables/secretChat/usePrivateRoomEncryption.ts`
- Create: `src/components/encryption/EncryptionLockBadge.vue`
- Modify: `src/views/homeWindow/SecretChatPage.vue`
- Modify: `src/mobile/views/secretChat/SecretChatPage.vue`
- Test: `src/composables/secretChat/__tests__/usePrivateRoomEncryption.test.ts`、`src/components/encryption/__tests__/EncryptionLockBadge.test.ts`
- Modify: `locales/zh-CN/home.json`、`locales/en/home.json`

**Interfaces:**
- Consumes: `matrixCryptoService.isRoomEncrypted(roomId): Promise<boolean>`
- Produces: `usePrivateRoomEncryption(): { encryptedRooms: Ref<Record<string, boolean>>; loading: Ref<boolean>; refresh(roomIds: string[]): Promise<void>; isEncrypted(roomId: string): boolean }`

- [ ] **Step 1: 写失败测试**

`usePrivateRoomEncryption.test.ts`：

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ isRoomEncrypted: vi.fn() }))

vi.mock('@/services/matrix/crypto/MatrixCryptoService', () => ({
  matrixCryptoService: { isRoomEncrypted: mocks.isRoomEncrypted }
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })
}))

import { usePrivateRoomEncryption } from '../usePrivateRoomEncryption'

describe('usePrivateRoomEncryption', () => {
  beforeEach(() => {
    mocks.isRoomEncrypted.mockReset()
  })

  it('按房间批量刷新加密状态', async () => {
    mocks.isRoomEncrypted.mockImplementation(async (roomId: string) => roomId === '!a:test')
    const { refresh, isEncrypted } = usePrivateRoomEncryption()
    await refresh(['!a:test', '!b:test'])
    expect(isEncrypted('!a:test')).toBe(true)
    expect(isEncrypted('!b:test')).toBe(false)
  })

  it('空列表直接清空且不调用服务', async () => {
    const { refresh, encryptedRooms } = usePrivateRoomEncryption()
    await refresh([])
    expect(encryptedRooms.value).toEqual({})
    expect(mocks.isRoomEncrypted).not.toHaveBeenCalled()
  })

  it('查询失败时保持 false，不抛错', async () => {
    mocks.isRoomEncrypted.mockRejectedValue(new Error('network'))
    const { refresh, isEncrypted } = usePrivateRoomEncryption()
    await expect(refresh(['!a:test'])).resolves.toBeUndefined()
    expect(isEncrypted('!a:test')).toBe(false)
  })
})
```

`EncryptionLockBadge.test.ts`：

```ts
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import EncryptionLockBadge from '../EncryptionLockBadge.vue'

describe('EncryptionLockBadge', () => {
  it('渲染锁图标与文案', () => {
    const wrapper = mount(EncryptionLockBadge, { props: { label: '已加密' } })
    expect(wrapper.find('svg').exists()).toBe(true)
    expect(wrapper.text()).toContain('已加密')
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run src/composables/secretChat/__tests__/usePrivateRoomEncryption.test.ts src/components/encryption/__tests__/EncryptionLockBadge.test.ts`
Expected: FAIL，模块不存在

- [ ] **Step 3: 写最小实现**

`usePrivateRoomEncryption.ts`：

```ts
import { ref } from 'vue'
import { matrixCryptoService } from '@/services/matrix/crypto/MatrixCryptoService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('PrivateRoomEncryption')

/**
 * 私密列表的加密状态只读缓存。
 *
 * 单独成 composable 而不是塞进 store：数据是「当前列表快照」，随页面进出即可丢弃，
 * 放进持久化 store 反而会留下过期状态。
 */
export const usePrivateRoomEncryption = () => {
  const encryptedRooms = ref<Record<string, boolean>>({})
  const loading = ref(false)

  const refresh = async (roomIds: string[]): Promise<void> => {
    const targets = roomIds.filter((id) => !!id)
    if (targets.length === 0) {
      encryptedRooms.value = {}
      return
    }
    loading.value = true
    try {
      const entries = await Promise.all(
        targets.map(async (roomId) => [roomId, await matrixCryptoService.isRoomEncrypted(roomId)] as const)
      )
      encryptedRooms.value = Object.fromEntries(entries)
    } catch (err) {
      logger.warn(`加载私密会话加密状态失败: ${err}`)
    } finally {
      loading.value = false
    }
  }

  const isEncrypted = (roomId: string): boolean => encryptedRooms.value[roomId] === true

  return { encryptedRooms, loading, refresh, isEncrypted }
}
```

`src/components/encryption/EncryptionLockBadge.vue`：

```vue
<template>
  <span class="inline-flex items-center gap-4px text-12px text-[--tjg-status-encryption-verified]">
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <rect x="4" y="10" width="16" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
    <span>{{ label }}</span>
  </span>
</template>

<script setup lang="ts">
defineProps<{ label: string }>()
</script>
```

两个列表页接入（模板内按现有会话项结构，在标题行末尾追加）：

```vue
<EncryptionLockBadge
  v-if="isEncrypted(session.roomId)"
  :label="t('home.secret_chat.encrypted_badge')"
/>
```

脚本中：

```ts
import EncryptionLockBadge from '@/components/encryption/EncryptionLockBadge.vue'
import { usePrivateRoomEncryption } from '@/composables/secretChat/usePrivateRoomEncryption'

const { refresh: refreshEncryption, isEncrypted } = usePrivateRoomEncryption()

// 在列表数据变化处调用（已有 watch / onMounted 内追加一行）
watch(
  () => sessions.value.map((s) => s.roomId),
  (roomIds) => {
    void refreshEncryption(roomIds)
  },
  { immediate: true }
)
```

文案：`home.secret_chat.encrypted_badge` → zh-CN「已加密」/ en「Encrypted」。

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm gen:i18n && pnpm vitest run src/composables/secretChat/__tests__/usePrivateRoomEncryption.test.ts src/components/encryption/__tests__/EncryptionLockBadge.test.ts && pnpm vue-tsc --noEmit`
Expected: 4 passed；类型检查 0 错误

- [ ] **Step 5: 提交**

```bash
git add src/composables/secretChat/usePrivateRoomEncryption.ts src/components/encryption/EncryptionLockBadge.vue src/composables/secretChat/__tests__/usePrivateRoomEncryption.test.ts src/components/encryption/__tests__/EncryptionLockBadge.test.ts src/views/homeWindow/SecretChatPage.vue src/mobile/views/secretChat/SecretChatPage.vue locales/zh-CN/home.json locales/en/home.json src/typings/i18n.d.ts
git commit -m "feat(chat): 私密会话列表展示端到端加密徽标"
```

---

### Task 4: 聊天室加密风险横幅（备份 / 4S / crypto 初始化）

**Files:**
- Create: `src/composables/encryption/useRoomEncryptionStatus.ts`
- Create: `src/components/encryption/RoomEncryptionBanner.vue`
- Modify: `src/components/rightBox/chatBox/index.vue`
- Modify: `src/mobile/layout/chat-room/ChatRoomLayout.vue`
- Test: `src/composables/encryption/__tests__/useRoomEncryptionStatus.test.ts`、`src/components/encryption/__tests__/RoomEncryptionBanner.test.ts`
- Modify: `locales/zh-CN/chat.json`、`locales/en/chat.json`

**Interfaces:**
- Consumes: `matrixCryptoService.isRoomEncrypted(roomId)`、`useEncryptionStore()` 的 `cryptoInitFailed` / `backupEnabled` / `crossSigningKeysLocalOnly` / `loaded` / `loadEncryptionStatus()`
- Produces:
  - `useRoomEncryptionStatus(roomId: Ref<string>): { isEncrypted: Ref<boolean>; loading: Ref<boolean>; warnings: ComputedRef<EncryptionWarningKey[]>; reload(): Promise<void> }`
  - `type EncryptionWarningKey = 'crypto_init_failed' | 'backup_disabled' | 'keys_local_only'`

- [ ] **Step 1: 写失败测试**

`useRoomEncryptionStatus.test.ts`：

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

const mocks = vi.hoisted(() => ({
  isRoomEncrypted: vi.fn(),
  loadEncryptionStatus: vi.fn(),
  store: {
    cryptoInitFailed: false,
    backupEnabled: true,
    crossSigningKeysLocalOnly: false,
    loaded: true
  }
}))

vi.mock('@/services/matrix/crypto/MatrixCryptoService', () => ({
  matrixCryptoService: { isRoomEncrypted: mocks.isRoomEncrypted }
}))

vi.mock('@/stores/domains/settings/encryption', () => ({
  useEncryptionStore: () => mocks.store
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })
}))

import { useRoomEncryptionStatus } from '../useRoomEncryptionStatus'

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('useRoomEncryptionStatus', () => {
  beforeEach(() => {
    mocks.isRoomEncrypted.mockReset().mockResolvedValue(true)
    mocks.loadEncryptionStatus.mockReset().mockResolvedValue(undefined)
    Object.assign(mocks.store, {
      cryptoInitFailed: false,
      backupEnabled: true,
      crossSigningKeysLocalOnly: false,
      loaded: true
    })
  })

  it('已加密且备份就绪时不产生告警', async () => {
    const { warnings, reload } = useRoomEncryptionStatus(ref('!a:test'))
    await reload()
    expect(warnings.value).toEqual([])
  })

  it('备份未开启时产生 backup_disabled', async () => {
    mocks.store.backupEnabled = false
    const { warnings, reload } = useRoomEncryptionStatus(ref('!a:test'))
    await reload()
    expect(warnings.value).toContain('backup_disabled')
  })

  it('私钥仅存本机时产生 keys_local_only', async () => {
    mocks.store.crossSigningKeysLocalOnly = true
    const { warnings, reload } = useRoomEncryptionStatus(ref('!a:test'))
    await reload()
    expect(warnings.value).toContain('keys_local_only')
  })

  it('房间未加密时不产生任何告警', async () => {
    mocks.isRoomEncrypted.mockResolvedValue(false)
    mocks.store.backupEnabled = false
    const { warnings, reload, isEncrypted } = useRoomEncryptionStatus(ref('!a:test'))
    await reload()
    expect(isEncrypted.value).toBe(false)
    expect(warnings.value).toEqual([])
  })

  it('状态未加载时会触发一次 loadEncryptionStatus', async () => {
    mocks.store.loaded = false
    const { reload } = useRoomEncryptionStatus(ref('!a:test'))
    await reload()
    expect(mocks.loadEncryptionStatus).toHaveBeenCalledTimes(1)
  })
})
```

`RoomEncryptionBanner.test.ts`：

```ts
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import RoomEncryptionBanner from '../RoomEncryptionBanner.vue'

const messages: Record<string, string> = {
  'chat.encryption_banner.backup_disabled': '密钥备份未开启',
  'chat.encryption_banner.keys_local_only': '安全密钥只存在本机',
  'chat.encryption_banner.crypto_init_failed': '加密模块初始化失败'
}

const mountBanner = (warnings: string[]) =>
  mount(RoomEncryptionBanner, {
    props: { warnings },
    global: { mocks: { $t: (key: string) => messages[key] ?? key } }
  })

describe('RoomEncryptionBanner', () => {
  it('无告警时不渲染', () => {
    expect(mountBanner([]).find('[data-test="room-encryption-banner"]').exists()).toBe(false)
  })

  it('逐条渲染告警文案', () => {
    const wrapper = mountBanner(['backup_disabled', 'keys_local_only'])
    expect(wrapper.text()).toContain('密钥备份未开启')
    expect(wrapper.text()).toContain('安全密钥只存在本机')
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run src/composables/encryption/__tests__/useRoomEncryptionStatus.test.ts src/components/encryption/__tests__/RoomEncryptionBanner.test.ts`
Expected: FAIL，模块不存在

- [ ] **Step 3: 写最小实现**

`useRoomEncryptionStatus.ts`：

```ts
import { computed, onMounted, ref, watch, type Ref } from 'vue'
import { matrixCryptoService } from '@/services/matrix/crypto/MatrixCryptoService'
import { useEncryptionStore } from '@/stores/domains/settings/encryption'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('RoomEncryptionStatus')

export type EncryptionWarningKey = 'crypto_init_failed' | 'backup_disabled' | 'keys_local_only'

/**
 * 单个房间的加密就绪度。
 *
 * 只读聚合：房间是否加密来自 SDK 状态事件；备份/4S 状态来自既有 EncryptionStore，
 * 不在这里重复请求 /room_keys/version。
 */
export const useRoomEncryptionStatus = (roomId: Ref<string>) => {
  const encryptionStore = useEncryptionStore()
  const isEncrypted = ref(false)
  const loading = ref(false)

  const reload = async (): Promise<void> => {
    if (!roomId.value) {
      isEncrypted.value = false
      return
    }
    loading.value = true
    try {
      isEncrypted.value = await matrixCryptoService.isRoomEncrypted(roomId.value)
      if (!encryptionStore.loaded) {
        await encryptionStore.loadEncryptionStatus()
      }
    } catch (err) {
      logger.warn(`加载房间加密状态失败: ${err}`)
    } finally {
      loading.value = false
    }
  }

  onMounted(() => {
    void reload()
  })
  watch(roomId, () => {
    void reload()
  })

  const warnings = computed<EncryptionWarningKey[]>(() => {
    if (!isEncrypted.value) return []
    const result: EncryptionWarningKey[] = []
    if (encryptionStore.cryptoInitFailed) result.push('crypto_init_failed')
    if (!encryptionStore.backupEnabled) result.push('backup_disabled')
    if (encryptionStore.crossSigningKeysLocalOnly) result.push('keys_local_only')
    return result
  })

  return { isEncrypted, loading, warnings, reload }
}
```

`RoomEncryptionBanner.vue`：

```vue
<template>
  <div
    v-if="warnings.length"
    data-test="room-encryption-banner"
    class="flex flex-col gap-2px px-12px py-8px text-12px bg-[--tjg-color-warning-bg] text-[--tjg-color-warning-700]"
  >
    <span v-for="warning in warnings" :key="warning" class="flex items-center gap-6px">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M12 3 2.5 20h19L12 3Z" />
        <path d="M12 9v5M12 17h.01" />
      </svg>
      <span>{{ t(`chat.encryption_banner.${warning}`) }}</span>
    </span>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { EncryptionWarningKey } from '@/composables/encryption/useRoomEncryptionStatus'

defineProps<{ warnings: EncryptionWarningKey[] }>()

const { t } = useI18n()
</script>
```

桌面端 `src/components/rightBox/chatBox/index.vue`：在渲染 `ChatFooter` 的同一容器内、`ChatFooter` 之前插入：

```vue
<RoomEncryptionBanner :warnings="roomEncryptionWarnings" />
```

脚本：

```ts
import RoomEncryptionBanner from '@/components/encryption/RoomEncryptionBanner.vue'
import { useRoomEncryptionStatus } from '@/composables/encryption/useRoomEncryptionStatus'

const activeRoomId = computed(() => currentSession.value?.roomId ?? '')
const { warnings: roomEncryptionWarnings } = useRoomEncryptionStatus(activeRoomId)
```

（`currentSession` 用该文件已有的会话 ref，不要新取一份 store。）

移动端 `src/mobile/layout/chat-room/ChatRoomLayout.vue`：在底部输入区上方插入同一组件，`roomId` 复用该文件已有的路由 `roomId`：

```vue
<RoomEncryptionBanner :warnings="roomEncryptionWarnings" />
```

```ts
const activeRoomId = computed(() => String(route.params.roomId ?? ''))
const { warnings: roomEncryptionWarnings } = useRoomEncryptionStatus(activeRoomId)
```

文案（zh-CN / en）：

| key | zh-CN | en |
| :--- | :--- | :--- |
| `chat.encryption_banner.backup_disabled` | 密钥备份未开启，换设备后将无法解密历史消息 | Key backup is off. You will not be able to decrypt history on a new device. |
| `chat.encryption_banner.keys_local_only` | 安全密钥只存在本机，清除缓存或换设备将丢失解密能力 | Your security key exists only on this device. Clearing data or switching devices will lose decryption ability. |
| `chat.encryption_banner.crypto_init_failed` | 加密模块初始化失败，当前无法收发加密消息 | Encryption failed to initialize; encrypted messages are unavailable. |

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm gen:i18n && pnpm vitest run src/composables/encryption/__tests__/useRoomEncryptionStatus.test.ts src/components/encryption/__tests__/RoomEncryptionBanner.test.ts && pnpm vue-tsc --noEmit`
Expected: 7 passed；类型检查 0 错误

- [ ] **Step 5: 提交**

```bash
git add src/composables/encryption/useRoomEncryptionStatus.ts src/components/encryption/RoomEncryptionBanner.vue src/composables/encryption/__tests__/useRoomEncryptionStatus.test.ts src/components/encryption/__tests__/RoomEncryptionBanner.test.ts src/components/rightBox/chatBox/index.vue src/mobile/layout/chat-room/ChatRoomLayout.vue locales/zh-CN/chat.json locales/en/chat.json src/typings/i18n.d.ts
git commit -m "feat(chat): 加密会话展示密钥备份与跨签名风险提示"
```

---

### Task 5: 加密房间禁用服务端链接预览

**Files:**
- Modify: `src/components/rightBox/linkPreview/LinkPreviewPane.vue`
- Modify: `src/components/rightBox/linkPreview/__tests__/LinkPreviewPane.test.ts`
- Modify: `locales/zh-CN/chat.json`、`locales/en/chat.json`

**Interfaces:**
- Consumes: `matrixCryptoService.isRoomEncrypted(roomId)`、`useGlobalStore().currentSessionRoomId`
- Produces: 无对外新接口；`LinkPreviewPane` 在加密房间内不再调用 `matrixMediaService.getUrlPreview`

- [ ] **Step 1: 写失败测试**

在 `LinkPreviewPane.test.ts` 的 mock 区补：

```ts
const isRoomEncryptedMock = vi.fn().mockResolvedValue(false)
const currentSessionRoomId = ref('!room:test')

vi.mock('@/services/matrix/crypto/MatrixCryptoService', () => ({
  matrixCryptoService: { isRoomEncrypted: isRoomEncryptedMock }
}))

vi.mock('@/stores/domains/widget/global', () => ({
  useGlobalStore: () => ({ currentSessionRoomId })
}))
```

新增用例：

```ts
  it('加密房间不请求服务端预览', async () => {
    isRoomEncryptedMock.mockResolvedValueOnce(true)
    const wrapper = mountPane()
    await wrapper.find('input').setValue('https://example.com/a')
    await wrapper.find('[data-test="link-preview-fetch"]').trigger('click')
    await flushPromises()
    expect(getUrlPreviewMock).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('chat.link_preview.blocked_encrypted')
  })
```

（`data-test="link-preview-fetch"` 若当前按钮没有该属性，先给抓取按钮补上，属测试可观测性改动。）

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run src/components/rightBox/linkPreview/__tests__/LinkPreviewPane.test.ts`
Expected: FAIL，加密房间仍调用 `getUrlPreview`

- [ ] **Step 3: 写最小实现**

`LinkPreviewPane.vue` 补 import：

```ts
import { matrixCryptoService } from '@/services/matrix/crypto/MatrixCryptoService'
import { useGlobalStore } from '@/stores/domains/widget/global'
```

补状态与 store：

```ts
const globalStore = useGlobalStore()
const blockedByEncryption = ref(false)
```

`statusText` 增加分支（放在最前）：

```ts
const statusText = computed(() => {
  if (blockedByEncryption.value) return t('chat.link_preview.blocked_encrypted')
  if (fetching.value) return t('chat.link_preview.fetching')
  if (fetchFailed.value) return t('chat.link_preview.fetch_failed')
  return ''
})
```

`handleFetch` 改为：

```ts
const handleFetch = async () => {
  if (!isValidUrl.value || fetching.value) return

  // 解密只发生在客户端；链接一旦交给服务端抓取，room 的加密承诺就被绕开了。
  const roomId = globalStore.currentSessionRoomId
  if (roomId) {
    const encrypted = await matrixCryptoService.isRoomEncrypted(roomId)
    if (encrypted) {
      blockedByEncryption.value = true
      preview.value = null
      fetchFailed.value = false
      return
    }
  }

  blockedByEncryption.value = false
  await fetchPreview(normalizedUrl.value)
}
```

文案：`chat.link_preview.blocked_encrypted` → zh-CN「该会话已端到端加密，链接预览已禁用」/ en「This chat is end-to-end encrypted; link previews are disabled.」

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm gen:i18n && pnpm vitest run src/components/rightBox/linkPreview/__tests__/LinkPreviewPane.test.ts src/components/rightBox/chatBox/__tests__/ChatFooter.test.ts && pnpm vue-tsc --noEmit`
Expected: 全部 passed；类型检查 0 错误

- [ ] **Step 5: 提交**

```bash
git add src/components/rightBox/linkPreview/LinkPreviewPane.vue src/components/rightBox/linkPreview/__tests__/LinkPreviewPane.test.ts locales/zh-CN/chat.json locales/en/chat.json src/typings/i18n.d.ts
git commit -m "feat(chat): 加密会话禁用服务端链接预览"
```

---

### Task 6: 全量验收、R3 汇报与边界结论

**Files:**
- 不新增源码；只跑命令并记录结论（写入 PR 描述，不新建文档文件）

- [ ] **Step 1: 全量门禁**

```bash
pnpm vue-tsc --noEmit
pnpm test:run
pnpm check:ratchet
pnpm check:doc-coverage
pnpm check:doc-paths
pnpm check:sdk-boundary
pnpm quality:no-raw-fetch
pnpm check
```

Expected: 全部通过，`vue-tsc` 0 错误。

- [ ] **Step 2: R2 移动端裁剪校验**

```bash
rg -n "@/views/admin|@/plugins/robot|@/services/matrix/ai|@/services/siliconflow|@/services/trendradar" src/mobile src/composables/encryption src/components/encryption
```

Expected: 无输出。

```bash
pnpm adev:win
```

Expected: 移动端前端构建通过（Android/iOS 目标由 Tauri 构建承担，若本机无 SDK 则至少确认该命令能产出前端产物）。

- [ ] **Step 3: 人工冒烟（双端）**

1. 桌面端登录 → 日志出现 `E2EE 环境初始化完成`；退出登录后出现 `E2EE 状态已重置`。
2. 移动端长按单聊 → 设为私密 → 出现加密确认弹窗 → 确认后列表出现「已加密」徽标。
3. 在未开启密钥备份的账号进入已加密会话 → 顶部出现「密钥备份未开启」横幅。
4. 在已加密会话点链接预览 → 状态文本为「链接预览已禁用」，抓包确认无 `/preview_url` 请求。
5. 桌面端与移动端互发加密消息，双方均可解密；断网重连后消息仍可读。

- [ ] **Step 4: R3 清单结论（写进 PR 描述）**

1. 是否新增平行实现：否。房间加密走 `matrixCryptoService.enableEncryption`；房间加密状态走 `isRoomEncrypted`；备份状态复用 `EncryptionStore`。
2. 是否引入移动端 admin / AI 入口：否，Step 2 的 rg 为空。
3. 移动端构建是否正常：Step 2 命令通过（附输出截图或日志行）。

- [ ] **Step 5: 边界结论（写进 PR 描述，不新建文档）**

- 本计划生效后，**新设为私密**的单聊一定会开启 `m.room.encryption`；已存在的私密登记项若房间未加密，会在下次列表打开时只显示「未加密」（不自动开启，避免未经用户确认修改房间状态）。
- Matrix 加密不可逆：取消私密不会关闭加密，这是刻意行为。
- 开启加密**之前**的历史消息仍以明文存在服务端，无法追溯加密；产品文案不得承诺「历史消息也加密」。
- 附件与语音已由 `useMsgInputFileUpload` / `useVoiceInput` 走加密上传，本计划不重复实现，但 Task 6 需回归一次图片、文件、语音三条链路。
- 本地 SQLite legacy IM 链路的明文落盘不在本计划范围。

---

## Self-Review

**Spec coverage**

| 用户诉求 | 对应任务 |
| :--- | :--- |
| 桌面端 / 移动端真正 E2EE | Task 1（启动引导，双端同源）、Task 2（私密房间强制加密） |
| 设为私密要真正加密 | Task 2 |
| 用户能看见加密状态 | Task 3（列表徽标）、Task 4（风险横幅） |
| 换设备/清缓存不丢解密能力 | Task 4（备份未就绪提示）；强制恢复闸门明确延后 |
| 不把明文内容泄露给服务端 | Task 5（加密房间禁用链接预览） |
| 可验收、可回滚 | 每个任务独立提交 + Task 6 全量门禁 |

**Placeholder scan**：无 TBD / TODO；所有代码步骤均给出可粘贴实现；文案表给出中英对照。

**Type consistency**：`EncryptionWarningKey` 在 Task 4 中先定义于 composable、再由 `RoomEncryptionBanner` 导入；`togglePrivateRoom` 的 `TogglePrivateRoomOptions` 在 Task 2 内定义并被移动端调用方使用；`usePrivateRoomEncryption` 返回的 `refresh` / `isEncrypted` 在 Task 3 内自洽。
