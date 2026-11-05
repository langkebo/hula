# 移动端视口与交互可靠性优化方案

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修掉 `src/mobile` 在视口/安全区、溢出错位、触控手势、桌面交互残留四类上的可用性缺陷，并为后续性能与架构收敛划出边界。

**Architecture:** 移动端保持「独立实现」不变（符合 `AGENTS.md` 的移动端优先补全策略），只做三类动作：一是把平台差异收敛到 `src/mobile/composables` 的纯函数/组合式；二是修正共享组件里被 `isMobile()` 补丁掩盖的结构问题；三是删除失效代码（死图标、死过渡、错拼的工具类）。不合并桌面/移动同名文件。

**Tech Stack:** Vue 3 `<script setup>`、Vite 7、UnoCSS（presetWind3）、SCSS、Vant（移动端）、Naive UI（桌面）、Pinia、Vitest + @vue/test-utils、Tauri v2（Android/iOS WebView）。

## Global Constraints

- 移动端改动只落在 `src/mobile/**`；共享组件（`src/components/**`）改动必须同时兼顾桌面，禁止新增 `isMobile()` 内联分支。
- 禁止硬编码颜色；新增样式一律使用 `--tjg-*` token 或 UnoCSS 变量语法。
- 图标必须是 SVG（`<svg>` / `<use>` / Iconify），线宽 1.5px；禁止 div 拼图标。
- 任何 `.vue` 文件不得超过 800 行；`meta/file-size-baseline.json` 中超限文件数与单文件行数不得增长。
- 不得引入 admin / AI 相关模块或路由到移动端产物（R2）。
- 不得新增平行 Matrix API 实现；本次改造不触碰协议层（R1）。
- 提交使用 Conventional Commits；每个任务一次提交，提交信息前缀 `fix(mobile):` / `refactor(mobile):` / `perf(mobile):`。
- 验收命令（统一加 `PATH=/opt/homebrew/opt/node@22/bin:$PATH`）：
  `pnpm vue-tsc --noEmit`、`pnpm test:run`、`pnpm check`、`pnpm check:ratchet`、`pnpm check:file-size`、`pnpm check:doc-coverage`、`pnpm check:doc-paths`、`pnpm check:sdk-boundary`、`pnpm quality:no-raw-fetch`、`pnpm check:i18n-dead-keys`。

---

## 0. 事实核对：对审计报告的修正

先纠偏再排期。下表只列与审计原文不一致、或修复方向需要调整的条目；未列出的条目均判定为属实。

| 编号 | 审计结论 | 核查后结论 | 对方案的影响 |
| :--- | :--- | :--- | :--- |
| A1 | TabBar 因 border-box 压缩导致向上溢出约 11px | 仓库无全局 `border-box`（`main.ts` 只引入 eric-meyer reset），`.tab-item` 是 `min-height` + `padding`，实际是内容约 78px 在 `items-end` 下向上溢出约 15px；34px 空 div 在 `MobileLayout.vue:18`，`layout/index.vue:18` 是空行 | 修法不变：安全区只能有一处承担 |
| A2 | 全部 7 处 100vh 都与软键盘冲突 | 图片/视频预览、Splash 没有输入框，与键盘无关；`ThreadView` 在 `components/thread/`；带输入框的是 `ManageGroupMember` / `StartGroupChat` / `AddFriends` / `ThreadView` | 键盘问题只在 4 个带输入的页面验证，其余仅做 `dvh` 改造 |
| A3 | Android 默认 `adjustPan`，补 `windowSoftInputMode` 即可 | 默认是 `adjustUnspecified`；`MainActivity.kt:8` 已 `enableEdgeToEdge()`，API 30+ 下窗口不会随 IME 缩放，仅补 manifest 无效 | 主方案改为 `visualViewport` 驱动 inset，manifest 只作旧版本回退 |
| A4 | 三处都是 `absolute fixed` + `l-0` | `l-0` 只在 `views/message/index.vue`；`friends` 与 `AutoFixHeightPage` 用的是合法 `left-0`；且 fixed 元素静态位置本就在左缘，视觉影响极小 | 降级为顺手清理，不占 P0 |
| C1 | 100px 轨道会挤压房间名 | 固定轨道超出只会向右覆盖 1fr，标题自身有 truncate；触发条件是单聊且可焚毁 | 仍改 flex，但优先级从高降为中 |
| C5 | 提示展开导致下拉盖住密码框 | 下拉是脱离文档流的浮层，盖住密码框是其固有行为；真正问题是宽度按包含块 80% 而非输入框 | 归入 P2 登录页整改 |
| C6 | 中英切换导致指示条错位 | 两个 tab 是固定 `w-100px`，文案长度不影响盒子宽度，不会错位；横屏重叠属实 | 只修横屏重叠 |
| D1 | iOS 不派发 contextmenu 导致菜单不可达 | 更直接的原因：内层 `:167/:233/:302` 的 `@contextmenu.stop` + `preventDefault()` 阻断了根监听，**所有平台都弹不出** | 必须先删 `.stop`，再补长按 |
| D4 | 200ms 与 700ms 是同一交互两套阈值 | 二者分别作用于会话列表与消息气泡，不是同一交互；与 `van-swipe-cell` 的冲突只是推断 | 统一为具名常量，但不强行改 700ms |
| D5 | `#search` z-index 1500 凌驾蒙板 | `::deep(#search)` 是非法选择器，编译产物被丢弃，蒙板正常覆盖；锁滚无效属实 | 只修滚动锁，不动 z-index |
| D6 | 外层 `ChatMain.vue:2` 是滚动容器 | 外层是 `MobileChatMain.vue:17`，内层是 `ChatMain.vue:573`；吸顶横幅在滚动容器之外，回底判定读的是 `#image-chat-main`，未读错 | 只删外层多余滚动，不改回底逻辑 |
| E2 | 电脑图标是死按钮 | 纯 `<svg>`，无 button/role/cursor，是装饰性残留 | 删除，不补点击 |
| F3 | `onUnmounted` 写在 ResizeObserver 回调里 | 写在 `onMounted` 回调里；Vue 3.5 在异步回调中无 currentInstance，hook 告警且不注册，泄漏结论成立 | 修法不变 |
| H2 | 字号固定 11–12px 无法放大 | 字号是 `calc(Npx * var(--tjg-font-scale))`，但移动端没有调节入口 | 结论改为「移动端缺字号调节入口」，归入 P2 |
| H4 | 除 TabBar 外无点击反馈 | 已有 4 处 `-webkit-tap-highlight-color` 与多处 `:active` | 删除该项，不排期 |
| H1 | 68 个文件使用 `color-mix()` | 实测 254 处 / 69 个文件，且全仓无降级 | 归入 P2，按 token 层兜底而非逐处改 |
| G1 | 两个字体共 5.2MB | 实测 2.8MB + 2.5MB = 5.3MB；Alimama 只在登录窗口 `Network.vue` 使用 | 删除全局 `@font-face`，Alimama 下沉到登录窗口 |
| B1/B2/B3 | 平板竖屏单列、isLandscape 永久缓存、设置图标 30px | 均属实（`Settings.vue` 网格 32px、图标 30px、触摸热区不足 48px） | B1/B3 归入 P2；B2 的平台判定收敛同批做 |

---

## 1. 分层与优先级

| 阶段 | 目标 | 任务 | 依赖 |
| :--- | :--- | :--- | :--- |
| P0 可用性 | 底部布局不再错位、键盘不再遮内容、好友/会话列表不再被撑爆、聊天页不再每次重建 | Task 1–4 | 无 |
| P1 交互 | 菜单不越界、预览可控、新消息可回底、TabBar 文案随语言更新、观察者不泄漏 | Task 5–11 | Task 1（布局基线） |
| P1 性能 | 头像不拉原图、字体不首屏下载 5.3MB、虚拟列表可响应尺寸变化、模糊可降级 | Task 12–15 | 无 |
| P2 架构 | 平台判定单一事实源、`ManageGroupMember` 去 Naive UI、平板断点、登录页整改、`color-mix` 兜底 | 见 §4 | P0/P1 完成后单独立项 |

排期原则：P0 全部合并后再开 P1；P1 内部 Task 5–7 同批（都改菜单与手势），Task 8–11 可并行。

---

## 2. 文件结构

**新建**

| 文件 | 职责 |
| :--- | :--- |
| `src/mobile/composables/useViewportInset.ts` | 用 `visualViewport` 计算键盘遮挡高度；导出纯函数 `computeKeyboardInset` 便于单测 |
| `src/mobile/composables/__tests__/useViewportInset.test.ts` | 纯函数边界测试 |
| `src/composables/common/__tests__/useContextMenuPosition.test.ts` | 菜单定位钳制测试 |
| `src/mobile/composables/__tests__/useMobileLongPress.test.ts` | 长按菜单 top 钳制测试 |
| `src/mobile/__tests__/mobileCssGuards.test.ts` | 扫描 `src/mobile/**/*.vue`，拦截非法 `calc` 与不存在的 `l-0` |
| `src/mobile/layout/__tests__/layoutShell.test.ts` | 布局壳结构守卫（安全区归属、keep-alive 命名、死过渡） |

**修改（按任务顺序）**

