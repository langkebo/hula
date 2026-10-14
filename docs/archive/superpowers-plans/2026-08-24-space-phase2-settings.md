# Space Phase 2: 空间设置页实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现空间设置页，覆盖名称/描述/头像/可见性/加入规则/统计信息 6 项能力，并修复 `updateSpace` 漏传 `join_rule`/`visibility`/`is_public` 的问题。

**Architecture:** 复用现有 `MatrixSpaceService.updateSpace`（补齐字段透传），新建 `SpaceSettingsPane.vue` 作为独立设置面板，在 `SpaceChildrenPane` 中通过 `settingsOpen` 状态控制打开/关闭。

**Tech Stack:** Vue 3 (`<script setup lang="ts">`) + Naive UI + UnoCSS/SCSS + Vitest + @vue/test-utils

## Global Constraints

- 所有新组件使用 `<script setup lang="ts">` + Composition API
- 样式使用 UnoCSS 工具类 + SCSS scoped，遵循 `--tjg-*` design token，禁止硬编码颜色
- 图标使用 SVG（`<svg>` / `<use>`），线宽 1.5px
- 动效尊重 `prefers-reduced-motion`
- i18n 使用 `t('space.xxx', '中文兜底')` 形式；若 `pnpm check` 报 i18n 未登记，补充到 `locales/zh-CN/` 与 `locales/en/` 对应文件
- 错误处理：异步包裹 try-catch，通过 `useActionFeedback().showFeedback()` 展示 toast，`createLogger('Xxx')` 输出日志
- 组件文件不超过 800 行
- 守门命令：`pnpm vue-tsc --noEmit`（0 错误）、`pnpm vitest run <path>`（相关测试通过）、`pnpm check`（无新 error）、`pnpm check:doc-coverage`（无新增未文档化方法）

---

## 关键类型与签名（实施前必读）

### SDK `UpdateSpaceOptions`（`matrix-js-sdk/src/space/types.ts:106-113`）

```typescript
export interface UpdateSpaceOptions {
    name?: string;
    topic?: string;
    avatar_url?: string;
    join_rule?: string;
    visibility?: "public" | "private";
    is_public?: boolean;
}
```

### SDK `Visibility` 枚举（`matrix-js-sdk/src/@types/partials.ts:17-20`）

```typescript
export enum Visibility {
    Public = "public",
    Private = "private",
}
```

### 前端 `SpaceOptions`（`src/services/matrix/room/MatrixSpaceService.ts:14-24`，需扩展）

当前定义：
```typescript
export interface SpaceOptions {
  name: string
  topic?: string
  visibility?: Visibility
  avatarUrl?: string
  ignoreDuplicateName?: boolean
}
```

### `useSpace.update` 签名（`src/composables/space/useSpace.ts:14`）

```typescript
update: (updates: Partial<SpaceOptions>) => Promise<boolean>
```

**注意**：`useSpace.update` 已经透传 `Partial<SpaceOptions>`，只要 `SpaceOptions` 扩展了 `joinRule`/`isPublic`，`useSpace` **无需修改代码**，新字段自动可用。

### `SpaceSubView` 类型（`src/components/workbench/SpaceDetailsPane.vue:277`）

```typescript
type SpaceSubView = 'overview' | 'members' | 'rooms' | 'hierarchy'
```

**设计决策**：设置页**不**扩展 `subView` 状态机，而是用独立的 `settingsOpen: Ref<boolean>` 控制，因为设置页是 modal 语义（打开/关闭），与 overview/members/rooms/hierarchy 的「子面板切换」语义不同。

---

## Task 1: MatrixSpaceService 扩展 SpaceOptions + updateSpace 补传字段

**Files:**
- Modify: `src/services/matrix/room/MatrixSpaceService.ts`（第 14-24 行 `SpaceOptions`，第 129-150 行 `updateSpace`）
- Test: `src/services/matrix/room/__tests__/MatrixSpaceService.test.ts`

**Interfaces:**
- Consumes: `Visibility`（from 'matrix-js-sdk'）、`this.getSpaceManager().updateSpace(spaceId, options)`
- Produces:
  - `SpaceOptions` 新增 `joinRule?: string` 和 `isPublic?: boolean`
  - `updateSpace(spaceId: string, options: Partial<SpaceOptions>): Promise<void>` — 现在透传全部 6 字段

- [ ] **Step 1: 写失败测试**

在 `MatrixSpaceService.test.ts` 中追加：

