# TJG Mobile · Liquid Glass 设计系统（MASTER）

> 本文件是移动端（`src/mobile/**` 与 `#/` 别名覆盖代码）视觉与交互的唯一设计基准。
> 实现层唯一颜色来源仍是 [`src/styles/css/design-tokens.css`](../../src/styles/css/design-tokens.css)，
> 材质与降级实现位于 [`src/styles/scss/global/mobile.scss`](../../src/styles/scss/global/mobile.scss)。
> 二级页面若有 `design-system/tjg-mobile/pages/<page>.md`，其规则覆盖本文件。

- 版本：1.0
- 基准：2025 年主流液态玻璃设计体系（Apple Liquid Glass / iOS 26 视觉语言、Material 3 Expressive 的半透明层级）+ 头部 IM 的会话/输入/气泡范式
- 适用范围：Android / iOS（Tauri mobile），桌面端不适用本文件

---

## 1. 设计原则

1. **内容在玻璃下流动**：背景必须存在可被模糊的光晕或图片，玻璃才有意义；空白背景上的“半透明白”只是灰色块。
2. **层级靠材质不靠阴影堆叠**：同屏最多三级玻璃（固定面 → 浮层面 → 内容行），层级差由模糊半径与染色浓度表达。
3. **可读性优先于通透感**：任何文字与背景对比度 ≥ 4.5:1；做不到就提高染色不透明度，而不是降低字号。
4. **模糊只给固定面**：导航栏、标签栏、输入坞、面板、弹层可模糊；长列表逐行禁止 `backdrop-filter`。
5. **动效服务于定位**：只做透明度/亮度/位移，不做会改变布局的缩放；所有动效尊重 `prefers-reduced-motion`。

---

## 2. 材质分层（三级）

| 层级 | 用途 | 典型组件 | 模糊 | 染色 token | 类名 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| L0 氛围 | 页面底，唯一的“可模糊源” | 页面根容器 | 无 | 三层径向光晕 | `.tjg-aurora` |
| L1 固定面 | 常驻且覆盖内容 | 导航栏 / 标签栏 / 输入坞 | 18–32px | `--tjg-glass-nav-bg`、`--tjg-glass-tabbar-bg`、`--tjg-glass-input-bg` | `.tjg-glass--nav/--tabbar/--input` |
| L2 浮层面 | 临时出现、遮挡内容 | 底部抽屉 / 功能面板 / 长按菜单 / 弹窗 | 28–32px | `--tjg-glass-sheet-bg` | `.tjg-glass--sheet` |
| L3 内容面 | 列表行 / 卡片 / 气泡 | 会话行、九宫格项、消息气泡 | 0（仅染色）或 10px（气泡） | `--tjg-glass-row-bg`、`--tjg-glass-tint-bubble-*` | `.tjg-glass--row`、`.bubble` |

**禁止**：L3 大面积模糊；同屏出现四个以上模糊面；在无 L0 氛围的页面上单独使用 L1/L2。

---

## 3. 颜色与 token

### 3.1 玻璃 token（亮色 / 暗色双套，按主题自动切换）

