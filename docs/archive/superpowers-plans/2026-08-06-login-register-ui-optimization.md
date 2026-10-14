# 登录/注册界面 UI 优化实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复注册页面 P0/P1 级 UI 问题（版权遮挡按钮、缺少返回链接、表单宽度不一致、placeholder 文案不统一），使其完全对齐 `docs/TJG-prototype.html` 高保真原型设计。

**Architecture:** 注册页面 `registerWindow/index.vue` 存在 3 类问题：版权文字绝对定位 `bottom-20px` 与提交按钮重叠、返回登录是底部独立按钮而非原型左上角链接、表单宽度 `max-w-300px` 与登录页 `w-340px` 不一致。修复方式是移除版权 div、将返回按钮改为原型 `auth-back-link` 样式、统一表单宽度，并更新 i18n placeholder 文案。

**Tech Stack:** Vue 3 + TypeScript + Naive UI + UnoCSS + SCSS + vue-i18n

## Global Constraints

- 设计 token 唯一来源：`src/styles/css/design-tokens.css`（`--tjg-*` token），禁止硬编码颜色
- 图标必须使用 SVG（inline `<svg>` 或 `<use>`），线宽 1.5-2px
- 组件体量红线：`.vue` 文件超过 800 行必须拆分
- Tauri 登录窗口固定 420×640（`resizable: false`），不可修改窗口尺寸
- 动效必须尊重 `prefers-reduced-motion`
- TypeScript 版本 6.0.3（vue-tsc 兼容约束）
- 验收命令：`pnpm vue-tsc --noEmit`、`pnpm test:run`、`pnpm check`

---

## File Structure

| 文件 | 职责 | 修改类型 |
|:---|:---|:---|
| `src/views/registerWindow/index.vue` | 注册页面主组件 | 修改：移除版权、添加返回链接、统一宽度 |
| `locales/zh-CN/auth.json` | 中文 i18n 文案 | 修改：placeholder 文案 |
| `locales/en/auth.json` | 英文 i18n 文案 | 修改：placeholder 文案 |
| `src/typings/i18n.d.ts` | i18n 类型定义（自动生成） | 修改：同步 placeholder 类型 |
| `src/views/registerWindow/__tests__/index.test.ts` | 注册页面测试 | 修改：适配返回链接变更 |

---

### Task 1: 移除注册页面版权文字 + 添加原型返回链接

**Files:**
- Modify: `src/views/registerWindow/index.vue` — 移除版权 div（约 L189-192）、移除底部返回按钮（约 L179-181）、在内容区顶部添加 `auth-back-link`
- Test: `src/views/registerWindow/__tests__/index.test.ts`

**Interfaces:**
- Consumes: `router` (from `@/router`，已在组件中导入)
- Produces: 注册页面左上角返回链接，点击跳转 `/login`

**问题现状：**
1. 版权 div（L189-192）绝对定位 `bottom-20px`，与提交按钮（L171-178）和返回按钮（L179-181）垂直重叠
2. 返回登录是底部独立全宽按钮（L179-181），原型设计是左上角 `auth-back-link`（`position: absolute; top: 50px; left: 24px`，带返回箭头 SVG + "返回登录" 文字）
3. 登录页面无版权文字，注册页面有，不一致

- [ ] **Step 1: 移除版权 div**

在 `src/views/registerWindow/index.vue` 中，删除以下代码块（约 L189-192）：

```html
    <!-- 底部栏 -->
    <div class="text-(12px --tjg-text-tertiary) w-full absolute bottom-20px left-0 text-center pointer-events-none z-0">
      <span>Copyright {{ currentYear - 1 }}-{{ currentYear }} 龙卷风 All Rights Reserved.</span>
    </div>
```

同时移除 `<script setup>` 中不再使用的 `currentYear` 变量和 `dayjs` 导入：

```typescript
// 移除这两行（约 L331 和 L233）
import dayjs from 'dayjs'
// ...
const currentYear = dayjs().year()
```

注意：`dayjs` 如果还有其他用途则保留导入。检查后确认 `currentYear` 是 `dayjs` 的唯一使用点，移除 `dayjs` 导入。

- [ ] **Step 2: 移除底部返回按钮**

删除以下代码（约 L179-181）：

```html
          <n-button class="w-full mt-10px" @click="router.replace('/login')">
            {{ t('auth.register.actions.back_to_login') }}
          </n-button>
```

- [ ] **Step 3: 在内容区顶部添加原型 auth-back-link**

在 `<div class="flex-1 min-h-0 w-full overflow-hidden relative z-10">` 内部（约 L10），作为第一个子元素添加：

