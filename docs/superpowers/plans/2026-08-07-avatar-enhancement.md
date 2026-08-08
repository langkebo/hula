# Avatar Feature Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Optimize the main interface avatar feature: fix status indicator redundancy, clean up fake like/moments features, add avatar gallery selection, fix cropper bugs, and plan backend interactions.

**Architecture:** Frontend changes touch 4 existing components (LeftAvatar, UserMenuHeader, AvatarCropper, useAvatarUpload) + 1 new component (AvatarGallery). Backend planning is documentary — Matrix protocol already provides avatar upload/set APIs via MatrixProfileService.setAvatarUrl + MatrixMediaService.uploadImage. Avatar history requires a new synapse-rust extension (out of scope for code, documented as plan).

**Tech Stack:** Vue 3 Composition API, TypeScript, Naive UI, UnoCSS, Matrix JS SDK (local), Tauri v2, Vitest, Biome

## Global Constraints

- UI design system must use project token `--tjg-*`; hard-coded colors forbidden (AGENTS.md)
- UI elements must use SVG instead of div-based icons (AGENTS.md)
- Components exceeding 800 lines must be split (AGENTS.md)
- TypeScript version must be 6.0.3 (vue-tsc compatibility)
- All Matrix SDK calls must go through service classes in `src/services/matrix/`
- Refactoring gate: `pnpm vue-tsc --noEmit` + `pnpm test:run` + `pnpm check:ratchet` must pass
- Online status color tokens: `--tjg-status-online`, `--tjg-status-away`, `--tjg-status-busy`, `--tjg-status-offline`
- Avatar library path: `public/avatar/001-022.webp` (22 built-in avatars)

---

## File Structure

### Files Modified
- `src/layout/left/components/LeftAvatar.vue` (131 lines) — Remove like/moments, simplify status dot
- `src/components/userMenu/UserMenuHeader.vue` (250 lines) — Remove duplicate status Icon (double dot bug)
- `src/components/common/AvatarCropper.vue` (262 lines) — Fix cropperRef type, image display, close buttons
- `src/composables/user/useAvatarUpload.ts` (168 lines) — Add avatar gallery source support
- `src/views/settingsWindow/tabs/AccountSettings.vue` — Wire gallery into avatar change entry

### Files Created
- `src/components/common/AvatarGallery.vue` — Avatar library picker (22 built-in webp avatars)
- `src/composables/user/useAvatarGallery.ts` — Gallery selection logic + tests
- `src/components/common/__tests__/AvatarGallery.test.ts` — Component tests
- `src/composables/user/__tests__/useAvatarGallery.test.ts` — Logic tests

### Backend Planning (documentary only)
- `docs/avatar-backend-api.md` — Avatar upload/save/update/get/fetch API contract + history design

---

## Phase 1: Status Indicator Optimization

### Task 1: Remove duplicate status dot in UserMenuHeader.vue

**Files:**
- Modify: `src/components/userMenu/UserMenuHeader.vue:8-10`

**Interfaces:**
- Consumes: `userStatusStore.stateId` (online/away/busy/offline)
- Produces: Single background-color dot (no Icon overlay)

**Root Cause:** `status-indicator` div has both `background-color` (statusStyle) AND inner `<Icon icon="mdi:circle">` (statusIcon) — renders two overlapping dots.

- [ ] **Step 1: Read current status-indicator implementation**

Current code (line 8-10):
```vue
<div class="status-indicator" :class="statusClass" :style="statusStyle">
  <Icon :icon="statusIcon" :width="10" />
</div>
```

- [ ] **Step 2: Remove inner Icon, keep single background-color dot**

Replace with:
```vue
<div class="status-indicator" :class="statusClass" :style="statusStyle" />
```

- [ ] **Step 3: Verify statusIcon computed is still used by header button**

`statusIcon` (line 101-104) is also used by the status-toggle button (line 22). Keep the computed — only remove the inner Icon from status-indicator.

- [ ] **Step 4: Run type check + lint**

