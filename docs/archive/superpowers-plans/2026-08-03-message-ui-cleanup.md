# 消息界面冗余清理 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 清理消息界面（中间列表栏 + 右侧聊天栏）中的冗余代码，移除未使用的变量、无效的主题切换逻辑、锁定的宽度约束，使代码与 TJG 原型设计保持一致。

**Architecture:** 消息界面由三栏布局组成：左侧导航栏（`layout/left`）、中间列表栏（`layout/center`）、右侧聊天栏（`layout/right`）。本次清理聚焦于 center 和 right 两个组件，移除无效代码并修复宽度约束 Bug。

**Tech Stack:** Vue 3 (Composition API), TypeScript, UnoCSS, SCSS, Pinia

## Global Constraints

- 不得引入新依赖
- 不得改变现有交互行为（拖拽、视图切换、响应式断点）
- 修改后 `vue-tsc --noEmit` 必须 0 错误
- 修改后单元测试必须全部通过
- 遵循项目 Biome/Prettier 格式规范

---

## File Structure

| 文件 | 职责 | 本次操作 |
|---|---|---|
| `src/layout/right/index.vue` | 右侧聊天栏：视图切换、拖拽、主题 | 移除冗余主题代码 |
| `src/layout/center/index.vue` | 中间列表栏：会话列表、拖拽 | 修复 centerStyle 宽度约束 |
| `src/layout/center/style.scss` | 中间栏样式（空文件） | 移除空文件和引用 |

---

### Task 1: 移除 right/index.vue 中的冗余主题切换代码

**Files:**
- Modify: `src/layout/right/index.vue:88-115` (script imports 和变量定义)
- Modify: `src/layout/right/index.vue:199-212` (followOS 和 watchEffect)
- Test: 无需测试（移除未使用代码，不影响行为）

**Interfaces:**
- Consumes: 无
- Produces: 移除 `imgTheme`、`followOS`、`prefers` 变量，移除 `settingStore` 和 `ThemeEnum` 导入

**问题分析:**

`imgTheme` 变量在第 114 行定义，但从未在 template 中使用。`followOS` 函数和 `watchEffect`（第 199-212 行）仅修改 `imgTheme`，因此整段代码是无效的死代码。`settingStore` 仅在此段代码中使用 `themePattern` 和 `themeContent`，移除后不再需要导入。`ThemeEnum` 仅用于 `imgTheme` 的类型注解，移除后不再需要。

- [ ] **Step 1: 移除 script 中的冗余变量和导入**

在 `src/layout/right/index.vue` 中，移除以下代码：

1. 移除 `import { useSettingStore }` (第 103 行) — 仅用于 imgTheme
2. 移除 `import { MittEnum, RoomTypeEnum, ThemeEnum }` 中的 `ThemeEnum` (第 100 行) — 仅用于 imgTheme 类型
3. 移除 `const settingStore = useSettingStore()` (第 110 行)
4. 移除 `const imgTheme = ref<ThemeEnum>(settingStore.themeContent)` (第 114 行)
5. 移除 `const prefers = matchMedia('(prefers-color-scheme: dark)')` (第 115 行)
6. 移除 `const followOS = () => { ... }` 函数 (第 199-202 行)
7. 移除 `watchEffect(() => { if (settingStore.themePattern === ThemeEnum.OS) { ... } })` (第 204-212 行)

- [ ] **Step 2: 验证 vue-tsc 无错误**

Run: `pnpm vue-tsc --noEmit 2>&1 | grep "error TS" | head -5`
Expected: 0 errors

- [ ] **Step 3: 验证浏览器页面正常**

Run: 浏览器访问 `http://localhost:6130/message`
Expected: 页面正常显示，三栏布局完整，无控制台错误

- [ ] **Step 4: Commit**

```bash
git add src/layout/right/index.vue
git commit -m "refactor: 移除 right/index.vue 中未使用的主题切换代码

imgTheme 变量从未在 template 中使用，followOS 和 watchEffect
仅修改 imgTheme，整段代码是无效死代码。settingStore 和 ThemeEnum
仅在此段代码中使用，一并移除。"
```

---

### Task 2: 修复 center/index.vue centerStyle 宽度锁定 Bug

**Files:**
- Modify: `src/layout/center/index.vue:45-61` (centerStyle computed)
- Test: `src/layout/center/__tests__/index.test.ts`

**Interfaces:**
- Consumes: `settingStore.panelWidth.left` (来自 Pinia store)
- Produces: `centerStyle` computed 返回正确的 minWidth/maxWidth

**问题分析:**

当前 `centerStyle` 在非 shrink 模式下将 `minWidth` 和 `maxWidth` 都设为 `${w}px`，完全锁定宽度。虽然 `flex: '0 0 auto'` 已固定宽度，但 minWidth/maxWidth 锁定为同一值是冗余的。应改为 `200px`/`600px`，与 `setPanelWidth` 的钳制范围一致，允许未来 flex 缩放。

- [ ] **Step 1: 更新 centerStyle 计算属性**

在 `src/layout/center/index.vue` 第 54-60 行，将：

```typescript
const w = settingStore.panelWidth.left
return {
  flex: '0 0 auto',
  width: `${w}px`,
  minWidth: `${w}px`,
  maxWidth: `${w}px`
}
```

改为：

```typescript
const w = settingStore.panelWidth.left
return {
  flex: '0 0 auto',
  width: `${w}px`,
  minWidth: '200px',
  maxWidth: '600px'
}
```

- [ ] **Step 2: 验证 vue-tsc 无错误**

