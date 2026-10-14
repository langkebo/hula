# 桌面设置窗口「配置不生效」治理方案

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 消除桌面设置窗口里"能点、能存、但不生效"的配置项，让每个开关都有真实消费方，或明确删除。

**Architecture:** 三条修复路径，按配置的真实语义选择：账号级配置走 `MatrixAccountService` 写 account data；本机偏好走 `useSettingStore().preferences`（已有持久化与 legacy 迁移）；确实没有实现的（字体缩放、气泡样式、设备选择）先补最小可用实现，不能补的删除 UI。最后加一个 ratchet 守门，防止新的死配置再进来。

**Tech Stack:** Vue 3 `<script setup>`、Pinia（setup store + persistedstate）、vitest、Naive UI、matrix-js-sdk（经服务层）、Tauri（devtools / 媒体设备）。

## 执行中修正（整分支评审核实，2026-09-21）

Task 0-5 执行并合并评审后，发现本方案有几处前提不成立。已就地修正，**继续执行前请先读本节**：

| 项 | 原方案 | 修正 |
| --- | --- | --- |
| 守门判据 | 任何设置窗口外的字面量都算消费方 | **另一个设置 UI 不算消费方**。原判据把 `tjg-debug-mode` 等只有设置 UI 读写的 key 判成 live（假阴性）；修正后基线 **22 → 34**（诚实值） |
| 完成判据 | "死配置从 X 降到 Y" | **行为测试才是验收标准**，守门计数只是早期预警。搬走写入会让计数下降但功能依旧不生效 |
| 守门已知局限 | — | 只守**数量**，不守**键名**："修好一个死配置、同时引入一个新死配置"（数量不变）不会被发现；它也无法判断"消费方"是否真的在运行时消费。**不要把它当作功能已生效的证据** |
| Task 6 | 9 个开关落 Pinia + `shouldNotifyEvent` 读 `config.events` | 控制器实测（用户确认）：9 个 key 里 6 个**没有通知分发点**（好友请求/接受有监听零 emitter；空间/线程无事件），接线只会再造"存了不生效"。改为**缩减为 3 个 key**：删 6 个开关的 UI，线程提及落 `config.events.thread_mention`，关键词列表与开关落现有 `notificationDisplayPreferences`，统一决策门接 `messageMutations` 真实发送路径 |
| Task 7 | 新增 `config.dnd` + `HH:mm`，强制点在 `showNotification()` | DND 已有 account data `io.hula.dnd_settings` 与 `tjg-push-dnd*` 时间戳两份表示；且 `showNotification()` **零生产调用方**。改为扩展现有 `syncDnd*` + 挂到真实发送路径 |
| Task 8 | 强制 `mode: 'blocklist'` | `shouldRejectInvite` 在 blocklist 分支提前 return、绕过 `allowStrangers`（默认 false）→ **一屏蔽某人就关掉"仅联系人"基线**（隐私回归）。改为保留 mode，让 blocklist 与 mode 正交 |
| Task 11 | "`tjg-debug-mode` 已有 4 处消费方" | 实测 **0 处**（只有设置 UI 读写）。改为先找真实 devtools 路径，找不到就按 YAGNI 删 UI |
| Task 13 | `toAudioConstraints` 含 `volume`，同一对象喂 `applyConstraints` | `volume` **不是 `MediaTrackConstraintSet` 成员**（会类型报错）；`deviceId` 不可变（必然 reject）。拆成 `toAudioQualityConstraints`（三个布尔）/ `toDeviceConstraints`（仅供重建轨道）/ `normalizeVolumeToGain` |
| Task 14 | 假设 `InvitePermissionPanel` 仍需完善 | 它在基点提交 `60b562f4` **已自包含**；Task 14 的该条前提过期 |
| 自检表 | 旧编号 | 已重编号 |

**Task 12 是剩余任务里唯一前提成立、无需修正的。**

另外：Task 2 的未读角标问题**并未真正修好**（`setLastRead` 生产零调用方，
`session.ts` 的 `syncPersistedUnreadCounts` 会把服务端未读数重新写回），
已记入 ledger，需在收尾前单独处理。

---

## Global Constraints

- 提交信息用 Conventional Commits；**允许的 scope 只有** `core, ui, chat, mobile, plugin, hook, service, util, i18n, config, ci, test, tauri`（`settings`/`desktop` 非法）。
- 提交信息与文档**不得使用 emoji**。
- 不使用 `--no-verify`；不 `git reset` 他人改动。
- 新代码不得硬编码颜色：用 `--tjg-*` token（`pnpm check:ratchet` 会拦）。
- 组件不得直接 import `matrix-js-sdk`，一律经 `src/services/matrix/`（`pnpm check:sdk-boundary` 会拦）。
- 每步改完必须能过：`pnpm vue-tsc --noEmit`、`npx vitest run`、`pnpm check:ratchet`、`pnpm check:sdk-boundary`。
- 本项目提交前钩子会跑 `lint-staged && vue-tsc --noEmit`（约 140s）；提交放后台任务，别用前台超时。
- **在隔离 worktree 里干活**：`.worktrees/` 已存在且被 gitignore。主工作树有并行会话的未提交改动，不要在主树直接开工。
- 测试用 `npx vitest run <path>`。worktree 里**不要用** `pnpm test:run`（软链的 `node_modules` 会触发 `ERR_PNPM_IGNORED_BUILDS`）。

---

## 已核实的符号（2026-09-21，master `717bb286`）

计划里引用的函数名/行号已与仓库核对；实现时若发现漂移，**以仓库现状为准**并把修正回填到本表。

| 位置 | 已核实内容 |
| --- | --- |
| `PrivacySettingsSection.vue:68/76/84` | 真实处理函数为 `handleOnlineStatusChange` / `handleTypingStatusChange` / `handleReadReceiptsChange` |
| `NotificationSettings.vue:248/280/290` | 真实处理函数为 `handleNotificationChange` / `handleContentChange` / `handleSenderChange` |
| `NotificationSettings.vue:205/210/215` | 三处 `localStorage.getItem` 对应 `tjg-desktop-notification` / `tjg-show-content` / `tjg-show-sender` |
| `settings-helpers.ts:55` | `LEGACY_PREFERENCE_STORAGE_KEYS` 含 `sendReadReceipts: 'tjg-send-read-receipts'`、`sendTypingNotifications: 'tjg-send-typing-notifications'` |
| `setting.ts:317` | 迁移逻辑读 legacy key 后 `localStorage.removeItem(...)` |
| `PrivateChatSection.vue:102-113` | 偏好类设置的正确范式：store computed get/set |
| `SecuritySettings.vue:11-14` | 正确接线事件流的参考（`@setup-backup` 等） |
| `design-tokens.css:116-128` | `--tjg-font-size-*` 当前是硬编码 px，可改为 calc |

**Task 6/7/13 的消费点尚未定位**，实现前必须先跑各任务 Step 1 里的 `grep` 确认调用点存在；不存在则按 YAGNI 删 UI。

---

## 背景：审计结论（已逐条核实）

审计方法：枚举 `src/views/settingsWindow` 下所有 `localStorage.setItem` 的 key，再统计该 key 在**设置窗口之外**的引用数（精确匹配 `'key'` 字面量，避免 `--tjg-font-size-*` 这类 CSS token 误报）。

**实测结果：首版审计得到 23 个，Task 0 的守门脚本随后补上"用常量别名写入"的形态，
最终确认是 28 个键在设置窗口之外零引用。**

首版审计用 `localStorage.setItem\(...\)` 的字面量匹配，漏掉了写成
`const STORAGE_KEY = 'tjg-x'; localStorage.setItem(STORAGE_KEY, ...)` 的 4 个位置
（Task 0 的评审发现，见 Task 6）：其中 3 个是死配置
（`tjg-sidebar-settings`、`tjg-friend-settings`、`tjg-burn-after-read-settings`），
`tjg-mjolnir-ban-lists` 有真实消费方（移动端读取）不计入。

计数口径：只统计**非测试**的 `.vue` 写入点；测试文件里写 key 不计（否则会把测试噪音算成真配置）。

### 问题分类

**P0 - 键名错位（最隐蔽，UI 看起来完全正常）**

| 组件 | 写的 key | 真正生效的 key | 后果 |
| --- | --- | --- | --- |
| `PrivacySettingsSection.vue` | `tjg-send-receipts` | `tjg-send-read-receipts` | 关闭"发送已读回执"无效 |
| `PrivacySettingsSection.vue` | `tjg-show-typing` | `tjg-send-typing-notifications` | 关闭"输入中提示"无效 |
| `PrivacySettingsSection.vue` | `tjg-show-online` | 无对应字段 | 在线状态开关无实现 |
| `NotificationSettings.vue` | `tjg-desktop-notification` | `MatrixNotificationService` 的 `tjg-notification-config.enableDesktop` | 桌面通知总开关无效 |
| `NotificationSettings.vue` | `tjg-show-content` / `tjg-show-sender` | 同上的 `showMessageContent` / `showSender` | 通知内容/发送者开关无效 |

`tjg-send-read-receipts` 与 `tjg-send-typing-notifications` 是 `settings-helpers.ts:55` 的 `LEGACY_PREFERENCE_STORAGE_KEYS` 正式成员，且 `setting.ts:317` 有迁移逻辑**读完就 `removeItem`**——所以那个开关写进去的值不仅没人读，还会被 store 主动清掉。这两个开关从来没有生效过。

**P1 - 零消费方（写入后被自己读回显示，运行时无人使用）**

- `NotificationSettings.vue`：`tjg-friend-accept-notify`、`tjg-friend-request-notify`、`tjg-keyword-notification`、`tjg-keywords`、`tjg-space-member-change-notify`、`tjg-space-new-room-notify`、`tjg-thread-mention-notify`、`tjg-thread-participate-notify`、`tjg-thread-reply-notify`（共 9 个；其中 6 个无分发点，Task 6 按 YAGNI 删 UI，只接线线程提及与关键词 3 个 key）
- `PushSettings.vue`：`tjg-push-dnd`、`tjg-push-dnd-start`、`tjg-push-dnd-end`
- `BlockedUsersSection.vue`：`tjg-blocked-users`
- `AppearanceSettings.vue`：`tjg-font-size`、`tjg-bubble-style`
- `LabsSettings.vue`：`tjg-enable-devtools`
- `EncryptionSettings.vue`：`tjg-backup-enabled`

**P2 - 同一功能两套平行实现**

- `SecuritySettings.vue` 同时挂载 `InviteListsSection`（localStorage `tjg-invite-blocklist`/`tjg-invite-allowlist`）**和** `InvitePermissionPanel`（account data `im.hula.invite_policy`）——两个邀请黑/白名单 UI，互相不知道对方存在。
- `BlockedUsersSection`（localStorage）与 `IgnoredUsersSection`（真实 account data `m.ignored_user_list`）都表达"屏蔽"，前者不生效。

**P3 - 装饰组件**

- `InvitePermissionPanel.vue`：`SecuritySettings.vue` 以 `<InvitePermissionPanel />` 挂载，不传 props 不接事件，面板自身无状态无服务调用——三档模式点了没反应。其 10 个测试只断言 `emit`，所以长期绿着。
- `useInvitePermissionFilter.ts`：平行实现，写旧 key，全仓只有自己的测试引用（已在本方案的**前置提交**中删除）。

**P4 - 有实现但缺 UI 接线**

- 音频/视频设备选择（8 个 key：`tjg-audio-input`、`tjg-audio-output`、`tjg-video-input`、`tjg-input-volume`、`tjg-output-volume`、`tjg-auto-gain`、`tjg-echo-cancellation`、`tjg-noise-suppression`）：桌面写入后无人读取，媒体层（`AudioManager` 等）没有 `deviceId`/`setSinkId` 消费点。移动端 `VoiceVideoSettings.vue` 也在写同一个 key，同样无消费方。

### 正确的参考实现

- **本机偏好**：`PrivateChatSection.vue:102-113` 用 `useSettingStore()` 的 getter/setter（`secretChatEnabled` 等），真实生效。**这是偏好类设置的正确范式。**
- **账号级配置**：`IgnoredUsersSection.vue` 走 `matrixClientService` + account data。
- **正确接线的事件**：`EncryptionStatusSection` 在 `SecuritySettings.vue:11-14` 被正确监听（`@setup-backup` 等）。

---

## 文件结构

**新建**
- `scripts/check-settings-wiring.mjs` — 死配置 ratchet 守门
- `scripts/settings-wiring-baseline.json` — 守门基线
- `src/utils/fontScale.ts` — 字体缩放应用逻辑（纯函数 + DOM 应用）
- `src/utils/__tests__/fontScale.test.ts`
- `src/services/media/mediaDevicePreferences.ts` — 音视频设备偏好读写
- `src/services/media/__tests__/mediaDevicePreferences.test.ts`

**修改**
- `src/stores/domains/settings/settings-helpers.ts` — 补 `showOnlineStatus`、`displayMessageContent`、`displaySender`、`notificationVolume` 等字段与 legacy key
- `src/stores/domains/settings/setting.ts` — 补对应 getter/setter
- `src/views/settingsWindow/tabs/sections/PrivacySettingsSection.vue` — 改走 store
- `src/views/settingsWindow/tabs/NotificationSettings.vue` — 改走 store + `MatrixNotificationService`
- `src/views/settingsWindow/tabs/PushSettings.vue` — DND 改走 store
- `src/views/settingsWindow/tabs/sections/BlockedUsersSection.vue` — 改走 `invitePolicy`
- `src/views/settingsWindow/tabs/sections/InviteListsSection.vue` — **删除**（被 `InvitePermissionPanel` 取代）
- `src/views/settingsWindow/tabs/AppearanceSettings.vue` — 字体缩放 + 气泡样式接线
- `src/views/settingsWindow/tabs/LabsSettings.vue` — **删除**（devtools 等零消费方；真实入口是 Tauri 原生菜单）
- `src/views/settingsWindow/tabs/EncryptionSettings.vue` — 备份开关改读真实状态
- `src/views/settingsWindow/tabs/VoiceVideoSettings.vue` — 设备偏好接线
- `src/views/settingsWindow/tabs/SecuritySettings.vue` — 移除 `InviteListsSection`
- `package.json` — 注册 `check:settings-wiring`
- `src/locales/{zh-CN,en}/*.json` — 新增文案
- `src/typings/i18n.d.ts` — `pnpm gen:i18n` 生成

---

## Task 0: 死配置 ratchet 守门（前置，先有度量）

**Files:**
- Create: `scripts/check-settings-wiring.mjs`
- Create: `scripts/settings-wiring-baseline.json`
- Modify: `package.json`（scripts 增一行）

**Interfaces:**
- Produces: `pnpm check:settings-wiring` 命令；基线文件格式 `{ "deadKeys": number, "deadKeyNames": string[] }`。后续每个任务完成后用 `--update` 收紧基线。

- [ ] **Step 1: 写守门脚本**

创建 `scripts/check-settings-wiring.mjs`：