Run: `pnpm vue-tsc --noEmit && pnpm check`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add src/components/userMenu/UserMenuHeader.vue
git commit -m "fix(avatar): remove duplicate status dot in UserMenuHeader"
```

---

### Task 2: Simplify LeftAvatar.vue status dot to single white online indicator

**Files:**
- Modify: `src/layout/left/components/LeftAvatar.vue:23-27`

**Interfaces:**
- Consumes: `useOnlineStatus()` → `statusIcon`, `statusTitle`, `statusBgColor`
- Produces: Single white dot for online state (per spec "仅保留单个白色圆点用于表示用户在线状态")

**Current Code (line 23-27):**
```vue
<div
  class="bg-[--left-bg-color] text-[var(--text-xs)] rounded-50% size-12px absolute bottom--2px right--2px border-(2px solid [--left-bg-color])"
  @click.stop="openContent(t('home.profile_card.online_status'), 'onlineStatus', 320, 480)">
  <img :src="statusIcon" :alt="statusTitle" class="rounded-50% size-full" />
</div>
```

Current uses an `<img>` with `statusIcon` URL inside a colored div — complex and inconsistent with "single white dot" requirement.

- [ ] **Step 1: Replace with single white dot for online indicator**

Replace line 23-27 with:
```vue
<div
  class="rounded-50% size-10px absolute bottom--2px right--2px border-(2px solid [--left-bg-color]) bg-[--tjg-status-online]"
  :title="statusTitle"
  @click.stop="openContent(t('home.profile_card.online_status'), 'onlineStatus', 320, 480)" />
```

- Use `--tjg-status-online` token (green for online). When offline, the dot will be hidden via `v-if` (Step 2).
- Keep click handler to open online status selector.
- Remove `<img>` tag (no more statusIcon image).

- [ ] **Step 2: Only show dot when user is online**

Wrap the dot with `v-if="isOnline"`:
```vue
<div
  v-if="isOnline"
  class="rounded-50% size-10px absolute bottom--2px right--2px border-(2px solid [--left-bg-color]) bg-[--tjg-status-online]"
  :title="statusTitle"
  @click.stop="openContent(t('home.profile_card.online_status'), 'onlineStatus', 320, 480)" />
```

Add `isOnline` computed in `<script setup>`:
```ts
const isOnline = computed(() => userStatusStore.stateId === 'online')
```

Import `useUserStatusStore`:
```ts
import { useUserStatusStore } from '@/stores/domains/user/userStatus'
const userStatusStore = useUserStatusStore()
```

- [ ] **Step 3: Keep the inner statusIcon in the popover info card (line 56) unchanged**

Line 56 `<img :src="statusIcon" ... />` is inside the popover card (different context, shows full status icon + title). Leave as-is.

- [ ] **Step 4: Run type check**

Run: `pnpm vue-tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add src/layout/left/components/LeftAvatar.vue
git commit -m "fix(avatar): simplify LeftAvatar status dot to single online indicator"
```

---

## Phase 2: Clean Up Fake Like/Moments Features

### Task 3: Remove fake "like" feature from LeftAvatar.vue

**Files:**
- Modify: `src/layout/left/components/LeftAvatar.vue:62-65`

**Current Code (line 62-65) — fake like with hardcoded "9999+":**
```vue
<n-flex :size="5" align="center" class="item-hover" vertical>
  <svg class="size-20px"><use href="#thumbs-up"></use></svg>
  <span class="text-[var(--text-sm)]">9999+</span>
</n-flex>
```

- [ ] **Step 1: Remove the fake like block**

Delete lines 62-65 entirely. The parent `<n-flex :size="25" align="center" justify="space-between">` (line 37) now only contains the user info block — change `justify="space-between"` to `justify="start"` since there's no longer a right-side element.

- [ ] **Step 2: Verify no broken references to `#thumbs-up` icon**

Search for `thumbs-up` usage in the project:
Run: `grep -r "thumbs-up" src/` 
Expected: Only in icon sprite definition, not in other components. If unused elsewhere, leave the sprite (sprite cleanup is out of scope).

- [ ] **Step 3: Commit**

```bash
git add src/layout/left/components/LeftAvatar.vue
git commit -m "refactor(avatar): remove fake like feature from profile card"
```

---

### Task 4: Remove fake "moments/activities" feature from LeftAvatar.vue

**Files:**
- Modify: `src/layout/left/components/LeftAvatar.vue:73-86`