```html
    <div class="flex-1 min-h-0 w-full overflow-hidden relative z-10">
      <!-- 返回登录链接（对齐原型 auth-back-link） -->
      <div class="auth-back-link" @click="router.replace('/login')" role="button" tabindex="0"
           :aria-label="t('auth.register.actions.back_to_login')"
           @keydown.enter="router.replace('/login')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
        <span>{{ t('auth.register.actions.back_to_login') }}</span>
      </div>
```

- [ ] **Step 4: 添加 auth-back-link 样式**

在 `<style scoped lang="scss">` 块中添加（在 `.auth-logo` 之前）：

```scss
/* 返回登录链接（对齐原型 .auth-back-link） */
.auth-back-link {
  position: absolute;
  top: 14px;
  left: 20px;
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: var(--tjg-text-secondary);
  cursor: pointer;
  z-index: 10;
  transition: color 0.15s;

  svg {
    width: 16px;
    height: 16px;
  }

  &:hover {
    color: var(--tjg-text-primary);
  }
}

@media (prefers-reduced-motion: reduce) {
  .auth-back-link {
    transition: none;
  }
}
```

- [ ] **Step 5: 更新测试文件**

在 `src/views/registerWindow/__tests__/index.test.ts` 中，更新 `dayjs` mock。由于 `currentYear` 已移除，`dayjs` 不再被导入，可以移除 `dayjs` mock（约 L46-60）：

```typescript
// 移除整个 vi.mock('dayjs', ...) 块
vi.mock('dayjs', () => {
  const dayjsMock = () => ({
    year: () => 2026,
    format: () => '2026-05-15',
    add: () => dayjsMock(),
    subtract: () => dayjsMock(),
    locale: vi.fn()
  })
  dayjsMock.extend = vi.fn()
  dayjsMock.duration = vi.fn()
  dayjsMock.locale = vi.fn()
  return {
    default: dayjsMock
  }
})
```

测试中验证返回链接存在：

在 `describe('registerWindow', ...)` 块内新增测试用例：

```typescript
  it('renders back-to-login link with correct aria-label', () => {
    const wrapper = mount(RegisterView, {
      global: {
        stubs: {
          'action-bar': true
        }
      }
    })
    const backLink = wrapper.find('[aria-label="返回登录"]')
    expect(backLink.exists()).toBe(true)
  })
```

- [ ] **Step 6: 运行测试验证**

Run: `pnpm vitest run src/views/registerWindow/__tests__/index.test.ts`
Expected: 2 tests passed (原有 1 个 + 新增 1 个)

- [ ] **Step 7: 运行 vue-tsc 验证**

Run: `pnpm vue-tsc --noEmit`
Expected: 0 errors

- [ ] **Step 8: Commit**

```bash
git add src/views/registerWindow/index.vue src/views/registerWindow/__tests__/index.test.ts
git commit -m "fix(register): remove copyright overlay, add prototype back-to-login link

- Remove absolutely-positioned copyright div that overlapped submit button
- Remove separate full-width back button at bottom
- Add prototype-style auth-back-link at top-left with back arrow SVG
- Remove unused dayjs import and currentYear variable
- Add regression test for back-to-login link"
```

---

### Task 2: 统一注册表单宽度与登录页一致

**Files:**
- Modify: `src/views/registerWindow/index.vue` — 将 `max-w-300px` 改为 `w-340px`

**Interfaces:**
- 无外部接口变更，纯样式调整

**问题现状：**
注册页面表单容器使用 `max-w-300px`（L13），登录页面 `ManualLoginForm.vue` 使用 `w-340px`（L14）。宽度不一致导致注册页面输入框比登录页面窄。

- [ ] **Step 1: 修改表单容器宽度**

在 `src/views/registerWindow/index.vue` 中，将 L13：

```html
        <div class="w-full max-w-300px pointer-events-auto flex flex-col gap-12px text-center">
```

改为：

```html
        <div class="w-full w-340px pointer-events-auto flex flex-col gap-12px text-center">
```

- [ ] **Step 2: 运行测试验证无回归**

Run: `pnpm vitest run src/views/registerWindow/__tests__/index.test.ts`
Expected: 2 tests passed

- [ ] **Step 3: 运行 vue-tsc 验证**

Run: `pnpm vue-tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add src/views/registerWindow/index.vue
git commit -m "style(register): unify form width to w-340px matching login page"
```

---

### Task 3: 统一 placeholder 文案对齐原型

**Files:**
- Modify: `locales/zh-CN/auth.json` — placeholder 文案
- Modify: `locales/en/auth.json` — placeholder 文案
- Modify: `src/typings/i18n.d.ts` — 同步类型定义