```js
#!/usr/bin/env node
/**
 * Ratchet：设置窗口写入的 localStorage key 必须在窗口之外有消费方。
 *
 * 判据（刻意保守，避免误报）：
 * - 只统计 src/views/settingsWindow 下 .vue 文件里 localStorage.setItem('key', ...) 的 key
 * - 一个 key 算"有消费方"当且仅当在设置窗口之外的 .ts/.vue 中出现 'key' 字面量
 * - 精确匹配带引号的 key，避免 --tjg-font-size-* 这类 CSS token 干扰
 * - 排除 __tests__（测试自己写 key 不算消费方）
 *
 * 数量只能减少：--update 收紧基线，增加即失败。
 */
import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = 'src'
const SW = 'src/views/settingsWindow'
const BASELINE = 'scripts/settings-wiring-baseline.json'

const files = []
;(function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full)
    else if (/\.(ts|vue)$/.test(entry)) files.push(full)
  }
})(ROOT)

const sources = files.map((f) => ({ path: f, text: readFileSync(f, 'utf8') }))

const written = new Map()
for (const { path, text } of sources) {
  if (!path.startsWith(SW) || path.includes('__tests__')) continue
  for (const m of text.matchAll(/localStorage\.setItem\(\s*'([^']+)'/g)) {
    if (!written.has(m[1])) written.set(m[1], path)
  }
}

const consumers = ({ path, text }, key) => !path.startsWith(SW) && text.includes(`'${key}'`)
const dead = [...written.entries()]
  .filter(([key]) => !sources.some((s) => consumers(s, key)))
  .map(([key, path]) => ({ key, path }))
  .sort((a, b) => a.key.localeCompare(b.key))

const baseline = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : { deadKeys: dead.length }

if (process.argv.includes('--update')) {
  writeFileSync(BASELINE, `${JSON.stringify({ deadKeys: dead.length, deadKeyNames: dead.map((d) => d.key) }, null, 2)}\n`)
  console.log(`check-settings-wiring: 基线已更新为 ${dead.length}`)
  process.exit(0)
}

if (dead.length > baseline.deadKeys) {
  console.error(`check-settings-wiring: FAIL — 死配置 ${dead.length} > 基线 ${baseline.deadKeys}`)
  for (const d of dead) console.error(`  ${d.key.padEnd(36)} ${d.path}`)
  console.error('新增设置项必须有真实消费方，或先用 --update 说明理由。')
  process.exit(1)
}

console.log(`check-settings-wiring: OK 死配置 ${dead.length}（基线 ${baseline.deadKeys}）`)
if (dead.length < baseline.deadKeys) {
  console.log('  可运行 node scripts/check-settings-wiring.mjs --update 收紧基线')
}
```

- [ ] **Step 2: 生成初始基线（数量以脚本实测为准，首版审计为 28，判据修正后为 34）**

```bash
node scripts/check-settings-wiring.mjs --update
cat scripts/settings-wiring-baseline.json | head -30
```

Expected: 脚本报出实测数量并写入基线（Task 0 当时的实测值是 28；判据修正后为 34）。

（若脚本报出的数字不是 28，以脚本为准并记录差异原因：本方案首版审计用字面量匹配，
漏掉了用 `const STORAGE_KEY` 别名写入的形态，Task 0 评审已要求补上该形态。）

- [ ] **Step 3: 注册 npm script**

在 `package.json` 的 `scripts` 里，紧挨 `"check:ratchet"` 之后加一行：

```json
    "check:settings-wiring": "node scripts/check-settings-wiring.mjs",
```

- [ ] **Step 4: 验证守门在回归时会失败**

临时把 `src/views/settingsWindow/tabs/LabsSettings.vue` 里任意 `localStorage.setItem('tjg-lab-features'` 改成 `localStorage.setItem('tjg-lab-features-xx'`，运行：

```bash
node scripts/check-settings-wiring.mjs
```

Expected: FAIL，且列出 `tjg-lab-features-xx`。改回原样后再跑，Expected: OK。

- [ ] **Step 5: 提交**

```bash
git add scripts/check-settings-wiring.mjs scripts/settings-wiring-baseline.json package.json
git commit -m "test(config): 新增设置死配置 ratchet 守门

设置窗口有 23 个 localStorage key 写入后在窗口之外零引用，
即"能点、能存、不生效"。先建立度量与守门，再逐个修复。
判据保守：精确匹配带引号 key、排除 __tests__，避免 CSS token 误报。"
```

---

## Task 1: 已读回执与输入中提示改走 store（P0）

**Files:**
- Modify: `src/stores/domains/settings/settings-helpers.ts`（补 `showOnlineStatus` 字段与 legacy key）
- Modify: `src/stores/domains/settings/setting.ts`（补 getter/setter）
- Modify: `src/views/settingsWindow/tabs/sections/PrivacySettingsSection.vue`
- Test: `src/views/settingsWindow/tabs/__tests__/PrivacySettingsSection.test.ts`（若不存在则新建）

**Interfaces:**
- Consumes: Task 0 的 `pnpm check:settings-wiring`
- Produces: `useSettingStore().setSendReadReceiptsEnabled(enabled: boolean)`、`.setSendTypingNotificationsEnabled(enabled: boolean)`、`.setShowOnlineStatusEnabled(enabled: boolean)`；getter `sendReadReceiptsEnabled`、`sendTypingNotificationsEnabled`、`showOnlineStatusEnabled`（均为 `boolean`）

- [ ] **Step 1: 写失败测试**

创建/追加 `src/views/settingsWindow/tabs/__tests__/PrivacySettingsSection.test.ts`：

```ts
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSettingStore } from '@/stores/domains/settings/setting'
import PrivacySettingsSection from '../sections/PrivacySettingsSection.vue'

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (k: string) => k }) }))

describe('PrivacySettingsSection', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('关闭已读回执时写入 store 的偏好字段（而不是 localStorage 死 key）', async () => {
    const store = useSettingStore()
    const wrapper = mount(PrivacySettingsSection)
    await wrapper.vm.$nextTick()

    ;(wrapper.vm as unknown as { handleReadReceiptsChange: (v: boolean) => void }).handleReadReceiptsChange(false)

    expect(store.preferences.sendReadReceipts).toBe(false)
    // 旧实现写的是 tjg-send-receipts，与 store 的 legacy key 不一致
    expect(localStorage.getItem('tjg-send-receipts')).toBeNull()
  })

  it('关闭输入中提示时写入 store 的偏好字段', async () => {
    const store = useSettingStore()
    const wrapper = mount(PrivacySettingsSection)
    await wrapper.vm.$nextTick()

    ;(wrapper.vm as unknown as { handleTypingChange: (v: boolean) => void }).handleTypingChange(false)

    expect(store.preferences.sendTypingNotifications).toBe(false)
    expect(localStorage.getItem('tjg-show-typing')).toBeNull()
  })

  it('在线状态开关写入 store 并被持久化', async () => {
    const store = useSettingStore()
    const wrapper = mount(PrivacySettingsSection)
    await wrapper.vm.$nextTick()

    ;(wrapper.vm as unknown as { handleOnlineChange: (v: boolean) => void }).handleOnlineChange(false)

    expect(store.preferences.showOnlineStatus).toBe(false)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

```bash
npx vitest run src/views/settingsWindow/tabs/__tests__/PrivacySettingsSection.test.ts
```

Expected: FAIL —— `handleReadReceiptsChange` 不存在，或 `store.preferences.sendReadReceipts` 未被改动。

- [ ] **Step 3: store 补字段与 legacy key**

在 `src/stores/domains/settings/settings-helpers.ts` 的 `getDefaultPreferenceSettings()` 返回对象里，`sendTypingNotifications: true` 之后加：

```ts
  showOnlineStatus: true
```

在 `LEGACY_PREFERENCE_STORAGE_KEYS` 里，`sendTypingNotifications` 之后加：

```ts
  showOnlineStatus: 'tjg-show-online'
```

- [ ] **Step 4: store 补 getter/setter**

在 `src/stores/domains/settings/setting.ts` 中参照现有 `setSendTypingNotificationsEnabled` 的形状补：

```ts
    setSendReadReceiptsEnabled(enabled: boolean) {
      this.preferences.sendReadReceipts = enabled
    },

    setSendTypingNotificationsEnabled(enabled: boolean) {
      this.preferences.sendTypingNotifications = enabled
    },

    setShowOnlineStatusEnabled(enabled: boolean) {
      this.preferences.showOnlineStatus = enabled
    },
```

并在 getters 区加：

```ts
    sendReadReceiptsEnabled: (state: STO.Setting) => state.preferences?.sendReadReceipts ?? true,
    sendTypingNotificationsEnabled: (state: STO.Setting) => state.preferences?.sendTypingNotifications ?? true,
    showOnlineStatusEnabled: (state: STO.Setting) => state.preferences?.showOnlineStatus ?? true,
```

在 `migrateLegacyPreferenceSettings()` 里，参照 `sendReadReceipts` 的既有写法补 `showOnlineStatus` 的迁移读取（读完 `localStorage.removeItem`）。

- [ ] **Step 5: 组件改走 store**

`src/views/settingsWindow/tabs/sections/PrivacySettingsSection.vue`：把 3 处 `localStorage.getItem`/`setItem` 替换为 store 读写。示例（已读回执）：

```ts
const settingStore = useSettingStore()

const sendReadReceipts = computed({
  get: () => settingStore.sendReadReceiptsEnabled,
  set: (value: boolean) => settingStore.setSendReadReceiptsEnabled(value)
})

function handleReadReceiptsChange(value: boolean) {
  settingStore.setSendReadReceiptsEnabled(value)
}
```

输入中提示与在线状态同构（`handleTypingChange`、`handleOnlineChange`）。**删除该文件里所有 `localStorage` 调用。**

- [ ] **Step 6: 跑测试与守门**

```bash
npx vitest run src/views/settingsWindow/tabs/__tests__/PrivacySettingsSection.test.ts
node scripts/check-settings-wiring.mjs --update
node scripts/check-settings-wiring.mjs
```

Expected: 测试 PASS；并运行 `node scripts/check-settings-wiring.mjs --update` 按实测收紧基线（`tjg-send-receipts`、`tjg-show-typing`、`tjg-show-online` 三个消失）。

- [ ] **Step 7: 提交**

```bash
git add src/stores/domains/settings src/views/settingsWindow/tabs/sections/PrivacySettingsSection.vue src/views/settingsWindow/tabs/__tests__/PrivacySettingsSection.test.ts scripts/settings-wiring-baseline.json
git commit -m "fix(ui): 已读回执/输入中提示改走 store，修掉键名错位

PrivacySettingsSection 写的是 tjg-send-receipts 与 tjg-show-typing，
而 store 的正式 legacy key 是 tjg-send-read-receipts 与
tjg-send-typing-notifications，且 store 的迁移逻辑读完就 removeItem
——写进去的值不仅没人读，还会被主动清掉。这两个开关从未生效。

改为走 useSettingStore().preferences，并给缺失的在线状态补上
showOnlineStatus 字段与迁移。"
```

---

## Task 2: 让三个隐私开关真正改变行为（P0，Task 1 评审发现）

**背景**：Task 1 把存储与 UI 对齐了，但评审确认**没有任何发送路径检查这些偏好**——
用户把三个开关全关掉，应用照旧发已读回执、照旧上报"正在输入"、照旧保持在线。
这正是本方案要消灭的"能点、能存、但不生效"。原计划漏了这一环（自检表把
已读回执/输入中/在线状态只映射到 Task 1），此任务补上。

**为什么守门抓不到它**：`check-settings-wiring.mjs` 只统计设置窗口里的
`localStorage.setItem`。值一旦搬进 store，一个"存了但没人用"的偏好对它就是隐形的。
所以本任务**没有守门可以依赖**，必须靠测试锁定行为。

**Files:**
- Modify: `src/services/matrix/messaging/MatrixTypingService.ts`
- Modify: `src/services/matrix/messaging/MatrixReceiptService.ts`
- Modify: `src/composables/user/usePresenceHeartbeat.ts`
- Test: 对应三个 `__tests__`

**Interfaces:**
- Consumes: `useSettingStore().sendReadReceiptsEnabled` / `.sendTypingNotificationsEnabled` / `.showOnlineStatusEnabled`（Task 1 提供）

- [ ] **Step 1: 写失败测试**

```ts
// src/services/matrix/messaging/__tests__/MatrixTypingService.privacy.test.ts
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { matrixTypingService } from '../MatrixTypingService'

const { startTypingMock, stopTypingMock } = vi.hoisted(() => ({
  startTypingMock: vi.fn().mockResolvedValue(undefined),
  stopTypingMock: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('@/services/matrix/MatrixClientService', () => ({
  default: {
    getClient: () => ({
      getTypingManager: () => ({ startTyping: startTypingMock, stopTyping: stopTypingMock })
    })
  }
}))

describe('MatrixTypingService 尊重「发送输入中提示」偏好', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('关闭偏好后不再发送 typing=true', async () => {
    useSettingStore().setSendTypingNotificationsEnabled(false)
    await matrixTypingService.sendTypingNotification('!r:x', true)
    expect(startTypingMock).not.toHaveBeenCalled()
  })

  it('关闭偏好时仍必须发送停止信号，避免对方界面卡在"正在输入"', async () => {
    useSettingStore().setSendTypingNotificationsEnabled(false)
    await matrixTypingService.sendTypingNotification('!r:x', false)
    expect(stopTypingMock).toHaveBeenCalledWith('!r:x')
  })

  it('偏好开启时正常发送', async () => {
    useSettingStore().setSendTypingNotificationsEnabled(true)
    await matrixTypingService.sendTypingNotification('!r:x', true)
    expect(startTypingMock).toHaveBeenCalled()
  })
})
```

```ts
// src/services/matrix/messaging/__tests__/MatrixReceiptService.privacy.test.ts
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { matrixReceiptService } from '../MatrixReceiptService'

const { sendReceiptMock } = vi.hoisted(() => ({ sendReceiptMock: vi.fn().mockResolvedValue(undefined) }))

vi.mock('@/services/matrix/MatrixClientService', () => ({
  default: { getClient: () => ({ sendReadReceipt: sendReceiptMock }) }
}))

describe('MatrixReceiptService 尊重「发送已读回执」偏好', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('关闭偏好后不发送已读回执', async () => {
    useSettingStore().setSendReadReceiptsEnabled(false)
    await matrixReceiptService.sendReadReceiptByEventId('!r:x', '$e1')
    expect(sendReceiptMock).not.toHaveBeenCalled()
  })

  it('偏好开启时正常发送', async () => {
    useSettingStore().setSendReadReceiptsEnabled(true)
    await matrixReceiptService.sendReadReceiptByEventId('!r:x', '$e1')
    expect(sendReceiptMock).toHaveBeenCalled()
  })
})
```

```ts
// src/composables/__tests__/usePresenceHeartbeat.privacy.test.ts
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSettingStore } from '@/stores/domains/settings/setting'

