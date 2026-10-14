# 原型 UI 审查问题修正与项目残留清理 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `docs/TJG-prototype.html` 原型对齐项目真实的 `--tjg-*` token 体系与主题逻辑，避免后续开发照抄原型中的坏模式；同时清理项目代码中 7 个残留旧别名。

**Architecture:** 排查确认原型审查报告中的 8 个问题全部是原型 HTML 特有的，真实 Vue 项目代码已具备完整的主题切换（`setting.ts` + `NaiveProvider.vue`）、`--tjg-*` token 体系（268 个定义）、a11y 支持（`prefers-color-scheme`/`prefers-contrast`/`prefers-reduced-motion`）。本计划分两部分：Part A 修正原型 HTML 的 5 个 P0/P1 问题（token 映射、主题逻辑、硬编码颜色、admin 导航、响应式策略标注）；Part B 清理项目代码中 7 个残留旧别名。

**Tech Stack:** HTML/CSS（原型），Vue 3 + UnoCSS + SCSS（项目），Naive UI

## Global Constraints

- **原型是设计参考，不是可运行代码**：原型修正的目的是让后续开发者看到正确的 token/主题模式，不要求原型能完整运行。
- **禁止扩大项目改动范围**：Part B 仅清理 7 个旧别名引用（3 个 mobile 文件），不触碰 design-tokens.css 的兼容层（那是有意保留的过渡层）。
- **Naive UI hex 覆写不改动**：`NaiveProvider.vue` 中的 `#13987f` 等是 Naive UI 主题 API 的硬性要求（不支持 CSS 变量），且有注释说明来源，不在本计划范围。
- **原型保留单文件结构**：不拆分原型 HTML（19k 行），仅修正内容。拆分是 P2 低优先级，不阻塞。
- **commit scope**：原型用 `docs`，项目清理用 `refactor`。
- **验证命令**：`pnpm check:ratchet`（硬编码颜色守护）、`pnpm vue-tsc --noEmit`、`npx vitest run src/mobile/`。

---

## Part A: 原型 HTML 修正

## File Structure

| 文件 | 职责 | 操作 |
|------|------|------|
| `docs/TJG-prototype.html` | 设计原型（19k 行单文件） | 修改：token 映射 + 主题逻辑 + admin 导航 + 响应式标注 |

---

## Task 1: 原型 token 体系映射到 --tjg-*

**目的**：原型使用 `--bg-deep`/`--text-primary`/`--line-color` 等旧别名，项目已迁移到 `--tjg-*`。将原型 `:root` 变量块映射到项目真实 token 名称，使后续开发者看到正确的命名。

**Files:**
- Modify: `docs/TJG-prototype.html` — `:root` 变量定义块 + 全文 `var(--旧别名)` 引用

**Interfaces:**
- Consumes: `src/styles/css/design-tokens.css` 的 token 名称（权威来源）
- Produces: 原型 `:root` 块使用 `--tjg-*` 命名，全文 `var()` 引用同步更新

- [ ] **Step 1: 读取项目 design-tokens.css 的 token 清单**

读取 `src/styles/css/design-tokens.css` 的 `:root` 块，提取所有 `--tjg-*` 变量名与值。这是映射的权威来源。

- [ ] **Step 2: 建立旧别名 → --tjg-* 映射表**

在原型 `:root` 块上方用注释插入映射表，例如：

```css
/* === 旧别名 → 项目 token 映射（已迁移到 --tjg-*）===
   --bg-deep        → --tjg-bg-deep
   --text-primary   → --tjg-text-primary
   --line-color     → --tjg-border-subtle
   --center-bg-color→ --tjg-bg-surface
   ...（根据 design-tokens.css 实际名称补全）
*/
```

- [ ] **Step 3: 替换 `:root` 变量定义为 --tjg-* 名称**

将原型 `:root` 块中的旧别名变量替换为对应的 `--tjg-*` 名称，值从 design-tokens.css 复制。删除旧别名定义。

- [ ] **Step 4: 全文替换 `var(--旧别名)` 引用**

用 grep 找到所有 `var(--bg-deep)`/`var(--text-primary)`/`var(--line-color)` 等引用，替换为 `var(--tjg-*)` 对应名称。

- [ ] **Step 5: 添加 `meta color-scheme` 与 `theme-color` 的 light 配套**

原型 `<meta name="color-scheme" content="dark">` 和 `<meta name="theme-color" content="#1b1b1b">` 写死暗色。改为 `content="dark light"` 并添加 light theme-color 的 media query：

```html
<meta name="color-scheme" content="dark light">
<meta name="theme-color" content="#1b1b1b" media="(prefers-color-scheme: dark)">
<meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)">
```

