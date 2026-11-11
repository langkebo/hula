# 移动端私密聊天 P0+P1+P2 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让移动端私密聊天形成闭环——能设置密码、能把会话设为私密、解锁后回到原房间、不再闪现私密内容，并提供与 Vant 风格一致的解锁弹窗。

**Architecture:** 不新增私密聊天的数据能力，全部复用既有 `privateRoomRegistry`（房间标记，account data 跨设备同步）、`secretChatSession`（内存 dbKey + 自动锁）、`settingStore`（密码与配置）与 `usePrivateRoomActions`。改动集中在 `src/mobile/**` 的 UI 层与两处门禁/挂载点（`useMobilePrivateRoomGate`、`ChatRoomLayout`、`App.vue` 的平台组件切换，沿用文件内已有的 `isMobilePlatform` 模式）。

**Tech Stack:** Vue 3 `<script setup>`、Pinia setup store、Vant 4、vue-router、vue-i18n、Vitest + @vue/test-utils。

## Global Constraints

- R1 SDK 优先：私密聊天只允许调用 `src/services/matrix/privateChat/**`、`src/stores/domains/settings/**` 与 `src/composables/secretChat/**` 的既有导出，禁止新增 fetch / 平行协议实现。
- R2 移动端零 admin/AI 残留：本计划不得在 `src/mobile/**` 引入 `@/views/admin`、`@/plugins/robot`、`@/services/matrix/ai`、`@/services/siliconflow`、`@/services/trendradar`。
- 移动端实现放 `src/mobile/**`；不得新增 `isMobile()` 内联分支（`App.vue` 沿用已有的 `isMobilePlatform` 组件切换模式）。
- 颜色只用 `--tjg-*` token，禁止新增 `#xxx` / `rgb()` / `rgba()`；图标必须 SVG 或 Iconify（线宽 1.5px）。
- 单个 `.vue` 不超过 800 行。
- 动效必须尊重 `prefers-reduced-motion`。
- 文案走 i18n，zh-CN 与 en-US 同步补齐；不用 emoji。
- 每完成一个 Task 跑一次定向测试；全部完成后跑重构验收命令：`pnpm vue-tsc --noEmit`、`pnpm test:run`、`pnpm check:ratchet`、`pnpm check:doc-coverage`、`pnpm check:doc-paths`、`pnpm check:sdk-boundary`、`pnpm quality:no-raw-fetch`、`pnpm check`。
- 提交使用 Conventional Commits（`feat:` / `fix:` / `test:`），不用 emoji，不 `--no-verify`。
- 工作区已有 5 个未提交文件（未读数对账补修），与本计划无关：**不要**在 Task 提交里 `git add -A`，逐文件 `git add`。

---

## 现有事实（执行前必读）

| 能力 | 位置 | 现状 |
| --- | --- | --- |
| 私密标记 | `src/services/matrix/privateChat/privateRoomRegistry.ts` | `isPrivateRoom` / `markRoomPrivate` / `unmarkRoomPrivate` / `loadPrivateRoomRegistry` / `ensurePrivateRoomRegistryReady` |
| 标记动作 | `src/composables/secretChat/usePrivateRoomActions.ts` | `{ isRoomPrivate, togglePrivateRoom }`；已内含「单聊限制 / 未配置直接提示 / 未解锁弹解锁框」三条守卫 |
| 密码与配置 | `src/stores/domains/settings/setting.ts` | `setSecretChatPassword` / `setSecretChatEnabled` / `setSecretChatAutoLock` / `setSecretChatLockTimeout` / `verifySecretChatPassword` / `unlockSecretChat` / `clearSecretChatPassword` / `isSecretChatConfigured` |
| 解锁态 | `src/stores/domains/settings/secretChatSession.ts` | `isSecretChatUnlocked` / `lockSecretChatSession` / `useSecretChatSession().isUnlocked` |
| 解锁弹窗状态 | `src/composables/secretChat/useSecretChatGate.ts` | `openSecretChatUnlock(path?)` / `closeSecretChatUnlock()` / `consumeSecretChatPendingPath()` / `recordSecretChatUnlockFailure()` / `useSecretChatGate()` |
| 移动端路由 | `src/router/routes/mobile.ts` | 私密列表 `mobileSecretChat` → `/mobile/secretChat`；聊天 `mobileChatMain` → `/mobile/chatRoom/chatMain/:roomId?` |
| 移动端设置路由 | `src/mobile/views/my/settingsRoutes.ts` | `MOBILE_SETTINGS_SECURITY_PRIVACY_PATH` = `/mobile/mobileMy/securityPrivacy` |
| 唯一配置 UI | `src/views/settingsWindow/tabs/sections/PrivateChatSection.vue` | 仅桌面存在 |

---

### Task 1: 移动端会话长按菜单「设为私密 / 取消私密」

**Files:**
- Modify: `src/mobile/composables/useMobileMessageActions.ts`（头部 import 与 `handleTogglePrivate`、返回值）
- Modify: `src/mobile/views/message/index.vue:84-98`（长按菜单第三项后追加）、`:127-136`（import）、`:162-165`（解构）
- Test: `src/mobile/composables/__tests__/useMobileMessageActions.private.test.ts`（新建）

**Interfaces:**
- Consumes：`usePrivateRoomActions(): { isRoomPrivate(roomId: string): boolean; togglePrivateRoom(item: SessionItem): Promise<boolean> }`
- Produces：`useMobileMessageActions(...)` 返回值新增 `handleTogglePrivate(item: SessionItem | null): Promise<void>`、`isRoomPrivate(roomId: string): boolean`

