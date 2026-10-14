# P2 架构收敛实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 收敛双轨架构残留：合并时间格式化函数、抽取 MacCloseButton/PlatformCloseButton 统一组件、消除模板内 isMobile() 调用

**Architecture:** 纯重构，不改变任何现有交互行为。时间格式化合并为 2 个函数（formatChatTime + formatDateLabel）；mac-close div 模式抽取为 MacCloseButton.vue 组件（12 处）；窗口关闭逻辑抽取为 PlatformCloseButton.vue + usePlatformClose composable（6 处）；7 个文件 19 处 isMobile() 模板调用改为 isMobileRef computed 模式

**Tech Stack:** Vue 3 (Composition API) + TypeScript + Tauri v2 + Vitest + UnoCSS

## Global Constraints

- 颜色必须使用 `--tjg-*` token，禁止硬编码（`#xxx`/`rgb()`/`rgba()`）
- 图标必须 SVG（`<svg>`/`<use>`/Iconify），线宽 1.5px
- Matrix 操作走 `src/services/matrix/` 服务层，禁止组件直连 SDK
- 每任务一个 Conventional Commit（scope ∈ `[core, ui, chat, mobile, plugin, hook, service, util, i18n, config, ci, test, tauri]`）
- 每任务完成后跑：`pnpm vue-tsc --noEmit` / `pnpm test:run` / `pnpm check` / `pnpm check:ratchet`
- TDD：涉及逻辑的任务先写失败测试
- 不改变现有交互行为（拖拽、视图切换、响应式断点、消息收发）
- 不破坏 `matrixSdk.worker.ts` 主线程 <50ms 约束

---

## File Structure

### Task 1: ComputedTime.ts 合并
- Modify: `src/utils/ComputedTime.ts` — 合并 4 个时间格式化函数为 2 个
- Modify: 12 个引用文件的 import 路径和函数名
- Test: `src/utils/__tests__/ComputedTime.test.ts` — 更新现有测试

### Task 2: MacCloseButton.vue 抽取
- Create: `src/components/common/MacCloseButton.vue` — 统一 mac-close div 模式
- Modify: 8 个 .vue 文件 + 1 个 .tsx 文件（12 处 mac-close div 替换为组件）
- Modify: 删除 4 处重复的 `.mac-close:hover` CSS 规则
- Test: `src/components/common/__tests__/MacCloseButton.test.ts` — 新建

### Task 3: PlatformCloseButton + usePlatformClose 抽取
- Create: `src/composables/common/usePlatformClose.ts` — 统一窗口关闭逻辑
- Modify: 5 个文件的窗口关闭调用
- Test: `src/composables/common/__tests__/usePlatformClose.test.ts` — 新建

### Task 4: isMobile() 模板调用消除
- Modify: 7 个 .vue 文件（19 处 isMobile() 模板调用改为 isMobileRef computed）
- Test: 每个修改的组件的现有测试验证无回归

---

## Task 1: ComputedTime.ts 合并时间格式化函数

**Files:**
- Modify: `src/utils/ComputedTime.ts`
- Modify: `src/components/room/PinnedMessageBanner.vue:33,64` — `timeToStr` → `formatChatTime`
- Modify: `src/composables/workbench/useSessionListState.ts:11,142` — `formatTimestamp` → `formatChatTime`
- Modify: `src/components/search/SpotlightDialog.vue:150,199` — `formatTimestamp` → `formatChatTime`
- Modify: `src/components/rightBox/renderMessage/RenderPollMessage.vue:39,73` — `formatTimestamp` → `formatChatTime`
- Modify: `src/components/chat/ChatHistoryDrawer.vue:117` — `formatDateGroupLabel` → `formatDateLabel`, `formatTimestamp` → `formatChatTime`
- Modify: `src/components/chat/MultiMsgDrawer.vue:67` — `formatTimestamp` → `formatChatTime`
- Modify: `src/views/chatHistory/index.vue:114` — `formatDateGroupLabel` → `formatDateLabel`
- Modify: `src/views/multiMsgWindow/index.vue:63` — `formatTimestamp` → `formatChatTime`
- Modify: `src/components/room/AnnouncementPanel.vue:127,168` — `formatTimestamp` → `formatChatTime`
- Modify: `src/plugins/robot/layout/Left.vue:224` — `formatTimestamp` → `formatChatTime`
- Modify: `src/components/rightBox/renderMessage/TjgMessageMeta.vue:55,76` — `formatMessageTime` → `formatChatTime`
- Modify: `src/components/rightBox/renderMessage/Announcement.vue` — `formatTimestamp` → `formatChatTime`（内联调用）
- Test: `src/utils/__tests__/ComputedTime.test.ts`