| 任务 | 文件 |
| :--- | :--- |
| 1 | `src/mobile/layout/tabBar/index.vue`、`src/mobile/layout/index.vue` |
| 2 | `src/mobile/components/MobileLayout.vue`、4 个带输入页面、3 个全屏预览、`AndroidManifest.xml` |
| 3 | `src/mobile/views/friends/index.vue`（4 处 calc）、`src/mobile/views/message/index.vue` |
| 4 | `src/mobile/layout/chat-room/ChatRoomLayout.vue`、`src/mobile/views/chat-room/MobileChatMain.vue`、`src/layout/center/index.vue`、`src/views/homeWindow/message/index.vue`、`src/components/leftBox/FriendsList.vue` |
| 5 | `src/mobile/components/chat-room/HeaderBar.vue` |
| 6 | `src/composables/common/useContextMenuPosition.ts`、`src/mobile/composables/useMobileLongPress.ts` |
| 7 | `src/mobile/views/friends/index.vue`、`src/mobile/composables/useMobileLongPress.ts` |
| 8 | `src/mobile/components/ImagePreview.vue`、`src/mobile/components/VideoPreview.vue` |
| 9 | `src/components/rightBox/chatBox/ChatMain.vue`、`src/components/rightBox/chatBox/ChatMessageList.vue` |
| 10 | `src/mobile/layout/tabBar/index.vue` |
| 11 | `src/mobile/components/chat-room/FooterBar.vue` |
| 12 | `src/mobile/components/message/MobileSessionList.vue`、`src/mobile/views/friends/index.vue` |
| 13 | `src/styles/scss/global/fonts.scss`、`src/styles/scss/global/variable.scss`、`src/styles/css/design-tokens.css`、`src/views/loginWindow/Network.vue` |
| 14 | `src/mobile/components/virtual-scroll/SmartVirtualList.vue` |
| 15 | `src/mobile/layout/tabBar/index.vue`、`src/mobile/layout/navBar/index.vue`、`src/mobile/views/message/index.vue`、`src/mobile/views/friends/index.vue` |

**验证策略说明**：CSS 与模板结构的缺陷无法在 jsdom 中断言真实布局。因此本计划分两类验证——可抽成纯函数的一律先写单测（Task 2/6/7/10）；纯结构改动用「源码守卫测试」（读取 SFC 文本断言不变量，Task 1/3/4/5）加上 §5 的真机清单。守卫测试不追求覆盖率，只锁住本次修掉的回归点。

---

## 3. 任务

### Task 1: TabBar 安全区单一归属

**Files:**
- Modify: `src/mobile/layout/tabBar/index.vue:126-139`
- Modify: `src/mobile/layout/index.vue`（`MobileLayout` 调用处）
- Test: `src/mobile/layout/__tests__/layoutShell.test.ts`

**Interfaces:**
- Produces: `MobileLayout` 在 Tab 布局下收到 `safeAreaBottom === false`；TabBar 自己承担底部安全区。

- [ ] **Step 1: 写失败测试**

```ts
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (relative: string) => readFileSync(join(process.cwd(), relative), 'utf8')

describe('mobile tab shell', () => {
  it('底部安全区只由 TabBar 承担', () => {
    expect(read('src/mobile/layout/index.vue')).toContain(':safe-area-bottom="false"')
    const tabBar = read('src/mobile/layout/tabBar/index.vue')
    expect(tabBar).toContain('min-height: 62px')
    expect(tabBar).toMatch(/\.tab-bar\s*\{[^}]*padding-bottom:\s*var\(--safe-area-inset-bottom/)
    expect(tabBar).not.toContain('padding-bottom: var(--safe-area-inset-bottom, 10px)')
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm vitest run src/mobile/layout/__tests__/layoutShell.test.ts`
Expected: FAIL（当前是 `:safeAreaBottom="!isLandscape"`，且 `.tab-item` 带 `padding-bottom`）。

- [ ] **Step 3: 改 TabBar 样式**

```scss
.tab-bar {
  min-height: 62px;
  padding-bottom: var(--safe-area-inset-bottom, 0px);
  -webkit-backdrop-filter: blur(12px);
  backdrop-filter: blur(12px);
}

.tab-item {
  gap: 2px;
  font-size: 11px;
  /* 安全区统一由 .tab-bar 承担，item 不再重复叠加 */
  padding-bottom: 0;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}
```

- [ ] **Step 4: 关掉布局壳的底部占位**

`src/mobile/layout/index.vue` 中把 `:safeAreaBottom="!isLandscape"` 改为 `:safe-area-bottom="false"`（保留 `safeAreaTop` 原逻辑）。竖屏横屏都不再额外加底部占位；横屏走 `.tab-bar-wrap--vertical`，其 `padding-bottom` 为 0，安全区由 `padding-left` 处理，见 Step 5。

- [ ] **Step 5: 横屏侧边栏改左侧安全区**

`.tab-bar-wrap--vertical` 内追加：

```scss
padding-left: var(--safe-area-inset-left, 0px);
padding-bottom: 0;
```

- [ ] **Step 6: 跑测试并提交**

Run: `pnpm vitest run src/mobile/layout/__tests__/layoutShell.test.ts && pnpm vue-tsc --noEmit`
Expected: PASS，类型 0 错误。

```bash
git add src/mobile/layout/tabBar/index.vue src/mobile/layout/index.vue src/mobile/layout/__tests__/layoutShell.test.ts
git commit -m "fix(mobile): make tab bar the single owner of bottom safe area"
```

---

### Task 2: 键盘与动态视口（dvh + visualViewport）

**Files:**
- Create: `src/mobile/composables/useViewportInset.ts`
- Test: `src/mobile/composables/__tests__/useViewportInset.test.ts`
- Modify: `src/mobile/components/MobileLayout.vue`
- Modify: `src/mobile/views/chat-room/ManageGroupMember.vue:34`、`src/mobile/views/friends/StartGroupChat.vue:35`、`src/mobile/views/friends/AddFriends.vue:38,49`、`src/mobile/components/thread/ThreadView.vue:169`
- Modify: `src/mobile/components/ImagePreview.vue:6`、`src/mobile/components/VideoPreview.vue:6`、`src/mobile/views/Splashscreen.vue:3`
- Modify: `src-tauri/gen/android/app/src/main/AndroidManifest.xml`

**Interfaces:**
- Produces: `computeKeyboardInset(layoutHeight: number, viewportHeight: number, offsetTop: number): number`；`useViewportInset(): { keyboardInset: Ref<number> }`（只读，组件用 `:style` 或计算属性消费）。

- [ ] **Step 1: 写失败的纯函数测试**

```ts
import { describe, expect, it } from 'vitest'
import { computeKeyboardInset } from '../useViewportInset'

describe('computeKeyboardInset', () => {
  it('键盘收起时为 0', () => {
    expect(computeKeyboardInset(800, 800, 0)).toBe(0)
  })

  it('键盘弹出时返回被遮挡高度', () => {
    expect(computeKeyboardInset(800, 500, 0)).toBe(300)
  })

  it('visualViewport 有 offsetTop 时扣除偏移', () => {
    expect(computeKeyboardInset(800, 500, 50)).toBe(250)
  })

  it('取整且不为负', () => {
    expect(computeKeyboardInset(800, 499.4, 0)).toBe(301)
    expect(computeKeyboardInset(800, 900, 0)).toBe(0)
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm vitest run src/mobile/composables/__tests__/useViewportInset.test.ts`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 实现组合式**

```ts
import { onMounted, onUnmounted, ref, type Ref } from 'vue'

export function computeKeyboardInset(layoutHeight: number, viewportHeight: number, offsetTop: number): number {
  return Math.max(0, Math.round(layoutHeight - viewportHeight - offsetTop))
}

/**
 * 键盘遮挡高度。Android 在 enableEdgeToEdge 下窗口不随 IME 缩放，
 * iOS 由原生 set_keyboard_adjustment 缩放 WebView，此时 inset 自然为 0。
 */
export function useViewportInset(): { keyboardInset: Ref<number> } {
  const keyboardInset = ref(0)

  const update = () => {
    const viewport = window.visualViewport
    if (!viewport) {
      keyboardInset.value = 0
      return
    }
    keyboardInset.value = computeKeyboardInset(window.innerHeight, viewport.height, viewport.offsetTop)
  }

  onMounted(() => {
    update()
    window.visualViewport?.addEventListener('resize', update)
    window.visualViewport?.addEventListener('scroll', update)
    window.addEventListener('orientationchange', update)
  })

  onUnmounted(() => {
    window.visualViewport?.removeEventListener('resize', update)
    window.visualViewport?.removeEventListener('scroll', update)
    window.removeEventListener('orientationchange', update)
  })

  return { keyboardInset }
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm vitest run src/mobile/composables/__tests__/useViewportInset.test.ts`
Expected: 4 passed。

- [ ] **Step 5: 接入 MobileLayout**

在 `MobileLayout.vue` 的 `<script setup>` 中调用 `const { keyboardInset } = useViewportInset()`，根节点加 `:style="{ paddingBottom: keyboardInset ? `${keyboardInset}px` : undefined }"`，并把原底部安全区空 div 改为 `v-if="safeAreaBottom && keyboardInset === 0"`（键盘弹出时键盘已覆盖 Home Indicator，不允许再叠加安全区）。

- [ ] **Step 6: 全屏容器 100vh → 100dvh**

对 `ImagePreview.vue`、`VideoPreview.vue`、`Splashscreen.vue`、`ThreadView.vue` 的根容器把 `h-100vh` / `height: 100vh` 改为 `h-100dvh` / `height: 100dvh`；`ManageGroupMember.vue`、`StartGroupChat.vue`、`AddFriends.vue` 中的 `calc(100vh-150px)` 改为 `calc(100dvh-150px)`。这 3 个页面在 `MobileLayout` 内，键盘 inset 由 Step 5 统一处理，不再各自算高度。

- [ ] **Step 7: Android manifest 回退项**

在 `AndroidManifest.xml` 的 `<activity>` 上补 `android:windowSoftInputMode="adjustResize"`。注释写明：API 30+ 下 `enableEdgeToEdge()` 会忽略该值，实际由 `useViewportInset` 兜底；低版本 Android 由此项回退。

- [ ] **Step 8: 提交**

Run: `pnpm vitest run src/mobile/composables/__tests__/useViewportInset.test.ts && pnpm vue-tsc --noEmit`