- [ ] **Step 1: 写失败测试**

新建 `src/mobile/composables/__tests__/useMobileMessageActions.private.test.ts`：

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const togglePrivateRoom = vi.fn(async () => true)
const isRoomPrivate = vi.fn(() => false)

vi.mock('@/composables/secretChat/usePrivateRoomActions', () => ({
  usePrivateRoomActions: () => ({ togglePrivateRoom, isRoomPrivate })
}))
vi.mock('@/composables/chat/useMessage', () => ({
  useMessage: () => ({ handleMsgDelete: vi.fn() })
}))
vi.mock('@/stores/domains/chat/chat', () => ({
  useChatStore: () => ({ getSessionList: vi.fn(async () => ({})), sessionList: [] })
}))
vi.mock('@/stores/domains/chat/contacts', () => ({ useContactStore: () => ({ getContactList: vi.fn() }) }))
vi.mock('@/stores/domains/widget/global', () => ({ useGlobalStore: () => ({ updateGlobalUnreadCount: vi.fn() }) }))
vi.mock('@/services/matrix/auth/MatrixSessionService', () => ({ matrixSessionService: {} }))
vi.mock('@/services/matrix/MatrixClientService', () => ({ matrixClientService: { on: vi.fn(), off: vi.fn() } }))
vi.mock('@/services/matrix/messaging/MatrixReceiptService', () => ({ matrixReceiptService: {} }))
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('@/composables/common/useActionFeedback', () => ({ useActionFeedback: () => ({ showFeedback: vi.fn() }) }))
vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ error: vi.fn(), warn: vi.fn(), debug: vi.fn() })
}))

import { useMobileMessageActions } from '../useMobileMessageActions'

const item = { roomId: '!room:test', type: 'single', top: false, unreadCount: 0 } as never

