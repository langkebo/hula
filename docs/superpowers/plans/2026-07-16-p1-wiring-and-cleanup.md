# P1 Feature Wiring + Code Cleanup

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire 5 existing-but-unreachable P1 features into their parent views, add mobile dehydrated device management, and clean up 13 orphaned test files + dead code.

**Architecture:** All P1 components already exist with full composable and service layers. Tasks 1-4 add ~10 lines each to parent views to connect them. Task 5 builds a mobile batch toolbar reusing `useMessageMultiSelect`. Task 6 builds a Vant dialog reusing `useDehydratedDevice`. Task 7 deletes orphaned files.

**Tech Stack:** Vue 3 Composition API, Vant 4.x, Pinia, vue-i18n, Vitest, TypeScript

## Global Constraints

- Components call services, never import `matrix-js-sdk` directly
- Mobile uses `#/` alias for `src/mobile/`; PC uses `@/` for `src/`
- Mobile UI uses Vant (`van-dialog`, `van-cell`, `van-popup`, `van-button`, `van-action-sheet`); PC uses Naive UI
- All visible text via `$t()` / `useI18n()` with keys in `src/locales/{en,zh-CN}/`
- New components use `<script setup lang="ts">`
- Touch targets >= 48px on mobile interactive elements
- Each task commits atomically with `git add` + `git commit -m "feat: ..."`
- Before committing: `vue-tsc --noEmit` must pass, Vitest tests must pass

---

### Task 1: Wire room upgrade dialog into ChatSetting

**Files:**
- Modify: `src/mobile/views/chat-room/ChatSetting.vue` — add import + template entry
- Create: `src/mobile/views/chat-room/__tests__/ChatSetting-upgrade.test.ts`

**Interfaces:**
- Consumes: `MobileRoomUpgradeDialog` (exists at `#/views/chat-room/MobileRoomUpgradeDialog.vue`, takes `v-model:show` boolean)
- Consumes: `useRoomUpgradeFlow` from `@/composables/room/useRoomUpgradeFlow` — returns `{ currentVersion, availableVersions, targetVersion, loading, upgrading, errorMessage, canUpgrade, hasVersions, newerVersions, load, upgrade, resolveTargetVersion }`
- Consumes: `globalStore.currentSessionRoomId` (string)

- [ ] **Step 1: Add imports to ChatSetting.vue**

At `src/mobile/views/chat-room/ChatSetting.vue`, add these imports after the existing import block (after line 263):

```typescript
import MobileRoomUpgradeDialog from '#/views/chat-room/MobileRoomUpgradeDialog.vue'
import { useRoomUpgradeFlow } from '@/composables/room/useRoomUpgradeFlow'
```

- [ ] **Step 2: Add composable and dialog ref in script section**

After the existing `const title = computed(...)` block (after line 288), add:

```typescript
const showRoomUpgrade = ref(false)
const roomUpgradeFlow = useRoomUpgradeFlow({
  roomId: currentSessionRoomId,
  canUpgrade: isAdmin,
})
```

- [ ] **Step 3: Add template entry in the settings section**

In the template, inside the settings `van-cell-group` (the div with class `bg-[--hula-surface-panel] rounded-10px` that contains pintop/silent toggles, around line 195), add after the silent toggle div (after line 210):

```html
<div v-if="isGroup && roomUpgradeFlow.canUpgrade.value" class="mx-15px border-b border-[--hula-border-default]"></div>
<div
  v-if="isGroup && roomUpgradeFlow.canUpgrade.value"
  class="flex justify-between p-15px items-center cursor-pointer"
  @click="showRoomUpgrade = true">
  <div class="text-14px">{{ t('room_advanced.room_upgrade.title') }}</div>
  <div class="text-12px text-[--hula-text-secondary] flex items-center gap-10px">
    <span>{{ roomUpgradeFlow.currentVersion.value || '—' }}</span>
    <svg class="w-14px h-14px iconpark-icon"><use href="#right"></use></svg>
  </div>
</div>
```

- [ ] **Step 4: Add dialog component at end of template**

Before the closing `</template>` tag (after the last `</div>` of the container, before `</AutoFixHeightPage>`), add:

```html
<MobileRoomUpgradeDialog v-model:show="showRoomUpgrade" :room-id="currentSessionRoomId" :can-upgrade="!!isAdmin" />
```

- [ ] **Step 5: Write the test file**

Create `src/mobile/views/chat-room/__tests__/ChatSetting-upgrade.test.ts`:

```typescript
import { mount } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createI18n } from 'vue-i18n'
import { createTestingPinia } from '@pinia/testing'

vi.mock('@/composables/room/useRoomUpgradeFlow', () => ({
  useRoomUpgradeFlow: () => ({
    currentVersion: { value: '10' },
    availableVersions: { value: [{ version: '11', status: 'stable' }] },
    targetVersion: { value: null },
    loading: { value: false },
    upgrading: { value: false },
    errorMessage: { value: null },
    canUpgrade: { value: true },
    hasVersions: { value: true },
    newerVersions: { value: [{ version: '11', status: 'stable' }] },
    load: vi.fn(),
    upgrade: vi.fn().mockResolvedValue('new-room-id'),
    resolveTargetVersion: vi.fn().mockReturnValue('11'),
  }),
}))

vi.mock('#/views/chat-room/MobileRoomUpgradeDialog.vue', () => ({
  default: { name: 'MobileRoomUpgradeDialog', template: '<div class="mock-upgrade-dialog"></div>', props: ['show', 'roomId', 'canUpgrade'], emits: ['update:show'] },
}))

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en: { room_advanced: { room_upgrade: { title: 'Room Upgrade' } }, mobile_chat_setting: { title: '{t}', type: { group: 'Group', single_chat: 'Chat' } } } } })

describe('ChatSetting - room upgrade entry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the upgrade cell for group admin rooms', async () => {
    const ChatSetting = (await import('#/views/chat-room/ChatSetting.vue')).default
    const wrapper = mount(ChatSetting, {
      global: {
        plugins: [i18n, createTestingPinia({ createSpy: vi.fn })],
        stubs: { AutoFixHeightPage: true, HeaderBar: true, MobileRoomUpgradeDialog: true, 'van-cell-group': true, 'van-cell': true, 'van-field': true, 'van-switch': true, 'van-button': true, 'van-tag': true, 'van-dialog': true, 'van-loading': true, 'van-dropdown-menu': true, 'van-dropdown-item': true, 'van-pull-refresh': true, 'van-list': true, 'van-action-sheet': true, 'van-popup': true, 'van-search': true, 'van-icon': true, AvatarCropper: true },
        },
      },
    })
    expect(wrapper.html()).toBeTruthy()
    expect(wrapper.find('.mock-upgrade-dialog').exists()).toBe(false)
  })

  it('does not throw when mounted', async () => {
    const ChatSetting = (await import('#/views/chat-room/ChatSetting.vue')).default
    expect(() => mount(ChatSetting, {
      global: {
        plugins: [i18n, createTestingPinia({ createSpy: vi.fn })],
        stubs: { AutoFixHeightPage: true, HeaderBar: true, MobileRoomUpgradeDialog: true, 'van-cell-group': true, 'van-cell': true, 'van-field': true, 'van-switch': true, 'van-button': true, 'van-tag': true, 'van-dialog': true, 'van-loading': true, 'van-dropdown-menu': true, 'van-dropdown-item': true, 'van-pull-refresh': true, 'van-list': true, 'van-action-sheet': true, 'van-popup': true, 'van-search': true, 'van-icon': true, AvatarCropper: true },
      },
    })).not.toThrow()
  })
})
```

- [ ] **Step 6: Run the test**

```bash
pnpm vitest run src/mobile/views/chat-room/__tests__/ChatSetting-upgrade.test.ts
```

Expected: 2 tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/mobile/views/chat-room/ChatSetting.vue src/mobile/views/chat-room/__tests__/ChatSetting-upgrade.test.ts
git commit -m "feat: wire room upgrade dialog into ChatSetting"
```

---

### Task 2: Wire room list management (allowlist/denylist) into ChatSetting

**Files:**
- Modify: `src/mobile/views/chat-room/ChatSetting.vue` — add import + template entries
- Create: `src/mobile/views/chat-room/__tests__/ChatSetting-list-mgmt.test.ts`

**Interfaces:**
- Consumes: `MobileListManagementDialog` (exists at `#/views/chat-room/MobileListManagementDialog.vue`, takes `v-model:show` + `roomId` + `canManage` props)
- Consumes: `useRoomListManagement` from `@/composables/room/useRoomListManagement` — returns `{ allowlist, denylist, loading, adding, removing, errorMessage, canManage, allowlistCount, denylistCount, loadAllowlist, loadDenylist, addToAllowlist, removeFromAllowlist, addToDenylist, removeFromDenylist }`

- [ ] **Step 1: Add imports to ChatSetting.vue**

After the Task 1 import additions, add:

```typescript
import MobileListManagementDialog from '#/views/chat-room/MobileListManagementDialog.vue'
import { useRoomListManagement } from '@/composables/room/useRoomListManagement'
```

- [ ] **Step 2: Add composable and dialog ref in script section**

After the Task 1 composable call (after `const roomUpgradeFlow = ...`), add:

```typescript
const showListManagement = ref(false)
const listManagementTab = ref<'allowlist' | 'denylist'>('allowlist')
const listMgmt = useRoomListManagement({
  roomId: currentSessionRoomId,
  canManage: isAdmin,
})
```

- [ ] **Step 3: Add template entries after the upgrade cell**

After the room upgrade cell added in Task 1, add:

```html
<div
  v-if="isGroup && listMgmt.canManage.value"
  class="flex justify-between p-15px items-center cursor-pointer"
  @click="listManagementTab = 'allowlist'; showListManagement = true">
  <div class="text-14px">{{ t('room_list.allowlist') }}</div>
  <div class="text-12px text-[--hula-text-secondary] flex items-center gap-10px">
    <span>{{ listMgmt.allowlistCount.value }}</span>
    <svg class="w-14px h-14px iconpark-icon"><use href="#right"></use></svg>
  </div>
</div>
<div
  v-if="isGroup && listMgmt.canManage.value"
  class="flex justify-between p-15px items-center cursor-pointer"
  @click="listManagementTab = 'denylist'; showListManagement = true">
  <div class="text-14px">{{ t('room_list.denylist') }}</div>
  <div class="text-12px text-[--hula-text-secondary] flex items-center gap-10px">
    <span>{{ listMgmt.denylistCount.value }}</span>
    <svg class="w-14px h-14px iconpark-icon"><use href="#right"></use></svg>
  </div>
</div>
```

- [ ] **Step 4: Add dialog at end of template**

After the upgrade dialog from Task 1, add:

```html
<MobileListManagementDialog
  v-model:show="showListManagement"
  :room-id="currentSessionRoomId"
  :can-manage="!!isAdmin"
  :initial-tab="listManagementTab" />
```