```bash
git add src/mobile/composables/useViewportInset.ts src/mobile/composables/__tests__/useViewportInset.test.ts src/mobile src-tauri/gen/android/app/src/main/AndroidManifest.xml
git commit -m "fix(mobile): use dynamic viewport and visualViewport inset for keyboard"
```

---

### Task 3: 非法 calc 与失效工具类

**Files:**
- Modify: `src/mobile/views/friends/index.vue:166,232,301,337`
- Modify: `src/mobile/views/message/index.vue`（`absolute fixed … l-0`）
- Test: `src/mobile/__tests__/mobileCssGuards.test.ts`

**Interfaces:**
- Produces: 仓库级守卫，禁止再出现 `calc(100vh_-_calc(` 与 ` l-0`。

- [ ] **Step 1: 写扫描测试**

```ts
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(process.cwd(), 'src/mobile')

function collect(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      collect(full, acc)
    } else if (entry.endsWith('.vue')) {
      acc.push(full)
    }
  }
  return acc
}

describe('mobile css guards', () => {
  const files = collect(ROOT)

  it('不使用缺运算符的 calc 嵌套', () => {
    const offenders = files.filter((file) => readFileSync(file, 'utf8').includes('calc(100vh_-_calc('))
    expect(offenders).toEqual([])
  })

  it('不使用不存在的 l-0 工具类', () => {
    const offenders = files.filter((file) => /\bl-0\b/.test(readFileSync(file, 'utf8')))
    expect(offenders).toEqual([])
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm vitest run src/mobile/__tests__/mobileCssGuards.test.ts`
Expected: FAIL，列出 `friends/index.vue` 与 `message/index.vue`。

- [ ] **Step 3: 修 4 处 calc**

把 `max-h-[calc(100vh_-_calc(340px_var(--safe-area-inset-top)))]` 统一改为：

```html
class="max-h-[calc(100dvh-340px-var(--safe-area-inset-top))] overflow-y-auto"
```

4 处（special / 分组一 / 分组二 / 分组三）保持一致，不引入新的常量。

- [ ] **Step 4: 修背景定位**

`views/message/index.vue` 背景层改为：

```html
class="absolute inset-0 top-0 left-0 …"
```

去掉 `fixed` 与 `l-0`；`friends/index.vue`、`AutoFixHeightPage.vue` 已是 `left-0`，不动。

- [ ] **Step 5: 跑测试并提交**

Run: `pnpm vitest run src/mobile/__tests__/mobileCssGuards.test.ts`
Expected: PASS。

```bash
git add src/mobile/views/friends/index.vue src/mobile/views/message/index.vue src/mobile/__tests__/mobileCssGuards.test.ts
git commit -m "fix(mobile): repair invalid calc lengths and background positioning"
```

---

### Task 4: keep-alive 命名对齐与死过渡

**Files:**
- Modify: `src/mobile/layout/chat-room/ChatRoomLayout.vue:7`
- Modify: `src/mobile/views/chat-room/MobileChatMain.vue`（`defineOptions` 名称）
- Modify: `src/layout/center/index.vue:23`
- Modify: `src/views/homeWindow/message/index.vue`（补 `defineOptions`）
- Modify: `src/components/leftBox/FriendsList.vue:9`
- Modify: `src/mobile/layout/index.vue:11`（删除 `<Transition name="slide">`）
- Test: `src/mobile/layout/__tests__/layoutShell.test.ts`（追加用例）

**Interfaces:**
- Produces: keep-alive 白名单与组件实际 `name` 一致；聊天页恢复缓存。

- [ ] **Step 1: 追加失败测试**

在 Task 1 的测试文件里增加：

```ts
it('keep-alive 白名单命中真实组件名', () => {
  const layout = read('src/mobile/layout/chat-room/ChatRoomLayout.vue')
  const main = read('src/mobile/views/chat-room/MobileChatMain.vue')
  const include = layout.match(/include="\[([^\]]+)\]"/)?.[1] ?? ''
  const names = include.split(',').map((item) => item.trim().replace(/['"]/g, ''))
  const actualName = main.match(/defineOptions\(\{\s*name:\s*'([^']+)'/)?.[1]
  expect(actualName).toBeTruthy()
  expect(names).toContain(actualName)
})

it('桌面中栏白名单同样命中', () => {
  const names = (read('src/layout/center/index.vue').match(/include="\[([^\]]+)\]"/)?.[1] ?? '')
    .split(',').map((item) => item.trim().replace(/['"]/g, ''))
  const message = read('src/views/homeWindow/message/index.vue')
  const friends = read('src/components/leftBox/FriendsList.vue')
  expect(message).toContain("defineOptions({ name: 'message' })")
  expect(friends).toContain("defineOptions({ name: 'friendsList' })")
  expect(names).toEqual(expect.arrayContaining(['message', 'friendsList']))
})

it('不再保留无样式的 slide 过渡', () => {
  expect(read('src/mobile/layout/index.vue')).not.toContain('<Transition name="slide"')
})
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm vitest run src/mobile/layout/__tests__/layoutShell.test.ts`
Expected: 三个用例均 FAIL。

- [ ] **Step 3: 对齐移动端名称**

`ChatRoomLayout.vue` 的 `include` 改为 `["mobileChatRoomDefault", "mobileGroupChatMember"]`（保留现有白名单语义，只改字符串）。若后续希望统一命名，再单独提交重命名，不与本次混做。

- [ ] **Step 4: 对齐桌面名称**

- `src/views/homeWindow/message/index.vue` 的 `<script setup>` 顶部加 `defineOptions({ name: 'message' })`。
- `src/components/leftBox/FriendsList.vue` 把 `<script setup name="friendsList">` 改为 `<script setup>` + `defineOptions({ name: 'friendsList' })`（`@vue/compiler-sfc` 3.5 不再从 `name` 属性产出 `name`）。

- [ ] **Step 5: 删除死过渡**

`src/mobile/layout/index.vue` 去掉 `<Transition name="slide" appear mode="out-in">` 包裹（保留 `<keep-alive :max="10">`），并确认文件内没有遗留 `.slide-*` 样式。

- [ ] **Step 6: 跑测试并提交**

Run: `pnpm vitest run src/mobile/layout/__tests__/layoutShell.test.ts && pnpm vue-tsc --noEmit`

```bash
git add src/mobile/layout/chat-room/ChatRoomLayout.vue src/mobile/layout/index.vue src/mobile/views/chat-room/MobileChatMain.vue src/layout/center/index.vue src/views/homeWindow/message/index.vue src/components/leftBox/FriendsList.vue src/mobile/layout/__tests__/layoutShell.test.ts
git commit -m "fix(mobile): align keep-alive names and drop dead transition"
```

---

### Task 5: 聊天头部布局与死图标

**Files:**
- Modify: `src/mobile/components/chat-room/HeaderBar.vue:2,33-47`
- Test: `src/mobile/layout/__tests__/layoutShell.test.ts`（追加用例）

**Interfaces:**
- Produces: 头部根节点带 `header-bar` 类与 `flex` 布局；右侧按钮区 `shrink-0`，标题区 `min-w-0 flex-1`。

- [ ] **Step 1: 追加失败测试**

```ts
it('聊天头部用 flex 且不保留桌面残留图标', () => {
  const header = read('src/mobile/components/chat-room/HeaderBar.vue')
  expect(header).toContain('class="header-bar')
  expect(header).not.toContain('grid-cols-[100px_1fr_100px]')
  expect(header).not.toContain('#diannao')
})
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm vitest run src/mobile/layout/__tests__/layoutShell.test.ts`
Expected: FAIL。

- [ ] **Step 3: 改结构**

```html
<div class="header-bar w-full h-56px flex items-center gap-8px px-8px z-2">
  <div class="flex items-center shrink-0">
    <!-- 返回按钮与未读数保持原实现 -->
  </div>
  <div class="flex-1 min-w-0 flex items-center justify-center">
    <!-- 房间名保持 truncate -->
  </div>
  <div class="flex items-center justify-end gap-8px shrink-0 pe-16px">
    <!-- 原有 3 个按钮 -->
  </div>
</div>
```

- [ ] **Step 4: 删除 `#diannao`**

移除 `:45` 那个纯装饰 `<svg><use href="#diannao"></use></svg>`。若设计上需要「已在电脑端在线」提示，改为标题下方状态文本，另立需求，不在本次实现。

- [ ] **Step 5: 跑既有头部测试并提交**

Run: `pnpm vitest run src/mobile/components/chat-room/__tests__ && pnpm vitest run src/mobile/layout/__tests__/layoutShell.test.ts`
Expected: 全 PASS（若既有用例断言了 `#diannao`，同步删除该断言）。

```bash
git add src/mobile/components/chat-room/HeaderBar.vue src/mobile/layout/__tests__/layoutShell.test.ts
git commit -m "fix(mobile): reflow chat header and drop dead desktop icon"
```

---

### Task 6: 菜单与长按定位的边界钳制（C3 / C4）

**Files:**
- Modify: `src/composables/common/useContextMenuPosition.ts:32-43`
- Modify: `src/mobile/composables/useMobileLongPress.ts:99-111`
- Modify: `src/mobile/components/message/MobileSessionList.vue`（长按菜单节点挂 `ref`）
- Create: `src/mobile/composables/longPressPosition.ts`
- Test: `src/composables/common/__tests__/useContextMenuPosition.test.ts`
- Test: `src/mobile/composables/__tests__/longPressPosition.test.ts`

**Interfaces:**
- Consumes: 无
- Produces:
  - `export interface MenuPositionInput { x: number; y: number; w: number; h: number; vw: number; vh: number; margin?: number }`
  - `export const clampMenuPosition: (input: MenuPositionInput) => { posX: number; posY: number }`（默认 `margin = 8`）
  - `export const resolveLongPressMenuTop: (input: { anchorTop: number; anchorHeight: number; menuHeight: number; viewportHeight: number; margin?: number }) => number`