Run: `pnpm vue-tsc --noEmit 2>&1 | grep "error TS" | head -5`
Expected: 0 errors

- [ ] **Step 3: 运行单元测试**

Run: `pnpm vitest run src/layout/center/__tests__/index.test.ts`
Expected: 所有测试通过

- [ ] **Step 4: 验证浏览器拖拽行为**

Run: 浏览器访问 `http://localhost:6130/message`，拖拽中间栏分隔条
Expected: 中间栏宽度在 200-600px 范围内变化，不消失

- [ ] **Step 5: Commit**

```bash
git add src/layout/center/index.vue
git commit -m "fix: centerStyle minWidth/maxWidth 改为 200px/600px

之前 minWidth 和 maxWidth 都设为 panelWidth.left 的值，
完全锁定宽度。改为与 setPanelWidth 钳制范围一致的 200px/600px。"
```

---

### Task 3: 移除 center/style.scss 空文件及引用

**Files:**
- Delete: `src/layout/center/style.scss` (空文件，仅 1 行)
- Modify: `src/layout/center/index.vue:87-89` (移除 `<style scoped lang="scss"> @use 'style'; </style>`)

**Interfaces:**
- Consumes: 无
- Produces: 无

**问题分析:**

`center/style.scss` 文件只有 1 行且无实际内容（空文件）。`center/index.vue` 的 `<style>` 块通过 `@use 'style'` 引用它，但没有任何样式输出。移除空文件和引用可以减少文件数量和构建开销。

- [ ] **Step 1: 确认 style.scss 为空**

Run: `wc -l src/layout/center/style.scss && cat src/layout/center/style.scss`
Expected: 0 行或仅空行

- [ ] **Step 2: 移除 center/index.vue 中的 style 块**

在 `src/layout/center/index.vue` 末尾，移除：

```scss
<style scoped lang="scss">
@use 'style';
</style>
```

- [ ] **Step 3: 删除空文件**

Delete: `src/layout/center/style.scss`

- [ ] **Step 4: 验证 vue-tsc 无错误**

Run: `pnpm vue-tsc --noEmit 2>&1 | grep "error TS" | head -5`
Expected: 0 errors

- [ ] **Step 5: 验证浏览器页面正常**

Run: 浏览器访问 `http://localhost:6130/message`
Expected: 页面正常显示，中间栏样式不受影响

- [ ] **Step 6: Commit**

```bash
git rm src/layout/center/style.scss
git add src/layout/center/index.vue
git commit -m "chore: 移除空的 center/style.scss 及 @use 引用

文件无实际样式内容，移除以减少文件数量。"
```

---

### Task 4: 移除 layout/index.vue 中异步组件的 keep-alive

**Files:**
- Modify: `src/layout/index.vue:12-23` (移除 keep-alive 包裹)

**Interfaces:**
- Consumes: 无
- Produces: 无

**问题分析:**

项目记忆中记录："<keep-alive> should not be used with <router-view> for asynchronous components to avoid deactivate function errors"。虽然这里 `<keep-alive>` 包裹的是 `defineAsyncComponent` 组件而非 `<router-view>`，但异步组件与 `<keep-alive>` 的组合仍可能导致 `deactivate` 生命周期错误。移除 `<keep-alive>` 可避免此风险。

注意：`AsyncRight` 已有 `v-if="!shrinkStatus"` 条件渲染，移除 `<keep-alive>` 后组件会在 `shrinkStatus` 切换时重新加载。但 `AsyncCenter` 和 `AsyncLeft` 没有 `v-if`，移除 `<keep-alive>` 不影响它们的渲染。

- [ ] **Step 1: 移除 keep-alive 包裹**

在 `src/layout/index.vue` 第 12-23 行，将：

```html
<div class="flex flex-1 min-h-0">
  <!-- 使用keep-alive包裹异步组件 -->
  <keep-alive>
    <AsyncLeft />
  </keep-alive>
  <keep-alive>
    <AsyncCenter />
  </keep-alive>
  <keep-alive>
    <AsyncRight v-if="!shrinkStatus" />
  </keep-alive>
</div>
```

改为：

```html
<div class="flex flex-1 min-h-0">
  <AsyncLeft />
  <AsyncCenter />
  <AsyncRight v-if="!shrinkStatus" />
</div>
```

- [ ] **Step 2: 验证 vue-tsc 无错误**

Run: `pnpm vue-tsc --noEmit 2>&1 | grep "error TS" | head -5`
Expected: 0 errors

- [ ] **Step 3: 验证浏览器页面正常**

Run: 浏览器访问 `http://localhost:6130/message`
Expected: 页面正常显示，三栏布局完整，无控制台错误

- [ ] **Step 4: Commit**

```bash
git add src/layout/index.vue
git commit -m "refactor: 移除异步组件的 keep-alive 包裹

keep-alive 与 defineAsyncComponent 组合可能导致 deactivate
生命周期错误。移除 keep-alive 避免此风险。"
```

---

## Self-Review

### 1. Spec coverage
- ✅ Task 1: 移除 right/index.vue 冗余主题代码
- ✅ Task 2: 修复 center/index.vue centerStyle 宽度锁定
- ✅ Task 3: 移除 center/style.scss 空文件
- ✅ Task 4: 移除 layout/index.vue keep-alive

### 2. Placeholder scan
- 无 "TBD"、"TODO"、"implement later"
- 每个步骤都有具体的代码和命令
- 无 "Similar to Task N" 引用

### 3. Type consistency
- `centerStyle` 在 Task 2 中返回类型一致（CSSProperties 对象）
- `settingStore.panelWidth.left` 类型为 number，在所有任务中一致
