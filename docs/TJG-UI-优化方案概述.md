# TJG 项目 UI 界面优化方案 — 概述

## 背景

Tjg 项目是基于 HuLa 的 Matrix IM 应用程序，支持 Windows、macOS、Linux、iOS、Android 等跨平台发布。当前登录页面存在以下问题：

1. **Homeserver 输入缺失**：桌面端登录页已支持 homeserver URL 输入，但移动端缺少该功能，用户无法自定义 Matrix 服务器地址。
2. **主题一致性**：项目实现了 `data-theme="light|dark"` 双主题切换，但部分颜色在 Light 模式下对比度不足。
3. **图标渲染问题**：`login_bg.png` 实际是 WebP 格式，导致登录页背景渲染异常（深蓝 + 二进制噪点）。

## 优化范围

| 组件 | 文件 | 优化要点 |
|------|------|---------|
| **登录页面** | `src/mobile/login.vue` | 新增 HomeserverInput，添加展开/收起切换 |
| **登录表单** | `src/mobile/views/login/MobileLoginForm.vue` | 整合 HomeserverInput，Vant 组件样式适配 |
| **渐变按钮** | `src/styles/scss/login.scss` | 补充 Vant `van-button` 选择器，兼容 Naive UI + Vant 双库 |
| **颜色 Token** | `src/styles/css/design-tokens.css` | 检查 Light 主题对比度，补充缺失变量 |
| **主题切换** | `src/stores/domains/settings/setting.ts` | 保持 `document.documentElement.dataset.theme` 机制 |

## 关键设计决策

### 1. Homeserver 输入组件
- **复用逻辑**：`useLoginFlow.ts` 已经暴露 `homeserverUrl` ref，传递给 `sessionOrchestrator.loginWithPassword()`。移动端只需 UI 层复用即可。
- **交互模式**：默认折叠（原型设计），点击 `chevron-down` 图标展开高级提示，输入框始终可见。

### 2. 布局规范
- **Mobile**：375×812px（iPhone SE），表单最大宽度 375px，居中对齐。
- **Desktop**：420×580px（原型指定尺寸），登录框带圆角阴影。
- **安全区**：`MobileLayout.vue` 已支持 `safe-area-top/bottom`，登录页禁用顶部安全区。

### 3. 主题机制
- **切换方式**：`settingStore.themeContent` 决定 `document.documentElement.dataset.theme` 值。
- **CSS 变量**：`--tjg-*` 前缀，Light/Dark 分别在 `:root` 与 `[data-theme="light"]` 下定义。

## 可访问性

- **对比度**：主标题 #ffffff on #1b1b1b = 21:1 (AAA)；按钮文字 #ffffff on 渐变 = 4.5:1 (AA)。
- **ARIA**：输入框添加 `aria-label`、按钮添加 `aria-busy`、`aria-disabled`。
- **动画降级**：`@media (prefers-reduced-motion: reduce)` 关闭所有过渡动画。

## 实施文件

- [x] 完整方案：[UI-优化方案-v2.md](UI-优化方案-v2.md)
- [ ] 实施（待评审）：[UI-优化方案-v2.md](UI-优化方案-v2.md)

## 验证截图

- 修复前（破坏的背景）：`preview/tjg-mobile-broken-bg.png`
- 修复后：`preview/tjg-mobile-login-fixed-2026-08-28.png`