**Interfaces:**
- Produces: `formatChatTime(timestamp: number, opts?: { detail?: boolean }): string` 和 `formatDateLabel(timestamp: number): string`
- 保留不变：`setDayjsLocale`、`isDiffNow`、`handRelativeTime`、`getWeekday`（这些不在合并范围内）
- 删除：`timeToStr`、`formatTimestamp`、`formatMessageTime`、`formatDateGroupLabel`（合并为上述 2 个）

- [ ] **Step 1: 写失败测试 — formatChatTime 覆盖所有场景**

在 `src/utils/__tests__/ComputedTime.test.ts` 中替换现有时间格式化测试，新增 `formatChatTime` 和 `formatDateLabel` 测试：

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { formatChatTime, formatDateLabel } from '../ComputedTime'

// Mock useI18nGlobal to avoid i18n setup in unit tests
vi.mock('@/services/i18n', () => ({
  useI18nGlobal: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      const map: Record<string, string> = {
        'common.just_now': '刚刚',
        'common.minutes_ago': `${params?.count ?? 0} 分钟前`,
        'menu.today': '今天',
        'menu.yesterday': '昨天'
      }
      return map[key] ?? key
    }
  })
}))

describe('formatChatTime', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns empty string for invalid timestamp', () => {
    expect(formatChatTime(0)).toBe('')
    expect(formatChatTime(-1)).toBe('')
    expect(formatChatTime(NaN)).toBe('')
  })

  it('returns absolute time for future timestamps', () => {
    vi.setSystemTime(new Date('2026-08-05T12:00:00'))
    const future = new Date('2026-08-05T12:01:00').getTime()
    expect(formatChatTime(future)).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}/)
  })

  it('shows "刚刚" for less than 1 minute ago', () => {
    vi.setSystemTime(new Date('2026-08-05T12:00:00'))
    const ts = new Date('2026-08-05T11:59:30').getTime()
    expect(formatChatTime(ts)).toBe('刚刚')
  })

  it('shows "X 分钟前" for less than 1 hour ago', () => {
    vi.setSystemTime(new Date('2026-08-05T12:00:00'))
    const ts = new Date('2026-08-05T11:50:00').getTime()
    expect(formatChatTime(ts)).toBe('10 分钟前')
  })

  it('shows HH:mm for today', () => {
    vi.setSystemTime(new Date('2026-08-05T12:00:00'))
    const ts = new Date('2026-08-05T10:30:00').getTime()
    expect(formatChatTime(ts)).toBe('10:30')
  })

  it('shows "昨天 HH:mm" for yesterday', () => {
    vi.setSystemTime(new Date('2026-08-05T12:00:00'))
    const ts = new Date('2026-08-04T10:30:00').getTime()
    expect(formatChatTime(ts)).toBe('昨天 10:30')
  })

  it('shows weekday HH:mm within this week', () => {
    vi.setSystemTime(new Date('2026-08-05T12:00:00')) // Tuesday
    const ts = new Date('2026-08-03T10:30:00').getTime() // Sunday
    expect(formatChatTime(ts)).toMatch(/\w+ 10:30/)
  })

  it('shows YYYY-MM-DD HH:mm for older dates', () => {
    vi.setSystemTime(new Date('2026-08-05T12:00:00'))
    const ts = new Date('2026-07-01T10:30:00').getTime()
    expect(formatChatTime(ts)).toBe('2026-07-01 10:30')
  })

  it('detail mode shows full date-time for today', () => {
    vi.setSystemTime(new Date('2026-08-05T12:00:00'))
    const ts = new Date('2026-08-05T10:30:00').getTime()
    expect(formatChatTime(ts, { detail: true })).toBe('10:30:00')
  })

  it('detail mode shows YYYY-MM-DD HH:mm:ss for cross-year', () => {
    vi.setSystemTime(new Date('2026-08-05T12:00:00'))
    const ts = new Date('2025-06-15T10:30:00').getTime()
    expect(formatChatTime(ts, { detail: true })).toBe('2025-06-15 10:30:00')
  })

  it('detail mode shows MM-DD HH:mm:ss for same year non-today', () => {
    vi.setSystemTime(new Date('2026-08-05T12:00:00'))
    const ts = new Date('2026-06-15T10:30:00').getTime()
    expect(formatChatTime(ts, { detail: true })).toBe('06-15 10:30:00')
  })

  it('non-detail mode shows YYYY-MM-DD for cross-year', () => {
    vi.setSystemTime(new Date('2026-08-05T12:00:00'))
    const ts = new Date('2025-06-15T10:30:00').getTime()
    expect(formatChatTime(ts)).toBe('2025-06-15')
  })
})