```typescript
it('updateSpace 透传 join_rule / visibility / is_public', async () => {
  const mockUpdate = vi.fn().mockResolvedValue({})
  mockSpaceManager.updateSpace = mockUpdate

  await matrixSpaceService.updateSpace('!space:hs', {
    name: '新名',
    topic: '新简介',
    avatarUrl: 'mxc://avatar',
    joinRule: 'invite',
    visibility: Visibility.Private,
    isPublic: false
  })

  expect(mockUpdate).toHaveBeenCalledWith('!space:hs', {
    name: '新名',
    topic: '新简介',
    avatar_url: 'mxc://avatar',
    join_rule: 'invite',
    visibility: 'private',
    is_public: false
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest run src/services/matrix/room/__tests__/MatrixSpaceService.test.ts -t "透传 join_rule"`
Expected: FAIL（`mockUpdate` 收到的参数缺少 `join_rule`/`visibility`/`is_public`）

- [ ] **Step 3: 扩展 SpaceOptions 接口**

将 `SpaceOptions` 改为：

```typescript
export interface SpaceOptions {
  name: string
  topic?: string
  visibility?: Visibility
  avatarUrl?: string
  /** 加入规则："public" | "invite"（仅空间创建者可通过设置页修改） */
  joinRule?: string
  /** 是否公开，与 visibility 联动（public → true，private → false） */
  isPublic?: boolean
  /**
   * 同名防重逃生阀：服务端对已存在同名空间返回 409 M_ROOM_IN_USE。
   * 用户经确认弹窗选择"仍然创建"后置 true 重发，跳过查重。
   */
  ignoreDuplicateName?: boolean
}
```

- [ ] **Step 4: 改写 updateSpace**

将 `updateSpace` 方法（第 129-150 行）改写为：

```typescript
  async updateSpace(spaceId: string, options: Partial<SpaceOptions>): Promise<void> {
    // Visibility 枚举值（"public"/"private"）与 SDK UpdateSpaceOptions.visibility 的
    // 字符串字面量精确一致，这里显式映射避免类型歧义。
    const visibility =
      options.visibility === Visibility.Public
        ? 'public'
        : options.visibility === Visibility.Private
          ? 'private'
          : undefined

    try {
      await this.getSpaceManager().updateSpace(spaceId, {
        name: options.name,
        topic: options.topic,
        avatar_url: options.avatarUrl,
        join_rule: options.joinRule,
        visibility,
        is_public: options.isPublic
      })
      logger.info(`[Space] Space 已更新: ${spaceId}`)
    } catch (err) {
      logger.info(`[Space] SpaceManager 更新失败，回退到客户端调用: ${err}`)
      try {
        const client = this.getClient()
        if (options.name) await client.setRoomName(spaceId, options.name)
        if (options.topic !== undefined) await client.setRoomTopic(spaceId, options.topic)
        if (options.avatarUrl) await client.setRoomAvatar(spaceId, options.avatarUrl)
        logger.info(`[Space] Space 已更新（回退）: ${spaceId}`)
      } catch (fallbackErr) {
        logger.error(`[Space] 更新 Space 失败: ${fallbackErr}`)
        throw fallbackErr
      }
    }
  }
```

- [ ] **Step 5: 运行测试确认通过**

Run: `pnpm vitest run src/services/matrix/room/__tests__/MatrixSpaceService.test.ts -t "透传 join_rule"`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add src/services/matrix/room/MatrixSpaceService.ts src/services/matrix/room/__tests__/MatrixSpaceService.test.ts
git commit -m "feat(service): MatrixSpaceService.updateSpace 补传 join_rule/visibility/is_public"
```

---

## Task 2: SpaceSettingsPane 设置页组件

**Files:**
- Create: `src/components/space/SpaceSettingsPane.vue`
- Test: `src/components/space/__tests__/SpaceSettingsPane.test.ts`

**Interfaces:**
- Consumes: `useSpace(() => props.spaceId)`（`space`/`update`/`loading`）、`useI18n().t`、`useActionFeedback().showFeedback`、`matrixMediaService.uploadFile`
- Produces: props `{ spaceId: string }`，emits `{ close: []; saved: [] }`

- [ ] **Step 1: 写失败测试**

```typescript
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import SpaceSettingsPane from '../SpaceSettingsPane.vue'

vi.mock('@/composables/space/useSpace', () => ({
  useSpace: () => ({
    space: { value: { spaceId: '!space:hs', name: '测试空间', topic: '简介', memberCount: 3, childCount: 2 } },
    update: vi.fn().mockResolvedValue(true),
    loading: { value: false }
  })
}))