const { setPresenceMock } = vi.hoisted(() => ({ setPresenceMock: vi.fn().mockResolvedValue(undefined) }))

vi.mock('@/services/matrix/MatrixClientService', () => ({
  matrixClientService: { getClient: () => ({}) }
}))
vi.mock('@/services/matrix/user/MatrixPresenceService', () => ({
  matrixPresenceService: { setPresence: setPresenceMock }
}))
vi.mock('@/stores/domains/user/user', () => ({
  useUserStore: () => ({ userInfo: null })
}))

describe('usePresenceHeartbeat 尊重「显示在线状态」偏好', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('关闭偏好后不再上报 online', async () => {
    useSettingStore().setShowOnlineStatusEnabled(false)
    const { pushOnlineForTest } = await import('@/composables/user/usePresenceHeartbeat')
    await pushOnlineForTest()
    expect(setPresenceMock).not.toHaveBeenCalledWith('online')
  })

  it('偏好开启时正常上报', async () => {
    useSettingStore().setShowOnlineStatusEnabled(true)
    const { pushOnlineForTest } = await import('@/composables/user/usePresenceHeartbeat')
    await pushOnlineForTest()
    expect(setPresenceMock).toHaveBeenCalledWith('online')
  })
})
```

注意：第三个测试需要 `pushOnline` 可被测试调用。若该函数当前是模块内私有，导出它
（例如 `export async function pushOnlineForTest()` 或直接导出 `pushOnline`），
并在报告中说明这是为可测性做的唯一导出。

- [ ] **Step 2: 跑测试确认失败**

```bash
npx vitest run src/services/matrix/messaging/__tests__/MatrixTypingService.privacy.test.ts src/services/matrix/messaging/__tests__/MatrixReceiptService.privacy.test.ts src/composables/__tests__/usePresenceHeartbeat.privacy.test.ts
```

Expected: FAIL —— 三个开关都被忽略，发送方法照旧调用。

- [ ] **Step 3: 三处加守卫**

`MatrixTypingService.sendTypingNotification`（当前 `:39`）开头：

```ts
    // 关闭「发送输入中提示」后不再发 typing=true；但停止信号必须照发，
    // 否则对方界面会一直停在"正在输入"
    if (isTyping && !useSettingStore().sendTypingNotificationsEnabled) {
      return
    }
```

`MatrixReceiptService` 里所有实际发出回执的路径（`sendReadReceipt` `:164`、
`sendReadReceiptByEventId`、`markRoomAsRead` `:245`）开头统一加：

```ts
    if (!useSettingStore().sendReadReceiptsEnabled) {
      return
    }
```

（抽一个私有 `private shouldSendReadReceipts(): boolean` 避免三处重复同样一行。）

`usePresenceHeartbeat.pushOnline` 开头：

```ts
  if (!useSettingStore().showOnlineStatusEnabled) {
    return
  }
```

注意 store 导入方式：这三个文件都在 `src/` 下，用 `import { useSettingStore } from '@/stores/domains/settings/setting'`；
在函数体内调用（不要在模块顶层调用 `useSettingStore()`，Pinia 尚未激活）。

- [ ] **Step 4: 跑测试与回归**

```bash
npx vitest run src/services/matrix/messaging src/composables
npx vitest run
```

Expected: 新增测试 PASS，且既有测试不回归（尤其 `MatrixTypingService` /
`MatrixReceiptService` / `usePresenceHeartbeat` 的既有用例可能断言"总是发送"——
若有，那些断言需要更新为"偏好开启时发送"，并在报告中列出改动的既有测试与理由）。

- [ ] **Step 5: 提交**

```bash
git add src/services/matrix/messaging src/composables
git commit -m "fix(core): 已读回执/输入中/在线状态三个开关接入发送路径

Task 1 只把存储与 UI 对齐，评审确认没有任何发送路径读这些偏好：
用户关掉开关后应用照旧发回执、上报输入中、保持在线，即"能点能存不生效"。