| 分组 | Token | 亮色 | 暗色 | 用途 |
| :--- | :--- | :--- | :--- | :--- |
| 模糊 | `--tjg-glass-blur-soft` | 10px | 12px | 输入框、气泡、列表行（轻） |
| 模糊 | `--tjg-glass-blur-medium` | 18px | 20px | 导航栏、通用玻璃面 |
| 模糊 | `--tjg-glass-blur-strong` | 28px | 32px | 标签栏、抽屉、功能面板 |
| 饱和 | `--tjg-glass-saturate-soft` | 1.35 | 1.3 | 常规玻璃 |
| 饱和 | `--tjg-glass-saturate-strong` | 1.8 | 1.7 | 导航/标签栏（提升色彩通透） |
| 染色 | `--tjg-glass-tint` | 白 55% | 深灰 58% | 通用浮层 |
| 染色 | `--tjg-glass-tint-strong` | 白 74% | 深灰 78% | 需要更高对比的浮层 |
| 染色 | `--tjg-glass-tint-soft` | 白 36% | 深灰 40% | 图标底、弱化块 |
| 染色 | `--tjg-glass-tint-input` | 白 62% | 深灰 72% | 输入类容器 |
| 染色 | `--tjg-glass-row-bg` | 白 46% | 白 5% | 列表行 / 卡片 |
| 染色 | `--tjg-glass-row-bg-pressed` | 白 76% | 白 11% | 行按下态 |
| 染色 | `--tjg-glass-sheet-bg` | 白 82% | 深灰 86% | 抽屉 / 面板 / 长按菜单 |
| 染色 | `--tjg-glass-nav-bg` | 白 60% | 深灰 68% | 导航栏 |
| 染色 | `--tjg-glass-tabbar-bg` | 白 64% | 深灰 72% | 标签栏 |
| 染色 | `--tjg-glass-input-bg` | 白 72% | 深灰 80% | 输入坞 / 搜索框 |
| 气泡 | `--tjg-glass-tint-bubble-sent` | 品牌绿 86% | 品牌绿 72% | 发送气泡 |
| 气泡 | `--tjg-glass-tint-bubble-received` | 白 76% | 深灰 76% | 接收气泡 |
| 描边 | `--tjg-glass-border-soft` | 白 32% | 白 10% | 玻璃面外描边 |
| 描边 | `--tjg-glass-border-strong` | 白 58% | 白 20% | 强调面描边 |
| 描边 | `--tjg-glass-border-color` | 白 58% | 白 20% | 只需颜色值（UnoCSS `border-[--tjg-glass-border-color]`） |
| 描边 | `--tjg-glass-edge-gradient` | 上亮下暗渐变 | 上亮下暗渐变 | 1px 渐变描边（`::after` 遮罩实现） |
| 光影 | `--tjg-glass-sheen` | 顶部白色高光 50% | 顶部高光 14% | 气泡/按钮顶部反光 |
| 光影 | `--tjg-glass-inner-highlight` | `inset 0 1px 0` 白 70% | 白 14% | 内高光（细节质感的关键） |
| 光影 | `--tjg-glass-shadow-soft` | 0 6px 22px 10% | 0 6px 22px 32% | 常规浮起 |
| 光影 | `--tjg-glass-shadow-strong` | 0 14px 40px 16% | 0 14px 40px 44% | 抽屉/面板浮起 |
| 遮罩 | `--tjg-glass-scrim` | 深色 24% | 黑 40% | 弹层背后压暗 |
| 氛围 | `--tjg-glass-aurora-a/b/c` | 绿 / 蓝 / 橙三向光晕 | 同色低透明度 | 页面底光晕 |
| 颗粒 | `--tjg-glass-noise-opacity` | 0.05 | 0.04 | 需要时的噪点叠层 |
| 动效 | `--tjg-glass-press-scale` | 0.985 | 0.985 | 卡片按下缩放 |
| 动效 | `--tjg-glass-motion-enter` | 320ms | 320ms | 进入 |
| 动效 | `--tjg-glass-motion-move` | 420ms | 420ms | 位置/形变 |

### 3.2 语义色约束

- 正文：`--tjg-text-primary`；次要：`--tjg-text-secondary`；辅助：`--tjg-text-tertiary`。
- 任何玻璃面上的文字禁止使用纯白（除发送气泡、品牌实色按钮）。
- 状态色只使用 `--tjg-status-online/offline/busy/away`，且必须配合文字或形状，不以颜色单独表达状态。
- 新增颜色一律先加 token，再引用；不得在组件中出现 `#hex`、`rgb()`、`rgba()`。

---

## 4. 形状与尺寸

| 项 | 规范 |
| :--- | :--- |
| 圆角 | 使用 `--tjg-radius-sm/md/lg/xl/full`；禁止新增 16–29px 裸值 |
| 气泡圆角 | 发送/接收均为 `--tjg-radius-lg`，贴近头像一侧收紧为 6px |
| 触控热区 | 所有可点击元素 ≥ 44×44px；列表行 ≥ 56px |
| 页面横向留白 | 16px（≤360px 屏降为 12px） |
| 玻璃卡片间距 | 12px；九宫格 gap 12px |
| 安全区 | 固定面使用 `padding-bottom: env(safe-area-inset-bottom)`；顶部用 `safe-area-inset-top` |
| 字号 | `--tjg-font-size-2xs` ~ `--tjg-font-size-xl`；正文 15px，辅助 13px，标签 11px |

