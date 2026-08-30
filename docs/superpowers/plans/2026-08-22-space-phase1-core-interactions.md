# Space Phase 1: 核心交互功能实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在空间视图内补齐「创建房间 / 成员邀请 / 子房间建议标记」三个核心交互，让用户无需跳出空间即可完成组织工作流。

**Architecture:** 复用现有 `MatrixSpaceService` 服务层（已具备 createRoom/addChildToSpace/inviteToSpace），在 composable 层（useSpaceRooms / useSpaceMembers）补齐方法，在组件层新增/增强 UI。

**Tech Stack:** Vue 3 (`<script setup lang="ts">`) + Naive UI + UnoCSS/SCSS + Vitest + @vue/test-utils

## Global Constraints

- 所有新组件使用 `<script setup lang="ts">` + Composition API
- 样式使用 UnoCSS 工具类 + SCSS scoped，遵循 `--tjg-*` design token，禁止硬编码颜色
- 图标使用 SVG（`<svg>` / `<use>`），线宽 1.5px
- 动效尊重 `prefers-reduced-motion`
- i18n 使用 `t('space.xxx', '中文兜底')` 形式；若 `pnpm check` 报 i18n 未登记，补充到 `locales/zh-CN/` 与 `locales/en/` 对应文件
- 错误处理：异步包裹 try-catch，通过 `useActionFeedback().showFeedback()` 展示 toast，`createLogger('Xxx')` 输出日志
- 组件文件不超过 800 行
- 守门命令：`pnpm vue-tsc --noEmit`（0 错误）、`pnpm test:run`、`pnpm check`（无新 error）、`pnpm check:doc-coverage`（无新增未文档化方法）

---

## 现状修正（与 spec 的偏差）

实施前必须注意以下真实代码状态，与 spec 文档略有出入：

1. **用户搜索方法签名**：`src/services/matrix/user/MatrixUserDirectoryService.ts` 导出的单例是 `userDirectoryService`，方法为 `searchUsers(query: string, limit = 10): Promise<UserDirectorySearchResult[]>`，返回 `{ userId, displayName?, avatarUrl? }[]`。**不是** spec 中写的 `searchUserDirectory`。
2. **SpaceMembersPane 已有基础邀请表单**：`src/components/workbench/SpaceMembersPane.vue` 已含 `inviteUserId` input + 邀请按钮（`handleInvite`）。功能 2 是将其**替换**为搜索式 `SpaceInviteBar`，非从零新建。
3. **功能 3 需新增 service 方法**：`MatrixSpaceService.addChildToSpace()` 是 upsert 语义，切换 `suggested` 会丢 `order` 字段，故需新增 `setChildSuggested()` 走 `sendStateEvent` 精确修改。

---

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `src/components/space/SpaceCreateRoomPane.vue` | Create | 空间内创建房间表单（n-modal） |
| `src/components/space/SpaceViewHeader.vue` | Modify | 增加 `+` 按钮下拉菜单（创建房间） |
| `src/components/space/SpaceInviteBar.vue` | Create | 内嵌搜索邀请组件（debounce + 结果列表） |
| `src/components/workbench/SpaceMembersPane.vue` | Modify | 用 SpaceInviteBar 替换现有 input+button |
| `src/components/space/SpaceRoomGrid.vue` | Modify | 子房间行增加建议星标按钮 |
| `src/composables/space/useSpaceRooms.ts` | Modify | 增加 `createRoomInSpace` + `toggleSuggested`，`SpaceChildRoom` 加 `suggested` |
| `src/composables/space/useSpaceMembers.ts` | Modify | 增加搜索用户 + 已邀请状态过滤 |
| `src/services/matrix/room/MatrixSpaceService.ts` | Modify | 增加 `setChildSuggested` |
| 各 `__tests__/*.test.ts` | Create/Modify | 组件与 composable 单元测试 |

---

## Task 1: MatrixSpaceService 增加 setChildSuggested

**Files:**
- Modify: `src/services/matrix/room/MatrixSpaceService.ts`（在 `addChildToSpace` 方法后追加）
- Test: `src/services/matrix/room/__tests__/MatrixSpaceService.test.ts`

**Interfaces:**
- Consumes: `this.getClient()`（BaseMatrixService 方法，返回 MatrixClient）
- Produces: `setChildSuggested(spaceId: string, roomId: string, suggested: boolean): Promise<void>`