describe('formatDateLabel', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows "今天" for today', () => {
    vi.setSystemTime(new Date('2026-08-05T12:00:00'))
    const ts = new Date('2026-08-05T10:00:00').getTime()
    expect(formatDateLabel(ts)).toBe('今天')
  })

  it('shows "昨天" for yesterday', () => {
    vi.setSystemTime(new Date('2026-08-05T12:00:00'))
    const ts = new Date('2026-08-04T10:00:00').getTime()
    expect(formatDateLabel(ts)).toBe('昨天')
  })

  it('shows MM-DD for older dates', () => {
    vi.setSystemTime(new Date('2026-08-05T12:00:00'))
    const ts = new Date('2026-06-15T10:00:00').getTime()
    expect(formatDateLabel(ts)).toBe('06-15')
  })
})
```

- [ ] **Step 2: 运行测试验证失败**

Run: `pnpm vitest run src/utils/__tests__/ComputedTime.test.ts`
Expected: FAIL — `formatChatTime` 和 `formatDateLabel` 未导出

- [ ] **Step 3: 实现 formatChatTime 和 formatDateLabel**

在 `src/utils/ComputedTime.ts` 中，将 `timeToStr`、`formatTimestamp`、`formatMessageTime` 合并为 `formatChatTime`，将 `formatDateGroupLabel` 重命名为 `formatDateLabel`：

```ts
/**
 * 统一消息时间格式化（合并 timeToStr + formatTimestamp + formatMessageTime）
 *
 * 规则（detail=false，默认）：
 * - 无效时间：空字符串
 * - 未来时间：YYYY-MM-DD HH:mm
 * - < 1 分钟：刚刚
 * - < 1 小时：X 分钟前
 * - 今天：HH:mm
 * - 昨天：昨天 HH:mm
 * - 本周：星期几 HH:mm
 * - 跨年：YYYY-MM-DD
 * - 更早：YYYY-MM-DD HH:mm
 *
 * 规则（detail=true）：
 * - 今天：HH:mm:ss
 * - 跨年：YYYY-MM-DD HH:mm:ss
 * - 同年非今天：MM-DD HH:mm:ss
 */
export const formatChatTime = (timestamp: number, opts?: { detail?: boolean }): string => {
  const ts = Number(timestamp)
  if (!Number.isFinite(ts) || ts <= 0) return ''

  const now = dayjs()
  const date = dayjs(ts)
  const i18n = useI18nGlobal()

  // detail 模式：显示完整日期时间
  if (opts?.detail) {
    if (now.year() !== date.year()) {
      return date.format('YYYY-MM-DD HH:mm:ss')
    }
    if (now.isSame(date, 'day')) {
      return date.format('HH:mm:ss')
    }
    return date.format('MM-DD HH:mm:ss')
  }

  // 非 detail 模式：智能格式化
  const nowMs = Date.now()
  const diff = nowMs - ts

  // 容错：未来时间直接显示绝对时间
  if (diff < 0) {
    return date.format('YYYY-MM-DD HH:mm')
  }

  // < 1 分钟：刚刚
  if (diff < 60_000) {
    return i18n.t('common.just_now')
  }

  // < 1 小时：X 分钟前
  if (diff < 3_600_000) {
    const minutes = Math.floor(diff / 60_000)
    return i18n.t('common.minutes_ago', { count: minutes })
  }

  // 跨年：YYYY-MM-DD
  if (now.year() !== date.year()) {
    return date.format('YYYY-MM-DD')
  }

  // 今天：HH:mm
  if (now.isSame(date, 'day')) {
    return date.format('HH:mm')
  }

  // 昨天：昨天 HH:mm
  if (now.subtract(1, 'day').isSame(date, 'day')) {
    return `${i18n.t('menu.yesterday')} ${date.format('HH:mm')}`
  }

  // 本周：星期几 HH:mm
  if (diff < 7 * 86_400_000) {
    return date.format('dddd HH:mm')
  }

  // 更早：YYYY-MM-DD HH:mm
  return date.format('YYYY-MM-DD HH:mm')
}

/**
 * 格式化日期分组标签（用于聊天历史等场景）
 * @param timestamp 时间戳
 * @returns 格式化后的日期字符串（今天/昨天/MM-DD）
 */
