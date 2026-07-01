# Mobile Refactoring: Clean Dead OpenClaw Service Code + Add Push Notifications

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the dead `OpenClawAssistantRoomService` no-op stub and orphaned i18n keys, implement Feishu-style push notification receiving on mobile, and verify bot core stability — while keeping ALL desktop OpenClaw UI intact.

**Architecture:** The desktop OpenClaw UI (`src/views/openclaw/`, `src/hooks/openclaw/`, `openClawConversation` store, `/openclaw` route, left-menu entry) stays untouched. The refactoring removes only the no-op `OpenClawAssistantRoomService` stub (dead code — not imported by anything except its own test) and two orphaned `ai_assistant.robot.openclaw_*` i18n keys that no code references. Push notifications are added via the existing `tauri-plugin-notification` with a new composable, mobile UI component, and relay service.

**Tech Stack:** Vue 3 + TypeScript + Tauri v2 + tauri-plugin-notification + Vitest

## Global Constraints

- **KEEP all desktop OpenClaw UI** — `src/views/openclaw/`, `src/hooks/openclaw/`, `src/router/routes/desktop.ts` `/openclaw` route, `src/layout/left/config.tsx` menu entry
- **KEEP** `src/stores/domains/chat/openClawConversation.ts` and `robotChatSettings.ts` (used by desktop OpenClaw)
- **KEEP** `ai_assistant.openclaw.*` i18n keys in `src/typings/i18n.d.ts` (used by desktop OpenClaw views)
- Do NOT modify `src/mobile/views/my/AiAssistant.vue` (independent SiliconFlow-based mobile AI chat)
- Push notifications must work on both Android and iOS via Tauri plugin
- No emojis in commit messages, logs, or code
- All existing tests must continue to pass; new tests follow TDD red-green-refactor
- Use `pnpm commit` for Conventional Commits

---

### Task 1: Remove dead OpenClawAssistantRoomService no-op stub

**Files:**
- Delete: `src/services/robot/OpenClawAssistantRoomService.ts`
- Delete: `src/services/robot/__tests__/OpenClawAssistantRoomService.test.ts`

**Interfaces:**
- Consumes: nothing (first task)
- Produces: clean robot service directory without dead stub

**Context:** `OpenClawAssistantRoomService` is a no-op stub (comment says "OpenClawX 后端已移除"). Its `ensureRegistered()` only logs and returns. It is NOT re-exported from `src/services/robot/index.ts`, NOT imported by any production code — only its own test file references it. Safe to delete.

- [ ] **Step 1: Verify no production code imports this service**

```bash
grep -r "OpenClawAssistantRoomService\|openClawAssistantRoomService" src/ --include="*.ts" --include="*.vue" --include="*.tsx" | grep -v "__tests__"
```

Expected: No output (only the test file imports it)

- [ ] **Step 2: Delete the files**

```bash
rm src/services/robot/OpenClawAssistantRoomService.ts
rm src/services/robot/__tests__/OpenClawAssistantRoomService.test.ts
```

- [ ] **Step 3: Run robot service tests to verify no breakage**

```bash
pnpm vitest run src/services/robot/__tests__/ 2>&1 | tail -10
```

Expected: All remaining robot service tests pass

- [ ] **Step 4: Run type check**

```bash
vue-tsc --noEmit 2>&1 | grep -i "openclaw"
```

Expected: No output related to the deleted file (other pre-existing openclaw references in desktop UI code are expected and fine)

- [ ] **Step 5: Commit**

```bash
git rm src/services/robot/OpenClawAssistantRoomService.ts
git rm src/services/robot/__tests__/OpenClawAssistantRoomService.test.ts
git commit -m "refactor: remove dead OpenClawAssistantRoomService no-op stub

The service was a no-op stub (OpenClawX backend already removed). It is not
imported by any production code or re-exported from the robot barrel. The
desktop OpenClaw UI (views, stores, hooks, route) remains intact."
```

---

### Task 2: Remove orphaned openclaw-related i18n keys

**Files:**
- Modify: `src/typings/i18n.d.ts`

**Interfaces:**
- Consumes: Task 1 (stub already deleted)
- Produces: clean i18n type definitions with no dead openclaw keys