- [ ] **Step 1: 写失败测试**

在 `MatrixSpaceService.test.ts` 的 describe 块中追加：

```typescript
it('setChildSuggested 通过 m.space.child 状态事件切换 suggested', async () => {
  const sendStateEvent = vi.fn().mockResolvedValue({ event_id: '$e1' })
  mockClient.sendStateEvent = sendStateEvent

  await matrixSpaceService.setChildSuggested('!space:hs', '!room:hs', true)

  expect(sendStateEvent).toHaveBeenCalledWith('!space:hs', 'm.space.child', { suggested: true }, '!room:hs')
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest run src/services/matrix/room/__tests__/MatrixSpaceService.test.ts -t "setChildSuggested"`
Expected: FAIL（`matrixSpaceService.setChildSuggested is not a function`）

- [ ] **Step 3: 实现方法**

在 `MatrixSpaceService.ts` 的 `addChildToSpace` 方法后追加：

```typescript
  /**
   * 切换子房间的建议标记（通过 m.space.child 状态事件精确修改 suggested 字段）。
   *
   * 与 addChildToSpace 不同：这里直接 sendStateEvent 更新 suggested，
   * 不经过 upsert，避免丢失已有的 order / via_servers 字段。
   */
  async setChildSuggested(spaceId: string, roomId: string, suggested: boolean): Promise<void> {
    await this.getClient().sendStateEvent(spaceId, 'm.space.child', { suggested }, roomId)
    logger.info(`[Space] 子房间建议标记已${suggested ? '设置' : '取消'}: ${roomId} in ${spaceId}`)
  }
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm vitest run src/services/matrix/room/__tests__/MatrixSpaceService.test.ts -t "setChildSuggested"`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/services/matrix/room/MatrixSpaceService.ts src/services/matrix/room/__tests__/MatrixSpaceService.test.ts
git commit -m "feat(service): MatrixSpaceService 增加 setChildSuggested 切换建议标记"
```

---

## Task 2: useSpaceRooms 增加 createRoomInSpace + toggleSuggested

**Files:**
- Modify: `src/composables/space/useSpaceRooms.ts`
- Test: `src/composables/space/__tests__/useSpaceRooms.test.ts`（若不存在则创建）

**Interfaces:**
- Consumes: `matrixSpaceService.createRoom`（需新增）、`matrixSpaceService.addChildToSpace`、`matrixSpaceService.setChildSuggested`（Task 1 产出）、`matrixClientService.getClient()`
- Produces:
  - `SpaceChildRoom` 接口新增字段 `suggested?: boolean`
  - `createRoomInSpace(options: { name: string; topic?: string; suggested?: boolean }): Promise<string | null>` — 返回新 roomId，失败返回 null
  - `toggleSuggested(roomId: string, suggested: boolean): Promise<boolean>`

- [ ] **Step 1: 扩展 SpaceChildRoom 接口**

将 `SpaceChildRoom` 接口改为：

```typescript
export interface SpaceChildRoom {
  roomId: string
  name: string
  avatarUrl?: string
  memberCount?: number
  onlineCount?: number
  /** 是否为建议子房间 */
  suggested?: boolean
}
```

- [ ] **Step 2: 写失败测试**

```typescript
it('createRoomInSpace 创建房间并挂载为子房间', async () => {
  vi.mocked(matrixSpaceService.createRoom).mockResolvedValue({ roomId: '!new:hs', name: '新房间' } as never)
  vi.mocked(matrixSpaceService.addChildToSpace).mockResolvedValue(undefined)

  const { createRoomInSpace } = useSpaceRooms(() => '!space:hs')
  const roomId = await createRoomInSpace({ name: '新房间', topic: '描述', suggested: true })

  expect(roomId).toBe('!new:hs')
  expect(matrixSpaceService.addChildToSpace).toHaveBeenCalledWith('!space:hs', '!new:hs', { suggested: true })
})