在三个发送入口加守卫：typing 只拦 typing=true（停止信号必须照发，
否则对方界面卡在"正在输入"）；回执按偏好跳过；在线心跳按偏好跳过。"
```

---

## Task 2b: 未读角标真正修好（Task 2 评审追补，前置）

**背景（整分支评审核实）**：Task 2 只处理了"回读服务端未读数"这一条路径，
但角标仍会回来，且回来的机制是另一条：

- `session.ts` 的 `syncPersistedUnreadCounts()` 在 `sessionList` 重建后调用
  `sessionUnreadStore.apply(uid, sessions)`（`:114`）；
- `apply` 的**情况 3**（没有 lastRead 记录时）用 `Math.max(cached, serverCount)` 兜底
  （`sessionUnread.ts:112-118`）。关闭已读回执后服务端 `unread_count` 仍 >0，
  于是下一次重建/重连就把角标写回来。

**解药其实已经存在、只是没人用**：`sessionUnreadStore.setLastRead(uid, roomId, activeTime)`
（`sessionUnread.ts:141`）——`apply` 的**情况 1** 在有 lastRead 记录且
`activeTime <= lastReadTime` 时会清零并纠正服务端脏数据。
实测 `setLastRead` **生产零调用方**（只有它自己的测试）。

**Files:**
- Modify: `src/stores/domains/chat/chat/session.ts`（`markSessionRead`）
- Modify: `src/stores/domains/chat/__tests__/sessionReadReceipts.test.ts`（换掉 mock 掉 `sessionUnread` 的写法）
- Test: 同上（新增"重建会话列表后角标仍为 0"的用例）

**Interfaces:**
- Consumes: `sessionUnreadStore.setLastRead(uid: string | undefined, roomId: string, activeTime: number)`

- [ ] **Step 1: 先写"角标会回来"的失败测试（驱动真实 apply，不要 mock 掉它）**

现有 `sessionReadReceipts.test.ts:44` 把 `../sessionUnread` mock 成 `{ apply: vi.fn(() => ({})) }`，
**恰好移除了唯一能恢复计数的组件**，所以看不见这个 bug（自洽 stub 的又一例）。
新用例必须使用**真实的** `useSessionUnreadStore`，并驱动真实路径：

```ts
// 关闭已读回执 → 标记已读 → 重建会话列表（服务端仍是旧未读数）→ 角标必须仍为 0
it('关闭已读回执时，会话列表重建后角标不会被服务端旧值写回', async () => {
  useSettingStore().setSendReadReceiptsEnabled(false)
  // 让 getSessionList 返回 activeTime 未变、unreadCount 仍为 3 的同一房间
  //（模拟服务端因为没收到 m.read 而保持未读）
  sessionListMock.mockResolvedValue([{ roomId: '!r:x', activeTime: 100, unreadCount: 3 /* ... */ }])

  await store.markSessionRead('!r:x')
  expect(store.sessionList.find((s) => s.roomId === '!r:x')?.unreadCount).toBe(0)

  // 关键：重建会话列表（重连/刷新那条路径）
  await store.getSessionList()
  expect(store.sessionList.find((s) => s.roomId === '!r:x')?.unreadCount).toBe(0)
})
```

- [ ] **Step 2: 跑测试确认失败**

```bash
npx vitest run src/stores/domains/chat/__tests__/sessionReadReceipts.test.ts
```

Expected: FAIL —— 第二步断言拿到的是 3（服务端旧值被 `Math.max` 兜底写回）。

- [ ] **Step 3: 接线 `setLastRead`**

在 `markSessionRead` 里，**无条件**记录已读时间（与"本地清零无条件"一致，
不受已读回执开关影响）：

```ts
  const markSessionRead = async (roomId: string) => {
    if (!roomId) return
    updateSession(roomId, { unreadCount: 0 })
    persistUnreadCount(roomId, 0)
    writeUnreadDetail(roomId, { total: 0, highlight: 0, silent: getUnreadDetail(roomId)?.silent ?? false })

    // 记录"已读到的活跃时间"：sessionUnread.apply 的情况 1 依赖它来清零并纠正
    // 服务端脏未读数。关闭已读回执时服务端 unread_count 不会归零，没有这条记录，
    // 下一次 syncPersistedUnreadCounts 就会用 Math.max 把角标写回来。
    const session = sessionList.value.find((item) => item.roomId === roomId) ?? sessionMap[roomId]
    const activeTime = session?.activeTime ?? 0
    if (activeTime) {
      sessionUnreadStore.setLastRead(userStore.userInfo?.uid, roomId, activeTime)
    }

    try {
      // ...（其余保持不变：receiptSent 才回读）
```

注意 `sessionMap` / `userStore` 的可用性——`session.ts` 里已有这两者（`:49` 的 store、
`:114` 的 `userStore.userInfo?.uid`），沿用同样的取法，不要新引入 store。

- [ ] **Step 4: 确认新测试通过，且既有测试未回归**

```bash
npx vitest run src/stores/domains/chat
npx vitest run
```

Expected: 新用例 PASS。**同时确认没有削弱任何既有断言**——
允许把 `sessionReadReceipts.test.ts:44` 那个 mock 掉 `sessionUnread` 的写法改成真实 store，
但要在报告里说明为什么原来的 mock 会让测试失去意义。

- [ ] **Step 5: 提交**

```bash
git add src/stores/domains/chat/chat/session.ts src/stores/domains/chat/__tests__/sessionReadReceipts.test.ts
git commit -m "fix(chat): 标记已读时记录 lastRead，修掉角标被服务端旧值写回

Task 2 只拦住了 markRoomAsRead 之后的回读，但角标还有第二条回来路径：
sessionUnread.apply 在没有 lastRead 记录时用 Math.max(cached, serverCount) 兜底，
关闭已读回执后服务端 unread_count 不归零，于是会话列表重建就把角标写回来。

解药 setLastRead 早已存在且有完整测试，但生产零调用方。在 markSessionRead 里
无条件记录（与本地清零一致，不受开关影响）。原测试把 sessionUnread mock 成
apply 返回空对象，恰好移除了唯一能恢复计数的组件，因此换用真实 store。"
```

---

## Task 3: 在线状态开关覆盖全部上报路径（P0，Task 2 评审发现）

**背景**：Task 2 只给 `usePresenceHeartbeat.pushOnline()` 加了守卫，评审确认还有两条路径
照旧上报在线，开关因此仍未真正生效：

| 路径 | 位置 | 行为 |
| --- | --- | --- |
| 登录引导 | `SessionBootstrapService.ts:230` | 每次登录无条件 `setPresence('online')`，并置 `activeStatus: ONLINE`；`:259` 无条件启动心跳 |
| 状态菜单 | `userStatus.ts:63` → `MatrixAccountService.ts:472-476` | 用户选任意状态（含 online）时无条件上报 |

文案定义是"允许其他用户看到您的在线状态"（`locales/{zh-CN,en}/setting.json`），
所以登录时强制 online 正属于本方案要消灭的"能点、能存、不生效"。

**Files:**
- Modify: `src/services/matrix/auth/SessionBootstrapService.ts`
- Modify: `src/stores/domains/user/userStatus.ts`（或对应的状态设置入口）
- Test: 对应 `__tests__`

**Interfaces:**
- Consumes: `useSettingStore().showOnlineStatusEnabled`（Task 1 提供）

- [ ] **Step 1: 写失败测试**

针对登录引导（注意该服务依赖较重，测试可用既有 `__tests__` 的 mock 模式）：

```ts
it('关闭在线状态后登录不再上报 presence=online', async () => {
  useSettingStore().setShowOnlineStatusEnabled(false)
  await bootstrap()
  expect(setPresenceMock).not.toHaveBeenCalledWith('online')
})

it('开启时登录照旧上报', async () => {
  useSettingStore().setShowOnlineStatusEnabled(true)
  await bootstrap()
  expect(setPresenceMock).toHaveBeenCalledWith('online')
})
```

针对状态菜单：选择 non-online 状态（如 away）仍应上报；选择 online 且开关关闭时应降级为
`offline`/不上报，并把本地 `activeStatus` 置为非在线，避免本地 UI 与对端不一致。

- [ ] **Step 2: 跑测试确认失败**

```bash
npx vitest run src/services/matrix/auth src/stores/domains/user
```

- [ ] **Step 3: 加守卫**

- `SessionBootstrapService`：在 `setPresence('online')` 前判断开关；关闭时不调用，
  且本地 `activeStatus` 不要置为 ONLINE（否则本地显示在线、对端看不到，两端不一致）。
- `userStatus.ts` / `MatrixAccountService`：上报前判断开关；关闭且目标状态为 online 时，
  不发 online（可降级为 offline 或跳过上报），同步修正本地状态。
- 关闭开关时若用户当前是在线，理想行为是主动降级；若实现成本高（需要 watcher），
  在报告中标注为遗留并说明，不要为此扩大改动面。

- [ ] **Step 4: 跑测试与回归**

```bash
npx vitest run src/services/matrix/auth src/stores/domains/user src/composables
npx vitest run
```

- [ ] **Step 5: 提交**

```bash
git add src/services/matrix/auth src/stores/domains/user
git commit -m "fix(core): 在线状态开关覆盖登录与状态切换两条上报路径

Task 2 只守住了心跳，评审确认登录引导与状态菜单仍无条件上报 online，
开关因此未真正生效。两条路径补上守卫，并在关闭时同步本地 activeStatus，
避免本地显示在线而对端看不到。"
```

---

## Task 4: 通知详情与桌面通知开关接线（P0）

**Files:**
- Modify: `src/views/settingsWindow/tabs/NotificationSettings.vue`
- Test: `src/views/settingsWindow/tabs/__tests__/NotificationSettings.test.ts`（已存在，扩充）

**Interfaces:**
- Consumes: `matrixNotificationService.getConfig()` / `.updateConfig(partial)`（`src/services/matrix/notifications/MatrixNotificationService.ts`，配置持久化在 `tjg-notification-config`）
- Produces: 无新导出

- [ ] **Step 1: 写失败测试**

在既有测试文件里追加：

```ts
it('桌面通知总开关写入 MatrixNotificationService 配置而不是死 key', async () => {
  const updateConfig = vi.fn()
  vi.doMock('@/services/matrix/notifications/MatrixNotificationService', () => ({
    matrixNotificationService: {
      getConfig: () => ({ enableDesktop: true, showMessageContent: true, showSender: true }),
      updateConfig
    }
  }))
  const wrapper = mount(NotificationSettings)
  await flushPromises()

  ;(wrapper.vm as unknown as { handleNotificationChange: (v: boolean) => void })
    .handleNotificationChange(false)

  expect(updateConfig).toHaveBeenCalledWith({ enableDesktop: false })
  expect(localStorage.getItem('tjg-desktop-notification')).toBeNull()
})
```

- [ ] **Step 2: 跑测试确认失败**

```bash
npx vitest run src/views/settingsWindow/tabs/__tests__/NotificationSettings.test.ts
```

Expected: FAIL —— `updateConfig` 未被调用（组件仍在写 `tjg-desktop-notification`，见 `NotificationSettings.vue:257`）。

- [ ] **Step 3: 组件改走服务**

`NotificationSettings.vue`：引入 `matrixNotificationService`，把 `tjg-desktop-notification`、`tjg-show-content`、`tjg-show-sender` 三处替换为 `getConfig()` 初始化 + `updateConfig({ ... })` 写入：

组件里已有三个**真实存在**的处理函数，只需替换其实现（函数名不要改，模板已绑定）：
`handleNotificationChange`（第 248 行，当前写 `tjg-desktop-notification`）、
`handleContentChange`（第 280 行，写 `tjg-show-content`）、
`handleSenderChange`（第 290 行，写 `tjg-show-sender`）。

```ts
const notificationConfig = ref(matrixNotificationService.getConfig())

function handleNotificationChange(value: boolean) {
  notificationConfig.value = { ...notificationConfig.value, enableDesktop: value }
  matrixNotificationService.updateConfig({ enableDesktop: value })
}

function handleContentChange(value: boolean) {
  notificationConfig.value = { ...notificationConfig.value, showMessageContent: value }
  matrixNotificationService.updateConfig({ showMessageContent: value })
}

function handleSenderChange(value: boolean) {
  notificationConfig.value = { ...notificationConfig.value, showSender: value }
  matrixNotificationService.updateConfig({ showSender: value })
}
```

同时删除 `loadSettings()` 里对应的三处 `localStorage.getItem`（第 205、210、215 行）。

`onMounted` 里改为 `notificationConfig.value = matrixNotificationService.getConfig()`。

- [ ] **Step 4: 跑测试与守门**

```bash
npx vitest run src/views/settingsWindow/tabs/__tests__/NotificationSettings.test.ts
node scripts/check-settings-wiring.mjs --update && node scripts/check-settings-wiring.mjs
```

Expected: PASS；并运行 `node scripts/check-settings-wiring.mjs --update` 按实测收紧基线。

- [ ] **Step 5: 提交**

```bash
git add src/views/settingsWindow/tabs/NotificationSettings.vue src/views/settingsWindow/tabs/__tests__/NotificationSettings.test.ts scripts/settings-wiring-baseline.json
git commit -m "fix(ui): 通知详情与桌面通知开关接入 MatrixNotificationService

这三个开关原本写 tjg-desktop-notification / tjg-show-content /
tjg-show-sender，而真实配置由 MatrixNotificationService 存在
tjg-notification-config 里，且 showNotification() 只读后者。
改为直接读写服务配置。"
```

---

## Task 5: 让通知配置真正作用到发送路径（P0，Task 4 评审发现）

**背景**：Task 4 把 `NotificationSettings.vue` 接到 `MatrixNotificationService` 的配置上，
但评审验证后发现**这份配置在生产环境根本不会被读取**：

- `MatrixNotificationService.showNotification()` / `buildNotificationDisplay()` 在全仓
  （`src`、`e2e`、`scripts`）**没有任何生产调用点**——只有定义与测试。
  `NotificationSettings.vue:181` 的注释声称"showNotification() 消费这份配置"，
  这个断言**不成立**（注释本身是错误信息，要一并修掉）。
- 真正的桌面通知路径是 `src/stores/domains/chat/chat/messageMutations.ts:239`：
  直接 `import { sendNotification } from '@tauri-apps/plugin-notification'`，
  在 `atUidList` 命中时**无条件**发送，完全绕过服务配置。
- `showSender` 更极端：**全仓没有任何读取点**（只有接口、默认值、校验、以及 UI 侧的写），
  是一个纯写入字段。

**为什么守门抓不到**：`check-settings-wiring.mjs` 只统计设置窗口里的 `localStorage` key。
值搬进 store/service 之后，"有字段但没有消费方"对它是完全隐形的。这类问题只能靠
"从用户操作出发追到实际效果"的检查发现——Task 2/3/5 都是同一类。

**Files:**
- Modify: `src/stores/domains/chat/chat/messageMutations.ts`
- Modify: `src/services/matrix/notifications/MatrixNotificationService.ts`
- Modify: `src/views/settingsWindow/tabs/NotificationSettings.vue`（修正错误注释）
- Test: 对应 `__tests__`

**Interfaces:**
- Consumes: `matrixNotificationService.buildNotificationDisplay(title, body): { title: string; body: string | undefined }`
  以及 `shouldNotifyMessage(...)`（Task 6 引入）、`isWithinDndWindow()`（Task 7 引入）。
  若这些尚未实现，先只做本任务需要的最小部分并在报告中说明顺序调整。
- Produces: 桌面通知统一经 `matrixNotificationService` 发出，从而让 `enableDesktop` /
  `showMessageContent` / `showSender` 三个开关真实生效。

- [ ] **Step 1: 写失败测试**

在 `messageMutations` 的测试里断言：当 `enableDesktop === false` 时**不发送**通知；
`showMessageContent === false` 时正文被隐藏；`showSender === false` 时不暴露发送者名称。
（具体断言点取决于 `buildNotificationDisplay` 的现有返回约定——先读它再写测试。）

- [ ] **Step 2: 跑测试确认失败**

```bash
npx vitest run src/stores/domains/chat/chat/__tests__ src/services/matrix/notifications
```

Expected: FAIL —— 当前无条件发送、且不读配置。

- [ ] **Step 3: 让真实路径走服务**

把 `messageMutations.ts:239` 的直接 `sendNotification` 改为经服务：
`enableDesktop === false` 时不发送；经 `buildNotificationDisplay()` 决定标题与正文，
再交给 Tauri 的 `sendNotification` 发送（保留现有的 `title`/`body`/`icon` 语义）。

`showSender === false` 时：标题不要包含发送者名称（当前标题就是 `cacheUser.name`）。
若产品语义上"不显示发送者"应当改为房间名或其他中性标题，在报告中说明你的选择与依据。

- [ ] **Step 4: 修正错误注释**

`NotificationSettings.vue:181` 的注释改为准确描述（配置由哪条路径消费）。
文档里写错比没写更糟——它会误导下一个读者（包括本次评审）。

- [ ] **Step 5: 跑测试与回归**

```bash
npx vitest run src/stores/domains/chat src/services/matrix/notifications
npx vitest run
```

- [ ] **Step 6: 提交**

```bash
git add src/stores/domains/chat/chat/messageMutations.ts src/services/matrix/notifications/MatrixNotificationService.ts src/views/settingsWindow/tabs/NotificationSettings.vue
git commit -m "fix(chat): 桌面通知实际发送路径接入通知配置

Task 4 之后配置仍不生效：showNotification()/buildNotificationDisplay()
在生产环境没有任何调用点，真实路径 messageMutations.ts 直接调
@tauri-apps/plugin-notification 并无条件发送，showSender 更是全仓无读取点。

把真实路径改为经 MatrixNotificationService：enableDesktop 关则不发送，
标题与正文由 buildNotificationDisplay() 决定，并修正 NotificationSettings
里那句不成立的注释。"
```

---

## Task 6: 通知细粒度开关接线（P1，缩减为 3 个 key）

> **控制器裁决（2026-09-21，用户确认；见顶部「执行中修正」）**
> 实测桌面端**唯一**的系统通知发送点是 `messageMutations.ts:254`（`atUidList` 提及路径）。
> 原「9 个 key」里 6 个**没有任何可挂的分发点**，接线只会再造一次"存了不生效"：
> - `friend_request` / `friend_accept`：`useWsEventHandler.ts:255/260` 有监听，但
>   `friendRequestReceived` / `friendRequestAccepted` 全仓零 emitter（只有枚举定义与这两处监听）；
> - `space_new_room` / `space_member_change` / `thread_reply` / `thread_participate`：
>   既无 mitt 事件也无 sync 监听，`thread_reply`/`thread_participate` 所需的父消息作者、
>   线程参与关系也不在消息体里。
>
> 按 YAGNI 删除这 6 个开关的桌面 UI 与 key，提交信息写明依据（将来补齐通知发射路径再恢复）。
> 本任务只接线能真正生效的 3 个 key：`tjg-thread-mention-notify`、`tjg-keyword-notification`、
> `tjg-keywords`。

**唯一偏好来源（裁决，不得两边都写）**
- 「线程中提及」开关落 `MatrixNotificationService` 的 `tjg-notification-config.events`
  （与 `enableDesktop`/`showSender` 同一来源、同一发送路径读取）。
- 关键词列表与「关键词通知」开关落**现有** `notificationDisplayPreferences`
  （`tjg-notification-display-preferences`），新增 `keywordNotifications: boolean`（默认 `false`）。
  **禁止**新增 `config.keywords`，**禁止**继续把 `tjg-keywords` 当存储源。
- 旧 key 一次性迁移进各自的新家，幂等：新值已存在时以新值为准。

**Files:**
- New: `src/services/matrix/notifications/notificationDecision.ts`
- New: `src/services/matrix/notifications/__tests__/notificationDecision.test.ts`
- Modify: `src/services/matrix/notifications/MatrixNotificationService.ts`
- Modify: `src/services/matrix/notifications/notificationDisplayPreferences.ts`
- Modify: `src/services/matrix/notifications/__tests__/notificationDisplayPreferences.test.ts`
- Modify: `src/services/matrix/notifications/__tests__/MatrixNotificationService.test.ts`
- Modify: `src/services/matrix/MatrixEventService.ts`（消息携带线程信息）
- Modify: `src/types/message.ts`
- Modify: `src/stores/domains/chat/chat/messageMutations.ts`
- Modify: `src/stores/domains/chat/chat/__tests__/message.test.ts`（真实发送路径行为测试）
- Modify: `src/views/settingsWindow/tabs/NotificationSettings.vue`
- Modify: `src/views/settingsWindow/tabs/__tests__/NotificationSettings.test.ts`
- Modify: `scripts/settings-wiring-baseline.json`（按实测 `--update`）

**Interfaces:**
- Produces（纯函数，`notificationDecision.ts`，不得依赖 Pinia/localStorage）：
  ```ts
  export type NotificationMessageKind = 'mention' | 'thread_mention' | 'keyword'
  export function classifyNotificationMessage(input: {
    isMention: boolean
    isThread: boolean
  }): NotificationMessageKind
  export function shouldNotify(
    input: { isMention: boolean; isThread: boolean; body: string },
    preferences: {
      events: Record<string, boolean> | undefined
      keywordNotifications: boolean
      keywords: readonly string[]
    }
  ): boolean
  ```
- Produces（服务）：`matrixNotificationService.shouldNotifyMessage(input)`——组装
  `this.config.events` + `loadNotificationDisplayPreferences()` 后委托纯函数。
- Produces（服务）：`setEventNotificationEnabled(kind: 'thread_mention', enabled: boolean): void`
  写入 `config.events`。原方案的 8 元 `NotificationEventKind` 联合类型**作废**：没有分发点的
  kind 不进入类型，避免留下"有类型无消费方"的空壳。
- Produces（展示偏好）：`NotificationDisplayPreferences.keywordNotifications: boolean`（默认 `false`），
  并纳入 `normalizeNotificationDisplayPreferences` / `loadNotificationDisplayPreferences` /
  `saveNotificationDisplayPreferences`。
- Produces（消息体）：`MessageBody.threadId?: string`，由
  `MatrixEventService.convertEventToMessage` 从 `content['m.relates_to']`（`rel_type === 'm.thread'`）填充。

**行为语义（每条都要有行为测试；默认行为必须与现状完全一致）**

| 消息 | 开关 | 是否发系统通知 |
| --- | --- | --- |
| 普通提及（非线程） | 任意 | 是（现状，无对应开关） |
| 线程内提及 | `events.thread_mention` 缺省 / `true` | 是 |
| 线程内提及 | `events.thread_mention === false` | 否 |
| 非提及、正文命中关键词 | `keywordNotifications === false`（默认） | 否（默认行为不变） |
| 非提及、正文命中关键词 | `keywordNotifications === true` | 是 |
| 非提及、正文不命中 | 任意 | 否 |
| 自己发送的消息（即使命中关键词） | 任意 | 否 |

- [ ] **Step 1: 写失败测试（真实发送路径，RED）**

在 `src/stores/domains/chat/chat/__tests__/message.test.ts` 的
`describe('desktop notification wiring')` 内追加行为测试，走同一条真实路径
`store.pushMsg(...)` 并断言 `sendNotification`，沿用 Task 5 已有的
`sendNotification` mock、`matrixNotificationService.updateConfig(...)` 写入方式与
`groupUserRef`（`@/stores/domains/chat/group`）打桩。

**测试隔离要求**：`updateConfig` 是合并语义，`beforeEach` 必须同时复位
`events: {}` 与关键词展示偏好（`localStorage.clear()` 或写回默认值），否则用例间互相污染。

同时补齐单元测试：
- `notificationDecision.test.ts`：`classifyNotificationMessage` 三种归类 + `shouldNotify` 上表逐行；
- `notificationDisplayPreferences.test.ts`：`keywordNotifications` 默认 `false`、normalize 容错、
  旧 `tjg-keyword-notification`/`tjg-keywords` 迁移且幂等（新值优先）；
- `MatrixNotificationService.test.ts`：`events` 的校验与持久化（写入后重建服务实例仍生效）；
- `MatrixEventService` 侧：`m.relates_to.rel_type === 'm.thread'` 时 `MessageBody.threadId` 被填充。

- [ ] **Step 2: 跑测试确认失败**

```bash
npx vitest run src/stores/domains/chat/chat/__tests__/message.test.ts src/services/matrix/notifications
```

Expected: FAIL——线程开关与关键词两组断言与现状相反（只认 `atUidList` 的旧逻辑），
纯函数与 `threadId` 尚不存在。

- [ ] **Step 3: 实现**

1) 新建 `notificationDecision.ts`。关键词匹配**必须**复用
   `notificationDisplayPreferences.matchesNotificationKeyword`，不得再写第三份匹配逻辑。
2) `src/types/message.ts` 的 `MessageBody` 增 `threadId?: string`；
   `MatrixEventService.convertEventToMessage` 从 `content['m.relates_to']` 读取
   `rel_type === 'm.thread'` 时填充。若发现其他入站转换点（如 `room/sync.ts` 的增量 timeline
   分支）也喂给 `pushMsg`，同样处理，或在报告中明确说明为何不需要。
3) `NotificationConfig` 增 `events: Record<string, boolean>`：补 `loadConfig` 的
   `isValidNotificationConfig` 校验与默认值（缺省 `{}`；字段缺省视为开启），
   并加 `setEventNotificationEnabled(kind: 'thread_mention', enabled: boolean)`。
4) 加 `matrixNotificationService.shouldNotifyMessage(input)`：读 `this.config.events` +
   `loadNotificationDisplayPreferences()`（含关键词）后委托 `shouldNotify`。
5) `messageMutations.ts` 第 240 行那段裸 `atUidList` 判断改为调用决策门：
   先排除自己发送的消息，再取 `isMention` / `isThread`（`body.threadId`）。
   标题/图标来源优先 `groupStore.getUserInfo`，取不到时退化为 `msg.fromUser`，
   **不得**因为拿不到群缓存而让关键词通知静默失效。
6) 迁移（幂等，新值优先）：
   - 旧 `tjg-thread-mention-notify`（`'true'`/`'false'` 字符串）→ `config.events.thread_mention`；
   - 旧 `tjg-keyword-notification` → `keywordNotifications`；
   - 旧 `tjg-keywords`（JSON 数组，需容错）→ `keywords`（复用 `parseNotificationKeywords`）。
7) `NotificationSettings.vue`：删除 6 个开关（线程回复/参与、空间新房间/成员变动、
   好友请求/接受）的模板、ref、handler 与 localStorage 读写；保留的「线程中提及」
   「关键词通知」「关键词列表」改走上述唯一来源。若 `pnpm check` 的 i18n 守卫因未引用文案
   报错，一并清理并跑 `pnpm gen:i18n`（`src/typings/i18n.d.ts` 是生成文件）。

- [ ] **Step 4: 跑测试与守门**

```bash
npx vitest run src/stores/domains/chat/chat/__tests__/message.test.ts src/services/matrix/notifications src/views/settingsWindow/tabs
node scripts/check-settings-wiring.mjs --update && node scripts/check-settings-wiring.mjs
pnpm vue-tsc --noEmit
```

Expected: PASS；基线按实测 `--update` 收紧。**计数下降不是验收依据**——验收是 Step 1
行为测试的 RED→GREEN 证据（Task 2/3/5/2b 同一标准）。

- [ ] **Step 5: 提交**

```bash
git add src/services/matrix src/types/message.ts src/stores/domains/chat scripts/settings-wiring-baseline.json src/views/settingsWindow/tabs
git commit -m "fix(ui): 线程提及与关键词通知接入真实发送路径

9 个细粒度开关里 6 个（好友请求/接受、空间新房间/成员变动、线程回复/参与）
没有任何通知分发点，按 YAGNI 删除 UI 与 key。剩余 3 个真正接线：
线程中提及走 config.events.thread_mention，关键词列表与开关走已有的
notificationDisplayPreferences，统一决策门在 messageMutations 发送路径生效。"
```

---

## Task 7: 勿扰时段接线（P1，3 个 key）

**Files:**
- New: `src/services/matrix/notifications/dndWindow.ts`（纯函数）
- New: `src/services/matrix/notifications/__tests__/dndWindow.test.ts`
- Modify: `src/services/matrix/notifications/MatrixNotificationService.ts`
- Modify: `src/services/matrix/notifications/__tests__/MatrixNotificationService.test.ts`
- Modify: `src/services/matrix/notifications/notificationDecision.ts`（决策门加 DND 维度）
- Modify: `src/services/matrix/notifications/__tests__/notificationDecision.test.ts`
- Modify: `src/views/settingsWindow/tabs/PushSettings.vue`
- Modify: `src/views/settingsWindow/tabs/__tests__/PushSettings.test.ts`
- Modify: `src/stores/domains/chat/chat/__tests__/message.test.ts`（真实发送路径行为测试）
- Modify: `scripts/settings-wiring-baseline.json`（按实测 `--update`）

**⚠️ 整分支评审核实 + 控制器裁决：DND 已有两份真实存储，原 Step 3 会造第三份，且原强制点是死代码**

现状（务必先读）：
- account data `io.hula.dnd_settings` = `{ enabled, startTime: number | null, endTime: number | null }`，
  已由 `MatrixNotificationService.syncDndToAccountData` / `syncDndFromAccountData` 实现
  （`MatrixNotificationService.ts:202` / `:216`）；
- `PushSettings.vue` 的 `dndEnabled` / `dndStartTime` / `dndEndTime` 用 `n-time-picker`，
  **值就是时间戳（number）**，并镜像进 `tjg-push-dnd` / `tjg-push-dnd-start` / `tjg-push-dnd-end`
  （`PushSettings.vue:294-316` 读、`:448-469` 写）；
- `syncConfigFromAccountData()` 生产零调用方，所以**不能**假设账号数据在启动时就绪；
- `showNotification()` 零生产调用方（Task 4/5 评审结论）。

控制器裁决（绑定）：
1. **单一表示**：沿用既有的时间戳表示与 `syncDnd*` 路径。**禁止**新增 `config.dnd`，
   **禁止**引入 `'HH:mm'` 字符串表示（那会是第三份）。
2. **服务成为 DND 状态的唯一所有者**：服务新增私有 DND 缓存，在构造时从既有 localStorage 镜像
   同步水合（保证不打开设置窗口也能生效），`syncDndFromAccountData()` 返回数据时刷新缓存；
   新增 `getDndSettings()` / `setDndSettings({ enabled, startTime, endTime })`，后者是唯一写入点
   （更新缓存 + localStorage 镜像 + 复用 `syncDndToAccountData`）。`PushSettings.vue` 不再直接读写
   `tjg-push-dnd*`。
3. **强制点**：并入 Task 6 的决策门（`messageMutations.ts` 真实发送路径上的
   `shouldNotify` / `shouldNotifyMessage`）。勿扰生效时**抑制全部系统通知（含普通提及）**；
   `enabled` 默认 `false`，所以默认行为不变。
4. **边界**：`startTime` / `endTime` 任一为 `null` 时视为不在勿扰（配置不完整就不抑制）；
   起止同一时刻视为全天勿扰；跨午夜按 `[start, end)` 处理。

**Interfaces:**
- Consumes: Task 6 的决策门 `shouldNotify(input, preferences)` / `shouldNotifyMessage(input)`，
  以及既有的 `syncDndToAccountData` / `syncDndFromAccountData`
- Produces（纯函数 `dndWindow.ts`）：
  ```ts
  export interface DndWindow {
    enabled: boolean
    startTime: number | null
    endTime: number | null
  }
  /** 判断 now（本地时区）是否落在 [startTime, endTime) 内；enabled 为假或任一端为 null 时返回 false。 */
  export function isWithinDndWindow(window: DndWindow, now: Date): boolean
  ```
- Produces（服务）：`getDndSettings(): DndWindow`；`setDndSettings(window: DndWindow): void`；
  `isWithinDndWindow(now?: Date): boolean`
- Produces（决策门）：`NotificationDecisionPreferences` 增 `dndActive: boolean`；
  `dndActive === true` 时 `shouldNotify` 一律返回 `false`

- [ ] **Step 1: 写失败测试**

纯函数（`dndWindow.test.ts`）：未启用 / 任一端为 `null` → `false`；跨午夜命中与不命中；
同日区间命中与不命中；起止相同视为全天。

决策门（`notificationDecision.test.ts`）：`dndActive: true` 时普通提及也返回 `false`；
`dndActive: false` 时保持 Task 6 语义逐行不变。

真实发送路径（`message.test.ts` 的 `describe('desktop notification wiring')`）：
先造一个**当前时刻一定落在其中**的窗口（起止都取当前时间 → 全天勿扰），`pushMsg` 一条普通提及，
断言 `sendNotification` **未被调用**；再 `enabled: false` 重跑，断言被调用。
这条用例必须显式控制"当前时间"：优先给纯函数 / 服务方法注入 `now`（`isWithinDndWindow(now)`），
或用 `vi.setSystemTime`，不要依赖真实时钟。

服务（`MatrixNotificationService.test.ts`）：`setDndSettings` 同时更新缓存与 localStorage 镜像；
重建服务实例后 `getDndSettings()` 读到同一份（证明构造时水合，不依赖打开设置窗口）。

- [ ] **Step 2: 跑测试确认失败**

```bash
npx vitest run src/services/matrix/notifications src/stores/domains/chat/chat/__tests__/message.test.ts
```
Expected: FAIL —— `setDndSettings` / `isWithinDndWindow` 不是函数，决策门没有 `dndActive` 维度。

- [ ] **Step 3: 实现**

1) 新建 `dndWindow.ts` 纯函数：把 `startTime` / `endTime` 时间戳转成当地时间的分钟数
   （`new Date(ts).getHours() * 60 + getMinutes()`），再按 `[start, end)` 判定；`start === end`
   视为全天。
2) 服务：加 DND 缓存 + 构造时从 `tjg-push-dnd*` 水合 + `getDndSettings()` / `setDndSettings()` /
   `isWithinDndWindow(now?)`。`setDndSettings` 写 localStorage 镜像并调用现有的
   `syncDndToAccountData`（不要复制它的实现）。`syncDndFromAccountData()` 命中时更新缓存。
3) 决策门：`NotificationDecisionPreferences` 增 `dndActive`；`shouldNotify` 第一行
   `if (preferences.dndActive) return false`；`shouldNotifyMessage` 组装
   `dndActive: this.isWithinDndWindow()`。
4) `PushSettings.vue`：初始化改用 `matrixNotificationService.getDndSettings()`，写入改用
   `setDndSettings(...)`，删除三处直接 `localStorage` 读写；已有的 `n-time-picker`
   时间戳绑定保持不变。

- [ ] **Step 4: 跑测试与守门**

```bash
npx vitest run src/services/matrix/notifications src/stores/domains/chat/chat/__tests__/message.test.ts src/views/settingsWindow/tabs
node scripts/check-settings-wiring.mjs --update && node scripts/check-settings-wiring.mjs
npx vue-tsc --noEmit
```

Expected: PASS；基线按实测 `--update` 收紧。**计数下降不是验收依据**——验收是 Step 1
真实发送路径行为测试的 RED→GREEN。

- [ ] **Step 5: 提交**

```bash
git add src/services/matrix/notifications src/views/settingsWindow/tabs scripts/settings-wiring-baseline.json
git commit -m "fix(ui): 勿扰时段接入真实通知路径

tjg-push-dnd / -start / -end 此前只写不读。沿用既有时间戳表示与 syncDnd* 路径，
把 DND 状态收归 MatrixNotificationService（构造时从本地镜像水合），
并以纯函数 isWithinDndWindow 并入真实发送路径上的通知决策门：
勿扰窗口内抑制全部系统通知。"
```

---

## Task 8: 屏蔽用户改用邀请策略，删除平行实现（P2）

**Files:**
- Modify: `src/views/settingsWindow/tabs/sections/BlockedUsersSection.vue`
- Delete: `src/views/settingsWindow/tabs/sections/InviteListsSection.vue`
- Modify: `src/views/settingsWindow/tabs/SecuritySettings.vue`
- Test: `src/views/settingsWindow/tabs/__tests__/BlockedUsersSection.test.ts`（新建）

**Interfaces:**
- Consumes: `matrixAccountService.getInvitePolicy()` / `.setInvitePolicy(policy)`、`InvitePolicy` 类型（`src/services/matrix/user/invitePolicy.ts`）
- Produces: 无新导出

**语义决策**：`BlockedUsersSection` 的"屏蔽"与 `InviteListsSection` 的黑名单是同一件事——"不让这些人邀请我"。统一映射到 `InvitePolicy.blocklist`。"已忽略用户"（`m.ignored_user_list`，影响消息可见性）是不同概念，保持 `IgnoredUsersSection` 不动。

**⚠️ 不要强制 `mode: 'blocklist'`（整分支评审核实的隐私回归）**

`shouldRejectInvite`（`src/services/matrix/user/invitePolicy.ts`）在 `mode === 'blocklist'` 分支**提前 return**，
完全绕过 `allowStrangers`；而 `allowStrangers` 的默认值是 `false`（`:72`），
意味着"仅允许联系人私聊"这条基线。所以一旦把 mode 强行置为 `blocklist`，
用户只要屏蔽一个人，**对其他所有人的"仅联系人"保护就静默失效了**。

因此本任务：

1. **保留原有 `mode` 不变**，只增删 `blocklist` 数组：
   `setInvitePolicy({ ...policy, blocklist: next })`；
2. 把 `blocklist` 做成**与 mode 正交**的维度——修改 `shouldRejectInvite`，让名单检查不再
   通过 `mode` 门控，而是当成一条独立规则：

```ts
export function shouldRejectInvite(inviterUserId: unknown, policy: InvitePolicy): boolean {
  const normalized = normalizeInvitePolicy(policy)
  const inviter = normalizeUserId(inviterUserId)

  // blocklist 是与 mode 正交的独立维度：黑名单里的人永远拒绝，
  // 不因为 mode 是 allow_all 就被跳过（否则一屏蔽某人就会关掉"仅联系人"基线）
  if (inviter && normalized.blocklist.includes(inviter)) {
    return true
  }

  if (normalized.mode === 'allowlist') {
    return inviter ? !normalized.allowlist.includes(inviter) : true
  }

  if (normalized.allowStrangers) {
    return false
  }

  return inviter ? !normalized.contacts.includes(inviter) : true
}
```

3. 补两条回归测试：`mode: 'allow_all' + allowStrangers: false + blocklist: [X]` 时，
   X 被拒**且**非联系人 Y 仍被拒（证明"仅联系人"基线没被关掉）；`mode: 'allowlist'` 下黑名单同样生效。

**注意**：这个改动会牵动 Task 2 已建立的判定语义，改完必须重跑
`src/services/matrix/user/__tests__/invitePolicy*.test.ts` 与
`invitePolicyDecision.test.ts`（其中"blocklist 模式提前 return"的相关用例要按新语义更新，
并在报告中列出改动理由）。

- [ ] **Step 1: 写失败测试**

创建 `src/views/settingsWindow/tabs/__tests__/BlockedUsersSection.test.ts`：

```ts
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import BlockedUsersSection from '../sections/BlockedUsersSection.vue'

const { getPolicyMock, setPolicyMock } = vi.hoisted(() => ({
  getPolicyMock: vi.fn(),
  setPolicyMock: vi.fn()
}))

vi.mock('@/services/matrix', () => ({
  matrixAccountService: {
    getInvitePolicy: () => getPolicyMock(),
    setInvitePolicy: (...a: unknown[]) => setPolicyMock(...a)
  }
}))
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (k: string) => k }) }))