**Context:** Two i18n keys under `ai_assistant.robot` — `openclaw_not_connected` and `openclaw_connection_failed_gateway` — exist only in the type definition file. No `.vue`, `.ts`, `.tsx`, or `.json` file references them. They are dead keys left over from a removed OpenClaw connection status feature. The `ai_assistant.openclaw.*` block (used by desktop OpenClaw views) stays.

- [ ] **Step 1: Confirm the keys are unreferenced**

```bash
grep -r "openclaw_not_connected\|openclaw_connection_failed" src/ --include="*.ts" --include="*.vue" --include="*.tsx" --include="*.json"
```

Expected: Only `src/typings/i18n.d.ts` matches (type definitions, not usage)

- [ ] **Step 2: Remove the two dead keys from i18n.d.ts**

In `src/typings/i18n.d.ts`, remove these two lines:

```typescript
// DELETE:
// "openclaw_not_connected": "OpenClaw 未连接，请检查 Gateway",
// "openclaw_connection_failed_gateway": "OpenClaw 连接失败，请确保 Gateway 已启动",
```

**IMPORTANT:** Do NOT remove the `ai_assistant.openclaw.*` block — those keys are used by the desktop OpenClaw UI views.

- [ ] **Step 3: Run type check**

```bash
vue-tsc --noEmit 2>&1 | grep -i "openclaw_not_connected\|openclaw_connection_failed"
```

Expected: No output (keys no longer exist in types)

- [ ] **Step 4: Commit**

```bash
git add src/typings/i18n.d.ts
git commit -m "refactor: remove orphaned openclaw i18n keys from robot section

Remove ai_assistant.robot.openclaw_not_connected and
openclaw_connection_failed_gateway — dead keys not referenced by any code.
The ai_assistant.openclaw.* block used by desktop OpenClaw UI is preserved."
```

---

### Task 3: Implement push notification receiver composable

**Files:**
- Create: `src/composables/mobile/usePushReceiver.ts`
- Create: `src/composables/mobile/__tests__/usePushReceiver.test.ts`

**Interfaces:**
- Consumes: nothing (independent of Tasks 1-2)
- Produces:
  - `usePushReceiver()` → `{ notifications, hasPermission, receivePush, removeNotification, clearAll, requestPermission }`
  - `NotificationItem { id: string; title: string; body: string; timestamp: number; data?: Record<string, unknown> }`

- [ ] **Step 1: Write the test for usePushReceiver composable**

```typescript
// src/composables/mobile/__tests__/usePushReceiver.test.ts
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { usePushReceiver } from '../usePushReceiver'

const mockIsPermissionGranted = vi.fn()
const mockRequestPermission = vi.fn()
const mockSendNotification = vi.fn()

vi.mock('@tauri-apps/plugin-notification', () => ({
  isPermissionGranted: () => mockIsPermissionGranted(),
  requestPermission: () => mockRequestPermission(),
  sendNotification: (opts: any) => mockSendNotification(opts)
}))

describe('usePushReceiver', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsPermissionGranted.mockResolvedValue(false)
  })

  it('returns notifications as empty array initially', () => {
    const { notifications } = usePushReceiver()
    expect(notifications.value).toEqual([])
  })

  it('adds a notification via receivePush and preserves order', () => {
    const { notifications, receivePush } = usePushReceiver()

    receivePush({ id: '1', title: 'Test', body: 'Body 1' })
    receivePush({ id: '2', title: 'Test 2', body: 'Body 2' })

    expect(notifications.value).toHaveLength(2)
    expect(notifications.value[0].id).toBe('1')
    expect(notifications.value[1].id).toBe('2')
  })

  it('removes a notification by id', () => {
    const { notifications, receivePush, removeNotification } = usePushReceiver()

    receivePush({ id: '1', title: 'Test', body: 'Body' })
    receivePush({ id: '2', title: 'Test 2', body: 'Body 2' })
    removeNotification('1')

    expect(notifications.value).toHaveLength(1)
    expect(notifications.value[0].id).toBe('2')
  })

  it('clearAll empties the notification list', () => {
    const { notifications, receivePush, clearAll } = usePushReceiver()

    receivePush({ id: '1', title: 'A', body: 'B' })
    receivePush({ id: '2', title: 'C', body: 'D' })
    clearAll()

    expect(notifications.value).toEqual([])
  })

  it('requestPermission resolves with the permission status', async () => {
    mockRequestPermission.mockResolvedValue('granted')
    const { requestPermission } = usePushReceiver()

    const result = await requestPermission()
    expect(result).toBe('granted')
  })

  it('initial hasPermission is set from isPermissionGranted', async () => {
    mockIsPermissionGranted.mockResolvedValue(true)
    const { hasPermission } = usePushReceiver()

    // Wait for the promise in the composable to resolve
    await vi.waitFor(() => {
      expect(hasPermission.value).toBe(true)
    })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm vitest run src/composables/mobile/__tests__/usePushReceiver.test.ts
```

