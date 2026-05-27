# HuLa 配色体系分析报告

## 1. 配色体系提取 (自参考项目 HuLaSpark/HuLa)

### 1.1 主色调 (Primary)
- **亮色模式**: `#13987f`
- **暗色模式**: `rgba(19, 152, 127, 0.6)`
- **主要应用场景**: 选中状态 (`--bg-active-msg`)、主题高亮 (`--emoji-active-color`)、确认按钮 (`--van-dialog-confirm-button-text-color`) 等。

### 1.2 背景色 (Surfaces & Backgrounds)
- **App 背景 (`--app-bg-color`)**: `#FAFAFA`
- **内容主区域 (`--center-bg-color`)**: `#fff` (亮色) / `#1b1b1b` (暗色)
- **侧边栏/右侧区 (`--right-bg-color`)**: `#f1f1f1` (亮色) / `#161616` (暗色)
- **聊天抽屉 (`--bg-chat-drawer`)**: `#f0f0f0` (亮色) / `#1b1b1b` (暗色)

### 1.3 中性文本色 (Text & Neutrals)
- **主文本 (`--text-color`)**: `#18181c` (亮色) / `#fff` (暗色)
- **图标颜色 (`--icon-color`)**: `#000` (亮色) / `#c1c1c1` (暗色)
- **禁用色 (`--disabled-color`)**: `#c1c1c1` (亮色) / `#575757` (暗色)
- **次要时间文本 (`--time-color`)**: `#e3e3e3` (亮色) / `#3b3b3b` (暗色)

### 1.4 交互反馈色 (Action & Hover)
- **组件悬停 (`--bg-msg-hover`)**: `#f3f3f3` (亮色) / `#2d2d2d` (暗色)
- **左侧菜单悬停 (`--bg-left-menu-hover`)**: `rgba(90, 90, 90, 0.1)` (亮色) / `#3b3b3b` (暗色)
- **按钮背景 (`--button-bg-color`)**: `#f1f1f1` (亮色) / `#3f3f3f` (暗色)

### 1.5 语义化功能色 (Semantic Colors)
- **危险色 (`--danger-text`)**: `#c14053` (亮色) / `#da8583` (暗色)
- **警告色 (`--warning-text`)**: `#f7b668` (亮色) / `#f4c375` (暗色)

---

## 2. 目标项目适配策略

目标项目 `/Users/ljf/Desktop/hu_ts/hula` 已经构建了 `design-tokens.css` 并且规范了 `--hula-xxx` 格式的设计令牌（Design Tokens）。
然而，目前在组件中（特别是业务模块如音视频通话、看图组件、锁屏等），还遗留了大量的硬编码色值。

### 2.1 替换映射规则
- `#13987f` -> `var(--hula-color-primary-500)`
- `#fff` (作为文字) -> `var(--hula-text-inverse)`
- `#fff` (作为背景) -> `var(--hula-surface-panel)`
- `#000` (作为文字) -> `var(--hula-text-primary)`
- `#000` / `#222` / `#161616` (作为媒体大背景) -> `var(--hula-surface-media-preview)`
- `#f1f1f1` (作为背景) -> `var(--hula-surface-subtle)`
- `bg-#000` -> `bg-[--hula-surface-media-preview]`
- `color-#fff` / `text-#fff` -> `text-[--hula-text-inverse]`
- `bg-[#237265]` -> `bg-[--hula-color-primary-600]` (或相似变量)

## 3. 实施计划
1. 使用脚本批量处理 `src/views` 和 `src/components` 中的常见硬编码。
2. 手动调整复杂组件中的特定颜色。
3. 清理不需要的散落样式。