export const formatDateLabel = (timestamp: number): string => {
  const date = dayjs(timestamp)
  const now = dayjs()
  const i18n = useI18nGlobal()

  if (now.isSame(date, 'day')) {
    return i18n.t('menu.today')
  } else if (now.subtract(1, 'day').isSame(date, 'day')) {
    return i18n.t('menu.yesterday')
  } else {
    return date.format('MM-DD')
  }
}
```

删除旧的 `timeToStr`、`formatTimestamp`、`formatMessageTime`、`formatDateGroupLabel` 函数。保留 `setDayjsLocale`、`isDiffNow`、`handRelativeTime`、`getWeekday` 不变。

- [ ] **Step 4: 运行测试验证通过**

Run: `pnpm vitest run src/utils/__tests__/ComputedTime.test.ts`
Expected: PASS

- [ ] **Step 5: 更新所有引用文件**

逐个更新 12 个引用文件，将旧函数名替换为新函数名：

| 旧函数 | 新函数 | 注意 |
|--------|--------|------|
| `timeToStr(ts)` | `formatChatTime(ts)` | 无 detail 参数 |
| `formatTimestamp(ts, false)` | `formatChatTime(ts)` | 默认 detail=false |
| `formatTimestamp(ts, true)` | `formatChatTime(ts, { detail: true })` | 传 detail 选项 |
| `formatTimestamp(ts)` | `formatChatTime(ts)` | 默认 detail=false |
| `formatMessageTime(ts)` | `formatChatTime(ts)` | 行为一致 |
| `formatDateGroupLabel(ts)` | `formatDateLabel(ts)` | 仅重命名 |

对每个文件：
1. 更新 import 语句中的函数名
2. 更新调用点的函数名
3. 对于 `formatTimestamp(ts, true)` 调用，改为 `formatChatTime(ts, { detail: true })`

**注意**：以下文件有本地定义的 `formatTimestamp` 函数（不是从 ComputedTime 导入），不要修改它们：
- `src/views/settingsWindow/tabs/PushSettings.vue:469` — 本地函数
- `src/views/admin/AdminTelemetry.vue:247` — 本地函数
- `src/views/admin/AdminExternalServices.vue:238` — 本地函数
- `src/views/admin/AdminBackgroundUpdates.vue:190` — 本地函数
- `src/components/room/DelayedEventsPanel.vue:140` — 本地函数
- `src/components/admin/FeatureFlagManager.vue:206` — 本地函数
- `src/components/search/SearchPane.vue:310` — 本地 `formatMessageTime`

- [ ] **Step 6: 跑全局验收命令**

```bash
pnpm vue-tsc --noEmit
pnpm test:run
pnpm check
pnpm check:ratchet
```

- [ ] **Step 7: 提交**

```bash
git add src/utils/ComputedTime.ts src/utils/__tests__/ComputedTime.test.ts src/components/room/PinnedMessageBanner.vue src/composables/workbench/useSessionListState.ts src/components/search/SpotlightDialog.vue src/components/rightBox/renderMessage/RenderPollMessage.vue src/components/chat/ChatHistoryDrawer.vue src/components/chat/MultiMsgDrawer.vue src/views/chatHistory/index.vue src/views/multiMsgWindow/index.vue src/components/room/AnnouncementPanel.vue src/plugins/robot/layout/Left.vue src/components/rightBox/renderMessage/TjgMessageMeta.vue src/components/rightBox/renderMessage/Announcement.vue
git commit -m "refactor(util): 合并 ComputedTime 4 个时间格式化函数为 formatChatTime + formatDateLabel (2.4.1)"
```

---

## Task 2: MacCloseButton.vue 抽取

**Files:**
- Create: `src/components/common/MacCloseButton.vue`
- Modify: `src/layout/left/components/definePlugins/index.vue:19` — 替换 mac-close div
- Modify: `src/layout/left/components/InfoEdit.vue:8` — 替换 mac-close div
- Modify: `src/layout/left/model.tsx:87,299` — 替换 mac-close div（.tsx 文件）
- Modify: `src/views/registerWindow/index.vue:199` — 替换 mac-close div
- Modify: `src/components/rightBox/location/LocationModal.vue:9` — 替换 mac-close div
- Modify: `src/components/rightBox/FileUploadModal.vue:13` — 替换 mac-close div
- Modify: `src/components/common/AvatarCropper.vue:14` — 替换 mac-close div
- Modify: `src/components/rightBox/chatBox/ChatModals.vue:8,35` — 替换 2 处 mac-close div
- Modify: `src/components/rightBox/chatBox/ChatMsgMultiChoose.vue:27,122` — 替换 2 处 mac-close div
- Modify: `src/layout/left/style.scss:56-60` — 删除 `.mac-close:hover` 规则
- Modify: `src/styles/scss/render-message.scss:83-87` — 删除 `.mac-close:hover` 规则
- Modify: `src/layout/left/components/InfoEdit.vue:255-259` — 删除 scoped `.mac-close:hover` 规则
- Modify: `src/components/common/AvatarCropper.vue:227-229` — 删除 scoped `.mac-close:hover` 规则
- Test: `src/components/common/__tests__/MacCloseButton.test.ts`

**Interfaces:**
- Produces: `MacCloseButton` props: `{ color?: 'primary' | 'danger'; class?: string }`；emits: `{ click: [event: MouseEvent] }`
- 默认 `color="danger"`（红色关闭按钮），`color="primary"` 用于 definePlugins/InfoEdit 的绿色变体

- [ ] **Step 1: 写失败测试 — MacCloseButton 组件存在性**

```ts
// src/components/common/__tests__/MacCloseButton.test.ts
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MacCloseButton from '../MacCloseButton.vue'