**Current Code (line 73-86) — fake moments with external placeholder images:**
```vue
<n-flex :size="40" class="select-none">
  <span class="text-[--info-text-color]">{{ t('home.profile_card.labels.activities') }}</span>
  <n-image-group>
    <n-flex :class="shrinkStatus ? 'overflow-hidden w-180px' : ''" :size="6" :wrap="false">
      <n-image
        v-for="n in 4"
        :key="n"
        class="rounded-8px"
        preview-disabled
        src="https://07akioni.oss-cn-beijing.aliyuncs.com/07akioni.jpeg"
        width="50" />
    </n-flex>
  </n-image-group>
</n-flex>
```

Uses external Aliyun OSS placeholder images — fake data with no backend.

- [ ] **Step 1: Remove the fake moments block**

Delete lines 73-86 entirely.

- [ ] **Step 2: Also remove the location block if it's fake (verify)**

Check line 68-71 (location block). `currentUserLocation` (line 116-120) reads from `groupStore.getUserInfo(uid)?.locPlace`. Verify if `locPlace` is real backend data or placeholder. If real, keep it. If placeholder, remove.

Run: `grep -r "locPlace" src/`
If `locPlace` is set by real backend events, keep the location block. If only ever undefined, remove lines 68-71 too.

- [ ] **Step 3: Run type check**

Run: `pnpm vue-tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add src/layout/left/components/LeftAvatar.vue
git commit -m "refactor(avatar): remove fake moments feature from profile card"
```

---

### Task 5: Document backend features that SHOULD be implemented in the profile card

**Files:**
- Create: `docs/avatar-backend-api.md`

**Research Results (from backend review):**

Current backend capabilities (already working):
- `MatrixProfileService.setAvatarUrl(mxcUrl)` — Matrix protocol avatar update
- `MatrixProfileService.getProfile(userId)` — fetch displayname + avatar_url
- `MatrixProfileService.getExtendedProfile(userId)` — synapse-rust extension: sex, resume, region, birthday
- `MatrixPresenceService.setPresence(status)` — online/away/busy/offline presence
- `MatrixMediaService.uploadImage(file)` — upload to homeserver, returns mxc:// URI

Features NOT yet implemented (require backend work, out of code scope):

| Feature | Backend Requirement | Priority |
|:---|:---|:---|
| Real "like" count | New synapse-rust extension: `POST /_matrix/client/unstable/io.tjg.profile/like` + storage table | Low (social feature, not core IM) |
| Real "moments" feed | New synapse-rust extension: moments table + `GET /_matrix/client/unstable/io.tjg.moments` + media upload | Low (social feature) |
| Avatar change history | New synapse-rust extension: `avatar_history` table (user_id, old_mxc, new_mxc, timestamp) + `GET /_matrix/client/unstable/io.tjg.avatar/history` | Medium (audit trail) |
| Online status sync | Already works via Matrix presence. Frontend listens to `m.presence` events. No new backend needed. | Done |
| Location display | `locPlace` field — verify if synapse-rust stores user location. Likely not implemented. | Low |

- [ ] **Step 1: Write the backend API doc**

Create `docs/avatar-backend-api.md` with the table above + API contract sketches for each future feature. This is documentary — no code changes.

- [ ] **Step 2: Commit**

```bash
git add docs/avatar-backend-api.md
git commit -m "docs: plan backend avatar/profile API extensions"
```

---

## Phase 3: Avatar Gallery Selection

### Task 6: Create useAvatarGallery composable with tests (TDD)

**Files:**
- Create: `src/composables/user/useAvatarGallery.ts`
- Test: `src/composables/user/__tests__/useAvatarGallery.test.ts`

**Interfaces:**
- Produces: `avatarList: ComputedRef<GalleryAvatar[]>`, `selectAvatar(id: number): string`
- `GalleryAvatar` type: `{ id: number; url: string; name: string }`
- `selectAvatar(id)` returns the webp URL path (e.g. `/avatar/005.webp`)

- [ ] **Step 1: Write the failing test**