describe('useMobileMessageActions · 私密聊天', () => {
  beforeEach(() => {
    togglePrivateRoom.mockClear()
    isRoomPrivate.mockClear()
  })

  it('handleTogglePrivate 委托给 togglePrivateRoom 并关闭长按菜单', async () => {
    const close = vi.fn()
    const { handleTogglePrivate } = useMobileMessageActions({
      maskHandler: { close },
      currentLongPressItem: { value: null }
    })

    await handleTogglePrivate(item)

    expect(togglePrivateRoom).toHaveBeenCalledWith(item)
    expect(close).toHaveBeenCalledTimes(1)
  })

  it('item 为空时不做任何事', async () => {
    const close = vi.fn()
    const { handleTogglePrivate } = useMobileMessageActions({
      maskHandler: { close },
      currentLongPressItem: { value: null }
    })

    await handleTogglePrivate(null)

    expect(togglePrivateRoom).not.toHaveBeenCalled()
    expect(close).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest run src/mobile/composables/__tests__/useMobileMessageActions.private.test.ts`
Expected: FAIL，`handleTogglePrivate is not a function`。

- [ ] **Step 3: 实现**

`src/mobile/composables/useMobileMessageActions.ts`：

```ts
import { usePrivateRoomActions } from '@/composables/secretChat/usePrivateRoomActions'
```

在 `const { handleMsgDelete } = useMessage()` 下一行加：

```ts
  const { isRoomPrivate, togglePrivateRoom } = usePrivateRoomActions()
```

在 `handleToggleReadStatus` 之后、`onRefresh` 之前加：

```ts
  /** 设为私密 / 取消私密：守卫（单聊、已配置、已解锁）全部在 togglePrivateRoom 内。 */
  const handleTogglePrivate = async (item: SessionItem | null) => {
    if (!item) return
    try {
      await togglePrivateRoom(item)
    } catch (error) {
      logger.error('切换私密会话失败:', error)
    } finally {
      opts.maskHandler.close()
    }
  }
```

返回值改为：

```ts
  return {
    loading,
    refreshCount,
    handleDelete,
    handleToggleTop,
    handleToggleReadStatus,
    handleTogglePrivate,
    isRoomPrivate,
    onRefresh
  }
```

`src/mobile/views/message/index.vue`：

模板长按菜单（第三项之后）追加：

```vue
          <div
            v-if="currentLongPressItem?.type === RoomTypeEnum.SINGLE"
            v-clickable
            class="long-press-menu__item"
            @click="handleTogglePrivate(currentLongPressItem)">
            {{
              currentLongPressItem && isRoomPrivate(currentLongPressItem.roomId)
                ? t('home.secret_chat.unmark_private')
                : t('home.secret_chat.mark_private')
            }}
          </div>
```

script 中解构追加：

```ts
const { loading, handleDelete, handleToggleTop, handleToggleReadStatus, handleTogglePrivate, isRoomPrivate, onRefresh } =
  useMobileMessageActions({ maskHandler, currentLongPressItem })
```

并在 script 顶部补 import：

```ts
import { RoomTypeEnum } from '@/enums'
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm vitest run src/mobile/composables/__tests__/useMobileMessageActions.private.test.ts`
Expected: PASS（2 passed）。

- [ ] **Step 5: 提交**

```bash
git add src/mobile/composables/useMobileMessageActions.ts src/mobile/views/message/index.vue src/mobile/composables/__tests__/useMobileMessageActions.private.test.ts
git commit -m "feat(mobile): 会话长按菜单支持设为私密"
```

---

### Task 2: 移动端设置页「私密聊天」分区

**Files:**
- Create: `src/mobile/components/settings/MobilePrivateChatSection.vue`
- Modify: `src/mobile/views/my/SecuritySettings.vue`（模板插入分区 + import）
- Modify: `locales/zh-CN/mobile_security.json`、`locales/en-US/mobile_security.json`
- Test: `src/mobile/components/settings/__tests__/MobilePrivateChatSection.test.ts`（新建）

**Interfaces:**
- Consumes：`useSettingStore()` 的 `secretChatEnabled`、`secretChatAutoLock`、`secretChatLockTimeout`、`isSecretChatConfigured()`、`setSecretChatPassword(pwd)`、`setSecretChatEnabled(bool)`、`setSecretChatAutoLock(bool)`、`setSecretChatLockTimeout(minutes)`、`verifySecretChatPassword(pwd)`、`clearSecretChatPassword()`
- Produces：组件 `default export name: 'MobilePrivateChatSection'`，无 props，无事件

- [ ] **Step 1: 写失败测试**

新建 `src/mobile/components/settings/__tests__/MobilePrivateChatSection.test.ts`：

```ts
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

const state = {
  configured: true,
  enabled: ref(true),
  autoLock: ref(false),
  lockTimeout: ref(5)
}
const setSecretChatPassword = vi.fn(async () => undefined)
const setSecretChatEnabled = vi.fn()
const setSecretChatAutoLock = vi.fn()
const setSecretChatLockTimeout = vi.fn()
const clearSecretChatPassword = vi.fn()
const verifySecretChatPassword = vi.fn(async () => true)

vi.mock('@/stores/domains/settings/setting', () => ({
  useSettingStore: () => ({
    secretChatEnabled: state.enabled.value,
    secretChatAutoLock: state.autoLock.value,
    secretChatLockTimeout: state.lockTimeout.value,
    isSecretChatConfigured: () => state.configured,
    setSecretChatPassword,
    setSecretChatEnabled,
    setSecretChatAutoLock,
    setSecretChatLockTimeout,
    verifySecretChatPassword,
    clearSecretChatPassword
  })
}))
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('vant', () => ({
  showToast: vi.fn(),
  showConfirmDialog: vi.fn(async () => undefined)
}))

import MobilePrivateChatSection from '../MobilePrivateChatSection.vue'

const stubs = {
  'van-cell-group': { template: '<div><slot /></div>' },
  'van-cell': { template: '<div><slot name="title" /><slot name="icon" /></div>' },
  'van-switch': { template: '<input type="checkbox" />' },
  'van-button': { template: '<button><slot /></button>' },
  'van-field': { template: '<input />' },
  'van-dialog': { template: '<div><slot /></div>' },
  Icon: { template: '<i />' }
}
const global = { stubs, mocks: { $t: (k: string) => k } }

describe('MobilePrivateChatSection', () => {
  it('已配置时展示「修改密码」，未配置时展示「设置密码」', async () => {
    state.configured = true
    const wrapper = mount(MobilePrivateChatSection, { global })
    expect(wrapper.text()).toContain('mobile_security.secret_chat.change_password')
  })

  it('关闭启用开关时调用 setSecretChatEnabled(false)', async () => {
    state.configured = true
    const wrapper = mount(MobilePrivateChatSection, { global })
    const vm = wrapper.vm as unknown as { handleEnabledChange: (v: boolean) => void }
    vm.handleEnabledChange(false)
    expect(setSecretChatEnabled).toHaveBeenCalledWith(false)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest run src/mobile/components/settings/__tests__/MobilePrivateChatSection.test.ts`
Expected: FAIL，模块不存在。

- [ ] **Step 3: 补齐 i18n**

`locales/zh-CN/mobile_security.json` 增加：

```json
"secret_chat_section": "私密聊天",
"secret_chat": {
  "password": "私密聊天密码",
  "set_password": "设置密码",
  "change_password": "修改密码",
  "password_unset": "未设置",
  "enable": "启用私密聊天",
  "enable_hint": "开启后，标记为私密的会话需输入密码才能查看",
  "auto_lock": "离开后自动锁定",
  "auto_lock_hint": "离开私密会话后按设定时间自动上锁",
  "lock_timeout": "自动锁定时间",
  "minutes": "{n} 分钟",
  "clear": "清除私密聊天密码",
  "clear_confirm": "清除后所有私密标记将不再受密码保护，确定清除？",
  "cleared": "已清除私密聊天密码",
  "password_saved": "密码已设置，请重新解锁",
  "password_mismatch": "两次输入的密码不一致",
  "password_too_short": "密码至少 6 位",
  "old_password": "当前密码",
  "new_password": "新密码",
  "confirm_password": "确认新密码",
  "go_settings": "去设置密码"
}
```

`locales/en-US/mobile_security.json` 增加同结构英文：`"secret_chat_section": "Secret Chat"`，`secret_chat` 内 `password: "Secret chat password"`、`set_password: "Set password"`、`change_password: "Change password"`、`password_unset: "Not set"`、`enable: "Enable secret chat"`、`enable_hint: "Secret chats require a password to open"`、`auto_lock: "Auto-lock on leave"`、`auto_lock_hint: "Lock secret chats after leaving for the configured time"`、`lock_timeout: "Auto-lock timeout"`、`minutes: "{n} min"`、`clear: "Clear secret chat password"`、`clear_confirm: "All secret marks will no longer be password protected. Clear anyway?"`、`cleared: "Secret chat password cleared"`、`password_saved: "Password set. Please unlock again"`、`password_mismatch: "Passwords do not match"`、`password_too_short: "Password must be at least 6 characters"`、`old_password: "Current password"`、`new_password: "New password"`、`confirm_password: "Confirm new password"`、`go_settings: "Set password"`。

- [ ] **Step 4: 实现组件**

新建 `src/mobile/components/settings/MobilePrivateChatSection.vue`：

```vue
<template>
  <van-cell-group inset>
    <van-cell :title="t('mobile_security.secret_chat.password')" :value="passwordLabel" is-link @click="openPasswordDialog" />
    <van-cell :title="t('mobile_security.secret_chat.enable')" :label="t('mobile_security.secret_chat.enable_hint')">
      <template #right-icon>
        <van-switch :model-value="enabled" size="20px" @update:model-value="handleEnabledChange" />
      </template>
    </van-cell>
    <van-cell :title="t('mobile_security.secret_chat.auto_lock')" :label="t('mobile_security.secret_chat.auto_lock_hint')">
      <template #right-icon>
        <van-switch :model-value="autoLock" size="20px" :disabled="!configured" @update:model-value="handleAutoLockChange" />
      </template>
    </van-cell>
    <van-cell
      v-if="autoLock"
      :title="t('mobile_security.secret_chat.lock_timeout')"
      :value="t('mobile_security.secret_chat.minutes', { n: lockTimeout })"
      is-link
      @click="showTimeoutSheet = true" />
    <van-cell
      v-if="configured"
      :title="t('mobile_security.secret_chat.clear')"
      class="text-[--tjg-color-danger-500]"
      is-link
      @click="handleClear" />
  </van-cell-group>

  <van-popup v-model:show="showTimeoutSheet" position="bottom" round>
    <van-picker
      :columns="timeoutColumns"
      :model-value="[String(lockTimeout)]"
      @confirm="handleTimeoutConfirm"
      @cancel="showTimeoutSheet = false" />
  </van-popup>

  <van-dialog
    v-model:show="showPasswordDialog"
    :title="configured ? t('mobile_security.secret_chat.change_password') : t('mobile_security.secret_chat.set_password')"
    show-cancel-button
    :confirm-button-text="t('mobile_security.confirm')"
    :cancel-button-text="t('mobile_security.cancel')"
    :before-close="handlePasswordConfirm">
    <div class="p-16px">
      <van-field
        v-if="configured"
        v-model="form.oldPassword"
        type="password"
        :label="t('mobile_security.secret_chat.old_password')" />
      <van-field v-model="form.newPassword" type="password" :label="t('mobile_security.secret_chat.new_password')" />
      <van-field
        v-model="form.confirmPassword"
        type="password"
        :label="t('mobile_security.secret_chat.confirm_password')" />
    </div>
  </van-dialog>
</template>

<script setup lang="ts">
import { showConfirmDialog, showToast } from 'vant'
import { computed, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('MobilePrivateChatSection')

defineOptions({ name: 'MobilePrivateChatSection' })

const { t } = useI18n()
const settingStore = useSettingStore()

const showPasswordDialog = ref(false)
const showTimeoutSheet = ref(false)
const form = reactive({ oldPassword: '', newPassword: '', confirmPassword: '' })

const configured = computed(() => settingStore.isSecretChatConfigured())
const enabled = computed(() => settingStore.secretChatEnabled)
const autoLock = computed(() => settingStore.secretChatAutoLock)
const lockTimeout = computed(() => settingStore.secretChatLockTimeout)

const passwordLabel = computed(() =>
  configured.value ? t('mobile_security.secret_chat.change_password') : t('mobile_security.secret_chat.set_password')
)

const timeoutColumns = [1, 5, 15, 30].map((n) => ({
  text: t('mobile_security.secret_chat.minutes', { n }),
  value: String(n)
}))

const openPasswordDialog = () => {
  form.oldPassword = ''
  form.newPassword = ''
  form.confirmPassword = ''
  showPasswordDialog.value = true
}

const handleEnabledChange = (value: boolean) => {
  if (value && !configured.value) {
    openPasswordDialog()
    return
  }
  try {
    settingStore.setSecretChatEnabled(value)
  } catch (err) {
    logger.warn('切换私密聊天开关失败:', err)
    showToast({ type: 'fail', message: t('home.secret_chat.no_password') })
  }
}

const handleAutoLockChange = (value: boolean) => {
  settingStore.setSecretChatAutoLock(value)
}

const handleTimeoutConfirm = ({ selectedOptions }: { selectedOptions: Array<{ value: string }> }) => {
  const minutes = Number(selectedOptions?.[0]?.value ?? lockTimeout.value)
  settingStore.setSecretChatLockTimeout(minutes)
  showTimeoutSheet.value = false
}

/** 返回 true 关闭弹窗，false 保持打开。 */
const handlePasswordConfirm = async (action: string): Promise<boolean> => {
  if (action !== 'confirm') return true
  if (form.newPassword.length < 6) {
    showToast({ type: 'fail', message: t('mobile_security.secret_chat.password_too_short') })
    return false
  }
  if (form.newPassword !== form.confirmPassword) {
    showToast({ type: 'fail', message: t('mobile_security.secret_chat.password_mismatch') })
    return false
  }
  if (configured.value) {
    const valid = await settingStore.verifySecretChatPassword(form.oldPassword)
    if (!valid) {
      showToast({ type: 'fail', message: t('home.secret_chat.password_incorrect') })
      return false
    }
  }
  await settingStore.setSecretChatPassword(form.newPassword)
  showToast({ type: 'success', message: t('mobile_security.secret_chat.password_saved') })
  return true
}

const handleClear = async () => {
  try {
    await showConfirmDialog({
      title: t('mobile_security.secret_chat.clear'),
      message: t('mobile_security.secret_chat.clear_confirm'),
      confirmButtonText: t('mobile_security.confirm'),
      cancelButtonText: t('mobile_security.cancel')
    })
  } catch {
    return
  }
  settingStore.clearSecretChatPassword()
  showToast({ type: 'success', message: t('mobile_security.secret_chat.cleared') })
}
</script>
```

- [ ] **Step 5: 接入设置页**

`src/mobile/views/my/SecuritySettings.vue`：在「隐私」分区 `van-cell-group` 之后插入：

```vue
          <div class="text-14px text-[var(--tjg-text-secondary)] mt-16px mb-8px">
            {{ t('mobile_security.secret_chat_section') }}
          </div>

          <MobilePrivateChatSection />
```

script 增加 import：

```ts
import MobilePrivateChatSection from '#/components/settings/MobilePrivateChatSection.vue'
```

- [ ] **Step 6: 运行测试确认通过**

Run: `pnpm vitest run src/mobile/components/settings/__tests__/MobilePrivateChatSection.test.ts`
Expected: PASS。若 `van-picker` 的 `model-value` 触发告警，检查 columns 是否 `{ text, value }` 结构。

- [ ] **Step 7: 提交**

```bash
git add src/mobile/components/settings/MobilePrivateChatSection.vue src/mobile/views/my/SecuritySettings.vue locales/zh-CN/mobile_security.json locales/en-US/mobile_security.json src/mobile/components/settings/__tests__/MobilePrivateChatSection.test.ts
git commit -m "feat(mobile): 设置页新增私密聊天配置分区"
```

---

### Task 3: 解锁后回到原房间 + 进房遮罩

**Files:**
- Modify: `src/composables/secretChat/useMobilePrivateRoomGate.ts`（`assertAccess` 回跳目标）
- Modify: `src/mobile/layout/chat-room/ChatRoomLayout.vue`（遮罩）
- Test: `src/composables/secretChat/__tests__/useMobilePrivateRoomGate.test.ts`（已存在则改断言，不存在则新建）

**Interfaces:**
- Consumes：`openSecretChatUnlock(targetPath?: string)`、`isSecretChatUnlocked()`、`isPrivateRoom(roomId)`、`ensurePrivateRoomRegistryReady()`
- Produces：`assertAccess` 行为不变（返回 `Promise<boolean>`）；聊天路 path 构造 `'/mobile/chatRoom/chatMain/' + roomId`

- [ ] **Step 1: 先确认路由路径常量**

Run: `grep -n "chatMain" src/router/routes/mobile.ts`
Expected: 看到 `path: '/mobile/chatRoom/chatMain/:roomId?'`（若路径不同，以实际为准并同步本计划的字符串）。注意 roomId 含 `!` 与 `:`，必须用 `router.push({ name, params })` 风格，不要手拼 URL。

- [ ] **Step 2: 写失败测试**

在 `src/composables/secretChat/__tests__/useMobilePrivateRoomGate.test.ts` 增加：

```ts
it('私密房未解锁时，解锁回跳目标是原房间而不是私密列表', async () => {
  // 既有 mock 已让 isPrivateRoom('!p:test') === true、isSecretChatUnlocked() === false、
  // isSecretChatConfigured() === true；沿用该文件顶部的 vi.mock 配置。
  const { assertAccess } = useMobilePrivateRoomGate()
  const result = await assertAccess('!p:test')

  expect(result).toBe(false)
  expect(openSecretChatUnlock).toHaveBeenCalledWith({ name: 'mobileChatMain', params: { roomId: '!p:test' } })
})
```

若现有测试文件用 `expect(openSecretChatUnlock).toHaveBeenCalledWith('/mobile/secretChat')`，把它改为上面的断言。

- [ ] **Step 3: 运行测试确认失败**

Run: `pnpm vitest run src/composables/secretChat/__tests__/useMobilePrivateRoomGate.test.ts`
Expected: FAIL，实际入参为 `'/mobile/secretChat'`。

- [ ] **Step 4: 修改门禁回跳目标**

`src/composables/secretChat/useMobilePrivateRoomGate.ts`：把

```ts
    openSecretChatUnlock(MOBILE_SECRET_CHAT_LIST)
```

改为

```ts
    // 解锁后直接回到原房间，而不是把用户丢到私密列表（用户点的是某个会话）
    openSecretChatUnlock({ name: 'mobileChatMain', params: { roomId: privateRoomId } })
```

同时把 `openSecretChatUnlock` 的入参类型放宽为 `string | RouteLocationRaw`（`useSecretChatGate.ts` 中 `pendingPath` 的类型也改成 `Ref<RouteLocationRaw | null>`，`consumeSecretChatPendingPath` 返回 `RouteLocationRaw | null`）。

- [ ] **Step 5: 加进房遮罩**

`src/mobile/layout/chat-room/ChatRoomLayout.vue` 模板改为：

```vue
      <div class="relative flex flex-col flex-1 min-h-0">
        <router-view v-slot="{ Component }">
          <keep-alive :include="['mobileChatRoomDefault', 'mobileGroupChatMember']">
            <component :is="Component" />
          </keep-alive>
        </router-view>

        <!-- 门禁是异步的：遮住首帧，避免私密内容闪现（不依赖颜色传达状态，带 aria-label） -->
        <div
          v-if="gatePending"
          class="absolute inset-0 z-10 flex items-center justify-center bg-[--tjg-surface-panel]"
          data-testid="mobile-chat-room-gate-mask"
          role="status"
          :aria-label="t('home.secret_chat.checking_access')">
          <van-loading size="24px" />
        </div>
      </div>
```

script 改为：

```ts
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useMobilePrivateRoomGate } from '@/composables/secretChat/useMobilePrivateRoomGate'

const { t } = useI18n()
const route = useRoute()
const gatePending = ref(false)
const computedBottomSafeAreaClass = computed(() => {
  if (route.name === 'mobileChatMain') {
    return 'bg-[--tjg-surface-panel-muted]'
  }
  return ''
})

const { assertAccess } = useMobilePrivateRoomGate()

const guardCurrentRoom = async () => {
  if (route.name !== 'mobileChatMain') {
    gatePending.value = false
    return
  }
  const roomId = route.params.roomId
  // 进入任何会话先遮一帧：登记表加载完成后才知道是不是私密房
  gatePending.value = true
  try {
    await assertAccess(typeof roomId === 'string' ? roomId : undefined)
  } finally {
    gatePending.value = false
  }
}

watch(() => [route.name, route.params.roomId] as const, guardCurrentRoom, { immediate: true })
</script>
```

i18n 补 `home.secret_chat.checking_access`：zh-CN `"正在校验访问权限"`，en-US `"Checking access"`。遮罩不加 transition，天然满足 `prefers-reduced-motion`。

- [ ] **Step 6: 运行测试确认通过**

Run: `pnpm vitest run src/composables/secretChat/__tests__/useMobilePrivateRoomGate.test.ts`
Expected: PASS。

- [ ] **Step 7: 提交**

```bash
git add src/composables/secretChat/useMobilePrivateRoomGate.ts src/composables/secretChat/useSecretChatGate.ts src/mobile/layout/chat-room/ChatRoomLayout.vue src/composables/secretChat/__tests__/useMobilePrivateRoomGate.test.ts locales/zh-CN/home.json locales/en-US/home.json
git commit -m "feat(mobile): 解锁后回到原私密会话并增加进房遮罩"
```

---

### Task 4: 移动端专属解锁弹窗（Vant）

**Files:**
- Create: `src/mobile/components/secretChat/MobileSecretChatUnlockDialog.vue`
- Modify: `src/App.vue:22` 与 `:74-85`（平台组件切换）
- Test: `src/mobile/components/secretChat/__tests__/MobileSecretChatUnlockDialog.test.ts`（新建）

**Interfaces:**
- Consumes：`useSecretChatGate()`、`consumeSecretChatPendingPath()`、`closeSecretChatUnlock()`、`recordSecretChatUnlockFailure()`、`useSettingStore().unlockSecretChat(pwd)`、`MOBILE_SETTINGS_SECURITY_PRIVACY_PATH`
- Produces：组件 `name: 'MobileSecretChatUnlockDialog'`，自行控制显隐（`v-model:show` 绑定 gate 的 `visible`），无 props/事件

- [ ] **Step 1: 写失败测试**

新建 `src/mobile/components/secretChat/__tests__/MobileSecretChatUnlockDialog.test.ts`：

```ts
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

const visible = ref(true)
const pendingPath = ref<unknown>({ name: 'mobileChatMain', params: { roomId: '!p:test' } })
const unlockSecretChat = vi.fn(async () => true)
const recordSecretChatUnlockFailure = vi.fn(() => 1)
const closeSecretChatUnlock = vi.fn(() => {
  visible.value = false
})
const consumeSecretChatPendingPath = vi.fn(() => pendingPath.value)
const replace = vi.fn(async () => undefined)

vi.mock('@/composables/secretChat/useSecretChatGate', () => ({
  useSecretChatGate: () => ({ visible, pendingPath, failureCount: ref(0) }),
  consumeSecretChatPendingPath,
  closeSecretChatUnlock,
  recordSecretChatUnlockFailure
}))
vi.mock('@/stores/domains/settings/setting', () => ({ useSettingStore: () => ({ unlockSecretChat }) }))
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('vue-router', () => ({ useRouter: () => ({ replace }) }))
vi.mock('vant', () => ({ showToast: vi.fn() }))

import MobileSecretChatUnlockDialog from '../MobileSecretChatUnlockDialog.vue'

const global = {
  stubs: {
    'van-dialog': { template: '<div><slot /></div>' },
    'van-field': { template: '<input />' },
    'van-button': { template: '<button><slot /></button>' }
  }
}

describe('MobileSecretChatUnlockDialog', () => {
  it('解锁成功后跳到 pendingPath', async () => {
    const wrapper = mount(MobileSecretChatUnlockDialog, { global })
    const vm = wrapper.vm as unknown as { password: string; handleConfirm: () => Promise<void> }
    vm.password = 'DevUnlock!2026'
    await vm.handleConfirm()

    expect(unlockSecretChat).toHaveBeenCalledWith('DevUnlock!2026')
    expect(closeSecretChatUnlock).toHaveBeenCalled()
    expect(replace).toHaveBeenCalledWith({ name: 'mobileChatMain', params: { roomId: '!p:test' } })
  })

  it('解锁失败记录失败次数且不跳转', async () => {
    unlockSecretChat.mockResolvedValueOnce(false)
    const wrapper = mount(MobileSecretChatUnlockDialog, { global })
    const vm = wrapper.vm as unknown as { password: string; handleConfirm: () => Promise<void> }
    vm.password = 'wrong'
    await vm.handleConfirm()

    expect(recordSecretChatUnlockFailure).toHaveBeenCalled()
    expect(replace).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest run src/mobile/components/secretChat/__tests__/MobileSecretChatUnlockDialog.test.ts`
Expected: FAIL，模块不存在。

- [ ] **Step 3: 实现弹窗**

新建 `src/mobile/components/secretChat/MobileSecretChatUnlockDialog.vue`：

```vue
<template>
  <van-dialog
    v-model:show="show"
    :title="t('home.secret_chat.unlock_title')"
    :show-cancel-button="true"
    :confirm-button-text="t('home.secret_chat.unlock_action')"
    :cancel-button-text="t('common.cancel')"
    :before-close="handleBeforeClose">
    <div class="p-16px flex flex-col gap-12px">
      <van-field
        v-model="password"
        type="password"
        :label="t('home.secret_chat.password_label')"
        :placeholder="t('home.secret_chat.password_placeholder')"
        :maxlength="64"
        autocomplete="current-password" />
      <div v-if="failureCount >= 3" class="flex flex-col gap-8px" data-testid="mobile-secret-chat-failure-hint">
        <span class="text-12px text-[--tjg-color-warning-500]">{{ t('home.secret_chat.password_incorrect_retry') }}</span>
        <van-button size="small" plain type="primary" @click="goSettings">
          {{ t('mobile_security.secret_chat.go_settings') }}
        </van-button>
      </div>
    </div>
  </van-dialog>
</template>

<script setup lang="ts">
import { showToast } from 'vant'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import {
  closeSecretChatUnlock,
  consumeSecretChatPendingPath,
  recordSecretChatUnlockFailure,
  useSecretChatGate
} from '@/composables/secretChat/useSecretChatGate'
import { MOBILE_SETTINGS_SECURITY_PRIVACY_PATH } from '@/mobile/views/my/settingsRoutes'
import { useSettingStore } from '@/stores/domains/settings/setting'

defineOptions({ name: 'MobileSecretChatUnlockDialog' })

const { t } = useI18n()
const router = useRouter()
const settingStore = useSettingStore()
const { visible, failureCount } = useSecretChatGate()

const password = ref('')
const submitting = ref(false)

const show = computed({
  get: () => visible.value,
  set: (value: boolean) => {
    if (!value) {
      password.value = ''
      closeSecretChatUnlock()
    }
  }
})

const handleConfirm = async () => {
  if (submitting.value) return
  if (!password.value) {
    showToast({ type: 'fail', message: t('home.secret_chat.password_required') })
    return
  }
  submitting.value = true
  try {
    const ok = await settingStore.unlockSecretChat(password.value)
    if (!ok) {
      recordSecretChatUnlockFailure()
      password.value = ''
      showToast({ type: 'fail', message: t('home.secret_chat.password_incorrect') })
      return
    }
    const target = consumeSecretChatPendingPath()
    closeSecretChatUnlock()
    await router.replace(target ?? '/mobile/secretChat')
  } finally {
    submitting.value = false
  }
}

/** van-dialog before-close：confirm 走校验，失败保持打开；cancel 直接关。 */
const handleBeforeClose = async (action: string): Promise<boolean> => {
  if (action !== 'confirm') {
    password.value = ''
    return true
  }
  await handleConfirm()
  return false
}

const goSettings = () => {
  closeSecretChatUnlock()
  void router.replace(MOBILE_SETTINGS_SECURITY_PRIVACY_PATH)
}
</script>
```

- [ ] **Step 4: 挂载到 App**

`src/App.vue`：

```ts
const DesktopSecretChatUnlockDialog = defineAsyncComponent(
  () => import('@/components/secretChat/SecretChatUnlockDialog.vue')
)
const MobileSecretChatUnlockDialog = defineAsyncComponent(
  () => import('@/mobile/components/secretChat/MobileSecretChatUnlockDialog.vue')
)
```

放在 `const isMobilePlatform = useIsMobile()` 之后（避免 TDZ）：

```ts
const secretChatUnlockDialog = isMobilePlatform.value ? MobileSecretChatUnlockDialog : DesktopSecretChatUnlockDialog
```

模板第 22 行改为：

```vue
      <component :is="secretChatUnlockDialog" />
```

同时删除原第 77 行的 `SecretChatUnlockDialog` 定义。

- [ ] **Step 5: 运行测试确认通过**

Run: `pnpm vitest run src/mobile/components/secretChat/__tests__/MobileSecretChatUnlockDialog.test.ts`
Expected: PASS（2 passed）。

- [ ] **Step 6: 提交**

```bash
git add src/mobile/components/secretChat/MobileSecretChatUnlockDialog.vue src/App.vue src/mobile/components/secretChat/__tests__/MobileSecretChatUnlockDialog.test.ts
git commit -m "feat(mobile): 新增移动端私密聊天解锁弹窗"
```

---

### Task 5: 私密列表页引导与命中区打磨

**Files:**
- Modify: `src/mobile/views/secretChat/SecretChatPage.vue`
- Test: `src/mobile/views/secretChat/__tests__/SecretChatPage.test.ts`（已存在则追加）

**Interfaces:**
- Consumes：`useSettingStore().isSecretChatConfigured()`、`MOBILE_SETTINGS_SECURITY_PRIVACY_PATH`
- Produces：无对外接口变化

- [ ] **Step 1: 写失败测试**

在既有 `SecretChatPage.test.ts` 追加：

```ts
it('未设置密码时锁定态显示「去设置密码」并跳转安全设置页', async () => {
  // 复用文件里已有的 mount 工厂；把 settingStore mock 改为 isSecretChatConfigured: () => false
  const wrapper = mountPage({ configured: false })
  const cta = wrapper.get('[data-testid="mobile-secret-chat-setup-password"]')
  expect(cta.text()).toBe('mobile_security.secret_chat.go_settings')
  await cta.trigger('click')
  expect(routerPush).toHaveBeenCalledWith(MOBILE_SETTINGS_SECURITY_PRIVACY_PATH)
})
```

若该测试文件当前没有可复用的 `mountPage` 工厂，则按文件现有 mock 风格（`vi.mock('@/stores/domains/chat/chat/session')` 等）内联构造 wrapper，并断言 `data-testid` 元素存在。

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest run src/mobile/views/secretChat/__tests__/SecretChatPage.test.ts`
Expected: FAIL，找不到 `mobile-secret-chat-setup-password`。

- [ ] **Step 3: 实现**

`src/mobile/views/secretChat/SecretChatPage.vue`：

script 增加：

```ts
import { MOBILE_SETTINGS_SECURITY_PRIVACY_PATH } from '@/mobile/views/my/settingsRoutes'
import { useSettingStore } from '@/stores/domains/settings/setting'

const settingStore = useSettingStore()
const configured = computed(() => settingStore.isSecretChatConfigured())
const handleGoSetupPassword = () => {
  void router.push(MOBILE_SETTINGS_SECURITY_PRIVACY_PATH)
}
```

把锁定态按钮块改为：

```vue
          <van-button
            v-if="configured"
            class="mt-8px"
            size="small"
            type="primary"
            plain
            @click="handleUnlockClick">
            {{ t('home.secret_chat.unlock_action') }}
          </van-button>
          <van-button
            v-else
            class="mt-8px"
            size="small"
            type="primary"
            data-testid="mobile-secret-chat-setup-password"
            @click="handleGoSetupPassword">
            {{ t('mobile_security.secret_chat.go_settings') }}
          </van-button>
```

`onMounted` 改为：未解锁且未配置时直接跳安全设置页，不再打开解锁框。

```ts
onMounted(() => {
  if (!isSecretChatUnlocked()) {
    if (!settingStore.isSecretChatConfigured()) {
      void router.replace(MOBILE_SETTINGS_SECURITY_PRIVACY_PATH)
      return
    }
    openSecretChatUnlock('/mobile/secretChat')
    return
  }
  refreshPrivateSessions()
})
```

把「移出私密」按钮的最小命中区从 16px 图标放大到 32px 容器（不改语义）：

```vue
              <van-button size="mini" plain class="ms-8px w-32px h-32px" :aria-label="t('home.secret_chat.unmark_private')" @click.stop="handleUnmark(session)">
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm vitest run src/mobile/views/secretChat/__tests__/SecretChatPage.test.ts`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src/mobile/views/secretChat/SecretChatPage.vue src/mobile/views/secretChat/__tests__/SecretChatPage.test.ts
git commit -m "fix(mobile): 私密列表页补充未配置密码引导"
```

---

### Task 6: 全量验收与真机复核

**Files:** 无新增（仅跑命令与验证）

- [ ] **Step 1: 类型检查**

Run: `pnpm vue-tsc --noEmit`
Expected: 0 error。重点看 `useSecretChatGate` 的 `pendingPath` 类型放宽后是否影响桌面 `SecretChatUnlockDialog.vue`（它用 `router.push(target ?? '/secretChat')`，`RouteLocationRaw` 可接受）。

- [ ] **Step 2: 单元测试**

Run: `pnpm test:run`
Expected: 全绿。若出现与本计划无关的失败，记录文件与用例名后单独处理，不得静默跳过。

- [ ] **Step 3: 守门命令**

```bash
pnpm check:ratchet
pnpm check:doc-coverage
pnpm check:doc-paths
pnpm check:sdk-boundary
pnpm quality:no-raw-fetch
pnpm check
```

Expected: 全部通过。

- [ ] **Step 4: 移动端真机复核（A/B 两台模拟器）**

```bash
~/Library/Android/sdk/platform-tools/adb -s emulator-5554 shell am start -n com.tjg.app/.MainActivity
```

复核清单（A 机操作，B 机收消息）：
1. 设置 → 安全与隐私 → 私密聊天：设置密码 `DevUnlock!2026`，开关自动置为开启。
2. 消息列表长按 B 的单聊 → 「设为私密」→ 会话从普通列表消失，右上角出现私密入口。
3. 点私密入口 → 输密码 → 进入列表；点会话进入聊天页，过程中**看不到**会话内容闪现。
4. 在会话内按返回回到列表 → 列表显示锁定态；再次点入口需重新输密码。
5. 杀掉进程冷启动，直接点通知进入该私密会话：应弹出移动端解锁框，解锁后**回到该会话**（不是私密列表）。
6. 连错 3 次密码：出现「密码错误，请重试」与「去设置密码」按钮，点击跳到安全设置页。
7. 设置页清除密码 → 私密入口消失（`hiddenSessionCount` 归 0 前仍需确认列表刷新一次）。

- [ ] **Step 5: 汇报**

按 AGENTS.md R3 逐项回答：
1. 是否复用 SDK/服务层能力（是：`privateRoomRegistry` / `secretChatSession` / `settingStore`，无平行实现）。
2. 是否给移动端引入 admin/AI 入口（否）。
3. 移动端构建是否可产出（记录本次 `pnpm vue-tsc` 与 `pnpm test:run` 结果；如需完整构建再跑 `pnpm adev:win` 或对应 Android 目标）。

---

## Self-Review 结论

- **Spec 覆盖：** P0-1 → Task 2；P0-2 → Task 1；P1 → Task 3；P2 → Task 4 + Task 5；验收 → Task 6。
- **占位符扫描：** 无 TBD / “similar to”。
- **类型一致性：** `openSecretChatUnlock` 入参统一为 `string | RouteLocationRaw`；`handleTogglePrivate` 在 Task 1 定义、Task 1 Step 3 的模板直接使用；`configured` 在 Task 2 组件内定义、Task 5 页面内单独定义（不同文件，无冲突）。