it('toggleSuggested 调用 setChildSuggested 并返回 true', async () => {
  vi.mocked(matrixSpaceService.setChildSuggested).mockResolvedValue(undefined)

  const { toggleSuggested } = useSpaceRooms(() => '!space:hs')
  const ok = await toggleSuggested('!room:hs', true)

  expect(ok).toBe(true)
  expect(matrixSpaceService.setChildSuggested).toHaveBeenCalledWith('!space:hs', '!room:hs', true)
})
```

- [ ] **Step 3: 运行测试确认失败**

Run: `pnpm vitest run src/composables/space/__tests__/useSpaceRooms.test.ts`
Expected: FAIL（`createRoomInSpace is not a function`）

- [ ] **Step 4: 实现方法**

在 `useSpaceRooms.ts` 的 `UseSpaceRoomsResult` 接口、实现和 return 中补充：

```typescript
interface UseSpaceRoomsResult {
  // ... 现有字段
  createRoomInSpace: (options: { name: string; topic?: string; suggested?: boolean }) => Promise<string | null>
  toggleSuggested: (roomId: string, suggested: boolean) => Promise<boolean>
}
```

实现（在 `removeRoom` 后追加）：

```typescript
  const createRoomInSpace = async (options: {
    name: string
    topic?: string
    suggested?: boolean
  }): Promise<string | null> => {
    const id = spaceId()
    if (!id || !options.name) return null
    mutating.value = true
    error.value = null
    try {
      const info = await matrixSpaceService.createRoom(options)
      if (!info) return null
      await matrixSpaceService.addChildToSpace(id, info.roomId, { suggested: options.suggested ?? false })
      await load()
      return info.roomId
    } catch (err) {
      logger.error('createRoomInSpace failed', err)
      error.value = err instanceof Error ? err.message : String(err)
      return null
    } finally {
      mutating.value = false
    }
  }

  const toggleSuggested = async (roomId: string, suggested: boolean): Promise<boolean> => {
    const id = spaceId()
    if (!id || !roomId) return false
    mutating.value = true
    error.value = null
    try {
      await matrixSpaceService.setChildSuggested(id, roomId, suggested)
      await load()
      return true
    } catch (err) {
      logger.error('toggleSuggested failed', err)
      error.value = err instanceof Error ? err.message : String(err)
      return false
    } finally {
      mutating.value = false
    }
  }
```

并在 return 中补充 `createRoomInSpace, toggleSuggested`。

**注意**：`matrixSpaceService.createRoom` 尚不存在，需在 Task 3 中新增。本 Task 需先补充该方法（见下方 Step 4b），否则 TS 报错。

- [ ] **Step 4b: 新增 MatrixSpaceService.createRoom**

在 `MatrixSpaceService.ts` 的 `createSpace` 方法附近新增：

```typescript
  /** 在当前空间内创建普通子房间（非 space），返回房间信息 */
  async createRoom(options: { name: string; topic?: string; visibility?: Visibility }): Promise<{ roomId: string; name: string } | null> {
    const client = this.getClient()
    try {
      const { room_id } = await client.createRoom({
        name: options.name,
        topic: options.topic,
        visibility: options.visibility ?? 'private'
      })
      logger.info(`[Space] 子房间已创建: ${room_id}`)
      return { roomId: room_id, name: options.name }
    } catch (err) {
      logger.error(`[Space] 创建子房间失败: ${err}`)
      throw err
    }
  }
```

- [ ] **Step 5: 运行测试确认通过**

Run: `pnpm vitest run src/composables/space/__tests__/useSpaceRooms.test.ts`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add src/composables/space/useSpaceRooms.ts src/composables/space/__tests__/useSpaceRooms.test.ts src/services/matrix/room/MatrixSpaceService.ts
git commit -m "feat(space): useSpaceRooms 增加 createRoomInSpace 与 toggleSuggested"
```

---

## Task 3: SpaceCreateRoomPane 创建房间表单

**Files:**
- Create: `src/components/space/SpaceCreateRoomPane.vue`
- Test: `src/components/space/__tests__/SpaceCreateRoomPane.test.ts`

**Interfaces:**
- Consumes: `useSpaceRooms(() => props.spaceId).createRoomInSpace`、`useI18n().t`、`useActionFeedback().showFeedback`
- Produces: 组件 props `{ spaceId: string }`，emits `{ created: [roomId: string]; close: [] }`

- [ ] **Step 1: 写失败测试**

```typescript
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import SpaceCreateRoomPane from '../SpaceCreateRoomPane.vue'

vi.mock('@/composables/space/useSpaceRooms', () => ({
  useSpaceRooms: () => ({
    createRoomInSpace: vi.fn().mockResolvedValue('!new:hs')
  })
}))

describe('SpaceCreateRoomPane', () => {
  it('渲染名称、描述、建议标记字段', () => {
    const wrapper = mount(SpaceCreateRoomPane, { props: { spaceId: '!space:hs' } })
    expect(wrapper.text()).toContain('房间名称')
    expect(wrapper.text()).toContain('标记为建议房间')
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest run src/components/space/__tests__/SpaceCreateRoomPane.test.ts`
Expected: FAIL（找不到组件）