```typescript
// src/composables/user/__tests__/useAvatarGallery.test.ts
import { describe, it, expect } from 'vitest'
import { useAvatarGallery } from '../useAvatarGallery'

describe('useAvatarGallery', () => {
  it('returns 22 built-in avatars', () => {
    const { avatarList } = useAvatarGallery()
    expect(avatarList.value).toHaveLength(22)
  })

  it('avatars have sequential ids 1-22 and webp URLs', () => {
    const { avatarList } = useAvatarGallery()
    expect(avatarList.value[0]).toEqual({ id: 1, url: '/avatar/001.webp', name: 'Avatar 1' })
    expect(avatarList.value[21]).toEqual({ id: 22, url: '/avatar/022.webp', name: 'Avatar 22' })
  })

  it('selectAvatar returns the webp URL for given id', () => {
    const { selectAvatar } = useAvatarGallery()
    expect(selectAvatar(5)).toBe('/avatar/005.webp')
    expect(selectAvatar(22)).toBe('/avatar/022.webp')
  })

  it('selectAvatar throws for invalid id', () => {
    const { selectAvatar } = useAvatarGallery()
    expect(() => selectAvatar(0)).toThrow('Invalid avatar id')
    expect(() => selectAvatar(23)).toThrow('Invalid avatar id')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/composables/user/__tests__/useAvatarGallery.test.ts`
Expected: FAIL with "Cannot find module '../useAvatarGallery'"

- [ ] **Step 3: Implement the composable**

```typescript
// src/composables/user/useAvatarGallery.ts
import { computed } from 'vue'

export interface GalleryAvatar {
  id: number
  url: string
  name: string
}

const AVATAR_COUNT = 22
const padId = (id: number) => String(id).padStart(3, '0')

const avatarList = computed<GalleryAvatar[]>(() =>
  Array.from({ length: AVATAR_COUNT }, (_, i) => {
    const id = i + 1
    return { id, url: `/avatar/${padId(id)}.webp`, name: `Avatar ${id}` }
  })
)

function selectAvatar(id: number): string {
  if (id < 1 || id > AVATAR_COUNT || !Number.isInteger(id)) {
    throw new Error(`Invalid avatar id: ${id}. Must be 1-${AVATAR_COUNT}`)
  }
  return `/avatar/${padId(id)}.webp`
}

export function useAvatarGallery() {
  return { avatarList, selectAvatar }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/composables/user/__tests__/useAvatarGallery.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/composables/user/useAvatarGallery.ts src/composables/user/__tests__/useAvatarGallery.test.ts
git commit -m "feat(avatar): add useAvatarGallery composable with built-in avatar library"
```

---

### Task 7: Create AvatarGallery.vue component

**Files:**
- Create: `src/components/common/AvatarGallery.vue`

**Interfaces:**
- Props: `show: boolean`
- Emits: `update:show`, `select: [url: string]`
- Renders: 22 webp avatars in a grid (4 columns), click selects + closes

- [ ] **Step 1: Create the component**

```vue
<template>
  <n-modal
    :show="show"
    @update:show="$emit('update:show', $event)"
    :mask-closable="true"
    class="rounded-8px"
    role="dialog"
    aria-modal="true">
    <div class="bg-[--tjg-surface-elevated] w-440px box-border rounded-8px p-20px flex flex-col">
      <div class="text-14px text-[--tjg-text-primary] mb-12px text-center">
        {{ t('components.avatarGallery.title') }}
      </div>
      <div class="grid grid-cols-5 gap-10px max-h-360px overflow-y-auto">
        <button
          v-for="avatar in avatarList"
          :key="avatar.id"
          class="size-64px rounded-50% overflow-hidden cursor-pointer hover:ring-2 hover:ring-[--tjg-color-primary-500] transition-all"
          :title="avatar.name"
          @click="handleSelect(avatar.url)">
          <img :src="avatar.url" :alt="avatar.name" class="size-full object-cover" loading="lazy" />
        </button>
      </div>
    </div>
  </n-modal>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useAvatarGallery } from '@/composables/user/useAvatarGallery'

const { t } = useI18n()
const { avatarList } = useAvatarGallery()

defineProps<{ show: boolean }>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  select: [url: string]
}>()

function handleSelect(url: string) {
  emit('select', url)
  emit('update:show', false)
}
</script>
```

- [ ] **Step 2: Add i18n key**

Add to locale files (e.g. `src/locales/zh-CN/components.json`):
```json
{
  "avatarGallery": {
    "title": "选择头像"
  }
}
```
And `src/locales/en-US/components.json`:
```json
{
  "avatarGallery": {
    "title": "Choose Avatar"
  }
}
```