---

## 5. 组件规范摘要

完整可还原规格见 [components.md](./components.md)。

| 组件 | 材质 | 关键点 |
| :--- | :--- | :--- |
| [会话列表](../../src/mobile/components/message/MobileSessionList.vue) | L3 行染色 + 选中态渐变 | 行内不做模糊；未读徽标与时间同基线 |
| [输入坞](../../src/mobile/components/chat-room/FooterBar.vue) | L1 `--input` | 输入框 36px 高、圆角 full、发送键 36px |
| [消息气泡](../../src/styles/scss/global/mobile.scss) | L3 `.bubble` | 接收半透明玻璃、发送品牌绿+顶部高光 |
| [功能面板](../../src/mobile/components/chat-room/panel/More.vue) | L2 `--sheet` | 4 列九宫格、每格 88px、图标 44px |
| [导航栏](../../src/mobile/layout/navBar/index.vue) | L1 `--nav` | 56px 高、标题居中、返回 44px 热区 |
| [标签栏](../../src/mobile/layout/tabBar/index.vue) | L1 `--tabbar` | 底部安全区、图标 24px、选中品牌色 |

---

## 6. 动效

| 场景 | 时长 | 曲线 | 属性 |
| :--- | :--- | :--- | :--- |
| 按下反馈 | `--tjg-motion-duration-fast` | `--tjg-motion-ease-standard` | `background-color` / `opacity` |
| 卡片按下 | 同上 | 同上 | `transform: scale(--tjg-glass-press-scale)`（仅独立卡片） |
| 面板/抽屉进入 | `--tjg-glass-motion-enter` | `--tjg-motion-ease-enter` | `translateY` + `opacity` |
| 页面切换 | `--tjg-glass-motion-move` | `--tjg-motion-ease-standard` | 位移 + 淡入 |
| 列表项出现 | 240ms，逐项 20ms 递进 | 标准 | `opacity` + 4px 上移 |

禁止：超过 500ms 的常规交互动效；`height/width` 过渡；列表内元素缩放。

---

## 7. 响应式与适配

| 断点 | 行为 |
| :--- | :--- |
| ≤360px | 横向留白 12px，九宫格 gap 10px，字号不缩小低于 13px |
| 361–430px | 基准布局 |
| ≥431px / 折叠屏展开 | 内容最大宽度 560px 居中；玻璃面保持贴边安全区 |
| 横屏 | 固定面高度不增加；输入坞保持底部；面板最多占 60% 高 |
| 安全区 | 刘海/灵动岛、底部 Home Indicator 全量适配 |

---

## 8. 性能与降级（强制）

1. 长列表逐行禁止 `backdrop-filter`，只用 `--tjg-glass-row-bg` + `inner-highlight`。
2. 每个 `backdrop-filter` 必须同时声明 `-webkit-backdrop-filter`（`pnpm check:mobile-css` 会校验）。
3. 降级顺序：
   - `@supports not (backdrop-filter)` → `--tjg-surface-elevated` 实色
   - `prefers-reduced-transparency: reduce` → 去模糊 + 实色
   - `prefers-reduced-motion: reduce` → 关闭过渡与缩放
4. 遮罩渐变必须用 `black` 关键字，禁止 `#000`（ratchet 规则）。
5. 单页同时进行模糊的元素 ≤ 4 个；面板打开时列表不再新增动画。

---

## 9. 交付验收清单

- [ ] 页面根容器具备 `.tjg-aurora` 或自定义背景图，玻璃下有可模糊内容
- [ ] 固定面使用 `.tjg-glass--nav/--tabbar/--input`，抽屉使用 `.tjg-glass--sheet`
- [ ] 列表行无 `backdrop-filter`，按下态使用 `--tjg-glass-row-bg-pressed`
- [ ] 所有可点击元素 ≥ 44px，且有 `:active` 反馈
- [ ] 文字对比度 ≥ 4.5:1（尤其浅色玻璃上的白字）
- [ ] 三个降级分支齐全
- [ ] 360px / 390px / 430px 三档无横向滚动、无文字截断
- [ ] `pnpm check:mobile-css`、`pnpm check:ratchet` 通过
- [ ] 无新增硬编码颜色/圆角