describe('BlockedUsersSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    getPolicyMock.mockResolvedValue({
      mode: 'blocklist', blocklist: ['@spam:evil.org'], allowlist: [], allowStrangers: false, contacts: []
    })
    setPolicyMock.mockResolvedValue(true)
  })

  it('从邀请策略读取屏蔽名单，而不是 localStorage', async () => {
    const wrapper = mount(BlockedUsersSection)
    await flushPromises()
    expect(getPolicyMock).toHaveBeenCalled()
    expect(wrapper.text()).toContain('@spam:evil.org')
    expect(localStorage.getItem('tjg-blocked-users')).toBeNull()
  })

  it('取消屏蔽写回邀请策略', async () => {
    const wrapper = mount(BlockedUsersSection)
    await flushPromises()
    await (wrapper.vm as unknown as { handleUnblock: (id: string) => Promise<void> }).handleUnblock('@spam:evil.org')
    expect(setPolicyMock).toHaveBeenCalledWith(expect.objectContaining({ blocklist: [] }))
  })

  it('加载失败不抛错', async () => {
    getPolicyMock.mockRejectedValue(new Error('offline'))
    const wrapper = mount(BlockedUsersSection)
    await flushPromises()
    expect(wrapper.html()).toBeTruthy()
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

```bash
npx vitest run src/views/settingsWindow/tabs/__tests__/BlockedUsersSection.test.ts
```

Expected: FAIL —— `getInvitePolicy` 未被调用 / `localStorage` 里有值。

- [ ] **Step 3: 改写组件**

`BlockedUsersSection.vue`：删除 `localStorage` 读写，改为在 `onMounted` 调 `matrixAccountService.getInvitePolicy()` 取 `blocklist`，`handleAddBlocked`/`handleUnblock` 改为改数组后
`setInvitePolicy({ ...policy, blocklist: next })`——**不要动 `mode`**。保留既有 i18n key 与 Naive UI 结构。

- [ ] **Step 4: 删除平行实现**

```bash
git rm src/views/settingsWindow/tabs/sections/InviteListsSection.vue
```

在 `SecuritySettings.vue` 里删除 `<InviteListsSection />`（第 30 行附近）与对应 import（第 64 行附近）。**保留** `<InvitePermissionPanel />`（它已在基点提交 `60b562f4` 自包含，本任务不需要动它）。

- [ ] **Step 5: 跑测试与守门**

```bash
npx vitest run src/views/settingsWindow
node scripts/check-settings-wiring.mjs --update && node scripts/check-settings-wiring.mjs
```

Expected: PASS；并运行 `node scripts/check-settings-wiring.mjs --update` 按实测收紧基线（`tjg-blocked-users`、`tjg-invite-blocklist`/`tjg-invite-allowlist` 中实际写入的那些消失）。

- [ ] **Step 6: 提交**

```bash
git add -A src/views/settingsWindow
git add scripts/settings-wiring-baseline.json
git commit -m "refactor(ui): 屏蔽用户与邀请名单统一到 invitePolicy，删除平行实现

SecuritySettings 同时挂了两套邀请名单 UI：InviteListsSection 写
localStorage、InvitePermissionPanel 写 account data，两者互不知情。

屏蔽语义统一映射到 InvitePolicy.blocklist（已忽略用户是另一概念，
保持不动）；删除 InviteListsSection。"
```

---

## Task 9: 三个"别名写入"孤立 key 的落地（P1，Task 0 评审发现；控制器裁决缩减）

> **控制器裁决（2026-09-21，用户确认）**：实测三处共 17 个开关在前端与 `src-tauri`
> **全仓零消费方**，而方案原定的归宿（store / account data）**不会创造消费方**——照原样搬迁
> 只会让死配置计数下降、功能照样不生效（HANDOFF 明确禁止把计数当完成依据）。裁决：
>
> 1. **`tjg-sidebar-settings`（11 字段）→ 删除整个 SidebarSettings 面板。**
>    实测：`src/layout/left/components/ActionList.vue` 只消费已有 store 的 `showMode`
>    （`:358`），`SidebarSettings.vue` 的 `showIconsOnly` 与它重复；其余 10 个字段
>    （showSpaces/showRooms/showDirectMessages/showFriends/showThreads/showAvatar/
>     showCollapsed/showDrag/sortBy/itemSize）没有任何组件读取。方案 Step 1 的 YAGNI 分支
>    已授权删除；`showMode` 是既有真实设置，**不要动它**。
> 2. **`tjg-burn-after-read-settings` → 删除 3 个偏好开关与房间列表区块，blob 整个移除。**
>    实测 `autoBurnRead`/`burnNotification`/`burnSound` 零消费方；`burnRooms` 列表只有这个
>    blob 一个写入源（没有任何路径往列表里加房间，所以永远显示空），房间级开关的真实入口是
>    聊天页 `ChatFooter` 的 `toggle-burn-after-read`。全局开关/时长/倒计时（已经在 settingStore
>    与 burn 服务上）与统计区块**保留**。
> 3. **`tjg-friend-settings`（3 字段）→ 保留 UI，迁入 `InvitePolicy`。**
>    用户确认 synapse-rust 后端会读 account data `im.hula.invite_policy` 里的好友请求字段，
>    因此这是唯一"搬进去就真生效"的一个。**注意字段类型**：现有 UI 的 `friendRequestMessage`
>    实际是 **boolean**（locale `setting.friends.requests.message_required_label = 好友请求需要附言`，
>    绑的是 `n-switch`），方案原文写的 `friendRequestMessage: string` 是误读——改为
>    `requireFriendRequestMessage: boolean`。

**Files:**
- Delete: `src/views/settingsWindow/tabs/SidebarSettings.vue`
- Delete: `src/views/settingsWindow/tabs/__tests__/SidebarSettings.test.ts`
- Modify: `src/stores/domains/settings/settingsSchema.ts`（去掉 `sidebar` tab：类型联合、tab 定义、label 映射）
- Modify: `src/views/settingsWindow/tabComponentLoaders.ts`（去掉 `sidebar` loader）
- Modify: `src/views/settingsWindow/tabs/BurnAfterReadSettings.vue`
- Modify: `src/views/settingsWindow/tabs/__tests__/BurnAfterReadSettings.test.ts`
- Modify: `src/services/matrix/user/invitePolicy.ts`（`InvitePolicy` + 归一化 + 默认值）
- Modify: `src/services/matrix/user/__tests__/invitePolicy.test.ts`
- Modify: `src/views/settingsWindow/tabs/FriendsSettings.vue`
- Modify: `src/views/settingsWindow/tabs/__tests__/FriendsSettings.test.ts`
- Modify: `scripts/settings-wiring-baseline.json`（按实测 `--update`）

**Interfaces:**
- Produces: `InvitePolicy` 增 `allowFriendRequests: boolean`（默认 `true`）、
  `autoAcceptFriends: boolean`（默认 `false`）、`requireFriendRequestMessage: boolean`（默认 `true`）；
  `normalizeInvitePolicy` 对三者做 `boolean` 校验（非法输入回落默认），`DEFAULT_INVITE_POLICY` 补默认值。
- Consumes: Task 8 建立的 InvitePolicy 写入模式——**read-modify-write**：写前重新
  `await matrixAccountService.getInvitePolicy()`，只覆盖本组件拥有的字段，避免与
  `BlockedUsersSection` / `InvitePermissionPanel` 互相覆盖（Task 8 评审的 Important #2 就是这个问题）。

**验收口径（重要）**：好友请求三字段的**消费方在 synapse-rust 后端**，本仓库前端无法给出
"生效"的行为测试。因此本任务对 friend 部分只能验证：不再写 `tjg-friend-settings`、写入
`im.hula.invite_policy`、且不覆盖同策略里的 `blocklist`/`mode` 等其它字段。报告中必须
明确写出这一限制，**不得**把它当作"功能已生效"的证据。

- [ ] **Step 1: 删除 SidebarSettings 面板**

删除组件与测试；从 `settingsSchema.ts` 去掉 `sidebar`（类型联合第 8 行附近、tab 定义第 60 行附近、
label 映射第 79 行附近）；从 `tabComponentLoaders.ts:12` 去掉 loader。然后：

```bash
grep -rn "SidebarSettings\|'sidebar'" src/views/settingsWindow src/stores/domains/settings --include=*.ts --include=*.vue | grep -v __tests__
```

Expected: 除 `settings-sidebar` 这类 CSS/aria 文案外无残留。若发现还有页面在用这些字段，
停下报告 NEEDS_CONTEXT，不要硬删。

- [ ] **Step 2: 删除 BurnAfterReadSettings 的 3 个偏好开关与房间列表区块**

`BurnAfterReadSettings.vue`：删除 `autoBurnRead` / `burnNotification` / `burnSound` 三个 ref、
模板开关、`handleToggle` 里对它们的写入，以及整个"房间列表"区块与 `BurnRoom` / `burnRooms` /
`handleEditRoomBurn` / `handleSaveRoomBurn` / `handleEnableRoomBurn` / `handleDisableRoomBurn`、
`STORAGE_KEY` 与 `tjg-burn-after-read-settings` 的全部读写。保留：全局阅后即焚开关、默认时长、
`showBurnCountdown`（已走 settingStore）、统计区块、以及它们调用的 burn 服务方法。

- [ ] **Step 3: 写失败测试**

`FriendsSettings`（新 describe，或扩充现有 `FriendsSettings.test.ts`）：
- mock `@/services/matrix` 的 `matrixAccountService.getInvitePolicy` / `setInvitePolicy`；
- 断言挂载后调用 `getInvitePolicy()`、且 `localStorage.getItem('tjg-friend-settings')` 为 `null`；
- 切换「允许接收好友请求」后 `setInvitePolicy` 收到 `allowFriendRequests: false`，且
  **`blocklist`/`mode`/`allowlist`/`allowStrangers` 保持原值**（证明 read-modify-write）；
- 写回前重新读取：先让第一次 `getInvitePolicy()` 返回 A，写回前再返回含新 `blocklist` 的 B，
  断言最终写入包含 B 的 `blocklist`。

`BurnAfterReadSettings`：断言挂载/切换后不再写 `tjg-burn-after-read-settings`，且
`autoBurnRead`/`burnNotification`/`burnSound` 不再出现在组件里。

`invitePolicy.test.ts`：三个新字段的默认值、非法输入回落、round-trip。

- [ ] **Step 4: 跑测试确认失败**

```bash
npx vitest run src/views/settingsWindow/tabs/__tests__/FriendsSettings.test.ts src/views/settingsWindow/tabs/__tests__/BurnAfterReadSettings.test.ts src/services/matrix/user/__tests__/invitePolicy.test.ts
```

Expected: FAIL —— `tjg-friend-settings` 仍被写入 / 组件仍含三个偏好字段 / `InvitePolicy` 尚无新字段。

- [ ] **Step 5: 实现**

1) `invitePolicy.ts`：`InvitePolicy` 增三字段 + `normalizeInvitePolicy` 校验 + `DEFAULT_INVITE_POLICY`
   默认值；补 JSDoc 说明消费方在后端 account data。
2) `FriendsSettings.vue`：`loadSettings`/`saveSettings` 改走
   `matrixAccountService.getInvitePolicy()` / `setInvitePolicy({ ...policy, allowFriendRequests,
   autoAcceptFriends, requireFriendRequestMessage })`，写法必须是写前重新 get 的 read-modify-write；
   删除 `STORAGE_KEY` 与 `tjg-friend-settings` 读写；保留好友分组/请求加载逻辑不动。