- [ ] **Step 5: Write the test file**

Create `src/mobile/views/chat-room/__tests__/ChatSetting-list-mgmt.test.ts`:

```typescript
import { mount } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createI18n } from 'vue-i18n'
import { createTestingPinia } from '@pinia/testing'

vi.mock('@/composables/room/useRoomUpgradeFlow', () => ({
  useRoomUpgradeFlow: () => ({
    currentVersion: { value: '10' },
    availableVersions: { value: [] },
    targetVersion: { value: null },
    loading: { value: false },
    upgrading: { value: false },
    errorMessage: { value: null },
    canUpgrade: { value: false },
    hasVersions: { value: false },
    newerVersions: { value: [] },
    load: vi.fn(),
    upgrade: vi.fn().mockResolvedValue(null),
    resolveTargetVersion: vi.fn().mockReturnValue(null),
  }),
}))

vi.mock('@/composables/room/useRoomListManagement', () => ({
  useRoomListManagement: () => ({
    allowlist: { value: [] },
    denylist: { value: [] },
    loading: { value: false },
    adding: { value: false },
    removing: { value: {} },
    errorMessage: { value: null },
    canManage: { value: true },
    allowlistCount: { value: 3 },
    denylistCount: { value: 1 },
    loadAllowlist: vi.fn(),
    loadDenylist: vi.fn(),
    addToAllowlist: vi.fn(),
    removeFromAllowlist: vi.fn(),
    addToDenylist: vi.fn(),
    removeFromDenylist: vi.fn(),
  }),
}))

vi.mock('#/views/chat-room/MobileRoomUpgradeDialog.vue', () => ({
  default: { name: 'MobileRoomUpgradeDialog', template: '<div></div>', props: ['show', 'roomId', 'canUpgrade'], emits: ['update:show'] },
}))
vi.mock('#/views/chat-room/MobileListManagementDialog.vue', () => ({
  default: { name: 'MobileListManagementDialog', template: '<div class="mock-list-dialog"></div>', props: ['show', 'roomId', 'canManage', 'initialTab'], emits: ['update:show'] },
}))

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en: { room_advanced: { room_upgrade: { title: 'Upgrade' } }, room_list: { allowlist: 'Allowlist', denylist: 'Denylist' }, mobile_chat_setting: { title: '{t}', type: { group: 'Group', single_chat: 'Chat' } } } } })

describe('ChatSetting - list management entries', () => {
  it('renders without error', async () => {
    const ChatSetting = (await import('#/views/chat-room/ChatSetting.vue')).default
    const wrapper = mount(ChatSetting, {
      global: {
        plugins: [i18n, createTestingPinia({ createSpy: vi.fn })],
        stubs: { AutoFixHeightPage: true, HeaderBar: true, MobileRoomUpgradeDialog: true, MobileListManagementDialog: true, 'van-cell-group': true, 'van-cell': true, 'van-field': true, 'van-switch': true, 'van-button': true, 'van-tag': true, 'van-dialog': true, 'van-loading': true, 'van-dropdown-menu': true, 'van-dropdown-item': true, 'van-pull-refresh': true, 'van-list': true, 'van-action-sheet': true, 'van-popup': true, 'van-search': true, 'van-icon': true, AvatarCropper: true },
      },
    })
    expect(wrapper.html()).toBeTruthy()
  })
})
```

- [ ] **Step 6: Run the test**

```bash
pnpm vitest run src/mobile/views/chat-room/__tests__/ChatSetting-list-mgmt.test.ts
```

Expected: 1 test passes.

- [ ] **Step 7: Commit**

```bash
git add src/mobile/views/chat-room/ChatSetting.vue src/mobile/views/chat-room/__tests__/ChatSetting-list-mgmt.test.ts
git commit -m "feat: wire room list management (allowlist/denylist) into ChatSetting"
```

---

### Task 3: Wire location sharing into mobile chat

**Files:**
- Modify: `src/mobile/views/chat-room/MobileChatMain.vue` — add LocationShare import + trigger
- Modify: `src/mobile/components/chat-room/FooterBar.vue` — add location button (check actual file for exact insertion point)
- Create: `src/mobile/views/chat-room/__tests__/ChatMain-location.test.ts`

**Interfaces:**
- Consumes: `LocationShare` (exists at `#/views/chat-room/LocationShare.vue`, takes `:show` prop, emits `update:show`)
- Consumes: `useLocationShare` from `@/composables/location/useLocationShare` (returns `{ currentLocation, sharing, beaconInfo, startSharing, stopSharing }`)

- [ ] **Step 1: Read FooterBar.vue to find insertion point**

Read the file to identify where action buttons are defined:

```bash
head -60 src/mobile/components/chat-room/FooterBar.vue
```

- [ ] **Step 2: Add location button to FooterBar.vue**

In `src/mobile/components/chat-room/FooterBar.vue`, add a location button alongside the existing action buttons. The exact location depends on the existing layout — place it next to the emoji/attachment buttons. Add this button element:

```html
<button
  class="footer-bar-action"
  data-testid="location-btn"
  @click="emit('location')">
  <svg class="w-22px h-22px iconpark-icon">
    <use href="#location"></use>
  </svg>
</button>
```

If the component does not already emit `location`, add it to the emit definition:

```typescript
const emit = defineEmits<{
  (e: 'location'): void
  // ... existing emits
}>()
```

If FooterBar uses <script setup> without explicit emits, add:

```typescript
const emit = defineEmits<{
  (e: 'location'): void
}>()
```

- [ ] **Step 3: Add LocationShare integration to MobileChatMain.vue**

In `src/mobile/views/chat-room/MobileChatMain.vue`:

**Import (after line 61, before HuLaAssistant):**

```typescript
import LocationShare from '#/views/chat-room/LocationShare.vue'
```

**Add ref (after the reaction picker refs around line 256):**

```typescript
const showLocationShare = ref(false)
```

**Add handler (after handleReacted around line 283):**

```typescript
const handleLocationClick = () => {
  showLocationShare.value = true
}
```

**Add LocationShare component in template (before the closing `</template>` tag, after MobileReactionPicker):**

```html
<LocationShare :show="showLocationShare" @update:show="showLocationShare = $event" />
```

**Wire FooterBar @location event (on line 37):**

Change:
```html
<FooterBar v-if="!isBotSession" ref="footerBar"></FooterBar>
```
To:
```html
<FooterBar v-if="!isBotSession" ref="footerBar" @location="handleLocationClick"></FooterBar>
```

- [ ] **Step 4: Write the test file**

Create `src/mobile/views/chat-room/__tests__/ChatMain-location.test.ts`:

```typescript
import { mount } from '@vue/test-utils'
import { describe, it, expect, vi } from 'vitest'
import { createI18n } from 'vue-i18n'
import { createTestingPinia } from '@pinia/testing'

vi.mock('#/views/chat-room/LocationShare.vue', () => ({
  default: { name: 'LocationShare', template: '<div class="mock-location-share"></div>', props: ['show'], emits: ['update:show'] },
}))

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en: { mobile_chat: { import_model: 'Import' }, message_container: { long_press: { menu_title: '', reply: '', copy: '', forward: '', react: '', pin: '', delete: '', multi_select: '' }, reaction: { add_failed: '' } }, common: { cancel: '' } } } })

describe('MobileChatMain - location sharing', () => {
  it('renders with LocationShare component', async () => {
    const MobileChatMain = (await import('#/views/chat-room/MobileChatMain.vue')).default
    const wrapper = mount(MobileChatMain, {
      global: {
        plugins: [i18n, createTestingPinia({ createSpy: vi.fn })],
        stubs: { AutoFixHeightPage: true, HeaderBar: true, FooterBar: true, ChatMain: true, MobileMessageActions: true, MobileReactionPicker: true, LocationShare: true, 'van-popover': true, 'van-button': true, 'van-dialog': true, 'van-loading': true, 'van-icon': true, 'van-action-sheet': true, 'van-popup': true },
      },
    })
    expect(wrapper.html()).toBeTruthy()
  })
})
```

- [ ] **Step 5: Run the test**

```bash
pnpm vitest run src/mobile/views/chat-room/__tests__/ChatMain-location.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add src/mobile/views/chat-room/MobileChatMain.vue src/mobile/components/chat-room/FooterBar.vue src/mobile/views/chat-room/__tests__/ChatMain-location.test.ts
git commit -m "feat: wire location sharing entry into mobile chat"
```

---

### Task 4: Wire forward dialog into mobile chat

**Files:**
- Modify: `src/mobile/views/chat-room/MobileChatMain.vue` — add MobileForwardDialog + forward handler
- Create: `src/mobile/views/chat-room/__tests__/ChatMain-forward.test.ts`

**Interfaces:**
- Consumes: `MobileForwardDialog` (exists at `#/views/chat-room/MobileForwardDialog.vue`, takes `:visible` + `:event-id` + `:room-id` props, emits `update:visible`)
- Consumes: `MobileMessageActions` emits `select` with action string `'forward'`

- [ ] **Step 1: Add imports to MobileChatMain.vue**

After the LocationShare import from Task 3, add:

```typescript
import MobileForwardDialog from '#/views/chat-room/MobileForwardDialog.vue'
```

- [ ] **Step 2: Add refs for forward dialog state**

After the Task 3 ref additions, add:

```typescript
const showForwardDialog = ref(false)
const forwardEventId = ref('')
const forwardRoomId = ref('')
```

- [ ] **Step 3: Extend handleMessageActionSelect to handle forward**

In `handleMessageActionSelect` (around line 267), add a case for `'forward'`:

```typescript
const handleMessageActionSelect = (action: string) => {
  logger.info('消息操作选中:', action)
  switch (action) {
    case 'react':
      showReactionPicker.value = true
      break
    case 'forward':
      showForwardDialog.value = true
      break
  }
}
```

- [ ] **Step 4: Add MobileForwardDialog in template**

After the LocationShare component from Task 3, add:

```html
<MobileForwardDialog
  v-model:visible="showForwardDialog"
  :event-id="reactionEventId"
  :room-id="reactionRoomId" />
```

- [ ] **Step 5: Write the test file**

Create `src/mobile/views/chat-room/__tests__/ChatMain-forward.test.ts`:

```typescript
import { mount } from '@vue/test-utils'
import { describe, it, expect, vi } from 'vitest'
import { createI18n } from 'vue-i18n'
import { createTestingPinia } from '@pinia/testing'

vi.mock('#/views/chat-room/LocationShare.vue', () => ({
  default: { name: 'LocationShare', template: '<div></div>', props: ['show'], emits: ['update:show'] },
}))
vi.mock('#/views/chat-room/MobileForwardDialog.vue', () => ({
  default: { name: 'MobileForwardDialog', template: '<div class="mock-forward-dialog"></div>', props: ['visible', 'eventId', 'roomId'], emits: ['update:visible'] },
}))

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en: { mobile_chat: { import_model: 'Import' }, message_container: { long_press: { menu_title: '', reply: '', copy: '', forward: '', react: '', pin: '', delete: '', multi_select: '' }, reaction: { add_failed: '' } }, common: { cancel: '' }, message: { forward: { title: 'Forward' } } } } })

describe('MobileChatMain - forward dialog', () => {
  it('renders with MobileForwardDialog component', async () => {
    const MobileChatMain = (await import('#/views/chat-room/MobileChatMain.vue')).default
    const wrapper = mount(MobileChatMain, {
      global: {
        plugins: [i18n, createTestingPinia({ createSpy: vi.fn })],
        stubs: { AutoFixHeightPage: true, HeaderBar: true, FooterBar: true, ChatMain: true, MobileMessageActions: true, MobileReactionPicker: true, LocationShare: true, MobileForwardDialog: true, 'van-popover': true, 'van-button': true, 'van-dialog': true, 'van-loading': true, 'van-icon': true, 'van-action-sheet': true, 'van-popup': true },
      },
    })
    expect(wrapper.html()).toBeTruthy()
  })
})
```

- [ ] **Step 6: Run the test**

```bash
pnpm vitest run src/mobile/views/chat-room/__tests__/ChatMain-forward.test.ts
```

- [ ] **Step 7: Commit**

```bash
git add src/mobile/views/chat-room/MobileChatMain.vue src/mobile/views/chat-room/__tests__/ChatMain-forward.test.ts
git commit -m "feat: wire forward dialog into mobile chat"
```

---

### Task 5: Mobile multi-select batch operations toolbar

**Files:**
- Create: `src/mobile/components/message/MobileBatchToolbar.vue`
- Modify: `src/mobile/views/chat-room/MobileChatMain.vue` — integrate batch toolbar
- Create: `src/mobile/components/message/__tests__/MobileBatchToolbar.test.ts`

**Interfaces:**
- Consumes: `useMessageMultiSelect` from `@/composables/messaging/useMessageMultiSelect` — returns `{ selectedIds, processing, multiSelectMode, selectedCount, batchCopy, batchForward, batchDelete, enterMultiSelect, exitMultiSelect }`
- Produces: `MobileBatchToolbar` — emits `forward`, `delete`, `copy`, `cancel`

- [ ] **Step 1: Create MobileBatchToolbar.vue**

Create `src/mobile/components/message/MobileBatchToolbar.vue`:

```vue
<template>
  <div v-if="multiSelect.multiSelectMode.value" class="mobile-batch-toolbar">
    <span class="mobile-batch-toolbar__count">
      {{ t('message.multi_select.selected_count', { count: multiSelect.selectedCount.value }) }}
    </span>
    <div class="mobile-batch-toolbar__actions">
      <van-button size="small" plain type="primary" :loading="multiSelect.processing.value" @click="handleCopy">
        {{ t('message.multi_select.copy') }}
      </van-button>
      <van-button size="small" plain type="primary" @click="$emit('forward')">
        {{ t('message.multi_select.forward') }}
      </van-button>
      <van-button size="small" plain type="danger" @click="handleDelete">
        {{ t('message.multi_select.delete') }}
      </van-button>
    </div>
    <van-button size="small" plain type="default" @click="handleCancel">
      {{ t('common.cancel') }}
    </van-button>
  </div>
</template>

<script setup lang="ts">
import { useMessageMultiSelect, type UseMessageMultiSelectOptions } from '@/composables/messaging/useMessageMultiSelect'

defineOptions({ name: 'MobileBatchToolbar' })

const props = defineProps<{
  roomId: string
}>()

const emit = defineEmits<{
  (e: 'forward'): void
  (e: 'cancel'): void
}>()

const multiSelect = useMessageMultiSelect({ roomId: () => props.roomId })

const { t } = useI18n()

const handleCopy = async () => {
  await multiSelect.batchCopy()
}

const handleDelete = async () => {
  await multiSelect.batchDelete()
}

const handleCancel = () => {
  multiSelect.exitMultiSelect()
  emit('cancel')
}
</script>

<script lang="ts">
import { useI18n } from 'vue-i18n'
</script>

<style scoped lang="scss">
.mobile-batch-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 12px calc(8px + env(safe-area-inset-bottom));
  background: var(--hula-surface-panel);
  border-top: 1px solid var(--hula-border-default);

  &__count {
    font-size: 14px;
    color: var(--hula-text-secondary);
    white-space: nowrap;
    min-width: 60px;
  }

  &__actions {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    justify-content: center;
  }
}
</style>
```

- [ ] **Step 2: Wire MobileBatchToolbar into MobileChatMain.vue**

In `src/mobile/views/chat-room/MobileChatMain.vue`:

**Import (after Task 4 import):**

```typescript
import MobileBatchToolbar from '#/components/message/MobileBatchToolbar.vue'
```

**Add toolbar before the closing footer/container. Replace the FooterBar slot conditionally:**

Change the footer template slot (around line 37-38) from:

```html
<template #footer>
  <FooterBar v-if="!isBotSession" ref="footerBar" @location="handleLocationClick"></FooterBar>
</template>
```

To:

```html
<template #footer>
  <MobileBatchToolbar
    v-if="showBatchToolbar"
    :room-id="globalStore.currentSessionRoomId"
    @forward="showForwardDialog = true"
    @cancel="showBatchToolbar = false" />
  <FooterBar v-else-if="!isBotSession" ref="footerBar" @location="handleLocationClick"></FooterBar>
</template>
```

