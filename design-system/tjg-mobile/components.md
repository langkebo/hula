# TJG Mobile · 组件规范（液态玻璃）

> 与 [MASTER.md](./MASTER.md) 配套。所有数值均取自现有实现，可直接用于前端还原。
> 颜色/圆角/动效只允许引用 `--tjg-*` token；下列“示例值”均为 token 解析后的视觉尺寸。

## 0. 通用玻璃配方

```scss
/* L1 固定面（导航 / 标签栏 / 输入坞） */
.tjg-glass.tjg-glass--nav     // 18px blur + saturate 1.8 + --tjg-glass-nav-bg
.tjg-glass.tjg-glass--tabbar  // 28px blur + saturate 1.8 + --tjg-glass-tabbar-bg
.tjg-glass.tjg-glass--input   // 10px blur + saturate 1.35 + --tjg-glass-input-bg

/* L2 浮层面（抽屉 / 面板 / 长按菜单） */
.tjg-glass.tjg-glass--sheet   // 28px blur + saturate 1.35 + --tjg-glass-sheet-bg

/* L3 内容面（行 / 卡片），不加 blur */
background: var(--tjg-glass-row-bg);
border: var(--tjg-glass-border-soft);
box-shadow: var(--tjg-glass-inner-highlight);
```

必备四件套：`background`（半透明染色）→ `border`（1px 柔和描边）→ `box-shadow`（内高光 + 柔和投影）→ `backdrop-filter`（仅 L1/L2）。

按下态统一：

```scss
:active {
  background: var(--tjg-glass-row-bg-pressed);
  transform: scale(var(--tjg-glass-press-scale)); /* 仅独立卡片，列表行不加 */
}
```

---

## 1. 会话列表行（MobileSessionList.vue）

| 项 | 规格 |
| :--- | :--- |
| 行高 | 72px（`item-height=72`，虚拟列表强约束） |
| 栅格 | `48px` 头像 · `1fr` 文本 · `max-content` 右侧 |
| 内边距 | 上下 10px / 左右 16px，列间距 12px |
| 头像 | 48×48，`--tjg-radius-lg`；在线点 10px，右下角，2px 页面底色描边 |
| 标题 | `--tjg-font-size-2lg`，单行截断 |
| 摘要 | `--tjg-font-size-md`，`--tjg-text-secondary`，单行截断 |
| 时间 | `--tjg-font-size-2xs`，`--tjg-text-tertiary`，右上角 |
| 未读徽标 | 最小 18px 高，`--tjg-radius-full`，品牌色底 + 白字，上限 `99+` |
| 选中态 | `--tjg-surface-session-active` 渐变 + `--tjg-surface-session-active-shadow` |
| 行背景 | `--tjg-glass-row-bg`，按下切 `--tjg-glass-row-bg-pressed` |
| 禁止 | 行内 `backdrop-filter`；行高随内容变化 |

手势：左滑露出置顶/删除，操作区宽 80px，按钮文字 14px 白字；长按 500ms 弹出玻璃菜单。

---

## 2. 消息气泡

| 项 | 发送 | 接收 |
| :--- | :--- | :--- |
| 背景 | `--tjg-glass-tint-bubble-sent` + `--tjg-glass-sheen` | `--tjg-glass-tint-bubble-received` |
| 文字 | 白色，正文 15px / 行高 1.45 | `--tjg-text-primary` |
| 圆角 | `--tjg-radius-lg`，右侧下角 6px | `--tjg-radius-lg`，左侧下角 6px |
| 内边距 | 10px 14px | 10px 14px |
| 描边 | `--tjg-glass-border-soft` | 同左 |
| 阴影 | `--tjg-glass-inner-highlight, --tjg-glass-shadow-soft` | 同左 |
| 最大宽度 | `min(76vw, 520px)` | 同左 |
| 行间距 | 组内 4px，跨发送者 16px | — |
| 时间/状态 | 气泡外下方 11px，`--tjg-text-tertiary` | — |

连续消息合并：同一发送者 5 分钟内、无引用、无 @ 时只保留首条头像与名称，气泡上间距 4px。
链接预览、图片、语音、文件卡片均继承气泡圆角与描边，内部媒体再裁切一次。

---

## 3. 聊天输入坞（FooterBar.vue）