describe('MacCloseButton', () => {
  it('renders a circular button with SVG close icon', () => {
    const wrapper = mount(MacCloseButton, {
      global: {
        stubs: { 'n-icon': true }
      }
    })
    expect(wrapper.find('.mac-close-button').exists()).toBe(true)
    expect(wrapper.find('svg').exists()).toBe(true)
  })

  it('applies danger color by default', () => {
    const wrapper = mount(MacCloseButton, {
      global: { stubs: { 'n-icon': true } }
    })
    expect(wrapper.classes()).toContain('mac-close-button--danger')
  })

  it('applies primary color when specified', () => {
    const wrapper = mount(MacCloseButton, {
      props: { color: 'primary' },
      global: { stubs: { 'n-icon': true } }
    })
    expect(wrapper.classes()).toContain('mac-close-button--primary')
  })

  it('emits click event when clicked', async () => {
    const wrapper = mount(MacCloseButton, {
      global: { stubs: { 'n-icon': true } }
    })
    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toHaveLength(1)
  })

  it('accepts extra class names', () => {
    const wrapper = mount(MacCloseButton, {
      attrs: { class: 'custom-position' },
      global: { stubs: { 'n-icon': true } }
    })
    expect(wrapper.classes()).toContain('custom-position')
  })
})
```

- [ ] **Step 2: 运行测试验证失败**

Run: `pnpm vitest run src/components/common/__tests__/MacCloseButton.test.ts`
Expected: FAIL — 组件不存在

- [ ] **Step 3: 创建 MacCloseButton.vue**

```vue
<!-- src/components/common/MacCloseButton.vue -->
<template>
  <div
    class="mac-close-button"
    :class="[colorClass, $attrs.class]"
    v-bind="$attrs"
    @click="$emit('click', $event)">
    <svg class="mac-close-button__icon hidden"><use href="#close" /></svg>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    color?: 'primary' | 'danger'
  }>(),
  {
    color: 'danger'
  }
)

defineEmits<{
  click: [event: MouseEvent]
}>()

const colorClass = computed(() => `mac-close-button--${props.value}`)
</script>

<style scoped lang="scss">
.mac-close-button {
  width: 13px;
  height: 13px;
  border-radius: 50%;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.1);
  cursor: pointer;
  user-select: none;
  display: flex;
  align-items: center;
  justify-content: center;
}

.mac-close-button--danger {
  background: var(--tjg-color-danger-500);
}

.mac-close-button--primary {
  background: var(--tjg-color-primary-500);
}

.mac-close-button__icon {
  width: 8px;
  height: 8px;
  color: white;
}