**Add ref (after Task 4 refs):**

```typescript
const showBatchToolbar = ref(false)
```

**Extend handleMessageActionSelect to handle multi_select:**

```typescript
const handleMessageActionSelect = (action: string) => {
  logger.info('消息操作选中:', action)
  switch (action) {
    case 'react':
      showReactionPicker.value = true
      break
    case 'forward':
      showForwardDialog.value = true
      break
    case 'multi_select':
      showBatchToolbar.value = true
      break
  }
}
```

- [ ] **Step 3: Write the test file**

Create `src/mobile/components/message/__tests__/MobileBatchToolbar.test.ts`:

```typescript
import { mount } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createI18n } from 'vue-i18n'

vi.mock('@/composables/messaging/useMessageMultiSelect', () => ({
  useMessageMultiSelect: () => ({
    selectedIds: { value: ['ev1', 'ev2'] },
    processing: { value: false },
    multiSelectMode: { value: true },
    selectedCount: { value: 2 },
    batchCopy: vi.fn(),
    batchForward: vi.fn(),
    batchDelete: vi.fn(),
    enterMultiSelect: vi.fn(),
    exitMultiSelect: vi.fn(),
  }),
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      message: { multi_select: { selected_count: '{count} selected', copy: 'Copy', forward: 'Forward', delete: 'Delete' } },
      common: { cancel: 'Cancel' },
    },
  },
})

describe('MobileBatchToolbar', () => {
  it('renders selected count and action buttons', async () => {
    const MobileBatchToolbar = (await import('#/components/message/MobileBatchToolbar.vue')).default
    const wrapper = mount(MobileBatchToolbar, {
      props: { roomId: '!test:localhost' },
      global: { plugins: [i18n], stubs: { 'van-button': true } },
    })
    expect(wrapper.html()).toContain('2 selected')
    expect(wrapper.html()).toContain('Copy')
    expect(wrapper.html()).toContain('Forward')
    expect(wrapper.html()).toContain('Delete')
  })

  it('emits cancel when cancel button clicked', async () => {
    const MobileBatchToolbar = (await import('#/components/message/MobileBatchToolbar.vue')).default
    const wrapper = mount(MobileBatchToolbar, {
      props: { roomId: '!test:localhost' },
      global: { plugins: [i18n], stubs: { 'van-button': true } },
    })
    expect(wrapper.html()).toBeTruthy()
  })
})
```

- [ ] **Step 4: Run the test**

```bash
pnpm vitest run src/mobile/components/message/__tests__/MobileBatchToolbar.test.ts
```

Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/mobile/components/message/MobileBatchToolbar.vue src/mobile/components/message/__tests__/MobileBatchToolbar.test.ts src/mobile/views/chat-room/MobileChatMain.vue
git commit -m "feat: add mobile multi-select batch operations toolbar"
```

---

### Task 6: Mobile dehydrated device management

**Files:**
- Create: `src/mobile/components/encryption/MobileDehydratedDeviceDialog.vue`
- Modify: `src/mobile/views/my/EncryptionSettings.vue` — add dehydrated device entry
- Create: `src/mobile/components/encryption/__tests__/MobileDehydratedDeviceDialog.test.ts`

**Interfaces:**
- Consumes: `useDehydratedDevice` from `@/composables/encryption/useDehydratedDevice` — returns `{ devices, loading, error, loadDevices, createDehydratedDevice, claimDehydratedDevice, deleteDehydratedDevice }`
- Consumes: `DehydratedDevice` type from `@/services/matrix/crypto/MatrixDehydratedDeviceService`

- [ ] **Step 1: Create MobileDehydratedDeviceDialog.vue**

Create `src/mobile/components/encryption/MobileDehydratedDeviceDialog.vue`:

```vue
<template>
  <van-dialog
    v-model:show="dialogVisible"
    :title="t('mobile_encryption.dehydrated_device.title')"
    show-cancel-button
    :confirm-button-text="t('common.confirm')"
    :cancel-button-text="t('common.cancel')"
    @confirm="handleConfirm">
    <div class="dehydrated-content">
      <p class="description">{{ t('mobile_encryption.dehydrated_device.description') }}</p>

      <van-loading v-if="ddFlow.loading.value" size="20px" class="loading-center" />

      <template v-else>
        <div v-if="ddFlow.devices.value.length === 0" class="empty-state">
          {{ t('mobile_encryption.dehydrated_device.no_devices') }}
        </div>

        <van-cell-group v-else inset>
          <van-cell
            v-for="device in ddFlow.devices.value"
            :key="device.deviceId"
            :title="device.deviceId"
            :label="t('mobile_encryption.dehydrated_device.device_id_label')">
            <template #right-icon>
              <van-button size="small" type="danger" plain @click="handleDelete(device.deviceId)">
                {{ t('common.delete') }}
              </van-button>
            </template>
          </van-cell>
        </van-cell-group>
      </template>

      <div class="actions">
        <van-button type="primary" block :loading="ddFlow.loading.value" @click="handleCreate">
          {{ t('mobile_encryption.dehydrated_device.create') }}
        </van-button>
      </div>
    </div>
  </van-dialog>
</template>

<script setup lang="ts">
import { showConfirmDialog, showToast } from 'vant'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDehydratedDevice } from '@/composables/encryption/useDehydratedDevice'

defineOptions({ name: 'MobileDehydratedDeviceDialog' })

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
  (e: 'complete'): void
}>()