**Interfaces:**
- 无代码接口变更，纯 i18n 文案

**问题现状：**
注册页面 placeholder 文案与原型不一致：

| 字段 | 当前文案 | 原型文案 |
|:---|:---|:---|
| nickname | 输入Tjg昵称 | 请输入昵称 (1-8 字) |
| password | 输入Tjg密码 | 请输入密码 (6-16 位) |
| confirm | 二次确认密码 | 请确认密码 |
| email | 输入邮箱 | 请输入邮箱 |

- [ ] **Step 1: 更新中文 placeholder 文案**

在 `locales/zh-CN/auth.json` 中，将 `register.placeholders` 部分（约 L51-56）：

```json
    "placeholders": {
      "nickname": "输入Tjg昵称",
      "email": "输入邮箱",
      "password": "输入Tjg密码",
      "confirm_placeholder": "二次确认密码"
    },
```

改为：

```json
    "placeholders": {
      "nickname": "请输入昵称 (1-8 字)",
      "email": "请输入邮箱",
      "password": "请输入密码 (6-16 位)",
      "confirm_placeholder": "请确认密码"
    },
```

- [ ] **Step 2: 更新英文 placeholder 文案**

在 `locales/en/auth.json` 中，将对应的 `register.placeholders` 部分：

```json
    "placeholders": {
      "nickname": "Enter nickname (1-8 chars)",
      "email": "Enter email",
      "password": "Enter password (6-16 chars)",
      "confirm_placeholder": "Confirm password"
    },
```

- [ ] **Step 3: 同步 i18n.d.ts 类型定义**

在 `src/typings/i18n.d.ts` 中，找到 `register.placeholders` 部分（约 L853-857），同步更新文案：

```typescript
      "placeholders": {
        "nickname": "请输入昵称 (1-8 字)",
        "email": "请输入邮箱",
        "password": "请输入密码 (6-16 位)",
        "confirm_placeholder": "请确认密码"
      },
```

- [ ] **Step 4: 运行 vue-tsc 验证**

Run: `pnpm vue-tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: 运行测试验证无回归**

Run: `pnpm vitest run src/views/registerWindow/__tests__/index.test.ts`
Expected: 2 tests passed

- [ ] **Step 6: Commit**

```bash
git add locales/zh-CN/auth.json locales/en/auth.json src/typings/i18n.d.ts
git commit -m "i18n(register): unify placeholder text to match prototype design"
```

---

### Task 4: 最终验收

**Files:**
- 无文件修改，仅运行验收命令

- [ ] **Step 1: 类型检查**

Run: `pnpm vue-tsc --noEmit`
Expected: 0 errors

- [ ] **Step 2: 单元测试**

Run: `pnpm test:run`
Expected: 失败数 ≤ 9（不超过现有预存失败数，无新增失败）

- [ ] **Step 3: Lint 检查**

Run: `pnpm check`
Expected: 无新增 lint 错误

- [ ] **Step 4: 硬编码颜色守护**

Run: `pnpm check:ratchet`
Expected: 通过

- [ ] **Step 5: SDK 边界守护**

Run: `pnpm check:sdk-boundary`
Expected: 通过

---

## 已完成项（不在本计划范围内）

以下问题在之前的会话中已修复，无需重复处理：

| 问题 | 修复状态 | 文件 |
|:---|:---|:---|
| 扫码登录/更多选项未居中 | ✅ 已修复 | `LoginBottomBar.vue`（flex justify-center） |
| 注册标题设计不符 | ✅ 已修复 | `registerWindow/index.vue`（auth-logo 结构） |
| 缺少密码强度提示 | ✅ 已修复 | `registerWindow/index.vue`（○/● bullet 样式） |
| 登录表单宽度太窄 | ✅ 已修复 | `ManualLoginForm.vue`（w-340px） |
| 企业 SSO 入口 | ✅ 已修复 | `ThirdPartyLogin.vue`（仅保留 Gitee/GitHub） |
| 更多选项下拉菜单 | ✅ 已存在 | `LoginBottomBar.vue`（n-popover 含注册/忘记密码/网络设置/游客） |

## 不修改项

| 问题 | 原因 |
|:---|:---|
| 窗口尺寸 420×640 vs 原型 420×580 | 项目约束：窗口固定 420×640（`resizable: false`），不可修改 |
| 背景动画缺失 | P3 级别，性能影响待评估，后续单独处理 |
| 第三方登录图标尺寸 22px vs 原型 34px | 用户已确认简化设计（仅 Gitee/GitHub），22px 适合当前布局 |
| 协议复选框样式 | 使用 Naive UI 原生组件，与项目 UI 库一致 |