- [ ] **Step 6: 验证**

在浏览器打开原型，确认：
- 暗色模式外观不变（token 值相同，仅名称变了）
- 无 `var()` 引用悬空（DevTools Console 无 CSS 解析错误）

- [ ] **Step 7: 提交**

```bash
git add docs/TJG-prototype.html
git commit -m "docs: map prototype tokens to --tjg-* project standard, add light meta theme-color"
```

---

## Task 2: 原型主题切换补全 light 主题 CSS + 应用逻辑

**目的**：原型的"外观主题"设置页渲染了 dark/light/auto 三个选项但无应用逻辑。补充 `[data-theme="light"]` 选择器与主题切换 JS，使原型可演示主题切换。

**Files:**
- Modify: `docs/TJG-prototype.html` — CSS `[data-theme]` 块 + JS 主题切换函数

**Interfaces:**
- Produces: 原型主题卡片可点击切换；`<html data-theme="dark|light">` 正确应用

- [ ] **Step 1: 添加 `[data-theme="light"]` CSS 变量覆盖块**

在原型 `:root`（暗色默认）之后添加：

```css
[data-theme="light"] {
  --tjg-bg-deep: #ffffff;
  --tjg-text-primary: #1a1a1a;
  --tjg-text-secondary: #666666;
  --tjg-bg-surface: #f5f5f5;
  --tjg-border-subtle: #e5e5e5;
  /* ... 根据 design-tokens.css 的 light 值补全 ... */
}
```

值从 `design-tokens.css` 的 light 主题覆盖块复制（如果项目有 `[data-theme="light"]` 块）或从 Naive UI light theme 对照推导。

- [ ] **Step 2: 添加主题切换 JS**

在原型 `<script>` 块中添加：

```javascript
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme)
  localStorage.setItem('theme', theme)
}

function initTheme() {
  const saved = localStorage.getItem('theme') || 'auto'
  if (saved === 'auto') {
    const prefers = matchMedia('(prefers-color-scheme: dark)').matches
    document.documentElement.setAttribute('data-theme', prefers ? 'dark' : 'light')
  } else {
    applyTheme(saved)
  }
}

// 绑定主题卡片点击
document.querySelectorAll('.theme-card').forEach(card => {
  card.addEventListener('click', () => applyTheme(card.dataset.theme))
})

initTheme()
```

- [ ] **Step 3: 添加 `prefers-color-scheme` 自动跟随**

```css
@media (prefers-color-scheme: light) {
  :root:not([data-theme="dark"]) {
    /* light 主题变量覆盖 */
  }
}
```

- [ ] **Step 4: 验证**

在浏览器中点击 dark/light/auto 三个卡片，确认主题实时切换。刷新页面后主题保持（localStorage）。

- [ ] **Step 5: 提交**

```bash
git add docs/TJG-prototype.html
git commit -m "docs: add light theme CSS and theme switching logic to prototype"
```

---

## Task 3: 原型硬编码颜色映射到 token

**目的**：原型有 223 处硬编码 hex（`#fff`/`#ec4899`/`#0F2027` 等）。将能映射到 `--tjg-*` token 的颜色替换为 `var()` 引用；无法映射的（如渐变中间值）添加注释说明。

**Files:**
- Modify: `docs/TJG-prototype.html` — 全文硬编码颜色

**Interfaces:**
- Produces: 原型硬编码 hex 从 223 处降至 < 30 处（仅渐变中间值/SVG fill 等无法 token 化的残留）

- [ ] **Step 1: grep 统计原型中所有硬编码 hex**

```bash
grep -on '#[0-9a-fA-F]\{3,8\}' docs/TJG-prototype.html | sort | uniq -c | sort -rn | head -30
```

记录出现频率最高的颜色值。

- [ ] **Step 2: 建立颜色 → token 映射**

将高频颜色映射到 `--tjg-*` token，例如：
- `#fff`/`#ffffff` → `var(--tjg-text-inverse)` 或 `var(--tjg-bg-surface)`
- `#1b1b1b`/`#1a1a1a` → `var(--tjg-bg-deep)`
- `#13987f` → `var(--tjg-brand)` 或 `var(--tjg-color-primary-500)`
- `#ec4899` → `var(--tjg-color-danger-500)` 或自定义 token
- `rgba(255,255,255,0.4)` → `var(--tjg-text-secondary)` 或 `var(--tjg-text-disabled)`

- [ ] **Step 3: 批量替换可映射的颜色**

用编辑器查找替换（或 sed）将映射的 hex 替换为 `var(--tjg-*)`。每次替换后确认 CSS 仍有效。