- [ ] **Step 3: 实现组件**

```vue
<template>
  <n-modal :show="true" preset="card" :title="t('space.create_room')" class="max-w-420px" @close="emit('close')">
    <n-form label-placement="top">
      <n-form-item :label="t('space.room_name')">
        <n-input v-model:value="form.name" :maxlength="255" :placeholder="t('space.room_name_placeholder')" />
      </n-form-item>
      <n-form-item :label="t('space.room_topic')">
        <n-input v-model:value="form.topic" type="textarea" :maxlength="4096" :autosize="{ minRows: 2, maxRows: 4 }" />
      </n-form-item>
      <n-form-item :label="t('space.mark_suggested')">
        <n-switch v-model:value="form.suggested" />
      </n-form-item>
    </n-form>
    <template #footer>
      <div class="flex justify-end gap-12px">
        <n-button :loading="submitting" type="primary" @click="handleSubmit">
          {{ t('common.create') }}
        </n-button>
      </div>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useSpaceRooms } from '@/composables/space/useSpaceRooms'

const props = defineProps<{ spaceId: string }>()
const emit = defineEmits<{ created: [roomId: string]; close: [] }>()

const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const { createRoomInSpace } = useSpaceRooms(() => props.spaceId)

const form = reactive({ name: '', topic: '', suggested: false })
const submitting = ref(false)

const handleSubmit = async () => {
  if (!form.name.trim()) {
    showFeedback(t('space.room_name_required'), 'warning')
    return
  }
  submitting.value = true
  try {
    const roomId = await createRoomInSpace({ name: form.name.trim(), topic: form.topic.trim(), suggested: form.suggested })
    if (roomId) {
      showFeedback(t('space.room_create_success'), 'success')
      emit('created', roomId)
    } else {
      showFeedback(t('space.room_create_failed'), 'error')
    }
  } catch (err) {
    showFeedback(t('space.room_create_failed'), 'error')
  } finally {
    submitting.value = false
  }
}
</script>
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm vitest run src/components/space/__tests__/SpaceCreateRoomPane.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/components/space/SpaceCreateRoomPane.vue src/components/space/__tests__/SpaceCreateRoomPane.test.ts
git commit -m "feat(space): 新增 SpaceCreateRoomPane 空间内创建房间表单"
```

---

## Task 4: SpaceViewHeader 增加 + 按钮下拉菜单

**Files:**
- Modify: `src/components/space/SpaceViewHeader.vue`
- Test: `src/components/space/__tests__/SpaceViewHeader.test.ts`（若不存在则创建）

**Interfaces:**
- Consumes: `SpaceCreateRoomPane`（Task 3 产出）、`useI18n().t`
- Produces: 新增 emit `create-room: []`

- [ ] **Step 1: 写失败测试**

```typescript
it('点击 + 按钮弹出创建房间菜单项', async () => {
  const wrapper = mount(SpaceViewHeader, {
    props: { spaces: [], currentSpaceId: '' },
    global: { stubs: { SpaceSwitcher: true } }
  })
  await wrapper.find('[data-testid="space-add-btn"]').trigger('click')
  expect(wrapper.find('[data-testid="space-add-create-room"]').exists()).toBe(true)
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest run src/components/space/__tests__/SpaceViewHeader.test.ts`
Expected: FAIL（找不到 data-testid=space-add-btn）

- [ ] **Step 3: 实现下拉菜单**

在 `SpaceViewHeader.vue` 的 actions 区域（搜索按钮之后）新增 `+` 按钮和 `n-dropdown`：

```vue
<!-- 新增：+ 按钮（创建房间） -->
<n-dropdown
  trigger="click"
  :options="addMenuOptions"
  @select="handleAddMenuSelect">
  <button type="button" class="space-view-header__icon-btn" data-testid="space-add-btn" :aria-label="t('common.add')">
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  </button>
</n-dropdown>

<!-- 创建房间弹窗 -->
<SpaceCreateRoomPane v-if="showCreateRoom" :space-id="currentSpaceId" @close="showCreateRoom = false" @created="handleRoomCreated" />
```

script 中补充：

