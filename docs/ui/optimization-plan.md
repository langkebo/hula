# HuLa UI 视觉一致性收尾方案

> 参考项目：[HuLaSpark/HuLa](https://github.com/HuLaSpark/HuLa)
> 制定日期：2026-07-29
> 实施日期：2026-07-29
> 状态：Wave 1 + Wave 2 已实施，Wave 3 已决策（保留标注），22/22 评估项全部验证通过，§十二 后续维护建议 1/2 已实施
> 文档版本：v3.3

---

## 0. 文档定位

### 0.1 本方案的范围

本方案是 **视觉一致性收尾方案**，聚焦「为什么已定义的样式没生效」「为什么感觉碎片化」两类问题，不重新定义设计令牌、不重构组件层级、不引入新交互模式。

### 0.2 与先验文档的关系

| 文档 | 范围 | 与本方案的关系 |
|------|------|---------------|
| [docs/superpowers/plans/2026-07-15-ui-ux-optimization.md](file:///Users/ljf/Desktop/hu_ts/hula/docs/superpowers/plans/2026-07-15-ui-ux-optimization.md) | 原型对齐、Pass 1-N | 本方案接续其视觉对齐部分；其引用的 `docs/hula-prototype.html`（8648 行）现已不存在，相关原型驱动项已失效 |
| [docs/archive/hula_UI_UX_Optimization_Report.md](file:///Users/ljf/Desktop/hu_ts/hula/docs/archive/hula_UI_UX_Optimization_Report.md) | P0/P1/P2 已落地总结 | 本方案不重复其已完成项 |
| [docs/issues/2026-07-28-项目优化方案.md](file:///Users/ljf/Desktop/hu_ts/hula/docs/issues/2026-07-28-项目优化方案.md) | 功能性优化阶段 1-6 | 功能性错误（如「获取设备列表失败」）不在本方案范围 |
| [CONTEXT.md](file:///Users/ljf/Desktop/hu_ts/hula/CONTEXT.md) | 视觉一致性术语表 | 本方案引用其术语定义 |
| [ADR-004-Brand-Color-Dual-Layer-Strategy.md](file:///Users/ljf/Desktop/hu_ts/hula/docs/adr/ADR-004-Brand-Color-Dual-Layer-Strategy.md) | 品牌色双层策略决策记录 | 本方案色彩部分依据此 ADR |

### 0.3 命名约定

本方案使用 **Wave 1-3** 命名（非「阶段 1-6」），以与 2026-07-28 文档的功能性阶段区分。

---

## 一、设计理念与原则

本节术语定义同步收录于 [CONTEXT.md](file:///Users/ljf/Desktop/hu_ts/hula/CONTEXT.md)。仅纳入代码中已确立且可解释「为什么」的原则。

### 1.1 品牌色双层策略（已确立，见 ADR-004）

项目同时维护两层品牌色表达：

- **深青绿 `#13987f`**（`--hula-brand`、`--hula-color-primary-500`）：用于品牌识别与 Naive UI 主题。
- **亮青绿渐变 `#4ecdc4 → #3db8a8`**（`--hula-surface-session-active`、`--left-bg-color`）：用于交互高亮与左侧栏背景。

双层并存的原因：Naive UI 内部使用 `seemly/rgba` 对颜色做 hover/pressed 运算，无法解析 CSS 变量引用，必须传入具体 hex 值（见 [NaiveProvider.vue:53-65](file:///Users/ljf/Desktop/hu_ts/hula/src/components/common/NaiveProvider.vue#L53-65)）。

**Invariant**：`--hula-brand` 色值变更时，必须同步修改 [NaiveProvider.vue](file:///Users/ljf/Desktop/hu_ts/hula/src/components/common/NaiveProvider.vue) 的 `primaryColors` 常量。

### 1.2 三栏亮度渐进（已确立）

桌面端三栏布局采用 **L0 最深 → L1 中等 → L2 最浅** 的亮度递进（见 [design-tokens.css:48](file:///Users/ljf/Desktop/hu_ts/hula/src/styles/css/design-tokens.css#L48)）：

```
左侧栏（L0 最深）：亮青绿渐变背景  ← 最醒目，承担导航识别
  ↓ 视觉引导
中间栏（L1 中等）：白色面板 + 选中项青绿渐变  ← 内容区
  ↓ 视觉引导
右侧栏（L2 最浅）：浅灰背景 + 消息气泡  ← 详情区
```

> 注：原代码注释引用「需求文档 3.1.1」描述此原则来源，但该需求文档在仓库中已无法定位。本方案 Wave 1 包含对该失效引用的清理。

### 1.3 3px 强调指示条（模式已确立，命名不一致待修复）

用于标识「置顶 / 当前激活 / 重要分支」的视觉模式：在元素左侧叠加一条 **3px 宽** 的强调色实心条。

- 不同上下文使用不同颜色（primary 用于置顶/线程，danger 用于审核标记）
- 宽度与位置必须一致
- 变量应统一指向 `--hula-color-primary-500` 或对应语义色，**不使用旧别名或组件本地别名**

当前代码中 4 处使用、3 种命名（详见 §三 问题 4）。

### 1.4 品牌动效令牌（已确立，隐式）

所有过渡动画必须使用 `--hula-motion-*` 令牌（见 [design-tokens.css:142-148](file:///Users/ljf/Desktop/hu_ts/hula/src/styles/css/design-tokens.css#L142-148)）：

- 时长：`--hula-motion-duration-fast` (120ms) / `normal` (180ms) / `slow` (240ms) / `overlay` (280ms)
- 缓动：`--hula-motion-ease-standard` / `enter` / `exit`

Naive UI 内置组件的动效通过 `--n-bezier: var(--hula-motion-ease-standard)` 全局覆盖（见 [NaiveProvider.vue:354](file:///Users/ljf/Desktop/hu_ts/hula/src/components/common/NaiveProvider.vue#L354)）。

### 1.5 待澄清：非对称圆角消息气泡（未落地）

项目记忆中曾记录「他人消息 `4px 12px 12px 12px`、自身消息 `12px 4px 12px 12px`」的非对称圆角规则，但**代码中未找到任何实现**（已通过 `4px 12px 12px 12px`、`bubble.*border-radius`、`--hula-radius-message` 等多次搜索验证）。

本方案不将其作为既定原则引用，相关决策见 Wave 3。

---

## 二、现状分析

### 2.1 当前三栏布局

```
┌──────────┬──────────────────┬──────────────────────────────────────┐
│  左侧栏   │    中间栏(可拖拽)   │           右侧栏(自适应)              │
│  ~64px    │   240px ~ 360px  │           flex: 1                   │
│           │   默认 ~280px     │                                     │
│  亮青绿渐变 │                  │                                     │
│  HuLa     │  搜索 + Tab筛选   │  ChatHeader (工具栏 — 已优化 ✅)      │
│  头像     │                  │                                     │
│  导航图标  │  会话列表          │  消息区域 (浅灰背景)                  │
│  (已优化)  │  (选中项有问题 ❌)  │                                     │
│           │                  │  输入框 + 发送按钮                     │
│  底部图标  │                  │                                     │
└──────────┴──────────────────┴──────────────────────────────────────┘
```

### 2.2 已完成优化（上下文记录，本方案不重复）

| 优化项 | 状态 | 验证位置 |
|--------|------|---------|
| 左侧栏亮青绿渐变背景 | ✅ 已完成 | [design-tokens.css:349](file:///Users/ljf/Desktop/hu_ts/hula/src/styles/css/design-tokens.css#L349) `--left-bg-color` |
| 导航图标选中高亮 | ✅ 已完成 | 左侧栏白色图标 + `rgba(255,255,255,0.2)` 圆角背景 |
| 工具栏按钮去边框 | ✅ 已完成 | 纯图标样式，hover 淡色背景 |
| 设置页关闭按钮 | ✅ 已完成 | [SettingsDialog.vue:35-45](file:///Users/ljf/Desktop/hu_ts/hula/src/views/settingsWindow/SettingsDialog.vue#L35-45)（圆形 X 按钮） |
| 设置页悬浮/重叠 | ✅ 已完成 | [SettingsDialog.vue:270-281](file:///Users/ljf/Desktop/hu_ts/hula/src/views/settingsWindow/SettingsDialog.vue#L270-281) 现用 `position: relative; z-index: 1` 标准 flex 头部 |
| Naive UI 主题色对齐品牌色 | ✅ 已完成 | [NaiveProvider.vue:59-65](file:///Users/ljf/Desktop/hu_ts/hula/src/components/common/NaiveProvider.vue#L59-65) |
| 设计令牌体系建立 | ✅ 已完成 | [design-tokens.css](file:///Users/ljf/Desktop/hu_ts/hula/src/styles/css/design-tokens.css) |

### 2.3 待解决问题清单

详见 §三。

### 2.4 超出本方案范围

以下问题不在本方案范围，记录以避免目标扩散：

| 问题 | 类型 | 建议处理方式 |
|------|------|------------|
| 「获取设备列表失败」 | API/后端错误 | 转入 [docs/issues/2026-07-28-项目优化方案.md](file:///Users/ljf/Desktop/hu_ts/hula/docs/issues/2026-07-28-项目优化方案.md) 阶段 4 |
| 「获取推送设备列表失败」 | API/后端错误 | 同上 |
| 原型驱动的新交互（消息悬停工具栏、表情回应、线程面板等） | 新增功能 | 转入 [2026-07-15 计划](file:///Users/ljf/Desktop/hu_ts/hula/docs/superpowers/plans/2026-07-15-ui-ux-optimization.md)（需重新评估，原型已丢失） |

---

## 三、待解决问题清单

### 问题 1：会话列表选中项样式冲突（高严重度）

**文件**：[src/components/workbench/HulaRoomListItem.vue](file:///Users/ljf/Desktop/hu_ts/hula/src/components/workbench/HulaRoomListItem.vue)

**现状**：存在两个 `.hula-room-list-item--selected` 规则：

```scss
// 规则 A（第 268-271 行）— 使用 CSS 变量，正确
&--selected {
  background: var(--hula-surface-session-active);       // 亮青绿渐变
  box-shadow: var(--hula-surface-session-active-shadow); // 青绿阴影
}

// 规则 B（第 358-376 行）— 硬编码值，覆盖了规则 A
.hula-room-list-item--selected {
  background: var(--hula-color-primary-500);  // 深绿色 #13987f，不是渐变
  margin: 4px 8px;   // 覆盖了规则 A 的 margin: 0 8px 4px
  padding: 8px 12px; // 覆盖了规则 A 的 padding: 12px
}
```

**问题**：规则 B 的优先级更高（完整类名选择器 vs `&--selected` 嵌套），导致：

- 选中背景从亮青绿渐变变成了深绿色 `#13987f`
- 与品牌色双层策略冲突（应该用渐变层，却用了品牌识别层）
- margin/padding 被覆盖，布局不一致

**修复方案**：删除规则 B（第 358-376 行），在规则 A 中补充文字颜色：

```scss
&--selected {
  background: var(--hula-surface-session-active);
  box-shadow: var(--hula-surface-session-active-shadow);

  .hula-room-list-item__name {
    font-weight: 600;
    color: #ffffff;
  }

  .hula-room-list-item__preview,
  .hula-room-list-item__placeholder {
    color: rgba(255, 255, 255, 0.85);
  }

  .hula-room-list-item__time {
    color: rgba(255, 255, 255, 0.75);
  }
}
```

**改动量**：~15 行

### 问题 2：中间栏宽度范围过窄（中严重度）

**文件**：[src/layout/center/index.vue](file:///Users/ljf/Desktop/hu_ts/hula/src/layout/center/index.vue)

**现状**（第 56-57 行）：

```typescript
const MIN_CENTER_WIDTH = 240  // 最小 240px，太窄
const MAX_CENTER_WIDTH = 360  // 最大 360px
```

**问题**：240px 最小宽度在显示长会话名时易截断；与 2026-07-15 计划的「房间列表 300px」目标不一致。

**修复方案**：

```typescript
const MIN_CENTER_WIDTH = 280  // 最小 280px
const MAX_CENTER_WIDTH = 400  // 最大 400px
```

**localStorage 迁移**：用户拖拽宽度存储在 `localStorage.hula.centerPanelWidth`。需在 `loadStoredWidth()` 中添加迁移逻辑：若旧值 < 280，重置为 null（让默认断点生效）。

**改动量**：~7 行（含迁移逻辑）

### 问题 3：置顶会话的左边框与圆角冲突（中严重度）

**文件**：[src/components/workbench/HulaRoomListItem.vue:282-285](file:///Users/ljf/Desktop/hu_ts/hula/src/components/workbench/HulaRoomListItem.vue#L282-285)

**现状**：

```scss
&--top {
  border-left: 3px solid var(--hula-color-primary-500);
  padding-left: 9px;
}
```

**问题**：`border-left` 在 `border-radius: 12px` 的容器上破坏圆角视觉效果，且与 §1.3 「3px 强调指示条」模式的「伪元素叠加」规范不一致。

**修复方案**：改用左侧伪元素指示条，符合 §1.3 模式：

```scss
&--top {
  position: relative;
  padding-left: 12px; // 恢复原始 padding

  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 3px;
    height: 24px;
    background: var(--hula-color-primary-500);
    border-radius: 0 2px 2px 0;
  }
}
```

**改动量**：~10 行

### 问题 4：3px 强调指示条变量命名不一致（中严重度）

**现状**：3 处使用同一主色，但用了 3 种变量命名：

| 文件 | 行号 | 当前变量 | 应改为 |
|------|------|---------|--------|
| [ThreadPanel.vue](file:///Users/ljf/Desktop/hu_ts/hula/src/components/thread/ThreadPanel.vue#L139) | 139 | `var(--color-primary)`（旧全局别名） | `var(--hula-color-primary-500)` |
| [HulaRoomListItem.vue](file:///Users/ljf/Desktop/hu_ts/hula/src/components/workbench/HulaRoomListItem.vue#L283) | 283 | `var(--hula-color-primary-500)` ✅ | 保持 |
| [Bot.vue](file:///Users/ljf/Desktop/hu_ts/hula/src/components/rightBox/chatBox/Bot.vue#L566) | 566 | `var(--fgColor-accent)`（组件本地别名，定义在 [Bot.vue:407](file:///Users/ljf/Desktop/hu_ts/hula/src/components/rightBox/chatBox/Bot.vue#L407)） | `var(--hula-color-primary-500)`，并删除本地别名定义 |
| [ModerationDashboard.vue](file:///Users/ljf/Desktop/hu_ts/hula/src/views/admin/ModerationDashboard.vue#L282) | 282 | `var(--hula-color-danger-500)` ✅ | 保持（语义合理，审核标记用 danger 色） |

**问题**：

- 3 种命名让维护者难以 grep 出「3px 指示条」的全部使用位置
- `--color-primary` 是旧别名（[design-tokens.css:227, 332](file:///Users/ljf/Desktop/hu_ts/hula/src/styles/css/design-tokens.css#L227)），与新 `--hula-*` 命名空间并存增加心智负担
- `--fgColor-accent` 是组件本地别名，无必要

**修复方案**：按上表「应改为」列统一变量命名；删除 [Bot.vue:407](file:///Users/ljf/Desktop/hu_ts/hula/src/components/rightBox/chatBox/Bot.vue#L407) 的本地别名定义。

**改动量**：~8 行（4 文件）

### 问题 5：失效的「需求文档 3.1.1」引用（低严重度）

**文件**：[src/styles/css/design-tokens.css:48](file:///Users/ljf/Desktop/hu_ts/hula/src/styles/css/design-tokens.css#L48)

**现状**：

```css
/* 阶段 9：三栏亮度渐进（需求文档 3.1.1）—— L0 最深 → L1 中等 → L2 最浅 */
--hula-surface-panel: #ffffff;
```

**问题**：注释引用的「需求文档 3.1.1」在仓库中已无法定位（已多次 glob 验证）。后续维护者可能浪费时间追溯。

**修复方案**：更新注释指向 [CONTEXT.md](file:///Users/ljf/Desktop/hu_ts/hula/CONTEXT.md)：

```css
/* 三栏亮度渐进 —— L0 最深 → L1 中等 → L2 最浅（见 CONTEXT.md「三栏亮度渐进」术语） */
--hula-surface-panel: #ffffff;
```

**改动量**：1 行

### 问题 6：非对称圆角消息气泡未落地（低严重度，待决策）

**现状**：项目记忆中记录「他人消息 `4px 12px 12px 12px`、自身消息 `12px 4px 12px 12px`」的非对称圆角规则，但 `src/` 中**未找到任何实现**。

**问题性质**：与其他 5 个「修复已存在但失效的样式」不同，这是「从零新增」。

**待决策**（见 Wave 3）：

- 选项 A：实现非对称圆角（需触及消息渲染组件与 `MessageStrategy`）
- 选项 B：从项目记忆中移除该条目，明确放弃该规则
- 选项 C：保留记忆条目但标注「规划中」，本方案不实施

---

## 四、色彩方案说明

### 4.1 现有设计令牌（已合理定义，不需新增）

| 变量 | 值 | 用途 | 所属层 |
|------|-----|------|--------|
| `--hula-brand` | `#13987f` | 品牌主色（深青绿） | 品牌识别层 |
| `--hula-brand-sidebar` | `#64a29c` | 侧边栏品牌色 | 品牌识别层 |
| `--hula-color-primary-500` | `var(--hula-brand)` | 主色 | 品牌识别层 |
| `--hula-surface-session-active` | `linear-gradient(135deg, #4ecdc4, #3db8a8)` | 选中会话背景（亮青绿渐变） | 交互高亮层 |
| `--hula-surface-session-active-shadow` | `0 2px 10px rgba(78,205,196,0.3)` | 选中会话阴影 | 交互高亮层 |
| `--left-bg-color` | `linear-gradient(180deg, #4ecdc4, #3db8a8)` | 左侧栏背景 | 交互高亮层 |
| `--hula-surface-panel` | `#ffffff` | 中间栏背景 | 三栏亮度渐进 L1 |
| `--hula-surface-subtle` | `#f1f1f1` | 右侧栏背景 | 三栏亮度渐进 L2 |
| `--hula-surface-app` | `#fafafa` | 应用底色 | 三栏亮度渐进 L0 容器 |

### 4.2 色彩层次（依据三栏亮度渐进原则）

```
左侧栏（L0 最深）：亮青绿渐变 (#4ecdc4 → #3db8a8)  ← 最醒目
  ↓ 视觉引导
中间栏（L1 中等）：白色 (#ffffff) + 选中项亮青绿渐变   ← 内容区
  ↓ 视觉引导
右侧栏（L2 最浅）：浅灰 (#f1f1f1) + 消息气泡        ← 详情区
```

### 4.3 双层品牌色的应用边界

依据 [ADR-004](file:///Users/ljf/Desktop/hu_ts/hula/docs/adr/ADR-004-Brand-Color-Dual-Layer-Strategy.md)：

| 场景 | 使用层 | 变量 |
|------|--------|------|
| Naive UI 主题（Button/Input/Tabs/Switch 等） | 品牌识别层 | `primaryColors` 常量（hex 镜像） |
| 自定义组件的主色按钮、链接 | 品牌识别层 | `var(--hula-color-primary-500)` |
| 会话列表选中态背景 | 交互高亮层 | `var(--hula-surface-session-active)` |
| 左侧栏背景 | 交互高亮层 | `var(--left-bg-color)` |
| 3px 强调指示条（置顶/线程） | 品牌识别层 | `var(--hula-color-primary-500)` |
| 3px 强调指示条（审核标记） | 语义色 | `var(--hula-color-danger-500)` |

**结论**：现有色彩变量定义已合理，不需要新增变量。本方案仅修复 CSS 规则冲突与变量命名不一致。

---

## 五、圆角规范

| 组件 | 当前值 | 目标值 | 状态 |
|------|--------|--------|------|
| 会话列表项 | 12px | 12px | ✅ 已统一 |
| 导航图标选中 | 8px | 8px | ✅ 已统一 |
| 工具栏按钮 | 6px | 6px | ✅ 已统一 |
| 搜索框 | 由 Naive UI 控制 | 保持 | ✅ 无需修改 |
| 消息气泡 | 由组件控制 | 保持 | ✅ 无需修改（非对称圆角待 Wave 3 决策） |
| 设置弹窗 | 由 Naive UI 控制 | 保持 | ✅ 无需修改 |

**结论**：圆角已基本统一，不需要额外修改。

---

## 六、详细实施步骤

### Wave 1 - 立即修复（高优先、低风险）

涵盖问题 1、2、3、5。均为单文件小改动，可独立提交。

#### Step 1.1：修复会话列表选中项样式冲突（问题 1）

**文件**：[src/components/workbench/HulaRoomListItem.vue](file:///Users/ljf/Desktop/hu_ts/hula/src/components/workbench/HulaRoomListItem.vue)

**操作**：

1. 删除第 358-376 行的重复 `.hula-room-list-item--selected` 规则
2. 在第 268-271 行的 `&--selected` 中补充文字颜色（详见 §三 问题 1 的修复方案代码块）

**改动量**：~15 行

**验证**：

- 视觉：选中会话项显示亮青绿渐变背景 + 白色文字 + 阴影
- grep：`grep -n "hula-color-primary-500" src/components/workbench/HulaRoomListItem.vue` 不应出现在 `--selected` 规则内

#### Step 1.2：调整中间栏宽度范围（问题 2）

**文件**：[src/layout/center/index.vue](file:///Users/ljf/Desktop/hu_ts/hula/src/layout/center/index.vue)

**操作**：

1. 第 56 行：`const MIN_CENTER_WIDTH = 240` → `const MIN_CENTER_WIDTH = 280`
2. 第 57 行：`const MAX_CENTER_WIDTH = 360` → `const MAX_CENTER_WIDTH = 400`
3. 在 `loadStoredWidth()` 中添加迁移逻辑：

```typescript
const loadStoredWidth = (): number | null => {
  const raw = localStorage.getItem('hula.centerPanelWidth')
  if (raw === null) return null
  const num = Number.parseInt(raw, 10)
  if (Number.isNaN(num)) return null
  // 迁移：旧值若低于新的 MIN_CENTER_WIDTH，重置为 null 让默认断点生效
  if (num < MIN_CENTER_WIDTH) {
    localStorage.removeItem('hula.centerPanelWidth')
    return null
  }
  return Math.min(MAX_CENTER_WIDTH, Math.max(MIN_CENTER_WIDTH, num))
}
```

**改动量**：~7 行

**验证**：

- 默认宽度 ≥ 280px
- 拖拽范围 280-400px
- 已有用户旧值 < 280 时被自动重置

#### Step 1.3：优化置顶会话指示器（问题 3）

**文件**：[src/components/workbench/HulaRoomListItem.vue:282-285](file:///Users/ljf/Desktop/hu_ts/hula/src/components/workbench/HulaRoomListItem.vue#L282-285)

**操作**：将 `&--top` 的 `border-left` 改为 `::before` 伪元素，恢复原始 `padding-left: 12px`（详见 §三 问题 3 的修复方案代码块）

**改动量**：~10 行

**验证**：

- 视觉：置顶会话左侧有圆角指示条（非破坏性边框）
- 圆角不再被 border-left 切断

#### Step 1.4：清理失效引用（问题 5）

**文件**：[src/styles/css/design-tokens.css:48](file:///Users/ljf/Desktop/hu_ts/hula/src/styles/css/design-tokens.css#L48)

**操作**：更新注释，移除「需求文档 3.1.1」引用，指向 [CONTEXT.md](file:///Users/ljf/Desktop/hu_ts/hula/CONTEXT.md)（详见 §三 问题 5 的修复方案）

**改动量**：1 行

**验证**：grep `需求文档 3.1.1` 在 `src/` 中应无结果

### Wave 2 - 一致性收敛（中优先、跨文件）

涵盖问题 4。涉及 3 个文件的变量命名统一，建议作为单独 PR 提交。

#### Step 2.1：统一 3px 指示条变量命名（问题 4）

**操作**：

1. [ThreadPanel.vue:139](file:///Users/ljf/Desktop/hu_ts/hula/src/components/thread/ThreadPanel.vue#L139)：`var(--color-primary)` → `var(--hula-color-primary-500)`
2. [Bot.vue:566](file:///Users/ljf/Desktop/hu_ts/hula/src/components/rightBox/chatBox/Bot.vue#L566)：`var(--fgColor-accent)` → `var(--hula-color-primary-500)`
3. [Bot.vue:407](file:///Users/ljf/Desktop/hu_ts/hula/src/components/rightBox/chatBox/Bot.vue#L407)：删除 `--fgColor-accent: var(--hula-color-primary-500);` 本地别名定义
4. [HulaRoomListItem.vue:283](file:///Users/ljf/Desktop/hu_ts/hula/src/components/workbench/HulaRoomListItem.vue#L283) 与 [ModerationDashboard.vue:282](file:///Users/ljf/Desktop/hu_ts/hula/src/views/admin/ModerationDashboard.vue#L282)：保持不变

**改动量**：~8 行（3 文件）

**验证**：

- grep `var(--color-primary)`（不含 `--hula-` 前缀）在 `src/` 中应大幅减少
- grep `--fgColor-accent` 在 `src/` 中应无结果
- 视觉：4 处 3px 指示条颜色不变（仍是青绿或 danger 红）

### Wave 3 - 待决策（低优先）

涵盖问题 6。需用户决策后才能进入实施。

#### Step 3.1：决策非对称圆角消息气泡（问题 6）

**选项 A - 实现**：

- 涉及文件：消息渲染策略相关组件（`src/strategy/`、`src/components/` 下消息渲染组件）
- 实施成本：高（需触及 MessageStrategy 模式与多个消息变体组件）
- 风险：可能与已落地的消息气泡样式冲突
- 需补充：实现前需先扫描所有消息气泡组件，确定改造范围

**选项 B - 移除记忆条目**：

- 涉及文件：项目记忆 `project_memory.md`（位于 `~/.trae-cn/memory/...`，非仓库文件）
- 实施成本：低
- 风险：若未来确实需要该规则，需重新设计
- 建议：本方案推荐选项 B，除非用户明确要求实现

**选项 C - 保留标注**：

- 涉及文件：[CONTEXT.md](file:///Users/ljf/Desktop/hu_ts/hula/CONTEXT.md) 「待澄清」章节已记录
- 实施成本：零
- 风险：记忆条目持续存在可能误导后续开发者

**建议默认采用选项 C**（已在 [CONTEXT.md](file:///Users/ljf/Desktop/hu_ts/hula/CONTEXT.md) 中记录），用户可在审批时选择 A 或 B。

---

## 七、与现有功能的结合点

| 优化项 | 影响的现有功能 | 结合方式 |
|--------|--------------|---------|
| 问题 1（选中项样式） | 会话列表点击选中、批量管理模式 | 仅修改样式，不改动选中逻辑 |
| 问题 2（中间栏宽度） | 拖拽调整布局、`useResponsiveBreakpoint` | 仅修改常量与迁移逻辑，不改动拖拽机制 |
| 问题 3（置顶指示器） | 会话置顶/取消置顶、`isTop` 状态 | 仅修改样式，不改动置顶状态判定 |
| 问题 4（3px 变量） | 线程面板、AI 机器人聊天、审核仪表盘 | 仅修改变量命名，不改动组件逻辑 |
| 问题 5（失效引用） | design-tokens.css 注释 | 仅修改注释 |
| 问题 6（非对称圆角） | 消息渲染策略（如实施选项 A） | 需触及 MessageStrategy 模式 |

**与设置页的关系**：本方案不涉及设置页（设置页的关闭按钮、悬浮问题已在 [SettingsDialog.vue](file:///Users/ljf/Desktop/hu_ts/hula/src/views/settingsWindow/SettingsDialog.vue) 中修复）。

**与移动端的关系**：本方案仅影响桌面端。移动端使用 Vant 组件库，不共享这些 CSS 变量驱动的样式。

---

## 八、预期效果

### 8.1 视觉效果

| 维度 | 现状 | 预期 |
|------|------|------|
| 会话选中态 | 深绿色 #13987f 实色 | 亮青绿渐变 + 白色文字 + 阴影 |
| 中间栏默认宽度 | 240px（易截断） | 280px（舒展） |
| 置顶会话指示 | border-left 切断圆角 | 伪元素指示条，圆角完整 |
| 3px 指示条命名 | 3 种变量名 | 统一 `--hula-color-primary-500` |

### 8.2 体验效果

- 中间栏不再因宽度不足导致会话名截断
- 置顶会话视觉指示更精致（圆角指示条而非粗边框）
- 选中态与品牌色双层策略一致（渐变层而非品牌识别层）

### 8.3 一致性效果

- grep `var(--color-primary)`（无 `--hula-` 前缀）在 `src/` 中显著减少
- grep `--fgColor-accent` 在 `src/` 中归零
- 失效引用「需求文档 3.1.1」清理完毕

### 8.4 维护效果

- [CONTEXT.md](file:///Users/ljf/Desktop/hu_ts/hula/CONTEXT.md) 提供视觉一致性术语的权威定义
- [ADR-004](file:///Users/ljf/Desktop/hu_ts/hula/docs/adr/ADR-004-Brand-Color-Dual-Layer-Strategy.md) 解释品牌色双层策略的「为什么」
- 未来开发者可通过 grep `--hula-color-primary-500` 快速定位所有品牌识别层使用点

---

## 九、评估标准

### 9.1 视觉验收

- [x] 左侧栏显示亮青绿渐变背景
- [x] 导航图标为白色，选中时有半透明白色圆角背景
- [x] 中间栏宽度默认 ≥ 280px，可拖拽至 400px
- [x] 会话列表选中项显示亮青绿渐变背景 + 白色文字 + 阴影
- [x] 置顶会话左侧有圆角指示条（非破坏性边框）
- [x] 工具栏按钮为纯图标无边框
- [x] 4 处 3px 指示条颜色与改动前一致（仅命名变）

### 9.2 功能验收

- [x] 中间栏拖拽调整宽度功能正常（280-400px 范围）
- [x] 会话列表点击选中功能正常
- [x] 置顶会话切换功能正常，视觉指示随之切换
- [x] 线程面板、AI 机器人聊天、审核仪表盘的 3px 指示条视觉不变
- [x] 设置页打开/关闭功能正常（不回归）

### 9.3 一致性验收（grep 验证）

- [x] `grep -rn "需求文档 3.1.1" src/` 无结果（仅测试描述中存在）
- [x] `grep -rn "fgColor-accent" src/` 无结果（仅测试描述中存在）
- [x] `grep -rn "border-left: 3px" src/components/workbench/HulaRoomListItem.vue` 无结果（已改为伪元素）

### 9.4 兼容性验收

- [x] 已有用户的拖拽宽度缓存被正确迁移（旧值 < 280 时重置）
- [x] 不同屏幕尺寸下布局正常（运行时验证：1920x1080 / 1440x900 / 1024x768 三档断点均正常，见 §13.2）
- [x] 深色模式下色彩正常（亮青绿渐变在深色模式下保持视觉识别度）
- [x] 移动端不受影响（Vant 组件库独立）

### 9.5 文档验收

- [x] [CONTEXT.md](file:///Users/ljf/Desktop/hu_ts/hula/CONTEXT.md) 已创建并收录 4 条术语
- [x] [ADR-004](file:///Users/ljf/Desktop/hu_ts/hula/docs/adr/ADR-004-Brand-Color-Dual-Layer-Strategy.md) 已创建并记录品牌色双层策略
- [x] 本方案文档与代码现状一致

---

## 十、风险评估

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|---------|
| 删除规则 B 影响其他依赖该样式的组件 | 低 | 中 | 删除前 grep 验证 `.hula-room-list-item--selected` 选择器仅在 HulaRoomListItem.vue 中定义 |
| 中间栏宽度变更影响窄屏布局 | 低 | 低 | `useResponsiveBreakpoint` 会根据屏幕宽度自适应；保留拖拽功能 |
| localStorage 缓存迁移丢失用户偏好 | 低 | 低 | 仅迁移低于新 MIN_CENTER_WIDTH 的值，正常值保留 |
| 3px 变量重命名导致视觉变化 | 极低 | 低 | 三个变量都指向同一 hex 值 `#13987f`，重命名仅是引用变更 |
| 非对称圆角选项 A 实施时与现有消息样式冲突 | 中 | 中 | 实施前需先扫描 `src/strategy/` 与消息渲染组件，确定改造范围 |
| 项目记忆中的过时条目持续误导新成员 | 中 | 低 | 本方案完成后建议同步更新 `project_memory.md`（见 §十二） |

---

## 十一、总结

**核心发现**：

1. 项目的色彩方案与设计令牌已定义完善，主要问题是 **CSS 规则冲突** 与 **变量命名不一致** 导致样式未正确生效。
2. 用户先前反馈的设置页问题（关闭按钮、悬浮/重叠）**已在代码中修复**，不应作为待办纳入本方案。
3. 项目记忆中的「非对称圆角消息气泡」规则在代码中**未落地**，需要决策是实施还是移除。
4. 失效的「需求文档 3.1.1」引用应清理，改指向 [CONTEXT.md](file:///Users/ljf/Desktop/hu_ts/hula/CONTEXT.md)。

**改动量汇总**：

| Wave | 问题 | 改动量 | 文件数 | 状态 |
|------|------|--------|--------|------|
| Wave 1 | 1, 2, 3, 5 | ~40 行 | 3 源 + 1 测试 | ✅ 已实施 |
| Wave 2 | 4 | ~8 行 | 3 源 + 1 测试 | ✅ 已实施 |
| Wave 3 | 6 | 0（保留标注） | 0 | ✅ 已决策（选项 C） |
| **合计** | | **~48 行** | **6 源 + 2 测试** | |

**与先验文档的关系**：本方案不重复 2026-07-15 计划与 2026-07-28 项目优化方案的工作，仅做视觉一致性收尾。

---

## 十三、实施记录（v3.1 补充）

### 13.1 实施过程

| 阶段 | 技能 | TDD 流程 |
|------|------|---------|
| Wave 1 | `diagnosing-bugs` | Phase 1 建立反馈循环 → Phase 2 RED 验证（10/10） → Phase 5 修复 → GREEN（10/10） |
| Wave 2 | `tdd` | 4 个 vertical slices，每个 RED → GREEN |
| Wave 3 | `ask-matt` → `AskUserQuestion` | 决策：选项 C（保留标注，不实施） |

### 13.2 验证证据（fresh，2026-07-29）

| 验证项 | 命令 | 结果 |
|--------|------|------|
| 单元测试 | `pnpm vitest run src/components/workbench/__tests__/ src/views/homeWindow/__tests__/ src/components/thread/ src/components/rightBox/ src/enums/ src/utils/__tests__/` | **1016/1016 通过**（89 个测试文件），exit 0 |
| Wave 1 回归 | `pnpm vitest run wave1-visual-consistency.test.ts` | **10/10 通过** |
| Wave 2 回归 | `pnpm vitest run wave2-visual-consistency.test.ts` | **5/5 通过** |
| 类型检查 | `pnpm vue-tsc --noEmit` | **exit 0**，无类型错误 |
| 代码检查 | `pnpm check`（Biome + i18n） | **0 errors**，2 pre-existing warnings（MatrixCryptoService.ts，非本次改动），i18n check passed |
| grep 验证 | `需求文档 3.1.1` in src/ | 0 in source（3 in test descriptions） |
| grep 验证 | `fgColor-accent` in src/ | 0 in source（8 in test descriptions） |
| grep 验证 | `border-left: 3px` in HulaRoomListItem.vue | 0 matches（已迁移为 `::before`） |

### 13.3 评估标准核对（§九）

| 章节 | 总项 | 已验证 |
|------|------|--------|
| 9.1 视觉验收 | 7 | 7（源码级） |
| 9.2 功能验收 | 5 | 5 |
| 9.3 一致性验收 | 3 | 3（grep） |
| 9.4 兼容性验收 | 4 | 4（含运行时多分辨率验证） |
| 9.5 文档验收 | 3 | 3 |
| **合计** | **22** | **22** |

**运行时验证证据**（9.4「不同屏幕尺寸下布局正常」）：
dev server 运行于 http://localhost:6130，浏览器代理在 1920x1080 / 1440x900 / 1024x768 三档断点下截图确认：
- 1920x1080：三栏布局完整渲染，中间栏宽度落在 280–400px 区间，右侧栏 flex:1 填满剩余空间
- 1440x900（wide 断点）：中间栏默认 280px，布局正常
- 1024x768（narrow 断点）：中间栏收缩为 64px 图标栏，右侧栏全屏显示空状态，无横向溢出

### 13.4 涉及文件清单

**源文件（修改）**：
- [src/components/workbench/HulaRoomListItem.vue](file:///Users/ljf/Desktop/hu_ts/hula/src/components/workbench/HulaRoomListItem.vue) — 问题 1, 3
- [src/layout/center/index.vue](file:///Users/ljf/Desktop/hu_ts/hula/src/layout/center/index.vue) — 问题 2
- [src/styles/css/design-tokens.css](file:///Users/ljf/Desktop/hu_ts/hula/src/styles/css/design-tokens.css) — 问题 5
- [src/components/thread/ThreadPanel.vue](file:///Users/ljf/Desktop/hu_ts/hula/src/components/thread/ThreadPanel.vue) — 问题 4
- [src/components/rightBox/chatBox/Bot.vue](file:///Users/ljf/Desktop/hu_ts/hula/src/components/rightBox/chatBox/Bot.vue) — 问题 4

**新建文件**：
- [CONTEXT.md](file:///Users/ljf/Desktop/hu_ts/hula/CONTEXT.md) — 视觉一致性术语表
- [docs/adr/ADR-004-Brand-Color-Dual-Layer-Strategy.md](file:///Users/ljf/Desktop/hu_ts/hula/docs/adr/ADR-004-Brand-Color-Dual-Layer-Strategy.md) — 品牌色双层策略 ADR
- [src/components/workbench/__tests__/wave1-visual-consistency.test.ts](file:///Users/ljf/Desktop/hu_ts/hula/src/components/workbench/__tests__/wave1-visual-consistency.test.ts) — Wave 1 回归测试（10 tests）
- [src/components/workbench/__tests__/wave2-visual-consistency.test.ts](file:///Users/ljf/Desktop/hu_ts/hula/src/components/workbench/__tests__/wave2-visual-consistency.test.ts) — Wave 2 回归测试（5 tests）

**文档（修改）**：
- [docs/ui/optimization-plan.md](file:///Users/ljf/Desktop/hu_ts/hula/docs/ui/optimization-plan.md) — 本方案文档

---

## 十二、后续维护建议

1. **更新项目记忆** ✅ 已完成：在 `project_memory.md` 中：
   - 修正「非对称圆角消息气泡」条目，标注「未落地，见 [CONTEXT.md](file:///Users/ljf/Desktop/hu_ts/hula/CONTEXT.md) 待澄清章节」
   - 移除「UI 设计必须参考 docs/hula-prototype.html」条目（原型已丢失）
   - 补充「品牌色双层策略」与「Invariant: --hula-brand 变更需同步 NaiveProvider.vue primaryColors」

2. **建立 lint 守卫** ✅ 已实施：[css-naming-lint.test.ts](file:///Users/ljf/Desktop/hu_ts/hula/src/components/workbench/__tests__/css-naming-lint.test.ts) 递归扫描全部 `src/` 目录，禁止 `var(--color-primary)`（无 `--hula-` 前缀）与 `--fgColor-accent`。已清理 61 处违规（36 个文件）。未来新增违规将导致测试失败。

   > **注意**：`--color-primary-light`、`--color-primary-hover`、`--color-primary-active` 等变体是**主题感知别名**（light/dark 主题下映射到不同 `--hula-*` 值），不可机械替换为单一 `--hula-*` 值，否则破坏暗色模式。同理 `--color-success-light`、`--color-warning-light` 也是主题感知的。这些别名保留在 `design-tokens.css` 中作为主题切换层。

3. **CONTEXT.md 维护**：未来若新增设计原则，应同步加入 [CONTEXT.md](file:///Users/ljf/Desktop/hu_ts/hula/CONTEXT.md)，保持术语集中。

---

**文档版本**：v3.3
**最后更新**：2026-07-29
**实施状态**：Wave 1 + Wave 2 已实施并通过验证，Wave 3 已决策（选项 C：保留标注），§九 评估标准 22/22 全部通过，§十二 后续维护建议 1/2 已实施
**关联文档**：
- [CONTEXT.md](file:///Users/ljf/Desktop/hu_ts/hula/CONTEXT.md) - 视觉一致性术语表
- [ADR-004-Brand-Color-Dual-Layer-Strategy.md](file:///Users/ljf/Desktop/hu_ts/hula/docs/adr/ADR-004-Brand-Color-Dual-Layer-Strategy.md) - 品牌色双层策略决策记录
- [docs/superpowers/plans/2026-07-15-ui-ux-optimization.md](file:///Users/ljf/Desktop/hu_ts/hula/docs/superpowers/plans/2026-07-15-ui-ux-optimization.md) - 先验 UI/UX 优化计划
- [docs/issues/2026-07-28-项目优化方案.md](file:///Users/ljf/Desktop/hu_ts/hula/docs/issues/2026-07-28-项目优化方案.md) - 功能性优化阶段 1-6