- [ ] **Step 1: 写失败测试（菜单钳制）**

```ts
// src/composables/common/__tests__/useContextMenuPosition.test.ts
import { describe, expect, it } from 'vitest'
import { clampMenuPosition } from '../useContextMenuPosition'

const viewport = { vw: 375, vh: 667 }

describe('clampMenuPosition', () => {
  it('flips left from the anchor when the menu overflows right', () => {
    expect(clampMenuPosition({ x: 360, y: 100, w: 245, h: 300, ...viewport }).posX).toBe(115)
  })

  it('clamps to the left margin instead of going negative', () => {
    expect(clampMenuPosition({ x: 200, y: 100, w: 245, h: 300, ...viewport }).posX).toBe(8)
  })

  it('clamps to the bottom margin', () => {
    expect(clampMenuPosition({ x: 10, y: 600, w: 200, h: 300, ...viewport }).posY).toBe(359)
  })

  it('keeps the top-left margin when the menu is larger than the viewport', () => {
    const { posX, posY } = clampMenuPosition({ x: 0, y: 0, w: 500, h: 900, ...viewport })
    expect(posX).toBe(8)
    expect(posY).toBe(8)
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vitest run src/composables/common/__tests__/useContextMenuPosition.test.ts`
Expected: FAIL，`clampMenuPosition is not a function`。

- [ ] **Step 3: 实现并替换 `pos`**

在 `useContextMenuPosition.ts` 顶部（`export const useContextMenuPosition` 之前）新增：

```ts
export interface MenuPositionInput {
  x: number
  y: number
  w: number
  h: number
  vw: number
  vh: number
  margin?: number
}

/**
 * 主菜单位置计算：右侧溢出则向左翻转，随后钳制在视口内
 * 触屏上菜单宽度接近屏幕宽度，只翻转不钳制会把菜单推到屏幕外
 */
export const clampMenuPosition = ({ x, y, w, h, vw, vh, margin = 8 }: MenuPositionInput) => {
  const maxX = Math.max(margin, vw - w - margin)
  const maxY = Math.max(margin, vh - h - margin)
  const wantX = x > vw - w ? x - w : x
  const wantY = y > vh - h ? vh - h : y

  return {
    posX: Math.min(Math.max(wantX, margin), maxX),
    posY: Math.min(Math.max(wantY, margin), maxY)
  }
}
```

把原 `pos` computed 的函数体替换为：

```ts
  const pos = computed(() =>
    clampMenuPosition({
      x: x.value,
      y: y.value,
      w: w.value,
      h: h.value,
      vw: vw.value,
      vh: vh.value
    })
  )
```

- [ ] **Step 4: 运行确认通过**

Run: `PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vitest run src/composables/common/__tests__/useContextMenuPosition.test.ts`
Expected: 4 passed。

- [ ] **Step 5: 写失败测试（长按菜单纵向钳制）**

```ts
// src/mobile/composables/__tests__/longPressPosition.test.ts
import { describe, expect, it } from 'vitest'
import { resolveLongPressMenuTop } from '../longPressPosition'

describe('resolveLongPressMenuTop', () => {
  it('uses the original anchor offset when there is room below', () => {
    expect(
      resolveLongPressMenuTop({ anchorTop: 200, anchorHeight: 68, menuHeight: 300, viewportHeight: 667 })
    ).toBeCloseTo(177.33, 1)
  })

  it('clamps to the bottom edge for the last rows', () => {
    expect(resolveLongPressMenuTop({ anchorTop: 640, anchorHeight: 68, menuHeight: 300, viewportHeight: 667 })).toBe(359)
  })

  it('never returns a negative top when the menu is taller than the viewport', () => {
    expect(resolveLongPressMenuTop({ anchorTop: 10, anchorHeight: 68, menuHeight: 900, viewportHeight: 667 })).toBe(8)
  })
})
```

- [ ] **Step 6: 运行确认失败**

Run: `PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vitest run src/mobile/composables/__tests__/longPressPosition.test.ts`
Expected: FAIL，模块不存在。

- [ ] **Step 7: 新建纯函数模块**

```ts
// src/mobile/composables/longPressPosition.ts
export interface LongPressMenuTopInput {
  anchorTop: number
  anchorHeight: number
  menuHeight: number
  viewportHeight: number
  margin?: number
}

/**
 * 长按菜单纵向定位：锚点上方 1/3 行高处起排，并钳制在视口内
 * menuHeight 传 0（尚未完成测量）时退化为「距底 margin」的上限
 */
export const resolveLongPressMenuTop = ({
  anchorTop,
  anchorHeight,
  menuHeight,
  viewportHeight,
  margin = 8
}: LongPressMenuTopInput) => {
  const wanted = anchorTop - anchorHeight / 3
  const maxTop = Math.max(margin, viewportHeight - menuHeight - margin)
  return Math.min(Math.max(wanted, margin), maxTop)
}
```

- [ ] **Step 8: 运行确认通过**

Run: `PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vitest run src/mobile/composables/__tests__/longPressPosition.test.ts`
Expected: 3 passed。

- [ ] **Step 9: 接入 `useMobileLongPress` 与模板 ref**

`useMobileLongPress.ts` 增加：

```ts
import { nextTick, ref } from 'vue'
import { resolveLongPressMenuTop } from './longPressPosition'

const longPressMenuRef = ref<HTMLElement | null>(null)
```

把 `handleLongPress` 中的 `setLongPressMenuTop` 替换为：

```ts
    const setLongPressMenuTop = () => {
      const target = e.target as HTMLElement | null
      if (!target) return

      const currentTarget = target.closest('.grid')
      if (!currentTarget) return

      const rect = currentTarget.getBoundingClientRect()
      longPressState.value.longPressMenuTop = resolveLongPressMenuTop({
        anchorTop: rect.top,
        anchorHeight: rect.height,
        menuHeight: longPressMenuRef.value?.offsetHeight ?? 0,
        viewportHeight: window.innerHeight
      })
    }

    setLongPressMenuTop()
    nextTick(setLongPressMenuTop)
```

返回值中追加 `longPressMenuRef`，并在 `MobileSessionList.vue` 的长按菜单根节点上绑定 `ref="longPressMenuRef"`：

```html
<div v-if="longPressState.showLongPressMenu" ref="longPressMenuRef" class="long-press-menu">
```

- [ ] **Step 10: 回归 + 提交**

Run: `PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vitest run src/composables/common/__tests__/useContextMenuPosition.test.ts src/mobile/composables/__tests__/longPressPosition.test.ts src/mobile/views/message/__tests__ && PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vue-tsc --noEmit`
Expected: 全 PASS，类型 0 错误。

```bash
git add src/composables/common/useContextMenuPosition.ts src/composables/common/__tests__/useContextMenuPosition.test.ts src/mobile/composables/longPressPosition.ts src/mobile/composables/__tests__/longPressPosition.test.ts src/mobile/composables/useMobileLongPress.ts src/mobile/components/message/MobileSessionList.vue
git commit -m "fix(mobile): clamp context menu and long-press menu inside viewport"
```

---

### Task 7: 好友页移除空实现右键菜单（D1 校正版）

> 事实校正：`src/mobile/views/friends/index.vue:530-532` 的 `showMenu` / `handleSelect` 都是空函数体，`menuList` 的三个动作（新建分组 / 重命名 / 删除分组）没有任何实现。因此 D1 的真实影响不是「菜单在 iOS 不可达」，而是「菜单点了没反应」。保留一个不可用的菜单比移除更糟，本任务按「删除占位菜单」收敛；分组管理如需上线，按 §4 单独立需求。

**Files:**
- Modify: `src/mobile/views/friends/index.vue:152,167,233,302,441-445,530-532`
- Test: `src/mobile/layout/__tests__/layoutShell.test.ts`（追加用例）

**Interfaces:**
- Consumes: 无
- Produces: 无

- [ ] **Step 1: 写守卫用例**

在 `layoutShell.test.ts` 追加：

```ts
it('friends list does not ship a placeholder context menu', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/mobile/views/friends/index.vue'), 'utf-8')
  expect(source).not.toContain('<ContextMenu')
  expect(source).not.toContain('@contextmenu.stop')
  expect(source).not.toContain('const showMenu')
})
```

（`readFileSync` / `resolve` 沿用该文件已有的导入；若尚未导入则在该测试文件顶部补 `import { readFileSync } from 'node:fs'` 与 `import { resolve } from 'node:path'`。）

- [ ] **Step 2: 运行确认失败**

Run: `PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vitest run src/mobile/layout/__tests__/layoutShell.test.ts`
Expected: 新用例 FAIL。

- [ ] **Step 3: 删除占位菜单**

1. 删除导入：`import ContextMenu from '@/components/common/ContextMenu.vue'`（若存在）。
2. `:152` 的 `<ContextMenu ...>` 改为 `<div>`，对应 `</ContextMenu>` 改为 `</div>`（保留内部 `<van-collapse>`）。
3. 删除 `:167`、`:233`、`:302` 三处 `@contextmenu.stop="$event.preventDefault()"`，对应 `<div ...>` 保留为普通容器。
4. 删除 `menuList` ref（`:441-445`）、`showMenu`（`:530`）、`handleSelect`（`:532`）与 `@select` 绑定。

- [ ] **Step 4: 运行确认通过 + 提交**

Run: `PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vitest run src/mobile/layout/__tests__/layoutShell.test.ts && PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vue-tsc --noEmit`
Expected: 全 PASS。

```bash
git add src/mobile/views/friends/index.vue src/mobile/layout/__tests__/layoutShell.test.ts
git commit -m "fix(mobile): drop non-functional friend list context menu"
```

---