- [ ] **Step 3: Run type check + lint**

Run: `pnpm vue-tsc --noEmit && pnpm check`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add src/components/common/AvatarGallery.vue src/locales/
git commit -m "feat(avatar): add AvatarGallery component for built-in avatar selection"
```

---

### Task 8: Integrate gallery into useAvatarUpload + AccountSettings

**Files:**
- Modify: `src/composables/user/useAvatarUpload.ts`
- Modify: `src/views/settingsWindow/tabs/AccountSettings.vue`

**Goal:** Avatar change entry now offers two sources: (1) local upload (existing), (2) gallery selection (new).

- [ ] **Step 1: Add gallery state to useAvatarUpload**

In `useAvatarUpload.ts`, add gallery state + a handler for gallery-selected URLs:

```typescript
// Add after showCropper ref (line 30)
const showGallery = ref(false)

// Handle gallery selection: convert URL to blob and upload
const handleGallerySelect = async (avatarUrl: string) => {
  try {
    // Fetch the webp as blob, then upload via Matrix media
    const response = await fetch(avatarUrl)
    const blob = await response.blob()
    const file = new File([blob], `avatar_${Date.now()}.webp`, { type: 'image/webp' })
    const uploadResult = await matrixMediaService.uploadImage(file)
    const mxcUrl = uploadResult.contentUri
    if (onSuccess) onSuccess(mxcUrl)
    showGallery.value = false
  } catch (error) {
    logger.error('Gallery avatar upload failed:', error)
    showFeedback(t('hooks.avatar_upload.upload_failed'), 'error')
  }
}
```

Return `showGallery` and `handleGallerySelect` from the composable:
```typescript
return {
  fileInput,
  localImageUrl,
  showCropper,
  showGallery,
  cropperRef,
  openFileSelector,
  handleFileChange,
  handleCrop,
  handleGallerySelect,
  openAvatarCropper
}
```

- [ ] **Step 2: Wire gallery into AccountSettings.vue**

In `AccountSettings.vue`, import AvatarGallery and add a "Choose from gallery" button next to the existing "Upload" button:

```vue
<AvatarGallery v-model:show="showGallery" @select="handleGallerySelect" />
<n-button @click="showGallery = true">{{ t('settings.account.avatar.choose_from_gallery') }}</n-button>
```

Destructure `showGallery` and `handleGallerySelect` from `useAvatarUpload()`.

- [ ] **Step 3: Run type check + tests**

Run: `pnpm vue-tsc --noEmit && pnpm vitest run src/composables/user/__tests__/`
Expected: 0 errors, all tests pass

- [ ] **Step 4: Commit**

```bash
git add src/composables/user/useAvatarUpload.ts src/views/settingsWindow/tabs/AccountSettings.vue
git commit -m "feat(avatar): integrate gallery selection into avatar change flow"
```

---

## Phase 4: Cropper Bug Fixes

### Task 9: Fix cropperRef type and image display bug

**Files:**
- Modify: `src/components/common/AvatarCropper.vue:129, 155-171`

**Bug 1 (Type):** `cropperRef` declared as `HTMLElement | null` but used as VueCropper instance.
**Bug 2 (Image not showing):** `watch` sets `localImageUrl` in `nextTick`, but `cropperReady` becomes true before `localImageUrl` is set — race condition.

- [ ] **Step 1: Fix cropperRef type**

Line 129, change:
```typescript
const cropperRef = ref<HTMLElement | null>(null)
```
to:
```typescript
const cropperRef = ref<InstanceType<typeof VueCropperComp> | null>(null)
```

- [ ] **Step 2: Fix image display race condition**

In the `watch` (line 155-171), set `localImageUrl` BEFORE `cropperReady`:

```typescript
watch(
  [() => props.show, () => props.imageUrl],
  ([show, imageUrl]) => {
    if (show && imageUrl) {
      // Set image URL FIRST, then enable cropper after DOM render
      localImageUrl.value = imageUrl
      nextTick(() => {
        cropperReady.value = true
      })
    } else {
      cropperReady.value = false
      localImageUrl.value = ''
      previewUrl.value = null
    }
  },
  { immediate: true }
)
```

- [ ] **Step 3: Fix handleCrop ref cast**

Line 180, simplify (no more `as unknown as`):
```typescript
const cropper = cropperRef.value as VueCropperInstance | null
if (!cropper?.getCropBlob) {
  loading.value = false
  return
}
```

- [ ] **Step 4: Run type check**

Run: `pnpm vue-tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: Manual test — select local image, verify it shows in cropper**