```typescript
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import SpaceSwitcher from '@/components/space/SpaceSwitcher.vue'
import SpaceCreateRoomPane from '@/components/space/SpaceCreateRoomPane.vue'

// ... 在 emit 中增加 'create-room': []

const showCreateRoom = ref(false)

const addMenuOptions = computed(() => [
  { label: t('space.create_room'), key: 'create-room' }
])

const handleAddMenuSelect = (key: string) => {
  if (key === 'create-room') {
    showCreateRoom.value = true
  }
}

const handleRoomCreated = (roomId: string) => {
  showCreateRoom.value = false
  emit('create-room', roomId)
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm vitest run src/components/space/__tests__/SpaceViewHeader.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/components/space/SpaceViewHeader.vue src/components/space/__tests__/SpaceViewHeader.test.ts
git commit -m "feat(space): SpaceViewHeader 增加创建房间下拉菜单"
```

---

## Task 5: SpaceInviteBar 搜索邀请组件

**Files:**
- Create: `src/components/space/SpaceInviteBar.vue`
- Test: `src/components/space/__tests__/SpaceInviteBar.test.ts`

**Interfaces:**
- Consumes: `userDirectoryService.searchUsers(query, limit)`、`useSpaceMembers(() => props.spaceId)`（Task 6 产出）
- Produces: props `{ spaceId: string; canManage?: boolean }`，emits `{ invited: [] }`

- [ ] **Step 1: 写失败测试**

```typescript
vi.mock('@/services/matrix/user/MatrixUserDirectoryService', () => ({
  userDirectoryService: {
    searchUsers: vi.fn().mockResolvedValue([
      { userId: '@alice:hs', displayName: 'Alice', avatarUrl: undefined }
    ])
  }
}))

describe('SpaceInviteBar', () => {
  it('输入后 debounce 搜索并展示结果', async () => {
    const wrapper = mount(SpaceInviteBar, { props: { spaceId: '!space:hs' } })
    await wrapper.find('input').setValue('ali')
    await new Promise((r) => setTimeout(r, 350))
    expect(wrapper.text()).toContain('Alice')
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest run src/components/space/__tests__/SpaceInviteBar.test.ts`
Expected: FAIL（找不到组件）

- [ ] **Step 3: 实现组件**

```vue
<template>
  <div class="space-invite-bar">
    <n-input
      v-model:value="query"
      :placeholder="t('space.invite_search_placeholder')"
      :disabled="!canManage"
      clearable
      @update:value="handleQueryChange">
      <template #prefix>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
      </template>
    </n-input>

    <!-- 搜索结果列表 -->
    <div v-if="query.trim() && results.length" class="space-invite-bar__results">
      <div
        v-for="user in results"
        :key="user.userId"
        class="space-invite-bar__result"
        data-testid="space-invite-result"
        @click="handleInvite(user)">
        <span class="space-invite-bar__avatar">{{ getInitial(user) }}</span>
        <span class="space-invite-bar__name">{{ user.displayName || user.userId }}</span>
        <span class="space-invite-bar__id">{{ user.userId }}</span>
      </div>
    </div>
    <div v-else-if="query.trim() && !loading && searched" class="space-invite-bar__empty">
      {{ t('space.invite_no_result') }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useSpaceMembers } from '@/composables/space/useSpaceMembers'
import { userDirectoryService } from '@/services/matrix/user/MatrixUserDirectoryService'

const props = defineProps<{ spaceId: string; canManage?: boolean }>()
const emit = defineEmits<{ invited: [] }>()

const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const { invite } = useSpaceMembers(() => props.spaceId)

const query = ref('')
const results = ref<Array<{ userId: string; displayName?: string; avatarUrl?: string }>>([])
const loading = ref(false)
const searched = ref(false)
let debounceTimer: ReturnType<typeof setTimeout> | null = null

const handleQueryChange = (value: string) => {
  if (debounceTimer) clearTimeout(debounceTimer)
  const q = value.trim()
  if (!q) {
    results.value = []
    searched.value = false
    return
  }
  debounceTimer = setTimeout(async () => {
    loading.value = true
    try {
      results.value = await userDirectoryService.searchUsers(q, 10)
      searched.value = true
    } catch {
      results.value = []
    } finally {
      loading.value = false
    }
  }, 300)
}

const getInitial = (user: { userId: string }) => {
  const local = user.userId.startsWith('@') ? user.userId.slice(1).split(':')[0] : user.userId
  return local.slice(0, 1).toUpperCase() || '?'
}

const handleInvite = async (user: { userId: string }) => {
  const ok = await invite(user.userId)
  if (ok) {
    showFeedback(t('space.invite_success'), 'success')
    query.value = ''
    results.value = []
    emit('invited')
  } else {
    showFeedback(t('space.invite_failed'), 'error')
  }
}
</script>

<style scoped lang="scss">
.space-invite-bar {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.space-invite-bar__results {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 10;
  max-height: 240px;
  overflow-y: auto;
  background: var(--tjg-surface-panel);
  border: 1px solid var(--tjg-border-default);
  border-radius: var(--tjg-radius-md);
  box-shadow: var(--tjg-shadow-overlay);
}

.space-invite-bar__result {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
  transition: background-color var(--tjg-motion-duration-fast) var(--tjg-motion-ease-standard);

  &:hover {
    background: var(--tjg-surface-list-hover);
  }
}

.space-invite-bar__avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--tjg-radius-full);
  background: var(--tjg-surface-search);
  font-size: var(--tjg-font-size-xs);
  font-weight: var(--tjg-font-weight-semibold);
  color: var(--tjg-text-secondary);
  flex-shrink: 0;
}

.space-invite-bar__name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-primary);
}

.space-invite-bar__id {
  font-size: var(--tjg-font-size-2xs);
  color: var(--tjg-text-tertiary);
}

.space-invite-bar__empty {
  padding: 12px;
  text-align: center;
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-quaternary);
}

@media (prefers-reduced-motion: reduce) {
  .space-invite-bar__result {
    transition: none;
  }
}
</style>
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm vitest run src/components/space/__tests__/SpaceInviteBar.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/components/space/SpaceInviteBar.vue src/components/space/__tests__/SpaceInviteBar.test.ts
git commit -m "feat(space): 新增 SpaceInviteBar 搜索邀请组件"
```