### Task 8: 图片预览手势与视频播放控制（D2 / D3）

**Files:**
- Modify: `src/mobile/components/ImagePreview.vue:4-22,107-113,248-277,279-340`
- Modify: `src/mobile/components/VideoPreview.vue:20-27`
- Test: `src/mobile/components/__tests__/previewGestures.test.ts`

**Interfaces:**
- Consumes: 无
- Produces: 无（组件内部手势状态不外露）

- [ ] **Step 1: 写守卫用例**

```ts
// src/mobile/components/__tests__/previewGestures.test.ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf-8')

describe('preview gestures', () => {
  it('image preview does not close on tap while zoomed', () => {
    const source = read('src/mobile/components/ImagePreview.vue')
    expect(source).toContain('handleBackdropClick')
    expect(source).not.toContain('@click="handleClose"')
    expect(source).toContain('DOUBLE_TAP_SCALE')
    expect(source).toContain('CLOSE_DRAG_PX')
  })

  it('video preview ships native controls', () => {
    const source = read('src/mobile/components/VideoPreview.vue')
    expect(source).toContain('controls')
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vitest run src/mobile/components/__tests__/previewGestures.test.ts`
Expected: 两条用例 FAIL。

- [ ] **Step 3: 改造 ImagePreview 手势状态**

把 `const scale = ref(1)` / `startDistance` / `startScale` 三个 ref（`:111-113`）替换为：

```ts
type GestureMode = 'none' | 'pinch' | 'pan' | 'swipe'

const MIN_SCALE = 0.1
const MAX_SCALE = 4
const DOUBLE_TAP_SCALE = 2.5
const DOUBLE_TAP_MS = 300
const CLOSE_DRAG_PX = 80

const scale = ref(1)
const translate = ref({ x: 0, y: 0 })
const dragOffsetY = ref(0)
const lastTapAt = ref(0)
const gesture = ref({
  mode: 'none' as GestureMode,
  startDistance: 0,
  startScale: 1,
  startClientX: 0,
  startClientY: 0,
  startTranslateX: 0,
  startTranslateY: 0,
  startedAt: 0
})

/** 放大后的平移边界：以视口长边的一半作为可移动半径上限 */
const clampOffset = (value: number, currentScale: number) => {
  const limit = (Math.max(currentScale, 1) - 1) * 0.5 * Math.max(viewportSize.value.width, viewportSize.value.height)
  return Math.min(Math.max(value, -limit), limit)
}

const resetTransform = () => {
  scale.value = 1
  translate.value = { x: 0, y: 0 }
  dragOffsetY.value = 0
  gesture.value.mode = 'none'
}
```

`imageStyle` 的 `transform` 两处（`:256`、`:274`）改为：

```ts
      transform: `translate3d(${translate.value.x}px, ${translate.value.y}px, 0) scale(${scale.value})`,
      transition: dragOffsetY.value === 0 ? 'transform 0.25s ease' : 'none'
```

`watch(() => props.visible)` 与 `watch(() => props.imageUrl)` 中的重置逻辑（`:282-286`、`:295-299`）统一改为 `resetTransform(); lastTapAt.value = 0`。

- [ ] **Step 4: 重写触摸处理**

替换 `handleTouchStart` / `handleTouchMove` / `handleTouchEnd`（`:321-340`）：

```ts
const handleBackdropClick = () => {
  // 放大状态下轻触不关闭，避免看细节时误退
  if (scale.value > 1.01) return
  handleClose()
}

const handleTouchStart = (event: TouchEvent) => {
  if (event.touches.length >= 2) {
    gesture.value = {
      ...gesture.value,
      mode: 'pinch',
      startDistance: getTouchesDistance(event),
      startScale: scale.value,
      startedAt: Date.now()
    }
    return
  }
  const touch = event.touches[0]
  if (!touch) return
  gesture.value = {
    mode: scale.value > 1.01 ? 'pan' : 'swipe',
    startDistance: 0,
    startScale: scale.value,
    startClientX: touch.clientX,
    startClientY: touch.clientY,
    startTranslateX: translate.value.x,
    startTranslateY: translate.value.y,
    startedAt: Date.now()
  }
}

const handleTouchMove = (event: TouchEvent) => {
  if (gesture.value.mode === 'pinch') {
    if (event.touches.length < 2 || gesture.value.startDistance <= 0) return
    const distance = getTouchesDistance(event)
    if (distance <= 0) return
    scale.value = clampScale((distance / gesture.value.startDistance) * gesture.value.startScale)
    translate.value = {
      x: clampOffset(translate.value.x, scale.value),
      y: clampOffset(translate.value.y, scale.value)
    }
    return
  }

  const touch = event.touches[0]
  if (!touch) return
  const dx = touch.clientX - gesture.value.startClientX
  const dy = touch.clientY - gesture.value.startClientY

  if (gesture.value.mode === 'pan') {
    translate.value = {
      x: clampOffset(gesture.value.startTranslateX + dx, scale.value),
      y: clampOffset(gesture.value.startTranslateY + dy, scale.value)
    }
    return
  }

  // 未放大时仅响应纵向拖动作为关闭手势
  if (Math.abs(dy) > Math.abs(dx)) {
    dragOffsetY.value = dy
    translate.value = { x: 0, y: dy }
  }
}

const handleTouchEnd = (event: TouchEvent) => {
  if (event.touches.length >= 2) return
  const mode = gesture.value.mode
  const duration = Date.now() - gesture.value.startedAt
  const dy = dragOffsetY.value

  if (mode === 'swipe' && dy > CLOSE_DRAG_PX) {
    resetTransform()
    handleClose()
    return
  }

  if (mode === 'swipe' && duration < 250 && Math.abs(dy) < 10) {
    const now = Date.now()
    if (now - lastTapAt.value < DOUBLE_TAP_MS) {
      scale.value = scale.value > 1.01 ? 1 : DOUBLE_TAP_SCALE
      translate.value = { x: 0, y: 0 }
      lastTapAt.value = 0
    } else {
      lastTapAt.value = now
    }
  }

  dragOffsetY.value = 0
  if (scale.value <= 1.01) translate.value = { x: 0, y: 0 }
  gesture.value.mode = 'none'
}

const handleTouchCancel = () => {
  dragOffsetY.value = 0
  if (scale.value <= 1.01) translate.value = { x: 0, y: 0 }
  gesture.value.mode = 'none'
}
```

- [ ] **Step 5: 模板接线**

`:8` 改为 `@click="handleBackdropClick"`；`:14` 改为 `@touchcancel="handleTouchCancel"`。

- [ ] **Step 6: 视频加原生控制条**

`VideoPreview.vue:20-27` 的 `<video>` 增加 `controls` 与 `preload="metadata"`，保留 `@click.stop`：

```html
          <video
            v-if="videoUrl"
            class="max-w-full max-h-full rounded-8px bg-black"
            :style="videoStyle"
            :src="videoUrl"
            playsinline
            autoplay
            controls
            preload="metadata"
            @click.stop />
```

- [ ] **Step 7: 运行 + 提交**

Run: `PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vitest run src/mobile/components/__tests__/previewGestures.test.ts && PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vue-tsc --noEmit`
Expected: 全 PASS。

```bash
git add src/mobile/components/ImagePreview.vue src/mobile/components/VideoPreview.vue src/mobile/components/__tests__/previewGestures.test.ts
git commit -m "feat(mobile): add pan double-tap and swipe-down to previews"
```

---

### Task 9: 新消息悬浮按钮移动端可用 + 触屏 hover 态隔离（E1 / E3）

**Files:**
- Modify: `src/components/rightBox/chatBox/ChatMain.vue:62-65`
- Modify: `src/components/rightBox/chatBox/ChatMessageList.vue:44-45,108-110`
- Test: `src/mobile/layout/__tests__/layoutShell.test.ts`（追加用例）

**Interfaces:**
- Consumes: 无
- Produces: 无

- [ ] **Step 1: 写守卫用例**

追加到 `layoutShell.test.ts`：

```ts
it('new-message float button is available on mobile and styled for it', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/components/rightBox/chatBox/ChatMain.vue'), 'utf-8')
  expect(source).not.toContain('currentNewMsgCount && !isMobileRef')
  expect(source).toContain('floatButtonStyle')
})

it('message row hover state is gated by hover capability', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/components/rightBox/chatBox/ChatMessageList.vue'), 'utf-8')
  expect(source).toContain("matchMedia('(hover: hover)')")
  expect(source).not.toContain('@mouseenter="hoverId = item.message.id"')
})
```

- [ ] **Step 2: 运行确认失败**

Run: `PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vitest run src/mobile/layout/__tests__/layoutShell.test.ts`
Expected: 两条新用例 FAIL。

- [ ] **Step 3: 放开移动端悬浮按钮并适配间距**

`ChatMain.vue` 模板改为：

```html
    <footer
      class="float-footer-button"
      v-if="shouldShowFloatButton && currentNewMsgCount"
      :style="floatButtonStyle">
```

脚本中新增（与 `isMobileRef` 同处）：

```ts
const floatButtonStyle = computed(() =>
  isMobileRef.value ? { bottom: '88px', right: '16px' } : { bottom: '24px', right: '50px' }
)
```

- [ ] **Step 4: 触屏不写 hover 态**

`ChatMessageList.vue` 模板 `:45` 改为 `@mouseenter="handleRowMouseEnter(item.message.id)"`，并新增：

```ts
const handleRowMouseEnter = (messageId: string) => {
  // 触屏会合成 mouseenter，若直接写入会产生粘滞 hover 态
  if (typeof window === 'undefined' || !window.matchMedia?.('(hover: hover)').matches) return
  hoverId.value = messageId
}
```

- [ ] **Step 5: 运行 + 提交**

