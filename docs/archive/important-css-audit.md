# `!important` 收敛审计与浏览器层叠回归方案

> 范围：`src/` 下非测试样式源（`.ts/.mts/.cts/.tsx/.vue/.scss/.css/.mdx`）
> 口径：`scripts/check-ratchet.mjs` 的 `important_css` 计数器
> 时间：2026-09-20（第七轮）

---

## 1. 先把计数口径钉死

`important_css` 的计数方式是「**先剥注释再正则计数**」，而不是「正则整体替换」：

```js
function stripCommentsOnly(content) {
  return content.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
}
```

这里有一个**值得怀疑但最终被证伪**的点：`//` 是 JS/SCSS 的行注释语法，但该剥离函数
也作用在 `.css` / `.vue` 的 `<template>` 上。若某行在 `!important` **之前**出现 `//`
（例如 `background: url(//cdn...)` 或 `href="//example.com"`），真实声明会被整行吃掉 ——
即门禁**低报**。

逐行核验（`/tmp/important_inventory.py` 的注释感知扫描器，正确处理 `url(//…)` 与
`<template>` 上下文）结果：

| 指标 | 值 |
| --- | --- |
| 注释感知扫描出的真实 `!important` 总数 | **91** |
| `!important` 之前同行出现 `//` 的行 | **4** |
| 上述 4 行的性质 | **全部是真实注释**（如 `// scoped 属性 + BEM 类特异性高于…，无需 !important`） |

**结论：ratchet 的 91 与真实计数一致，门禁口径可信。** 33 处的差额来自**块注释**内被
正确剔除的 `!important`，不是低报。

## 2. 91 条的构成 —— 「71 条待清除」这个前提不成立

按处置类别拆开：

| 类别 | 条数 | 处置 |
| --- | ---: | --- |
| `@media (prefers-reduced-motion: reduce)` 区块内 | **20** | 合规豁免（媒体查询本身即理由） |
| 选择器**不可匹配**（类名全仓未被应用）→ 死规则 | **6** | **已清除**（本轮，见 §3） |
| 同上但属**库生成类**（假阳性，见 §3 注） | 2 | 需浏览器 |
| 竞争对象是**框架内部样式**（naive-ui / Vant / Storybook / UnoCSS） | **35** | 需浏览器 |
| 选择器可达，与**同仓规则**竞争 | **28** | 需浏览器 |
| **合计** | **91** | |

也就是说：**剩下的 85 条没有一条是「无理由的裸 `!important`」**。它们的注释或指明了
竞争对象（`naive-ui` / `Vant` / `.no-select` 注入 / `@use` 进来的 non-scoped 规则），
或属于必须与运行时注入规则同权对抗的结构性场景。**盲目删除会造成视觉回归。**

## 3. 本轮实际清除：`message.scss` 的 6 处死声明（91 → 85）

**取证方法（无需浏览器，结论是充分必要的）**：选择器不可匹配 ⇒ 规则永不生效 ⇒
其 `!important` 是死声明。判定方式是把选择器里的类名拿去全量 `src` 里找「是否被当作
类名应用」（静态 `class=` / `:class` 对象键 / `classList.*` / 字符串拼接）。

```text
.msg-box / .active-bot / .active-shield 的唯一出现处 = src/styles/scss/message.scss 自身
会话项选中态的类名由 useSessionListState.getItemClasses() 产出：
  tjg-room-list-item--selected / --pinned / --muted
```

`.active-bot`（3 处）与 `.active-shield`（3 处）因此从未生效，已连同规则一并删除
（`src/styles/scss/message.scss`），并在原处留下说明注释。基线随之收紧 91 → **85**。

> ⚠️ **顺带查出两个独立问题，未擅自处理**：
> 1. **产品意图缺实现**：`.active-bot` / `.active-shield` 承载的「助手会话用主色渐变、
>    屏蔽会话用危险色渐变」在任何地方都没有实现（类名从未落地）。恢复时应按现行
>    BEM 命名新增 `tjg-room-list-item--bot` / `--shield`。
> 2. **`message.scss` 整体疑似死代码 + 全局泄漏**。该文件被 3 个组件以
>    `@use '@/styles/scss/message'` 引入，而按本项目构建行为，`@use` 进 scoped 的
>    外部 partial **不会被加 scope 属性**，会 emit 成全局规则 —— 于是其中的 `.active`
>    （一个**极通用的类名**）成了全局规则，会命中任何带 `active` 类的元素（全仓 56 处）。
>    建议单独立项：确认该文件存废，或改名收敛为 BEM 前缀。
>
> 另外 `.code-block-content`（`chatBot/code-block.scss` 2 处）在「可达性」扫描里也被判成
> 不可匹配，但它是 **markdown 代码块库生成的内部类**（从 `:deep()` 用法即可看出），
> 属**假阳性**，未删除。