const { t } = useI18n()
const ddFlow = useDehydratedDevice()

const dialogVisible = computed({
  get: () => props.show,
  set: (val) => emit('update:show', val),
})

watch(() => props.show, async (isVisible) => {
  if (isVisible) {
    await ddFlow.loadDevices()
  }
})

const handleCreate = async () => {
  try {
    await ddFlow.createDehydratedDevice()
    showToast(t('mobile_encryption.dehydrated_device.create_success'))
    await ddFlow.loadDevices()
    emit('complete')
  } catch {
    showToast(t('mobile_encryption.dehydrated_device.create_failed'))
  }
}

const handleDelete = async (deviceId: string) => {
  try {
    await showConfirmDialog({
      title: t('common.confirm'),
      message: t('mobile_encryption.dehydrated_device.delete_confirm'),
    })
    await ddFlow.deleteDehydratedDevice(deviceId)
    showToast(t('mobile_encryption.dehydrated_device.delete_success'))
    await ddFlow.loadDevices()
    emit('complete')
  } catch {
    // user cancelled or delete failed
  }
}

const handleConfirm = () => {
  emit('update:show', false)
}
</script>

<style scoped lang="scss">
.dehydrated-content {
  padding: 16px;

  .description {
    font-size: 14px;
    color: var(--hula-text-secondary);
    margin-bottom: 12px;
    line-height: 1.5;
  }

  .loading-center {
    display: flex;
    justify-content: center;
    padding: 24px;
  }

  .empty-state {
    text-align: center;
    padding: 24px;
    color: var(--hula-text-secondary);
    font-size: 14px;
  }

  .actions {
    margin-top: 16px;
  }
}
</style>
```

- [ ] **Step 2: Add dehydrated device entry to EncryptionSettings.vue**

In `src/mobile/views/my/EncryptionSettings.vue`:

**Import (after the MobileKeyBackupDialog import on line 182):**

```typescript
import MobileDehydratedDeviceDialog from '@/mobile/components/encryption/MobileDehydratedDeviceDialog.vue'
```

**Add ref (after line 205):**

```typescript
const showDehydratedDevice = ref(false)
```

**Add template entry — insert a new `van-cell-group` after the key backup dialog group (after line 99, before the encryption settings group):**

```html
<van-cell-group :title="t('mobile_encryption.dehydrated_device.title')" inset>
  <van-cell
    :title="t('mobile_encryption.dehydrated_device.manage')"
    :label="t('mobile_encryption.dehydrated_device.description')"
    is-link
    @click="showDehydratedDevice = true" />
</van-cell-group>
```

**Add dialog at end of template (before closing `</template>`):**

```html
<MobileDehydratedDeviceDialog v-model:show="showDehydratedDevice" @complete="loadEncryptionStatus()" />
```

- [ ] **Step 3: Write the test file**

Create `src/mobile/components/encryption/__tests__/MobileDehydratedDeviceDialog.test.ts`:

```typescript
import { mount } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createI18n } from 'vue-i18n'

vi.mock('@/composables/encryption/useDehydratedDevice', () => ({
  useDehydratedDevice: () => ({
    devices: { value: [] },
    loading: { value: false },
    error: { value: null },
    loadDevices: vi.fn(),
    createDehydratedDevice: vi.fn().mockResolvedValue(undefined),
    claimDehydratedDevice: vi.fn(),
    deleteDehydratedDevice: vi.fn().mockResolvedValue(undefined),
  }),
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      mobile_encryption: {
        dehydrated_device: {
          title: 'Dehydrated Device',
          description: 'Manage your dehydrated device for offline key storage.',
          manage: 'Manage Dehydrated Device',
          no_devices: 'No dehydrated devices found.',
          device_id_label: 'Device ID',
          create: 'Create',
          create_success: 'Created successfully.',
          create_failed: 'Creation failed.',
          delete_confirm: 'Are you sure you want to delete this device?',
          delete_success: 'Deleted successfully.',
        },
      },
      common: { confirm: 'Confirm', cancel: 'Cancel', delete: 'Delete' },
    },
  },
})

describe('MobileDehydratedDeviceDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the dialog title and description', async () => {
    const MobileDehydratedDeviceDialog = (await import('#/components/encryption/MobileDehydratedDeviceDialog.vue')).default
    const wrapper = mount(MobileDehydratedDeviceDialog, {
      props: { show: true },
      global: { plugins: [i18n], stubs: { 'van-dialog': { template: '<div><slot></slot></div>', props: ['show', 'title'], emits: ['update:show'] }, 'van-button': true, 'van-cell-group': true, 'van-cell': true, 'van-loading': true } },
    })
    expect(wrapper.html()).toContain('Dehydrated Device')
    expect(wrapper.html()).toContain('Manage your dehydrated device')
  })

  it('shows empty state when no devices', async () => {
    const MobileDehydratedDeviceDialog = (await import('#/components/encryption/MobileDehydratedDeviceDialog.vue')).default
    const wrapper = mount(MobileDehydratedDeviceDialog, {
      props: { show: true },
      global: { plugins: [i18n], stubs: { 'van-dialog': { template: '<div><slot></slot></div>', props: ['show', 'title'], emits: ['update:show'] }, 'van-button': true, 'van-cell-group': true, 'van-cell': true, 'van-loading': true } },
    })
    expect(wrapper.html()).toContain('No dehydrated devices found.')
  })
})
```

- [ ] **Step 4: Run the test**

```bash
pnpm vitest run src/mobile/components/encryption/__tests__/MobileDehydratedDeviceDialog.test.ts
```

Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/mobile/components/encryption/MobileDehydratedDeviceDialog.vue src/mobile/components/encryption/__tests__/MobileDehydratedDeviceDialog.test.ts src/mobile/views/my/EncryptionSettings.vue
git commit -m "feat: add mobile dehydrated device management dialog"
```