Run: `PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vitest run src/mobile/layout/__tests__/layoutShell.test.ts src/components/rightBox/chatBox/__tests__ && PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vue-tsc --noEmit`
Expected: 全 PASS。

```bash
git add src/components/rightBox/chatBox/ChatMain.vue src/components/rightBox/chatBox/ChatMessageList.vue src/mobile/layout/__tests__/layoutShell.test.ts
git commit -m "fix(mobile): expose new-message jump button and gate hover state"
```

---

### Task 10: TabBar 文案与未读角标的响应式（F5）

**Files:**
- Create: `src/mobile/layout/tabBar/navItems.ts`
- Modify: `src/mobile/layout/tabBar/index.vue:1-27,35-55,80-118`
- Test: `src/mobile/layout/tabBar/__tests__/navItems.test.ts`

**Interfaces:**
- Consumes: 无
- Produces:
  - `export interface MobileNavItem { labelKey: string; path: string; icon: string; actionIcon: string; testId: string; unreadKey?: 'messageUnreadCount' | 'contactUnreadCount' }`
  - `export const MOBILE_NAV_ITEMS: MobileNavItem[]`
  - `export const resolveNavItems: (t: (key: string) => string) => (MobileNavItem & { label: string })[]`

- [ ] **Step 1: 写失败测试**

```ts
// src/mobile/layout/tabBar/__tests__/navItems.test.ts
import { describe, expect, it } from 'vitest'
import { MOBILE_NAV_ITEMS, resolveNavItems } from '../navItems'

describe('mobile nav items', () => {
  it('keeps five primary tabs', () => {
    expect(MOBILE_NAV_ITEMS.map((item) => item.path)).toEqual([
      '/mobile/message',
      '/mobile/friends',
      '/mobile/rooms',
      '/mobile/space',
      '/mobile/my'
    ])
  })

  it('resolves labels through t() so locale switches are reactive', () => {
    const zh = resolveNavItems((key) => `zh:${key}`)
    const en = resolveNavItems((key) => `en:${key}`)
    expect(zh[0].label).toBe('zh:mobile_tabbar.items.messages')
    expect(en[0].label).toBe('en:mobile_tabbar.items.messages')
  })

  it('declares unread sources by key instead of translated label', () => {
    expect(MOBILE_NAV_ITEMS[0].unreadKey).toBe('messageUnreadCount')
    expect(MOBILE_NAV_ITEMS[1].unreadKey).toBe('contactUnreadCount')
    expect(MOBILE_NAV_ITEMS[2].unreadKey).toBeUndefined()
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vitest run src/mobile/layout/tabBar/__tests__/navItems.test.ts`
Expected: FAIL，模块不存在。

- [ ] **Step 3: 新建 `navItems.ts`**

```ts
export interface MobileNavItem {
  labelKey: string
  path: string
  icon: string
  actionIcon: string
  testId: string
  unreadKey?: 'messageUnreadCount' | 'contactUnreadCount'
}

export const MOBILE_NAV_ITEMS: MobileNavItem[] = [
  {
    labelKey: 'mobile_tabbar.items.messages',
    path: '/mobile/message',
    icon: 'message',
    actionIcon: 'message-action',
    testId: 'mobile-tab-message',
    unreadKey: 'messageUnreadCount'
  },
  {
    labelKey: 'mobile_tabbar.items.contacts',
    path: '/mobile/friends',
    icon: 'avatar',
    actionIcon: 'avatar-action',
    testId: 'mobile-tab-friends',
    unreadKey: 'contactUnreadCount'
  },
  {
    labelKey: 'mobile_tabbar.items.rooms',
    path: '/mobile/rooms',
    icon: 'room',
    actionIcon: 'room-action',
    testId: 'mobile-tab-rooms'
  },
  {
    labelKey: 'mobile_tabbar.items.spaces',
    path: '/mobile/space',
    icon: 'space',
    actionIcon: 'space',
    testId: 'mobile-tab-space'
  },
  {
    labelKey: 'mobile_tabbar.items.me',
    path: '/mobile/my',
    icon: 'wode',
    actionIcon: 'wode-action',
    testId: 'mobile-tab-my'
  }
]

export const resolveNavItems = (t: (key: string) => string) =>
  MOBILE_NAV_ITEMS.map((item) => ({ ...item, label: t(item.labelKey) }))
```

- [ ] **Step 4: 改造 `tabBar/index.vue` 脚本**

删除本地 `type NavItem` 与常量 `navItems`（`:85-118`），改为：

```ts
import { computed } from 'vue'
import { resolveNavItems, type MobileNavItem } from './navItems'

const navItems = computed(() => resolveNavItems(t))

const getUnReadCount = (item: MobileNavItem) => {
  if (item.unreadKey === 'messageUnreadCount') return globalStore.messageUnreadCount
  if (item.unreadKey === 'contactUnreadCount') return globalStore.contactUnreadCount
  return 0
}
```

模板中 `getUnReadCount(item.label)` 改为 `getUnReadCount(item)`。

- [ ] **Step 5: 运行 + 提交**

Run: `PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vitest run src/mobile/layout/tabBar/__tests__ && PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vue-tsc --noEmit`
Expected: 全 PASS。

```bash
git add src/mobile/layout/tabBar/navItems.ts src/mobile/layout/tabBar/index.vue src/mobile/layout/tabBar/__tests__/navItems.test.ts
git commit -m "fix(mobile): make tab bar labels and badges locale-reactive"
```

---

### Task 11: FooterBar 的 ResizeObserver 生命周期归位（F3）

**Files:**
- Modify: `src/mobile/components/chat-room/FooterBar.vue:58-82`
- Test: `src/mobile/components/chat-room/__tests__/FooterBar.test.ts`（新建）

**Interfaces:**
- Consumes: 无
- Produces: 无

- [ ] **Step 1: 写守卫用例**

```ts
// src/mobile/components/chat-room/__tests__/FooterBar.test.ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('FooterBar lifecycle', () => {
  it('registers observer cleanup in setup scope, not inside the mount callback', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/mobile/components/chat-room/FooterBar.vue'), 'utf-8')
    expect(source).toContain('let resizeObserver: ResizeObserver | null = null')
    expect(source).toContain('resizeObserver?.disconnect()')
    expect(source).not.toMatch(/onMounted\(\(\) => \{[\s\S]*?onUnmounted\(\(\) => \{[\s\S]*?resizeObserver\.disconnect\(\)/)
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vitest run src/mobile/components/chat-room/__tests__/FooterBar.test.ts`
Expected: FAIL。

- [ ] **Step 3: 提升 observer 到 setup 作用域**

`FooterBar.vue` 的 `const root = ref()` 之后改为：

```ts
let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  if (root.value) {
    resizeObserver = new ResizeObserver((entries) => {
      emit('updateHeight', entries[0].contentRect.height)
    })
    resizeObserver.observe(root.value)
  }

  if (isIOS()) {
    invokeSilently('set_webview_keyboard_adjustment', { enabled: true })
  }
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  resizeObserver = null

  if (isIOS()) {
    invokeSilently('set_webview_keyboard_adjustment', { enabled: false })
  }
})
```

（删除原 `onMounted` 内嵌套的 `onUnmounted`，避免重复注册。）

- [ ] **Step 4: 运行 + 提交**

Run: `PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vitest run src/mobile/components/chat-room/__tests__ && PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vue-tsc --noEmit`
Expected: 全 PASS。

```bash
git add src/mobile/components/chat-room/FooterBar.vue src/mobile/components/chat-room/__tests__/FooterBar.test.ts
git commit -m "fix(mobile): disconnect footer resize observer on unmount"
```

---

### Task 12: 列表头像走缩略图（G2）

**Files:**
- Modify: `src/mobile/components/message/MobileSessionList.vue:71`
- Modify: `src/mobile/views/friends/index.vue:179,244,313,346`
- Modify: `src/mobile/views/friends/StartGroupChat.vue:54`
- Modify: `src/mobile/views/friends/AddFriends.vue:55`
- Modify: `src/mobile/views/chat-room/GroupChatMember.vue:33`
- Modify: `src/mobile/views/chat-room/MobileInviteGroupMember.vue:57`
- Modify: `src/mobile/views/chat-room/ManageGroupMember.vue:54,146`
- Test: `src/mobile/layout/__tests__/layoutShell.test.ts`（追加用例）

**Interfaces:**
- Consumes: `AvatarUtils.getAvatarUrl(avatar: string | null | undefined, size?: number): string`
- Produces: 无

- [ ] **Step 1: 写守卫用例**

```ts
it('mobile list avatars request thumbnails instead of originals', () => {
  const files = [
    'src/mobile/components/message/MobileSessionList.vue',
    'src/mobile/views/friends/index.vue',
    'src/mobile/views/friends/StartGroupChat.vue',
    'src/mobile/views/friends/AddFriends.vue',
    'src/mobile/views/chat-room/GroupChatMember.vue',
    'src/mobile/views/chat-room/MobileInviteGroupMember.vue',
    'src/mobile/views/chat-room/ManageGroupMember.vue'
  ]

  for (const file of files) {
    const source = readFileSync(resolve(process.cwd(), file), 'utf-8')
    const calls = source.match(/getAvatarUrl\([^)]*\)/g) ?? []
    expect(calls.every((call) => call.includes(',')), `${file} has size-less avatar call`).toBe(true)
  }
})
```

- [ ] **Step 2: 运行确认失败**

Run: `PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vitest run src/mobile/layout/__tests__/layoutShell.test.ts`
Expected: FAIL，列出未传 size 的文件。

- [ ] **Step 3: 按显示尺寸补第二个参数**

列表行（显示 40–48px）传 `96`；成员网格/详情页头像（显示 56–80px）传 `128`。例如：