.mac-close-button:hover .mac-close-button__icon {
  display: block;
}
</style>
```

注意：`hidden` 类是 UnoCSS 的 `display: none` 工具类，hover 时 CSS 覆盖为 `display: block`。

- [ ] **Step 4: 运行测试验证通过**

Run: `pnpm vitest run src/components/common/__tests__/MacCloseButton.test.ts`
Expected: PASS

- [ ] **Step 5: 替换 12 处 mac-close div**

对每个文件，将 `<div class="mac-close ...">` 替换为 `<MacCloseButton />`，保留位置相关的 class 通过 attr 传递。

替换规则：
- `bg-[--tjg-color-primary-500]` → `<MacCloseButton color="primary" />`
- `bg-[--tjg-color-danger-500]` / `bg-[--hula-color-danger-500]` → `<MacCloseButton color="danger" />`（默认，可省略）
- 无背景色 → `<MacCloseButton color="danger" />`（LocationModal 添加默认色）
- `v-if="isMac()"` 保留在组件外层或通过 `v-if` 包裹
- `@click="xxx = false"` → `@click="xxx = false"`（事件直接绑定到组件）
- 位置相关 class（`absolute left-6px mt-6px z-999` 等）通过 `:class` 或直接写在组件上

示例替换（ChatModals.vue:8）：
```vue
<!-- 旧 -->
<div v-if="isMac()" @click="modalShow = false" class="mac-close z-999 size-13px shadow-inner bg-[--tjg-color-danger-500] rounded-50% select-none absolute left-6px">
  <svg class="hidden"><use href="#close" /></svg>
</div>

<!-- 新 -->
<MacCloseButton v-if="isMac()" class="z-999 absolute left-6px" @click="modalShow = false" />
```

对 `.tsx` 文件（model.tsx），使用 `<MacCloseButton onClick={() => (modalShow.value = false)} />`。

- [ ] **Step 6: 删除 4 处重复 CSS 规则**

删除以下文件中的 `.mac-close:hover` 规则（组件已有 scoped 样式）：
1. `src/layout/left/style.scss:56-60`
2. `src/styles/scss/render-message.scss:83-87`
3. `src/layout/left/components/InfoEdit.vue` style 块中的 `.mac-close:hover`
4. `src/components/common/AvatarCropper.vue` style 块中的 `.mac-close:hover`

- [ ] **Step 7: 跑全局验收命令**

```bash
pnpm vue-tsc --noEmit
pnpm test:run
pnpm check
pnpm check:ratchet
```

- [ ] **Step 8: 提交**

```bash
git add src/components/common/MacCloseButton.vue src/components/common/__tests__/MacCloseButton.test.ts src/layout/ src/views/registerWindow/index.vue src/components/rightBox/location/LocationModal.vue src/components/rightBox/FileUploadModal.vue src/components/common/AvatarCropper.vue src/components/rightBox/chatBox/ChatModals.vue src/components/rightBox/chatBox/ChatMsgMultiChoose.vue src/styles/scss/render-message.scss
git commit -m "refactor(ui): 抽取 MacCloseButton 组件统一 12 处 mac-close div 模式 (2.4.3)"
```

---

## Task 3: usePlatformClose composable 抽取

**Files:**
- Create: `src/composables/common/usePlatformClose.ts`
- Modify: `src/components/windows/ActionBar.vue:374` — 替换 `appWindow.close()`
- Modify: `src/views/imageViewerWindow/index.vue:371` — 替换 `appWindow?.close()`
- Modify: `src/views/windowChat/index.vue:55` — 替换 `window.close()`
- Modify: `src/mobile/views/my/MobileQRCode.vue:74,82` — 替换 2 处 `window.close()`
- Modify: `src/views/CheckUpdate.vue:210` — 替换 `window.close()`
- Test: `src/composables/common/__tests__/usePlatformClose.test.ts`

**Interfaces:**
- Produces: `usePlatformClose()` 返回 `{ closeCurrentWindow: () => Promise<void>, closeWindowByLabel: (label: string) => Promise<void> }`

- [ ] **Step 1: 写失败测试 — usePlatformClose 存在性和行为**

```ts
// src/composables/common/__tests__/usePlatformClose.test.ts
import { describe, expect, it, vi, beforeEach } from 'vitest'

// Mock Tauri APIs
const mockClose = vi.fn().mockResolvedValue(undefined)
const mockGetByLabel = vi.fn()

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    close: mockClose,
    label: 'test-window'
  }),
  WebviewWindow: {
    getByLabel: mockGetByLabel
  }
}))

vi.mock('@tauri-apps/api', () => ({
  window: {
    getCurrentWindow: () => ({
      close: mockClose,
      label: 'test-window'
    }),
    WebviewWindow: {
      getByLabel: mockGetByLabel
    }
  }
}))

import { usePlatformClose } from '../usePlatformClose'

