# 设置页内嵌化实施计划（2026-11-26）

> 目标：把「独立设置弹窗」改为「应用主窗口内的设置视图」，彻底删除设置窗口的创建、事件同步、standalone 分支与原生关窗守卫，同时保持三栏框架、交互与视觉不变。

**Goal:** 点击设置后不再新建 Tauri WebviewWindow，而是在主窗口 layout 内以全窗口视图渲染设置页；所有设置项、页签、搜索、脏数据确认、保存/重置逻辑保持不变。

**Architecture:** 将 `/settings` 从顶层路由迁入 `/home` 的 children，并标记 `meta.fullWindow`。`layout/index.vue` 常驻不卸载：三栏容器用 `v-show` 隐藏，layout 根级新增 `<router-view>` 承载设置视图；`layout/center/index.vue` 用 `v-if="!route.meta?.fullWindow"` 防止重复渲染。设置页保留自身外壳（ActionBar + LeftNav + SettingsSidebar + SettingsContent），仅移除独立窗口相关逻辑。

**Tech Stack:** Vue 3 `<script setup>`、vue-router 4、Pinia（persist）、Naive UI、UnoCSS + SCSS、Tauri v2（事件/menu 仅用于唤起路由）、Vitest、Playwright。

## Global Constraints

- 不新增依赖；不引入新 UI 库；不新增 i18n key（复用 `setting.dialog.*`）。
- 颜色只用 `--tjg-*` token；禁止新增 `#xxx` / `rgb()` / `rgba()`。
- 单文件不超过 800 行（`layout/index.vue` 当前 433 行，改动后仍在红线内）。
- 所有路由访问必须用可选链 `route.meta?.fullWindow`：`src/layout/__tests__/LayoutRegression.test.ts` 的 `useRoute()` mock 不提供 `meta`。
- 移动端零影响：`/settings` 仅在 `src/router/routes/desktop.ts` 注册；`src/mobile/**` 无生产代码引用 `settingsWindow`（仅两个守卫测试按路径读取文件，不做 import）。
- 每个 Task 独立可验证、可提交；提交信息遵循 Conventional Commits。

---

## 一、现状分析：当前弹窗机制链路

### 1.1 打开链路

