# HuLa 视觉一致性上下文

本上下文用于约束 HuLa 桌面端与移动端 UI 的视觉一致性决策。术语来源于代码注释与已落地实践，不包含未实现的设计意图。维护本表的目的是让未来开发者能快速理解「为什么这套 UI 这样设计」。

## Language

### 设计原则

**品牌色双层策略 (Brand Color Dual-Layer Strategy)**:
项目同时维护两层品牌色表达：深青绿 `#13987f`（`--hula-brand`）用于品牌识别与 Naive UI 主题；亮青绿渐变 `#4ecdc4 → #3db8a8`（`--hula-surface-session-active`、`--left-bg-color`）用于交互高亮与左侧栏背景。双层并存是因为 Naive UI 内部使用 seemly/rgba 对颜色做 hover/pressed 运算，无法解析 CSS 变量引用，必须传入具体 hex 值。
_Avoid_: 单一品牌色策略、纯渐变品牌色

**三栏亮度渐进 (Three-Column Brightness Progression)**:
桌面端三栏布局采用「L0 最深 → L1 中等 → L2 最浅」的亮度递进：左侧栏最暗（品牌渐变背景）、中间栏次之（白色面板）、右侧栏最浅（消息区浅灰）。视觉引导方向：左 → 中 → 右，对应「导航 → 列表 → 详情」的认知流。
_Avoid_: 三栏等亮度、右栏深色

**3px 强调指示条 (3px Accent Indicator Bar)**:
用于标识「置顶 / 当前激活 / 重要分支」的视觉模式：在元素左侧叠加一条 3px 宽的强调色实心条。不同上下文使用不同颜色（primary 用于置顶/线程，danger 用于审核标记），但宽度与位置必须一致。变量应统一指向 `--hula-color-primary-500` 或对应语义色，不使用旧别名或组件本地别名。
_Avoid_: 左侧粗边框、圆点指示器、4px+ 指示条

**品牌动效令牌 (Brand Motion Tokens)**:
所有过渡动画必须使用 `--hula-motion-*` 令牌（`--hula-motion-duration-fast/normal/slow/overlay` 与 `--hula-motion-ease-standard/enter/exit`），不使用字面量 `cubic-bezier(...)` 或硬编码 `ms` 值。Naive UI 内置组件的动效通过 `--n-bezier: var(--hula-motion-ease-standard)` 覆盖（见 `NaiveProvider.vue` 全局样式块）。
_Avoid_: 自定义缓动函数、`transition: all 0.3s ease`、`linear` 缓动

### 待澄清（未落地）

**非对称圆角消息气泡 (Asymmetric Message Bubble Radius)**:
项目记忆中曾记录「他人消息 4px 12px 12px 12px、自身消息 12px 4px 12px 12px」的非对称圆角规则，但代码中**未找到任何实现**。本术语保留以标记其为「规划中未落地」，不作为既定原则引用。如需实现，必须先决策是否采纳。
_Avoid_: 当作既定原则引用、写入新组件代码

### 失效引用

**「需求文档 3.1.1」**:
`design-tokens.css:48` 的注释引用了「需求文档 3.1.1」描述三栏亮度渐进的来源，但该需求文档在仓库中已无法定位。后续维护者不应继续追溯该引用，应将本 `CONTEXT.md` 视为该原则的权威来源。
_Avoid_: 在新代码中继续引用「需求文档 3.1.1」