- [ ] **Step 4: 修正已知对比度违规**

原型审查报告中的对比度违规：
- `#707070` 弱化文字 3.65:1 → 提升到 `#999999`（4.5:1）或用 `var(--tjg-text-secondary)`
- `#595959` 1.8:1 → 提升到 `var(--tjg-text-secondary)`
- `#13987f` 白字气泡 2.6:1 → 改用 `var(--tjg-color-primary-600)` (#0f7a66) 或深底白字

- [ ] **Step 5: 为无法 token 化的残留添加注释**

对渐变中间值（如 `linear-gradient(135deg, #0F2027, #203A43)`）和 SVG fill 添加注释：

```css
/* 硬编码：渐变中间值无法用单一 token 表达，参考 --tjg-brand 系列 */
```

- [ ] **Step 6: 验证**

浏览器打开原型，确认外观无明显变化（token 值相同）。检查 DevTools 无 CSS 解析错误。

- [ ] **Step 7: 提交**

```bash
git add docs/TJG-prototype.html
git commit -m "docs: map 200+ hardcoded hex colors to --tjg-* tokens, fix contrast violations"
```

---

## Task 4: 原型 admin 导航移除"外部服务"项

**目的**：原型管理后台侧边栏仍有"外部服务"导航项（行 ~8275）和"外部服务集成"页面（行 ~8618+），但项目已在 P2 审查中删除 `AdminExternalServices.vue`。移除原型中的对应内容以防误导。

**Files:**
- Modify: `docs/TJG-prototype.html` — admin 导航 HTML + 外部服务页面 HTML

- [ ] **Step 1: 定位"外部服务"导航项与页面**

```bash
grep -n "外部服务\|bridges\|external.service" docs/TJG-prototype.html
```

记录所有行号。

- [ ] **Step 2: 删除导航项 HTML**

删除 `<div class="admin-nav-item" data-atab="bridges">...</div>` 整个块。

- [ ] **Step 3: 删除"外部服务集成"页面 HTML**

删除对应的 `<div class="admin-page" data-page="bridges">...</div>` 整个块。

- [ ] **Step 4: 删除关联的 JS 逻辑**

grep 原型 `<script>` 中对 `bridges` 的引用（如 `switchView('bridges')`），删除对应分支。

- [ ] **Step 5: 验证**

浏览器打开原型 admin 页面，确认侧边栏无"外部服务"项，无孤儿 JS 引用。

- [ ] **Step 6: 提交**

```bash
git add docs/TJG-prototype.html
git commit -m "docs: remove deleted 'external services' admin nav from prototype"
```

---

## Task 5: 原型响应式策略标注 + 移动端路由修正

**目的**：原型 1200px 以下用 `transform:scale()` 整体缩放，这是展示技巧非真实响应式。添加注释标注，并修正移动端 `#message` 与 `#contacts` 渲染相同截图的问题。

**Files:**
- Modify: `docs/TJG-prototype.html` — `@media` 断点区 + 移动端 switchView JS

- [ ] **Step 1: 为 transform:scale 断点添加警示注释**

在 `@media (max-width: 1200px)` 的 `transform:scale()` 处添加：

```css
/* ⚠️ 原型展示技巧 — 真实项目请用 UnoCSS 响应式工具类（如 md:flex-row flex-col）
   实现 fluid layout，不要用 transform:scale 缩放整个视口。
   参考项目 src/mobile/ 的独立移动端实现。 */
```

- [ ] **Step 2: 修正移动端 switchView 路由**

grep 原型 JS 中 `switchView` 函数，找到移动端分支。确认 `#message` 和 `#contacts` 渲染不同视图内容。如果 switchView 对移动端没有正确分支，补充：

```javascript
function switchView(view) {
  // PC 端
  document.querySelectorAll('.pc-view').forEach(el => el.style.display = 'none')
  const pcTarget = document.querySelector(`.pc-view[data-view="${view}"]`)
  if (pcTarget) pcTarget.style.display = 'block'

  // 移动端
  document.querySelectorAll('.mobile-view').forEach(el => el.style.display = 'none')
  const mobileTarget = document.querySelector(`.mobile-view[data-view="${view}"]`)
  if (mobileTarget) mobileTarget.style.display = 'block'
}
```

- [ ] **Step 3: 验证**

浏览器打开原型，URL hash 切换 `#message` → `#contacts`，确认移动端视图内容不同。

- [ ] **Step 4: 提交**

```bash
git add docs/TJG-prototype.html
git commit -m "docs: annotate transform:scale as prototype-only, fix mobile route switching"
```

---

## Part B: 项目代码残留清理

## File Structure

| 文件 | 职责 | 操作 |
|------|------|------|
| `src/mobile/views/rooms/index.vue` | 移动端房间视图 | 修改：旧别名 → --tjg-* |
| `src/mobile/components/MobileLayout.vue` | 移动端布局 | 修改：旧别名 → --tjg-* |
| `src/mobile/layout/tabBar/index.vue` | 移动端 TabBar | 修改：旧别名 → --tjg-* |

**不修改**：`src/styles/css/design-tokens.css` 中的 4 处旧别名（有意保留的兼容层过渡层，待全量迁移后统一删除）

---

## Task 6: 清理 3 个 mobile 文件中的旧别名引用

**目的**：项目 memory 记录"--tjg-* 为规范前缀，旧别名已全部迁移"，但排查发现 3 个 mobile 文件仍引用 `--bg-deep`/`--text-primary`/`--line-color`/`--center-bg-color`。完成最后清理。

**Files:**
- Modify: `src/mobile/views/rooms/index.vue`
- Modify: `src/mobile/components/MobileLayout.vue`
- Modify: `src/mobile/layout/tabBar/index.vue`

**Interfaces:**
- Consumes: `src/styles/css/design-tokens.css` 的 token 名称
- Produces: 3 个文件中 0 个旧别名引用

- [ ] **Step 1: 读取每个文件中的旧别名引用**

```bash
grep -n "--bg-deep\|--text-primary\|--line-color\|--center-bg-color" src/mobile/views/rooms/index.vue src/mobile/components/MobileLayout.vue src/mobile/layout/tabBar/index.vue
```

记录每处行号和上下文。

- [ ] **Step 2: 查找 design-tokens.css 中的对应 --tjg-* 名称**

对每个旧别名，在 `design-tokens.css` 中找到对应的 `--tjg-*` 名称。如果旧别名在兼容层中有映射（如 `--bg-deep: var(--tjg-bg-deep)`），直接用 `--tjg-bg-deep` 替换。

- [ ] **Step 3: 逐文件替换**

对每个文件，将 `var(--bg-deep)` → `var(--tjg-bg-deep)`，`var(--text-primary)` → `var(--tjg-text-primary)` 等。使用 Edit 工具精确替换。

- [ ] **Step 4: 验证旧别名清零**

```bash
grep -rn "--bg-deep\|--text-primary\|--line-color\|--center-bg-color" src/mobile/
```

预期：0 匹配（design-tokens.css 的兼容层不在 src/mobile/ 下）。

- [ ] **Step 5: 运行 ratchet 守护**

```bash
pnpm check:ratchet
```

预期：通过（无新增硬编码颜色违规）。

- [ ] **Step 6: 运行类型检查与测试**

```bash
npx vue-tsc --noEmit
npx vitest run src/mobile/
```

预期：0 错误，测试全通过。

- [ ] **Step 7: 提交**

```bash
git add src/mobile/views/rooms/index.vue src/mobile/components/MobileLayout.vue src/mobile/layout/tabBar/index.vue
git commit -m "refactor(mobile): replace 7 legacy CSS alias references with --tjg-* tokens"
```

---

## Task 7: 最终验证

**目的**：确认所有改动无回归。

- [ ] **Step 1: 全套守护命令**

```bash
pnpm vue-tsc --noEmit
pnpm check:ratchet
npx vitest run src/mobile/
```

预期：全部通过。

- [ ] **Step 2: grep 确认旧别名在 mobile 中清零**

```bash
grep -rn "--bg-deep\|--text-primary\|--line-color\|--center-bg-color" src/mobile/
```

预期：0 匹配。

- [ ] **Step 3: 原型浏览器验证**

打开 `docs/TJG-prototype.html`，确认：
- 主题切换（dark/light/auto）可工作
- 颜色外观无明显变化
- admin 侧边栏无"外部服务"
- 移动端 `#message`/`#contacts` 渲染不同内容

---

## Risks

- **原型修正量大**：Task 1-5 都是原型 HTML 修改，单文件 19k 行，编辑需精确。建议每个 Task 独立提交，便于回滚。
- **mobile 清理风险极低**：旧别名与 `--tjg-*` 在 design-tokens.css 中值相同（兼容层 `--bg-deep: var(--tjg-bg-deep)`），替换是等价变换。
- **Naive UI hex 覆写不在范围**：`NaiveProvider.vue` 中的 `#13987f` 等是 Naive UI 主题 API 限制，无法用 CSS 变量。已添加注释说明，不视为缺陷。
- **原型 light 主题值需推导**：如果 `design-tokens.css` 没有 `[data-theme="light"]` 块，Task 2 的 light 值需从 Naive UI light theme 对照推导，可能有细微色差。