| 入口 | 位置 | 当前行为 |
| :--- | :--- | :--- |
| 左侧栏设置按钮 | [config.tsx](file:///Users/ljf/Desktop/hu_ts/Tjg/src/layout/left/config.tsx#L100-L115) | `await openSettingsWindow()`；返回 `false` 才回退 `router.push('/settings')` |
| 用户菜单「设置」 | [useUserMenu.ts](file:///Users/ljf/Desktop/hu_ts/Tjg/src/components/userMenu/useUserMenu.ts#L85-L100) | `await openSettingsWindow(tab)`；失败回退路由；最后 `closeMenu()` |
| 原生菜单 `Cmd+,` | [menu.rs](file:///Users/ljf/Desktop/hu_ts/Tjg/src-tauri/src/desktops/menu.rs#L141-L143) | Rust 派发 `menu:open-settings`；**前端全仓无监听，快捷键当前无效** |
| 旧路径 redirect | [desktop.ts](file:///Users/ljf/Desktop/hu_ts/Tjg/src/router/routes/desktop.ts#L102-L120) | `/general`、`/notification` 等 301 到 `/settings?tab=...` |

### 1.2 窗口创建

[useWindow.ts](file:///Users/ljf/Desktop/hu_ts/Tjg/src/composables/common/useWindow.ts#L117-L150) 的 `openSettingsWindow`：

1. 非桌面 / 非 Tauri 环境返回 `false`；
2. `WebviewWindow.getByLabel('settings')` 已存在时 `emit('settings-window:navigate', { tab })` + `setFocus()`；
3. 否则 `createWebviewWindow(..., 'settings', 1100, 760, ..., min 900×620, url '/settings?tab=...')`。

### 1.3 独立窗口内的渲染

- [settingsWindow/index.vue](file:///Users/ljf/Desktop/hu_ts/Tjg/src/views/settingsWindow/index.vue) 负责 ActionBar、`route.query.tab` → `settingsTabStore` 同步、`settings-window:navigate` 监听、`detectStandalone()`。
- [SettingsPage.vue](file:///Users/ljf/Desktop/hu_ts/Tjg/src/views/settingsWindow/SettingsPage.vue) 通过 `standalone` prop 控制：是否渲染 LeftNav、是否显示圆角卡片样式、`handleClose` 是否调用 `WebviewWindow.getCurrent().close()`、以及 `useSettingsNativeCloseGuard` 是否启用。
- [SettingsContent.vue](file:///Users/ljf/Desktop/hu_ts/Tjg/src/views/settingsWindow/SettingsContent.vue#L15-L44) 的 header 在 `standalone` 时渲染圆形关闭按钮，否则渲染返回按钮。

### 1.4 为什么必须迁移而不是打补丁

- 独立窗口与主窗口是两套 Vue 实例：`settingsTabStore` 通过 persist 共享，但 `LeftNav`、主题、语言、能力探测都要重新初始化一遍，冷启有可见延迟。
- 主窗口的关闭语义是 `hide()`（托盘常驻），而设置窗口是 `destroy()`，导致两套「关闭」语义、两套脏数据守卫。
- `Cmd+,` 已由 Rust 派发事件，但没有前端窗口承载，入口天然断裂。

---

## 二、方案对比与决策

| 方案 | 描述 | 结论 |
| :--- | :--- | :--- |
| A. 顶层路由直接接管 | 把 `/settings` 移出 `/home`，进入设置时卸载 layout | **否决**：layout 卸载会重跑 `onMounted` 中 `homeWindow.center()+show()`（每次返回都重新居中窗口）、`onBeforeMount` 数据拉取、`ensureInitStarted`，并中断 `useMessageSound`、消息监听、原生文件拖放、`useSearchShortcut` |
| B. 应用内抽屉 / 模态 | 用 Drawer 或 Modal 承载设置 | **否决**：设置页签是全高全宽双栏布局，抽屉尺寸受限、层级与滚动容器冲突、样式冲突风险最高，且与 requirement「侧边栏路由 / 主内容区面板」不符 |
| C. layout 常驻 + `meta.fullWindow` 子路由 | `/settings` 作为 `/home` 的 children，layout 不卸载，三栏 `v-show` 隐藏，layout 根级 router-view 渲染设置 | **采纳**：零数据重建、零监听中断、复用既有设置页组件、改动面最小 |

### 2.1 目标渲染结构

```
#layout (flex row, h-full)
├── SkipLink ×2
├── div.flex.flex-1.min-h-0   [v-show="!isFullWindowRoute"]   ← 三栏框架，常驻
│   ├── AsyncLeft
│   ├── AsyncCenter  └── router-view (children: message/friend/...)
│   └── AsyncRight
├── div.flex-1.min-w-0.min-h-0 [v-if="isFullWindowRoute"]     ← 新增，承载设置
│   └── router-view
├── 加载遮罩 [v-if="overlayVisible && !isFullWindowRoute"]
└── 拖拽遮罩 [v-if="isDraggingFiles && !isFullWindowRoute"]
```

设置视图内部仍是既有 `SettingsPage`：

```
settings-window-page (column)
├── ActionBar                     ← 保留：窗口拖拽 / 窗口控制
└── settings-window-content
    └── settings-page (row)
        ├── LeftNav               ← 应用左侧栏，保留框架一致性
        ├── SettingsSidebar       ← 设置页签导航 + 搜索
        └── SettingsContent       ← 页签内容 + 返回按钮
```

### 2.2 关闭语义

- 主窗口关闭 = ActionBar 拦截 `CloseRequested` 后 `hide()`（托盘常驻），不是 `destroy()`。
- 因此设置页的脏数据不会因为关窗丢失，原 `useSettingsNativeCloseGuard`（仅独立窗口需要）失去存在意义，直接删除；保留 `onBeforeRouteLeave`（跨路由）+ `beforeunload`（刷新/真正退出）两道确认。

---

## 三、变更文件清单

### 修改

| 文件 | 改动 |
| :--- | :--- |
| [desktop.ts](file:///Users/ljf/Desktop/hu_ts/Tjg/src/router/routes/desktop.ts) | `/settings` 从顶层迁入 `home.children`，追加 `meta: { fullWindow: true }` |
| [platform.d.ts](file:///Users/ljf/Desktop/hu_ts/Tjg/src/typings/platform.d.ts) | `RouteMeta` 增加 `fullWindow?: boolean` |
| [layout/index.vue](file:///Users/ljf/Desktop/hu_ts/Tjg/src/layout/index.vue) | `isFullWindowRoute`、根级 router-view、遮罩条件、`menu:open-settings` 监听 |
| [layout/center/index.vue](file:///Users/ljf/Desktop/hu_ts/Tjg/src/layout/center/index.vue) | `<component :is="Component" v-if="!route.meta?.fullWindow" />` |
| [useSearchShortcut.ts](file:///Users/ljf/Desktop/hu_ts/Tjg/src/composables/search/useSearchShortcut.ts) | 设置视图内不劫持 Ctrl/Cmd+F |
| [config.tsx](file:///Users/ljf/Desktop/hu_ts/Tjg/src/layout/left/config.tsx) | 设置入口改为纯路由跳转 |
| [useUserMenu.ts](file:///Users/ljf/Desktop/hu_ts/Tjg/src/components/userMenu/useUserMenu.ts) | 同上，删除 `useWindow` 依赖 |
| [useWindow.ts](file:///Users/ljf/Desktop/hu_ts/Tjg/src/composables/common/useWindow.ts) | 删除 `openSettingsWindow` 及 `emit` / `SettingsTabType` 导入 |
| [useWindow.test.ts](file:///Users/ljf/Desktop/hu_ts/Tjg/src/composables/__tests__/useWindow.test.ts) | 删除 3 个 `openSettingsWindow` 用例与 `emit` mock |
| [settingsWindow/index.vue](file:///Users/ljf/Desktop/hu_ts/Tjg/src/views/settingsWindow/index.vue) | 删除 standalone 检测与 `settings-window:navigate` 监听 |
| [SettingsPage.vue](file:///Users/ljf/Desktop/hu_ts/Tjg/src/views/settingsWindow/SettingsPage.vue) | 删除 `standalone` prop、原生关窗分支/守卫、standalone 样式；补响应式宽度变量 |
| [SettingsContent.vue](file:///Users/ljf/Desktop/hu_ts/Tjg/src/views/settingsWindow/SettingsContent.vue) | 删除 `standalone` 分支，header 只保留返回按钮 |
| [SettingsSidebar.vue](file:///Users/ljf/Desktop/hu_ts/Tjg/src/views/settingsWindow/SettingsSidebar.vue) | 删除 `down('md')` 的 `width: 100%` 覆盖，宽度交由父级 CSS 变量控制 |

### 新增

| 文件 | 用途 |
| :--- | :--- |
| `src/router/__tests__/settingsFullWindowRoute.test.ts` | 路由契约回归：设置是 home 子路由、带 `fullWindow`、顶层不再重复注册 |

### 删除

| 文件 | 原因 |
| :--- | :--- |
| [useSettingsNativeCloseGuard.ts](file:///Users/ljf/Desktop/hu_ts/Tjg/src/composables/settings/useSettingsNativeCloseGuard.ts) | 仅服务独立窗口的原生关窗拦截，主窗口 `hide()` 语义下无意义 |
| `src/composables/settings/__tests__/useSettingsNativeCloseGuard.test.ts` | 随实现一并删除 |

---

## 四、实施任务（TDD，逐步可验证）

### Task 1：路由契约内嵌化

**Step 1（红）** 新建 `src/router/__tests__/settingsFullWindowRoute.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import type { RouteRecordRaw } from 'vue-router'
import { getDesktopRoutes } from '@/router/routes/desktop'

const findByName = (routes: readonly RouteRecordRaw[], name: string): RouteRecordRaw | null => {
  for (const route of routes) {
    if (route.name === name) return route
    if (route.children) {
      const matched = findByName(route.children, name)
      if (matched) return matched
    }
  }
  return null
}

describe('设置页内嵌路由契约', () => {
  const routes = getDesktopRoutes()

  it('设置页是 home 的子路由，切换设置时 layout 不卸载', () => {
    const home = findByName(routes, 'home')
    expect(home?.children?.some((child) => child.name === 'settings')).toBe(true)
  })

  it('设置页标记 meta.fullWindow 并保留绝对路径 /settings', () => {
    const settings = findByName(routes, 'settings')
    expect(settings?.path).toBe('/settings')
    expect(settings?.meta?.fullWindow).toBe(true)
  })

  it('设置页不再作为顶层路由重复注册', () => {
    expect(routes.some((route) => route.name === 'settings')).toBe(false)
  })

  it('旧路径 redirect 仍指向设置页对应 tab', () => {
    const legacy = routes.find((route) => route.path === '/notification')
    expect(legacy?.redirect).toBe('/settings?tab=notifications')
  })
})
```

运行：

```bash
pnpm vitest run src/router/__tests__/settingsFullWindowRoute.test.ts
```

预期：前 3 个用例失败（设置仍是顶层路由）。

**Step 2（绿）** 修改 `src/router/routes/desktop.ts`：

```ts
      // /search - 全局搜索：当前复用 FriendsList 的搜索态，暂未拆独立视图
      { path: '/search', name: 'search', component: FriendsList },

      // 设置：作为 home 子路由渲染，切换时 layout 常驻不卸载（见 meta.fullWindow）
      { path: '/settings', name: 'settings', component: SettingsWindow, meta: { fullWindow: true } },

      // 旧路径 redirect（向后兼容）
```

并删除文件末尾原先的顶层：

```ts
  {
    path: '/settings',
    name: 'settings',
    component: SettingsWindow
  },
```

**Step 3** 修改 `src/typings/platform.d.ts` 的 `RouteMeta`：

```ts
declare module 'vue-router' {
  interface RouteMeta {
    title?: string
    permission?: string
    requiresAdmin?: boolean
    keepAlive?: boolean
    /** 全窗口视图：隐藏 layout 三栏，由 layout 根级 router-view 承载（当前用于 /settings） */
    fullWindow?: boolean
  }
}
```

**Step 4** 复跑测试 → 4 passed。提交：`feat(router): 设置页迁入 home 子路由并标记 fullWindow`。

---

### Task 2：Layout 常驻承载全窗口路由

**Step 1** 修改 `src/layout/index.vue` 模板：

```vue
    <div v-show="!isFullWindowRoute" class="flex flex-1 min-h-0">
      <AsyncLeft />
      <AsyncCenter />
      <AsyncRight v-if="showRightPane" />
    </div>
    <div v-if="isFullWindowRoute" class="flex flex-1 min-w-0 min-h-0">
      <router-view />
    </div>
    <div
      v-if="overlayVisible && !isFullWindowRoute"
      class="absolute inset-0 z-10 flex items-center justify-center bg-[--tjg-surface-subtle]">
      <LoadingSpinner :percentage="loadingPercentage" :loading-text="loadingText" />
    </div>

    <transition name="drag-upload">
      <div
        v-if="isDraggingFiles && !isFullWindowRoute"
        ...>
```

**Step 2** 脚本补充：

```ts
import { emitTo, listen, type UnlistenFn } from '@tauri-apps/api/event'
...
import { useRoute, useRouter } from 'vue-router'
...
const route = useRoute()
const router = useRouter()
// 全窗口视图（设置页）：隐藏三栏并让根级 router-view 接管，避免卸载 layout 重建全部监听
const isFullWindowRoute = computed(() => Boolean(route.meta?.fullWindow))
```

`onMounted` 的 `hasTauriRuntime()` 分支内追加原生菜单唤起：

```ts
      // 原生菜单 Settings... / Cmd+, → 应用内设置视图（此前前端无监听，快捷键无效）
      unlistenMenuSettings = await listen('menu:open-settings', () => {
        if (route.name !== 'settings') void router.push('/settings')
      })
```

`onUnmounted`：

```ts
onUnmounted(() => {
  unlistenMenuSettings?.()
  cleanupNativeFileDropListeners()
})
```

并在 `<script setup>` 顶层声明：

```ts
let unlistenMenuSettings: UnlistenFn | null = null
```

**Step 3** 修改 `src/layout/center/index.vue`：

```vue
        <router-view v-slot="{ Component }">
          <keep-alive :include="['message', 'friendsList']">
            <component :is="Component" v-if="!route.meta?.fullWindow" />
          </keep-alive>
        </router-view>
```

> 为什么必须 `v-if`：`/settings` 是 `/home` 的 children，`center` 的 router-view 默认会再渲染一次设置页，造成双份 `SettingsPage`（双份 `beforeunload`、双份脏数据登记）。

**Step 4** 回归验证：

```bash
pnpm vitest run src/layout/__tests__/LayoutRegression.test.ts
```

必须通过（该测试 mock 的 `useRoute()` 无 `meta`，已用可选链兼容）。

提交：`feat(layout): 常驻布局承载 fullWindow 路由并接管原生设置菜单`。

---

### Task 3：设置页去 standalone

**Step 1** `src/views/settingsWindow/index.vue` 精简为：

```vue
<template>
  <div class="settings-window-page">
    <ActionBar :shrink="false" class="shrink-0" />
    <div class="settings-window-content">
      <SettingsPage />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  normalizeSettingsTab,
  type SettingsTabInput,
  useSettingsTabStore
} from '../../stores/domains/settings/settingsTab'
import SettingsPage from './SettingsPage.vue'

defineOptions({
  name: 'SettingsWindowPage'
})

const route = useRoute()
const settingsTabStore = useSettingsTabStore()

function syncRouteTab() {
  const tab = typeof route.query.tab === 'string' ? (route.query.tab as SettingsTabInput) : undefined
  settingsTabStore.setActiveTab(normalizeSettingsTab(tab) ?? 'account')
}

onMounted(syncRouteTab)

watch(() => route.query.tab, syncRouteTab)
</script>
```

删除：`WebviewWindow`、`hasTauriRuntime`、`listen`、`ref`、`onBeforeUnmount`、`detectStandalone`、`isStandalone`、`unlistenNavigate`。

**Step 2** `SettingsPage.vue`：

- 模板：`<div class="settings-page">`（去掉 standalone class）；`<SettingsContent ... />` 去掉 `:standalone`。
- Props 只保留 `loading?: boolean`。
- `handleClose` 收敛为：

```ts
async function handleClose() {
  await flushFormWrites()

  const canClose = await dirtyRegistry.confirmIfNeeded({
    scope: 'close',
    tabId: activeTab.value,
    currentTabLabel: getSettingsTabLabel(activeTab.value, t)
  })
  if (!canClose) return

  dirtyRegistry.clearDirtyTabs()
  // 优先返回上一页，无历史记录时回退到消息页
  if (window.history.length > 1) {
    router.back()
  } else {
    router.push('/message')
  }
}
```

- 删除导入：`WebviewWindow`、`useSettingsNativeCloseGuard`、`hasPendingSettingsWrites`、`hasTauriRuntime`；删除 `useSettingsNativeCloseGuard({ ... })` 整段。
- 样式删除 `.settings-page-standalone`，`.settings-page` 明确行向：

```scss
.settings-page {
  display: flex;
  flex-direction: row;
  flex: 1 1 auto;
  height: 100%;
  min-height: 0;
  background: var(--tjg-surface-app);
  color: var(--tjg-text-primary);
}
```

**Step 3** `SettingsContent.vue`：

- 删除 `v-if="standalone"` 的圆形关闭按钮整段与注释；
- 返回按钮去掉 `v-else`，成为唯一 header 操作；
- `Props` 删除 `standalone`，`withDefaults` 删除对应默认值。

提交：`refactor(settings): 移除独立窗口 standalone 分支`。

---

### Task 4：响应式适配

**Step 1** `SettingsPage.vue` 的 `.settings-page` 增加侧栏宽度变量并在断点收缩（token 语义，不硬编码颜色）：

```scss
@use '@/styles/scss/global/responsive' as responsive;

.settings-page {
  --tjg-settings-sidebar-width: 260px;

  @include responsive.down('xl') {
    --tjg-settings-sidebar-width: 220px;
  }

  @include responsive.down('lg') {
    --tjg-settings-sidebar-width: 200px;
  }

  @include responsive.down('md') {
    --tjg-settings-sidebar-width: 168px;
  }
}
```

> 断点取自 `src/styles/scss/global/responsive.scss`（sm 576 / md 768 / lg 992 / xl 1200 / 2xl 1440）。当前文件若未引入 responsive，按同目录其他组件的既有 `@use` 写法补齐。

**Step 2** `SettingsSidebar.vue` 删除 `@include responsive.down('md')` 整段（`width: 100%` / `max-width` / `border-bottom`），保留：

```scss
.settings-sidebar {
  width: var(--tjg-settings-sidebar-width, 260px);
  flex-shrink: 0;
  border-right: 1px solid var(--tjg-border-default);
}
```

> 原 `width: 100%` 是为纵向堆叠设计；改回行向布局后会把内容挤出视口，必须删除。

**Step 3** 手工验证 1024 / 1280 / 1440 三档宽度：侧栏不换行、内容区可滚动、搜索框可输入、返回按钮可点击。

提交：`fix(settings): 设置页侧栏按断点收缩以适配窄窗口`。

---

### Task 5：入口统一为路由

**Step 1** `src/layout/left/config.tsx`：

```ts
const { createWebviewWindow } = useWindow()
```

设置项点击：

```ts
            // 设置已内嵌为应用内视图，直接路由跳转（不再创建独立窗口）
            await router.push('/settings')
```

确认 `createWebviewWindow` 在本文件仍有其他使用，否则一并从解构中移除。

**Step 2** `src/components/userMenu/useUserMenu.ts`：

删除 `import { useWindow } from '@/composables/common/useWindow'` 与 `const { openSettingsWindow } = useWindow()`，`openSettings` 改为：

```ts
  const openSettings = async (tab?: SettingsTabType) => {
    await router.push({ path: '/settings', ...(tab ? { query: { tab } } : {}) })
    closeMenu()
  }
```

**Step 3** `src/composables/common/useWindow.ts`：删除 `openSettingsWindow` 函数体、`return` 中的 `openSettingsWindow`、以及仅供其使用的 `import { emit } from '@tauri-apps/api/event'` 与 `import type { SettingsTabType } from '@/stores/domains/settings/settingsTab'`（先确认文件内无其他引用）。

**Step 4** `src/composables/__tests__/useWindow.test.ts`：删除三个 `openSettingsWindow` 用例；删除 `emitMock` 的定义、`vi.fn()` 初始化、`vi.mock('@tauri-apps/api/event')` 注入与 hoisted 解构项（删除后无其他使用）。保留 `getByLabelMock`（`checkWinExist` 相关用例仍在用）。

**Step 5** 验证：

```bash
pnpm vitest run src/composables/__tests__/useWindow.test.ts
vue-tsc --noEmit
```

提交：`refactor(settings): 设置入口统一走应用内路由`。

---

### Task 6：快捷键与原生菜单收敛

**Step 1** `src/composables/search/useSearchShortcut.ts` 的 `handleKeydown` 首行加：

```ts
    // 全窗口视图（设置页）内不劫持 Ctrl/Cmd+F，避免与设置页搜索冲突
    if (router.currentRoute.value.meta?.fullWindow) return
```

**Step 2** `SettingsPage.vue` 的 `handleShortcutKey` 已处理 `Ctrl+,` 聚焦设置搜索；`Cmd+,` 由 Task 2 的 `menu:open-settings` 监听进入设置视图。二者不冲突（前者仅在设置页内生效，后者仅在非设置页生效）。

**Step 3** 手工验证：
- 首页 `Ctrl+F` → 中间栏搜索聚焦；
- 设置页 `Ctrl+F` → 不触发中间栏搜索；`Ctrl+,` → 聚焦设置搜索框；
- 原生菜单 `Settings...` / `Cmd+,` → 进入设置视图；已在设置页时不重复跳转。

提交：`fix(settings): 设置视图内屏蔽全局搜索快捷键并接通原生菜单入口`。

---

### Task 7：删除原生关窗守卫

**Step 1** 删除 `src/composables/settings/useSettingsNativeCloseGuard.ts` 与 `src/composables/settings/__tests__/useSettingsNativeCloseGuard.test.ts`。

**Step 2** 全局确认无残留引用：

```bash
rg -n "useSettingsNativeCloseGuard" src || true
rg -n "openSettingsWindow|settings-window:navigate" src || true
```

两条命令都必须无输出。

提交：`chore(settings): 删除仅独立窗口需要的原生关窗守卫`。

---

### Task 8：全量验收

**Step 1** 守门命令（逐条执行，退出码必须为 0）：

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

**Step 2** E2E 回归：

```bash
pnpm test:e2e --grep "settings"
```

既有 `e2e/scenario-23-settings-persist.spec.ts` 直接 `page.goto('/settings?tab=appearance')`，迁移后 layout 会挂载；由于加载遮罩在 fullWindow 路由下不渲染，点击 `[data-test="theme-option"][data-value="dark"]` 不应被拦截。若失败，先查遮罩条件与 `keep-alive` 去重。

**Step 3** 手工验收矩阵（Computer Use / 真机）：

| 编号 | 场景 | 期望 |
| :--- | :--- | :--- |
| M1 | 左侧栏设置按钮 | 主窗口内切到设置视图，不弹新窗口；三栏隐藏、无闪烁 |
| M2 | 用户菜单 → 设置 → 指定 tab | 进入设置并落在指定页签 |
| M3 | 设置页内切换页签 | 侧栏高亮、内容切换、URL `?tab=` 同步 |
| M4 | 修改需保存项后切页签 | 弹出未保存确认；取消则停留 |
| M5 | 修改需保存项后点返回 | 弹出确认；确认后回到来源页 |
| M6 | 无脏数据点返回 | 回到来源页；无历史时回 /message |
| M7 | 主题/语言切换 | 立即生效，设置页与三栏同步 |
| M8 | 页面刷新（深链 `/settings?tab=securityPrivacy`） | 直接落在该页签 |
| M9 | 1024 / 1280 / 1440 宽度 | 无横向溢出、无重叠、可操作 |
| M10 | 设置页内 `Ctrl+F` | 不聚焦中间栏搜索 |
| M11 | 原生菜单 `Settings...` / `Cmd+,` | 进入设置视图 |
| M12 | 关闭主窗口再打开（托盘） | 设置在「返回」后不出现空白布局、无重复监听副作用 |
| M13 | 设置页内接收新消息 | 不崩溃；返回消息页可见未读更新 |
| M14 | 从设置返回后滚动消息列表 | 消息页滚动位置与页面状态保持（`keep-alive` 未被打断） |

**Step 4** 记录结论到提交说明：修复文件清单 + 每个 Task 的验证命令输出摘要。

---

## 五、风险与对策

| 风险 | 影响 | 对策 |
| :--- | :--- | :--- |
| center 的 router-view 重复渲染设置页 | 双份守卫、双份脏数据 | Task 2 的 `v-if="!route.meta?.fullWindow"`；E2E 断言页面只有一个 `[data-test="settings-shell-error"]`/`nav` |
| layout 单测 mock 无 `meta` | 单测 TypeError | 全部使用 `route.meta?.fullWindow`；Task 2 Step 4 强制跑回归 |
| 首次登录遮罩挡住设置页点击 | E2E 点击失败 | 遮罩条件加 `&& !isFullWindowRoute` |
| 窄窗口侧栏挤压内容 | 内容区不可用 | Task 4 断点收缩 + `min-width: 0` 已在 `SettingsContent` |
| `Cmd+,` 与设置页内 `Ctrl+,` 语义混淆 | 用户误操作 | 菜单监听仅在 `route.name !== 'settings'` 时 push；页内快捷键独立处理 |
| `openSettingsWindow` 残留引用 | 类型检查失败 | Task 7 用两条 `rg` 做零残留断言 |

## 六、R1 / R2 / R3 校验结论

1. **R1 SDK 优先**：本次改动仅涉及路由、布局与组件外壳，不新增任何 Matrix 协议实现或 HTTP 调用；设置项读写仍走既有 `src/services/matrix/**` 与 store。**结论：合规，无平行实现。**
2. **R2 移动端裁剪**：`/settings` 仅在 `src/router/routes/desktop.ts` 注册；`src/mobile/**` 无生产代码 import `@/views/settingsWindow`。**结论：合规，移动端产物无变化。**
3. **R3 移动端构建**：改动不触及 `src/mobile/**`、不新增依赖、不改 `vite` 配置；Android/iOS 前端分支构建路径不受影响。**结论：可正常产出。**

## 七、执行方式

本方案按 Task 1→8 顺序执行，每个 Task 结束即跑局部验证并提交。可选：

1. **Subagent-Driven（推荐）**：每个 Task 交给独立子代理执行，主会话只做验收与提交把关，上下文更干净。
2. **Inline Execution**：在主会话内逐 Task 执行，便于随时插入人工确认。

未获确认前不修改任何业务代码。