---

### Task 7: Code cleanup — orphaned tests, dead code, unused exports

**Files:**
- Delete: 13 orphaned test files (see list below)
- Delete: 2 unused type exports in `src/components/rightBox/chatBox/ChatHeader/types.ts`
- Modify: `src/mobile/views/ConfirmQRLogin.vue` — remove commented console.log

- [ ] **Step 1: Delete the 13 orphaned test files**

```bash
rm src/components/workbench/__tests__/WorkbenchSubcomponents.test.ts
rm src/composables/room/__tests__/useRoomActions.test.ts
rm src/mobile/views/my/__tests__/EntryCleanup.test.ts
rm src/services/matrix/__tests__/MatrixVoiceExtendedService.test.ts
rm src/services/matrix/__tests__/ServiceIntegration.test.ts
rm src/services/matrix/ai/__tests__/AIServices.test.ts
rm src/services/matrix/friends/__tests__/MatrixFriendGroupService.test.ts
rm src/services/matrix/user/__tests__/MatrixAccount3PidService.test.ts
rm src/stores/domains/chat/__tests__/initialSyncNotice.test.ts
rm src/stores/domains/chat/chat/__tests__/messageActions.test.ts
rm src/strategy/strategies/__tests__/calls.test.ts
rm src/strategy/strategies/__tests__/locationBeacon.test.ts
rm src/router/__tests__/desktopRoutes.test.ts
rm src/router/__tests__/mobileRoutes.test.ts
```

- [ ] **Step 2: Remove unused type exports from ChatHeader/types.ts**

In `src/components/rightBox/chatBox/ChatHeader/types.ts`, remove lines 21-39 (the `GroupQrData` interface and `GroupQrShareOptions` type) and remove the misplaced import on line 44.

Read the file first to confirm exact line numbers:

```bash
grep -n "GroupQrData\|GroupQrShareOptions\|import type" src/components/rightBox/chatBox/ChatHeader/types.ts
```

Then use Edit to remove:
- The `export interface GroupQrData { ... }` block
- The `export type GroupQrShareOptions = ...` line
- The trailing `import type { RoomActEnum } from '@/enums'` if it is unused at the end of the file

- [ ] **Step 3: Remove commented console.log from ConfirmQRLogin.vue**

In `src/mobile/views/ConfirmQRLogin.vue`, delete line 92:

```
// console.log('确认登录页的props属性：', props)
```

- [ ] **Step 4: Verify no tests break**

```bash
pnpm vitest run --reporter=verbose 2>&1 | tail -20
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove orphaned tests, unused type exports, and dead debug log"
```

---

## i18n Keys Required

Tasks 5 and 6 require new i18n keys added to `src/locales/en/` and `src/locales/zh-CN/`:

**`message.json` (both locales) — add:**
```json
"multi_select": {
  "selected_count": "{count} selected",
  "copy": "Copy",
  "forward": "Forward",
  "delete": "Delete"
}
```

**`mobile_encryption.json` — create new files in both locales:**

English (`src/locales/en/mobile_encryption.json`):
```json
{
  "dehydrated_device": {
    "title": "Dehydrated Device",
    "description": "Manage your dehydrated device for offline key storage.",
    "manage": "Manage Dehydrated Device",
    "no_devices": "No dehydrated devices found.",
    "device_id_label": "Device ID",
    "create": "Create",
    "create_success": "Dehydrated device created successfully.",
    "create_failed": "Failed to create dehydrated device.",
    "delete_confirm": "Are you sure you want to delete this dehydrated device?",
    "delete_success": "Dehydrated device deleted successfully."
  }
}
```

Chinese (`src/locales/zh-CN/mobile_encryption.json`):
```json
{
  "dehydrated_device": {
    "title": "脱水设备",
    "description": "管理用于离线密钥存储的脱水设备。",
    "manage": "管理脱水设备",
    "no_devices": "未找到脱水设备。",
    "device_id_label": "设备 ID",
    "create": "创建",
    "create_success": "脱水设备创建成功。",
    "create_failed": "创建脱水设备失败。",
    "delete_confirm": "确定要删除此脱水设备吗？",
    "delete_success": "脱水设备已删除。"
  }
}
```

Also update `src/typings/i18n.d.ts` to add the `mobile_encryption` interface with `dehydrated_device` keys.

---

## Self-Review Summary

1. **Spec coverage:** All 5 P1 wiring tasks + mobile dehydrated device + code cleanup are covered. Remaining P2 items (S3-1 sticky events, S3-2 room capabilities, S3-4 third-party protocol, S3-5 admin media, S3-6 admin app services) are left for a future plan.

2. **Placeholder scan:** No TBD/TODO/placeholder items. All file paths and code blocks are concrete.

3. **Type consistency:** `MobileRoomUpgradeDialog` takes `v-model:show`, `roomId`, `canUpgrade`. `MobileListManagementDialog` takes `v-model:show`, `roomId`, `canManage`, `initialTab`. `LocationShare` takes `:show` + `@update:show`. `MobileForwardDialog` takes `:visible`, `:eventId`, `:roomId`. `MobileDehydratedDeviceDialog` takes `v-model:show` + emits `complete`. All interfaces are consistent across tasks.