3) 变量名同步：模板里的 `friendRequestMessage` 改名为 `requireFriendRequestMessage`（语义不变）。

- [ ] **Step 6: 跑测试与守门**

```bash
npx vitest run src/views/settingsWindow src/services/matrix/user src/stores/domains/settings
npx vue-tsc --noEmit
node scripts/check-settings-wiring.mjs --update && node scripts/check-settings-wiring.mjs
```

Expected: PASS；基线按实测 `--update` 收紧（`tjg-sidebar-settings` + `tjg-friend-settings` +
`tjg-burn-after-read-settings` 三个别名 key 消失）。**计数下降不是验收依据**——验收是 Step 3
行为测试的 RED→GREEN。

- [ ] **Step 7: 提交（按三块分成 3 个提交）**

```bash
git add src/views/settingsWindow src/stores/domains/settings src/services/matrix/user scripts/settings-wiring-baseline.json
git commit -m "fix(ui): 三个别名写入的孤立配置按 YAGNI 与账号策略分别落地

Task 0 的守门补上 const 别名形态后暴露出三个此前无人负责的死配置：
- tjg-sidebar-settings：11 个侧边栏 UI 偏好无任何消费方（showIconsOnly 与既有
  store showMode 重复），删除整个面板
- tjg-burn-after-read-settings：3 个偏好无消费方，房间列表只有本 blob 一个写入源，
  删除；房间级开关的真实入口在聊天页
- tjg-friend-settings：好友请求策略属账号级，迁入 InvitePolicy account data
  （后端读取；friendRequestMessage 实为 boolean，改名 requireFriendRequestMessage）"
```

---

## Task 10: 字体缩放真正生效（P1）

**Files:**
- Create: `src/utils/fontScale.ts`
- Create: `src/utils/__tests__/fontScale.test.ts`
- Modify: `src/views/settingsWindow/tabs/AppearanceSettings.vue`
- Modify: `src/views/settingsWindow/tabs/__tests__/AppearanceSettings.test.ts`（若不存在则新建）

**Interfaces:**
- Produces: `FONT_SCALE_STEPS`（`readonly number[]`，如 `[0.875, 1, 1.125, 1.25]`）、`normalizeFontScale(value: unknown): number`、`applyFontScale(scale: number, root?: HTMLElement): void`、`loadFontScale(storage?): number`、`saveFontScale(scale, storage?): void`
- Consumes: Task 0 守门

**机制**：`design-tokens.css` 的 `--tjg-font-size-*` 目前是硬编码 px。改为在 `:root` 上写 `--tjg-font-scale: 1`，并把各字号 token 改成 `calc(<px> * var(--tjg-font-scale))`，脚本只负责设置 `document.documentElement.style.setProperty('--tjg-font-scale', String(scale))`。

- [ ] **Step 1: 写失败测试**

`src/utils/__tests__/fontScale.test.ts`：

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import {
  applyFontScale, FONT_SCALE_STEPS, loadFontScale, normalizeFontScale, saveFontScale
} from '../fontScale'

describe('normalizeFontScale', () => {
  it('接受合法步进值', () => {
    for (const s of FONT_SCALE_STEPS) expect(normalizeFontScale(s)).toBe(s)
  })
  it('非法值回落到 1', () => {
    expect(normalizeFontScale('big')).toBe(1)
    expect(normalizeFontScale(null)).toBe(1)
    expect(normalizeFontScale(9)).toBe(1)
  })
})

describe('applyFontScale', () => {
  beforeEach(() => {
    document.documentElement.style.removeProperty('--tjg-font-scale')
  })
  it('写入 CSS 变量', () => {
    applyFontScale(1.25)
    expect(document.documentElement.style.getPropertyValue('--tjg-font-scale')).toBe('1.25')
  })
  it('非法值按 1 处理', () => {
    applyFontScale(Number.NaN)
    expect(document.documentElement.style.getPropertyValue('--tjg-font-scale')).toBe('1')
  })
})