describe('SpaceSettingsPane', () => {
  it('渲染 6 项设置：名称/描述/头像/可见性/加入规则/统计', () => {
    const wrapper = mount(SpaceSettingsPane, { props: { spaceId: '!space:hs' } })
    expect(wrapper.text()).toContain('空间名称')
    expect(wrapper.text()).toContain('空间简介')
    expect(wrapper.text()).toContain('可见性')
    expect(wrapper.text()).toContain('加入规则')
    expect(wrapper.text()).toContain('3')  // memberCount
    expect(wrapper.text()).toContain('2')  // childCount
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest run src/components/space/__tests__/SpaceSettingsPane.test.ts`
Expected: FAIL（找不到组件）

- [ ] **Step 3: 实现组件**

```vue
<template>
  <n-modal :show="true" preset="card" :title="t('space.settings')" class="max-w-460px" @close="emit('close')">
    <n-form label-placement="top">
      <!-- 统计信息（只读） -->
      <div class="space-settings-pane__stats">
        <span>{{ t('space.member_count_value', { count: form.memberCount }) }}</span>
        <span>{{ t('space.room_count_value', { count: form.childCount }) }}</span>
      </div>

      <n-form-item :label="t('space.name')">
        <n-input v-model:value="form.name" :maxlength="255" :disabled="saving" />
      </n-form-item>

      <n-form-item :label="t('space.topic')">
        <n-input v-model:value="form.topic" type="textarea" :maxlength="4096" :autosize="{ minRows: 2, maxRows: 4 }" :disabled="saving" />
      </n-form-item>

      <n-form-item :label="t('space.avatar')">
        <n-upload :max="1" accept="image/*" :custom-request="handleAvatarUpload" :show-file-list="false">
          <n-avatar round :size="64" :src="form.avatarUrl || undefined" />
        </n-upload>
      </n-form-item>

      <n-form-item :label="t('space.visibility')">
        <n-radio-group v-model:value="form.visibility" :disabled="saving">
          <n-radio value="public">{{ t('space.visibility_public') }}</n-radio>
          <n-radio value="private">{{ t('space.visibility_private') }}</n-radio>
        </n-radio-group>
      </n-form-item>

      <n-form-item :label="t('space.join_rule')">
        <n-radio-group v-model:value="form.joinRule" :disabled="saving">
          <n-radio value="public">{{ t('space.join_rule_public') }}</n-radio>
          <n-radio value="invite">{{ t('space.join_rule_invite') }}</n-radio>
        </n-radio-group>
      </n-form-item>
    </n-form>

    <template #footer>
      <div class="flex justify-end gap-12px">
        <n-button :loading="saving" type="primary" @click="handleSave">
          {{ t('common.save') }}
        </n-button>
      </div>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import type { UploadCustomRequestOptions } from 'naive-ui'
import { reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useSpace } from '@/composables/space/useSpace'
import { matrixMediaService } from '@/services/matrix/media/MatrixMediaService'

const props = defineProps<{ spaceId: string }>()
const emit = defineEmits<{ close: []; saved: [] }>()

const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const { space, update, loading } = useSpace(() => props.spaceId)

const form = reactive({
  name: '',
  topic: '',
  avatarUrl: '',
  visibility: 'private' as 'public' | 'private',
  joinRule: 'invite' as 'public' | 'invite',
  memberCount: 0,
  childCount: 0
})

const saving = ref(false)

// 加载后回填表单
watch(
  space,
  (s) => {
    if (!s) return
    form.name = s.name
    form.topic = s.topic ?? ''
    form.avatarUrl = s.avatarUrl ?? ''
    form.memberCount = s.memberCount
    form.childCount = s.childCount
    // 可见性兜底：默认 private
    form.visibility = 'private'
    form.joinRule = 'invite'
  },
  { immediate: true }
)

const handleAvatarUpload = async (options: UploadCustomRequestOptions) => {
  try {
    const file = options.file.file as File
    const result = await matrixMediaService.uploadFile(file)
    form.avatarUrl = result.contentUri
    options.onFinish()
  } catch {
    options.onError()
  }
}

const handleSave = async () => {
  if (!form.name.trim()) {
    showFeedback(t('space.name_required'), 'warning')
    return
  }
  // 可见性与加入规则联动：private 强制 invite
  const joinRule = form.visibility === 'private' ? 'invite' : form.joinRule

  saving.value = true
  try {
    const ok = await update({
      name: form.name.trim(),
      topic: form.topic.trim(),
      avatarUrl: form.avatarUrl,
      visibility: form.visibility,
      joinRule,
      isPublic: form.visibility === 'public'
    })
    if (ok) {
      showFeedback(t('space.settings_saved'), 'success')
      emit('saved')
    } else {
      showFeedback(t('space.settings_save_failed'), 'error')
    }
  } catch {
    showFeedback(t('space.settings_save_failed'), 'error')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped lang="scss">
.space-settings-pane__stats {
  display: flex;
  gap: var(--tjg-space-4);
  padding: var(--tjg-space-3) 0;
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-tertiary);
}
</style>
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm vitest run src/components/space/__tests__/SpaceSettingsPane.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/components/space/SpaceSettingsPane.vue src/components/space/__tests__/SpaceSettingsPane.test.ts
git commit -m "feat(space): 新增 SpaceSettingsPane 空间设置页"
```

---

## Task 3: SpaceChildrenPane 接线设置页

**Files:**
- Modify: `src/components/space/SpaceChildrenPane.vue`（第 216-219 行 `handleSpaceSettings`）
- Test: `src/components/space/__tests__/SpaceChildrenPane.test.ts`

**Interfaces:**
- Consumes: `SpaceSettingsPane`（Task 2 产出）
- Produces: `settingsOpen: Ref<boolean>` 状态 + 打开/关闭逻辑

- [ ] **Step 1: 写失败测试**

```typescript
it('点击设置按钮打开 SpaceSettingsPane', async () => {
  const wrapper = mount(SpaceChildrenPane, {
    global: { stubs: { SpaceSettingsPane: true, SpaceHeader: true, SpaceRoomGrid: true, SpaceDetailsPane: true } }
  })
  // 模拟 SpaceHeader 触发 settings 事件
  wrapper.findComponent({ name: 'SpaceHeader' }).vm.$emit('settings', '!space:hs')
  await wrapper.vm.$nextTick()
  expect(wrapper.findComponent({ name: 'SpaceSettingsPane' }).exists()).toBe(true)
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest run src/components/space/__tests__/SpaceChildrenPane.test.ts -t "打开 SpaceSettingsPane"`
Expected: FAIL（无 SpaceSettingsPane）

- [ ] **Step 3: 修改 handleSpaceSettings 与模板**

在 `SpaceChildrenPane.vue` 中：

1. 模板末尾（`</div>` 前）新增：

```vue
    <!-- 空间设置页 -->
    <SpaceSettingsPane
      v-if="settingsOpen && spaceId"
      :space-id="spaceId"
      @close="settingsOpen = false"
      @saved="handleSettingsSaved" />
```

2. 导入：

```typescript
import SpaceSettingsPane from '@/components/space/SpaceSettingsPane.vue'
```

3. 状态 + 处理函数（替换现有 `handleSpaceSettings`）：

```typescript
// 设置页开关
const settingsOpen = ref(false)

// 空间设置入口：打开设置页
const handleSpaceSettings = () => {
  if (!canManageSelectedSpace.value) return
  settingsOpen.value = true
}

// 设置保存后刷新详情
const handleSettingsSaved = async () => {
  settingsOpen.value = false
  await Promise.allSettled([loadSelectedSpace(), reloadSpaces()])
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm vitest run src/components/space/__tests__/SpaceChildrenPane.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/components/space/SpaceChildrenPane.vue src/components/space/__tests__/SpaceChildrenPane.test.ts
git commit -m "feat(space): SpaceChildrenPane 接入 SpaceSettingsPane 设置页"
```

---

## Task 4: 全量质量守门验证

- [ ] **Step 1: 类型检查**

Run: `pnpm vue-tsc --noEmit`
Expected: 0 错误

- [ ] **Step 2: 相关单元测试**

Run: `pnpm vitest run src/components/space src/composables/space src/services/matrix/room/__tests__/MatrixSpaceService.test.ts`
Expected: 全部通过

- [ ] **Step 3: Biome lint**

Run: `pnpm check`
Expected: 无新增 error

- [ ] **Step 4: 文档覆盖**

Run: `pnpm check:doc-coverage`
Expected: 无新增未文档化方法（`updateSpace` 已有 JSDoc，`SpaceOptions` 新字段已注释）

- [ ] **Step 5: 修复守门发现的问题**

若任一守门命令失败，修复后重新运行，直至全部通过。

---

## Self-Review

**1. Spec 覆盖检查：**
- 空间名称编辑 → Task 2 ✅
- 描述/公告编辑 → Task 2 ✅
- 头像更换 → Task 2 ✅
- 可见性切换 → Task 2 ✅
- 加入规则 → Task 2 ✅
- 统计信息 → Task 2 ✅
- `updateSpace` 补传 join_rule/visibility/is_public → Task 1 ✅
- 入口接线 → Task 3 ✅

**2. 占位符扫描：** 无 TBD/TODO，所有代码块完整。✅

**3. 类型一致性：**
- `SpaceOptions.joinRule?: string` / `isPublic?: boolean` 在 Task 1 定义，Task 2 通过 `update({ joinRule, isPublic, visibility })` 消费，类型一致 ✅
- `visibility` 映射（`Visibility.Public` → `'public'`）在 Task 1 实现，Task 2 传入 `form.visibility: 'public' | 'private'`，类型一致 ✅
- `SpaceSettingsPane` 的 props `{ spaceId: string }` 在 Task 2 定义，Task 3 传 `:space-id="spaceId"` 一致 ✅