## 4. 剩余 85 条的处置：为什么必须上真实浏览器

剩下的竞争关系分三类，**静态可判性递减**：

1. **与同仓规则竞争（28 条）** — 表面上可以靠「特异性 + 源码顺序」静态推算。但本项目
   有两条反直觉事实会破坏静态推算：
   - **`@use` 进 scoped 的 partial 会泄漏成全局规则**（见 §3 注 2），导致「文件内的
     顺序」不等于「样式表内的顺序」；
   - **`.vue` 的 scoped 属性会改变特异性**（给最后一个复合选择器 +1 个 class），
     而部分被比较对象是**全局**规则、部分有 scoped 属性，两者不可同日而语。
2. **与运行时注入规则竞争（`.no-select` 机制，10 条）** —
   `useContextMenu.ts` 会把 `.no-select { user-select: none !important }` **动态插入**
   样式表；任何想恢复可选中的规则都必须同为 `!important`。这 10 条要么整组保留，
   要么**整组**改为无 `!important` 并依赖「后插入者胜出」—— 属协同改造，必须实测。
3. **与框架内部样式竞争（37 条）** — `naive-ui` / `Vant` / Storybook docs 的内联样式
   特异性不透明（例如 naive-ui 的按钮前景色由多层 `--n-*` 变量 + 类型类共同决定），
   **读源码推算不可靠**。

### 4.1 回归方案（已探明环境可用）

本机已具备真实浏览器与样式编译能力：

| 能力 | 状态 |
| --- | --- |
| Playwright | `1.63.0`，已装 `chromium-1234` / `firefox-1532` / `webkit-2311` |
| `sass` CLI | `1.102.0`（dart2js） |
| 生产 CSS 产物 | `dist/static/css/*.css` 已存在（含 scoped 属性与 UnoCSS 产物） |

提议的 **A/B 计算样式差分**流程：

```text
对每一条候选 (!important) ：
  1. 组 A：加载「原样」样式；组 B：加载「把该 1 处 !important 删掉」的样式
     （文本级定点删除，先断言锚点出现次数 == 1）
  2. 用真实 DOM 渲染该规则的作用元素 —— 两条路径：
     a) 优先用 Vite dev server 真实编译（能正确解析 @use / @apply / UnoCSS）
     b) 若组件依赖登录态无法挂载，则按 SFC 模板手工重建该元素及其祖先链，
        并从 dist 产物里取出该组件对应的 [data-v-*] 哈希，补到手工 DOM 上
  3. 对「目标元素 + 其全部后代」逐个取 getComputedStyle，比较 A/B 全属性快照
  4. A == B  ⇒ 该 !important 可安全删除（附完整快照为证）
     A != B  ⇒ 保留，并把差异属性写进解释注释
```

**为什么这不是「纸面回归」**：比较的是**浏览器真实计算样式**，而不是重建一套
CSS 特异性计算器去自证；且变体 B 只改动目标 `!important`，其它一切都保持原样。

### 4.2 建议的批次划分

| 批次 | 内容 | 条数 | 前置 |
| --- | --- | ---: | --- |
| ✅ 1 | 死规则（不可匹配） | 6 | 无（已完成） |
| 2 | `.no-select` 协同改造（注入端 + 3 个消费端一起改） | 10 | 浏览器 A/B |
| 3 | 同仓可见类竞争（`emoticon` / `login.scss` 的 `.gradient-button` 等） | ~10 | 浏览器 A/B |
| 4 | 框架内部（naive-ui / Vant / Storybook） | ~37 | 浏览器 A/B + 逐条补理由注释 |

20 条 reduced-motion 豁免**不在清除范围**，仅需确认它们仍全部落在
`prefers-reduced-motion: reduce` 区块内（当前门禁已能守护这一点）。

## 5. 复现命令

```bash
# 权威计数（注释感知，不依赖正则剥离）
python3 /tmp/important_inventory.py

# 逐条列出 规则 / 声明 / 最近解释注释
python3 /tmp/important_review.py

# 全量可达性核验（dead / framework / reachable 三分类）
python3 /tmp/important_full.py

# 门禁
node scripts/check-ratchet.mjs
```
