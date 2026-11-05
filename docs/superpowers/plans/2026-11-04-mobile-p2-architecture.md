# 移动端 P2 架构与原生感整改 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 收敛移动端平台判定与断点事实源，移除群成员页的桌面组件依赖，补齐登录页/返回栈/字号/兼容性兜底，消除 P1 遗留死代码。

**Architecture:** 先建立三个可单测的纯函数层（`platformDetection`、`useMobileBreakpoint`、`useSafeBack`），再让 UI 层消费它们；组件整改遵循「Vant 优先、单层滚动、无 `isMobile()` 内联分支」；样式兜底只改 token 层与移动端样式文件，不引入新硬编码颜色。

**Tech Stack:** Vue 3 `<script setup>` + TypeScript + Vite 7 + Pinia + UnoCSS + SCSS + Vant 4 + Vitest + vue-i18n。

## Global Constraints

- 所有新代码禁止硬编码颜色，只允许 `--tjg-*` token；新增 token 仅限 `src/styles/css/design-tokens.css`。
- 图标必须为 SVG（`<svg><use /></svg>` 或 Iconify），线宽 1.5px；禁止 div 拼图标。
- 任何 `.vue` 文件 ≤ 800 行，新建 `.ts` 文件 < 400 行；不得抬高 `meta/file-size-baseline.json`。
- 禁止新增 `isMobile()` 内联分支；移动端代码不得 import `@/views/admin`、`@/plugins/robot`、`@/services/matrix/ai`、`@/services/siliconflow`、`@/services/trendradar`。
- 不得新增平行 Matrix API；Matrix 能力只走 `src/services/matrix/**`。
- 动效必须尊重 `prefers-reduced-motion`（本计划不新增动画，仅改写既有 transition 的触发方式）。
- 提交信息使用 Conventional Commits，scope 仅允许 `ui`（本轮统一 `fix(ui)` / `refactor(ui)` / `feat(ui)`）。
- 所有门禁命令必须带 Node 22 前缀：`PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm <cmd>`。
- 每个任务结束必须跑：`vue-tsc --noEmit`、相关 `vitest run <path>`、`check`。

## 已确认事实（执行者不要重新调研）

- `vue-router@^5` 的 `Router` 类型**没有** `canGoBack`；判断能否返回只能用 `window.history.state?.back`。
- 朝向的唯一实时来源是 `src/composables/useLandscape.ts`；`src/composables/usePlatform.ts` 里的 `isLandscape` 是启动时快照且无运行时消费者，本计划直接删除它。
- 桌面断点 `src/composables/layout/useResponsiveBreakpoint.ts` 已存在（1200/992/768），移动端不得复用或修改它。
- 移动端语言包在仓库根 `locales/{zh-CN,en}/<namespace>.json`，命名空间文件名即 key 前缀（`mobile_tabbar.*`、`mobile_setting.*`、`mobile_my.*`）。
- `src/App.vue:450` 已调用 `applyFontScale(loadFontScale())`，启动应用字号不需要额外改动。
- `src/router/routes/mobile.ts` 只在 `:247` 引用 `@/mobile/views/chat-room/ManageGroupMember.vue`；该组件不存在桌面路由引用。
- 群成员页外层由 `ChatRoomLayout` 提供 `MobileLayout` 与高度，页面本身**不得再嵌套** `MobileLayout`。
- Vant 按钮提交表单必须用 `native-type="submit"`（`type` 控制颜色，不控制表单语义）。

## 文件结构

| 文件 | 动作 | 职责 |
| :--- | :--- | :--- |
| `src/utils/platformDetection.ts` | 新建 | 平台判定的纯函数：query/storage 覆盖、osType → platformType、TAURI_ENV_PLATFORM 映射 |
| `src/utils/__tests__/platformDetection.test.ts` | 新建 | 上表纯函数单测 |
| `src/utils/PlatformConstants.ts` | 修改 | 复用 `resolvePlatformType`，删除私有 `isDesktopOS` |
| `src/utils/AppHarness.ts` | 修改 | `detectAppPlatform` 复用 `readRequestedPlatform` / `resolvePlatformType` |
| `src/composables/usePlatform.ts` | 修改 | 删除 `isLandscape`（含 `PlatformInfo` 字段），复用 `resolveTauriPlatform` |
| `src/composables/__tests__/usePlatform.test.ts` | 修改 | 删除 `isLandscape` 断言 |
| `src/mobile/composables/useMobileBreakpoint.ts` | 新建 | 移动端三档断点（compact/medium/expanded） |
| `src/mobile/composables/__tests__/useMobileBreakpoint.test.ts` | 新建 | 断点边界单测 |
| `src/mobile/layout/index.vue` | 修改 | 侧边导航条件改为 `isLandscape || isExpanded` |
| `src/mobile/composables/useSafeBack.ts` | 新建 | 冷启动无历史栈时的安全返回 |
| `src/mobile/composables/__tests__/useSafeBack.test.ts` | 新建 | `resolveBackAction` 单测 |
| `src/mobile/components/chat-room/HeaderBar.vue` | 修改 | `handleBack` 改用 `useSafeBack` |
| `src/mobile/views/chat-room/ManageGroupMember.vue` | 重写 | 纯 Vant + 单层滚动 |
| `src/mobile/views/chat-room/__tests__/manageGroupMember.structure.test.ts` | 新建 | 结构守卫 |
| `src/mobile/views/chat-room/MobileInviteGroupMember.vue` | 修改 | 去掉 JS 高度与内层滚动 |
| `src/mobile/components/my/Settings.vue` | 修改 | 32px 图标补 48px 热区 + `aria-label` |
| `src/mobile/layout/tabBar/index.vue` | 修改 | `aria-label` 走 i18n |
| `src/mobile/views/my/MobileSettings.vue` | 修改 | 外观区新增字号四档 |
| `src/mobile/login.vue` | 修改 | 去绝对定位，改纵向流式；指示条改 transform |
| `src/mobile/components/login/MobileLoginForm.vue` | 修改 | `<form>` 语义 + 自动填充提示 + 提交按钮 |
| `src/mobile/__tests__/loginLayout.test.ts` | 新建 | 登录页布局/表单语义守卫 |
| `src/styles/css/design-tokens.css` | 修改 | `@supports not (color-mix)` 兜底块 |
| `src/styles/__tests__/colorMixFallback.test.ts` | 新建 | token 兜底完整性守卫 |
| `src/styles/scss/mixins/_liquid-glass.scss` | 修改 | 暗色选择器去 `:global` |
| `src/styles/__tests__/liquid-glass.test.ts` | 修改 | 追加全文件 `:global` 禁令 |
| `src/mobile/components/chat-room/FooterBar.vue` | 修改 | 删除无消费者的 `updateHeight` 与 ResizeObserver |
| `src/mobile/views/chat-room/MobileChatMain.vue` | 修改 | 删除未使用的 `ref="footerBar"` |
| `locales/zh-CN/*.json`、`locales/en/*.json` | 修改 | 新增 i18n key |

### 显式延后（本计划不实现，勿擅自添加）

- 平板竖屏 master-detail 双列（会与 `SmartVirtualList` 虚拟滚动、返回栈冲突，需真机验证）。
- `clampMenuPosition` 8px 内移、字体栈重复、`setLongPressMenuTop` flush 顺序、`SmartVirtualList` 仅监听 `items.length`。
- 桌面 `SettingsSidebar.vue` / `SettingsContent.vue` / `TjgSpaceJoinCta.vue` 等桌面端 `color-mix` 兜底（旧 Android WebView 不跑桌面端）。

---

### Task 1: 平台判定单一事实源（P2-1）

**Files:**
- Create: `src/utils/platformDetection.ts`
- Test: `src/utils/__tests__/platformDetection.test.ts`
- Modify: `src/utils/PlatformConstants.ts:48`（替换 `_platformType` 赋值）、删除私有 `isDesktopOS`
- Modify: `src/utils/AppHarness.ts:63-69`、`src/utils/AppHarness.ts:99-115`
- Modify: `src/composables/usePlatform.ts`（删除 `isLandscape`）
- Modify: `src/composables/__tests__/usePlatform.test.ts`