Expected: FAIL — module not found

- [ ] **Step 3: Implement the usePushReceiver composable**

```typescript
// src/composables/mobile/usePushReceiver.ts
import { ref } from 'vue'
import {
  isPermissionGranted,
  requestPermission as requestTauriPermission,
  type PermissionStatus
} from '@tauri-apps/plugin-notification'

export interface NotificationItem {
  id: string
  title: string
  body: string
  timestamp: number
  data?: Record<string, unknown>
}

export function usePushReceiver() {
  const notifications = ref<NotificationItem[]>([])
  const hasPermission = ref(false)

  isPermissionGranted().then((granted) => {
    hasPermission.value = granted
  })

  function receivePush(item: Omit<NotificationItem, 'timestamp'> & { timestamp?: number }) {
    notifications.value = [
      ...notifications.value,
      { ...item, timestamp: item.timestamp || Date.now() }
    ]
  }

  function removeNotification(id: string) {
    notifications.value = notifications.value.filter((n) => n.id !== id)
  }

  function clearAll() {
    notifications.value = []
  }

  async function requestPermission(): Promise<PermissionStatus> {
    const result = await requestTauriPermission()
    hasPermission.value = result === 'granted'
    return result
  }

  return {
    notifications,
    hasPermission,
    receivePush,
    removeNotification,
    clearAll,
    requestPermission
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm vitest run src/composables/mobile/__tests__/usePushReceiver.test.ts
```

Expected: 6/6 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/composables/mobile/usePushReceiver.ts src/composables/mobile/__tests__/usePushReceiver.test.ts
git commit -m "feat: add usePushReceiver composable for mobile push notifications

Reactive composable wrapping tauri-plugin-notification for receiving,
listing, and removing push notifications on mobile platforms."
```

---

### Task 4: Implement mobile push notification UI component

**Files:**
- Create: `src/mobile/components/PushNotificationList.vue`
- Create: `src/mobile/components/__tests__/PushNotificationList.test.ts`

**Interfaces:**
- Consumes: Task 3 (`usePushReceiver` composable, `NotificationItem` type)
- Produces: `<PushNotificationList>` Vue component with props `notifications: NotificationItem[]` and emits `clear`, `dismiss(id)`

- [ ] **Step 1: Write the component test**

```typescript
// src/mobile/components/__tests__/PushNotificationList.test.ts
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import PushNotificationList from '../PushNotificationList.vue'