describe('usePlatformClose', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns closeCurrentWindow and closeWindowByLabel functions', () => {
    const { closeCurrentWindow, closeWindowByLabel } = usePlatformClose()
    expect(typeof closeCurrentWindow).toBe('function')
    expect(typeof closeWindowByLabel).toBe('function')
  })

  it('closeCurrentWindow calls getCurrentWindow().close()', async () => {
    const { closeCurrentWindow } = usePlatformClose()
    await closeCurrentWindow()
    expect(mockClose).toHaveBeenCalledOnce()
  })

  it('closeWindowByLabel closes a window by its label', async () => {
    const mockWindowClose = vi.fn().mockResolvedValue(undefined)
    mockGetByLabel.mockResolvedValue({ close: mockWindowClose })
    const { closeWindowByLabel } = usePlatformClose()
    await closeWindowByLabel('login')
    expect(mockGetByLabel).toHaveBeenCalledWith('login')
    expect(mockWindowClose).toHaveBeenCalledOnce()
  })

  it('closeWindowByLabel does nothing if window not found', async () => {
    mockGetByLabel.mockResolvedValue(null)
    const { closeWindowByLabel } = usePlatformClose()
    await closeWindowByLabel('nonexistent')
    expect(mockGetByLabel).toHaveBeenCalledWith('nonexistent')
    // Should not throw
  })
})
```

- [ ] **Step 2: 运行测试验证失败**

Run: `pnpm vitest run src/composables/common/__tests__/usePlatformClose.test.ts`
Expected: FAIL — 模块不存在

- [ ] **Step 3: 创建 usePlatformClose.ts**

```ts
// src/composables/common/usePlatformClose.ts
import { getCurrentWindow, WebviewWindow } from '@tauri-apps/api/window'

/**
 * 统一窗口关闭逻辑
 * 封装 Tauri 窗口关闭 API，避免混用 appWindow.close() 和 window.close()
 */