**Interfaces:**
- Produces:
  - `type RuntimePlatform = 'desktop' | 'mobile'`
  - `PLATFORM_QUERY_KEY = 'platform'`、`PLATFORM_STORAGE_KEY = 'tjg:e2e:platform'`
  - `normalizeRequestedPlatform(value: string | null | undefined): RuntimePlatform | null`
  - `readRequestedPlatform(search?: string, storage?: Pick<Storage, 'getItem'> | null): RuntimePlatform | null`
  - `resolvePlatformType(osType: string): RuntimePlatform`
  - `resolveTauriPlatform(envPlatform: string | undefined): RuntimePlatform | null`
- Consumes: 无（本任务是最底层）

- [ ] **Step 1: 写失败测试**

```ts
// src/utils/__tests__/platformDetection.test.ts
import { describe, expect, it } from 'vitest'
import {
  normalizeRequestedPlatform,
  PLATFORM_QUERY_KEY,
  PLATFORM_STORAGE_KEY,
  readRequestedPlatform,
  resolvePlatformType,
  resolveTauriPlatform,
} from '../platformDetection'

const storageWith = (value: string | null) => ({ getItem: () => value })

describe('normalizeRequestedPlatform', () => {
  it('只接受 desktop / mobile', () => {
    expect(normalizeRequestedPlatform('mobile')).toBe('mobile')
    expect(normalizeRequestedPlatform('desktop')).toBe('desktop')
    expect(normalizeRequestedPlatform('ios')).toBeNull()
    expect(normalizeRequestedPlatform(null)).toBeNull()
  })
})

describe('readRequestedPlatform', () => {
  it('query 优先于 storage', () => {
    expect(readRequestedPlatform(`?${PLATFORM_QUERY_KEY}=mobile`, storageWith('desktop'))).toBe('mobile')
  })

  it('query 缺失时回落 storage', () => {
    expect(readRequestedPlatform('', storageWith('mobile'))).toBe('mobile')
  })

  it('两者都无效时返回 null', () => {
    expect(readRequestedPlatform('', storageWith('nope'))).toBeNull()
    expect(readRequestedPlatform('', null)).toBeNull()
    expect(PLATFORM_STORAGE_KEY).toBe('tjg:e2e:platform')
  })
})

describe('resolvePlatformType', () => {
  it('android / ios 为 mobile，其余为 desktop', () => {
    expect(resolvePlatformType('android')).toBe('mobile')
    expect(resolvePlatformType('ios')).toBe('mobile')
    expect(resolvePlatformType('windows')).toBe('desktop')
    expect(resolvePlatformType('macos')).toBe('desktop')
    expect(resolvePlatformType('linux')).toBe('desktop')
    expect(resolvePlatformType('')).toBe('desktop')
  })
})

describe('resolveTauriPlatform', () => {
  it('映射 Tauri 环境变量', () => {
    expect(resolveTauriPlatform('android')).toBe('mobile')
    expect(resolveTauriPlatform('ios')).toBe('mobile')
    expect(resolveTauriPlatform('darwin')).toBe('desktop')
    expect(resolveTauriPlatform('windows')).toBe('desktop')
    expect(resolveTauriPlatform(undefined)).toBeNull()
    expect(resolveTauriPlatform('')).toBeNull()
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

```bash
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vitest run src/utils/__tests__/platformDetection.test.ts
```

Expected: FAIL，报 `Failed to resolve import "../platformDetection"`。

- [ ] **Step 3: 实现纯函数**

```ts
// src/utils/platformDetection.ts
export type RuntimePlatform = 'desktop' | 'mobile'

export const PLATFORM_QUERY_KEY = 'platform'
export const PLATFORM_STORAGE_KEY = 'tjg:e2e:platform'

export function normalizeRequestedPlatform(value: string | null | undefined): RuntimePlatform | null {
  return value === 'mobile' || value === 'desktop' ? value : null
}

export function readRequestedPlatform(
  search: string = typeof window === 'undefined' ? '' : window.location.search,
  storage: Pick<Storage, 'getItem'> | null = typeof window === 'undefined' ? null : window.localStorage
): RuntimePlatform | null {
  const fromQuery = normalizeRequestedPlatform(new URLSearchParams(search).get(PLATFORM_QUERY_KEY))
  if (fromQuery) return fromQuery
  return normalizeRequestedPlatform(storage?.getItem(PLATFORM_STORAGE_KEY) ?? null)
}

export function resolvePlatformType(osType: string): RuntimePlatform {
  return osType === 'android' || osType === 'ios' ? 'mobile' : 'desktop'
}