Restart `pnpm td`, go to Settings > Account > click avatar > select local image. Image should appear in cropper immediately.

- [ ] **Step 6: Commit**

```bash
git add src/components/common/AvatarCropper.vue
git commit -m "fix(avatar): fix cropperRef type and image display race condition"
```

---

### Task 10: Fix cancel/X buttons cannot close cropper

**Files:**
- Modify: `src/components/common/AvatarCropper.vue:191-196, 13, 21-24`

**Bug:** `closeWindow` checks `if (!loading.value)` — X button (MacCloseButton/svg) has no `:disabled`, so user can click during loading but `closeWindow` silently does nothing. Also the X svg (line 21-24) uses `<use href="#close">` which may not render on all platforms.

- [ ] **Step 1: Allow close during loading (with confirmation)**

Replace `closeWindow` (line 192-196):
```typescript
const closeWindow = () => {
  if (loading.value) {
    // Uploading in progress — confirm before aborting
    const dialog = useDialog()
    dialog.warning({
      title: t('components.avatarCropper.close_during_upload.title'),
      content: t('components.avatarCropper.close_during_upload.content'),
      positiveText: t('common.confirm'),
      negativeText: t('common.cancel'),
      onPositiveClick: () => {
        emit('update:show', false)
      }
    })
  } else {
    emit('update:show', false)
  }
}
```

Import `useDialog`:
```typescript
import { useDialog } from 'naive-ui'
```

- [ ] **Step 2: Replace X svg with inline SVG (cross-platform)**

Line 19-24, replace the `<svg><use href="#close">` with an inline SVG:
```vue
<svg
  v-if="isWindows()"
  class="size-14px cursor-pointer pt-6px select-none absolute right-6px text-[--tjg-text-secondary] hover:text-[--tjg-text-primary]"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
  @click="closeWindow">
  <line x1="18" y1="6" x2="6" y2="18" />
  <line x1="6" y1="6" x2="18" y2="18" />
</svg>
```

- [ ] **Step 3: Add i18n keys for close-during-upload confirmation**

Add to locale files:
```json
{
  "avatarCropper": {
    "close_during_upload": {
      "title": "上传中",
      "content": "头像正在上传，确定要关闭吗？"
    }
  }
}
```

- [ ] **Step 4: Run type check + manual test**

Run: `pnpm vue-tsc --noEmit`
Manual: Open cropper, click X during upload → confirm dialog appears → confirm closes.

- [ ] **Step 5: Commit**

```bash
git add src/components/common/AvatarCropper.vue src/locales/
git commit -m "fix(avatar): fix cropper close buttons with upload confirmation"
```

---

## Phase 5: Backend Interaction Planning (Documentary)

### Task 11: Document avatar upload/save/update/get API contract

**Files:**
- Update: `docs/avatar-backend-api.md`

**Already-working APIs (no new backend code needed):**

| Operation | Frontend Service | Matrix API | Status |
|:---|:---|:---|:---|
| Upload avatar image | `MatrixMediaService.uploadImage(file)` | `POST /_matrix/media/v3/upload` | Works |
| Set user avatar | `MatrixProfileService.setAvatarUrl(mxc)` | `PUT /_matrix/client/v3/profile/{userId}/avatar_url` | Works |
| Get user avatar | `MatrixProfileService.getAvatarUrl(userId)` | `GET /_matrix/client/v3/profile/{userId}` | Works |
| Convert mxc:// to HTTP | `MatrixClientService.mxcResolver` | `client.mxcUrlToHttp()` | Works (fixed) |
| Set presence | `MatrixPresenceService.setPresence(status)` | `PUT /_matrix/client/v3/presence/{userId}/status` | Works |
| Get presence | `MatrixPresenceService.getPresence(userId)` | `GET /_matrix/client/v3/presence/{userId}/status` | Works |