```html
<!-- MobileSessionList.vue:71 -->
:src="AvatarUtils.getAvatarUrl(item.avatar, 96)"

<!-- friends/index.vue:179 / 244 / 313（折叠面板内联系人行） -->
:src="AvatarUtils.getAvatarUrl(groupStore.getUserInfo(item.userId)?.avatar!, 96)"

<!-- friends/index.vue:346（搜索结果行） -->
:src="AvatarUtils.getAvatarUrl(item.avatar, 96)"

<!-- StartGroupChat.vue:54 / AddFriends.vue:55 / GroupChatMember.vue:33 -->
:src="AvatarUtils.getAvatarUrl(..., 96)"

<!-- MobileInviteGroupMember.vue:57 -->
:src="AvatarUtils.getAvatarUrl(groupStore.getUserInfo(item.userId)?.avatar!, 96)"

<!-- ManageGroupMember.vue:54（网格）/ 146（已选行） -->
:src="AvatarUtils.getAvatarUrl(groupStore.getUserInfo(item.uid)?.avatar!, 128)"
:src="AvatarUtils.getAvatarUrl(groupStore.getUserInfo(item.uid)?.avatar!, 96)"
```

- [ ] **Step 4: 运行 + 提交**

Run: `PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vitest run src/mobile/layout/__tests__/layoutShell.test.ts && PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vue-tsc --noEmit`
Expected: 全 PASS。

```bash
git add src/mobile/components/message/MobileSessionList.vue src/mobile/views/friends/index.vue src/mobile/views/friends/StartGroupChat.vue src/mobile/views/friends/AddFriends.vue src/mobile/views/chat-room/GroupChatMember.vue src/mobile/views/chat-room/MobileInviteGroupMember.vue src/mobile/views/chat-room/ManageGroupMember.vue src/mobile/layout/__tests__/layoutShell.test.ts
git commit -m "perf(mobile): request thumbnail-sized avatars in lists"
```

---

### Task 13: 移除移动端 webfont 首屏开销（G1）

**Files:**
- Modify: `src/styles/css/design-tokens.css:116-122`
- Modify: `src/styles/scss/global/variable.scss:1-6`
- Delete: `src/styles/scss/global/fonts.scss`
- Delete: `src/assets/fonts/PingFang-Medium.woff2`
- Modify: `src/views/loginWindow/Network.vue:249-255`
- Test: `src/mobile/layout/__tests__/mobileCssGuards.test.ts`（新建）

**Interfaces:**
- Consumes: `--tjg-font-family` 的所有消费方（UnoCSS `font-family` 默认值与 SCSS `--font-family` 别名）
- Produces: 无

- [ ] **Step 1: 写守卫用例**

```ts
// src/mobile/layout/__tests__/mobileCssGuards.test.ts
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf-8')

describe('mobile font payload', () => {
  it('uses the system font stack instead of a bundled PingFang', () => {
    const tokens = read('src/styles/css/design-tokens.css')
    expect(tokens).toContain("'PingFang SC'")
    expect(tokens).not.toContain("'PingFang',")
    expect(existsSync(resolve(process.cwd(), 'src/assets/fonts/PingFang-Medium.woff2'))).toBe(false)
  })

  it('loads the display font only on the login network page', () => {
    expect(existsSync(resolve(process.cwd(), 'src/styles/scss/global/fonts.scss'))).toBe(false)
    const network = read('src/views/loginWindow/Network.vue')
    expect(network).toContain("font-family: 'AliFangYuan'")
    expect(network).toContain('AlimamaFangYuanTiVF-Thin.woff2')
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vitest run src/mobile/layout/__tests__/mobileCssGuards.test.ts`
Expected: FAIL。

- [ ] **Step 3: 字体栈改系统字体**

`design-tokens.css:116-122` 改为：

```css
  --tjg-font-family:
    -apple-system,
    BlinkMacSystemFont,
    'PingFang SC',
    'Hiragino Sans GB',
    'Microsoft YaHei',
    Roboto,
    sans-serif;
```

- [ ] **Step 4: 删除全局 @font-face**

1. 删除 `src/styles/scss/global/fonts.scss`。
2. 删除 `variable.scss:1` 的 `@use 'fonts';`，保留 `* { font-family: var(--font-family), sans-serif !important; caret-color: ... }`。
3. 删除 `src/assets/fonts/PingFang-Medium.woff2`（`DeleteFile`，不要用 `rm`）。

- [ ] **Step 5: 阿里方圆体下沉到 Network.vue**

`Network.vue` 的 scoped style 顶部新增（字体文件保留在 `src/assets/fonts/`）：

```scss
@font-face {
  font-family: 'AliFangYuan';
  src: url('@/assets/fonts/AlimamaFangYuanTiVF-Thin.woff2') format('woff2');
  font-style: normal;
  font-display: swap;
}

.textFont {
  font-family: 'AliFangYuan', sans-serif !important;
}
```

删除原来 `fonts.scss` 中的两段 `@font-face` 后，其它页面不再触发这两个字体的下载。

- [ ] **Step 6: 运行 + 构建体积取证**

Run: `PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vitest run src/mobile/layout/__tests__/mobileCssGuards.test.ts && PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vue-tsc --noEmit && PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm metrics:bundle`
Expected: 测试 PASS；bundle 报告中不再出现 `PingFang-Medium`，`AlimamaFangYuanTiVF-Thin` 只出现在 login 相关 chunk。

- [ ] **Step 7: 提交**

```bash
git add src/styles/css/design-tokens.css src/styles/scss/global/variable.scss src/views/loginWindow/Network.vue src/mobile/layout/__tests__/mobileCssGuards.test.ts
git add -A src/assets/fonts
git commit -m "perf(mobile): drop bundled PingFang and scope display font to login"
```

---

### Task 14: SmartVirtualList 尺寸响应与滚动测量合并（G3）

**Files:**
- Modify: `src/mobile/components/virtual-scroll/SmartVirtualList.vue:69-75,111-116,150-191,246-255`
- Test: `src/mobile/components/virtual-scroll/__tests__/SmartVirtualList.test.ts`（新建）

**Interfaces:**
- Consumes: `props.itemHeight?: number`（默认 50）
- Produces: 无（`defineExpose` 的四个方法签名不变）

- [ ] **Step 1: 写守卫用例**

```ts
// src/mobile/components/virtual-scroll/__tests__/SmartVirtualList.test.ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  resolve(process.cwd(), 'src/mobile/components/virtual-scroll/SmartVirtualList.vue'),
  'utf-8'
)

describe('SmartVirtualList sizing', () => {
  it('tracks container height with a ResizeObserver', () => {
    expect(source).toContain('new ResizeObserver')
    expect(source).toContain('containerHeight.value')
  })

  it('reads the fallback row height reactively', () => {
    expect(source).toContain('const itemHeight = computed(() => props.itemHeight)')
    expect(source).not.toContain('const ITEM_HEIGHT = props.itemHeight')
  })

  it('coalesces measurement into one animation frame', () => {
    expect(source).toContain('requestAnimationFrame')
    expect(source).not.toContain('nextTick(() => {\n    updateItemHeights()\n  })')
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vitest run src/mobile/components/virtual-scroll/__tests__/SmartVirtualList.test.ts`
Expected: 三条 FAIL。

- [ ] **Step 3: 容器高度响应式化**

`scrollTop` / `offset` 声明后新增：

```ts
const containerHeight = ref(0)
let containerObserver: ResizeObserver | null = null
let measurementFrame = 0
```

`const ITEM_HEIGHT = props.itemHeight` 改为：

```ts
const itemHeight = computed(() => props.itemHeight)
```

把 `rebuildCumulativeHeights`（`:83`）、`visibleCount`（`:115`）、`startIndex`（`:120`）、`scrollToIndex`（`:200`）中的 `ITEM_HEIGHT` 全部替换为 `itemHeight.value`。

`visibleCount` 改为：

```ts
const visibleCount = computed(() => {
  const height = containerHeight.value || containerRef.value?.clientHeight || 0
  if (height <= 0) return 20

  return Math.ceil(height / itemHeight.value) + BUFFER * 2
})
```

- [ ] **Step 4: 测量合并到一帧**

新增：

```ts
function scheduleMeasure(): void {
  if (measurementFrame !== 0) return

  measurementFrame = requestAnimationFrame(() => {
    measurementFrame = 0
    updateItemHeights()
  })
}
```

`handleScroll` 的 `nextTick(() => { updateItemHeights() })` 改为 `nextTick(scheduleMeasure)`；`watch(() => props.items.length)` 内的 `nextTick(() => { updateItemHeights() })` 同样改为 `nextTick(scheduleMeasure)`。

- [ ] **Step 5: 挂载/卸载接线**

```ts
onMounted(() => {
  rebuildCumulativeHeights()
  if (phantomRef.value) {
    phantomRef.value.style.height = `${totalHeight.value}px`
  }

  if (containerRef.value) {
    containerHeight.value = containerRef.value.clientHeight
    containerObserver = new ResizeObserver((entries) => {
      containerHeight.value = entries[0]?.contentRect.height ?? containerRef.value?.clientHeight ?? 0
    })
    containerObserver.observe(containerRef.value)
  }
})

onUnmounted(() => {
  containerObserver?.disconnect()
  containerObserver = null
  if (measurementFrame !== 0) {
    cancelAnimationFrame(measurementFrame)
    measurementFrame = 0
  }
  itemHeights.value.clear()
})
```

- [ ] **Step 6: 运行 + 提交**

Run: `PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vitest run src/mobile/components/virtual-scroll/__tests__/SmartVirtualList.test.ts && PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vue-tsc --noEmit`
Expected: 全 PASS。

```bash
git add src/mobile/components/virtual-scroll/SmartVirtualList.vue src/mobile/components/virtual-scroll/__tests__/SmartVirtualList.test.ts
git commit -m "perf(mobile): make virtual list height-reactive and frame-coalesced"
```

---