export function resolveTauriPlatform(envPlatform: string | undefined): RuntimePlatform | null {
  if (!envPlatform) return null
  return resolvePlatformType(envPlatform)
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vitest run src/utils/__tests__/platformDetection.test.ts
```

Expected: PASS（4 个 describe 全绿）。

- [ ] **Step 5: 接入 PlatformConstants**

在 `src/utils/PlatformConstants.ts` 顶部增加：

```ts
import { resolvePlatformType } from '@/utils/platformDetection'
```

把 `initialize()` 中第 48 行替换为：

```ts
PlatformDetector._platformType = resolvePlatformType(PlatformDetector._osType)
```

删除 `isDesktopOS` 私有方法（先 `grep -n "isDesktopOS" src/utils/PlatformConstants.ts` 确认只剩定义处）。

- [ ] **Step 6: 接入 AppHarness**

`src/utils/AppHarness.ts` 中：

1. 顶部增加 `import { readRequestedPlatform, resolvePlatformType } from '@/utils/platformDetection'`。
2. 删除本地 `getRequestedPlatform`（第 63-69 行）。
3. 把 `detectAppPlatform` 函数体替换为：

```ts
export const detectAppPlatform = (): AppPlatform => {
  const requestedPlatform = readRequestedPlatform()
  if (requestedPlatform) {
    return requestedPlatform
  }

  try {
    return resolvePlatformType(getOsType())
  } catch {
    // Browser-only E2E runs can safely fall back to desktop.
    return 'desktop'
  }
}
```

4. 若 `PLATFORM_QUERY_KEY` / `PLATFORM_STORAGE_KEY` 常量在文件中不再被引用，删除其本地定义（不要改 `src/utils/platformDetection.ts` 里的导出）。

- [ ] **Step 7: 删除 usePlatform 的 isLandscape**

`src/composables/usePlatform.ts`：

1. `PlatformInfo` 删除 `isLandscape: boolean`。
2. `detectPlatform()` 删除 `isLandscape` 的计算与赋值。
3. 删除本地 `resolveTauriPlatform`，改为从 `@/utils/platformDetection` 导入。
4. `usePlatform()` 返回值删除 `isLandscape`。
5. `src/composables/__tests__/usePlatform.test.ts` 删除所有 `isLandscape` 断言与相关 mock。

- [ ] **Step 8: 跑类型检查与相关测试**

```bash
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vue-tsc --noEmit
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vitest run src/utils/__tests__/platformDetection.test.ts src/composables/__tests__/usePlatform.test.ts
```

Expected: 0 类型错误；两个测试文件全绿。

- [ ] **Step 9: 提交**

```bash
git add src/utils/platformDetection.ts src/utils/__tests__/platformDetection.test.ts src/utils/PlatformConstants.ts src/utils/AppHarness.ts src/composables/usePlatform.ts src/composables/__tests__/usePlatform.test.ts
git commit -m "refactor(ui): 收敛移动端平台判定为单一事实源"
```

---

### Task 2: 移动端断点与侧边导航（P2-3）

**Files:**
- Create: `src/mobile/composables/useMobileBreakpoint.ts`
- Test: `src/mobile/composables/__tests__/useMobileBreakpoint.test.ts`
- Modify: `src/mobile/layout/index.vue`

**Interfaces:**
- Consumes: `useWindowSize`（`@vueuse/core`）、`useLandscape`（`@/composables/useLandscape`）
- Produces:
  - `type MobileBreakpoint = 'compact' | 'medium' | 'expanded'`
  - `MOBILE_BREAKPOINT_COMPACT_MAX = 600`、`MOBILE_BREAKPOINT_MEDIUM_MAX = 1024`
  - `resolveMobileBreakpoint(width: number): MobileBreakpoint`
  - `useMobileBreakpoint(): { width: Ref<number>; breakpoint: ComputedRef<MobileBreakpoint>; isExpanded: ComputedRef<boolean> }`

- [ ] **Step 1: 写失败测试**

```ts
// src/mobile/composables/__tests__/useMobileBreakpoint.test.ts
import { describe, expect, it } from 'vitest'
import { resolveMobileBreakpoint } from '../useMobileBreakpoint'

describe('resolveMobileBreakpoint', () => {
  it('小于 600 为 compact', () => {
    expect(resolveMobileBreakpoint(0)).toBe('compact')
    expect(resolveMobileBreakpoint(599)).toBe('compact')
  })

  it('600 到 1024 为 medium', () => {
    expect(resolveMobileBreakpoint(600)).toBe('medium')
    expect(resolveMobileBreakpoint(768)).toBe('medium')
    expect(resolveMobileBreakpoint(1024)).toBe('medium')
  })

  it('大于 1024 为 expanded', () => {
    expect(resolveMobileBreakpoint(1025)).toBe('expanded')
    expect(resolveMobileBreakpoint(1440)).toBe('expanded')
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

```bash
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vitest run src/mobile/composables/__tests__/useMobileBreakpoint.test.ts
```

Expected: FAIL，模块不存在。

- [ ] **Step 3: 实现**

```ts
// src/mobile/composables/useMobileBreakpoint.ts
import { useWindowSize } from '@vueuse/core'
import { computed } from 'vue'

export type MobileBreakpoint = 'compact' | 'medium' | 'expanded'

export const MOBILE_BREAKPOINT_COMPACT_MAX = 600
export const MOBILE_BREAKPOINT_MEDIUM_MAX = 1024

export function resolveMobileBreakpoint(width: number): MobileBreakpoint {
  if (width < MOBILE_BREAKPOINT_COMPACT_MAX) return 'compact'
  if (width <= MOBILE_BREAKPOINT_MEDIUM_MAX) return 'medium'
  return 'expanded'
}

export function useMobileBreakpoint() {
  const { width } = useWindowSize()
  const breakpoint = computed(() => resolveMobileBreakpoint(width.value || 0))
  const isExpanded = computed(() => breakpoint.value === 'expanded')
  return { width, breakpoint, isExpanded }
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vitest run src/mobile/composables/__tests__/useMobileBreakpoint.test.ts
```

Expected: PASS。

- [ ] **Step 5: 改造布局**

`src/mobile/layout/index.vue` 的 `<script setup>`：

```ts
import { computed } from 'vue'
import { useLandscape } from '@/composables/useLandscape'
import { useMobileBreakpoint } from '#/composables/useMobileBreakpoint'

const { isLandscape } = useLandscape()
const { isExpanded } = useMobileBreakpoint()
const showSidebar = computed(() => isLandscape.value || isExpanded.value)
```

模板中 3 处 `isLandscape` 全部替换为 `showSidebar`：

- `:class="showSidebar ? 'flex flex-row' : 'flex flex-col'"`
- `<div v-if="showSidebar" class="flex-shrink-0 h-full">`
- `<div v-if="!showSidebar" class="flex-shrink-0">`

- [ ] **Step 6: 跑类型检查与既有布局测试**

```bash
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vue-tsc --noEmit
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vitest run src/mobile/composables/__tests__/useMobileBreakpoint.test.ts src/mobile/layout/__tests__/layoutShell.test.ts src/mobile/layout/__tests__/mobileCssGuards.test.ts
```

Expected: 0 类型错误；测试全绿。

- [ ] **Step 7: 提交**

```bash
git add src/mobile/composables/useMobileBreakpoint.ts src/mobile/composables/__tests__/useMobileBreakpoint.test.ts src/mobile/layout/index.vue
git commit -m "feat(ui): 移动端新增三档断点并以展开态驱动侧边导航"
```

### Task 3: 冷启动安全返回（P2-8）

**Files:**
- Create: `src/mobile/composables/useSafeBack.ts`
- Test: `src/mobile/composables/__tests__/useSafeBack.test.ts`
- Modify: `src/mobile/components/chat-room/HeaderBar.vue`（`handleBack`）

**Interfaces:**
- Consumes: `router`（`@/router`）、`window.history.state`
- Produces:
  - `MOBILE_FALLBACK_ROUTE = '/mobile/message'`
  - `type BackAction = { type: 'back' } | { type: 'replace'; path: string }`
  - `resolveBackAction(historyBack: unknown, fallback?: string): BackAction`
  - `useSafeBack(fallback?: string): { goBack: () => void }`

- [ ] **Step 1: 写失败测试**

```ts
// src/mobile/composables/__tests__/useSafeBack.test.ts
import { describe, expect, it } from 'vitest'
import { MOBILE_FALLBACK_ROUTE, resolveBackAction } from '../useSafeBack'

describe('resolveBackAction', () => {
  it('有历史记录时回退', () => {
    expect(resolveBackAction('/mobile/message')).toEqual({ type: 'back' })
  })

  it('无历史记录时替换到兜底路由', () => {
    expect(resolveBackAction(null)).toEqual({ type: 'replace', path: MOBILE_FALLBACK_ROUTE })
    expect(resolveBackAction(undefined)).toEqual({ type: 'replace', path: MOBILE_FALLBACK_ROUTE })
    expect(resolveBackAction('')).toEqual({ type: 'replace', path: MOBILE_FALLBACK_ROUTE })
    expect(resolveBackAction(123)).toEqual({ type: 'replace', path: MOBILE_FALLBACK_ROUTE })
  })

  it('支持自定义兜底路由', () => {
    expect(resolveBackAction(null, '/mobile/home')).toEqual({ type: 'replace', path: '/mobile/home' })
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

```bash
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vitest run src/mobile/composables/__tests__/useSafeBack.test.ts
```

Expected: FAIL，模块不存在。

- [ ] **Step 3: 实现**

```ts
// src/mobile/composables/useSafeBack.ts
import router from '@/router'

export const MOBILE_FALLBACK_ROUTE = '/mobile/message'

export type BackAction = { type: 'back' } | { type: 'replace'; path: string }

export function resolveBackAction(historyBack: unknown, fallback: string = MOBILE_FALLBACK_ROUTE): BackAction {
  if (typeof historyBack === 'string' && historyBack.length > 0) {
    return { type: 'back' }
  }
  return { type: 'replace', path: fallback }
}

export function useSafeBack(fallback: string = MOBILE_FALLBACK_ROUTE) {
  const goBack = () => {
    const action = resolveBackAction(window.history.state?.back, fallback)
    if (action.type === 'back') {
      router.back()
      return
    }
    router.replace(action.path)
  }

  return { goBack }
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vitest run src/mobile/composables/__tests__/useSafeBack.test.ts
```

Expected: PASS。

- [ ] **Step 5: 接入 HeaderBar**

`src/mobile/components/chat-room/HeaderBar.vue`：

1. `<script setup>` 增加 `import { useSafeBack } from '#/composables/useSafeBack'`。
2. 把 `const handleBack = async () => { router.back() }` 替换为：

```ts
const { goBack } = useSafeBack()

const handleBack = () => {
  goBack()
}
```

3. 若 `router` 在该文件已无其他引用，删除 `import router from '@/router'`（用 `grep -n "router\." src/mobile/components/chat-room/HeaderBar.vue` 确认）。

- [ ] **Step 6: 跑类型检查与测试**

```bash
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vue-tsc --noEmit
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vitest run src/mobile/composables/__tests__/useSafeBack.test.ts
```

Expected: 0 类型错误；测试 PASS。

- [ ] **Step 7: 提交**

```bash
git add src/mobile/composables/useSafeBack.ts src/mobile/composables/__tests__/useSafeBack.test.ts src/mobile/components/chat-room/HeaderBar.vue
git commit -m "fix(ui): 移动端返回在无历史栈时回落到消息页"
```

### Task 4: 群成员管理页 Vant 化与单层滚动（P2-2）

**Files:**
- Modify（整体重写）: `src/mobile/views/chat-room/ManageGroupMember.vue`
- Modify: `src/mobile/views/chat-room/MobileInviteGroupMember.vue`
- Test: `src/mobile/views/chat-room/__tests__/manageGroupMember.structure.test.ts`

**Interfaces:**
- Consumes: `useSafeBack`（Task 3）、`HeaderBar`、`groupStore.removeGroupMembers`、`showFeedback`、Vant `showConfirmDialog`
- Produces: 无（页面组件）

**删除清单（重写后这些标识不得再出现）：** `@tauri-apps/plugin-os`、`type()`、`useDialog`、`isMobileView`、`scrollHeight`、`scrollArea`、`calculateScrollHeight`、`showDeleteConfirm`、`defineEmits`、PC 分支整段（现 L96-206）。

- [ ] **Step 1: 写失败的结构守卫测试**

```ts
// src/mobile/views/chat-room/__tests__/manageGroupMember.structure.test.ts
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (file: string) => readFileSync(new URL(file, import.meta.url), 'utf-8')

const manageSource = read('../ManageGroupMember.vue')
const inviteSource = read('../MobileInviteGroupMember.vue')

describe('ManageGroupMember 移动端结构', () => {
  it('不再依赖桌面组件与运行时平台判断', () => {
    expect(manageSource).not.toMatch(/<n-[a-z-]+/)
    expect(manageSource).not.toContain('@tauri-apps/plugin-os')
    expect(manageSource).not.toContain('useDialog')
    expect(manageSource).not.toContain('isMobileView')
  })

  it('使用纯 Vant 交互', () => {
    expect(manageSource).toContain('van-search')
    expect(manageSource).toContain('van-checkbox-group')
    expect(manageSource).toContain('showConfirmDialog')
  })
})

describe('群成员相关页面单层滚动', () => {
  it.each([
    ['ManageGroupMember.vue', manageSource],
    ['MobileInviteGroupMember.vue', inviteSource],
  ])('%s 不使用 JS 高度与内层滚动', (_name, source) => {
    expect(source).not.toContain('window.innerHeight')
    expect(source).not.toContain('scrollHeight')
    expect(source.match(/overflow-y-auto/g) ?? []).toHaveLength(1)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

```bash
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vitest run src/mobile/views/chat-room/__tests__/manageGroupMember.structure.test.ts
```

Expected: FAIL（存在 `<n-input>`、`window.innerHeight` 等）。

- [ ] **Step 3: 重写 ManageGroupMember 模板**

用以下内容整体替换 `src/mobile/views/chat-room/ManageGroupMember.vue` 的 `<template>`（第 1-207 行）：

```vue
<template>
  <!-- 外层 ChatRoomLayout 已提供 MobileLayout 与高度，此处不可再嵌套，否则键盘 inset 会叠加两次 -->
  <div class="flex w-full flex-col h-full">
    <HeaderBar
      :isOfficial="false"
      :hidden-right="true"
      :enable-default-background="false"
      :enable-shadow="false"
      :room-name="t('home.manage_group_member.title')" />

    <!-- 顶部搜索框 -->
    <div class="px-16px mt-10px">
      <van-search
        v-model="keyword"
        shape="round"
        background="transparent"
        :placeholder="t('home.manage_group_member.search_placeholder_mobile')" />
    </div>

    <!-- 成员列表：唯一滚动容器 -->
    <div class="flex-1 min-h-0 overflow-y-auto px-16px mt-10px pb-10px">
      <van-checkbox-group v-model="selectedList" class="flex flex-col gap-2">
        <div
          v-for="item in filteredMembers"
          :key="item.uid"
          class="rounded-10px border overflow-hidden transition-colors duration-150"
          :class="
            selectedList.includes(item.uid)
              ? 'border-[--tjg-color-primary-300] bg-[--tjg-color-primary-100]'
              : 'border-[--tjg-border-default]'
          ">
          <van-checkbox :name="item.uid" class="w-full px-5px" icon-size="20px">
            <div class="flex items-center gap-10px px-8px py-10px w-full">
              <img
                :src="AvatarUtils.getAvatarUrl(groupStore.getUserInfo(item.uid)?.avatar!, 128)"
                :alt="groupStore.getUserInfo(item.uid)?.name || ''"
                class="size-44px rounded-full object-cover border-(1px solid var(--avatar-border-color))"
                @error="handleAvatarError" />
              <div class="flex flex-col leading-tight truncate">
                <span class="text-14px font-medium truncate">
                  {{ groupStore.getUserInfo(item.uid)?.name }}
                </span>
                <div class="text-12px text-[--tjg-text-secondary] flex items-center gap-4px truncate">
                  <span
                    class="size-6px rounded-full flex-shrink-0"
                    :class="
                      item.activeStatus === OnlineEnum.ONLINE
                        ? 'bg-[--tjg-status-online]'
                        : 'bg-[--tjg-status-offline]'
                    "></span>
                  {{
                    item.activeStatus === OnlineEnum.ONLINE
                      ? t('home.friends_list.status.online')
                      : t('home.friends_list.status.offline')
                  }}
                </div>
              </div>
            </div>
          </van-checkbox>
        </div>
      </van-checkbox-group>
    </div>

    <div
      class="px-16px py-10px bg-[--tjg-surface-panel] border-t border-[--tjg-border-default] flex justify-between items-center">
      <span class="text-14px text-[--tjg-text-primary]">
        {{ t('home.manage_group_member.selected_count', { count: selectedList.length }) }}
      </span>
      <van-button
        type="danger"
        size="small"
        :disabled="selectedList.length === 0"
        :loading="isLoading"
        @click="handleMobileRemove">
        {{ t('home.manage_group_member.remove_button') }}
      </van-button>
    </div>
  </div>
</template>
```

- [ ] **Step 4: 重写 ManageGroupMember 脚本**

用以下内容整体替换 `<script setup lang="ts">` 段（第 209-374 行）：

```ts
<script setup lang="ts">
import { showConfirmDialog } from 'vant'
import 'vant/es/dialog/style'
import { useI18n } from 'vue-i18n'
import HeaderBar from '#/components/chat-room/HeaderBar.vue'
import { useSafeBack } from '#/composables/useSafeBack'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { OnlineEnum, RoleEnum } from '@/enums'
import { useGroupStore } from '@/stores/domains/chat/group'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('ManageGroupMember')

defineOptions({
  name: 'ManageGroupMember'
})

const groupStore = useGroupStore()
const globalStore = useGlobalStore()
const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const { goBack } = useSafeBack()

const keyword = ref('')
const selectedList = ref<string[]>([])
const isLoading = ref(false)

const normalMembers = computed(() => {
  return groupStore.memberList.filter((item) => item.roleId === RoleEnum.NORMAL)
})

const filteredMembers = computed(() => {
  if (!keyword.value.trim()) {
    return normalMembers.value
  }

  const searchKeyword = keyword.value.toLowerCase()
  return normalMembers.value.filter((item) => {
    const userInfo = groupStore.getUserInfo(item.uid)
    if (!userInfo) return false
    return userInfo.name.toLowerCase().includes(searchKeyword) || userInfo.account.toLowerCase().includes(searchKeyword)
  })
})

const handleAvatarError = (event: Event) => {
  const target = event.target as HTMLImageElement
  if (target.src.endsWith('/logo.png')) return
  target.src = '/logo.png'
}

const handleClose = () => {
  goBack()
}

const validateRemoval = () => {
  if (globalStore.currentSessionRoomId === '1') {
    showFeedback(t('home.manage_group_member.channel_not_allowed'), 'warning')
    return false
  }

  if (selectedList.value.length === 0) {
    showFeedback(t('home.manage_group_member.select_member_warning'), 'warning')
    return false
  }

  return true
}

const handleRemove = async () => {
  if (!validateRemoval()) {
    return false
  }

  const members = [...selectedList.value]
  const count = members.length

  isLoading.value = true
  try {
    await groupStore.removeGroupMembers(members, globalStore.currentSessionRoomId)

    showFeedback(t('home.manage_group_member.remove_success', { count }), 'success')
    selectedList.value = []
    handleClose()
    return true
  } catch (error) {
    logger.error('Failed to remove member:', error)
    showFeedback(t('home.manage_group_member.remove_failed'), 'error')
    return false
  } finally {
    isLoading.value = false
  }
}

const handleMobileRemove = async () => {
  if (!validateRemoval()) return

  try {
    await showConfirmDialog({
      title: t('home.manage_group_member.confirm_remove_title'),
      message: t('home.manage_group_member.remove_confirm', { count: selectedList.value.length }),
      confirmButtonText: t('home.manage_group_member.dialog_positive'),
      cancelButtonText: t('home.manage_group_member.dialog_negative')
    })
  } catch {
    return
  }

  await handleRemove()
}

onMounted(async () => {
  if (globalStore.currentSessionRoomId === '1') {
    showFeedback(t('home.manage_group_member.channel_manage_unsupported'), 'warning')
    handleClose()
    return
  }

  try {
    if (globalStore.currentSessionRoomId) {
      await groupStore.getGroupUserList(globalStore.currentSessionRoomId)
    }
  } catch (error) {
    logger.error('Failed to load member list:', error)
  }
})
</script>
```

保留文件末尾 `<style scoped lang="scss"></style>`。

- [ ] **Step 5: 运行接口守卫测试**

```bash
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vitest run src/mobile/views/chat-room/__tests__/manageGroupMember.structure.test.ts
```

Expected: ManageGroupMember 的用例 PASS；MobileInviteGroupMember 的用例仍 FAIL。

- [ ] **Step 6: 清理 MobileInviteGroupMember 的双层滚动**

`src/mobile/views/chat-room/MobileInviteGroupMember.vue`：

1. 列表外层容器（现 L37-38）保留 `flex-1 min-h-0 overflow-y-auto`，删除 `ref="scrollArea"`、`:style="{ height: scrollHeight + 'px' }"` 与内层 `max-h-[calc(100dvh-150px)]`；若内层仅用于限高，删除该内层包裹 div。
2. 删除 `scrollHeight` ref、`scrollArea` ref、`calculateScrollHeight` 函数。
3. `onMounted` 中删除 `calculateScrollHeight()` 与 `window.addEventListener('resize', calculateScrollHeight)`。
4. 删除 `onBeforeUnmount` 块（若删除后为空）。

- [ ] **Step 7: 运行守卫测试与全量相关测试**

```bash
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vue-tsc --noEmit
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vitest run src/mobile/views/chat-room/__tests__/manageGroupMember.structure.test.ts
```

Expected: 0 类型错误；2 个 describe 共 5 个用例全 PASS。

- [ ] **Step 8: 提交**

```bash
git add src/mobile/views/chat-room/ManageGroupMember.vue src/mobile/views/chat-room/MobileInviteGroupMember.vue src/mobile/views/chat-room/__tests__/manageGroupMember.structure.test.ts
git commit -m "refactor(ui): 群成员管理页改用 Vant 并收敛为单层滚动"
```

### Task 5: 「我的」入口热区与 TabBar 无障碍文案（P2-9 + P1 遗留）

**Files:**
- Modify: `src/mobile/components/my/Settings.vue`
- Modify: `src/mobile/layout/tabBar/index.vue:8`
- Modify: `locales/zh-CN/mobile_my.json`、`locales/en/mobile_my.json`
- Modify: `locales/zh-CN/mobile_tabbar.json`、`locales/en/mobile_tabbar.json`
- Test: `src/mobile/components/my/__tests__/settings.a11y.test.ts`

**Interfaces:**
- Consumes: 既有 `useI18n()`、`router`
- Produces: i18n key `mobile_my.actions.{messages,share,scan,settings}`、`mobile_tabbar.aria_label`

- [ ] **Step 1: 写失败测试**

```ts
// src/mobile/components/my/__tests__/settings.a11y.test.ts
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (relative: string) => readFileSync(new URL(relative, import.meta.url), 'utf-8')

const settingsSource = read('../Settings.vue')
const tabBarSource = read('../../../layout/tabBar/index.vue')
const zhMy = JSON.parse(read('../../../../../locales/zh-CN/mobile_my.json'))
const enMy = JSON.parse(read('../../../../../locales/en/mobile_my.json'))
const zhTabbar = JSON.parse(read('../../../../../locales/zh-CN/mobile_tabbar.json'))
const enTabbar = JSON.parse(read('../../../../../locales/en/mobile_tabbar.json'))

describe('我的页入口可访问性', () => {
  it('四个图标都有 48px 热区', () => {
    expect(settingsSource.match(/after:-inset-8px/g) ?? []).toHaveLength(4)
  })

  it('四个图标都有 i18n aria-label', () => {
    expect(settingsSource.match(/:aria-label="t\('mobile_my\.actions\./g) ?? []).toHaveLength(4)
  })

  it('语言包包含入口文案', () => {
    for (const locale of [zhMy, enMy]) {
      expect(Object.keys(locale.actions).sort()).toEqual(['messages', 'scan', 'settings', 'share'])
    }
  })
})

describe('TabBar 无障碍文案', () => {
  it('不再硬编码中文', () => {
    expect(tabBarSource).not.toContain('aria-label="移动端主导航"')
    expect(tabBarSource).toContain(':aria-label="t(\'mobile_tabbar.aria_label\')"')
  })

  it('两种语言都提供 aria_label', () => {
    expect(typeof zhTabbar.aria_label).toBe('string')
    expect(typeof enTabbar.aria_label).toBe('string')
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

```bash
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vitest run src/mobile/components/my/__tests__/settings.a11y.test.ts
```

Expected: FAIL（`after:-inset-8px` 数量为 0、缺 `actions` key）。

- [ ] **Step 3: 重写 Settings.vue 图标区**

```vue
<template>
  <div
    class="grid grid-cols-[32px_32px_32px_32px] px-16px gap-12px z-1 h-32px items-center justify-end mt-10px dark:invert">
    <button
      type="button"
      :aria-label="t('mobile_my.actions.messages')"
      class="relative h-32px w-32px flex items-center justify-center bg-transparent border-0 p-0 after:absolute after:-inset-8px after:content-['']"
      @click="toMyMessages">
      <van-badge :content="unreadApplyCount || ''" :max="99">
        <svg class="iconpark-icon h-24px w-24px block"><use href="#remind"></use></svg>
      </van-badge>
    </button>

    <button
      type="button"
      :aria-label="t('mobile_my.actions.share')"
      class="relative h-32px w-32px flex items-center justify-center bg-transparent border-0 p-0 after:absolute after:-inset-8px after:content-['']"
      @click="activate">
      <svg class="iconpark-icon h-24px w-24px block"><use href="#share"></use></svg>
    </button>

    <button
      type="button"
      :aria-label="t('mobile_my.actions.scan')"
      class="relative h-32px w-32px flex items-center justify-center bg-transparent border-0 p-0 after:absolute after:-inset-8px after:content-['']"
      @click="toScanQRCode">
      <svg class="iconpark-icon h-30px w-30px block"><use href="#saoma"></use></svg>
    </button>

    <button
      type="button"
      :aria-label="t('mobile_my.actions.settings')"
      class="relative h-32px w-32px flex items-center justify-center bg-transparent border-0 p-0 after:absolute after:-inset-8px after:content-['']"
      @click="toSettings">
      <svg class="iconpark-icon h-30px w-30px block"><use href="#wode-shezhi"></use></svg>
    </button>

    <van-popup v-model:show="active" position="bottom" :style="{ height: '30%' }">
      <div class="text-center py-20px text-16px">{{ t('mobile_my.share_to') }}</div>
    </van-popup>
  </div>
</template>
```

`<script setup>` 与 `<style scoped>` 保持不变。

- [ ] **Step 4: TabBar aria-label 走 i18n**

`src/mobile/layout/tabBar/index.vue:8` 的 `aria-label="移动端主导航"` 改为：

```vue
:aria-label="t('mobile_tabbar.aria_label')"
```

确保 `<script setup>` 已有 `const { t } = useI18n()`（没有则补 `import { useI18n } from 'vue-i18n'`）。

- [ ] **Step 5: 补语言包**

`locales/zh-CN/mobile_my.json` 顶层增加（若已有 `actions` 则合并键）：

```json
"actions": {
  "messages": "我的消息",
  "share": "分享",
  "scan": "扫一扫",
  "settings": "设置"
}
```

`locales/en/mobile_my.json`：

```json
"actions": {
  "messages": "My messages",
  "share": "Share",
  "scan": "Scan",
  "settings": "Settings"
}
```

`locales/zh-CN/mobile_tabbar.json` 增加：

```json
"aria_label": "移动端主导航"
```

`locales/en/mobile_tabbar.json` 增加：

```json
"aria_label": "Mobile main navigation"
```

- [ ] **Step 6: 跑测试与 i18n 守门**

```bash
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vitest run src/mobile/components/my/__tests__/settings.a11y.test.ts
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm check:i18n-dead-keys
```

Expected: 测试全 PASS；i18n 无死键。

- [ ] **Step 7: 提交**

```bash
git add src/mobile/components/my/Settings.vue src/mobile/layout/tabBar/index.vue src/mobile/components/my/__tests__/settings.a11y.test.ts locales/zh-CN/mobile_my.json locales/en/mobile_my.json locales/zh-CN/mobile_tabbar.json locales/en/mobile_tabbar.json
git commit -m "fix(ui): 我的页入口补足触控热区与无障碍文案"
```

---

### Task 6: 移动端字号缩放入口（P2-6）

**Files:**
- Modify: `src/mobile/views/my/MobileSettings.vue`（外观分组内）
- Modify: `locales/zh-CN/mobile_setting.json`、`locales/en/mobile_setting.json`
- Test: `src/mobile/views/my/__tests__/mobileSettings.fontScale.test.ts`

**Interfaces:**
- Consumes: `FONT_SCALE_STEPS`、`applyFontScale`、`loadFontScale`、`saveFontScale`（`@/utils/fontScale`）
- Produces: i18n key `mobile_setting.font_size`、`mobile_setting.font_sizes.{small,normal,large,xlarge}`

- [ ] **Step 1: 写失败测试**

```ts
// src/mobile/views/my/__tests__/mobileSettings.fontScale.test.ts
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (relative: string) => readFileSync(new URL(relative, import.meta.url), 'utf-8')

const source = read('../MobileSettings.vue')
const zh = JSON.parse(read('../../../../../locales/zh-CN/mobile_setting.json'))
const en = JSON.parse(read('../../../../../locales/en/mobile_setting.json'))

describe('移动端字号设置', () => {
  it('复用既有 fontScale 工具', () => {
    expect(source).toContain("from '@/utils/fontScale'")
    expect(source).toContain('FONT_SCALE_STEPS')
    expect(source).toContain('applyFontScale')
    expect(source).toContain('saveFontScale')
    expect(source).toContain('loadFontScale')
  })

  it('提供四档文案', () => {
    for (const locale of [zh, en]) {
      expect(Object.keys(locale.font_sizes).sort()).toEqual(['large', 'normal', 'small', 'xlarge'])
      expect(typeof locale.font_size).toBe('string')
    }
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

```bash
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vitest run src/mobile/views/my/__tests__/mobileSettings.fontScale.test.ts
```

Expected: FAIL（未引用 fontScale 工具）。

- [ ] **Step 3: 在外观分组插入字号单元格**

在 `src/mobile/views/my/MobileSettings.vue` 的外观 `<van-cell-group inset>` 内、`mobile_setting.language` 所在 `<van-cell>` 之后插入：

```vue
<van-cell :title="t('mobile_setting.font_size')" center>
  <template #right-icon>
    <van-radio-group v-model="fontScaleValue" direction="horizontal" @change="handleFontScaleChange">
      <van-radio v-for="step in FONT_SCALE_STEPS" :key="step" :name="String(step)" icon-size="16px">
        {{ t(`mobile_setting.font_sizes.${FONT_SCALE_LABEL_KEYS[step]}`) }}
      </van-radio>
    </van-radio-group>
  </template>
</van-cell>
```

- [ ] **Step 4: 补脚本逻辑**

`MobileSettings.vue` 的 `<script setup>` 增加：

```ts
import { applyFontScale, FONT_SCALE_STEPS, loadFontScale, saveFontScale } from '@/utils/fontScale'

const FONT_SCALE_LABEL_KEYS: Record<number, string> = {
  0.875: 'small',
  1: 'normal',
  1.125: 'large',
  1.25: 'xlarge'
}

const fontScaleValue = ref(String(loadFontScale()))

const handleFontScaleChange = (value: string | number) => {
  const scale = Number(value)
  applyFontScale(scale)
  saveFontScale(scale)
}
```

- [ ] **Step 5: 补语言包**

`locales/zh-CN/mobile_setting.json` 增加：

```json
"font_size": "字号",
"font_sizes": {
  "small": "小",
  "normal": "标准",
  "large": "大",
  "xlarge": "超大"
}
```

`locales/en/mobile_setting.json` 增加：

```json
"font_size": "Font size",
"font_sizes": {
  "small": "Small",
  "normal": "Default",
  "large": "Large",
  "xlarge": "Extra large"
}
```

- [ ] **Step 6: 跑测试与 i18n 守门**

```bash
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vue-tsc --noEmit
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vitest run src/mobile/views/my/__tests__/mobileSettings.fontScale.test.ts
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm check:i18n-dead-keys
```

Expected: 0 类型错误；测试 PASS；无死键。

- [ ] **Step 7: 提交**

```bash
git add src/mobile/views/my/MobileSettings.vue src/mobile/views/my/__tests__/mobileSettings.fontScale.test.ts locales/zh-CN/mobile_setting.json locales/en/mobile_setting.json
git commit -m "feat(ui): 移动端设置页支持字号缩放"
```

### Task 7: 登录页流式布局与表单语义（P2-4 + P2-5）

**Files:**
- Modify: `src/mobile/login.vue:3-30`
- Modify: `src/mobile/components/login/MobileLoginForm.vue`
- Test: `src/mobile/__tests__/loginLayout.test.ts`

**Interfaces:**
- Consumes: 既有 `MobileLoginForm` props/emits（不新增 prop）
- Produces: 无

- [ ] **Step 1: 写失败测试**

```ts
// src/mobile/__tests__/loginLayout.test.ts
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (relative: string) => readFileSync(new URL(relative, import.meta.url), 'utf-8')

const loginSource = read('../login.vue')
const formSource = read('../components/login/MobileLoginForm.vue')

describe('登录页布局', () => {
  it('不再用视口百分比绝对定位', () => {
    expect(loginSource).not.toContain('top-13vh')
    expect(loginSource).not.toContain('top-20vh')
  })

  it('指示条用 transform 位移且基准位置固定', () => {
    expect(loginSource).toContain('left-[33px]')
    expect(loginSource).toContain('translate-x-0')
    expect(loginSource).toContain('translate-x-[100px]')
    expect(loginSource).not.toContain('left-[133px]')
  })
})

describe('登录表单语义', () => {
  it('使用 form 提交', () => {
    expect(formSource).toContain('@submit.prevent')
    expect(formSource).toContain('native-type="submit"')
  })

  it('提供正确的自动填充提示', () => {
    expect(formSource).toContain('name="username"')
    expect(formSource).toContain('autocomplete="username"')
    expect(formSource).toContain('name="password"')
    expect(formSource).toContain('autocomplete="current-password"')
    expect(formSource.match(/autocomplete="off"/g) ?? []).toHaveLength(1)
  })

  it('协议区不再绝对定位遮挡表单', () => {
    expect(formSource).not.toContain('absolute bottom-0 w-[80%]')
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

```bash
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vitest run src/mobile/__tests__/loginLayout.test.ts
```

Expected: FAIL（存在 `top-13vh` / `left-[133px]` / 两个 `autocomplete="off"`）。

- [ ] **Step 3: 登录页改纵向流式**

把 `src/mobile/login.vue` 第 3-30 行替换为：

```vue
    <div
      class="h-full flex flex-col items-center gap-24px bg-[--tjg-mobile-login-bg] pt-[max(10vh,56px)] pb-60px overflow-y-auto">
      <div class="w-80% flex items-center justify-start gap-6px">
        <p class="text-(20px [--tjg-text-primary])">{{ t('login.mobile.welcome_title') }}</p>
        <img src="@/assets/mobile/2.svg" alt="Tjg" class="w-80px h-20px" />
      </div>

      <!-- 选项卡导航 -->
      <div class="w-80% h-40px flex-center">
        <div class="flex w-200px relative">
          <div
            data-testid="tab-login"
            @click="activeTab = 'login'"
            :class="[
              'z-999 w-100px text-center transition-all duration-300 ease-out',
              activeTab === 'login' ? 'text-(18px [--tjg-text-primary])' : 'text-(16px [--tjg-text-secondary])'
            ]">
            {{ t('login.mobile.tabs.login') }}
          </div>
          <div
            @click="activeTab = 'register'"
            :class="[
              'z-999 w-100px text-center transition-all duration-300 ease-out',
              activeTab === 'register' ? 'text-(18px [--tjg-text-primary])' : 'text-(16px [--tjg-text-secondary])'
            ]">
            {{ t('login.mobile.tabs.register') }}
          </div>
          <div
            class="tab-indicator"
            :class="[
              'z-10 absolute bottom--4px left-[33px] h-6px w-34px bg-[--tjg-color-primary-500] transition-transform duration-300 ease-out',
              activeTab === 'login' ? 'translate-x-0' : 'translate-x-[100px]'
            ]"></div>
        </div>
      </div>
```

其余模板（头像、两个表单）保持不变，仅随流式布局自然排布。

- [ ] **Step 4: 表单语义化**

`src/mobile/components/login/MobileLoginForm.vue`：

1. 第 2 行根节点 `<div data-testid="mobile-login-form" ...>` 改为：

```vue
  <form
    data-testid="mobile-login-form"
    class="text-center w-80% flex flex-col gap-16px"
    @submit.prevent="handleSubmit">
```

并把文件末尾对应的 `</div>`（根节点闭合）改为 `</form>`。

2. 账号 `van-field` 增加 `name="username"`，把 `autocomplete="off"` 改为 `autocomplete="username"`。
3. 密码 `van-field` 增加 `name="password"`，把 `autocomplete="off"` 改为 `autocomplete="current-password"`。
4. 提交按钮改为 `native-type="submit"`，删除 `@click="emit('login')"`，其余属性保留：

```vue
    <van-button
      data-testid="mobile-login-submit"
      native-type="submit"
      :loading="loading"
      :disabled="loginDisabled"
      block
      class="mt-8px mb-8px gradient-button">
      <span>{{ loginText }}</span>
    </van-button>
```

5. 协议区去掉绝对定位：

```vue
    <div class="flex items-center justify-center gap-6px w-full mt-8px">
```

6. `<script setup>` 增加：

```ts
const handleSubmit = () => {
  if (props.loading || props.loginDisabled) return
  emit('login')
}
```

- [ ] **Step 5: 跑测试与类型检查**

```bash
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vue-tsc --noEmit
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vitest run src/mobile/__tests__/loginLayout.test.ts
```

Expected: 0 类型错误；测试全 PASS。

- [ ] **Step 6: 提交**

```bash
git add src/mobile/login.vue src/mobile/components/login/MobileLoginForm.vue src/mobile/__tests__/loginLayout.test.ts
git commit -m "fix(ui): 登录页改纵向流式布局并补齐表单语义"
```

---

### Task 8: color-mix 兜底与 liquid-glass 暗色选择器（P2-7 + P1 遗留）

**Files:**
- Modify: `src/styles/css/design-tokens.css`（文件末尾追加）
- Modify: `src/styles/scss/mixins/_liquid-glass.scss`
- Modify: `src/styles/__tests__/liquid-glass.test.ts`
- Test: `src/styles/__tests__/colorMixFallback.test.ts`
- Modify: `src/mobile/**/*.vue` 中所有 `color-mix(` 声明（按 Step 5 的包裹规则）

**Interfaces:**
- Produces: 无导出，仅 CSS 契约

- [ ] **Step 1: 写失败测试**

```ts
// src/styles/__tests__/colorMixFallback.test.ts
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (relative: string) => readFileSync(new URL(relative, import.meta.url), 'utf-8')

const tokensCss = read('../css/design-tokens.css')
const marker = '@supports not (color: color-mix(in srgb, red, blue))'
const fallbackCss = tokensCss.slice(tokensCss.indexOf(marker))

describe('color-mix token 兜底', () => {
  it('每个使用 color-mix 的 token 都有纯色兜底', () => {
    const mixedTokens = Array.from(tokensCss.matchAll(/^\s*(--[a-z0-9-]+):[^;\n]*color-mix\(/gim)).map(
      (match) => match[1]
    )
    expect(mixedTokens.length).toBeGreaterThan(0)
    expect(tokensCss).toContain(marker)
    for (const token of mixedTokens) {
      expect(fallbackCss).toContain(`${token}:`)
    }
  })

  it('兜底块不引入硬编码颜色', () => {
    expect(fallbackCss).not.toMatch(/#[0-9a-f]{3,8}\b/i)
    expect(fallbackCss).not.toMatch(/rgba?\(/i)
  })
})

describe('liquid-glass 暗色选择器', () => {
  it('不使用 scoped SFC 中会失效的 :global', () => {
    const mixinSource = read('../scss/mixins/_liquid-glass.scss')
    expect(mixinSource).not.toContain(':global(')
    expect(mixinSource).toContain("html[data-theme='dark'] &")
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

```bash
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vitest run src/styles/__tests__/colorMixFallback.test.ts
```

Expected: FAIL（`marker` 不存在、mixin 仍含 `:global(`）。

- [ ] **Step 3: 追加 token 兜底块**

先用 `grep -nE '^\s*--[a-z0-9-]+:.*color-mix\(' src/styles/css/design-tokens.css` 列出全部 token，再在文件末尾追加 `@supports not (color: color-mix(in srgb, red, blue))` 块。映射规则（确定性，逐条套用）：

| token 名称包含 | 兜底值 |
| :--- | :--- |
| `border` / `line` / `divider` / `ring` | `var(--tjg-border-default)` |
| `hover` / `selected` / `active` / `pressed` / `subtle` / `muted` | `var(--tjg-surface-subtle)` |
| `bg` / `background` / `panel` / `surface` | `var(--tjg-surface-panel)` |
| 其余 | `var(--tjg-surface-subtle)` |

已知必须包含的条目（其余按上表补齐）：

```css
/* Android WebView < 111 不支持 color-mix；此处只做语义降级，全部复用既有 token。 */
@supports not (color: color-mix(in srgb, red, blue)) {
  :root {
    --tjg-surface-list-hover: var(--tjg-surface-subtle);
    --tjg-surface-list-selected: var(--tjg-surface-subtle);
    --tjg-menu-hover: var(--tjg-surface-subtle);
    --tjg-room-card-encrypted-border: var(--tjg-border-default);
    --tjg-room-card-federated-border: var(--tjg-border-default);
    --info-hover: var(--tjg-surface-subtle);
    --tray-hover-e: var(--tjg-color-danger-100);
    --bg-menu: var(--tjg-surface-panel);
  }
}
```

- [ ] **Step 4: 修正 liquid-glass 暗色选择器**

`src/styles/scss/mixins/_liquid-glass.scss`：把 `:global([data-theme='dark']) &` 改为 `html[data-theme='dark'] &`（与 `liquid-glass-fallback` 保持同一种普通嵌套写法）。同一文件内不得再出现 `:global(`。

- [ ] **Step 5: 包裹移动端组件内的 color-mix**

```bash
grep -rn "color-mix(" src/mobile --include=*.vue
```

对每个命中的样式声明，改为「基础值 + 支持时增强」：

```scss
box-shadow: none;

@supports (color: color-mix(in srgb, red, blue)) {
  box-shadow: 0 2px 8px color-mix(in srgb, var(--tjg-color-primary-500) 25%, transparent);
}
```

规则：原声明为 `box-shadow` / `background` / `border` 时，先在 `@supports` 外写等价降级值（`none`、`transparent` 或 `var(--tjg-surface-panel)`），再在 `@supports` 内保留原 `color-mix` 声明。不得新增 `#hex` / `rgb()`。

- [ ] **Step 6: 跑测试与样式守门**

```bash
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vitest run src/styles/__tests__/colorMixFallback.test.ts src/styles/__tests__/liquid-glass.test.ts
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm check:ratchet
```

Expected: 测试全 PASS；ratchet 无新增硬编码颜色。

- [ ] **Step 7: 提交**

```bash
git add src/styles/css/design-tokens.css src/styles/scss/mixins/_liquid-glass.scss src/styles/__tests__/colorMixFallback.test.ts src/styles/__tests__/liquid-glass.test.ts src/mobile
git commit -m "fix(ui): 为 color-mix 增加纯色兜底并修正 liquid-glass 暗色选择器"
```

---

### Task 9: 清理 P1 遗留死代码（FooterBar 高度事件与未使用 ref）

**背景（P1 评审遗留）**

- `src/mobile/components/chat-room/FooterBar.vue` 仍 `defineEmits(['updateHeight', 'location'])`，并在 `onMounted` 里创建 `ResizeObserver` 只为 `emit('updateHeight', ...)`。
- 全仓库检索确认 `updateHeight` 无任何监听方；`MobileChatMain.vue:23` 的 `ref="footerBar"` 也无任何脚本引用。
- 保留它就是每个聊天页常驻一个 `ResizeObserver` + 一次无用 emit，属于纯开销与误导性 API。

**Files:**
- Modify: `src/mobile/components/chat-room/FooterBar.vue`
- Modify: `src/mobile/views/chat-room/MobileChatMain.vue:23`
- Test: `src/mobile/layout/__tests__/mobileCssGuards.test.ts`（追加断言，不新建文件）

**Interfaces:**
- Consumes: 无（不依赖前序任务的类型）
- Produces:
  - `FooterBar` 仅保留 `defineEmits(['location'])`
  - `FooterBar` 不再导出/声明 `updateHeight` 事件
  - `MobileChatMain.vue` 的 `<FooterBar>` 不再带 `ref`

- [ ] **Step 1: 先确认零消费者（防误删）**

```bash
cd /Users/ljf/Desktop/hu_ts/Tjg
grep -rn "updateHeight" src/ || echo "NO_CONSUMER"
grep -rn "footerBar" src/ || echo "NO_REF"
```

Expected: `updateHeight` 只命中 `FooterBar.vue` 自身；`footerBar` 只命中 `MobileChatMain.vue:23`。如果出现其它消费者，停止本任务并回报。

- [ ] **Step 2: 写失败守卫测试**

在 `src/mobile/layout/__tests__/mobileCssGuards.test.ts` 末尾追加：

```ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), 'utf-8')

describe('移动端 FooterBar 死代码清理', () => {
  it('FooterBar 不应再声明或触发 updateHeight 事件', () => {
    const source = readSource('src/mobile/components/chat-room/FooterBar.vue')
    expect(source).not.toContain('updateHeight')
    expect(source).not.toContain('ResizeObserver')
  })

  it('MobileChatMain 不应再给 FooterBar 挂未使用的 ref', () => {
    const source = readSource('src/mobile/views/chat-room/MobileChatMain.vue')
    expect(source).not.toContain('ref="footerBar"')
  })
})
```

> 若该测试文件已有 `describe`/`import` 结构，按现有风格并入已有 import 与文件末尾，不要重复导入 `node:fs` / `node:path` / `vitest`。

- [ ] **Step 3: 运行测试确认失败**

```bash
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vitest run src/mobile/layout/__tests__/mobileCssGuards.test.ts
```

Expected: 2 个新用例 FAIL（`updateHeight` / `ResizeObserver` / `ref="footerBar"` 仍存在）。

- [ ] **Step 4: 删除 FooterBar 的高度上报链路**

把 `FooterBar.vue` 的 script 改成：

```vue
<script setup lang="ts">
import 'vant/es/dialog/style'
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { isIOS } from '@/utils/PlatformConstants'
import { invokeSilently } from '@/utils/TauriInvokeHandler'
import VoicePanel from './panel/VoicePanel.vue'

const { t } = useI18n()
const globalStore = useGlobalStore()
const emit = defineEmits(['location'])

const showVoicePanel = ref(false)

const handleVoiceSend = async () => {
  showVoicePanel.value = false
}

onMounted(() => {
  if (isIOS()) {
    invokeSilently('set_webview_keyboard_adjustment', { enabled: true })
  }
})

onUnmounted(() => {
  if (isIOS()) {
    invokeSilently('set_webview_keyboard_adjustment', { enabled: false })
  }
})
</script>
```

模板与 `<style>` 保持原样，但模板根节点 `ref="root"` 也一并删除（它只服务于 `defineExpose({ root })`，而 `root` 已无外部消费者）：

```vue
<template>
  <div>
    <div ref="messageInputDom" contenteditable="true" spellcheck="false" class="sr-only"></div>
    <!-- 其余内容保持不变 -->
  </div>
</template>
```

同时删除 `defineExpose({ root })`。

- [ ] **Step 5: 删除 MobileChatMain 的未使用 ref**

```vue
<FooterBar v-else @location="handleLocationClick" />
```

- [ ] **Step 6: 运行测试确认通过，并跑类型检查**

```bash
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vitest run src/mobile/layout/__tests__/mobileCssGuards.test.ts
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vue-tsc --noEmit
```

Expected: 测试全 PASS；`vue-tsc` 0 错误。

- [ ] **Step 7: 提交**

```bash
git add src/mobile/components/chat-room/FooterBar.vue src/mobile/views/chat-room/MobileChatMain.vue src/mobile/layout/__tests__/mobileCssGuards.test.ts
git commit -m "refactor(ui): 移除 FooterBar 无消费者的高度上报与未使用 ref"
```

---

## Self-Review

### 1. 规格覆盖检查

| 规格要求（`2026-11-04-mobile-viewport-interaction.md` §4） | 落地任务 |
| :--- | :--- |
| 平台判定存在三份事实源，需收敛为单一入口 | Task 1 |
| 移动端布局只按「竖屏/横屏」切换，未考虑中等宽度 | Task 2 |
| 移动端返回在无历史栈时白屏 | Task 3 |
| 群成员页沿用 PC 组件、双层滚动、JS 计算高度 | Task 4 |
| 我的页图标热区 32px 低于 44px 可点击标准、中文写死 aria | Task 5 |
| 移动端设置缺字号入口 | Task 6 |
| 登录页绝对定位在矮屏/大字号下重叠、账号密码键盘与自动填充不友好 | Task 7 |
| `color-mix` 在旧 WebView 下无兜底；`_liquid-glass.scss` 的 `:global` 在 scoped 中失效 | Task 8 |
| P1 遗留死代码（FooterBar 高度事件 / 未使用 ref） | Task 9 |

结论：§4 九条全部有对应任务，无遗漏。

### 2. 占位符扫描

- 全文检索 `TBD` / `TODO` / `待补` / `类似 Task` / `<!-- APPEND -->`：应为 0 命中。
- 所有代码步骤均给出可直接粘贴的完整代码块，无「补充相应逻辑」类描述。
- 所有测试步骤均给出确切文件路径与可执行的 `vitest` / `vue-tsc` 命令。

### 3. 类型与命名一致性

- `RuntimePlatform = 'desktop' | 'mobile'`：Task 1 定义，Task 1 内所有消费点统一使用该类型，无第二套命名。
- `MobileBreakpoint = 'compact' | 'medium' | 'expanded'`：Task 2 定义并在同任务内消费，未跨任务外泄。
- `BackAction` / `resolveBackAction` / `MOBILE_FALLBACK_ROUTE`：Task 3 定义并在 Task 3 的 `useSafeBack` 与 `HeaderBar.vue` 中消费；Task 4 的 `handleClose` 调用 `useSafeBack().goBack()`，签名一致（无入参、返回 `void`）。
- `FONT_SCALE_LABEL_KEYS` 的 key 与 `FONT_SCALE_STEPS` 的数值一一对应（0.875 / 1 / 1.125 / 1.25），Task 6 内闭合。
- 语言 key 命名统一为 `mobile_<namespace>.<snake_case>`，与现有 `mobile_setting.*` / `mobile_my.*` / `mobile_tabbar.*` 一致。

---

## Execution Handoff

**计划文件：** `docs/superpowers/plans/2026-11-04-mobile-p2-architecture.md`

**执行方式：** Subagent-Driven Development（每个任务派发 fresh implementer + Spec/Quality 双评审），与 P0/P1 保持一致。

**任务顺序（严格按此顺序，前序任务产出的工具函数是后续任务的依赖）：**

1. Task 1 平台判定单一事实源
2. Task 2 移动端断点 `useMobileBreakpoint`
3. Task 3 安全返回 `useSafeBack`
4. Task 4 群成员页 Vant 重写
5. Task 5 我的页图标热区 + i18n aria
6. Task 6 移动端字号入口
7. Task 7 登录页流式布局与表单语义
8. Task 8 `color-mix` 兜底与 liquid-glass 暗色选择器
9. Task 9 P1 死代码清理

**每个任务的固定流程：**

```bash
# 1. 生成任务简报
node scripts/task-brief.mjs docs/superpowers/plans/2026-11-04-mobile-p2-architecture.md <task-number>

# 2. 派发 implementer（TDD：先失败测试 -> 最小实现 -> 通过 -> 单次 commit）

# 3. 生成评审 diff
git diff <base>..<head> > .superpowers/sdd/2026-11-04-mobile-viewport-interaction/review-<base>..<head>.diff

# 4. 派发 reviewer（Spec 合规 + Quality 两阶段）

# 5. 修复轮（最多 5 轮，用 resume 复用同一 reviewer 上下文）

# 6. 台账追加 Task N: complete
```

**阶段收口（全部 9 个任务完成后）：**

```bash
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vue-tsc --noEmit
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm test:run
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm check
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm check:ratchet
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm check:file-size
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm check:doc-coverage
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm check:doc-paths
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm check:sdk-boundary
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm quality:no-raw-fetch
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm check:i18n-dead-keys
```

Expected: 全部 0 错误 / 全 PASS；`check:file-size` 基线无增长；再做一次整支评审后向用户汇报。

**R3 校验清单（P2 收口时逐项回答）：**

1. 未新增平行 Matrix 实现；Task 1/2/3 只做平台判定、断点与路由返回的本地组合式能力，未触碰 SDK 边界。
2. 未引入任何 admin / AI 入口或代码；Task 8 的样式兜底只作用于 `--tjg-*` token 层与移动端组件。
3. 移动端前端分支构建（`pnpm dev` + `?platform=android` / `?platform=ios` 覆写）仍可正常渲染。