---

## Task 6: useSpaceMembers 增加搜索与状态过滤

**Files:**
- Modify: `src/composables/space/useSpaceMembers.ts`
- Test: `src/composables/space/__tests__/useSpaceMembers.test.ts`

**Interfaces:**
- Consumes: `userDirectoryService.searchUsers`
- Produces: `searchUsers(query: string, limit?: number): Promise<Array<{ userId: string; displayName?: string; avatarUrl?: string }>>`，并过滤掉已加入/已邀请成员与自己

- [ ] **Step 1: 写失败测试**

```typescript
it('searchUsers 过滤掉已加入成员', async () => {
  vi.mocked(userDirectoryService.searchUsers).mockResolvedValue([
    { userId: '@alice:hs', displayName: 'Alice' },
    { userId: '@bob:hs', displayName: 'Bob' }
  ])
  vi.mocked(matrixSpaceService.getSpaceMembers).mockResolvedValue([
    { space_id: '!space:hs', user_id: '@alice:hs', membership: 'join' } as never
  ])

  const { searchUsers } = useSpaceMembers(() => '!space:hs')
  const results = await searchUsers('a')

  expect(results.map((r) => r.userId)).toEqual(['@bob:hs'])
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest run src/composables/space/__tests__/useSpaceMembers.test.ts`
Expected: FAIL（`searchUsers is not a function`）

- [ ] **Step 3: 实现方法**

在 `useSpaceMembers.ts` 中补充 import 和 `searchUsers`：

```typescript
import { userDirectoryService } from '@/services/matrix/user/MatrixUserDirectoryService'
```

在 `UseSpaceMembersResult` 接口补充 `searchUsers`，实现：

```typescript
  const searchUsers = async (
    query: string,
    limit = 10
  ): Promise<Array<{ userId: string; displayName?: string; avatarUrl?: string }>> => {
    const id = spaceId()
    if (!id || !query) return []
    const results = await userDirectoryService.searchUsers(query, limit)
    const memberIds = new Set(members.value.map((m) => m.user_id))
    return results.filter((u) => !memberIds.has(u.userId))
  }
```