### Task 15: 移动端 backdrop-filter 纳入性能降级（G4）

**Files:**
- Modify: `src/mobile/layout/tabBar/index.vue:124-130`
- Modify: `src/mobile/layout/navBar/index.vue:25-35`
- Modify: `src/mobile/views/message/index.vue:12-20`
- Modify: `src/mobile/views/friends/index.vue:8-14`
- Test: `src/mobile/layout/__tests__/mobileCssGuards.test.ts`（追加用例）

**Interfaces:**
- Consumes: `@mixin liquid-glass-fallback`（`src/styles/scss/mixins/_liquid-glass.scss`）
- Produces: 无

- [ ] **Step 1: 写守卫用例**

```ts
it('every mobile backdrop-filter has a low-perf fallback', () => {
  const files = [
    'src/mobile/layout/tabBar/index.vue',
    'src/mobile/layout/navBar/index.vue',
    'src/mobile/views/message/index.vue',
    'src/mobile/views/friends/index.vue'
  ]

  for (const file of files) {
    const source = read(file)
    if (!source.includes('backdrop-filter')) continue
    expect(source, `${file} needs liquid-glass-fallback`).toContain('@include liquid-glass-fallback')
  }
})
```

- [ ] **Step 2: 运行确认失败**

Run: `PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vitest run src/mobile/layout/__tests__/mobileCssGuards.test.ts`
Expected: 新用例 FAIL，列出缺 fallback 的文件。

- [ ] **Step 3: 各文件补 mixin**

在每个文件的 `<style scoped lang="scss">` 首行加：

```scss
@use '@/styles/scss/mixins/liquid-glass' as *;
```

并在包含 `backdrop-filter` 的规则块末尾加：

```scss
  @include liquid-glass-fallback;
```

以 `tabBar/index.vue` 为例：

```scss
.tab-bar {
  height: 62px;
  -webkit-backdrop-filter: blur(12px);
  backdrop-filter: blur(12px);

  @include liquid-glass-fallback;
}
```

> 说明：本任务只补降级、不改视觉。`liquid-glass-panel` 会额外引入 `background: color-mix(...)` 与边框，属于视觉变更，需单独评审，不在本轮范围内。

- [ ] **Step 4: 运行 + 提交**

Run: `PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vitest run src/mobile/layout/__tests__/mobileCssGuards.test.ts && PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm check`
Expected: 全 PASS，Biome 无告警。

```bash
git add src/mobile/layout/tabBar/index.vue src/mobile/layout/navBar/index.vue src/mobile/views/message/index.vue src/mobile/views/friends/index.vue src/mobile/layout/__tests__/mobileCssGuards.test.ts
git commit -m "perf(mobile): degrade backdrop blur on low-perf devices"
```

---

## 4. P2 架构收敛路线（不在本轮实施）

以下条目都是「同类问题会再长出来」的根因，需要单独立项与评审，本轮只登记不做：

| # | 问题 | 收敛方案 | 触发条件 |
| :--- | :--- | :--- | :--- |
| P2-1 | 平台判定三份事实源（`PlatformConstants` / `usePlatform` / `detectAppPlatform`） | 以 `usePlatform` 为唯一入口，`PlatformConstants` 改为从其派生；`platformCache` 只缓存 OS 与 UA 结果，`isLandscape` 改为 `useMediaQuery('(orientation: landscape)')` 实时值 | 下一次改动平台判定时 |
| P2-2 | `ManageGroupMember.vue` 是移动路由却用 Naive UI + `type() === 'ios'` | 重写为 Vant 组件（`van-checkbox` / `van-popover` / 单一滚动容器），删除 JS 写死高度 | 群成员管理进入迭代 |
| P2-3 | 平板/折叠屏无断点（`useLandscape` 只有横竖两态） | 引入 `useResponsiveBreakpoint` 的移动端子集（<600 / 600–1024 / >1024），平板竖屏走双列 + 侧边导航 | 有平板适配需求时 |
| P2-4 | 登录页 `top-13vh/20vh` 与居中表单在横屏重叠、指示条像素偏移 | 改为 flex 纵向流式布局，指示条用 `transform` 绑定选项卡宽度 | 登录页改版 |
| P2-5 | 登录表单无 `@keydown.enter`、`autocomplete="off"` 屏蔽密码填充 | 包 `<form @submit.prevent>`；账号/密码分别给 `autocomplete="username" / "current-password"` | 登录页改版（可与 P2-4 合并） |
| P2-6 | 字号缩放无移动端入口（`--tjg-font-scale` 已存在） | 「我的 → 设置 → 字体大小」写 `--tjg-font-scale`，与 H2 的 `user-scalable=no` 一并评审 | 无障碍需求立项 |
| P2-7 | 69 个文件使用 `color-mix()`，Android WebView < 111 失效 | 在 token 层给 `--tjg-*` 提供静态回退值（`@supports not (color: color-mix(in srgb, red, blue))`） | 明确最低支持 Android 12 时 |
| P2-8 | 深链/通知冷启动进聊天页无历史栈，`router.back()` 无响应 | 返回按钮改为 `router.canGoBack() ? back() : replace('/mobile/message')` | 可随 Task 5 顺带做，需产品确认 |
| P2-9 | 设置一级入口缺失（仅「我的」右上角 32px 图标） | TabBar 「我的」页顶部改为整行可点击的设置入口，热区 ≥48px | 「我的」页改版 |

## 5. 验收

### 5.1 每任务门禁（必须全绿）

```bash
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vue-tsc --noEmit
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm test:run
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm check:ratchet
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm check:doc-coverage
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm check:doc-paths
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm check:sdk-boundary
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm quality:no-raw-fetch
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm check
```

### 5.2 真机矩阵（每条 P0/P1 必须在对应机型上人工确认）

| 机型 / 视口 | 必测项 |
| :--- | :--- |
| iPhone SE（375×667，无 Home Indicator） | TabBar 不溢出、长按菜单不出屏、图片双击/下滑关闭、视频进度条可拖 |
| iPhone 15 Pro（393×852，34px 安全区） | TabBar 上下留白合计 ≈34px、聊天输入框在键盘弹出后不被遮挡、新消息悬浮按钮可点 |
| Android 360×800（edge-to-edge） | 键盘弹出后输入框可见、返回手势区不被 TabBar 压住、`html.low-perf` 下无 backdrop 模糊 |
| iPad 竖屏 1024×1366 + 横屏 | 竖屏不出现拉伸的 5 图标底栏（P2 前允许现状，但不得溢出）；横屏侧栏安全区正确 |
| 折叠屏展开 / 分屏 | 会话列表在尺寸变化后重新计算可视条数（Task 14） |

### 5.3 R3 三问（每个 PR 填写）

1. 是否复用了 `matrix-js-sdk` / `src/services/matrix/**` 能力？本计划全部为 UI/布局改动，无新增协议实现，无平行 HTTP 客户端。
2. 是否引入移动端可见的 admin / AI 入口？没有，全部改动位于 `src/mobile/**`、共享布局与样式层。
3. 移动端构建是否可产出？改动不触碰路由树与构建配置，Android/iOS 前端分支构建保持可用。

## 6. 风险与回滚

| 风险 | 影响 | 缓解 |
| :--- | :--- | :--- |
| `100dvh` 在旧 Android WebView（<108）不识别 | 全屏容器高度退化为 auto | 每条 `h-100dvh` 保留 `h-full` 或 `h-screen` 作为前者；Task 2 的 7 处逐一确认存在回退行 |
| keep-alive 白名单变更后组件不再重建 | 聊天页状态残留（滚动位置、输入草稿） | 这是期望行为；若出现状态串房，检查 `MobileChatMain` 是否在 `roomId` 变化时主动 `reset` |
| 长按菜单测量依赖 `nextTick`，首帧可能闪动 | 首帧位置偏差 | `resolveLongPressMenuTop` 在 `menuHeight=0` 时已钳制在视口内，第二次测量只做微调 |
| 字体栈变更影响桌面观感 | macOS 上由内置 PingFang 变为系统 PingFang SC，字重映射略有差异 | 视觉走查 settings / 会话列表两处即可；如需回退只改 `design-tokens.css` 一行 |
| 删除好友占位菜单 | 用户失去一个「原本也无功能」的入口 | 已在 §4 P2 登记分组管理需求；如需保留入口，改为「即将上线」不可点态 |
| 视频加 `controls` 与自定义封面点击冲突 | 首帧点击可能命中控制条 | 保留 `@click.stop`，只在暗色边距点击关闭 |

**回滚方式：** 每个 Task 独立 commit，可用 `git revert <sha>` 单点回滚；Task 13 额外需要恢复 `src/assets/fonts/PingFang-Medium.woff2`（该文件已提交在历史中）。

## 7. Self-Review

- **覆盖面**：A1→T1，A2/A3→T2，A4/C2→T3，F1/F4→T4，C1/E2→T5，C3/C4→T6，D1→T7，D2/D3→T8，E1/E3→T9，F5→T10，F3→T11，G2→T12，G1→T13，G3→T14，G4→T15；B1/B2/B3/B4、C5/C6、D4/D5/D6、E4/E5、F2、G5、H1/H2/H3/H4 归入 §4 P2 或已在 §0 证伪。
- **占位符扫描**：无 TBD / TODO / "类似 Task N"；每个任务含可运行命令与代码块。
- **类型一致性**：`clampMenuPosition` / `resolveLongPressMenuTop` / `MOBILE_NAV_ITEMS` / `resolveNavItems` / `MobileNavItem` 在定义任务与消费任务中签名一致；`itemHeight.value` 在 Task 14 内全部替换点已列全（4 处）。
- **验证可行性**：CSS 布局缺陷无法在 jsdom 断言，统一采用「纯函数单测 + 源码守卫 + 真机矩阵」三层，已在 §5.2 明确人工项。