describe('PushNotificationList', () => {
  it('renders empty state when no notifications', () => {
    const wrapper = mount(PushNotificationList, {
      props: { notifications: [] }
    })
    expect(wrapper.text()).toContain('暂无推送消息')
  })

  it('renders notification items with title and body', () => {
    const wrapper = mount(PushNotificationList, {
      props: {
        notifications: [
          { id: '1', title: '新消息', body: '你收到了一条新消息', timestamp: 1700000000000 },
          { id: '2', title: '系统通知', body: '系统已更新', timestamp: 1700000001000 }
        ]
      }
    })
    expect(wrapper.text()).toContain('新消息')
    expect(wrapper.text()).toContain('你收到了一条新消息')
    expect(wrapper.text()).toContain('系统通知')
    expect(wrapper.findAll('[data-test="notification-item"]')).toHaveLength(2)
  })

  it('emits dismiss with notification id when dismiss button clicked', async () => {
    const wrapper = mount(PushNotificationList, {
      props: {
        notifications: [
          { id: '1', title: 'Test', body: 'Body', timestamp: 1700000000000 }
        ]
      }
    })
    await wrapper.find('[data-test="dismiss-btn-1"]').trigger('click')
    expect(wrapper.emitted('dismiss')).toEqual([['1']])
  })

  it('emits clear when clear-all button is clicked', async () => {
    const wrapper = mount(PushNotificationList, {
      props: {
        notifications: [
          { id: '1', title: 'A', body: 'B', timestamp: 1700000000000 }
        ]
      }
    })
    await wrapper.find('[data-test="clear-all-btn"]').trigger('click')
    expect(wrapper.emitted('clear')).toEqual([[]])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm vitest run src/mobile/components/__tests__/PushNotificationList.test.ts
```

Expected: FAIL — file not found

- [ ] **Step 3: Implement PushNotificationList component**

```vue
<!-- src/mobile/components/PushNotificationList.vue -->
<template>
  <div class="push-notification-list">
    <div v-if="notifications.length === 0" class="empty-state">
      <span>暂无推送消息</span>
    </div>
    <div v-else>
      <div class="list-header">
        <span>{{ notifications.length }} 条通知</span>
        <button type="button" data-test="clear-all-btn" class="clear-btn" @click="emit('clear')">
          清空全部
        </button>
      </div>
      <div
        v-for="item in notifications"
        :key="item.id"
        :data-test="'notification-item'"
        class="notification-item">
        <div class="item-content">
          <span class="item-title">{{ item.title }}</span>
          <span class="item-body">{{ item.body }}</span>
          <span class="item-time">{{ formatTime(item.timestamp) }}</span>
        </div>
        <button
          type="button"
          :data-test="`dismiss-btn-${item.id}`"
          class="dismiss-btn"
          @click="emit('dismiss', item.id)">×</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { NotificationItem } from '@/composables/mobile/usePushReceiver'

defineProps<{
  notifications: NotificationItem[]
}>()

const emit = defineEmits<{
  clear: []
  dismiss: [id: string]
}>()

function formatTime(ts: number): string {
  const date = new Date(ts)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`
  return date.toLocaleDateString('zh-CN')
}
</script>
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm vitest run src/mobile/components/__tests__/PushNotificationList.test.ts
```

Expected: 4/4 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/mobile/components/PushNotificationList.vue
git add src/mobile/components/__tests__/PushNotificationList.test.ts
git commit -m "feat: add mobile push notification list component

PushNotificationList renders notification items with title, body, relative
time formatting, empty state, per-item dismiss, and clear-all action."
```

---

### Task 5: Add mobile push notification relay service

**Files:**
- Create: `src/services/mobile/MobilePushRelayService.ts`
- Create: `src/services/mobile/__tests__/MobilePushRelayService.test.ts`

**Interfaces:**
- Consumes: Tasks 1-4 (clean codebase + push receiver + UI)
- Produces: `MobilePushRelayService` with `startRelay()`, `stopRelay()`, `isActive()`, `onPushReceived(handler): Unsubscribe`, `dispatchTestPush(payload)`

- [ ] **Step 1: Write the relay service test**

```typescript
// src/services/mobile/__tests__/MobilePushRelayService.test.ts
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { MobilePushRelayService } from '../MobilePushRelayService'

describe('MobilePushRelayService', () => {
  let service: MobilePushRelayService

  beforeEach(() => {
    service = new MobilePushRelayService()
  })

  it('registers a push callback and invokes it on dispatch', () => {
    const handler = vi.fn()
    service.onPushReceived(handler)

    service.dispatchTestPush({ id: 'p1', title: 'Test', body: 'Test body' })

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'p1', title: 'Test', body: 'Test body' })
    )
  })

  it('startRelay sets active to true and stopRelay sets it to false', () => {
    expect(service.isActive()).toBe(false)

    service.startRelay()
    expect(service.isActive()).toBe(true)

    service.stopRelay()
    expect(service.isActive()).toBe(false)
  })

  it('dispatchTestPush is no-op when relay is stopped', () => {
    const handler = vi.fn()
    service.onPushReceived(handler)
    service.stopRelay()

    service.dispatchTestPush({ id: 'p1', title: 'T', body: 'B' })

    expect(handler).not.toHaveBeenCalled()
  })

  it('supports multiple handlers and removal via unsubscribe', () => {
    const h1 = vi.fn()
    const h2 = vi.fn()
    const remove1 = service.onPushReceived(h1)
    service.onPushReceived(h2)

    service.dispatchTestPush({ id: '1', title: 'T', body: 'B' })
    expect(h1).toHaveBeenCalledTimes(1)
    expect(h2).toHaveBeenCalledTimes(1)

    remove1()
    service.dispatchTestPush({ id: '2', title: 'T2', body: 'B2' })
    expect(h1).toHaveBeenCalledTimes(1)
    expect(h2).toHaveBeenCalledTimes(2)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm vitest run src/services/mobile/__tests__/MobilePushRelayService.test.ts
```

Expected: FAIL — module not found

- [ ] **Step 3: Implement MobilePushRelayService**

```typescript
// src/services/mobile/MobilePushRelayService.ts
export interface PushPayload {
  id: string
  title: string
  body: string
  timestamp?: number
  data?: Record<string, unknown>
}

type PushHandler = (payload: PushPayload) => void
type Unsubscribe = () => void

export class MobilePushRelayService {
  private active = false
  private handlers = new Set<PushHandler>()

  startRelay(): void {
    this.active = true
  }

  stopRelay(): void {
    this.active = false
  }

  isActive(): boolean {
    return this.active
  }

  onPushReceived(handler: PushHandler): Unsubscribe {
    this.handlers.add(handler)
    return () => {
      this.handlers.delete(handler)
    }
  }

  dispatchTestPush(payload: PushPayload): void {
    if (!this.active) return
    for (const handler of this.handlers) {
      handler(payload)
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm vitest run src/services/mobile/__tests__/MobilePushRelayService.test.ts
```

Expected: 4/4 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/services/mobile/MobilePushRelayService.ts
git add src/services/mobile/__tests__/MobilePushRelayService.test.ts
git commit -m "feat: add MobilePushRelayService for push notification dispatch

Service relays incoming push notifications to registered handlers with
start/stop controls, handler registration with unsubscribe, and test
push dispatch for development and testing."
```

---

### Task 6: Verify bot core functionality

**Files:**
- None (verification-only task)

**Interfaces:**
- Consumes: Tasks 1-5 (clean codebase + new push features)
- Produces: confirmed green test suite for robot/bot functionality

- [ ] **Step 1: Run all robot service tests**

```bash
pnpm vitest run src/services/robot/__tests__/ 2>&1 | tail -10
```

Expected: All robot service tests pass (the deleted OpenClaw stub test is gone, remaining tests unaffected)

- [ ] **Step 2: Run robot plugin tests**

```bash
pnpm vitest run src/plugins/robot/ 2>&1 | tail -10
```

Expected: All robot plugin tests pass (or no test files — acceptable)

- [ ] **Step 3: Run robot store tests**

```bash
pnpm vitest run src/stores/domains/chat/__tests__/ 2>&1 | tail -10
```

- [ ] **Step 4: Verify no dead openclaw imports in robot or bot code**

```bash
grep -r "OpenClawAssistantRoomService\|openClawAssistantRoomService" src/ --include="*.ts" --include="*.vue" --include="*.tsx" | grep -v ".test.ts" | grep -v "__tests__"
```

Expected: No output

- [ ] **Step 5: Verify desktop OpenClaw UI is fully intact**

```bash
ls src/views/openclaw/OpenClawView.vue
ls src/views/openclaw/components/OpenClawInstallGuide.vue
ls src/views/openclaw/components/OpenClawSettings.vue
ls src/views/openclaw/types.ts
ls src/hooks/openclaw/useOpenClawInstaller.ts
ls src/stores/domains/chat/openClawConversation.ts
ls src/stores/domains/chat/robotChatSettings.ts
grep -c "'/openclaw'" src/router/routes/desktop.ts
```

Expected: All files exist; route grep returns 1 (the route is still registered)

- [ ] **Step 6: Commit**

```bash
# Verification-only — no file changes needed
git commit --allow-empty -m "test: verify bot core and desktop OpenClaw UI intact after cleanup

All robot service/plugin/store tests pass. Desktop OpenClaw UI files,
stores, route, and menu entry are preserved. No dead openclaw imports remain."
```

---

### Task 7: Clean up redundant code and dead references

**Files:**
- Modify: any file with stale imports found during sweep
- Verify: no remaining dead references

**Interfaces:**
- Consumes: Tasks 1-6
- Produces: zero dead references to removed code

- [ ] **Step 1: Full sweep for any remaining dead "openclaw" references in source**

```bash
grep -ri "openclaw\|OpenClaw" src/ --include="*.ts" --include="*.vue" --include="*.tsx" | grep -v "node_modules" | grep -v ".test.ts" | grep -v "__tests__"
```

Expected hits (all legitimate — desktop OpenClaw UI):
- `src/views/openclaw/OpenClawView.vue` — desktop view
- `src/views/openclaw/components/OpenClawInstallGuide.vue` — desktop component
- `src/views/openclaw/components/OpenClawSettings.vue` — desktop component
- `src/views/openclaw/types.ts` — desktop types
- `src/hooks/openclaw/useOpenClawInstaller.ts` — desktop hook
- `src/stores/domains/chat/openClawConversation.ts` — desktop store
- `src/stores/domains/chat/robotChatSettings.ts` — desktop settings store
- `src/stores/domains/index.ts` — barrel re-export
- `src/router/routes/desktop.ts` — route registration
- `src/layout/left/config.tsx` — desktop menu
- `src/typings/i18n.d.ts` — `ai_assistant.openclaw.*` keys
- `src/services/ai-provider.ts` — `AIProviderType` includes `'openclaw'`
- `src-tauri/src/command/ai_command.rs` — backend detection command

- [ ] **Step 2: Check for dead CSS references**

```bash
grep -ri "openclaw\|\.openclaw" src/styles/ --include="*.scss" --include="*.css" 2>/dev/null || echo "NO_CSS_REFS"
```

- [ ] **Step 3: Run full type check**

```bash
vue-tsc --noEmit 2>&1 | tail -20
```

Review any remaining type errors. Fix any that reference deleted code.

- [ ] **Step 4: Run full test suite**

```bash
pnpm test:run 2>&1 | tail -10
```

Compare pass/fail counts against baseline. No NEW failures should be introduced.

- [ ] **Step 5: Commit (only if changes were needed)**

```bash
git add -A
git commit -m "chore: clean up dead references after OpenClaw service cleanup"
```

---

### Task 8: Integration verification and report

**Files:**
- Create: `docs/superpowers/plans/2026-07-01-mobile-refactor-verification.md` (report only)

**Interfaces:**
- Consumes: Tasks 1-7 (complete refactoring)
- Produces: verification report documenting test results and changes

- [ ] **Step 1: Run complete unit test suite**

```bash
pnpm test:run 2>&1 | tail -10
```

- [ ] **Step 2: Run type check**

```bash
vue-tsc --noEmit 2>&1 | tail -5
```

- [ ] **Step 3: Run lint check**

```bash
pnpm check 2>&1 | tail -5
```

- [ ] **Step 4: Verify Vite dev server starts (frontend only)**

```bash
timeout 15 pnpm dev 2>&1 | head -20 || echo "Dev server check — verify manually if timeout"
```

Expected: No import errors in terminal output.

- [ ] **Step 5: Write verification report**

Create `docs/superpowers/plans/2026-07-01-mobile-refactor-verification.md`:

```markdown
# Mobile Refactor Verification Report

## Summary
- Desktop OpenClaw UI: preserved (views, stores, hooks, route, menu)
- Dead service code removed: OpenClawAssistantRoomService no-op stub
- Orphaned i18n keys removed: 2 ai_assistant.robot.openclaw_* keys
- New push notification feature: usePushReceiver, PushNotificationList, MobilePushRelayService

## Test Results
- Unit tests: X passed / Y total
- Type check: clean / N errors
- Lint: clean / N warnings

## Files Removed
- src/services/robot/OpenClawAssistantRoomService.ts (no-op stub)
- src/services/robot/__tests__/OpenClawAssistantRoomService.test.ts

## Files Created
- src/composables/mobile/usePushReceiver.ts
- src/composables/mobile/__tests__/usePushReceiver.test.ts
- src/mobile/components/PushNotificationList.vue
- src/mobile/components/__tests__/PushNotificationList.test.ts
- src/services/mobile/MobilePushRelayService.ts
- src/services/mobile/__tests__/MobilePushRelayService.test.ts

## Files Modified
- src/typings/i18n.d.ts (removed 2 orphaned keys)

## Desktop OpenClaw UI — Preserved Intact
- src/views/openclaw/ (4 files)
- src/hooks/openclaw/useOpenClawInstaller.ts
- src/stores/domains/chat/openClawConversation.ts
- src/stores/domains/chat/robotChatSettings.ts
- src/router/routes/desktop.ts (route /openclaw)
- src/layout/left/config.tsx (menu entry)
- src/typings/i18n.d.ts (ai_assistant.openclaw.* block)
```

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/plans/2026-07-01-mobile-refactor-verification.md
git commit -m "docs: add mobile refactor verification report"
```

---