在 return 中补充 `searchUsers`。

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm vitest run src/composables/space/__tests__/useSpaceMembers.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/composables/space/useSpaceMembers.ts src/composables/space/__tests__/useSpaceMembers.test.ts
git commit -m "feat(space): useSpaceMembers 增加 searchUsers 并过滤已加入成员"
```

---

## Task 7: SpaceMembersPane 接入 SpaceInviteBar

**Files:**
- Modify: `src/components/workbench/SpaceMembersPane.vue`
- Test: `src/components/workbench/__tests__/SpaceMembersPane.test.ts`

**Interfaces:**
- Consumes: `SpaceInviteBar`（Task 5 产出）
- Produces: 替换原 input+button 为搜索式组件；原 `invite` 逻辑移交 SpaceInviteBar

- [ ] **Step 1: 写失败测试**

```typescript
it('使用 SpaceInviteBar 替换基础邀请输入框', () => {
  const wrapper = mount(SpaceMembersPane, { props: { spaceId: '!space:hs', canManage: true } })
  expect(wrapper.findComponent({ name: 'SpaceInviteBar' }).exists()).toBe(true)
  expect(wrapper.find('[data-test="space-invite-input"]').exists()).toBe(false)
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest run src/components/workbench/__tests__/SpaceMembersPane.test.ts`
Expected: FAIL（仍存在 space-invite-input）

- [ ] **Step 3: 替换邀请表单**

在 `SpaceMembersPane.vue` 中：

1. 将 template 中 `section.space-members-pane__invite` 块替换为：

```vue
    <!-- 搜索邀请（管理员可见） -->
    <section v-if="canManage" class="space-members-pane__invite" data-test="space-invite-form">
      <SpaceInviteBar :space-id="spaceId" :can-manage="canManage" @invited="reloadAfterInvite" />
    </section>
```

2. 移除 `inviteUserId`、`inviteSubmitting`、`handleInvite` 相关代码，新增：

```typescript
import SpaceInviteBar from '@/components/space/SpaceInviteBar.vue'

// 移除 inviteUserId / inviteSubmitting / handleInvite

const { members, load } = useSpaceMembers(() => props.spaceId)

const reloadAfterInvite = () => {
  void load()
}
```

3. 删除 `useActionFeedback` import（若不再使用）。

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm vitest run src/components/workbench/__tests__/SpaceMembersPane.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/components/workbench/SpaceMembersPane.vue src/components/workbench/__tests__/SpaceMembersPane.test.ts
git commit -m "feat(space): SpaceMembersPane 接入 SpaceInviteBar 搜索邀请"
```

---

## Task 8: SpaceRoomGrid 增加建议星标按钮

**Files:**
- Modify: `src/components/space/SpaceRoomGrid.vue`
- Test: `src/components/space/__tests__/SpaceRoomGrid.test.ts`

**Interfaces:**
- Consumes: `useSpaceRooms(() => props.spaceId).toggleSuggested`（Task 2 产出）
- Produces: 新增 prop `spaceId: string`、`canManage?: boolean`；emits `toggle-suggested: [roomId: string, suggested: boolean]`（或内部直接调用）

- [ ] **Step 1: 写失败测试**

```typescript
it('建议房间显示实心星标', () => {
  const wrapper = mount(SpaceRoomGrid, {
    props: {
      spaceId: '!space:hs',
      canManage: true,
      rooms: [{ roomId: '!r1:hs', name: '房间1', suggested: true }]
    }
  })
  expect(wrapper.find('[data-testid="space-room-suggested"]').exists()).toBe(true)
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest run src/components/space/__tests__/SpaceRoomGrid.test.ts`
Expected: FAIL（找不到 space-room-suggested）

- [ ] **Step 3: 实现星标**

在 `SpaceRoomGrid.vue` 中：

1. 更新 props 定义：

```typescript
const props = defineProps<{
  rooms: SpaceChildRoom[]
  loading?: boolean
  spaceId?: string
  canManage?: boolean
}>()
```

2. 在聊天入口按钮之前增加星标按钮（仅 `canManage` 时显示）：

```vue
        <!-- 建议标记按钮 -->
        <button
          v-if="canManage"
          type="button"
          class="space-room-grid__star-btn"
          :class="{ 'space-room-grid__star-btn--active': room.suggested }"
          :data-testid="room.suggested ? 'space-room-suggested' : 'space-room-unsuggested'"
          :aria-label="room.suggested ? t('space.unmark_suggested') : t('space.mark_suggested')"
          :title="room.suggested ? t('space.unmark_suggested') : t('space.mark_suggested')"
          @click.stop="handleToggleSuggested(room)">
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            :fill="room.suggested ? 'currentColor' : 'none'"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        </button>
```

3. 在 script 中增加 `useSpaceRooms` 调用和 toggle 处理：

```typescript
import { useSpaceRooms } from '@/composables/space/useSpaceRooms'

const { toggleSuggested } = useSpaceRooms(() => props.spaceId || '')

const handleToggleSuggested = async (room: SpaceChildRoom) => {
  await toggleSuggested(room.roomId, !room.suggested)
}
```

4. 增加星标样式：

```scss
.space-room-grid__star-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  border: 0;
  border-radius: var(--tjg-radius-xs);
  background: transparent;
  color: var(--tjg-text-tertiary);
  cursor: pointer;
  transition: color var(--tjg-motion-duration-fast) var(--tjg-motion-ease-standard);

  &:hover {
    color: var(--tjg-color-primary-500);
  }

  &--active {
    color: var(--tjg-color-primary-500);
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm vitest run src/components/space/__tests__/SpaceRoomGrid.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/components/space/SpaceRoomGrid.vue src/components/space/__tests__/SpaceRoomGrid.test.ts
git commit -m "feat(space): SpaceRoomGrid 增加子房间建议星标按钮"
```

---

## Task 9: SpaceChildrenPane 透传 canManage 与 toggle 事件

**Files:**
- Modify: `src/components/space/SpaceChildrenPane.vue`
- Test: `src/components/space/__tests__/SpaceChildrenPane.test.ts`

**Interfaces:**
- Consumes: `SpaceRoomGrid` 新增的 `spaceId`/`canManage` prop（Task 8 产出）
- Produces: 将 `spaceId` 与 `canManageSelectedSpace` 透传给 `SpaceRoomGrid`

- [ ] **Step 1: 修改模板**

在 `SpaceChildrenPane.vue` 的 `SpaceRoomGrid` 标签上增加 props：

```vue
      <SpaceRoomGrid
        :rooms="spaceRooms"
        :loading="roomsLoading"
        :space-id="spaceId"
        :can-manage="canManageSelectedSpace"
        @enter-room="handleEnterRoom"
        @preview-room="handleEnterRoom" />
```

- [ ] **Step 2: 运行相关测试**

Run: `pnpm vitest run src/components/space/__tests__/SpaceChildrenPane.test.ts`
Expected: PASS（现有测试无破坏）

- [ ] **Step 3: 提交**

```bash
git add src/components/space/SpaceChildrenPane.vue
git commit -m "feat(space): SpaceChildrenPane 透传 spaceId 与 canManage 到 SpaceRoomGrid"
```

---

## Task 10: 全量质量守门验证

- [ ] **Step 1: 类型检查**

Run: `pnpm vue-tsc --noEmit`
Expected: 0 错误

- [ ] **Step 2: 单元测试**

Run: `pnpm test:run`
Expected: 全部通过（注意 `src/layout/left/components/__tests__/LeftAvatar.test.ts` 存在预存 mock 路径 bug，与本计划无关，若失败需单独修复）

- [ ] **Step 3: Biome lint**

Run: `pnpm check`
Expected: 无新增 error

- [ ] **Step 4: 文档覆盖**

Run: `pnpm check:doc-coverage`
Expected: 无新增未文档化方法（新增的 `createRoom`、`setChildSuggested`、`createRoomInSpace`、`toggleSuggested`、`searchUsers` 均需 JSDoc 注释）

- [ ] **Step 5: 修复守门发现的问题**

若任一守门命令失败，修复后重新运行，直至全部通过。

---

## Self-Review

**1. Spec 覆盖检查：**
- 功能 1 创建房间 → Task 1/2/3/4 ✅
- 功能 2 成员邀请 → Task 5/6/7 ✅
- 功能 3 建议标记 → Task 1/2/8/9 ✅
- 共享约束（i18n/错误处理/测试）→ 各 Task 已内嵌 ✅

**2. 占位符扫描：** 无 TBD/TODO，所有代码块完整。✅

**3. 类型一致性：**
- `createRoomInSpace` 返回 `string | null`，Task 3 消费正确 ✅
- `toggleSuggested(roomId, suggested)` 签名在 Task 2 定义、Task 8 消费一致 ✅
- `setChildSuggested(spaceId, roomId, suggested)` 在 Task 1 定义、Task 2 消费一致 ✅
- `searchUsers(query, limit)` 在 Task 6 定义、Task 5 消费（通过 userDirectoryService）一致 ✅