describe('load/save', () => {
  beforeEach(() => localStorage.clear())
  it('无存储时为 1', () => expect(loadFontScale()).toBe(1))
  it('往返一致', () => {
    saveFontScale(1.125)
    expect(loadFontScale()).toBe(1.125)
  })
  it('损坏数据回落 1', () => {
    localStorage.setItem('tjg-font-scale', '{broken')
    expect(loadFontScale()).toBe(1)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

```bash
npx vitest run src/utils/__tests__/fontScale.test.ts
```

Expected: FAIL —— 模块不存在。

- [ ] **Step 3: 实现 `src/utils/fontScale.ts`**

```ts
import { createLogger } from '@/utils/Logger'

const logger = createLogger('FontScale')

/** 可选的字体缩放档位。1 为基准。 */
export const FONT_SCALE_STEPS = [0.875, 1, 1.125, 1.25] as const

const STORAGE_KEY = 'tjg-font-scale'

export function normalizeFontScale(value: unknown): number {
  if (typeof value === 'number' && (FONT_SCALE_STEPS as readonly number[]).includes(value)) {
    return value
  }
  return 1
}

export function applyFontScale(scale: number, root: HTMLElement = document.documentElement): void {
  const normalized = normalizeFontScale(scale)
  root.style.setProperty('--tjg-font-scale', String(normalized))
}

export function loadFontScale(storage: Pick<Storage, 'getItem'> = localStorage): number {
  try {
    const raw = storage.getItem(STORAGE_KEY)
    return raw === null ? 1 : normalizeFontScale(Number(raw))
  } catch (err) {
    logger.warn('读取字体缩放失败:', err)
    return 1
  }
}

export function saveFontScale(scale: number, storage: Pick<Storage, 'setItem'> = localStorage): void {
  try {
    storage.setItem(STORAGE_KEY, String(normalizeFontScale(scale)))
  } catch (err) {
    logger.warn('保存字体缩放失败:', err)
  }
}
```

- [ ] **Step 4: 让 token 可缩放**

在 `src/styles/css/design-tokens.css` 的 `:root` 里加 `--tjg-font-scale: 1;`，并把该文件里所有 `--tjg-font-size-*` 的值改成 `calc(<原px> * var(--tjg-font-scale))`。例：

```css
  --tjg-font-scale: 1;
  --tjg-font-size-xs: calc(10px * var(--tjg-font-scale));
  --tjg-font-size-sm: calc(12px * var(--tjg-font-scale));
  --tjg-font-size-md: calc(13px * var(--tjg-font-scale));
  --tjg-font-size-base: calc(14px * var(--tjg-font-scale));
```

（`--font-size-base: var(--tjg-font-size-base)` 等别名不用改。）

- [ ] **Step 5: 组件接线 + 启动时应用**

`AppearanceSettings.vue`：字号选择改为 `loadFontScale()` 初始化、`saveFontScale()` + `applyFontScale()` 写入，删除 `tjg-font-size` 的 `localStorage` 调用。

在 `src/App.vue` 的 `onMounted` 里加（与 `setupThemeWatchers()` 同区）：

```ts
import { applyFontScale, loadFontScale } from '@/utils/fontScale'
// ...
applyFontScale(loadFontScale())
```

- [ ] **Step 6: 跑测试与守门**

```bash
npx vitest run src/utils/__tests__/fontScale.test.ts src/views/settingsWindow/tabs
node scripts/check-settings-wiring.mjs --update && node scripts/check-settings-wiring.mjs
pnpm check:ratchet
```

Expected: PASS；并运行 `node scripts/check-settings-wiring.mjs --update` 按实测收紧基线（`tjg-font-size` 变为有消费方后消失）。`check:ratchet` 仍需通过（未引入硬编码色）。

- [ ] **Step 7: 提交**

```bash
git add src/utils/fontScale.ts src/utils/__tests__/fontScale.test.ts src/styles/css/design-tokens.css src/views/settingsWindow/tabs/AppearanceSettings.vue src/App.vue scripts/settings-wiring-baseline.json
git commit -m "feat(ui): 字体缩放真正生效

tjg-font-size 此前写入后无人读取——字号 token 是硬编码 px，
调档位没有任何视觉变化。新增 fontScale 工具并把 --tjg-font-size-*
改为 calc(px * var(--tjg-font-scale))，启动时应用已保存档位。"
```

---

## Task 11: 气泡样式落地 + 删除装饰性 Labs 面板（P1）

> **控制器裁决（2026-09-21，用户确认）**
>
> **气泡样式**：现有 UI 是「圆角 / 方形」布尔开关（`AppearanceSettings.vue:66` 的 `n-switch`，
> `checked=圆角`、`unchecked=方形`，写 `tjg-bubble-style = 'true'|'false'`）。方案原文假设的
> `['default','compact','bubble']` 三档 enum 与这个 UI 无关，**不采用**。按现有语义落地：
> 两个值 `rounded` / `square`，保留开关与文案。
>
> **Labs 面板**：实测 `tjg-enable-devtools` / `tjg-debug-mode` / `tjg-show-performance` /
> `tjg-lab-features` 在前端与 `src-tauri` **全仓零运行时消费方**（只有桌面/移动设置 UI 自读自写）；
> experimental feature 开关（threads/spaces/voip/widget/custom-status/...）同样只写不读。
> 唯一真实的 devtools 入口是 Tauri 原生菜单（`src-tauri/src/desktops/menu.rs:151-157` 的
> `w.open_devtools()`），由 Rust 侧菜单触发、不读任何偏好，前端也没有运行时可调的
> devtools API（`@tauri-apps/api/webview` 只有创建期 `devtools?: boolean` 选项），**接不上**。
> 因此按 YAGNI **删除整个桌面 Labs tab**；mobile 的平行 Labs 面板不在本轮范围，记入 ledger。

**Files:**
- Create: `src/utils/bubbleStyle.ts`
- Create: `src/utils/__tests__/bubbleStyle.test.ts`
- Modify: `src/styles/scss/render-message.scss`（气泡圆角消费点；类名为 `.bubble` / `.bubble-oneself`）
- Modify: `src/views/settingsWindow/tabs/AppearanceSettings.vue`
- Modify: `src/views/settingsWindow/tabs/__tests__/AppearanceSettings.test.ts`
- Modify: `src/App.vue`（启动时应用已保存的气泡样式）
- Delete: `src/views/settingsWindow/tabs/LabsSettings.vue`
- Delete: `src/views/settingsWindow/tabs/__tests__/LabsSettings.test.ts`
- Modify: `src/stores/domains/settings/settingsSchema.ts`（去掉 `labs` tab：类型联合、tab 定义、label 映射）
- Modify: `src/views/settingsWindow/tabComponentLoaders.ts`（去掉 `labs` loader）
- Modify: 相关设置 schema/shell 测试（`settingsSchema.test.ts`、`useSettingsShell.test.ts` 等，按报错逐个修）
- Modify: `scripts/settings-wiring-baseline.json`（按实测 `--update`）

**Interfaces:**
- Produces（`src/utils/bubbleStyle.ts`）：
  ```ts
  export const BUBBLE_STYLES = ['rounded', 'square'] as const
  export type BubbleStyle = (typeof BUBBLE_STYLES)[number]
  export function normalizeBubbleStyle(value: unknown): BubbleStyle
  export function applyBubbleStyle(style: string, root?: HTMLElement): void   // 写 data-bubble-style
  export function loadBubbleStyle(storage?): BubbleStyle
  export function saveBubbleStyle(style: string, storage?): void
  ```
  `normalizeBubbleStyle` 除两个 enum 值外，还要把旧表示 `'true'` → `rounded`、`'false'` → `square`
  （旧 UI 写的就是字符串 `'true'`/`'false'`），非法值回落 `rounded`。

- [ ] **Step 1: 写失败测试**

`src/utils/__tests__/bubbleStyle.test.ts`：
- `applyBubbleStyle('square')` → `document.documentElement.getAttribute('data-bubble-style') === 'square'`；
- 未知值 → `'rounded'`；
- 旧值迁移：`'true'` → `rounded`、`'false'` → `square`（`normalizeBubbleStyle` 直接断言）；
- `saveBubbleStyle` / `loadBubbleStyle` 往返一致，损坏/缺失回落 `rounded`；
- `BUBBLE_STYLES` 恰为 `['rounded','square']`。

**链接真的接通了**（Task 10 同一标准）：追加一个从磁盘读 `src/styles/scss/render-message.scss`
的用例，断言存在 `[data-bubble-style='square']` 且选择器覆盖 `.bubble` 与 `.bubble-oneself`
的 `border-radius` 覆盖规则。只断言工具函数会写属性是不够的——原缺陷正是"属性写了但没人消费"。

- [ ] **Step 2: 跑测试确认失败**

```bash
npx vitest run src/utils/__tests__/bubbleStyle.test.ts
```
Expected: FAIL —— 模块不存在 / scss 里没有 `data-bubble-style` 规则。

- [ ] **Step 3: 实现气泡样式**

1) 新建 `src/utils/bubbleStyle.ts`（纯函数 + localStorage，`STORAGE_KEY = 'tjg-bubble-style'`，
   `ROOT_ATTR = 'data-bubble-style'`，错误 catch + logger.warn，参照 `fontScale.ts` 的写法）。
2) 在 `src/styles/scss/render-message.scss` 里加方形覆盖（默认 `@include bubble` 已是圆角，
   所以只需覆盖 square；**不得新增硬编码颜色**，圆角值使用既有 token `--tjg-radius-xs`）：
   ```scss
   [data-bubble-style='square'] .bubble,
   [data-bubble-style='square'] .bubble-oneself {
     border-radius: var(--tjg-radius-xs);
   }
   ```
   注意 `.bubble-oneself` 自身有 `rounded-[12px_4px_12px_12px]` 覆盖，square 规则要能盖过它
   （必要时提高选择器特异性并在报告中说明）。
3) `AppearanceSettings.vue`：开关改为 `loadBubbleStyle()` 初始化、`handleBubbleStyleChange` 调
   `applyBubbleStyle()` + `saveBubbleStyle()`，删除直接读写 `tjg-bubble-style` 的代码；
   开关的 checked/unchecked 文案与 `rounded`/`square` 对应关系保持不变。
4) `src/App.vue` 的 `onMounted` 里加 `applyBubbleStyle(loadBubbleStyle())`（与 `applyFontScale` 同区）。

- [ ] **Step 4: 删除桌面 Labs tab**

```bash
grep -rn "LabsSettings\|'labs'" src/views/settingsWindow src/stores/domains/settings --include=*.ts --include=*.vue | grep -v __tests__
```
删除组件与测试，去掉 `settingsSchema.ts` 的 `labs`（类型联合、tab 定义、label 映射）与
`tabComponentLoaders.ts` 的 loader，再按编译/测试报错修掉引用 `labs` tab 的 schema/shell 测试。
Expected: 上述 grep 无残留；`npx vue-tsc --noEmit` 0 错误。

- [ ] **Step 5: 跑测试与守门**

```bash
npx vitest run src/utils src/views/settingsWindow src/stores/domains/settings
npx vue-tsc --noEmit
node scripts/check-settings-wiring.mjs --update && node scripts/check-settings-wiring.mjs
```

Expected: PASS；基线按实测 `--update` 收紧（`tjg-bubble-style` 变为有消费方，
`tjg-debug-mode` / `tjg-enable-devtools` / `tjg-lab-features` / `tjg-show-performance` 消失）。
**计数下降不是验收依据**——气泡的验收是 Step 1 的行为测试 + scss 磁盘守卫。

- [ ] **Step 6: 提交**

```bash
git add src/utils src/styles src/views/settingsWindow src/stores/domains/settings src/App.vue scripts/settings-wiring-baseline.json
git commit -m "feat(ui): 气泡样式落地并删除零消费方的 Labs 面板

tjg-bubble-style 此前只写不读：消息气泡圆角由 render-message.scss 固定，
开关没有任何消费方。改为 data-bubble-style 属性 + scss 覆盖，启动时应用，
旧 'true'/'false' 迁移为 rounded/square。

tjg-enable-devtools / tjg-debug-mode / tjg-show-performance / tjg-lab-features
与全部 experimental feature 开关在前端与 src-tauri 均无运行时消费方；
真实 devtools 入口是 Tauri 原生菜单（Rust 侧、读不到 localStorage），
前端无可接路径，按 YAGNI 删除整个桌面 Labs tab。"
```

---

## Task 12: 备份开关读真实状态（P1）

**Files:**
- Modify: `src/views/settingsWindow/tabs/EncryptionSettings.vue`
- Test: `src/views/settingsWindow/tabs/__tests__/EncryptionSettings.test.ts`（扩充）

**Interfaces:**
- Consumes: `matrixKeyBackupService`（状态查询）、`useEncryptionStore`

- [ ] **Step 1: 写失败测试**

```ts
it('备份开关反映真实备份状态而不是 localStorage', async () => {
  const wrapper = mount(EncryptionSettings)
  await flushPromises()
  expect(localStorage.getItem('tjg-backup-enabled')).toBeNull()
})
```

- [ ] **Step 2: 跑测试确认失败**

```bash
npx vitest run src/views/settingsWindow/tabs/__tests__/EncryptionSettings.test.ts
```

Expected: FAIL —— `tjg-backup-enabled` 被写入。

- [ ] **Step 3: 改为读真实状态**

删除 `tjg-backup-enabled` 的读写；开关的值来自 `matrixKeyBackupService` 的备份状态（参照 `MobileSecurityKeySetup.vue` / `CryptoKeyBackupAdapter` 里已有的状态查询方式），并保留既有的 `@setup-backup` 等事件派发。

- [ ] **Step 4: 跑测试与守门**

```bash
npx vitest run src/views/settingsWindow/tabs
node scripts/check-settings-wiring.mjs --update && node scripts/check-settings-wiring.mjs
```

Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src/views/settingsWindow/tabs/EncryptionSettings.vue src/views/settingsWindow/tabs/__tests__/EncryptionSettings.test.ts
git commit -m "fix(ui): 密钥备份开关改为读真实备份状态