| 项 | 规格 |
| :--- | :--- |
| 容器 | `.tjg-glass--input`，底部安全区 `env(safe-area-inset-bottom)` |
| 内边距 | 4px 12px（上下 4 / 左右 12） |
| 最小高度 | 48px（单行）；多行最高 120px 后内部滚动 |
| 输入框 | `--tjg-radius-full`，背景 `--tjg-glass-tint-input`，左右内边距 14px，字号 15px |
| 圆钮 | 36×36（扩展/表情/发送），热区扩到 44×44 |
| 发送键 | 36px 圆，品牌色底 + 白字，禁用态 40% 不透明 |
| 录音态 | 按住区域 ≥ 56px 高，玻璃面 + 波形，上滑取消 |
| 键盘 | 键盘弹起时输入坞跟随 `visualViewport`，平滑 180ms，不使用 `position: fixed` 硬切 |
| 禁止 | 输入坞上方再叠一层模糊；输入框内使用描边阴影 |

---

## 4. 功能面板（More.vue）

| 项 | 规格 |
| :--- | :--- |
| 容器 | `.tjg-glass--sheet`，顶部 `--tjg-glass-border-soft` |
| 栅格 | 4 列等宽，gap 12px，内边距 14px 14px 18px |
| 单项 | 最小 88px 高，`--tjg-radius-xl`，背景 `--tjg-glass-row-bg` |
| 图标 | 44×44 圆形，背景 `--tjg-glass-tint-soft`，品牌色 SVG，线宽 1.5px |
| 文字 | `--tjg-font-size-2xs`，`--tjg-text-secondary`，一行 |
| 按下 | 背景 `--tjg-glass-row-bg-pressed` + `scale(0.985)` |
| 小屏 | ≤360px：gap 10px，内边距 12px 10px 16px，最小高 80px |
| 顺序 | 图片 / 文件 / 语音 / 视频 / 链接预览 / 位置（按能力与设置显隐） |

通话选择使用底部抽屉：行高 52px，取消行与主行间距 6px，文字 15px。

---

## 5. 导航栏与标签栏

### 导航栏（navBar/index.vue）

| 项 | 规格 |
| :--- | :--- |
| 高度 | 44px 内容区 + `env(safe-area-inset-top)` |
| 材质 | `.tjg-glass--nav` |
| 标题 | 15px / 600，居中，单行截断，左右各预留 44px |
| 操作 | 图标 24px，热区 44×44，间距 4px |
| 滚动联动 | 内容滚动 > 8px 时底部描边显现（180ms） |

### 标签栏（tabBar/index.vue）

| 项 | 规格 |
| :--- | :--- |
| 高度 | 最小 62px + `env(safe-area-inset-bottom)` |
| 材质 | `.tjg-glass--tabbar` |
| 图标 | 30px，选中品牌色，未选中 `--tjg-text-tertiary` |
| 文字 | 11px，行高 1.2，选中加粗 600 |
| 徽标 | 右上角，最小 16px，红底白字 |
| 按压 | 图标 0.96 缩放 120ms（标签页允许，因为不改变布局） |

---

## 6. 卡片与列表（空间 / 设置 / 我的）

- 卡片：`.tjg-glass`（L2）或行染色（L3），圆角 `--tjg-radius-xl`，内边距 16px，卡片间距 12px。
- 设置行：56px 高，左右 16px，分隔线 `--tjg-border-muted` 且左侧缩进 16px；最后一行不显示分隔线。
- 快捷入口（MobileQuickActions）：5 列，图标 44px 圆形 `--tjg-glass-tint-soft`，文字 11px，整块作为一张玻璃卡。
- 搜索框：`.tjg-glass--input`，高 36px，圆角 `--tjg-radius-full`，左侧 16px 搜索图标。

---

## 7. 浮层与反馈

| 组件 | 规格 |
| :--- | :--- |
| 底部抽屉 | `.tjg-glass--sheet`，顶部圆角 `--tjg-radius-2xl`，把手 36×4，背后 `--tjg-glass-scrim` |
| 长按菜单 | `.tjg-glass--sheet`，圆角 `--tjg-radius-xl`，内边距 18px，文字 16px 主色，箭头与面板同色 |
| Toast | 深色玻璃（`--tjg-glass-tint-strong`），圆角 `--tjg-radius-lg`，最大宽 70vw |
| 对话框 | 居中，宽 `min(86vw, 360px)`，圆角 `--tjg-radius-2xl`，双按钮各占 50%，高度 48px |
| 遮罩 | `--tjg-glass-scrim` + 4px 模糊；低性能设备去模糊保留遮罩 |

---

## 8. 图标与图文

- 统一 SVG（IconPark Sprite `<use>` 或本地图标），`viewBox` 24×24，线宽 1.5px。
- 尺寸：导航 24、标签栏 30、面板 24、行内 20、状态点 10。
- 禁止 emoji 作为图标；禁止 div + 背景图拼图标。
- 图标与文字间距 8px；图标独立按钮必须带 `aria-label`。