export function usePlatformClose() {
  /**
   * 关闭当前窗口
   * 统一使用 Tauri 的 getCurrentWindow().close()
   */
  const closeCurrentWindow = async (): Promise<void> => {
    await getCurrentWindow().close()
  }

  /**
   * 按 label 关闭指定窗口
   * 用于跨窗口关闭场景（如 CheckUpdate 关闭 login 窗口）
   */
  const closeWindowByLabel = async (label: string): Promise<void> => {
    const win = await WebviewWindow.getByLabel(label)
    if (win) {
      await win.close()
    }
  }

  return { closeCurrentWindow, closeWindowByLabel }
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `pnpm vitest run src/composables/common/__tests__/usePlatformClose.test.ts`
Expected: PASS

- [ ] **Step 5: 替换 6 处窗口关闭调用**

**1. ActionBar.vue:374**（`handleCloseWin` 函数内）：
```ts
// 旧
import { appWindow } from '@tauri-apps/api/window'
// ...
await appWindow.close()

// 新
import { usePlatformClose } from '@/composables/common/usePlatformClose'
const { closeCurrentWindow } = usePlatformClose()
// ...
await closeCurrentWindow()
```

**2. imageViewerWindow/index.vue:371**（`handleKeydown` 函数内）：
```ts
// 旧
appWindow?.close()

// 新
const { closeCurrentWindow } = usePlatformClose()
// ...
await closeCurrentWindow()
```

**3. windowChat/index.vue:55**（`onMounted` 回调内）：
```ts
// 旧
window.close()

// 新
const { closeCurrentWindow } = usePlatformClose()
// ...
await closeCurrentWindow()
```

**4-5. MobileQRCode.vue:74,82**（`startScan` 函数内）：
```ts
// 旧（两处）
window.close()

// 新
const { closeCurrentWindow } = usePlatformClose()
// ...
await closeCurrentWindow()
```

**6. CheckUpdate.vue:210**（`doUpdate` 函数内）：
```ts
// 旧
windows.forEach((window) => {
  if (window.label === 'login' || window.label === 'home' || window.label === 'checkupdate') {
    window.close()
  }
})

// 新
const { closeWindowByLabel } = usePlatformClose()
// ...
for (const label of ['login', 'home', 'checkupdate']) {
  await closeWindowByLabel(label)
}
```

- [ ] **Step 6: 跑全局验收命令**

```bash
pnpm vue-tsc --noEmit
pnpm test:run
pnpm check
pnpm check:ratchet
```

- [ ] **Step 7: 提交**

```bash
git add src/composables/common/usePlatformClose.ts src/composables/common/__tests__/usePlatformClose.test.ts src/components/windows/ActionBar.vue src/views/imageViewerWindow/index.vue src/views/windowChat/index.vue src/mobile/views/my/MobileQRCode.vue src/views/CheckUpdate.vue
git commit -m "refactor(util): 抽取 usePlatformClose 统一窗口关闭逻辑 (2.4.2)"
```

---

## Task 4: isMobile() 模板调用消除

**Files:**
- Modify: `src/components/rightBox/renderMessage/Text.vue:2` — 1 处
- Modify: `src/components/rightBox/renderMessage/AudioCall.vue:10` — 1 处
- Modify: `src/components/rightBox/renderMessage/VideoCall.vue:10` — 1 处
- Modify: `src/components/rightBox/emoticon/index.vue:5,18,35,66,99` — 5 处
- Modify: `src/components/rightBox/renderMessage/index.vue:122,157,191,262` — 4 处
- Modify: `src/components/common/ContextMenu.vue:46,121` — 2 处
- Modify: `src/components/rightBox/chatBox/ChatFooter.vue:5,23,43,62` — 4 处
- Modify: `src/components/rightBox/chatBox/ChatBanners.vue:49` — 1 处

**Interfaces:**
- 参照 `MsgInput.vue:221-222` 的模式：`const isMobileRef = computed(() => isMobile())`，模板内用 `isMobileRef` 替代 `isMobile()`

- [ ] **Step 1: 对每个文件应用 isMobileRef 模式**

对 7 个文件逐一修改：

**模式**：
1. 在 `<script setup>` 中添加 `import { computed } from 'vue'`（若未导入）
2. 在 `<script setup>` 中添加 `import { isMobile } from '@/utils/common'`（若未导入）
3. 添加 `const isMobileRef = computed(() => isMobile())`
4. 模板中将所有 `isMobile()` 替换为 `isMobileRef`

**具体替换示例**：

Text.vue:2:
```vue
<!-- 旧 -->
<div :class="isMobile() ? 'text-16px' : 'text-14px'">
<!-- 新 -->
<div :class="isMobileRef ? 'text-16px' : 'text-14px'">
```

emoticon/index.vue:66（style 绑定内）:
```vue
<!-- 旧 -->
gap: isMobile() ? '8px' : '12px'
<!-- 新 -->
gap: isMobileRef ? '8px' : '12px'
```

ContextMenu.vue:46,121（v-if 条件内）:
```vue
<!-- 旧 -->
v-if="!isMobile() && showMenu && ..."
<!-- 新 -->
v-if="!isMobileRef && showMenu && ..."
```

ChatBanners.vue:49:
```vue
<!-- 旧 -->
<div v-if="!isMobile() && !isGroup" class="private-mode-bar ...">
<!-- 新 -->
<div v-if="!isMobileRef && !isGroup" class="private-mode-bar ...">
```

**注意**：
- 每个文件只需一个 `isMobileRef` computed，不要重复定义
- 如果文件已有 `isMobile` 的 import 但只在 script 中使用，模板中新增 `isMobileRef` 即可
- `renderMessage/index.vue` 已有 3 处 script 中的 `isMobile()` 调用（lines 385, 464, 521），这些保持不变（只改模板内的调用）
- `ChatFooter.vue` 已有 2 处 script 中的 `isMobile()` 调用（lines 299, 313），这些保持不变

- [ ] **Step 2: 跑全局验收命令**

```bash
pnpm vue-tsc --noEmit
pnpm test:run
pnpm check
pnpm check:ratchet
```

- [ ] **Step 3: 验证模板内 isMobile() 调用为 0**

Run: `grep -rn "isMobile()" src/ --include="*.vue" | grep -v "<script" | grep -v "isMobileRef"`
Expected: 0 匹配（或仅在 `<script>` 块内）

更精确的验证：
```bash
grep -rn "isMobile()" src/components/rightBox/renderMessage/Text.vue src/components/rightBox/renderMessage/AudioCall.vue src/components/rightBox/renderMessage/VideoCall.vue src/components/rightBox/emoticon/index.vue src/components/rightBox/renderMessage/index.vue src/components/common/ContextMenu.vue src/components/rightBox/chatBox/ChatFooter.vue src/components/rightBox/chatBox/ChatBanners.vue
```
Expected: 仅在 `<script setup>` 块内有匹配，模板内无匹配

- [ ] **Step 4: 提交**

```bash
git add src/components/rightBox/renderMessage/Text.vue src/components/rightBox/renderMessage/AudioCall.vue src/components/rightBox/renderMessage/VideoCall.vue src/components/rightBox/emoticon/index.vue src/components/rightBox/renderMessage/index.vue src/components/common/ContextMenu.vue src/components/rightBox/chatBox/ChatFooter.vue src/components/rightBox/chatBox/ChatBanners.vue
git commit -m "refactor(chat): 消除 7 个文件 19 处模板内 isMobile() 调用为 isMobileRef (2.4.5)"
```