tjg-backup-enabled 只写不读，真实状态在 matrixKeyBackupService。
改为读服务状态，避免开关与服务实际状态不一致。"
```

---

## Task 13: 音视频设备偏好接线（P4）

**Files:**
- Create: `src/services/media/mediaDevicePreferences.ts`
- Create: `src/services/media/__tests__/mediaDevicePreferences.test.ts`
- Modify: `src/views/settingsWindow/tabs/VoiceVideoSettings.vue`
- Modify: 媒体层消费点（先确认：`src/services/matrix/media/MatrixVoiceService.ts` 或 `MatrixVoIPService.ts` 的 `getUserMedia` 调用处）

**Interfaces:**
- Produces: `MediaDevicePreferences = { audioInputId: string | null; audioOutputId: string | null; videoInputId: string | null; inputVolume: number; outputVolume: number; autoGain: boolean; echoCancellation: boolean; noiseSuppression: boolean }`；`loadMediaDevicePreferences()`、`saveMediaDevicePreferences(partial)`、`toAudioQualityConstraints(prefs)`（只含 echoCancellation/noiseSuppression/autoGainControl，供 `applyConstraints`）、`toDeviceConstraints(prefs)`（含 `deviceId: { exact }`，**只供重建轨道**，禁止喂给 `applyConstraints`）、`normalizeVolumeToGain(volume0to100)`

- [ ] **Step 1: 消费点已定位（无需再找）**

已核实的现状：

- `src/services/matrix/media/MatrixVoIPService.ts:32` 明确写着服务层**不自己调 `getUserMedia`**——避免与 SDK 内部采集重复竞争设备。
- 本地流由 SDK 拥有：`handleFeedsChanged()`（同文件 245 行）只是把 `feed.stream` 的轨道组装进预览用的 `MediaStream`，注释也写明"由 SDK 拥有，挂断时 SDK 自行释放"。
- 全仓 `getUserMedia` 的生产调用点是**摄像头 facingMode 切换**，不带 `deviceId`、不带音频：
  `src/components/call/CallView.vue:210`、`src/views/callWindow/index.vue:288`（均 `audio: false`）。

**因此设备偏好的正确生效方式是 `track.applyConstraints()`**，而不是新建流：

**⚠️ 整分支评审核实：以下三点必须先纠正，否则本任务会直接编译失败并连带打死可用开关**

1. **`volume` 不是 `MediaTrackConstraints` 的成员。** 实测 `lib.dom.d.ts` 的
   `MediaTrackConstraintSet` 只有 `autoGainControl` / `deviceId` / `echoCancellation` /
   `noiseSuppression` / `sampleRate` / `sampleSize` / `channelCount` 等，
   **没有 `volume`**（`volume` 是 HTMLMediaElement 的属性，且已废弃）。
   把它塞进约束对象会**类型报错**；即使绕过类型，`applyConstraints` 是原子的——
   一个不可满足的约束会让整次调用 reject，`echoCancellation`/`noiseSuppression`/`autoGainControl`
   都会静默不生效。
2. **`deviceId` 是不可变约束。** 把含 `deviceId: { exact }` 的同一对象喂给 `applyConstraints`
   必然 reject。所以**约束对象必须拆成两份**：`applyConstraints` 只收音质类三个布尔；
   设备 id 单独走重建轨道路径。
3. **音量要走 `GainNode`（输入）/ `HTMLMediaElement.setSinkId`（输出）**，不是 track 约束；
   且本方案的 `inputVolume` 是 0..100 整数，与 Web Audio 的 0.0..1.0 线性增益不同，需要归一化。

因此本任务的正确切分：

- `toAudioQualityConstraints(prefs)` → **只含** `echoCancellation` / `noiseSuppression` / `autoGainControl`
  三个布尔，用于 `track.applyConstraints()`；
- `toDeviceConstraints(prefs)` → 含 `deviceId: { exact }`，**只用于重建轨道**（`getUserMedia` 或
  `replaceTrack`），本次可不接线，但要存在且有测试，避免后人误把它喂给 `applyConstraints`；
- 音量：`inputVolume` 归一化到 0..1 供 `GainNode` 用（本次可只提供纯函数 + 测试）；
  `outputVolume` 需要 `setSinkId`/`HTMLMediaElement.volume`，本次标注为待接线。

**本次交付**：三个音质布尔真实生效（这是能安全生效的部分）；设备切换与音量提供经过测试的
纯函数但不接线，并在提交信息里写明"偏好已持久化，设备切换/音量待 replaceTrack / GainNode 接线"。
**不要**为了凑数去改无关代码。

- [ ] **Step 2: 写失败测试**

```ts
// src/services/media/__tests__/mediaDevicePreferences.test.ts
import { beforeEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_MEDIA_DEVICE_PREFERENCES, loadMediaDevicePreferences,
  normalizeMediaDevicePreferences, saveMediaDevicePreferences,
  toAudioQualityConstraints, toDeviceConstraints, normalizeVolumeToGain
} from '../mediaDevicePreferences'

describe('mediaDevicePreferences', () => {
  beforeEach(() => localStorage.clear())

  it('默认不指定设备且音量 100', () => {
    const p = loadMediaDevicePreferences()
    expect(p.audioInputId).toBeNull()
    expect(p.inputVolume).toBe(100)
  })

  it('往返一致', () => {
    saveMediaDevicePreferences({ audioInputId: 'mic-1', noiseSuppression: false })
    const p = loadMediaDevicePreferences()
    expect(p.audioInputId).toBe('mic-1')
    expect(p.noiseSuppression).toBe(false)
  })

  it('音质约束里绝不能出现 deviceId（否则 applyConstraints 必然 reject）', () => {
    const c = toAudioQualityConstraints({ ...DEFAULT_MEDIA_DEVICE_PREFERENCES, audioInputId: 'mic-9' })
    expect(c.deviceId).toBeUndefined()
    expect(c.echoCancellation).toBe(true)
    expect(c.noiseSuppression).toBe(true)
    expect(c.autoGainControl).toBe(true)
  })

  it('音质约束里绝不能出现 volume（不是 MediaTrackConstraints 成员）', () => {
    const c = toAudioQualityConstraints({ ...DEFAULT_MEDIA_DEVICE_PREFERENCES, inputVolume: 50 })
    expect('volume' in c).toBe(false)
  })

  it('设备约束单独提供，且只在指定设备时带 exact deviceId', () => {
    expect(toDeviceConstraints({ ...DEFAULT_MEDIA_DEVICE_PREFERENCES }).audio.deviceId).toBeUndefined()
    expect(toDeviceConstraints({ ...DEFAULT_MEDIA_DEVICE_PREFERENCES, audioInputId: 'mic-9' }).audio.deviceId)
      .toEqual({ exact: 'mic-9' })
  })

  it('音量 0..100 归一化为 0..1 线性增益', () => {
    expect(normalizeVolumeToGain(0)).toBe(0)
    expect(normalizeVolumeToGain(100)).toBe(1)
    expect(normalizeVolumeToGain(50)).toBeCloseTo(0.5)
    expect(normalizeVolumeToGain(999)).toBe(1)
  })

  it('音量收敛到 0..100', () => {
    expect(normalizeMediaDevicePreferences({ inputVolume: 999 }).inputVolume).toBe(100)
    expect(normalizeMediaDevicePreferences({ inputVolume: -5 }).inputVolume).toBe(0)
  })
})
```

- [ ] **Step 3: 跑测试确认失败**

```bash
npx vitest run src/services/media/__tests__/mediaDevicePreferences.test.ts
```

Expected: FAIL —— 模块不存在。

- [ ] **Step 4: 实现模块**

`src/services/media/mediaDevicePreferences.ts`：本地偏好（沿用现有 `tjg-audio-input` 等 key 作为读写来源，使其获得真实消费方），导出 `loadMediaDevicePreferences` / `saveMediaDevicePreferences` / `normalizeMediaDevicePreferences` / `DEFAULT_MEDIA_DEVICE_PREFERENCES` / `toAudioQualityConstraints` / `toDeviceConstraints` / `normalizeVolumeToGain`。音量为整数并 clamp 到 0..100；`deviceId` 仅在已指定时输出 `{ exact }`，且**只出现在 `toDeviceConstraints` 的返回值里**。

- [ ] **Step 5: 接线 + 守门**

`VoiceVideoSettings.vue` 改用这四个函数读写，删除裸 `localStorage` 调用。

在**新通话**建立时读一次偏好（不要在 `handleFeedsChanged` 里反复读——该回调会多次触发），
然后对本地音轨应用**只含三个布尔**的音质约束：

```ts
// 本地音轨由 SDK 采集，音质偏好只能通过 applyConstraints 施加。
// 只传三个布尔：deviceId 不可变、volume 不是合法约束，任何一个混进来都会让整次调用 reject。
const quality = toAudioQualityConstraints(loadMediaDevicePreferences())
for (const track of localStream.getAudioTracks()) {
  void track.applyConstraints(quality).catch((err) => {
    logger.warn(`应用音频约束失败: ${err}`)
  })
}
```

（`toDeviceConstraints` 与 `normalizeVolumeToGain` 本任务只交付函数与测试，不接线。）

```bash
npx vitest run src/services/media src/views/settingsWindow/tabs
node scripts/check-settings-wiring.mjs --update && node scripts/check-settings-wiring.mjs
```

- [ ] **Step 6: 提交**

```bash
git add src/services/media src/views/settingsWindow/tabs/VoiceVideoSettings.vue scripts/settings-wiring-baseline.json
git commit -m "feat(service): 音视频音质偏好经 applyConstraints 生效

8 个音视频设置项此前只写 localStorage：服务层明确不自己 getUserMedia
（避免与 SDK 采集竞争），本地流由 SDK 拥有，因此没有消费点。

新增 mediaDevicePreferences 统一读写与约束构造；音质类四项
（输入/输出音量、回声消除、降噪、自动增益）经 track.applyConstraints
施加到 SDK 采集的本地音轨。设备切换（deviceId 为不可变约束）需重建轨道
并 replaceTrack，本次未做，偏好已持久化待后续接入。"
```

---

## Task 14: 契约守门——让"没人监听"暴露出来（防复发）

**Files:**
- Create: `scripts/check-component-contracts.mjs`
- Create: `scripts/component-contracts-baseline.json`
- Modify: `package.json`

**Interfaces:**
- Consumes: Task 0 的守门模式（ratchet + baseline）
- Produces: `pnpm check:component-contracts`

**为什么需要**：`InvitePermissionPanel` 的问题能长期潜伏，是因为测试只断言 `emit` 而不断言有人监听。Task 0 守门只管 localStorage，管不了"事件无人监听"。

- [ ] **Step 1: 写守门脚本**

`scripts/check-component-contracts.mjs`：用 `@vue/compiler-sfc` 解析模板（**不要**用字符串包含判断，那会产生大量误报——本方案的审计脚本第一版就踩过：`SpaceTree` 被 `SkeletonSpaceTree` 之类的子串命中）。判据：

1. 收集组件 `defineEmits` 的事件名；
2. 找到所有使用该组件的父模板，解析出实际绑定的 `@event`（含 `v-on:`）；
3. 组件被使用、但某个事件在所有使用处都未绑定 → 记为一条"未监听事件"；
4. ratchet：条数不得增加。

- [ ] **Step 2: 生成基线并人工核对**

```bash
node scripts/check-component-contracts.mjs --update
cat scripts/component-contracts-baseline.json
```

**逐个核对基线条目**，区分两类：
- 真问题（如已修复的 `InvitePermissionPanel` 不再出现）
- 可接受（如父组件通过 `v-model` + `update:modelValue` 自动绑定、或事件由插槽透传）

把"可接受"的写进脚本内的 `ACCEPTED_PATTERNS` 白名单并注明理由，而不是留在基线里。

- [ ] **Step 3: 注册并验证**

```json
    "check:component-contracts": "node scripts/check-component-contracts.mjs",
```

临时删掉 `SecuritySettings.vue` 里 `EncryptionStatusSection` 的 `@setup-backup`，运行应 FAIL；恢复后 OK。

- [ ] **Step 4: 提交**

```bash
git add scripts/check-component-contracts.mjs scripts/component-contracts-baseline.json package.json
git commit -m "test(config): 新增组件事件契约守门

InvitePermissionPanel 能长期"绿着不生效"，根因是测试只断言 emit、
不断言有人监听。新增守门：组件声明的事件若在所有使用处都未绑定即计入，
数量只减不增。用 SFC 解析而非字符串匹配，避免子串误报。"
```

---

## Task 15: 收尾——门禁、文档、基线归零

**Files:**
- Modify: `docs/` 下相关文档（记录本次治理）
- Modify: `docs/mobile-feature-optimization-plan.md`（追加一节）

- [ ] **Step 1: 全量门禁**

先重新生成生成型文件（Task 8 改过 locale 文案却没重生成 `src/typings/i18n.d.ts`，
`src/locales/__tests__/sourceRefs.test.ts` 的"生成产物新鲜度"用例因此是红的）：

```bash
node scripts/generate-i18n-types.mjs
git add src/typings/i18n.d.ts
```

再跑门禁（本 worktree 里 `pnpm` 会因软链的 node_modules 触发 `ERR_PNPM_IGNORED_BUILDS`，
一律用 `npx` / `node scripts/*.mjs` 等价形式）：

```bash
npx vitest run
npx vue-tsc --noEmit
node scripts/check-ratchet.mjs
node scripts/check-sdk-boundary.mjs
node scripts/check-i18n.mjs
node scripts/check-i18n-refs.mjs
node scripts/check-settings-wiring.mjs
node scripts/check-component-contracts.mjs
```

Expected: 全绿。**基线数值只按实测 `--update` 收紧，不以"降到 0"为完成判据**——
验收是各任务的行为测试（Task 2/3/5/2b/6/7/8 的 RED→GREEN 证据）。
`check-doc-coverage.mjs` 的 15 条既有漂移（主树同样失败）在此一并处理：
要么 `--update-baseline` 后只增不减地收紧，要么给缺 JSDoc 的方法补注释。

- [ ] **Step 2: 文档记录**

在 `docs/mobile-feature-optimization-plan.md` 追加一节，写明：审计方法、按 `check-settings-wiring.mjs`
**实测**的死配置数与键名分布（不要写死过时数字；历史值 22/28/34/25/22/19/16 均以当时实测为准）、
五类问题（键名错位/零消费方/平行实现/装饰组件/无实现）、修复路径选择依据，
以及两个新守门的用法与已知局限（只守数量不守键名，且无法判断消费方是否真在运行时消费）。

- [ ] **Step 3: 提交**

```bash
git add docs
git commit -m "docs(config): 记录桌面设置死配置治理结论"
```

- [ ] **Step 4: 合并到 master**

在**隔离 worktree** 内先把 master 合进分支验证，再回主树合并：

```bash
# worktree 内
git fetch . master:refs/remotes/tmp/master
git merge refs/remotes/tmp/master
npx vitest run
# 主树
git merge --no-ff feat/<branch> -m "Merge branch '<branch>'"
```

注意：主树有并行会话的未提交改动，合并只改索引与改动路径，不会碰它们；但不要在主树 `git add -A`。

---

## 自检（对照审计结论）

> 编号已按插入 Task 2/3/5 后的顺序重编。

| 审计发现 | 对应任务 |
| --- | --- |
| 度量缺失 | Task 0 |
| 键名错位：已读回执 / 输入中 / 在线状态 | Task 1 |
| 开关不改变行为（无发送路径守卫） | Task 2 |
| 在线状态仍有登录/状态切换两条路径未覆盖 | Task 3 |
| 键名错位：桌面通知 / 通知内容 / 发送者 | Task 4 |
| 通知配置层不可达（真实路径绕过服务） | Task 5 |
| 零消费方：通知 9 个 → 6 个按 YAGNI 删 UI，3 个接线（线程提及 + 关键词） | Task 6 |
| 零消费方：勿扰时段 3 个（已有两份表示，勿造第三份） | Task 7 |
| 零消费方 + 平行实现：屏蔽用户 / 邀请名单 | Task 8 |
| 首版审计漏掉的 3 个别名写入键 | Task 9 |
| 零消费方：字体大小（无实现） | Task 10 |
| 零消费方：气泡样式、devtools（devtools 前提已更正） | Task 11 |
| 零消费方：备份开关（状态错位）——前提成立 | Task 12 |
| 无实现：音视频 8 项（仅音质三项可安全生效） | Task 13 |
| 装饰组件能长期潜伏（测试只断言 emit） | Task 14 |
| 门禁与文档 | Task 15 |

**未覆盖但需要决策**：Task 3/4/9 里"接消费方"的落点（事件分发处、`getUserMedia` 调用点）需要先定位真实调用点。若某处确实不存在可接的消费方，**按 YAGNI 删除该 UI** 并在提交信息里写明理由，而不是保留一个永远不生效的开关。