**Flow: Local image upload → set avatar:**
```
User selects image → useAvatarUpload.handleCrop(blob)
  → MatrixMediaService.uploadImage(file) → returns mxc://
  → onSuccess(mxc) → userStore.updateAvatar(mxc)
  → MatrixProfileService.setAvatarUrl(mxc) → PUT /profile/{userId}/avatar_url
  → Matrix presence event broadcasts avatar change to all devices/contacts
```

**Flow: Gallery selection → set avatar:**
```
User clicks gallery avatar → handleGallerySelect(url)
  → fetch(url) → blob → File
  → MatrixMediaService.uploadImage(file) → mxc://
  → onSuccess(mxc) → same as above
```

- [ ] **Step 1: Write the API contract doc**

Document the two flows above + the API table in `docs/avatar-backend-api.md`.

- [ ] **Step 2: Commit**

```bash
git add docs/avatar-backend-api.md
git commit -m "docs: document avatar upload/save/update API contract"
```

---

### Task 12: Design avatar change history backend storage plan

**Files:**
- Update: `docs/avatar-backend-api.md`

**Design (synapse-rust extension, documentary — implementation requires Rust work):**

**New table: `avatar_history`**
```sql
CREATE TABLE avatar_history (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  old_avatar_url TEXT,
  new_avatar_url TEXT NOT NULL,
  changed_at BIGINT NOT NULL,  -- epoch millis
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(name)
);
CREATE INDEX idx_avatar_history_user ON avatar_history(user_id, changed_at DESC);
```

**New synapse-rust extension API:**
- `GET /_matrix/client/unstable/io.tjg.avatar/history?limit=20` — current user's avatar history
- `GET /_matrix/client/unstable/io.tjg.avatar/history/{userId}` — admin/other user's history (with permissions)

**Frontend integration plan (future, not in this plan's scope):**
- Add `MatrixAvatarHistoryService` in `src/services/matrix/user/`
- Call `setAvatarUrl` hook to also POST to history endpoint
- Show history in Settings > Account > Avatar History gallery

**Why documentary only:** synapse-rust is a separate repo (langkebo/synapse-rust). Backend changes require Rust development + database migration in that repo. This plan documents the contract so future backend work has a clear spec.

- [ ] **Step 1: Append history design to the doc**

- [ ] **Step 2: Commit**

```bash
git add docs/avatar-backend-api.md
git commit -m "docs: design avatar change history backend storage"
```

---

## Self-Review

### Spec Coverage Check
| Spec Requirement | Task |
|:---|:---|
| 1. Status indicator: single white dot for online | Task 1 (UserMenuHeader) + Task 2 (LeftAvatar) |
| 1. Remove redundant dots | Task 1 (remove Icon overlay) |
| 2. Clean like feature | Task 3 |
| 2. Clean moments feature | Task 4 |
| 2. Plan backend features for the page | Task 5 |
| 3. Local image upload (existing, enhance) | Task 8 (wires gallery alongside) |
| 3. Avatar gallery selection (public/avatar) | Tasks 6, 7, 8 |
| 3. Upload/preview/crop/save flow | Existing in useAvatarUpload; fixes in Tasks 9-10 |
| 4. Fix cropper image not showing | Task 9 |
| 4. Fix cancel/X buttons | Task 10 |
| 5. Backend API review + contract | Task 11 |
| 5. Online status sync mechanism | Task 11 (documented as already working) |
| 5. Avatar history storage design | Task 12 |

### Placeholder Scan
- All code blocks contain actual implementation code — no "TODO"/"TBD".
- Task 5 backend feature table uses real service method names from the codebase.
- Task 11/12 API paths follow Matrix convention (`/_matrix/client/v3/` and `/_matrix/client/unstable/io.tjg.*`).

### Type Consistency
- `GalleryAvatar` type defined in Task 6, used in Task 7 — names match.
- `selectAvatar(id: number): string` signature consistent across Tasks 6-7.
- `handleGallerySelect(url: string)` consistent in Task 8.
- `VueCropperInstance` type used in Task 9 matches existing definition in AvatarCropper.vue.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-07-avatar-enhancement.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. Best for this plan since tasks span multiple files and have independent test cycles.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints for review.

**Which approach?**
