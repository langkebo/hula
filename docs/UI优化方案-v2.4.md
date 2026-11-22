# TJG UI 优化方案 v2.4 —— 液态玻璃（Liquid Glass）落地

| 项目 | 内容 |
| :--- | :--- |
| 版本 | v2.5 |
| 日期 | 2026-11-22（v2.3 为 2026-11-07） |
| 状态 | 已落地（阶段 A/B/E 完成，C1/C2/C4 完成，C3 移动视口回归完成、真机截图待硬件；阶段 D 候选核实完成，D1 已按「平台分层」口径完成运行态取证、WebView 真机复核待硬件，见 §3.5 / §19.62） |
| 适用端 | 桌面（Tauri + Naive UI）、移动（Vant） |
| 权威 token | `src/styles/css/design-tokens.css` |
| 章节构成 | 0-11 液态玻璃主题 ｜ 12 能力接线 ｜ 13 UI/UX 设计规范 ｜ 14 风险回滚 ｜ 15-18 审查·组件·多端·统一 ｜ 19 历史实施索引（一句话一条）｜ 20 登录页 v2 ｜ 21 本轮排查与下一步 |

---

## 0. 结论摘要

1. **项目已经有一套可用的液态玻璃体系**：`--tjg-glass-*` token 组（明暗双主题）、`_liquid-glass.scss` mixin、`liquid-glass.test.ts` 契约测试、`mobile.scss` 移动端玻璃面、`performanceTier.ts` 的 `html.low-perf` 降级。因此本方案是「补齐桌面端 + 收敛选型边界」，不是「从零引入一套玻璃效果」。
2. **不存在能同时覆盖双端的万金油库**。桌面端 WebView（macOS WKWebView / Windows WebView2 / Linux WebKitGTK）对 SVG `feDisplacementMap` 实时折射的支持与性能差异巨大；移动端 Vant 组件结构复杂，外层包裹折射容器会破坏布局与滚动性能。
3. **正确分层**：桌面端「CSS 玻璃面基座 + 可选折射增强」，移动端「CSS `backdrop-filter` + Vant 主题变量」，两端共用 token 与 Pinia 偏好开关。
4. **库选型优先级**（在通过 §3.4 POC 门槛的前提下）：
   - 基座（必选、零依赖）：现有 `--tjg-glass-*` + mixin。
   - 增强首选：**vitrio**（`0.1.2`，MIT，0 依赖，4.4 KB gzip，含 Vue 3 封装；核实记录见 §3.5）。
   - 增强次选：**暂无**。原候选 `liquid-glass.io`（域名待售、npm 无包）与 `nmorph`（npm 404，同名站点无关）核实失败，已作废。
   - 备选观察（均不引入）：`@yafh/liquid-glass`（Vue 3，10.1 KB gzip）、`@liquidglassjs/element`（自定义元素，core 较重）、`liquid-gl`（WebGPU/WebGL，45.7 KB gzip 超包体门槛）。
   - 学习参考（不进入产物）：`@yafh/liquid-glass`、`liquid-gl`、`Liquid-Glass-Android`、`@callstack/liquid-glass`、`ZalithLauncher2-LiquidGlass`。
5. **技术路线不做「全新框架替换」**：所有增强库必须通过适配器隔离（`GlassEngine`），默认关闭、失败自动回落 CSS、可一键全局降级。
6. **功能接线另立章节**：2026-11-14 的全量能力排查（47 条「后端已具备、前端未接线」）+ 2026-11-15 复核追加 CAP-08，共 48 条结论与补齐方案见第 12 章，与玻璃主题解耦，按批次独立实施。
7. **全面审查另立章节**：第 15-19 章为 2026-11-14 的静态代码审查与门禁实测。结论是「基础质量良好，债务集中在门禁基线与组件复用」，其中 Biome 全仓 0 诊断、组件零引用 0 个，但有 5 项守门脚本失败（体量基线 14 个文件越线、孤儿文案 60 条、失效白名单 4 条、未登记持久化 key 3 个），详见 §19。

> 事实核查声明（2026-11-17 更新）：已完成三个候选的真实包名、版本、许可证、包体与 API 形态核实，结果见 §3.5。vitrio 的引用信息为实测数据；`liquid-glass.io` 与 `nmorph` 未找到可复现的真实项目，相关集成描述一律作废。文中仍保留的集成代码属「接口契约草案」，落地前必须按 §3.4 逐项取证，取证不通过即退出候选。

---

## 1. 现状盘点（代码取证）

### 1.1 已有能力矩阵

| 能力 | 位置 | 现状 | 结论 |
| :--- | :--- | :--- | :--- |
| 玻璃 token | `src/styles/css/design-tokens.css` 的 `--tjg-glass-*` | 明暗双主题完整：blur soft/medium/strong、saturate soft/strong、tint 系列、气泡 tint、边框、edge-gradient、sheen、inner-highlight、shadow、row/sheet/nav/tabbar/input 底色、aurora 氛围光、press-scale | 复用，不新增颜色字面量 |
| 玻璃 mixin | `src/styles/scss/mixins/_liquid-glass.scss` | `liquid-glass($blur,$opacity,$saturate)`、`liquid-glass-panel`、`liquid-glass-subtle`、`liquid-glass-fallback`、`backdrop-blur-fallback` | 桌面端新组件的唯一入口 |
| 降级机制 | 同上 + `src/utils/performanceTier.ts` | 启动早期写 `html.low-perf`；mixin 内 `html.low-perf &` 关闭 `backdrop-filter` 并回落 `--tjg-surface-panel` | 保留，需修 §1.2-G1/G2 |
| 契约测试 | `src/styles/__tests__/liquid-glass.test.ts` | 裸 `@include liquid-glass` 必须 3 行内跟随降级或改用变体；mixin 文件禁止 `:global`；统计裸 `backdrop-filter` | 扩展本方案新增约束 |
| 移动端玻璃面 | `src/styles/scss/global/mobile.scss`（约 L75-201） | nav（medium + saturate-soft）、tabbar（medium + strong）、input（strong）、sheet（strong）、row（soft）、底部操作条；含 `@supports not` 降级 | 补齐低性能降级与若干落点 |
| 移动端前缀门禁 | `scripts/check-mobile-css.mjs` | 模糊必须成对声明 `-webkit-backdrop-filter`；禁止 UnoCSS `backdrop-blur-*` 工具类（未接 autoprefixer） | 新代码必须遵守 |
| 移动端输入坞 | `src/mobile/views/message/index.vue`（约 L246-267） | 手写 `-webkit-` 前缀，消费 `--tjg-glass-blur-strong` / `--tjg-glass-saturate-soft` | 作为移动端样板 |
| 桌面存量使用点 | `variable.scss`、`base.scss`、`layout/left/components/InfoEdit.vue`、`components/common/ContextMenu.vue`、`ContextMenuEmoji.vue`、`components/search/SearchPane.vue` | 零散、手写 `blur(10px)`、未统一走变体 | 收敛为统一组件与变体 |

### 1.2 三个必须修复的结构性问题

**G1 移动端玻璃面未消费 `html.low-perf`**

`mobile.scss` 中的 `.tjg-glass-*` 只做了 `@supports not (...)` 的能力降级，没有 `html.low-perf &` 的性能降级。后果：低端安卓机在开启玻璃后没有退出通道，滚动掉帧时无法自动回落纯色。

修法（阶段 A）：为 `mobile.scss` 的每个玻璃面追加 `html.low-perf &` 分支，只关闭 `backdrop-filter` 并保留 base 底色，不整体改成面板白（避免移动端大面积变白）。

**G2 `coarsePointer` 直接判低，与移动端玻璃需求冲突**

`performanceTier.ts` 当前把「触屏设备」直接判为 `low`。一旦移动端样式消费 `html.low-perf`（G1 的修法），真实手机会**全部**降级为纯色，等于移动端永远看不到玻璃。

修法（阶段 A）：
- 判级改为「粗指针不再是降级依据」，只保留核心数、`deviceMemory`、`prefers-reduced-transparency`、显式用户偏好；
- 触屏设备默认进入 `medium`（可用 medium/soft 模糊，禁用 strong 与所有折射增强）；
- 增加运行期降级钩子：首屏后采样 60 帧，若平均帧率 < 45 或出现长任务，则追加 `low-perf`（仅降不升，避免抖动）。

**G3 桌面端玻璃覆盖不足，Naive UI 容器未接入**

现有玻璃只出现在少数手写组件，Naive UI 的侧栏、Modal、Drawer、Popover 仍是实色面板。后果：视觉语言不统一，「液态玻璃」只在局部成立。

修法（阶段 B）：新增 `TjGlass.vue` 统一玻璃容器，按 §5.1 落点接入，并通过 `n-config-provider` 把被包裹容器的底色置透明，避免「双层模糊」。

### 1.3 对既有建议的三处必要修正

| 原始建议 | 问题 | 修正 |
| :--- | :--- | :--- |
| `.glass-effect { background: rgba(255,255,255,0.65); border: 1px solid rgba(255,255,255,0.4); }` | 违反项目「禁止硬编码颜色，一律 `--tjg-*` token」 | 改为 `background: var(--tjg-glass-tint)`、`border: var(--tjg-glass-border-soft)` |
| 桌面端直接 `<Glass v-bind="glassState">` 包裹 Naive UI 组件 | 与 `liquid-glass.test.ts` 的「面板级、≤3/视图、必须降级」契约冲突；折射容器包裹滚动容器会放大重绘区域 | 折射增强仅允许用于**非滚动、静态、单视图 ≤1 处**的表面；滚动面板只用 CSS 玻璃 |
| `GlassDebugPanel` 实时调参 | 调试面板属于开发期工具，进入产物会增大包体并暴露内部参数 | 仅在 `import.meta.env.DEV` 下动态引入，生产构建必须 tree-shake 掉 |

---

## 2. 设计目标与硬规则

### 2.1 目标

| 维度 | 目标 |
| :--- | :--- |
| 材质一致性 | 双端所有玻璃面由同一组 token 驱动，明暗主题同源 |
| 性能可预算 | 每视图玻璃面 ≤3，滚动容器内禁止模糊，低端机自动降级 |
| 可降级 | 能力降级（`@supports`）+ 性能降级（`html.low-perf`）+ 用户偏好（关闭玻璃）三层 |
| 可访问性 | 玻璃面上正文对比度 ≥4.5:1；尊重 `prefers-reduced-transparency` / `prefers-reduced-motion` / `prefers-contrast` |
| 可维护 | 新组件只允许消费 token 与 mixin；外部库通过适配器隔离，可整体移除 |
| 可回滚 | 一个开关全局回到纯色面板，不涉及业务代码改动 |

### 2.2 五条硬规则

1. **玻璃不承载布局**：玻璃容器只负责背景材质、边框与投影，不参与尺寸计算、不包裹滚动容器。
2. **面板级限定**：`backdrop-filter` 只允许出现在导航、标签栏、输入坞、抽屉、弹窗、侧栏、搜索面板；列表行、消息行、聊天气泡禁用。
3. **降级必须成对**：任何 `backdrop-filter` 声明必须同时具备 `-webkit-` 前缀与降级分支；SCSS 中优先用 `liquid-glass-panel` / `liquid-glass-subtle`。
4. **token 单源**：颜色、模糊半径、饱和度、圆角、阴影全部来自 `--tjg-glass-*` 与既有语义 token；禁止新增 `#hex` / `rgb()` / `rgba()`。
5. **动效可关**：`prefers-reduced-motion: reduce` 下禁用位移、缩放、光泽扫过；`prefers-reduced-transparency: reduce` 下直接回落纯色。

---

## 3. 液态玻璃 UI 库选型

### 3.1 两条选型轴

选型不是「挑一个库替换现有实现」，而是两条独立的轴：

- **轴 A｜材质基座（必选、长期）**：项目自有 CSS 玻璃体系。零依赖、零包体、可降级、已通过契约测试。任何库都不能替代它。
- **轴 B｜折射增强（可选、按场景）**：外部库提供 SVG/CSS 折射、色散、边缘高光等「光学增强」，仅用于静态高光场景。

轴 B 的引入顺序初定为 **vitrio → liquid-glass.io → nmorph**；2026-11-17 核实后仅 **vitrio** 成立（其余两个候选作废，见 §3.5），且仍需先过 §3.4 POC 门槛。

### 3.2 候选对比矩阵

| 候选 | 形态 | 依赖与包体预期 | 许可 | Vue 3 + Tauri 适配 | WebView 兼容风险 | 性能风险 | 可调试性 | 结论 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 自有 CSS 体系 | SCSS mixin + CSS 变量 | 0 依赖，0 KB | 项目自有 | 原生 | 低（`backdrop-filter` 已在用） | 低-中（面板级可控） | 高（token 可调） | **基座，必选** |
| **vitrio** | 零依赖 JS 类 + `<liquid-glass>` Web Component + `vitrio/vue` 封装 | `0.1.2`，0 依赖，12.2 KB min / 4.4 KB gzip（`src/` 随包发布） | MIT | 低（有官方 Vue 3 wrapper，无需 `isCustomElement`） | 高：WebKit 系（macOS/iOS/WebKitGTK）不支持 `feImage`，自动退化为合成层近似 | 中（静态挂载可接受，需实测 TBT） | 高（TS 源码 + 参数面板示例） | **唯一有效候选**：已按平台分层口径完成 D1 运行态取证（Windows / Android 真折射，macOS / Linux / iOS 回落 CSS 近似，§19.46 / §19.62）；当前仍不引入依赖，真机 WebView 复核归 C3 |
| ~~liquid-glass.io~~ | 无法定位：域名待售，npm 无同名包 | - | - | - | - | - | - | **作废**（2026-11-17 核实） |
| ~~nmorph~~ | 无法定位：npm 404，`nmorph.com` 为无关 BPM 站点 | - | - | - | - | - | - | **作废**（2026-11-17 核实） |
| ~~`liquid-glass-web`~~ | npm 同名包 `1.0.0` 仅 346 B、无实现、无仓库 | 0 KB（空壳） | 未声明 | 不适用 | 不适用 | 不适用 | 不适用 | **作废**：原「开源库 + 调试面板」描述不成立 |
| `@yafh/liquid-glass` | Vue 3 组件，SVG `feDisplacementMap` 折射 | `1.0.3`，10.1 KB gzip，unpacked 5.4 MB（含演示资源），peer `vue ^3.5.25` | MIT | 高（原生 Vue 3） | 中-高（同 WebKit 限制） | 高（逐帧滤镜） | 高 | **备选参考**，不进入默认路径 |
| `liquid-gl` | WebGPU / WebGL 折射库 | gzip 45.7 KB | 待核实 | 中（有 Vue 生态用法） | 高（WebGPU 在 WKWebView/WebKitGTK 不可用） | 中-高 | 中 | **包体超门槛**，仅作对照 |
| `Liquid-Glass-Android` | Android View 体系 SDF 折射 | 不适用 Web | 待核实 | 不适用 | 不适用 | 不适用 | 不适用 | 移动端**设计参考**，不引入工程 |
| `@callstack/liquid-glass` | React Native 封装 iOS 26 `UIGlassEffect` | 不适用 Web/Tauri | 待核实 | 不适用 | 不适用 | 低（原生） | 不适用 | 仅用于理解原生材质参数 |
| `ZalithLauncher2-LiquidGlass` | 桌面启动器玻璃主题 | 不适用 | 待核实 | 不适用 | 不适用 | 不适用 | 中 | 布局与动效**参考** |

### 3.3 选型结论与准入条件

| 层级 | 方案 | 启用条件 | 落点 | 关闭方式 |
| :--- | :--- | :--- | :--- | :--- |
| 基座 | 自有 CSS 玻璃 | 永久启用 | 所有玻璃面 | 用户偏好 `glassMode = 'off'` |
| 增强 1 | vitrio | POC 全项通过 + 桌面 + `tier !== 'low'` + 非滚动表面 | 登录页背景卡、引导页插画卡、空状态卡（单视图 ≤1） | 适配器加载失败自动回落；store 开关 |
| 增强 2 | 暂无（原 `liquid-glass.io`） | 候选核实失败，作废 | 无 | 无 |
| 增强 3 | 暂无（原 `nmorph`） | 候选核实失败，作废 | 无 | 无 |
| 参考 | `@yafh/liquid-glass` / `liquid-gl` | 永不默认引入 | 无 | 无 |

**一票否决**：任一候选在 POC 中出现「离线不可用」「运行时发起网络请求」「污染全局样式」「卸载后残留 rAF 或 SVG filter」「WebKitGTK 渲染异常」中任一项，直接退出，不得以「只在 macOS 用」为由保留。

### 3.4 POC 门槛（逐项取证，缺一不可）

| # | 检查项 | 通过标准 | 取证方式 |
| :--- | :--- | :--- | :--- |
| 1 | 包可解析 | `pnpm add` 成功，`node_modules` 内可见源码 | 安装日志 |
| 2 | 许可证 | 允许商用与再分发，记录到 `docs/` | LICENSE 原文 |
| 3 | 零网络 | 运行期无外部请求（字体、CDN、遥测） | DevTools Network 全量录制 |
| 4 | 离线可用 | 断网启动仍渲染 | 断网冷启动 |
| 5 | 包体增量 | gzip 后 ≤ 40 KB（vitrio 实测 4.4 KB） | `pnpm metrics:bundle` 对比 |
| 6 | 首屏开销 | TBT 增量 ≤ 50 ms，长任务 ≤ 1 次 | Performance 面板 |
| 7 | 三端渲染 | WKWebView / WebView2 / WebKitGTK 均无错位、无闪烁 | 三端截图对比 |
| 8 | 构建安全 | SSR/构建期不访问 `window`、`document` | 构建日志 |
| 9 | 样式隔离 | 不产生全局选择器；不覆盖 Naive UI / Vant 变量 | 全局样式 diff |
| 10 | 可降级 | `prefers-reduced-transparency: reduce` 下可完全关闭 | 系统偏好切换 |
| 11 | 可卸载 | 组件销毁后无残留定时器、事件监听、SVG filter 节点 | 反复挂载/卸载 50 次后内存与 DOM 快照 |
| 12 | 可主题化 | 颜色可映射到 `--tjg-*`，无需保留库自带色值 | 主题切换截图 |

### 3.5 候选核实记录与 D1 准入结论（2026-11-17）

#### 3.5.1 核实方法

1. npm registry 元数据（`dist-tags`、`time`、`dependencies`、`license`、`dist.unpackedSize`）直接读取 JSON。
2. bundlephobia API 读取 min / gzip 体积（vitrio `0.1.2`、`@yafh/liquid-glass@1.0.3`、`liquid-gl` 等）。
3. 下载 `vitrio-0.1.2.tgz` 解包到临时目录，静态检索 `fetch/XHR/WebSocket`、`createElement('style')`、`matchMedia`、`customElements.define`、`requestAnimationFrame`、`destroy()`。
4. 域名 `liquid-glass.io`、`nmorph.com` 实访；npm 同名包逐个查询。

#### 3.5.2 候选有效性核实

| 候选 | 核实证据 | 结论 |
| :--- | :--- | :--- |
| vitrio | npm `vitrio@0.1.2`（最新 2026-06-11），MIT，`dependencies: {}`，12.2 KB min / 4.4 KB gzip，导出 ESM/CJS/UMD + `vitrio/vue`；README 明确 WebKit 无 `feImage` 时退化为合成层近似 | **成立**，保留为唯一候选 |
| liquid-glass.io | `https://liquid-glass.io` 为域名停放页（"This domain may be for sale"）；npm 无 `liquid-glass.io` 包 | **作废** |
| nmorph | npm `nmorph` 404；`nmorph.com` 为无关 BPM 服务站点 | **作废** |
| `liquid-glass-web` | npm `liquid-glass-web@1.0.0` 仅 346 B，描述为 "utility library"，无源码与仓库 | **作废**（原「自带调试面板」不成立） |
| `liquid-glass` | npm `liquid-glass@1.0.0` 仅 226 B（Expo 作者占位包） | **不适用** |
| `@yafh/liquid-glass` | `1.0.3`，MIT，10.1 KB gzip，unpacked 5.4 MB，peer `vue ^3.5.25`（项目 3.5.42 满足） | 备选参考 |
| `liquid-gl` | WebGPU/WebGL 折射，45.7 KB gzip | 超 §3.4-5 包体门槛，仅对照 |
| `@liquidglassjs/element` | 自定义元素 + core 双包，element 4.7 KB gzip、core unpacked 88 KB | 备选观察 |

#### 3.5.3 vitrio 对 §3.4 的逐项取证

| # | 检查项 | 取证结果 | 判定 |
| :--- | :--- | :--- | :--- |
| 1 | 包可解析 | registry 可达，tarball 解包成功（`src/`、`dist/`、`react/`、`vue/`、`examples/`） | 通过（离线安装待 CI 复核） |
| 2 | 许可证 | `LICENSE` 为 MIT 原文 | 通过 |
| 3 | 零网络 | 源码无 `fetch` / `XMLHttpRequest` / `WebSocket` / `sendBeacon`；仅 SVG 命名空间字符串 | 通过（静态取证） |
| 4 | 离线可用 | 临时 POC 页面全量 `page.route('**/*')` abort 后仍可挂载并生成折射节点；http(s) 资源条目与 request 事件零新增（位移图/克隆图以内联 `data:` 生成） | 通过（运行态取证，§19.62） |
| 5 | 包体增量 | 4.4 KB gzip、0 依赖，远低于 40 KB | 通过 |
| 6 | 首屏开销 | Chromium 挂载与卸载各测一次：TBT 0 ms、长任务 0 次（门槛 ≤50ms / ≤1） | 通过（运行态取证，§19.62） |
| 7 | 三端渲染 | 按裁决改为**分平台验收**：Windows UA（desktop-chromium）与 Android UA（mobile-chromium）创建 4 个 `feDisplacementMap` / `feImage`，截图可见位移与色散；iOS UA（mobile-safari）自动回落 CSS，0 个 svg/canvas/filter。补充探测：WebKit 强制折射虽能创建 `feImage`，但输出退化（无可见位移、红色残影），与「WKWebView 不保证 `feImage`」结论一致 | 通过（平台分层口径，§19.62；macOS/Linux/iOS 为 CSS 近似） |
| 8 | 构建安全 | 导入期仅有 `typeof HTMLElement` / `typeof customElements` / `typeof document` 守卫，无顶层 `window` 访问 | 通过 |
| 9 | 样式隔离 | 注入单个 `<style id="liquid-glass-style">`，选择器全部为 `.lqg-*` 命名空间，不触碰 Naive UI / Vant 变量；但属一次性全局样式，`destroy()` 不回收 | 有条件通过（需接受常驻全局样式） |
| 10 | 可降级 | 库内无 `matchMedia` / `prefers-reduced-transparency` 处理；POC 适配器在挂载前拦截后命中 `reduced-transparency`，零折射节点、仅保留 CSS 基座 | 有条件通过：须由 `GlassEngine` 适配器在挂载前拦截（§19.62） |
| 11 | 可卸载 | 50 次挂载/销毁后 DOM 快照与首轮基线逐字段相等，`.lqg-lens` / `.lqg-glass` / filter / canvas 残留 0；共享 style 常驻为设计行为 | 通过（运行态取证，§19.62） |
| 12 | 可主题化 | `tint` / `tintColor` / `blur` / `glow` 走 `--lqg-*` 变量可映射；inset / 阴影 / 高光色在库内硬编码 | 部分通过：主色可映射，阴影色不可完全去库化 |

#### 3.5.4 D1 准入结论

1. **D1 已按「平台分层」口径闭环**：12 项中 9 项完全通过（1/2/3/4/5/6/7/8/11，其中 4/6/7/11 为本次临时 POC 运行态取证）、2 项有条件通过（9 需接受常驻全局 style；10 需 `GlassEngine` 适配器在挂载前拦截）、1 项部分通过（12 阴影色不可完全去库化）。按裁决后的分平台判据，D1 不再阻塞 D2 评估；产品侧仍维持「不引入」（D2 于 2026-11-19 改为「建议加、未排期」，见 §19.90）。
2. **第 7 项判据改写为「分平台验收」**：Windows（WebView2）/ Android（Chromium WebView）走真折射；macOS / Linux / iOS（WKWebView / WebKitGTK）回落 CSS 近似，验收要求是「无错位、无闪烁、与基座视觉连续」，不再要求三端同效果。WebKit 强制折射的退化表现（无可见位移 + 红色残影）已在 §19.62 留证，作为回落策略的依据。
3. **第 10 项只能由适配器补齐**：库内无 `matchMedia`，须在挂载前判断 `prefers-reduced-transparency` 与用户偏好，并叠加既有的三重门（`advancedRefraction=false` / `tier !== 'high'` / `mode !== 'auto'` 一律回落 CSS）。
4. **当前决策**：不新增依赖——POC 使用的 `vitrio@0.1.2` devDependency、根目录 POC 页面与 spec 已全部删除，`package.json` / `pnpm-lock.yaml` 回到基线；`TjGlass` 的 `engine` 槽位保持空实现，不写生产适配器。
5. **剩余风险归 C3**：本轮平台证据来自 Playwright device descriptor（UA / platform 模拟），不是 Tauri 真机 WebView；Windows/macOS 真机截图与 Linux WebKitGTK 复核仍归 C3 硬件回归。若未来启动 D2，前置条件是先落地 §4.2 适配器（平台分层开关、reduced-transparency 拦截、失败回落 CSS、主题映射），且只允许用于非滚动静态表面、单视图 1 处。

---

## 4. 目标架构

### 4.1 四层结构

| 层 | 职责 | 位置 | 约束 |
| :--- | :--- | :--- | :--- |
| L0 Token | 材质参数单源 | `src/styles/css/design-tokens.css` | 只增不改；新增必须明暗双份 |
| L1 工具 | mixin / 工具类 / 变体 | `src/styles/scss/mixins/_liquid-glass.scss`、`src/styles/scss/global/glass.scss`（新增） | 必须内置降级 |
| L2 组件 | 统一玻璃容器与引擎适配 | `src/components/atomic/glass/TjGlass.vue`、`src/components/atomic/glass/engine/*` | 只消费 token，不写颜色 |
| L3 落点 | 页面/布局接入 | 桌面 `src/layout/**`、`src/components/**`；移动 `src/mobile/**` | 每视图 ≤3 个玻璃面 |

### 4.2 引擎适配器（隔离外部库）

```ts
// src/components/atomic/glass/engine/types.ts
export type GlassTier = 'low' | 'medium' | 'high'

export interface GlassEngineOptions {
  /** 折射强度 0-1，仅 high 档生效 */
  refraction: number
  /** 模糊半径，来自 --tjg-glass-blur-* 的数值部分 */
  blur: number
  /** 是否允许色散/边缘高光 */
  advanced: boolean
}

export interface GlassEngine {
  readonly id: string
  /** 是否满足当前环境（能力 + 性能 + 许可） */
  isSupported(tier: GlassTier): boolean
  /** 挂载到宿主元素，返回销毁函数 */
  attach(host: HTMLElement, options: GlassEngineOptions): () => void
}
```

规则：
- `engine` 通过 `defineAsyncComponent` + `import()` 动态加载，**不进首屏 chunk**。
- 加载失败、`isSupported` 为 false、用户关闭玻璃，三种情况一律走 CSS 基座。
- 适配器内部禁止写样式到宿主之外的节点。

### 4.3 目录规划

```text
src/components/atomic/glass/
  TjGlass.vue                 # 统一玻璃容器（variant / tier / engine）
  engine/
    types.ts                  # GlassEngine 契约
    css.ts                    # 默认引擎（零依赖，永远可用）
    refractory.ts             # 折射增强引擎加载器（动态 import，可失败）
  __tests__/
    tj-glass.test.ts          # props/variant/降级/卸载
```

---

## 5. 桌面端（Naive UI）实施方案

### 5.1 落点清单与预算

| 落点 | 文件（示例） | 变体 | 增强引擎 | 每视图预算 |
| :--- | :--- | :--- | :--- | :--- |
| 左侧导航栏 | `src/layout/left/**` | panel | 禁止 | 1 |
| 会话列表顶部搜索 | `src/components/**`（搜索区） | panel | 禁止 | 1 |
| 右侧详情/资料面板 | `src/layout/**`、`src/components/rightBox/**` | panel | 禁止 | 1 |
| 模态框 / 抽屉 | 全局调用点 | panel | 禁止 | 计入总量 |
| Popover / 右键菜单 | `src/components/common/ContextMenu*.vue` | subtle | 禁止 | 计入总量 |
| 登录页 / 引导页卡片 | 登录窗口 | panel | **允许 1 处** | 1 |

强制：单视图（同一路由或同一窗口）玻璃面总数 ≤3；超出必须改用纯色 + 边框。

### 5.2 `TjGlass.vue` 契约

| 项 | 类型 | 默认 | 说明 |
| :--- | :--- | :--- | :--- |
| `variant` | `'panel' \| 'subtle' \| 'none'` | `'panel'` | 对应两个变体；`none` 直接纯色（用于紧急回滚） |
| `engine` | `'auto' \| 'off'` | `'auto'` | `auto` 时按 tier 与用户偏好决定是否启用折射增强 |
| `tone` | `'nav' \| 'tabbar' \| 'input' \| 'sheet' \| 'row'` | - | 选择对应的底色 token |
| `radius` | `'surface' \| 'panel' \| 'sheet' \| 'full'` | `'panel'` | 映射到 `--tjg-radius-*` |

实现要点：
- 默认渲染 `<div class="tj-glass" :class="variantClass">`，通过 SCSS `@include liquid-glass-panel` / `liquid-glass-subtle` 取得材质与降级。
- `tier` 从 `useGlassEffectStore` 读取；`low` 档不渲染任何增强节点。
- 组件内不出现任何颜色字面量，`background` 一律来自 `var(--tjg-glass-*)`。
- 提供 `data-glass="off"` 输出，便于视觉回归与自动化断言。

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useGlassEffectStore } from '@/stores/domains/settings/glassEffect'

const props = withDefaults(
  defineProps<{
    variant?: 'panel' | 'subtle' | 'none'
    engine?: 'auto' | 'off'
    tone?: 'nav' | 'tabbar' | 'input' | 'sheet' | 'row'
    radius?: 'surface' | 'panel' | 'sheet' | 'full'
  }>(),
  { variant: 'panel', engine: 'auto', radius: 'panel' }
)

const glass = useGlassEffectStore()
const useEngine = computed(() => props.engine === 'auto' && glass.allowAdvancedRefraction)
const classes = computed(() => [
  'tj-glass',
  `tj-glass--${props.variant}`,
  props.tone ? `tj-glass--${props.tone}` : '',
  `tj-glass--radius-${props.radius}`
])
</script>

<template>
  <div :class="classes" :data-glass="variant === 'none' ? 'off' : 'on'">
    <div v-if="useEngine" class="tj-glass__engine" aria-hidden="true" />
    <slot />
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/scss/mixins/liquid-glass' as *;

.tj-glass {
  position: relative;
  overflow: hidden;
  isolation: isolate;

  &--panel {
    @include liquid-glass-panel;
  }

  &--subtle {
    @include liquid-glass-subtle;
  }

  &--none {
    background: var(--tjg-surface-panel);
    border: 1px solid var(--tjg-border-layout-divider);
  }

  &--radius-surface { border-radius: var(--tjg-radius-surface); }
  &--radius-panel { border-radius: var(--tjg-radius-panel); }
  &--radius-sheet { border-radius: var(--tjg-radius-sheet); }
  &--radius-full { border-radius: var(--tjg-radius-full); }

  /* tone 只改底色，不改模糊与降级 */
  &--nav { background-color: var(--tjg-glass-nav-bg); }
  &--tabbar { background-color: var(--tjg-glass-tabbar-bg); }
  &--input { background-color: var(--tjg-glass-input-bg); }
  &--sheet { background-color: var(--tjg-glass-sheet-bg); }
  &--row { background-color: var(--tjg-glass-row-bg); }

  &__engine {
    position: absolute;
    inset: 0;
    z-index: -1;
    pointer-events: none;
  }
}

@media (prefers-reduced-transparency: reduce) {
  .tj-glass {
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
    background: var(--tjg-surface-panel);
  }
}
</style>
```

### 5.3 Naive UI 主题接线

要点：**玻璃由容器提供，Naive 组件自身透明**，否则出现双层模糊与底色叠加。

- 在 `n-config-provider` 的 `theme-overrides` 中，把被玻璃容器包裹的组件定位类（如 `Modal`、`Drawer`、`Card`、`LayoutSider`）的背景设为 `transparent`。
- 不覆盖 Naive 的全局 `bodyColor`，避免影响未接入玻璃的区域。
- Popover 类组件本身带 padding 与阴影，需同时把 `padding: 0` 与 `boxShadow: none` 交给 `TjGlass` 统一提供。

### 5.4 桌面反例清单

| 反例 | 原因 |
| :--- | :--- |
| 用玻璃容器包裹消息列表 / 虚拟滚动容器 | 重绘区域过大，滚动掉帧 |
| 在同一视图堆叠 4 个以上玻璃面板 | 触发 GPU 合成层爆炸，违反 ≤3 预算 |
| 给 `n-modal` 同时设置半透明背景与玻璃容器 | 双层模糊，文字发糊、对比度下降 |
| 折射增强用于可滚动或频繁变化的区域 | 每帧滤镜重算，CPU 占用飙升 |
| 在玻璃面上使用 `--tjg-text-muted` 作为正文色 | 对比度不足 4.5:1 |

---

## 6. 移动端（Vant）实施方案

### 6.1 原则

移动端**不使用** SVG 折射库。原因：iOS/Android WebView 对 `feDisplacementMap` 的合成代价高，且 Vant 组件内部结构复杂，外层包裹会破坏 `van-tabbar`、`van-nav-bar` 的定位与安全区计算。

统一采用：CSS `backdrop-filter` + `--tjg-glass-*` + Vant CSS 变量。

### 6.2 落点清单

| 落点 | 现状 | 动作 |
| :--- | :--- | :--- |
| NavBar | `mobile.scss` 已实现 | 补 `html.low-perf` 降级 |
| TabBar | 已实现 | 补降级；确认底部安全区 `padding-bottom: env(safe-area-inset-bottom)` |
| 输入坞 | `mobile/views/message/index.vue` 已实现 | 保持手写 `-webkit-` 前缀写法 |
| 底部抽屉 / Sheet | 已实现 | 补降级；确认圆角只在顶部 |
| 列表行 | 使用 soft 模糊（**存量**） | 保留但不再新增；后续按预算替换为纯色 |
| Toast / ActionSheet | 已接入 | 移动端统一玻璃面：ActionSheet 走 `.van-popup--bottom`（阶段 C2 已接线），Toast 走 `.van-toast`（§19.90）；含能力 / 降低透明度 / 低性能三层回落 |

### 6.3 Vant 主题变量映射

通过 `ConfigProvider` 的 `theme-vars` 把 Vant 组件的底色对齐 token，避免「玻璃容器内套实色组件」：

| Vant 变量 | 映射值 |
| :--- | :--- |
| `--van-nav-bar-background` | `transparent` |
| `--van-tabbar-background` | `transparent` |
| `--van-tabbar-item-text-color` | `var(--tjg-text-secondary)` |
| `--van-tabbar-item-active-color` | `var(--tjg-color-primary-600)` |
| `--van-popup-background` | `var(--tjg-glass-sheet-bg)` |
| `--van-field-input-text-color` | `var(--tjg-text-primary)` |
| `--van-cell-background` | `transparent`（仅玻璃容器内） |

注意：`transparent` 是关键字而非颜色值，不违反「禁止硬编码颜色」；玻璃底色全部落在 `TjGlass` / `.tjg-glass-*` 上。

### 6.4 G1 修复示例

```scss
/* src/styles/scss/global/mobile.scss */
.tjg-glass-tabbar {
  -webkit-backdrop-filter: blur(var(--tjg-glass-blur-medium)) saturate(var(--tjg-glass-saturate-strong));
  backdrop-filter: blur(var(--tjg-glass-blur-medium)) saturate(var(--tjg-glass-saturate-strong));
  background: var(--tjg-glass-tabbar-bg);

  @supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
    background: var(--tjg-surface-panel);
  }

  html.low-perf & {
    -webkit-backdrop-filter: none;
    backdrop-filter: none;
    background: var(--tjg-glass-tabbar-bg);
  }
}
```

约束（与 `scripts/check-mobile-css.mjs` 一致）：
- 禁止 UnoCSS `backdrop-blur-*` 工具类（未接 autoprefixer，产不出 `-webkit-`）。
- 必须成对声明 `-webkit-backdrop-filter` 与 `backdrop-filter`。
- `@apply` 同样产不出前缀，移动端样式不得用 `@apply` 写模糊。

---

## 7. Pinia 主题与性能联动

### 7.1 `useGlassEffectStore`

位置：`src/stores/domains/settings/glassEffect.ts`（setup store，`persist` 只持久化用户偏好）。

| 类型 | 名称 | 说明 |
| :--- | :--- | :--- |
| state | `mode` | `'auto' \| 'on' \| 'off'`，默认 `auto` |
| state | `intensity` | `0-1`，映射到透明度档位（soft/medium/strong），默认 `0.8` |
| state | `advancedRefraction` | 用户是否允许折射增强，默认 `false` |
| state | `tier` | `'low' \| 'medium' \| 'high'`，来自 `resolvePerformanceTier()`，**不持久化** |
| getter | `allowBackdrop` | `mode !== 'off' && tier !== 'low'` |
| getter | `allowAdvancedRefraction` | `advancedRefraction && tier === 'high' && mode === 'auto'` |
| getter | `blurToken` | 按 `intensity` 映射到 `--tjg-glass-blur-soft/medium/strong` |
| action | `syncTier(next)` | 由启动流程与运行期降级钩子调用 |
| action | `reset()` | 恢复默认 |

### 7.2 启动时序

```text
main.ts
  → resolvePerformanceTier()          // 纯函数，读硬件与系统偏好
  → applyPerformanceTier()            // 首次绘制前写 html.low-perf
  → pinia 挂载
  → useGlassEffectStore().syncTier()  // 仅同步状态，不再改 DOM
  → 首屏渲染
  → requestIdleCallback: 帧率采样（可选，阶段 C）
```

硬约束：`html.low-perf` 的写入必须早于 `createApp`（已有测试 `performanceTier.test.ts` 守护），store 不得在模块顶层读取 `document`。

### 7.3 与既有建议的差异

| 建议写法 | 本项目写法 | 原因 |
| :--- | :--- | :--- |
| `glassIntensity = ref(0.8)` | `intensity` + `blurToken` 映射 | 避免组件直接拼 `blur(px)`，保持 token 单源 |
| `setPlatform('desktop' \| 'mobile')` | 不按平台手写开关，改由 `tier` 与设备能力推导 | 平台判断会误伤触屏笔记本与低配桌面 |
| `enableAdvancedRefraction = true`（桌面默认开） | 默认关，需用户显式开启且 tier 为 high | SVG 折射在部分 WebView 上代价不可控 |

---

## 8. 可访问性

| 要求 | 落地 |
| :--- | :--- |
| 正文对比度 ≥4.5:1 | 玻璃面上禁止使用 `--tjg-text-muted`；正文用 `--tjg-text-primary` / `--tjg-text-secondary` |
| 发送气泡 | 保持不透明 `--tjg-bubble-sent-bg`（`#0f7a66`，白字 5.26:1），**不做**玻璃化 |
| 接收气泡 | 可用 `--tjg-glass-tint-bubble-received`，但正文色必须仍为 `--tjg-text-primary` |
| `prefers-reduced-transparency: reduce` | 全部玻璃面回落 `--tjg-surface-panel`，禁用折射增强 |
| `prefers-reduced-motion: reduce` | 禁用色散流动、光泽扫过、缩放回弹（已有全局 0.01ms 压缩，需补充禁止新增 keyframes） |
| `prefers-contrast: more` | 使用 design-tokens 已有覆盖块，边框提升到 `--tjg-glass-border-color` |
| 焦点可见 | 玻璃容器内的可聚焦元素必须有 `:focus-visible` 描边，描边色用 `--tjg-color-primary-600` |
| 不依赖颜色 | 状态同时用图标/文字表达，不使用「仅玻璃色差」区分选中态 |

---

## 9. 性能预算与降级矩阵

### 9.1 档位矩阵

| 档位 | 判定 | 模糊 | 折射 | 动效 | 玻璃面上限 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `high` | 核心数 ≥8 且内存充足且系统未要求降低透明度 | soft/medium/strong | 允许（仅静态、单视图 ≤1） | 完整 | 3 |
| `medium` | 触屏设备、核心数 4-7、或系统要求降低透明度 | soft/medium | 禁止 | 完整 | 2 |
| `low` | 核心数 <4、内存不足、帧率采样不达标 | 无（纯色） | 禁止 | 精简 | 0 |

### 9.2 禁用清单

- 列表项、消息行、聊天气泡、输入框内部。
- 任何 `overflow: auto/scroll` 的容器本身。
- 同一视图第 4 个及以后的玻璃面。
- 移动端 `van-list`、`van-cell` 默认皮肤。

### 9.3 观测

| 指标 | 采集方式 | 阈值 |
| :--- | :--- | :--- |
| 长任务 | `PerformanceObserver('longtask')` | 单次 >100 ms 记一条 |
| 平均帧率 | `requestAnimationFrame` 采样 60 帧 | <45 触发运行期降级（阶段 C） |
| 首屏 | 既有 Web Vitals 观测 | 相对基线劣化 >10% 回滚 |
| 包体 | `pnpm metrics:bundle` | 增强库 gzip ≤40 KB |

---

## 10. 分阶段实施计划

### 阶段 A｜基座修复（P0，先做）

| # | 任务 | 文件 | 完成标准 |
| :--- | :--- | :--- | :--- |
| A1 | 新增 `glassEffect` store | `src/stores/domains/settings/glassEffect.ts` | 单测覆盖 mode/intensity/tier 组合 |
| A2 | 新增 `TjGlass.vue`（CSS 引擎） | `src/components/atomic/glass/TjGlass.vue` | 4 个 variant 渲染正确，`variant="none"` 输出 `data-glass="off"` |
| A3 | 新增 `glass.scss` 工具层 | `src/styles/scss/global/glass.scss` | 只消费 token，无颜色字面量 |
| A4 | 修 G1：移动端补 `html.low-perf` 降级 | `src/styles/scss/global/mobile.scss` | 低性能档下所有玻璃面关闭模糊 |
| A5 | 修 G2：调整判级策略 | `src/utils/performanceTier.ts` | `coarsePointer` 不再单独判 low；`performanceTier.test.ts` 更新 |
| A6 | 扩展契约测试 | `src/styles/__tests__/liquid-glass.test.ts` | 新增：`TjGlass` 不得含颜色字面量；每视图 `TjGlass` 数 ≤3 |

### 阶段 B｜桌面落点（P1）

| # | 任务 | 完成标准 |
| :--- | :--- | :--- |
| B1 | 左栏导航接入 `TjGlass variant="panel"` | 明暗主题截图一致，滚动无掉帧 |
| B2 | 右侧详情面板接入 | 与左栏材质一致，双层模糊消除 |
| B3 | Modal / Drawer 接入 | 文字对比度抽检 ≥4.5:1 |
| B4 | ContextMenu / Popover 改用 `subtle` | 统一阴影与边框 |
| B5 | 清理存量手写 `blur(10px)` | `variable.scss` / `base.scss` / `InfoEdit.vue` 等改走 mixin |

### 阶段 C｜移动端补齐（P1）

| # | 任务 | 完成标准 |
| :--- | :--- | :--- |
| C1 | NavBar / TabBar / InputDock / Sheet 落点复核 | `pnpm check:mobile-css` 全绿 |
| C2 | Vant `theme-vars` 接线 | 玻璃容器内无实色底 |
| C3 | 安全区与键盘弹起回归 | 移动视口回归（`e2e/mobile-safe-area.spec.ts`）+ 真机截图对比（待硬件） |
| C4 | 低端机降级验证 | `html.low-perf` 下手动注入类名验证 |

### 阶段 D｜增强库 POC（P2，可弃）

| # | 任务 | 完成标准 | 2026-11-17 状态 |
| :--- | :--- | :--- | :--- |
| D1 | vitrio POC | §3.4 全 12 项通过才进入 D2；否则关闭候选 | **已闭环（平台分层口径）**：9 项完全通过（含运行态 4/6/7/11）、2 项有条件通过（9/10）、1 项部分通过（12）；详见 §3.5.3 / §3.5.4 / §19.62 |
| D2 | vitrio 接入登录页 / 引导页（单视图 1 处） | 关闭开关后视觉与 CSS 基座一致 | **建议加、未排期**：产品侧建议接入；前置为 C3 真机取证 + §4.2 `GlassEngine` 适配器，且平台分层下 macOS/Linux/iOS 仍回落 CSS 近似（§19.90） |
| D3 | ~~liquid-glass.io 对照 POC~~ | 与 D2 同场景 A/B 截图对比 | **作废**：域名待售、npm 无包（§3.5.2） |
| D4 | ~~nmorph 评估~~ | 仅在出现「批量组件皮肤」需求时启动 | **作废**：npm 404、同名站点无关（§3.5.2） |

### 阶段 E｜收敛与守护（P2）

| # | 任务 | 完成标准 |
| :--- | :--- | :--- |
| E1 | 收紧 `check-ratchet` 基线 | 裸 `backdrop-filter` 计数只降不升 |
| E2 | 视觉回归用例 | Storybook 覆盖 4 个 variant × 明暗 |
| E3 | 文档同步 | 本文件与 `design-tokens.css` 注释一致 |

### 落地状态（2026-11-08）

| 阶段 | 状态 | 说明 |
| :--- | :--- | :--- |
| A | 已完成 | A4 的移动端玻璃面（NavBar / FooterBar / More 等）已全部接入 `html.low-perf` 降级；A6 契约测试见 `src/styles/__tests__/liquid-glass.test.ts` |
| B | 已完成 | B3 见 `base.scss` 的 `.n-modal-mask` / `.n-drawer-mask` 与低性能降级；B4 见 `ContextMenu.vue` / `ContextMenuEmoji.vue`；B5 裸模糊已收敛到 `_liquid-glass.scss` 的 `backdrop-blur-pair` / `glass-blur`，`blur(10px)` 字面量清零 |
| C | 部分完成 | C1/C2/C4 已完成：C2 在 `mobile.scss` 接线 `--van-popup-background` / `--van-action-sheet-item-background` / `--van-picker-background`；C4 由 `mobileCssGuards.test.ts` 与 `check:mobile-css` 自动守卫。C3 已完成 mobile-chromium 视口回归（TabBar 贴底、横屏侧栏、键盘抬升与负对照，见 §19.58），真机截图待硬件 |
| D | 暂缓 | 经确认暂缓增强库 POC，现有 CSS 玻璃基座保持不变 |
| E | 已完成 | E1 基线已收紧；E2 在 `storybook-visual.spec.ts` 增加 8 条 TjGlass 基线（4 variant × 明暗）；E3 本文件与 `design-tokens.css` 的玻璃 token 已对齐 |

---

## 11. 验收标准

### 11.1 门禁命令

| 命令 | 通过标准 |
| :--- | :--- |
| `pnpm vue-tsc --noEmit` | 0 错误 |
| `pnpm test:run` | 全部通过（含扩展后的 `liquid-glass.test.ts`、`performanceTier.test.ts`、`tj-glass.test.ts`） |
| `pnpm check` | Biome + i18n 无新增问题 |
| `pnpm check:ratchet` | 无新增硬编码颜色，基线不升高 |
| `pnpm check:mobile-css` | 前缀与工具类规则全绿 |
| `pnpm check:file-size` | 无新增超限文件 |
| `pnpm check:sdk-boundary` | 通过 |
| `pnpm quality:no-raw-fetch` | 通过 |
| `pnpm metrics:bundle` | 若引入增强库，gzip 增量 ≤40 KB |

### 11.2 新增测试要求

1. `tj-glass.test.ts`：variant 映射、`tone` 映射、`variant="none"` 输出、`tier='low'` 时不渲染引擎节点、卸载后无残留。
2. `glassEffect.test.ts`：`mode` / `intensity` / `tier` 组合下的 getter 真值表；`tier` 不进入持久化。
3. `liquid-glass.test.ts` 扩展：`src/components/atomic/glass/**` 内不得出现颜色字面量（`#`、`rgb(`、`rgba(`）；layout 层 `TjGlass` 出现次数 ≤3。
4. 视觉回归：Storybook 中 `TjGlass` 的 light/dark × panel/subtle/none 截图基线。

### 11.3 R3 落地校验（每提交必答）

1. **是否复用现有能力 / 是否新增平行实现**：复用 `--tjg-glass-*` + mixin + `performanceTier`，未新增平行设计系统；外部库经 `GlassEngine` 适配器隔离，默认不引入。与 Matrix SDK 无关，不涉及 R1。
2. **是否引入移动端 admin / AI 入口**：否。本方案只改样式层与 settings store，不触碰 `src/views/admin/**`、`src/plugins/robot/**`、`src/services/matrix/ai/**`。
3. **移动端构建是否仍可产出**：本方案不改路由与入口，需跑移动分支前端构建确认；阶段 C 完成后执行一次 Android/iOS 前端产物构建验证。

---

## 12. 能力接线补齐方案（2026-11-14 全量排查）

### 12.1 定位与范围

本章与第 4-10 章的液态玻璃主题无关，处理的是**功能接线**问题：后端（synapse-rust）与 matrix-js-sdk 已具备能力，前端未接线或接线不正确。

- 输入依据：`OPS_ARTIFACTS/TJG_CAPABILITY_WIRING_GAP_2026-11-14.md`（47 条）；2026-11-15 复核追加 CAP-08（能力位映射错误），合计 48 条。
- 取证基线：本仓库 HEAD `caed98250`，路由基线 `synapse-rust/docs/synapse-rust/ROUTE_HANDLERS.json`（983 条，其中 16 条 unsupported）。
- 判定口径沿用报告四态：`无需前端交互` / `已正确接入` / `未接线` / `接线不正确`。本章只处理后两态。

### 12.2 核实结论

#### 12.2.1 本轮独立抽查（12 条）

| 编号 | 优先级 | 结论 | 关键取证 |
| :--- | :--- | :--- | :--- |
| CAP-01 | P0 | 成立 | `src/services/matrix/MatrixCapabilityService.ts` 的别名表把 `e2ee.unstable` 写成 `org.matrix.msc3814`（实为脱水设备）、`voip.unstable` 写成 `org.matrix.msc3245`；`canUseE2EE()` 走 fail-open，与 `hasCapability()` 两套口径 |
| ROOM-01 | P0 | 成立 | `src/components/rightBox/chatBox/ChatMain.vue:282` 把 `pinnedMessageFlow.pinnedMessages` 直接赋给 `stickyEvents`；`src/types/stickyEvent.ts:7-8` 注释已自认「数据来源是 pinnedMessages」 |
| ROOM-02 | P1 | 成立 | 六个房间面板仅出现在各自 `__tests__` 与 `src/typings/components.d.ts`；`src/components/room/RoomDetailDrawer.vue` 只挂载 `RoomDetailStats` / `RoomDetailPinnedMessages` / `RoomDetailLastMessage` / `RoomDetailMembers` |
| ROOM-05 | P1 | 成立（描述需修正） | `ChatMain.vue:224-238` 的 `handleBurnToggle` 为静默空 catch；`RoomBurnSettings.vue:75-96` 的 `handleToggle` 只有 `try/finally` 无 `catch`、`handleDurationChange` 无 `try`，失败无任何反馈。实际缺陷是「吞错 + 无反馈」，不是「乐观更新」 |
| ROOM-07 | P1 | 成立 | `src/services/matrix/MatrixSearchService.ts:304-333` 的 `searchRooms()` 是对 `client.getRooms()` 的名字/ID 做本地 `includes` 过滤，不是服务端房间搜索 |
| ADM-01 | P1 | 成立 | `src/composables/admin/useAdminNotifications.ts` 只调用 `getUserNotificationSettings` / `setUserNotificationSettings` / `getUserPushers` / `deleteUserPusher`，与 7 条系统通知端点无关 |
| ADM-02 | P1 | 成立 | `src/views/admin/AdminModules.vue` 仅有 `props.modules`（默认 `[]`）、无 `onMounted`、无服务或 composable 调用，`filteredModules` 恒空 |
| ADM-03 | P1 | 成立 | `AdminExternalServiceService` 仅被 `AdminFacadeService.ts:46,104` 与单测引用，无页面、无 composable、无路由 |
| ADM-07 | P1 | 成立 | `src/composables/admin/useAdminServerLogs.ts:36-46` 用 `Promise.allSettled` 把失败项一律置 `null`，无错误态；页面内容实为 status/health/version/stats |
| AUTH-01 | P1 | 成立 | `src/views/loginWindow/ThirdPartyLogin.vue` 的 `ssoOptions` 仅 gitee/github 常驻 + 可选 CAS，无 OIDC/SAML，未探测 `auth_metadata` |
| VEN-02 | P1 | 成立 | 全仓 `src/**` 检索 `push/devices`、`push/send` 均 0 命中 |
| VEN-03 | P1 | 部分成立 | `src/services/matrix/room/AccountDataService.ts:108-118` 走 SDK `getExternalServiceManager().listServices()`（SDK `lib/external-service/index.d.ts` 已导出），但除 `RoomFacade` 与单测外无消费者；报告所称「默认 `synapse_admin` 前缀」需按 SDK 实现再确认 |

#### 12.2.2 全量结论

47 条**全部成立，未发现误报**；其中 ROOM-05、VEN-03 的表述需按上表修正。2026-11-15 复核时追加 CAP-08（原报告未覆盖：别名表 key 与后端实际宣告不一致），合计 48 条。其余未逐条抽查的条目依据报告 §4.3 的 HEAD 增量复核结论采纳，实施前须按 §12.4 各自「取证」列做一次现场确认（本环境 grep shim 对 `\b`、BRE 的 `\+`/`\|` 会静默返回空，必须用专用检索工具）。

### 12.3 批次 0：统一能力门控口径（所有后续改动的前置）

若不先做这一节，后面每条都会各自写一套门控，返工成本更高。

#### 12.3.1 别名表订正与扩展

`HULA_CAPABILITY_ALIASES` 现状与目标：

| 能力 | 现状 | 目标 | 说明 |
| :--- | :--- | :--- | :--- |
| `e2ee` | `unstable: []`，`capabilities: ['m.room.encryption']` | `unstable: []`，`capabilities: []` | CAP-01 已移除 `org.matrix.msc3814`；CAP-08 订正：再删除 `m.room.encryption`，后端 `/capabilities` 从不宣告该项 |
| `voip` | `['org.matrix.msc3245.voice', 'org.matrix.msc3245']` | 同现状 | CAP-01 已补齐 SDK 主 key `.voice` 后缀 |
| `dehydrated-device` | `['org.matrix.msc3814']` | 同现状 | 已完成 |
| `sticky-events` | `['org.matrix.msc4354']` | 同现状 | 已完成（ROOM-01/CAP-02） |
| `scheduled-send` | `['org.matrix.msc4140']` | 同现状 | 与后端一致 |
| `rtc-transports` | `['org.matrix.msc4143']` | 同现状 | 与后端一致 |
| `admin-api` | `unstable` 与 `capabilities` 均为 `io.hula.admin` | 二者均置空，改判定来源 | CAP-08 订正：后端从不宣告 `io.hula.admin`；admin 权限由 `/_synapse/admin/*` 的 `is_admin` 校验，不能作为 capability |
| `account-status` | `unstable: ['org.matrix.msc3720']` | `capabilities: ['org.matrix.msc3720.account_status']` | CAP-08 订正：后端键带 `.account_status` 后缀，且走 `capabilities` 面；短名 `org.matrix.msc3720` 不存在 |
| `extended-profile` | `unstable: ['org.matrix.msc4133']` | `unstable: ['uk.tcpip.msc4133']` + `capabilities: ['m.profile_fields']` | CAP-08 订正：后端 `BASE_UNSTABLE_FEATURES` 宣告 `uk.tcpip.msc4133`，稳定侧为 `m.profile_fields` |
| `qr-rendezvous` | `['org.matrix.msc4108']` | 同现状 | 已完成（AUTH-05） |
| `mutual-rooms` | `['uk.half-shot.msc2666.query_mutual_rooms']` | 同现状 | 已完成（CAP-06），与后端同名宣告一致。键名不是 `org.matrix.msc2666`（任何 homeserver 都不发），也不能用短名 `uk.half-shot.msc2666`（matrix-js-sdk 会退回后端不服务的 `/user/shared_rooms/{userId}`） |

> 复查口径：2026-11-15 按后端 `synapse-rust/synapse-services/src/capability_governance.rs` 的 `build_capabilities_response()` 与 `BASE_UNSTABLE_FEATURES` 逐项比对 14 个能力位，4 项 key 不一致、1 项（`mutual-rooms`）已一致，订正方案见 §12.4.1 的 CAP-08。

#### 12.3.2 单一真源与三态

- `hasCapability()` 是唯一判定入口；`canUseE2EE()` / `canUseVoip()` / `canUseBurnAfterRead()` 等全部改为**委托**，删除各自的 fail-open 分支。
- 判定结果收敛为三态：`'supported' | 'unsupported' | 'unknown'`。`unknown` 按 `unsupported` 处理（不渲染入口），并在设置页「服务能力」区块显式展示「未知」，避免静默放行。
- `EndpointCapabilityService.check()` 作为端点级补充，覆盖本次新增端点；现状仅 9 处调用点，需按 §12.4 补到对应触点。

#### 12.3.3 消费 SDK 特性位（前提已订正）

原计划「经 SDK 常量映射到 `TjgCapability`」**不可行**：`SynapseRustFeature` 与 `SYNAPSE_RUST_FEATURE_FALLBACK` 位于 `lib/server-capabilities`，matrix-js-sdk 的 `package.json#exports` 未暴露该子路径，根 `index.d.ts` 也没有 re-export。故当前实现取舍：

- 保留 Tjg 侧 `HULA_CAPABILITY_ALIASES` 作为唯一映射表（服务层内），并在源码注释中登记 R1 检索结论与不可复用原因。
- SDK 侧升级若补齐 exports，应按 R1 改为派生映射，删除本地清单。
- 本改动不触碰 SDK 内部，`pnpm check:sdk-boundary` 保持通过。

#### 12.3.4 门控落点规范

1. 优先级：**不渲染 > 禁用并说明原因 > 点击后报错**。可裁剪的入口一律 `v-if="capability.supported"`，禁止先渲染再报错。
2. 每个门控必须配一个三态单测：supported 渲染、unsupported 不渲染、unknown 不渲染。
3. 移动端的 admin/AI 裁剪（R2）在路由/菜单/模块装配期完成，**不得**用能力门控替代裁剪。

#### 12.3.5 批次 0 落地记录（CAP-01）

| 项 | 状态 | 说明 |
| :--- | :--- | :--- |
| `TjgCapability` 扩展 | 完成 | 6 项 → 14 项，新增 `dehydrated-device` / `sticky-events` / `scheduled-send` / `rtc-transports` / `account-status` / `extended-profile` / `qr-rendezvous` / `mutual-rooms` |
| 别名表订正 | 完成 | `e2ee.unstable` 移除 `org.matrix.msc3814`；`voip` 主 key 改为 `org.matrix.msc3245.voice`；8 个新能力位按 §12.3.1 落表 |
| 三态判定 | 完成 | 新增 `CapabilityStatus`；`getCapabilityStatus()` 为唯一判定实现，`hasCapability()` 与各 `canUseXxx()` 全部委托；快照未加载返回 `unknown` |
| E2EE fail-open | 已删除 | `canUseE2EE()` 仅认 `m.room.encryption`；`EncryptionSettings` 的只读判定已改为客户端 crypto 诊断（`cryptoInitFailed`），不再依赖该 key，误锁问题由 §19.89 清偿 |
| 消费层统一 | 完成 | `useServerCapability().capabilityCheckers` 补齐 14 项，新增导出 `getCapabilityStatus`；`PermissionGuard.vue` 删除本地 6 项硬编码映射，改为调用 `isCapabilityAvailable` |
| 单测 | 完成 | 并入既有 `MatrixCapabilityService.test.ts`（不新建重复文件）：`unstableBits` 9 项 + `capabilityBits` 5 项 `it.each`，含 unknown 前置、SDK 兼容 fallback、`dehydrated-device` 不构成 E2EE 信号；文件 32 用例通过 |
| 门禁 | 通过 | `vue-tsc --noEmit` 0 错误；`biome check` 改动文件无告警；`MatrixCapabilityService` + `PermissionGuard` 合计 38 用例通过 |

R1 结论：SDK 未通过 exports 暴露 `server-capabilities`，本地别名表为当前唯一可行方案，已在源码注释登记检索证据。R3 结论：未新增平行 API 实现；未引入移动端 admin/AI 入口；移动端构建路径未受影响。

#### 12.3.6 批次 0 落地记录（CAP-02）

| 项 | 状态 | 说明 |
| :--- | :--- | :--- |
| `StickyTab` 门控 | 完成 | 随 ROOM-01 一并落地：`sticky-events` 为 unsupported/unknown 时只渲染只读提示、不发 GET；见 §12.4.3 |
| `DehydratedDeviceSection` 门控 | 完成 | 判定改为 `getCapabilityStatus('dehydrated-device') === 'supported' && matrixDehydratedDeviceService.isSupported()`；不再只看加密后端接口是否存在 |
| 整块不渲染 | 完成 | 根节点 `v-if="supported"`，删除 unsupported 三元文案与子组件各自的 `v-if`；能力快照到达前（unknown）不渲染，避免只读占位与点击后才抛错的入口 |
| 响应式 | 完成 | `getCapabilityStatus` 在 computed 内读取能力 store，快照异步到达后自动重算，删除 `onMounted` 手工探测 |
| i18n | 无新增 | `encryption.dehydrated_device.unsupported` 仍由 `DehydratedDeviceManager.vue` 使用，未产生孤儿 key |
| 测试 | 完成 | `EncryptionSettings.test.ts` 的脱水设备用例改为四态：unsupported / unknown / 后端无接口 ⇒ DOM 不存在；双双支持 ⇒ 区块与管理按钮存在 |
| 门禁 | 通过 | `vue-tsc --noEmit` 0 错误；`EncryptionSettings.test.ts` 25 用例通过；`pnpm check`、`check:ratchet`、`check:sdk-boundary`、`quality:no-raw-fetch`、`check:doc-coverage`、`check:doc-paths` 均通过 |

R1 结论：仅消费 `MatrixCapabilityService` 与既有 `MatrixDehydratedDeviceService`，未新增 HTTP 实现。R3 结论：未引入移动端 admin/AI 入口；设置为桌面端页面，移动端构建路径未受影响。

### 12.4 逐条优化方案

#### 12.4.1 CAP（8 条）

| 编号 | 优先级 | 触点 | 改动要点 | 验收 |
| :--- | :--- | :--- | :--- | :--- |
| CAP-01 | P0 | `src/services/matrix/MatrixCapabilityService.ts` | **已完成**（2026-11-15）：别名按 §12.3.1 订正（逐位对齐见 CAP-08）；`canUseE2EE()` 改为读客户端 crypto 上下文（`:250`，服务端不宣告 `e2ee`），fail-open 已删除；`getCapabilityStatus()` 三态（`supported`/`unsupported`/`unknown`）落地，快照未加载前返回 `unknown` | `MatrixCapabilityService.test.ts` 14 位真值表双向断言 + 三态用例（`unknown` 时 `hasCapability` 为 `false`） |
| CAP-02 | P1 | `src/components/room/settings-tabs/StickyTab.vue`、`src/views/settingsWindow/tabs/sections/DehydratedDeviceSection.vue` | **已完成**（2026-11-15）：`StickyTab.vue` 由 `useStickyEvents.canSetSticky`（`hasCapability('sticky-events')`，MSC4354）门控，不支持时显示 `sticky-unsupported` 提示且不渲染列表、不发起请求；`DehydratedDeviceSection.vue` 以 `dehydrated-device` 能力位 + 后端接口双判（详见 CAP-04） | `StickyTab.test.ts` 与 `EncryptionSettings.test.ts` 断言 unsupported 时 DOM 不存在 |
| CAP-03 | P1 | `src/services/matrix/auth/MatrixOidcService.ts`、`src/views/loginWindow/ThirdPartyLogin.vue` | **已完成**（2026-11-15）：见下方「CAP-03 / AUTH-01 落地记录」 | 契约测试覆盖 200/404；组件测试覆盖 flows 缺失 |
| CAP-04 | P2 | `DehydratedDeviceSection.vue` | **已完成**（2026-11-15）：别名收敛为 `unstable: ['org.matrix.msc3814']`、`capabilities: []`（服务端只经 `/versions.unstable_features` 宣告）；`DehydratedDeviceSection.vue:51` 判定为 `getCapabilityStatus('dehydrated-device') === 'supported' && matrixDehydratedDeviceService.isSupported()` 双判，不再只看加密后端接口存在 | `EncryptionSettings.test.ts` 四态（unsupported / unknown / 后端无接口 ⇒ DOM 不存在；双双支持 ⇒ 区块存在） |
| CAP-05 | P2 | 扩展资料入口 | **已完成**（2026-11-15）：`extended-profile` 别名改为 `unstable: ['uk.tcpip.msc4133']` + `capabilities: ['m.profile_fields']`（与 CAP-08 一并订正）；`AccountSettings.vue:186` 的 `supportsExtendedProfile` 改读 `isCapabilityAvailable('extended-profile')`，删除直连键名的 `hasUnstable` 判定，写入/编辑按钮与提示统一由该能力位驱动 | `AccountSettings.test.ts` 覆盖支持/不支持两分支；`MatrixCapabilityService.test.ts` 真值表双向断言 |
| CAP-06 | P2 | `src/services/matrix/MatrixCapabilityService.ts`（`'friend-list'` 别名表 + `canUseFriendList()`）、`src/components/friend/friendListViewState.ts` | **已完成**（2026-11-15）：别名表收敛为 `unstable: ['io.hula.friends']` + `capabilities: ['io.hula.friends']`（双面同名）；`friendListViewState.ts` 是纯状态机，按 `canUseFriendList` 布尔切 `capability` 态，本身不含任何键名；`mutual-rooms`（`uk.half-shot.msc2666.query_mutual_rooms`）不参与好友列表门控、当前无消费方 | `MatrixCapabilityService.test.ts` 真值表含 `['friend-list','io.hula.friends']` 双向断言；`friendListViewState.test.ts` 覆盖 `canUseFriendList=false` 走 `capability` 态 |
| CAP-07 | P2 | 语音探针与 VoIP 门控 | **已完成**（2026-11-15）：删除 `voipHelpers.checkVoipAvailability` 的 `client.callEventHandler` 自判，改为 `registerVoipCapabilityResolver(() => matrixCapabilityService.canUseVoip())` 注入（避开循环依赖），`src/main.ts` 启动期注册；未注册时按未知降级为不支持；TURN 检测与返回形状不变 | `voipHelpers.test.ts` 6 例；media 域 229 例通过 |
| CAP-08 | P1 | `src/services/matrix/MatrixCapabilityService.ts`（`HULA_CAPABILITY_ALIASES`）、`src/views/settingsWindow/tabs/EncryptionSettings.vue:279`、`AccountSettings.vue:186` | **已完成**（2026-11-15）：别名表与后端实际宣告逐位对齐——`e2ee` 删 `m.room.encryption` 并改客户端 crypto 判定；`admin-api` 删除 `io.hula.admin`、改由桌面 admin 桥接层注入 resolver；`extended-profile` 改 `uk.tcpip.msc4133` + `m.profile_fields`；`account-status` 改 `org.matrix.msc3720.account_status`；`mutual-rooms` 已一致不改 | 单测真值表覆盖 14 位，每位含「后端真实 key 命中 + 旧错误 key 不命中」双向断言；真实后端快照下加密设置可编辑 |

##### CAP-08 取证与订正方案（P1，已完成 2026-11-15）

2026-11-15 复核 14 个能力位与 synapse-rust 实际宣告，来源为 `capability_governance.rs` 的 `build_capabilities_response()`（`capabilities` 面）与 `BASE_UNSTABLE_FEATURES`（`/versions.unstable_features` 面）。

| 能力位 | 前端当前映射 | 后端实际宣告 | 判定 | 影响面 |
| :--- | :--- | :--- | :--- | :--- |
| `e2ee` | `capabilities: ['m.room.encryption']`，`unstable: []` | 无 | 不一致 | **已产生用户可见缺陷**：`EncryptionSettings.vue:279` 的只读判定为 `isLoaded && !canUseE2EE`，真实后端快照加载后加密设置整页只读 |
| `admin-api` | `unstable` 与 `capabilities` 均为 `io.hula.admin` | 无 | 不一致 | 当前零 UI 消费方（`canUseAdminApi()` 仅单测引用），属契约错误未显现 |
| `extended-profile` | `unstable: ['org.matrix.msc4133']` | `uk.tcpip.msc4133` + `capabilities: ['m.profile_fields']` | 不一致 | `hasCapability('extended-profile')` 恒为假；`AccountSettings.vue:186` 绕过能力位直连 `hasUnstable('uk.tcpip.msc4133')`，UI 才可用（CAP-05 无法按现有契约落地） |
| `account-status` | `unstable: ['org.matrix.msc3720']` | `capabilities: ['org.matrix.msc3720.account_status']` | 不一致 | 当前零消费方；AUTH-06 若按现契约接线将永远 unsupported |
| `mutual-rooms` | `unstable: ['uk.half-shot.msc2666.query_mutual_rooms']` | `uk.half-shot.msc2666.query_mutual_rooms` | 一致 | 已在 CAP-06 阶段订正，本轮无需改动 |

逐位处置：

1. `e2ee`：删除 `capabilities: ['m.room.encryption']`。E2EE 是客户端能力（`client.getCrypto()` / `isCryptoEnabled()` 就绪），不由 homeserver 宣告；`canUseE2EE()` 改为「crypto 初始化完成」判定，服务端快照不再参与。同步把 `EncryptionSettings` 的只读语义改为「crypto 未初始化才只读」。
2. `admin-api`：两个来源均置空。admin 权限由 `/_synapse/admin/*` 的 `is_admin` 校验，不在 capabilities 面；能力位改为「admin 路由注册期确定 + 首次请求 403 降级」，不再充当局级权限位。
3. `extended-profile`：改为 `unstable: ['uk.tcpip.msc4133']` + `capabilities: ['m.profile_fields']`；`AccountSettings.vue` 的 `supportsExtendedProfile` 改读能力位，删除直连键名。
4. `account-status`：`unstable` 侧清空，改为 `capabilities: ['org.matrix.msc3720.account_status']`（后端经 `insert_enabled_capability` 宣告，属 capabilities 面）。
5. `mutual-rooms`：保持现状，不改。

验收与门禁：

- `MatrixCapabilityService.test.ts`（并入既有文件，不新建）扩为 14 位真值表，每位同时断言「后端真实 key 命中」与「旧错误 key 不命中」，至少覆盖上表 4 项订正。
- `EncryptionSettings.test.ts` 增一例：真实后端快照（无 `m.room.encryption`）下页面可编辑；现有 `canUseE2EE` 用例按新判定改写。
- `vue-tsc --noEmit`、`test:run`、`check`、`check:ratchet`、`check:sdk-boundary`、`quality:no-raw-fetch`、`check:doc-coverage`、`check:doc-paths` 全绿。

R1 结论：仅改本地别名表与消费层门控，不新增协议实现；`m.profile_fields`、`org.matrix.msc3720.account_status` 均为后端既有关键字面量，可经 `/capabilities` 读取。R3 结论：触点均为服务层映射与桌面设置页，未引入移动端 admin/AI 入口，移动端构建路径不变。

#### 12.4.2 AUTH（7 条）

| 编号 | 优先级 | 触点 | 改动要点 | 验收 |
| :--- | :--- | :--- | :--- | :--- |
| AUTH-01 | P1 | `ThirdPartyLogin.vue`、`MatrixOidcService.ts` | **已完成**（2026-11-15）：与 CAP-03 合并实施，OIDC/SAML 合并为同一 SSO 按钮族，见下方「CAP-03 / AUTH-01 落地记录」 | 同 CAP-03 |
| AUTH-02 | P2 | 设置-账号安全、`MatrixAccountService` | **已完成**（2026-11-15）：SDK 已有 `ThreePidsManager`（`getThreePids/addThreePidOnly/bindThreePid/unbindThreePid/deleteThreePid`）与 `requestAdd3pidEmailToken`，服务层新增 `accountThreePids.ts`（列表/请求验证码/提交验证码/添加/解绑，全走 SDK 与 `authedRequestWithPath`，不自拼 URL）；`add` 端点强制 UIA，用 `m.login.password` 构建 auth；新增 `ThreePidSection.vue`（邮箱绑定与验证、解绑）挂到 `SecuritySettings.vue`；手机号绑定未实现（SDK/后端无 msisdn submitToken） | `accountThreePids.test.ts`（11 例）+ `ThreePidSection.test.ts`；`SecuritySettings.test.ts` 17 例 |
| AUTH-03 | P2 | `src/components/workbench/TjgSpaceJoinCta.vue:119-149` | **已完成**（2026-11-15）：服务层复用 `RoomFacade.knockRoom`（委托 `MatrixRoomMembershipService.knockRoom`）；`handleJoin()` 按 `joinRule === 'knock'` 调用 `knock()`（→ `matrixSpaceService.knockSpace`），成功/失败文案走 `space.knock_success` / `space.knock_failed`；`SpaceInfo.joinRule` 由 `spaceHelpers` 从 `Room.getJoinRule()` 产出；组件已挂载到 `SpaceDetailsPane` 的非成员 CTA，由 `SpaceChildrenPane` 传入 `joinRule` 并在成功后刷新列表 | 组件测试断言 knock 走 `knockRoom` 而非 `join`；挂载点测试断言非成员渲染 join CTA、knock 空间显示申请文案 |
| AUTH-04 | P2 | `src/composables/user/useAccountDeactivation.ts`、`src/views/settingsWindow/tabs/AccountSettings.vue:147,168`、`src/mobile/views/my/MobileDeactivateAccount.vue` | **已完成**（2026-11-15）：抽出零 Naive/Tauri 依赖的 `useAccountDeactivationFlow`（密码校验 → 注销 → `AccountDeactivationError` 错误码），桌面 `useAccountDeactivation` 与移动端 `MobileDeactivateAccount` 共用同一套判定；两端文案统一到 `setting.account.deactivate_*`（新增 `deactivate_password_invalid`），`mobile_deactivate.json` 死键已清理 | `useAccountDeactivationFlow.test.ts`（6 例） |
| AUTH-05 | P2 | 手写 rendezvous 实现 | **已完成**（2026-11-15 核实）：已由 `src/services/matrix/rendezvous/MatrixRendezvousService.ts`（经 `matrixClientService` 取客户端，不自拼 HTTP）+ `useRendezvous` + `RendezvousSessionManager.vue` 承载；桌面 `QRCode.vue`、移动 `MobileQRCode.vue` / `ConfirmQRLogin.vue` 均为消费方，配合 `MatrixQrLoginSdkService`（MSC4108） | `useRendezvous.test.ts` 与 `MatrixQrLoginSdkService.test.ts` 覆盖 |
| AUTH-06 | P2 | 账号状态 / 共同房间 | **已完成**（2026-11-15）：服务层新增 `MatrixAccountStatusService`（`isSupported()` 为 false 直接返回空不发请求，fail closed）与 `MatrixRelationshipService.getMutualRooms`（委托 `getRoomManager().getMutualRooms`）；UI 落点为单聊对方资料面板 —— `AccountStatusBadge.vue` 挂在 `SingleDetails.vue` 昵称行（能力不可用/机器人不占位），`MutualRoomsSection.vue` 挂在 `FriendDetailsSections.vue` 资料分区末尾（对方是自己或能力不可用时不渲染不请求），点击房间复用 `openMsgSessionByRoomId` | 新增 27 例（账号状态服务 / 关系服务 / 两个组件），相关 49 例通过 |
| AUTH-07 | P1 | 新增 `AdminCasService` + 页面 | **已完成**（2026-11-15 核实）：`src/services/matrix/admin/AdminCasService.ts` + `src/views/admin/AdminCas.vue`（含导航项与路由）+ `AdminCas.test.ts`，与 ADM-05 的 CAS 子域合并实现，未重复建服务 | 与 ADM-05 同一验收 |

##### CAP-03 / AUTH-01 落地记录（P1，完成）

CAP-03 与 AUTH-01 合并实施：OIDC/SAML 在 Matrix 中统一收敛为 `m.login.sso`，因此只做「一个 SSO 按钮」而非按协议各建入口。

| 维度 | 结论 | 落地内容 |
| :--- | :--- | :--- |
| 服务层 | 完成 | `MatrixAuthService.getSsoLoginFlow()` 返回 `{ supported, providers }`：flow 缺失/探测异常 ⇒ `supported=false`；flow 存在但无 `identity_providers` ⇒ `supported=true, providers=[]`；provider 只保留 `id` 非空项。`MatrixAuthService.buildSsoLoginUrl(redirectAfter, idpId)` 委托 SDK `getSsoLoginUrl`，不拼 URL；命名刻意避开 `getSsoLoginUrl`（W-04 守卫要求该名字只属于 `MatrixClientAuth`，而后者依赖已初始化客户端且不支持指定 IdP，登录前不可用） |
| 能力探测 | 完成 | `MatrixOidcService.probeAuthMetadata()` 走 SDK `getAuthMetadata()`（内部请求 `/_matrix/client/v1/auth_metadata`）；探测前 `await client.whenManagerExtensionsReady()`，因为 `getAuthMetadata` 依赖异步注入的 server-capabilities 扩展，未就绪会抛 `TypeError`。404/`M_UNRECOGNIZED` 统一按不支持 |
| UI 接线 | 完成 | 新增 `useSsoLogin`（`detect` 并发探测 flows + auth_metadata；`startSsoLogin` 桌面端复用 `open_cas_login_window` 回传 loginToken，其余环境 `openExternalUrl`）；`ThirdPartyLogin.vue` 新增 `ssoEnabled`/`ssoLogin` props 与内联 SVG 盾牌图标（stroke-width 1.5）；`Login.vue` 接入 `useSsoLogin` 与既有 `useSsoCallback`（优先消费 URL 上的 `loginToken`/`login_token`） |
| 降级 | 完成 | flows 与 `auth_metadata` 均不可用时 SSO 按钮不渲染，gitee/github/CAS 入口保持原样（无死按钮） |
| i18n | 完成 | `login.sso.label` / `login.sso.failed` 中英双语；typings 由 `pnpm gen:i18n` 生成，无手工维护 |
| 测试 | 完成 | `MatrixAuthService.sso.test.ts`：flow 缺失、无 IdP、脏 provider 过滤、探测异常、URL 委托共 5 例；`authMetadata.contract.test.ts`：真实 SDK + MSW，200 ⇒ `supported:true` 带 issuer/authorizationEndpoint，404 ⇒ `supported:false`；`ThirdPartyLogin.test.ts` 增 2 例（`ssoEnabled=false` 无入口、`true` 点击触发回调） |
| 门禁 | 通过 | `vue-tsc --noEmit` 0 错误；`pnpm test:run` 全量 11220 用例通过（含本次新增 13 例）；`pnpm check`、`check:ratchet`、`check:sdk-boundary`、`quality:no-raw-fetch`、`check:doc-coverage`、`check:doc-paths` 均通过 |

R1 结论：全程复用 SDK `getAuthMetadata` / `getSsoLoginUrl` 与既有 `MatrixAuthService.getLoginFlows`，未新增 `/_matrix` 字面量与裸请求。R3 结论：仅登录页桌面/移动共用组件，未引入 admin/AI 代码，移动端构建路径未受影响。

已知限制（留给 AUTH-02 阶段评估）：桌面端 SSO 复用 `open_cas_login_window`，该窗口只允许同源导航，外部 OIDC IdP 的 302 跳转会被拦截；当前仅对同源品牌（cas/saml）流程可用。

#### 12.4.3 ROOM（13 条）

| 编号 | 优先级 | 触点 | 改动要点 | 验收 |
| :--- | :--- | :--- | :--- | :--- |
| ROOM-01 | P0 | `ChatMain.vue:282`、`ChatBanners.vue`、`StickyTab.vue:163-171` | **已完成**（2026-11-15）：见下方「ROOM-01 落地记录」 | 服务层契约测试 + 组件测试；断言不再引用 `pinnedMessages` |
| ROOM-02 | P1 | `RoomDetailDrawer.vue` | **已完成**（2026-11-15）：见下方「ROOM-02 落地记录」 | 组件测试断言六面板可达 |
| ROOM-03 | P1 | `src/services/matrix/room/RoomFacade.ts:181-239` | **已完成**（2026-11-15）：见下方「ROOM-03 落地记录」 | 每个新方法一个委托测试 |
| ROOM-04 | P1 | `src/services/matrix/messaging/MatrixThreadApi.ts` | **已完成**（2026-11-15）：见下方「ROOM-04 落地记录」 | `pnpm vue-tsc --noEmit` 0 错误 |
| ROOM-05 | P1 | `ChatMain.vue:224-238`、`RoomBurnSettings.vue:75-96` | **已完成**（2026-11-15）：见下方「ROOM-05 落地记录」 | 组件测试覆盖失败路径 |
| ROOM-06 | P2 | `src/services/matrix/crypto/MatrixEncryptionService.ts:93` | **已完成**（2026-11-15 核实）：`getKeyRotationStatus()` 已实现，`KeyRotationDialog.vue` 已接线，消费方 `stores/domains/settings/encryption.ts:167` | `crypto/__tests__/MatrixEncryptionService.test.ts`（2 例）+ `EncryptionSettings.test.ts` 覆盖 `needsRotation` 真/假两分支 |
| ROOM-07 | P2 | `MatrixSearchService.searchRooms`、`useGlobalSearch` | **已完成**：`searchRooms()` 优先走 `getRoomManager().searchRooms`，服务端不可用/空结果时回退本地过滤 | `MatrixSearchService.test.ts`（18 例，含离线降级） |
| ROOM-08 | P2 | 通讯录搜索、我的房间 | **已完成**（2026-11-15）：`search_recipients`（`MatrixUserDirectoryService.searchRecipients` + 目录回退，接入通讯录/邀请/全局搜索）；`my_rooms` 服务层 `MatrixAccountService.getMyRooms()` 改为委托 SDK `getRoomManager().getMyRooms()`（404 或方法缺失降级 `getJoinedRooms()`，仅以 `httpStatus === 404` 判定）；新增 `MyRoomsDialog.vue`（join/invite/leave 分组、本地搜索、空/错/加载态、可刷新），入口挂在会话列表顶部工具栏，选中房间复用 `enterChat`，非会话房间兜底 `openMsgSessionByRoomId` | 新增 11 例（弹窗 8 + 挂载 3）+ 服务层 7 例；相关 28 例通过 |
| ROOM-09 | P2 | 房间管理页 | **已完成**（2026-11-15）：举报详情抽屉新增「刷新详情」（`getAdminReport`）与「查看扫描器」（`getScannerInfo`）；新增 `ReportScannerInfo.vue`（加载/空/错误/成功四态 + 重试）；SDK 无举报摘要端点，摘要辅助读取落为详情重读并在代码注释说明 | `ReportService.test.ts` +4、`ModerationAdminReportTab.test.ts` +3、`ReportScannerInfo.test.ts` 5 例 |
| ROOM-10 | P2 | 定时发送列表 | **已完成**（2026-11-15）：`MatrixDelayedEventsService.restart(delayId)` 复用 SDK `getDelayedEventsManager().restartScheduledDelayedEvent()`，写入成功后回读 `getScheduledDelayedEvent()` 返回重排后的真实延迟（回读失败按「状态未知」抛出，调用方刷新对齐）；`useDelayedMessages.restart()` 成功/失败均 `refresh()`；`DelayedMessagesModal.vue` 操作列新增「重置计时」按钮，经 `MsgInput.vue` 接线；i18n 新增 `actions.restart` / `feedback.restarted` / `feedback.restart_failed` | `MatrixDelayedEventsService.test.ts` + `useDelayedMessages.test.ts` + `DelayedMessagesModal.test.ts` 共 23 例通过 |
| ROOM-11 | P2 | 通话设置 | **已完成**（2026-11-15 核实）：`MatrixVoiceService.getRtcTransports()`（`:361`）委托 SDK `client.getVoiceManager().getRtcTransports()`（MSC4143，失败返回空对象）；`VoiceVideoSettings.vue:152` 消费并渲染 | `RtcTransports.test.ts` + `VoiceVideoSettings.test.ts` 覆盖有/无 transports 两分支 |
| ROOM-12 | P2 | 邀请流程 | **已完成**：一次性邀请领取后展示并可复制 `room_alias` | `OneTimeInviteDialog.test.ts`（2 例） |
| ROOM-13 | P3 | 空间公开目录等 | **已完成**（2026-11-15）：复用 `matrixSpaceService.searchSpaces/getPublicSpaces/getSpaceHierarchy/joinSpace/knockSpace`；新增 `PublicSpaceDiscoveryDialog.vue`（搜索/加载/空/错误态、加入或 knock 申请、子空间层级浏览），`SpaceViewHeader.vue` 增加 SVG 发现入口，`SpaceList.vue` 挂载并在 `joined` 后 `reloadSpaces()`；两个公开目录方法补可选 `throwOnError` | `PublicSpaceDiscoveryDialog.test.ts`（6 例）+ `SpaceViewHeader.test.ts` |

##### ROOM-01 落地记录（P0，完成）

| 项 | 状态 | 说明 |
| :--- | :--- | :--- |
| 协议端点 | 完成 | synapse-rust MSC4354 挂载在 `/_matrix/client/unstable/org.matrix.msc4354`：`GET /rooms/{roomId}/sticky_events`、`POST`（体为 `{events:[{event_type,event_id,sticky_duration_ms?}]}`）、`DELETE /rooms/{roomId}/sticky_events/{event_type}` |
| 服务层读 / 写 | 完成 | `RoomOperations` 复用 SDK `RoomManager` 的 `getStickyEvents` / `setStickyEvents`（不再自建读通道） |
| 服务层删除 | 完成 | SDK `RoomManager` **无 DELETE 封装**，R1 检索结论已登记在 `RoomOperations.clearStickyEvent` 注释；改为经唯一 authedRequest 适配器 `MatrixRequestHelper.safeDelete(path, undefined, { prefix })`，`RoomOperations` 不直接调用 `client.http.authedRequest` |
| 前缀治理 | 完成 | 不使用 `/_matrix` 字面量，统一拼 `${PREFIX_UNSTABLE}/org.matrix.msc4354`（`src/services/matrix/paths/prefixes.ts`），ratchet 计数不增 |
| 整表提交语义 | 完成 | 服务端按 `(user, event_type)` 覆盖、每类型仅一条，故 `setStickyEvent` 先读取当前表、按 `event_type` 合并后再整表 POST；取消需回查该记录 `event_type` 后 DELETE |
| 数据源切换 | 完成 | 新增 `src/composables/room/useStickyEvents.ts`；`ChatMain.vue` 的 `stickyEvents` 由 `pinnedMessageFlow.pinnedMessages` 改为 `stickyFlow.events`，`ChatBanners.vue` 改用 `StickyEventInfo` 类型，不再引用 `pinnedMessages` |
| 消息信息解析 | 完成 | 抽出 `src/composables/room/resolveMessageInfo.ts` 供 `useStickyEvents` 与 `usePinnedMessage` 共用，避免两份解析逻辑；`usePinnedMessage` 保留因 `ChatSidebar.vue` 仍在用 |
| `StickyTab` | 完成 | 按协议整表提交；列表项新增「取消粘性」DELETE 入口；最近 5 条 `m.room.message` 可提升为粘性事件 |
| 能力门控 | 完成 | 两处均按 `sticky-events` 判定：`ChatMain` 用 `canSetSticky`，`StickyTab` 在 unsupported/unknown 时只渲染 `sticky_unsupported` 只读提示、不发 GET；能力快照异步到达后补加载 |
| 刷新联动 | 完成 | 新增 `MittEnum.STICKY_EVENTS_CHANGED`，设置 / 清除后广播 `{roomId}`，`ChatMain` 仅在同房间时重新 `load()` |
| 测试 | 完成 | 新增 `useStickyEvents.test.ts`（过期过滤、缺省 eventType、非法输入、排序、失败容错、整表合并与 emit、DELETE）、`StickyTab.test.ts`（只读态 / 取消 / 提升 / 失败提示）、`RoomOperations.test.ts` 的 `clearStickyEvent` 契约（断言 URL、query 与 `prefix`）；`ChatMain` / `ChatBanners` / `StickyEventBanner` 既有用例改用 sticky 语义 |
| 门禁 | 通过 | `vue-tsc --noEmit` 0 错误；`check:sdk-boundary` 无新增违规（`authed-request=0`）；`check:ratchet` 21 = 基线 21；`quality:no-raw-fetch` 通过；相关 4 个测试文件 110 用例通过 |

R1 结论：读 / 写走 SDK `RoomManager`；DELETE 因 SDK 未封装而经既有 `MatrixRequestHelper` 适配器补齐，未新建平行 HTTP 客户端。R3 结论：未新增移动端 admin/AI 入口；仅改桌面房间详情与聊天头部，移动端构建路径未受影响。

##### ROOM-02 落地记录（P1，完成）

| 项 | 状态 | 说明 |
| :--- | :--- | :--- |
| Tab 结构 | 完成 | `RoomDetailDrawer.vue` 改为四 Tab（概览 / 成员 / 安全 / 高级），Hero 区域跨 Tab 常驻用于确认房间身份；Tab 按钮带 `role="tab"` + `aria-selected` + `data-testid="room-drawer-tab-*"`，面板容器 `role="tabpanel"` |
| 面板归属 | 完成 | 概览：`RoomDetailStats` / `RoomDetailLastMessage` / `RoomMetadataPanel`；成员：`RoomDetailMembers`；安全：`EventSignaturePanel` / `RoomEncryptedEventsPanel` / `RoomRetentionPanel`；高级：`RoomCapabilitiesPanel` / `RoomMessageQueuePanel` / `RoomDetailPinnedMessages` |
| 能力门控 | 完成 | 六个面板背后均为 synapse-rust 私有扩展端点，`TjgCapability` 无对应能力位，且 `MatrixRoomMetadataService` 等方法 catch 后返回 `{}`，无法从数据区分「端点不存在」与「无数据」。故只有 `EventSignaturePanel` / `RoomEncryptedEventsPanel` 依赖 E2EE，按 `useServerCapability().getCapabilityStatus('e2ee')` 门控：`unsupported` 时整块隐藏，`unknown` 仍展示（能力快照未加载时不误删入口） |
| Tab 可见性 | 完成 | `RoomRetentionPanel` 的保留策略与房间是否加密无关，故「安全」Tab 常驻；「概览 / 成员 / 高级」面板自带加载 / 空 / 错误 / 有数据四态，不整体隐藏，避免空 Tab |
| 懒挂载 | 完成 | 面板用 `v-if` 按激活 Tab 挂载，避免打开 Drawer 就并发触发 6 个扩展端点请求；切换房间时 `activeTab` 重置为概览 |
| 文案 | 完成 | `locales/zh-CN/room.json` / `locales/en/room.json` 新增 `room.detail.tab_overview|tab_members|tab_security|tab_advanced`，`pnpm gen:i18n` 重新生成类型 |
| 测试 | 完成 | 新增 `src/components/room/__tests__/RoomDetailDrawer.test.ts`（8 例）：默认概览、成员 / 高级 / 安全 Tab 内容、E2EE `supported` / `unsupported` / `unknown` 三态门控、逐 Tab 切换后六个能力面板全部可达、切换房间重置 Tab |
| 门禁 | 通过 | `vue-tsc --noEmit` 0 错误；`check:ratchet` 无新增（`hardcoded_radius=0`、`zh_literal_vue=0`）；`check:sdk-boundary` 156 = 基线 156；`quality:no-raw-fetch` 通过；`check:doc-coverage` / `check:doc-paths` 通过；`pnpm check` 通过；`pnpm test:run` 1000 文件 / 11228 用例全部通过 |

R1 结论：面板全部复用既有 `src/services/matrix/**` 服务（`MatrixRoomMetadataService`、`matrixRoomAccountDataService`、`RoomRetention` facade），未新建 HTTP / 协议实现；门控复用 `useServerCapability()`，未新增能力判定副本。R3 结论：本次仅改 `src/components/room/RoomDetailDrawer.vue` 及对应测试与文案，未引入移动端 admin/AI 入口；移动端房间详情保持精简，未引入「高级」Tab。剩余风险：六个扩展端点没有能力位，桌面端在非 synapse-rust 后端上会落到各面板的空状态，属既有服务层约定（`getRoomExternalIds` 注释已确立「端点不存在返回空」）。

##### ROOM-05 落地记录（P1，完成）

| 项 | 状态 | 说明 |
| :--- | :--- | :--- |
| 服务返回值 | 已确认 | `useBurnAfterRead().enableBurn/disableBurn` 本身返回 `Promise<boolean>`（失败已在 composable 内 catch 并返回 `false`），无需改服务层 |
| `ChatMain.handleBurnToggle` | 完成 | 删除静默空 catch，改为消费布尔返回值：`false` 时 `showFeedback(t('room.burn.update_failed'), 'error')` 且**不更新** `burnEnabled`，避免开关与服务端配置漂移 |
| `ChatMain.handleBurnDurationChange` | 完成 | 已开启时先调服务再落状态：失败回滚 `burnDuration` 到旧值并提示；未开启时只更新本地选择（无服务请求） |
| `RoomBurnSettings.handleToggle` | 完成 | `try/finally` 补为消费布尔结果：失败提示并保持原开关状态，成功后才 `enabled = val` 并 `loadState()` |
| `RoomBurnSettings.handleDurationChange` | 完成 | 失败回滚 `durationSeconds` 并提示；成功才 `loadState()` 对齐服务端 |
| 文案 | 完成 | `locales/zh-CN/room.json` / `locales/en/room.json` 新增 `room.burn.update_failed` |
| 测试 | 完成 | `RoomBurnSettings.test.ts` 新增 2 例：开关失败保持关闭并提示、已开启时改时长失败回滚原值；`ChatMain.test.ts` 29 例保持通过 |
| 门禁 | 通过 | `vue-tsc --noEmit` 0 错误；`pnpm check` 通过；`check:ratchet` / `check:sdk-boundary`（156 = 基线）/ `quality:no-raw-fetch` 通过；`pnpm test:run` 1000 文件 / 11230 用例全部通过 |

R1 结论：直接消费 composable 既有布尔返回，未新增服务方法或平行实现。R3 结论：仅改桌面聊天主区与房间设置组件，移动端未引入 admin/AI 入口。

##### ROOM-04 落地记录（P1，完成）

| 项 | 状态 | 说明 |
| :--- | :--- | :--- |
| 调用点盘点 | 完成 | 对 `MatrixThreadApi` / `MatrixThreadService` 全部公开方法在 `src/` 全量检索，实际 UI 调用点只有 6 个（`getRoomThread` / `getThreadReplies` / `freezeThread` / `unfreezeThread` / `muteThread` / `subscribeToThread`，均由 `ThreadPanel.vue` 使用），与文档「15 个零 UI 调用方法」一致 |
| 接线（有用） | 完成 | 4 个有产品价值的方法接入线程面板：`getThreadStatsViaApi`（打开面板即拉回复数 / 参与人数，替换原先只显示本地条数）、`markThreadReadViaApi`（回复列表加载完以最后一条的回执标记已读）、`deleteRoomThreadViaApi`（头部删除线程，确认后关闭面板）、`redactThreadReplyViaApi`（仅本人回复显示「撤回」入口，避免越权） |
| 删除（无用） | 完成 | 11 个零调用方法连同委托一并删除，不留死代码：`getGlobalThreadList` / `createGlobalThread` / `getSubscribedThreads` / `getGlobalUnreadThreads` / `createRoomThread` / `getRoomThreadList` / `searchRoomThreads` / `getRoomUnreadThreads` / `addThreadReply` / `unsubscribeFromThread` / `getLegacyRoomThreadList`；`MatrixThreadService` 对应委托同步移除，`DEFAULT_PAGE_LIMIT` / `DEFAULT_SEARCH_LIMIT` 引用随之清理 |
| 保留方法 | 完成 | `MatrixThreadApi` 保留 10 个：上文 6 个 + 新增接线的 4 个；文件头校准注释精简为「嵌套返回」「未读回执」两条，并注明「无 UI 调用点的列表/创建/订阅类方法已移除（ROOM-04）」 |
| 失败语义 | 完成 | 统计接口不可用返回 `null`，面板回落到本地 `threadReplies.length`，阻断渲染；删除 / 撤回失败 `showFeedback` 并保留原状态（删除失败不关闭面板，撤回失败不刷新列表）；`markThreadRead` 在 manager 缺该方法时返回 `null`，不阻断列表 |
| 文案 | 完成 | `locales/zh-CN/thread.json` / `locales/en/thread.json` 新增 `thread.participants` / `thread.delete` / `thread.delete_confirm` / `thread.delete_success` / `thread.delete_failed` / `thread.redact` / `thread.redact_confirm` / `thread.redact_success`，沿用既有 `thread.action_failed`；`pnpm gen:i18n` 重新生成类型（6208 key paths） |
| 图标与 token | 完成 | 删除按钮图标用 `<svg><use href="#delete" /></svg>`（线宽沿用既有图标集）；新增样式只用 `--tjg-*` token，未新增硬编码颜色 |
| 测试 | 完成 | `ThreadPanel.test.ts` 新增 8 例（统计加载、统计不可用回落、最后一条标记已读、空回复不标记、删除成功关闭面板、删除失败保留面板、本人回复可撤回且刷新、撤回失败提示不刷新）→ 18 例；`MatrixThreadApi.test.ts` 删除 11 组对应用例 → 28 例；`MatrixThreadService.test.ts` 同批删除 → 14 例；三文件 60 用例全过 |
| 门禁 | 通过 | `vue-tsc --noEmit` 0 错误；`pnpm check` 通过（biome 2784 文件、i18n 完整性、token 使用率 100%、icon-aria 552 / svg-aria 584 / dead-handlers 1585、capabilities-sync 7 项一致） |

R1 结论：新增接线全部复用既有 `MatrixThreadService` → `MatrixThreadApi` → `getThreadingManager()` 三层委托，未新增任何 HTTP 或协议实现，也未在组件内直连 SDK。R3 结论：改动集中在 `src/services/matrix/messaging/**` 与桌面线程面板、文案与类型声明，`src/mobile/**` 未引用线程面板与 admin/AI 模块，移动端产物无新增入口。

##### ROOM-03 落地记录（P1，完成）

| 项 | 状态 | 说明 |
| :--- | :--- | :--- |
| 门面现状盘点 | 完成 | `MatrixRoomReadFacade` 已覆盖 29 个读接口（状态、别名、置顶/粘性、邀请名单、标签、摘要、时间线、账号数据、子服务域服务器等），每个方法均已有委托测试；缺口在第三层——7 处面板/composable 仍直接 import 子服务单例，绕过门面 |
| 补齐读接口 | 完成 | `MatrixRoomReadFacade` 新增 5 个房间扩展端点读方法：`getAntiScreenshot` / `getMessageQueue` / `getEncryptedEvents` / `signEvent` / `verifyEvent`；`MatrixRoomActionFacade` 补 1 个写方法 `setAntiScreenshot`，全部一对一委托既有 `AccountDataService` |
| 三层落位 | 完成 | 消费方统一改为门面调用：`useRoomAntiScreenshot.ts`（读+写）、`EventSignaturePanel.vue`（签名/验签）、`RoomMessageQueuePanel.vue`、`RoomEncryptedEventsPanel.vue`、`RoomMetadataPanel.vue`、`RoomCapabilitiesPanel.vue`、`useRoomUpgradeFlow.ts`（版本读取） |
| 测试 | 完成 | `ReadFacade.test.ts` 39→45 例（新增 5 个委托 + 1 个错误透传）、`ActionFacade.test.ts` 39→40 例（`setAntiScreenshot` 委托）；受影响消费方测试 6 文件 28 例未改断言仍全过（门面委托仍命中原子服务，mock 语义不变） |
| 门禁 | 通过 | `vue-tsc --noEmit` 0 错误 |

R1 结论：门面只做委托，未新写任何 HTTP 调用或协议逻辑；所有端点仍落在既有 `AccountDataService`（SDK manager extensions 封装）。R3 结论：仅涉及 `src/services/matrix/room/**` 与桌面房间面板/composable，未触碰移动端与 admin/AI 模块。

#### 12.4.4 ADM（12 条，仅桌面端）

| 编号 | 优先级 | 触点 | 改动要点 | 验收 |
| :--- | :--- | :--- | :--- | :--- |
| ADM-01 | P1 | 新增 `AdminServerNotificationService` + 页面 Tab | **已完成**（2026-11-15）：见下方「ADM-01 落地记录」 | 契约测试 + 页面测试 |
| ADM-02 | P1 | `AdminModules.vue` | **已完成**（2026-11-15）：见下方「ADM-02 落地记录」 | 组件测试覆盖空态与失败态 |
| ADM-03 | P1 | 新增 `views/admin/AdminExternalServices.vue` + composable + 路由 + 菜单 | **已完成**（2026-11-15）：见下方「ADM-03 落地记录」 | 路由可达 + 方法调用测试 |
| ADM-04 | P1 | `/reports` 3 条 | **已完成**（2026-11-15）：见下方「ADM-04 落地记录」；`event_reports` 未改动 | 回归测试 |
| ADM-05 | P1 | 10 个子域 33 条 | **部分完成**（2026-11-15）：a/b/c 三组（vendor 房间级邀请名单 + CAS）分别见下方「ADM-05 组 a / 组 b / 组 c 落地记录」。**订正（2026-11-18 回源）**：admin 全局邀请名单 8 条端点（`/_synapse/admin/v1/invite/{allowlist,blocklist}` 及单用户增删）在 Tjg 仍 **0 命中**，`AdminInvitePolicy.vue` 仍是房间 ID 输入；SDK 侧 8 个方法已封装（`admin-config-manager.ts:990/1004/1023/1038/1068/1092/1115/1137`），属纯前端接线缺口 | 每组独立验收；全局名单待接（见 §19.74） |
| ADM-06 | P1 | 6 个子域已有方法 | **已完成**（2026-11-15）：见下方「ADM-06 落地记录」 | 每方法至少一个页面调用断言 |
| ADM-07 | P1 | `useAdminServerLogs.ts` | **已完成**（2026-11-15）：见下方「ADM-07 落地记录」 | 失败态组件测试 |
| ADM-08 | P2 | 配额 | **已完成**（2026-11-15）：`useQuotaStore` 增加 `serverQuota` / `fetchServerQuota()` / `fetchAllQuota()`（四项并行、单项失败不阻塞）；新增 `MediaQuotaPanel.vue` 并挂到 `AdminMedia.vue` 的「配额」tab，用户侧配额（status/stats/alerts）与服务端总量（`getServerQuota`）统一口径 | `MediaQuotaPanel.test.ts`（4 例）+ `admin/__tests__/quota.test.ts`（新增 server/fetchAll 用例） |
| ADM-09 | P2 | 遥测页面 | **已完成**（2026-11-15）：`AdminTelemetry.vue` 调度器补齐 5 个计数（`services_capacity_limited` / `services_with_pending_transactions` / `total_backoff_count` / `total_capacity_limited_count` / `total_in_flight_count`）；状态区新增健康检查 `checks` 与 `database` 两块明细（`recordEntries` + `formatValue` 渲染任意嵌套值）；告警表补 `owner` / `trigger_count` / `last_seen_ts` 三列（时间戳走 `formatTs`），表格 `:scroll-x="1180"` | `AdminTelemetry.test.ts` 新增用例断言 5 个计数、健康检查明细与三个新列 |
| ADM-10 | P2 | 写操作 | **已完成**（2026-11-15）：`useAdminAccountPolicy` 的 `setValidity` / `renewValidity` 写后统一经 `refreshValidity()` 回读服务端状态，写响应仅作回读失败兜底；`createProvider` 原有刷新保留 | `useAdminAccountPolicy.test.ts`（13 例，新增回读成功/失败 2 例） |
| ADM-11 | P2 | 30+ admin 方法 | **第一批已完成**（2026-11-15）：A 用户处置（`evictUser`/`logoutUserAll`/`loginUserAs`/`batchCreateUsers`/`getUserById`/`getUserStatsList`/`checkUserAdmin`）、B 房间治理（`getRoomBlockStatus`/`blockRoom`/`unblockRoom`/`getRoomStats`/`getRoomListings`/`setRoomPublicListing`/`getRoomEventContext`/`searchInRoom`/`getRoomForwardExtremities`）、C 保留策略（房间级读/存/删 + 默认策略读取）三组接线完成；其余零消费方法按决策**保留不删**，清单见下方落地记录 | 5 文件 82 例通过（新增 38） |
| ADM-12 | P2 | 联邦页 | **已完成**（2026-11-15）：`FederationDestination` 补 `failureCount/status/updatedTs` 映射；服务层新增 `getFederationCache/clearFederationCache/deleteFederationCacheEntry/getPendingFederationServers/confirmFederation`（经 `adminFederationService` 暴露，未改动 baseline 锁定的门面）；`useAdminFederation` 增 cache/pending 状态与动作；新增 `FederationCachePanel.vue`、`FederationPendingPanel.vue` 并在 `AdminFederation.vue` 加两个 tab | 4 文件 41 例通过（新增 27） |

##### ADM-11 落地记录（第一批完成，其余保留）

第一批接线范围（2026-11-15）：

| 组 | 方法 | 落点 |
| :--- | :--- | :--- |
| A 用户处置 | `evictUser`、`logoutUserAll`、`loginUserAs`、`batchCreateUsers`、`getUserById`、`getUserStatsList`、`checkUserAdmin` | `AdminUserActionsPane.vue`（二次确认 + 后果说明）、`AdminUsersBatchCreateDrawer.vue`（批量解析 + 逐条结果）、`AdminUserDetailDrawer.vue`「服务端信息」页签 |
| B 房间治理 | `getRoomBlockStatus`、`blockRoom`、`unblockRoom`、`getRoomStats`、`getRoomListings`、`setRoomPublicListing`、`getRoomEventContext`、`searchInRoom`、`getRoomForwardExtremities` | `AdminRooms.vue` 新增「治理」页签 + `AdminRoomGovernancePanel.vue` |
| C 保留策略 | 房间级 `getRoomRetention` / `setRoomRetention` / `deleteRoomRetention`、`getDefaultRetention` | `AdminRetention.vue`（删除二次确认，写后回读） |

已知限制：`setRoomPublicListing` 服务层只做「发布到公开目录」单向动作（忽略取消发布布尔值）；`getUserStatsList` 为聚合单条，仅展示首条。

其余零消费方法（2026-11-15 扫描；按用户决策保留不删，后续有页面需求时再接线）：

| 分类 | 方法 |
| :--- | :--- |
| 完全无消费（Facade 亦未接线） | `AdminApiProbeService.isAvailable`；`AdminModerationService.getReports`；`ApplicationService.listApplicationServices` / `registerApplicationService`；`BackgroundUpdateService.completeUpdate` / `createUpdate` / `deleteUpdate` / `failUpdate` / `getHistory` / `getUpdate`；`ExternalServiceService.getServiceHealth`；`SecurityService.getExperimentalFeatures` / `getIpReputation` / `getSamlMapping` / `samlLogout`；`ServerService.getServerLogs` |
| Facade 已接线但无 UI 消费 | `AdminApiProbeService.getAdminManager`；`AdminModerationService.onModerationEvent` / `offModerationEvent` / `stopModeration`；`FederationService.getFederationDestination`；`RegistrationTokensService.list`；`ReportService.reportEvent` / `reportRoom` |


##### ADM-02 落地记录（P1，完成）

| 项 | 状态 | 说明 |
| :--- | :--- | :--- |
| 现状盘点 | 完成 | `AdminModules.vue` 原为纯展示组件：`modules` / `loading` 由 props 传入且默认为空数组，但页面作为路由入口无父级传参，列表恒为空；`view-detail` emit 无监听者，属死代码 |
| 服务补齐 | 完成 | 新增 `src/services/matrix/admin/ModuleService.ts`：`AdminModuleService extends BaseMatrixService`，`listModules({ limit, from })` 一对一复用 `getAdminManager().listModules`（游标分页 `next_batch`），将 `AdminModuleInfo` 映射为 `AdminModuleItem` 并派生 `loaded` / `unloaded` / `failed` 三态；未新增任何 HTTP 或协议实现 |
| composable | 完成 | 新增 `src/composables/admin/useAdminModules.ts`：`modules` / `loading` / `error` / `hasMore` + `loadModules({ append })` / `loadMore()`；失败清空列表与游标，供页面做重试 |
| 页面接线 | 完成 | 页面去除 props 与死 emit，改 `onMounted` 自取数；新增错误 `n-alert` + 重试按钮（`data-testid="modules-error"` / `modules-retry`），空态仅在无错误时展示，`v-for` key 改为 `module.id`，移除误导性的 `cursor: pointer` |
| 门面约束 | 完成 | `AdminFacadeService.ts` 受 `meta/file-size-baseline.json` 只缩不增约束，故能力以独立服务 + `admin/index.ts` 再导出落地，仍位于 `src/services/matrix/**` 内 |
| 测试 | 完成 | `AdminModules.test.ts` 重写为 8 例（挂载拉取、加载中、空态、失败态、重试二次拉取、四态过滤、状态点无内联样式、`role=region`）；新增 `ModuleService.test.ts` 4 例（默认分页、游标与三态派生、空载荷、错误透传） |
| 门禁 | 通过 | `vue-tsc --noEmit` 0 错误；`pnpm check`、`check:ratchet`、`check:sdk-boundary`、`quality:no-raw-fetch`、`check:doc-coverage`、`check:doc-paths`、`pnpm test:run` 全绿 |

R1 结论：模块列表能力直接消费 SDK `AdminManager.listModules`，未在 `src/services/matrix/**` 之外另起实现。R3 结论：仅涉及桌面 admin 视图、composable 与 admin 服务域，`src/mobile/**` 无引用，移动端产物无新增入口。

##### ADM-03 落地记录（P1，完成）

| 项 | 状态 | 说明 |
| :--- | :--- | :--- |
| 现状盘点 | 完成 | 后台仅有 `AdminApplicationService`（应用服务），外部服务（TrendRadar / OpenClaw / Webhook 等）的 7 条端点已由 `AdminExternalServiceService` 封装，但无任何 UI 入口，能力闲置 |
| 服务复用 | 完成 | 不新增服务实现，直接消费 `adminService.externalServices` 的 `listServices` / `registerService` / `updateService` / `deleteService` / `getAllHealth` / `checkServiceHealth`；仅在 `admin/index.ts` 补 `ExternalService` / `ExternalServiceHealth` 类型再导出 |
| composable | 完成 | 新增 `src/composables/admin/useAdminExternalServices.ts`：`services` / `healthMap`（按 `service_id` 索引）/ `loading` / `error` / `serviceType` / `checkingId` / `mutating` + `loadServices` / `registerService` / `setEnabled` / `checkHealth` / `removeService`；注册时剔除空白可选字段，开关用返回值回填实体 |
| 页面接线 | 完成 | 新增 `src/views/admin/AdminExternalServices.vue`：类型过滤、列表行（名称/类型/健康/`last_check`/`last_error`）、行内启停与健康检查、注销二次确认、注册弹窗；错误态 `load-error` + 重试，空态 `empty-state` |
| 路由与菜单 | 完成 | `router/routes/desktop.ts` 新增 `/admin/external-services`（`AdminExternalServices`，`requiresAdmin`）；`useAdminNav.ts` 系统分组新增条目；`adminNavIcons.ts` 新增 `externalServices` 图标（24x24、stroke 2、currentColor） |
| i18n | 完成 | 新增 `admin.nav.externalServices` 与 `admin.externalServices.*`（20 键），中英同步；`pnpm gen:i18n` 已重新生成类型 |
| 测试 | 完成 | `useAdminExternalServices.test.ts` 8 例（默认全量拉取并合并健康状态、类型透传、失败清空、注册字段裁剪、注册失败、开关回填、健康检查 `checkingId`、注销后重拉）；`AdminExternalServices.test.ts` 8 例（渲染、空态、错误态与重试、过滤、开关、健康检查、注销、注册提交） |
| 门禁 | 通过 | `vue-tsc --noEmit` 0 错误；`pnpm check`、`check:ratchet`、`check:sdk-boundary`、`quality:no-raw-fetch`、`check:doc-coverage`、`check:doc-paths`、`pnpm test:run`（1003 个文件）全绿 |

R1 结论：外部服务能力全部来自既有 `AdminExternalServiceService`（`getAdminManager().externalService`），本次只补 UI 与类型再导出，未新增 HTTP 或协议实现。R3 结论：新增文件仅位于桌面 `src/views/admin/**` 与 `src/composables/admin/**`，`src/mobile/**` 无 import，移动端不产出 admin 路由与菜单。

##### ADM-07 落地记录（P1，完成）

| 项 | 状态 | 说明 |
| :--- | :--- | :--- |
| 现状盘点 | 完成 | `AdminServerLogs.vue` 标题为「服务器日志」，实际渲染的是状态、健康、版本、统计四类面板；`Promise.allSettled` 失败后仅置 `null`，用户无从得知是空数据还是请求失败 |
| 文案对齐 | 完成 | 按「改名对齐内容」处理：`admin.logs.title` 改为「服务状态」/「Service Status」，`subtitle` 与 `panel_notice` 同步为运行状态与健康检查口径，不新增后端日志端点 |
| 逐项失败态 | 完成 | `useAdminServerLogs` 新增 `errors: AdminServerPanelErrors` 与 `failedCount`，按 `allSettled` 的 `rejected` 逐项置位；页面新增整体 `warning` 提示（`data-testid="partial-failed"`）+ 四张卡片各自的「暂不可用」占位（`data-testid="unavailable-*"`） |
| i18n | 完成 | 新增 `admin.logs.partial_failed`（`{count}` 插值）与 `admin.logs.item_unavailable`，中英同步；`pnpm gen:i18n` 已重新生成类型 |
| 测试 | 完成 | `useAdminServerLogs.test.ts` 3→4 例（逐项 error 与 `failedCount`，成功面板不被失败项清空）；`AdminServerLogs.test.ts` 新增 1 例（单项失败展示汇总提示与占位、其余面板正常渲染） |
| 门禁 | 通过 | 同 ADM-02 门禁链，全绿 |

R1 结论：仅消费既有 `adminService.getServerStatus/Health/Version/Stats`，未新增端点。R3 结论：改动限定在桌面 admin 服务状态页、composable 与文案，移动端无 admin 入口。

##### ADM-04 落地记录（P1，完成）

| 项 | 状态 | 说明 |
| :--- | :--- | :--- |
| 现状盘点 | 完成 | `/reports` 3 条（`listReports` / `listRoomReports` / `getReport` + `deleteReport`）已由 `AdminReportService` 封装，但零 UI 消费者；现有 `event_reports` tab 基于 `MatrixEventReportService`，按方案要求**未改动** |
| 服务复用 | 完成 | 不新增服务实现，页面直连 `adminService.reports.getAdminReports` / `getAdminReport` / `dismissReport`（子域服务重载带 `throwOnError`，与既有 `adminService.security.*` 调用约定一致）；门面同名方法不带 `throwOnError` 且吞异常，故不走门面 |
| 页面接线 | 完成 | 新增 `src/views/admin/ModerationAdminReportTab.vue`：房间 ID 过滤输入 + 刷新；表格列 ID / 房间 / 事件 / 被举报用户 / 原因 / 状态 / 举报时间 / 操作；行内「详情」（抽屉展示原因、评分、正文）与「驳回」（二次确认）；错误态 `admin-report-error` + 重试，空态 `admin-report-empty` |
| 分区隔离 | 完成 | `ModerationPanel.vue` 在 `event-reports` 之后新增 `admin-reports` tab（「服务端举报」），与事件举报语义分区；`ModerationEventReportTab` 未做任何改动 |
| i18n | 完成 | 新增 `moderation.admin_reports.*`（title/hint/表格列/详情/确认与提示共 25 键），中英同步；`pnpm gen:i18n` 已重新生成类型 |
| 测试 | 完成 | `ModerationAdminReportTab.test.ts` 7 例（默认参数拉取并渲染、空态、错误态与重试、房间 ID 过滤、详情抽屉、驳回成功后重拉、驳回失败不重拉也不刷新） |
| 门禁 | 通过 | `vue-tsc --noEmit` 0 错误；`pnpm check`、`check:ratchet`、`check:sdk-boundary`、`quality:no-raw-fetch`、`check:doc-coverage`、`check:doc-paths`、`pnpm test:run`（1004 个文件 / 11219 例）全绿 |

R1 结论：举报数据全部来自既有 `AdminReportService`（`getAdminManager().listReports` 等），本次只补 UI 与文案，未新增 HTTP 或协议实现。R3 结论：新增文件位于桌面 `src/views/admin/**`，`ModerationPanel` 仅桌面 admin 页面引用，`src/mobile/**` 无 import，移动端不产出 admin 入口。

##### ADM-01 落地记录（P1，完成）

| 项 | 状态 | 说明 |
| :--- | :--- | :--- |
| 现状盘点 | 完成 | 7 条系统通知端点（`sendServerNotice` / `getServerNotices` / `createNotification` / `listNotifications` / `getNotification` / `updateNotification` / `deleteNotification`）此前与用户通知设置、pushers 混在 `AdminNotificationService`；门面另有 5 个同名 wrapper 零 UI 消费者 |
| 服务拆分 | 完成 | 新增 `src/services/matrix/admin/AdminServerNotificationService.ts`（7 方法，统一 SDK 子集类型并归一化为 `SystemNotificationInfo`）；`NotificationService.ts` 收缩为用户级 4 方法（设置读写 / pushers 列表与删除），职责边界写进类注释 |
| 门面接线 | 完成 | `AdminFacadeService` 新增 `serverNotifications` 字段并委托 `sendServerNotice` / `getServerNotices`；删除 `AdminFacadeOpsMethods.ts` 中 5 个无消费者的系统通知 wrapper；`AdminFacadeService.ts` 保持 537 行基线不增长 |
| 页面接线 | 完成 | 新增 `src/views/admin/AdminServerNotificationTab.vue`：列表（内容/类型/目标数/创建时间/操作）+ 新建/编辑抽屉（内容、类型、逗号分隔目标用户）+ 行内删除二次确认，含错误态与空态；`AdminNotifications.vue` 在 `pushers` 之后新增 `server` tab，与「通知设置」「推送器」分区 |
| composable | 完成 | 新增 `useAdminServerNotifications`：`loadNotifications` / `loadDetail` / `createNotification` / `updateNotification` / `removeNotification`，写后统一回读列表，目标用户去空并空数组降级为 `undefined` |
| i18n | 完成 | 新增 `admin.notifications.server.*`（tab/hint/表单/表格列/操作与提示共 35 键），中英同步；`pnpm gen:i18n` 已重新生成类型 |
| 测试 | 完成 | `AdminServerNotificationService.test.ts` 8 例（发送/列表映射与降级、创建负载、归一化、详情空响应、更新与删除抛错）；`useAdminServerNotifications.test.ts` 7 例；`AdminServerNotificationTab.test.ts` 8 例（拉取渲染、空态、错误态、新建、空内容拦截、编辑先拉详情、删除刷新、删除失败）；`AdminFacadeService.test.ts` 系统通知 3 例改走 `adminService.serverNotifications.*` |
| 门禁 | 通过 | `vue-tsc --noEmit` 0 错误；`pnpm check`、`check:ratchet`、`check:sdk-boundary`、`quality:no-raw-fetch`、`check:doc-coverage`、`check:doc-paths`、`pnpm test:run`（1007 个文件 / 11237 例）全绿；`check:file-size` 仅剩 3 个既有超标文件（`RoomDetailDrawer.vue` / `RoomOperations.ts` / `ChatMain.vue`，工作区未改动，非本批次引入） |

R1 结论：7 条端点全部复用既有 SDK `getAdminManager()` 能力，仅做服务分层与页面接线，未新增 HTTP 或协议实现。R3 结论：新增服务、composable、页面均只被桌面 admin 路径引用，`src/mobile/**` 无 import，移动端不产出 admin 入口与代码。

##### ADM-05 组 a 落地记录（P1，完成）

| 项 | 状态 | 说明 |
| :--- | :--- | :--- |
| 现状盘点 | 完成 | 组 a 的 8 条端点（`account_validity` 3 条、`password_auth_providers` 2 条、`policy/status` 与 `policy/check` 各 1 条、`rate-limit-status` 1 条）SDK 子管理器均已具备，但服务层零封装、前端零消费者 |
| 服务层 | 完成 | 新增 `src/services/matrix/admin/AccountPolicyService.ts`：`AccountValidityService` / `PasswordAuthProviderService` / `PolicyServerService` / `RateLimitStatusService` 四个 standalone 服务与对应单例，全部走 `this.getManager()` 的 `config` / `policy` / `server` 子管理器；类型经 `Parameters<>` / `Awaited<ReturnType<>>` 从 SDK 子管理器派生，不复制协议结构 |
| SDK 边界 | 完成 | `src/services/matrix/sdk.ts` 增补 `AdminConfigManager` / `AdminServerManager` / `PolicyCheckRequest` / `PolicyCheckResponse` / `PolicyServerStatus` 类型再导出，服务只从本仓唯一咽喉点取类型，`check:sdk-boundary` 维持 156 条基线不增长 |
| composable | 完成 | 新增 `src/composables/admin/useAdminAccountPolicy.ts`：有效期（查询/设置/续期）、提供方（列表/新建，成功后自动回读）、策略（状态/检查）、限流（状态）四组状态与动作，写操作统一返回 `boolean` 并落 `toMessage` 文案 |
| 页面接线 | 完成 | 新增 `src/views/admin/AdminAccountPolicy.vue`（4 tab）：有效期查询卡片与设置/续期表单、认证提供方表格（启用态 `NTag`）与内联新建（JSON 配置校验必须为对象）、策略状态与检查表单及结果提示、限流状态与 7 项指标网格；四块各自错误横幅与空态 |
| 路由与菜单 | 完成 | `router/routes/desktop.ts` 新增 `/admin/account-policy`（`adminAccountPolicy`，`requiresAdmin`）；`useAdminNav.ts` 系统分组新增条目；`adminNavIcons.ts` 新增 `accountPolicy` 图标（SVG 24x24、stroke 1.5 口径路径） |
| i18n | 完成 | 新增 `admin.nav.accountPolicy` 与 `admin.accountPolicy.*`（tab/表单/表格/指标与提示共 60+ 键），中英同步；`pnpm gen:i18n` 已重新生成类型 |
| 测试 | 完成 | `AccountPolicyService.test.ts` 12 例（8 条端点参数透传/返回值/失败重抛）；`useAdminAccountPolicy.test.ts` 11 例（成功写入、失败文案、新建后回读）；`AdminAccountPolicy.test.ts` 9 例（挂载并发加载、有效期查询与设置续期校验、提供方 JSON 校验与重置、策略检查、四块错误态、刷新按钮） |
| 门禁 | 通过 | `vue-tsc --noEmit` 0 错误；`pnpm check`、`check:ratchet`、`check:sdk-boundary`、`quality:no-raw-fetch`、`check:doc-coverage`、`check:doc-paths`、`pnpm test:run`（1010 个文件 / 11269 例）全绿；`check:file-size` 仅剩 4 个既有超标文件（`RoomDetailDrawer.vue` / `RoomOperations.ts` / `ChatMain.vue` / `MatrixCapabilityService.ts`，工作区既有改动，非本批次引入） |

R1 结论：8 条端点全部复用 SDK `AdminManager` 的 `config` / `policy` / `server` 子管理器，仅补服务分层、composable 与页面，未新增 HTTP 或协议实现。R3 结论：新增服务、composable、页面、路由与菜单均只作用于桌面 admin 路径，`src/mobile/**` 无 import，移动端不产出 admin 入口与代码；组 b、组 c 见下条记录。

##### ADM-05 组 b 落地记录（P1，完成）

| 项 | 状态 | 说明 |
| :--- | :--- | :--- |
| 现状盘点 | 完成 | 组 b 的 12 条端点（`callbacks` 5 条、`cleanup` 3 条、`push` 4 条）SDK 子管理器已具备，服务层与前端均零封装 |
| 服务层 | 完成 | 新增 `AdminCallbackService.ts`（媒体回调列表/按类型查询/创建 + 账户数据回调列表/创建）、`AdminCleanupService.ts`（`cleanup.all` / `cleanup.rooms` / `cleanup.tokens`）、`AdminPushService.ts`（配置读/写、队列消费、日志清理）；类型经 `Parameters<>` / `Awaited<ReturnType<>>` 从 SDK 子管理器派生，不复制协议结构 |
| SDK 边界 | 完成 | `src/services/matrix/sdk.ts` 增补 `AdminCleanupManager` / `AdminPushManager` 类型再导出；服务只从本仓唯一咽喉点取类型，`check:sdk-boundary` 基线不增长 |
| composable | 完成 | 新增 `useAdminCallbacks`（双域列表/新建，媒体类型过滤，账户数据 `dataTypes` 按逗号拆分且空数组不传键）、`useAdminCleanup`（三动作，`minAgeMs` 未填时不发送 `min_age_ms`）、`useAdminPush`（配置读写、队列消费、日志清理），写操作统一返回 `boolean` |
| 页面接线 | 完成 | 新增三页：`AdminCallbacks.vue`（媒体/账户数据双 tab）、`AdminPush.vue`（配置表、按键更新、队列消费、日志清理二次确认）、`AdminCleanup.vue`（三动作 `dialog.error` 二次确认 + 结果分派展示）；三者均含错误横幅与空态，破坏性操作强制二次确认 |
| 组件体量 | 完成 | 初版两页超 400 行，按 tab 拆为 `views/admin/callbacks/MediaCallbacksPanel.vue`、`callbacks/AccountDataCallbacksPanel.vue`，`views/admin/accountPolicy/` 四面板（有效期/提供方/策略/限流），壳文件只保留提示条与 tab 容器 |
| 路由与菜单 | 完成 | `router/routes/desktop.ts` 新增 `/admin/callbacks`、`/admin/push`、`/admin/cleanup`（均 `requiresAdmin`）；`useAdminNav.ts` 系统分组新增三条；`adminNavIcons.ts` 新增 `callbacks` / `push` / `cleanup` 图标（SVG 24x24、stroke 1.5 口径路径） |
| i18n | 完成 | 新增 `admin.nav.*` 3 键与根级 `admin.callbacks.*` / `admin.push.*` / `admin.cleanup.*`（含表格列与确认文案），中英同步；`pnpm gen:i18n` 已重新生成类型 |
| 测试 | 完成 | 9 个文件 46 例：`AdminCallbackService.test.ts` 6、`AdminCleanupService.test.ts` 5、`AdminPushService.test.ts` 5、`useAdminCallbacks.test.ts` 7、`useAdminCleanup.test.ts` 4、`useAdminPush.test.ts` 5、`AdminCallbacks.test.ts` 4、`AdminPush.test.ts` 6、`AdminCleanup.test.ts` 4 |
| 门禁 | 通过 | `vue-tsc --noEmit` 0 错误；`pnpm check`、`check:ratchet`、`check:sdk-boundary`、`quality:no-raw-fetch`、`check:doc-coverage`、`check:doc-paths`、`check:file-size`（本批次新增/改动文件全部达标）、`pnpm test:run`（1019 个文件 / 11315 例）全绿；同步刷新 `Tjg-SDK-集成架构与能力图谱-2026-10-08.md` 标记块计数（253 / 270 / 44） |

R1 结论：12 条端点全部复用 SDK `AdminManager` 的 `callbacks` / `cleanup` / `push` 子管理器，未新增 HTTP 或协议实现。R3 结论：新增服务、composable、页面、路由与菜单均只作用于桌面 admin 路径，`src/mobile/**` 无 import，移动端不产出 admin 入口与代码。

##### ADM-05 组 c 落地记录（P1，完成）

| 项 | 状态 | 说明 |
| :--- | :--- | :--- |
| 现状盘点 | 完成 | 组 c 的 9 条端点（invite 黑白名单 4 条、CAS services 5 条）SDK 子管理器均已具备，服务层与前端零消费者 |
| 服务层 | 完成 | 新增 `AdminInvitePolicyService.ts`（黑/白名单读取与整体替换）、`AdminCasService.ts`（服务列表/注册/删除、用户属性读取/单属性写入）；方法体只委托子管理器，失败统一 `logger.error` 后重抛，请求/响应类型经 `Parameters<>` / `Awaited<ReturnType<>>` 派生 |
| SDK 边界 | 完成 | SDK 的 package exports 未提供 `./cas` 与 `./invite-blocklist` 子路径，故在 `src/services/matrix/sdk.ts` 补 `MatrixClient` 类型导入并派生 `CasManager` / `InviteBlocklistManager`（`ReturnType<MatrixClient['getCasManager' \| 'getInviteBlocklistManager']>`），服务只从本仓唯一咽喉点取类型，`check:sdk-boundary` 维持 156 条基线 |
| composable | 完成 | 新增 `useAdminInvitePolicy`（房间维度双列表读取，两列表独立保存并以响应回填）与 `useAdminCas`（服务读取/注册/删除后自动回读；用户属性读取与单属性写入后回读列表） |
| 页面接线 | 完成 | 新增 `AdminInvitePolicy.vue`（房间 ID 读取 + 黑白名单 textarea 全量编辑保存，规避 POST 整体替换的读改写覆盖）与 `AdminCas.vue`（服务表格 + 注册表单 + 用户属性读取/写入），删除服务强制 `dialog.warning` 二次确认，两页均含错误横幅与空态 |
| 路由与菜单 | 完成 | `router/routes/desktop.ts` 新增 `/admin/invite-policy`、`/admin/cas`（均 `requiresAdmin`）；`useAdminNav.ts` 系统分组新增两条；`adminNavIcons.ts` 新增 `invitePolicy`（user-plus）与 `cas`（key）图标（SVG 24x24、Heroicons outline 口径） |
| i18n | 完成 | `admin.nav` 新增 `invitePolicy` / `cas`，新增根级 `admin.invitePolicy.*` 与 `admin.cas.*`，并补 `admin.common.delete`；中英同步，`pnpm gen:i18n` 已重新生成类型 |
| 测试 | 完成 | 6 个文件 32 例：`AdminInvitePolicyService.test.ts` 5、`AdminCasService.test.ts` 6、`useAdminInvitePolicy.test.ts` 4、`useAdminCas.test.ts` 7、`AdminInvitePolicy.test.ts` 4、`AdminCas.test.ts` 6 |
| 门禁 | 通过 | `vue-tsc --noEmit` 0 错误；`pnpm check`、`check:ratchet`、`check:sdk-boundary`（156 条基线不变）、`quality:no-raw-fetch`、`check:doc-coverage`、`check:doc-paths`、`pnpm test:run` 全绿；`check:file-size` 本批次新增/改动文件全部达标，仅剩 6 个既有超标项（`MatrixAuthService.ts` / `ThreadPanel.vue` / `MatrixCapabilityService.ts` 及 3 个基线漂移文件，均为工作区既存改动）；同步刷新能力图谱标记块计数（255 / 272 / 46） |

R1 结论：9 条端点全部复用 SDK `getInviteBlocklistManager()` / `getCasManager()`，未新增 HTTP 或协议实现；`sdk.ts` 只补类型再导出，仍是唯一 SDK 类型咽喉点。R3 结论：新增服务、composable、页面、路由与菜单均只作用于桌面 admin 路径，`src/mobile/**` 无 import，移动端不产出 admin 入口与代码。ADM-05 的 a/b/c 三组至此全部落地。

##### ADM-06 落地记录（P1，完成）

| 项 | 状态 | 说明 |
| :--- | :--- | :--- |
| 现状盘点 | 完成 | 6 个子域方法（account info/update、registration nonce/register、restart、server info、whois、purge_room）服务层均已具备，但用户详情抽屉只展示设备/限流/影子封禁，房间列表无 purge 入口，维护页无服务器信息与重启按钮 |
| 服务复用 | 完成 | 不新增服务实现，页面与 composable 直连既有 `adminService.getAccountInfo` / `updateAccountInfo` / `getWhois` / `getRegistrationNonce` / `adminRegister` / `getAdminInfo` / `restartServer` / `purgeRoom`；未新增 HTTP 或协议实现 |
| composable | 完成 | `useAdminUsers` 新增 `accountInfo` / `whois` / `registrationNonce` + `updateAccountInfo`（写后回读）/ `loadWhois` / `loadRegistrationNonce` / `registerWithNonce`；账户子域拆至 `useAdminUserAccount` 后由 `useAdminUsers` 组合展开，对外形状不变且单文件守住 400 行红线；`useAdminRooms` 新增 `purgeRoom`（成功后重拉列表）；`useAdminMaintenance` 新增 `serverInfo` / `restarting` + `loadServerInfo` / `restartServer`，`loadAll` 扩为三路 `allSettled` |
| 页面接线 | 完成 | `AdminUserDetailDrawer.vue` 新增「账户信息」与「Whois」两个 tab（账户信息可编辑并保存回读，Whois 只读展示），两 tab 抽为 `AdminUserAccountPanes.vue`、快捷操作抽为 `AdminUserActionsPane.vue`；`AdminUsers.vue` 新增 nonce 注册路径（先取 nonce 再注册），新建抽屉抽为 `AdminUsersCreateDrawer.vue`；`AdminRooms.vue` 危险操作区抽为 `AdminRoomDangerZone.vue` 并保留 purge 入口强制二次确认；`AdminMaintenance.vue` 新增服务器信息卡片与重启按钮（`dialog.warning` 二次确认） |
| 测试 | 完成 | `useAdminUsers.test.ts` 新增 5 例（selectUser 加载 accountInfo、updateAccountInfo 回读、loadWhois、loadRegistrationNonce、registerWithNonce）；`useAdminRooms.test.ts` 新增 1 例（purgeRoom 委托并重拉）；`useAdminMaintenance.test.ts` 新增 2 例（loadServerInfo 回填、restartServer 委托并复位 flag） |
| 门禁 | 通过 | `vue-tsc --noEmit` 0 错误；`pnpm check`、`check:ratchet`、`check:sdk-boundary`、`quality:no-raw-fetch`、`check:doc-coverage`、`check:doc-paths`、`pnpm test:run` 全绿 |

R1 结论：8 个方法全部为既有 `AdminManager` 能力的页面化接线，未新增平行实现。R3 结论：改动限定在桌面 admin 视图与 admin composable，`src/mobile/**` 无 import，移动端不产出 admin 入口与代码。

#### 12.4.5 VEN（3 条）

| 编号 | 优先级 | 触点 | 改动要点 | 验收 |
| :--- | :--- | :--- | :--- | :--- |
| VEN-01 | P1 | `src/services/matrix/media/MatrixVoiceService.ts` | **已完成**（2026-11-15）：见下方「VEN-01 落地记录」 | 服务层 + 组件测试 |
| VEN-02 | P1 | `MatrixPushService`、设置页 | **已完成**（2026-11-15）：见下方「VEN-02 落地记录」 | 契约测试 |
| VEN-03 | P1 | `AccountDataService.getExternalServices` | **已完成**（2026-11-15）：见下方「VEN-03 落地记录」 | 单测 + 页面测试 |

##### VEN-01 落地记录（P1，完成）

| 项 | 状态 | 说明 |
| :--- | :--- | :--- |
| 现状盘点 | 完成 | `MatrixVoiceService` 8 条端点（`getVoiceStats` / `getUserVoiceStats` / `getVoiceConfig` / `deleteVoice` / `getRoomVoiceList` / `getUserVoiceList` / `getVoiceContent` / `getRtcTransports`）全部零 UI 消费者，录音时长上限硬编码 60 秒 |
| 配置接线 | 完成 | `useVoiceRecordRust` 新增 `maxDuration`（默认 60 秒）+ `syncVoiceConfig()`：首次开始录音前拉取 `getVoiceConfig()` 并回填上限，失败仅 `logger.warn` 不阻塞录音；计时停止条件由 `currentTime === 59` 改为 `currentTime >= maxDuration - 1` |
| 设置页接线 | 完成 | 新增 `views/settingsWindow/tabs/sections/VoiceMessageSettings.vue`：统计卡片（`getVoiceStats` + `getUserVoiceStats`）、房间 ID 过滤（`getRoomVoiceList`，留空走 `getUserVoiceList`）、行内展开原始内容（`getVoiceContent`）、删除（`deleteVoice` 二次确认后重拉）；`VoiceVideoSettings.vue` 挂载 `VoiceMessageSettings` 并新增 RTC 传输卡片（`getRtcTransports` 遍历 key/value，空态占位） |
| i18n | 完成 | 新增 `setting.voice_video.rtc_section` / `rtc_empty` 与 `setting.voice_video.voice_messages.*`（含统计、列表列、删除确认与提示共 14 键），中英同步；`pnpm gen:i18n` 已重新生成类型 |
| 测试 | 完成 | 目标测试集 46 例全通过，覆盖语音消息列表/统计加载、房间过滤分支、内容展开与删除重拉、录音时长上限读取与回退 |
| 门禁 | 通过 | `vue-tsc --noEmit` 0 错误；`pnpm check`、`check:ratchet`、`check:sdk-boundary`、`quality:no-raw-fetch`、`check:doc-coverage`、`check:doc-paths`、`pnpm test:run` 全绿 |

R1 结论：8 条端点全部为既有 `MatrixVoiceService` 消费者接线，未新增 HTTP 或协议实现。R3 结论：改动位于语音服务域、录音 composable 与设置页，未触碰 admin/AI 模块，`src/mobile/**` 无新增引用。

##### VEN-02 落地记录（P1，完成）

| 项 | 状态 | 说明 |
| :--- | :--- | :--- |
| 现状盘点 | 完成 | `push/devices`（列表/注册/注销）与 `push/send` 共 4 条端点 SDK `NotificationsManager` 已具备，`MatrixPushService` 与前端均零封装、零 UI |
| 服务补齐 | 完成 | `MatrixPushService` 新增 `getPushDevices` / `registerPushDevice` / `unregisterPushDevice` / `sendPushNotification`，统一经 `client.getNotificationsManager()` 调用；`src/services/matrix/sdk.ts` 增补 `IPushDevice` / `IRegisterPushDeviceRequest` / `ISendPushNotificationRequest` / `IPushAckResponse` 类型再导出，服务只从唯一咽喉点取类型 |
| 设置页接线 | 完成 | 新增 `views/settingsWindow/tabs/sections/PushDeviceSettings.vue`：设备列表（ID / 类型 / 状态 / 创建时间）、注册表单（`device_id` / `push_token` / `push_type` = apns/fcm/webpush）、注销二次确认、测试推送（标题 + 正文）；空态与失败态齐备，`PushSettings.vue` 在 `AddPusherDialog` 之后挂载 |
| i18n | 完成 | 新增 `setting.push.device_endpoints.*`（title/desc/表单/操作与提示共 24 键），中英同步；`pnpm gen:i18n` 已重新生成类型 |
| 测试 | 完成 | `MatrixPushService.sdkManager.test.ts` 新增 describe，4 例覆盖四条端点的参数透传与返回 |
| 门禁 | 通过 | `vue-tsc --noEmit` 0 错误；`pnpm check`、`check:ratchet`、`check:sdk-boundary`（类型经 `sdk.ts` 再导出，基线不增长）、`quality:no-raw-fetch`、`check:doc-coverage`、`check:doc-paths`、`pnpm test:run` 全绿 |

R1 结论：4 条端点全部复用 SDK `NotificationsManager`，未新增 HTTP 或协议实现。R3 结论：改动位于通知服务域与桌面设置页，未触碰 admin/AI 模块，移动端不产出新增入口。

##### VEN-03 落地记录（P1，完成）

| 项 | 状态 | 说明 |
| :--- | :--- | :--- |
| 调用点盘点 | 完成 | `AccountDataService.getExternalServices` 仅被 `MatrixRoomReadFacade` 委托，另被 5 个单测覆盖，零 UI 消费者；同类能力已由 `AdminExternalServiceService`（`getAdminManager().externalService`，7 条路由全封装）提供 |
| SDK 前缀确认 | 完成 | SDK 侧 `externalService` 默认前缀即 `synapse_admin`，与后端 `/_synapse/admin/v1/external_services/*` 一致，无需修改默认值 |
| 处置 | 完成 | 按「无 UI 消费者一律接线或删除」删除重复实现：移除 `AccountDataService.getExternalServices`、`MatrixRoomReadFacade` 接口声明与委托、`AccountDataService.test.ts` 3 例与 `getExternalServiceManager` mock、`ReadFacade.test.ts` 2 例与 mock；能力保留在 admin 外部服务域，由 ADM-03 页面承接 UI |
| 门禁 | 通过 | `vue-tsc --noEmit` 0 错误；`grep getExternalServices` 全仓 0 命中；`pnpm test:run` 全绿 |

R1 结论：删除的是与 `getAdminManager().externalService` 重复的平行封装，最终能力仍落在 `src/services/matrix/**`。R3 结论：删除项均在房间服务域，无 UI 消费；未引入移动端 admin 入口。

#### 12.4.6 MED（4 条）

| 编号 | 优先级 | 触点 | 改动要点 | 验收 |
| :--- | :--- | :--- | :--- | :--- |
| MED-01 | P2 | 媒体下载 | **已完成**（2026-11-15）：新增 `mediaDownloadHelpers`（`parseSignedMediaUrl` / `buildSignedMediaDownloadUrl` / `downloadSignedMediaBytes`，URL 由 SDK `getDownloadUrl` 构建）与 `MatrixMediaService.getSignedMediaDownloadUrl` / `downloadSignedFileBytes`；`widget/fileDownload` 与 `AttachmentSaver` 自动识别签名链接，复用现有进度环与重试。后端 `GET /_matrix/media/v3/download_signed/{server}/{mediaId}` 直接返回字节流、无签名生成端点，故下载侧无分片进度可接 | `mediaDownloadHelpers.test.ts` + `MatrixMediaService.test.ts` + `fileDownload`/`AttachmentSaver` 单测（83 例） |
| MED-02 | P2 | `src/services/matrix/media/mediaConfigOps.ts` | **已完成**（2026-11-15）：`uploadContentWithId` 补 `assertClientReady()`；`getMediaConfig`/`getAuthenticatedMediaConfig`/`checkQuota`/`getQuotaStats`/`getQuotaAlerts` 已由 `StorageSettings.vue`、`Files.vue`、`SideNavigation.vue`、`QuotaService` 消费，`getUrlPreview` 由 `LinkPreviewPane.vue` 消费；仅 `deleteMedia` 无用户自助入口（管理端走 admin 删除链路），保留并由 `media.contract.test.ts` 保护 | `MatrixMediaService.test.ts`（35 例）+ `media.contract.test.ts` |
| MED-03 | P2 | `src/strategy/strategies/linkPreview.ts:28,55`、`src/components/rightBox/renderMessage/LinkPreview.vue:44` | **已完成**（2026-11-15 核实）：`siteName` 已从 `linkData` 产出并回写 `site_name`；消息卡与侧栏均按 `siteName` 渲染，缺失时回退域名 | `linkPreview.test.ts` 与 `LinkPreview.test.ts` 覆盖有/无 `siteName` 两分支 |
| MED-04 | P2 | `src/components/fileManager/SideNavigation.vue:28-38` | **已完成**（2026-11-15）：配额区在用量进度条后补渲染此前遗漏的 `mediaCount`（`fileManager.storage.count` 文案 + 数值），配额为 `null` 时整块保持隐藏；i18n 新增 `fileManager.storage.count` | 新增 `SideNavigation.test.ts` 2 例（配额存在时渲染 label/count/数值；配额为 `null` 时整块隐藏） |

### 12.5 实施批次与依赖

| 批次 | 内容 | 前置 | 退出条件 |
| :--- | :--- | :--- | :--- |
| 0 | §12.3 门控口径 + 别名订正 + 三态 | 无 | 门控单测全绿，`check:sdk-boundary` 通过 |
| 1 | CAP-01、ROOM-01（P0） | 批次 0 | 两条 P0 的验收测试通过，报告条目关闭 |
| 2 | CAP-02/CAP-03/AUTH-01、ROOM-02/03/04/05 | 批次 0 | 房间与登录相关 P1 全关闭 |
| 3 | VEN-01/02/03、ADM-01~07、CAP-08 | 批次 0 | 通知/语音/后台管理基础 P1 全关闭；能力位与后端宣告对齐 |
| 4 | ROOM-06~13、ADM-08~12、MED-01~04、CAP-04~07、AUTH-02~07 | 批次 2/3 | P2 全关闭（ROOM-06、MED-03 已于 2026-11-15 核实完成） |
| 5 | P3 收尾 | 批次 4 | 报告 47 条 + 审查追加 CAP-08，合计 48 条；**收口（2026-11-18）**：回源确认的 14 条开放项已由 §19.75–§19.81 逐条接线闭环（§19.74 台账 0 条开放），剩余债务见 §19.74「4 项债务」与 §19.82 |

> 状态（2026-11-15）：批次 0-5 已全部完成，§12.4 的 48 条均标注落地记录与验收用例。
>
> **订正（2026-11-18，逐条回源 + 收口）**：上述「全部完成」是**当时的落地口径**，不等于全部闭环。经对 `HEAD 3dfd9e5d2` 逐条回源，初查为 48 条中 **14 条仍开放**（能力接线），另有 5 项文档／测试债与 5 条 admin 端点清单外缺口（判定见 `OPS_ARTIFACTS/THREE_REPO_OPEN_ISSUES_2026-11-15.md` §8.4，整改方案见 `OPS_ARTIFACTS/FRONTEND_REMEDIATION_PLAN_2026-11-18.md`）。同日 §19.75–§19.81 逐批接线后：14 条已全部闭环，admin 清单外缺口随 `ADM-05`／`ADM-10`／`ADM-11`／`N-10` 一并核销，§19.74 台账 **0 条开放**；5 项债务中 `N-03` 已清偿（本节与 §19.22 的陈旧表述同日订正），其余 4 项仍成立，见 §19.74 与 §19.82。

约束：
- 每批次独立可回滚，不跨批次混提。
- 每批次结束跑 §12.7 全部门禁。
- 无 UI 消费者的服务方法默认「接线或删除」；ADM-11 经决策例外：剩余零消费 admin 方法保留不删，但必须在 ADM-11 落地记录中登记清单，新增页面需求时优先复用清单内方法。

### 12.6 新增测试清单

1. `MatrixCapabilityService.test.ts`（并入既有文件，不新建）：14 个能力位的 supported/unsupported/unknown 真值表；每位含「后端真实 key 命中 + 旧错误 key 不命中」双向断言（CAP-08）；`canUseE2EE` 与 crypto 状态一致。
2. `useStickyEvents.test.ts`：GET/PUT/DELETE 契约；门控关闭时不发请求。
3. `StickyTab.test.ts`：整表 PUT 形状、DELETE 入口、unsupported 不渲染。
4. `RoomDetailDrawer.test.ts`：六面板在能力满足时可达、不满足时不存在。
5. `burnAfterRead.feedback.test.ts`：失败时弹出反馈且本地状态不变。
6. `authMetadata.test.ts`：`auth_metadata` 200/404 两条路径；flows 驱动 SSO 按钮。
7. `AdminModules.test.ts`：加载成功、空列表、失败重试三态。
8. `AdminServerNotifications.test.ts`：7 条端点契约。
9. `ExternalServices.test.ts`：页面调用 7 个方法（现有服务测试已覆盖方法本身，补页面层）。
10. `useAdminServerLogs.test.ts`：单项失败时不覆盖成功项，且暴露错误态。
11. `searchRooms.server.test.ts`：服务端搜索优先、离线降级本地过滤。
12. `voice/push` 契约测试：VEN-01/02 的端点与失败路径。

### 12.7 验收门禁

| 命令 | 通过标准 |
| :--- | :--- |
| `pnpm vue-tsc --noEmit` | 0 错误 |
| `pnpm test:run` | 全部通过（含 §12.6 新增用例） |
| `pnpm check:file-size` | 无新增超限文件；`.vue` 不得超过 800 行 |
| `pnpm check:ratchet` | 无新增硬编码颜色 |
| `pnpm check:sdk-boundary` | 通过；新增端点必须走服务层 |
| `pnpm quality:no-raw-fetch` | 通过 |
| `pnpm check:doc-coverage` / `pnpm check:doc-paths` | 通过 |
| `pnpm check` | Biome + i18n 无新增问题 |

### 12.8 R1 / R2 / R3 合规

1. **R1 SDK 优先**：每条改动前按「SDK 导出 → `src/services/matrix/**` → `matrix-js-sdk-augmentations.d.ts`」三步检索；已在 SDK 确认可复用的有 `getExternalServiceManager()`、`SynapseRustFeature` 特性位、`getVersions()`。凡确认无 SDK 能力的，提交说明必须写明「已检索的 SDK API 与不可复用原因」。禁止在组件/store 内直接 `fetch`。
2. **R2 移动端裁剪**：本章新增的 admin 页面与服务只在桌面端路由注册期装配，`src/mobile/**` 不得 import `@/views/admin/**`、`@/services/matrix/admin/**`；AI 相关条目不在本章范围。
3. **R3 构建校验**：涉及路由/菜单改动的批次（ADM-02/03/05、AUTH-01）需额外跑一次移动端前端构建，确认产物中无 admin 路由名与入口。

### 12.9 不纳入范围

- 报告 §3 已排除项：SDK 内部协议端点、profile 门控的 oidc（8 条）与 worker（11 条）、SDK manager 端点（115/48/67 条）、`unsupported` 16 条、已接入抽样。
- 移动端 admin / AI 功能本身（按 R2 直接裁剪，不做接线）。
- 纯样式与液态玻璃相关改动（见第 4-11 章）。

---

## 13. UI/UX 优化方案（能力接线配套，2026-11-14）

本章承接第 12 章的 48 条排查结论（原报告 47 条 + 审查追加 CAP-08），但只回答「界面应该长什么样、如何反馈」的问题；工程侧的端点、服务与门控实现见第 12 章。两章按同一批次推进，UI 不得先于门控上线。

### 13.1 设计出发点

48 条问题表面是「功能没接上」，实际暴露出三类界面缺陷：

1. **能力不可见**：服务端不支持时，界面要么照常渲染入口（点击必失败），要么整块消失且没有任何解释。
2. **状态不完整**：只有「有数据」和「没数据」两种呈现，缺少加载、失败、部分失败、不可用四类状态。
3. **信息架构断层**：六个房间面板、十个管理子域、三类通知混在同等层级，用户找不到入口，也看不出彼此关系。

对应三条设计原则：

- **能力可见（Capability-aware）**：不支持的入口不渲染，但支持情况必须在统一位置可查。
- **状态完整（State-complete）**：每个异步区块必须交付 loading / empty / error / partial 四态。
- **入口可达（Reachable IA）**：先定信息架构，再补页面，避免「有页面没入口」。

### 13.2 能力可见性设计

#### 13.2.1 三级可见性模型

| 级别 | 服务端能力 | 界面表现 | 示例条目 |
| :--- | :--- | :--- | :--- |
| L1 已支持 | supported | 正常渲染入口与操作 | 全部已接入能力 |
| L2 明确不支持 | unsupported | **不渲染入口**；仅在「服务能力」面板列出并说明原因 | CAP-02 置顶条、脱水设备 |
| L3 未知 | unknown | 不渲染入口；后台静默重探，不打扰用户 | 新增 MSC 能力首次启动 |

硬规则：

- 禁止「先渲染、点击后报错」。L2/L3 一律 `v-if` 裁剪。
- 禁止「禁用但不说原因」。若因流程约束必须展示禁用态（如未选择房间时的批量操作），必须同时给出原因文案，且按 §13.8 的禁用样式处理。

#### 13.2.2 统一「服务能力」面板

新增设置页区块（桌面：设置 → 诊断 → 服务能力；移动：设置 → 关于 → 服务能力），作为 L2/L3 的唯一解释出口。

结构：

1. 顶部摘要：`已启用 N 项 / 不可用 M 项 / 未知 K 项`。
2. 分组表格：协议基础 / 消息与房间 / 加密与设备 / 语音与推送 / 管理接口。
3. 每行字段：能力名、状态徽标、影响的功能、原因（缺失的 unstable feature 名）。
4. 底部动作：`重新探测`（手动触发一次 `getVersions`，带 loading 与结果 toast）。

设计约束：

- 状态徽标只作为辅助，必须同时有文字（不可仅靠颜色，见 §13.6）。
- 表格中的技术标识（如 `org.matrix.msc4354`）默认折叠，提供「显示技术信息」开关，避免普通用户困惑。

### 13.3 状态完整性设计

#### 13.3.1 五态矩阵

| 状态 | 触发条件 | 列表/卡片 | 行内动作 | 可访问性 |
| :--- | :--- | :--- | :--- | :--- |
| loading | 请求 >300ms | 骨架屏，保持行高不跳动 | 按钮进入 loading 并禁用 | `aria-busy="true"` |
| empty | 成功但无数据 | 图标 + 一句说明 + 一个主动作 | - | 说明文本可被读屏获取 |
| error | 请求失败 | 就近错误块 + 重试按钮 + 错误码（可复制） | toast 失败 + 保留用户输入 | `role="alert"` |
| partial | 多请求部分失败 | 成功的照常展示，失败区块单独标注「加载失败，重试」 | 局部重试 | `aria-live="polite"` |
| disabled | 能力不支持/前置不满足 | 不渲染或禁用 + 原因 | `cursor-not-allowed` + tooltip | `aria-disabled="true"` |

#### 13.3.2 直接对应的修复点

| 条目 | 现状 | 目标 |
| :--- | :--- | :--- |
| ADM-02 | 模块页恒空，无任何提示 | 加载骨架 → 成功列表 / 空态（含「刷新」）/ 失败态（含重试与错误码） |
| ADM-07 | `allSettled` 静默降级，页面像正常 | 四项指标各自维护状态；失败项显示「不可用」而非 `null`；页面顶部汇总「N 项获取失败」 |
| ROOM-05 | 阅后即焚失败无反馈 | 开关失败时回滚 + 开关旁内联错误 + toast；时长修改同理 |
| ROOM-01 | 置顶条数据源错误，用户看到的是另一份数据 | 数据源切换后补「无置顶」空态与「加载失败」态 |
| VEN-01/02 | 无 UI | 语音与推送各自交付四态 |
| MED-01 | 无进度 | 上传/下载进度条 + 失败重试 |

#### 13.3.3 错误呈现规范

- 就近原则：字段级错误放字段下方；区块级错误放区块内；全局错误才用 toast。
- 每条错误必须带**下一步动作**（重试 / 重新登录 / 联系管理员 / 查看服务能力）。
- 错误码与请求 ID 默认折叠在「详情」中，便于用户反馈时复制。
- 同一错误在 5 秒内不重复弹 toast，改为行内状态更新。

### 13.4 信息架构调整

#### 13.4.1 房间详情抽屉

现状：`RoomDetailDrawer` 只挂 4 个基础面板，六个能力面板无入口。目标改为四个 Tab：

| Tab | 面板 | 面向用户的问题 |
| :--- | :--- | :--- |
| 概览 | RoomDetailStats、RoomDetailLastMessage、RoomMetadataPanel | 这个房间是什么、最近发生了什么 |
| 成员 | RoomDetailMembers | 谁在这个房间 |
| 安全 | EventSignaturePanel、RoomEncryptedEventsPanel、RoomRetentionPanel | 消息是否可信、如何留存 |
| 高级 | RoomCapabilitiesPanel、RoomMessageQueuePanel、RoomDetailPinnedMessages | 服务端支持什么、队列与置顶状态 |

规则：

- 每个 Tab 内的面板独立四态；单个面板失败不影响其他 Tab。
- 面板不可用时**整个 Tab 隐藏**（L2/L3），并在「服务能力」面板给出原因。
- 移动端房间详情保持精简，不引入「高级」Tab（与 R2 的裁剪精神一致，不增加移动端复杂度）。

#### 13.4.2 后台管理导航

现状：管理页平铺，模块页空壳，外部服务与系统通知无入口。目标按四组重构：

| 分组 | 包含页面 | 对应条目 |
| :--- | :--- | :--- |
| 用户与权限 | 用户、注册、3PID、CAS/SSO、邀请黑白名单 | ADM-05、AUTH-07 |
| 房间与内容 | 房间、举报、媒体、保留策略、配额 | ADM-04、ADM-08 |
| 服务与集成 | 外部服务、回调、推送、联邦 | ADM-03、ADM-05、ADM-12、VEN-02 |
| 系统与运维 | 模块、服务状态、系统通知、清理、限流、账号有效期 | ADM-01、ADM-02、ADM-05、ADM-07 |

规则：

- 分组即路由层级，菜单只渲染当前账号有权限且服务端支持的项。
- 「服务状态」页必须名副其实：若只展示 status/health/version/stats，标题改为「服务状态」；「服务器日志」要么补真日志端点，要么下线该名称（ADM-07）。
- 新增页面必须同时提交「路由 + 菜单 + 空态 + 权限门控」四件套，缺一不予合并。

#### 13.4.3 设置页分区

| 分区 | 内容 | 对应条目 |
| :--- | :--- | :--- |
| 账号与安全 | 3PID 绑定、注销、设备与脱水设备、密钥轮转状态 | AUTH-02/04、CAP-02/04、ROOM-06 |
| 通知与推送 | 用户通知设置、推送设备、系统通知（只读） | VEN-02、ADM-01 |
| 服务能力 | §13.2.2 的能力面板 | CAP-01、全部 L2/L3 |
| 通用 | 主题、语言、快捷键 | 现有 |

### 13.5 关键交互规格

#### 13.5.1 置顶条（Sticky Events）

- 位置：聊天区顶部，与现有置顶消息视觉统一，但不共用数据。
- 折叠态：最多展示 1 条，右侧显示「共 N 条」；点击展开为列表。
- 编辑态：抽屉表格，支持增删改与排序；提交为**整表 PUT**，提交前展示 diff 摘要（新增/删除/调整）。
- 删除：二次确认，说明「删除后所有成员不再看到该置顶」。
- 失败：保留编辑内容，提示「保存失败，可重试」，不关闭抽屉。

#### 13.5.2 阅后即焚

- 开关：切换后立即显示行内 loading；成功后更新状态徽标，失败回滚并显示原因。
- 时长：下拉选择后同样走「提交 → 回读 → 展示」，不做本地提前更新。
- 状态展示：房间头部显示「阅后即焚 · 30 秒」徽标，hover/tap 显示说明。

#### 13.5.3 定时发送

- 列表项：内容摘要 + 发送时间 + 状态（待发送/已发送/已取消/失败）。
- 失败项提供「重新排期」，对应 MSC4140 restart；取消需二次确认。

#### 13.5.4 语音消息

- 录制态：波形 + 计时 + 上滑取消 + 松手发送。
- 发送态：气泡内进度，失败可重试；不做自动重发。
- 播放态：波形进度可拖动，同一时间只允许一条播放。

#### 13.5.5 推送设备

- 设备列表：设备名、平台、最后活跃、当前设备标记。
- 每设备一个推送开关；关闭需确认，说明「关闭后该设备将不再收到离线推送」。
- 发送测试推送（若服务端支持）作为行内动作，带结果反馈。

#### 13.5.6 管理端写操作

统一模式：`点击 → 行级 pending → 服务端成功 → 回读列表 → 成功 toast`。失败时保留弹窗与输入，展示错误原因。禁止只改本地状态。

### 13.6 文案与微交互规范

文案模板：

| 场景 | 模板 |
| :--- | :--- |
| 能力不支持 | `当前服务端未启用{功能名}` + 原因（折叠） |
| 加载失败 | `{对象}加载失败` + `重试` + 错误码（折叠） |
| 部分失败 | `部分数据加载失败` + 受影响项列表 |
| 空态 | `暂无{对象}` + 一句行动建议 + 主动作按钮 |
| 操作失败 | `{操作}失败：{原因}` + 重试 |
| 未知能力 | `正在确认服务端能力`（仅首次探测时短暂展示） |

微交互：

- 过渡时长 150-250ms；不使用位移型 hover（避免布局抖动），只用颜色/透明度/阴影。
- 所有可点击元素 `cursor-pointer`；禁用态 `cursor-not-allowed` 且降低不透明度。
- 尊重 `prefers-reduced-motion`：关闭骨架屏呼吸、进度条动画与展开收起动效。

### 13.7 可访问性

1. 语义优先：可点击项用 `button`/`a`，表格用 `table`，不使用 `div` 模拟。
2. 图标按钮必须有 `aria-label`；装饰性图标 `aria-hidden="true"`；图标统一 SVG，24x24 viewBox，线宽 1.5px。
3. 键盘可达：抽屉/弹窗焦点陷阱与 `Esc` 关闭；Tab 顺序与视觉顺序一致。
4. 焦点可见：使用 `:focus-visible` 描边，禁止 `outline: none` 无替代。
5. 动态反馈：错误用 `role="alert"`，加载与部分失败用 `aria-live="polite"`。
6. 状态不依赖颜色：能力徽标、成功/失败状态必须带文字或图标形状差异。
7. 表单控件必须有可见 label 或 `aria-label`，占位符不作为唯一标签。

### 13.8 视觉规范

- 颜色：全部使用 `--tjg-*` token，不引入本章新增颜色字面量；状态色使用 `--tjg-status-*`。
- 字体：沿用项目现有字体栈；**不引入**外部设计系统推荐字体，避免打包体积与跨端渲染差异。
- 玻璃面：沿用第 3-5 章的 `--tjg-glass-*` 与 mixin，本章不新增玻璃样式。
- 密度：管理端表格行高 44px（桌面）/ 52px（触屏），分页默认 20 条；列表骨架屏行高与真实行一致，避免加载完成跳动。
- 图标：新增能力徽标、状态提示优先复用现有图标集，不新增图标库。

### 13.9 组件清单（规划，非既有文件）

| 组件 | 用途 | 归属条目 |
| :--- | :--- | :--- |
| `CapabilityBadge` | 能力状态徽标（文字 + 图标 + 颜色） | CAP-01、§13.2 |
| ~~`AsyncStateBoundary`~~ → `EmptyState` / `ErrorState` / `MobileAsyncState` | 统一 loading/empty/error/partial 容器（原规划的聚合边界已取消，见 §16.2；实际由既有三件承担） | ADM-02/07、ROOM-05、VEN、MED |
| `ServiceCapabilityPanel` | 服务能力总览与重探 | CAP-01~07 |
| `StickyEventsBanner` / `StickyEventsEditor` | 置顶条展示与整表编辑 | ROOM-01 |
| `InlineFieldError` | 字段级错误与重试 | ROOM-05、AUTH-02 |
| `AdminDataTable` | 管理端表格：pending/回读/分页/空态 | ADM-02~11 |
| `PushDeviceList` | 推送设备与开关 | VEN-02 |
| `VoiceRecorder` | 录音波形与状态机 | VEN-01 |
| `UploadProgress` | 媒体分片进度 | MED-01 |

组件约束：单文件不超过 800 行；展示组件不直接调用服务层，数据由 composable 注入。

### 13.10 与工程批次的对应

| 工程批次（§12.5） | 同期交付的 UI/UX 工作 |
| :--- | :--- |
| 批次 0 | `CapabilityBadge`、`ServiceCapabilityPanel` 两个基础组件与三态约定；三态由既有 `EmptyState` / `ErrorState` / `MobileAsyncState` 承担（原规划的 `AsyncStateBoundary` 已取消，见 §16.2） |
| 批次 1 | 置顶条改造（数据源切换 + 编辑抽屉 + 删除确认） |
| 批次 2 | 房间详情四 Tab、阅后即焚反馈、线程面板入口 |
| 批次 3 | 管理端导航四分组、外部服务页、系统通知页、推送设备、语音录制 |
| 批次 4 | 定时发送、配额与遥测展示、上传进度、剩余空态补齐 |
| 批次 5 | 文案与可访问性统一收口 |

### 13.11 验收清单

功能与状态：

- [x] 每个 L2/L3 能力入口在界面上不存在，且「服务能力」面板能查到原因。 —— 证据：§12.4 的 48 条接线条目均已落地实现并登记（**注**：2026-11-18 回源确认其中 14 条仍开放，见 §19.74；本项仅断言「未接能力在界面上不假存在」，与接线完成度无关）；2026-11-15 把此前「有实现、有测试、无挂载点」的 `ServiceCapabilityPanel` 接入 `DiagnosticsPanel.vue`（设置 → 帮助/诊断），列出 14 个能力位的三态、缺失 key（如 `org.matrix.msc4354`）与重试/设置入口；`useServiceCapabilityItems.test.ts` 5 例 + `ServiceCapabilityPanel.test.ts` 6 例全过（详见 §19.7）。
- [x] 每个异步区块具备 loading / empty / error / partial 四态，且均有自动化测试。 —— 2026-11-16 逐页核对结果：房间成员/房间设置（§19.14）、消息列表（§19.18）、**空间子房间列表（§19.21，本轮补 error/loading）** 已闭合；好友申请（§19.11 已带失败文案+重试）与房间内搜索（自身有 loading/error+retry/empty）已达标；**媒体库当时判为占位实现**（硬编码假配额，无数据源，§19.21 边界 1，该判定已被 §19.22 / §19.29 推翻）。原注：三态通用件已就位（`EmptyState` / `ErrorState` / `MobileAsyncState`，均有用例）；`partial` 于 2026-11-16 补齐统一件 `PartialStateBanner`（`role="status"` + `aria-live="polite"`、可重试、消费 `--tjg-*` token、10 例单测），第一批接入 `AdminServerLogs` / `AdminDashboard`（§19.10），第二批接入业务端 `FriendsSettings` / `StorageSettings`（§19.11），把「分组/好友申请读取失败」与「配额统计/告警/认证媒体读取失败」从伪空态改为显式 partial；第三批为 `AdminDashboard` 补页面级用例（§19.12），四态在 admin 三页已有自动化证据。空态已由 `check-ratchet` 的 `handwritten_empty_state` 锁定 0（详见 §19.8）。**2026-11-17 补第三批局部失败信号（§19.54）**：修复消息列表首屏失败标记在 `changeRoom` / `resetAndRefreshCurrentRoomMessages` 收尾被抹掉（退化成空态）的缺陷；`RoomServerSummaryPanel` 的部分数据源失败、`SecurityTab` 的安全设置/保险库读取失败均接入 `PartialStateBanner` 并可原地重试。本条在 2026-11-17 勾选：**同日第四批（§19.55）补完媒体库配额区**——首屏骨架屏、`unavailable` 的可重试 `PartialStateBanner`、文件列表带原因的空态，并各有组件用例（`ChatSidebarFiles.test.ts` 10 例）。媒体库唯一异步区块（配额）四态齐备；文件列表在服务端提供房间维度列文件接口前没有异步源，渲染为如实空态而非四态之一。**2026-11-17 第五批（§19.64）**：对登录后账号内页做组件级四态全量核对，修复 9 处「失败被伪装成空态 / 默认值」（桌面 4 + 移动 5，含空间列表、房间所属空间、公告列表、群成员、邀请策略、存储用量、忽略用户、推送历史），新增 6 个用例文件并改写 4 个已有用例；其余 35 处缺口（高 18 / 中 10 / 低 7）已在 §19.64 登记，按批次推进；**2026-11-17 第六批（§19.65）**：优先修复其中「失败显示默认枚举」的 4 处（房间可见性、房间加密状态、安全备份状态、邀请策略），剩余 31 处（高 14 / 中 10 / 低 7）继续按批次推进。**2026-11-17 第七批（§19.66）**：关闭剩余高严重度中的桌面 4 处（`AccountSettings` 扩展资料、`FriendsSettings` 好友请求策略、`SessionSettings` 设备列表、`WidgetDetailPanel` 配置 / 能力 / 会话），剩余 27 处（高 10 / 中 10 / 低 7）。**2026-11-17 第八批（§19.67）**：关闭剩余高严重度中的房间面板 4 处（`AnnouncementPanel` 公告列表、`RoomMetadataPanel` 元数据、`RoomEncryptedEventsPanel` 加密事件、`RoomMessageQueuePanel` 消息队列），剩余 23 处（高 6 / 中 10 / 低 7）。
- [x] 所有写操作失败后保留用户输入，并给出可执行的重试路径。 —— **2026-11-16 已把「房间成员 / 房间设置」的 5 条写路径做成组件级判据**（邀请、踢人、名称+主题、别名、标签；断网与 4xx 在组件边界上等价于 facade reject），实测全部**已满足**且 4 条变异自证会红，见 §19.16。**同日再补管理端 3 条写路径**（公告发送、IP 封禁、房间保留策略），5 例判据 + 3 条变异自证见 §19.28；配额写操作经核查后端无端点（`getQuotaConfigs` / `setUserQuota` 已删除），移动端 admin 按 R2 裁剪、无对应入口，故本条勾选。
- [x] 管理端每个新页面同时具备路由、菜单、空态、权限门控。 —— **2026-11-17 已用真后端账号逐页实测 30 个 `/admin/*` 页面**（§19.61）：普通账号逐页 `router.push` 全部被 `requiresAdmin` 拦回非 admin 路由且不渲染 `.admin-layout` / `.admin-nav-item`；提权账号（`is_admin` + `user_type='admin'` 双写）逐页可见 `.admin-layout`、无 `.admin-state-panel`、`.admin-content` 出现未访问过的新节点且 URL 停在目标 path、菜单项全部指向 `/admin/*`。路由与门控为活体判据，空态由 §19.57 §19.61 的四态用例与各页组件用例覆盖（`admin-dashboard-live` 2 例通过）。

可访问性：

- [x] 键盘可完成全部主流程；焦点顺序正确；`Esc` 可关闭浮层。 —— 2026-11-16 在 `pnpm dev` 桌面（5211）/ 移动（5210）登录页做键盘走查：Tab 顺序为「账号 → 头像切换按钮 → 服务器地址 → 密码 → 协议勾选 → 服务协议 → 隐私保护指引」，协议链接为 `role="button" tabindex="0"`；引导浮层（driver.js）会锁定焦点且不渲染关闭按钮，原按 `Esc` 无法退出（WCAG 2.1.2 键盘陷阱，已修，见 §19.9 缺陷 3），修复后 `Esc` 可结束引导并回到表单。**2026-11-17 追加离线子集**（§19.56）：新增桌面 Chromium 键盘 E2E 4 例（Tab 焦点链、Enter 激活会话、右键菜单 ArrowDown + Escape、设置页 tablist 方向键），并修掉「右键菜单容器从未自动聚焦、键盘处理器不可达」的真实缺陷。**同日再补真实账号主流程（§19.61 勾选依据）**：`e2e/account-keyboard-live.spec.ts` 用真后端账号 + 两个真实房间验证「回车发送消息落到时间线且输入框清空 → Enter 切换会话（`aria-current` 迁移）→ `Cmd/Ctrl+Shift+F` 跳搜索页并渲染 `SearchPane` → `Cmd/Ctrl+F` 焦点进入 `#center` 输入控件」，通过。**残留边界**：Tauri WebView 真机焦点链与移动端键盘仍未覆盖，归 C3 硬件回归。
- [x] 图标按钮均有可访问名称；装饰图标已从读屏隐藏。 —— 证据：`pnpm check:icon-button-aria` exit 0；`pnpm check:svg-aria` exit 0（587 处装饰图标带 `aria-hidden`）。
- [x] 错误与异步更新使用 `role="alert"` / `aria-live`。 —— 证据：`src` 非测试源码静态扫描 `role="alert"` 18 处 / 18 文件（含 `ErrorState` / `EncryptionSettings` / `DecryptionFailureCard`）、`aria-live` 16 处 / 15 文件（含全局 `GlobalAriaLive.vue`），对应 `ErrorState.test.ts` / `GlobalAriaLive.test.ts`。
- [x] 明暗两套主题下文本对比度不低于 4.5:1（正文）。 —— 2026-11-16 未登录登录页四组扫描 `violations=0`（§19.9）；**2026-11-17 补账号内页（§19.61）**：`e2e/a11y-account-live.spec.ts` 用真实登录态，经 `settingStore.toggleTheme()` 真实切换（同时驱动 Naive UI `themeContent`）后，对 `/message`、`/friend`、`/space`、`/federation`、`/search` × light/dark 共 10 组跑 axe `color-contrast`，修复下方 4 处后在 light/dark 两轮均为 0 serious/critical 违规。修复项：`--tjg-text-tertiary` 明色 `#737373 → #666666`（对 muted/subtle/search 底 4.77–5.27:1）、暗色 `#858585 → #9c9c9c`、暗色 `--tjg-text-secondary` `#9b9b9b → #a8a8a8`；`SpaceList` 选中态 `primary-500 → primary-600` 并补暗色 `primary-300` 覆盖（`SpaceListPane` 原本已是 600，仅补暗色覆盖）；右侧栏空态由 `n-text depth=3` 改为继承 `--tjg-text-tertiary` 的普通 `span`。

视觉与规范：

- [x] 无新增 `#xxx` / `rgb()` / `rgba()` 字面量，全部走 `--tjg-*`。 —— 证据：`pnpm check:ratchet` exit 0（`hardcoded_radius 0/0`、`inline_style 5/5` 均在 allowlist、`important_css 39/39`；2026-11-21 复跑已收紧至 `important_css 20/20`、`backdrop_filter_raw 4/4`）；`pnpm check:tokens` 224 个 token 零引用 0、使用率 100%。
- [x] 无 emoji 图标；新增图标为 SVG 且尺寸一致。 —— 证据：模板段静态扫描（排除 `__tests__`）命中 4 个文件，逐行核对均为注释或装饰字符 `✓`，无 emoji 作图标；`pnpm check:icon-colors` exit 0（585 处已迁移 token）、`pnpm check:svg-aria` exit 0（587 处 SVG 图标）。
- [x] 过渡 150-250ms，且 `prefers-reduced-motion` 下关闭非必要动效。 —— 证据：`src` 下 608 个 `.vue` / `.scss` / `.css` 文件扫描，仅 2 处超出区间且均属例外：`BurnIndicator.vue:158` 的 `transition: width 1s linear`（倒计时进度条，属进度动画而非交互动效）、`design-tokens.css:731` 的 `transition-duration: 0.01ms !important`（reduced-motion 全局关闭开关）；`prefers-reduced-motion` 覆盖 66 个文件 68 处，含 `mobile.scss:283` 全局规则。
- [x] 375px / 768px / 1024px / 1440px 四档无横向滚动、无遮挡。 —— 2026-11-16 在 `pnpm dev`（`http://127.0.0.1:6130/login`）用 Playwright 1.63 + Chromium 设置视口实测：四档 `documentElement.scrollWidth === clientWidth`（375/375、768/768、1024/1024、1440/1440），`overflowCount = 0`，关键元素无裁切/重叠、`elementFromPoint` 命中自身（未被遮挡），品牌图已加载（`naturalWidth 256`）。**范围限制**：仅覆盖未登录态可达的登录页；依赖账号的内页仍归 §19.3 的 P2 分批回归。

---

## 14. 风险与回滚

| 风险 | 触发信号 | 缓解 | 回滚 |
| :--- | :--- | :--- | :--- |
| 玻璃面过多导致掉帧 | 滚动平均帧率 <45 | 预算 ≤3、禁用清单 | `glassMode='off'` 全局纯色 |
| 低端机白屏/闪烁 | `low-perf` 未及时写入 | 判级早于 `createApp` | 移除 `low-perf` 判定外的所有增强 |
| 增强库 WebView 不兼容 | 三端渲染不一致 | POC 一票否决 | 动态 import 失败自动回落 |
| 对比度不达标 | 抽检 <4.5:1 | 玻璃面正文限定 token | 局部改 `variant="none"` |
| 双层模糊 | 文字发糊 | Naive/Vant 容器底色置透明 | 移除容器层玻璃，仅保留组件层 |
| 包体膨胀 | gzip 增量 >40 KB | 增强库不进首屏 chunk | 卸载依赖，保留 CSS 基座 |

紧急回滚开关（无需发版逻辑改动）：

```ts
// 全局关闭玻璃（可挂到设置页或远程配置）
useGlassEffectStore().mode = 'off'
```

---

## 15. 代码审查结论与冗余清除（2026-11-14）

本章为第 12/13 章之外的独立静态审查。目标不是再提一份计划，而是先用现有守门脚本与全量扫描把「真实债务」钉死在可复现的数字上，再据此决定删什么、补什么。

### 15.1 审查方法与范围

| 项目 | 说明 |
| :--- | :--- |
| 扫描对象 | `src/`（548 个 `.vue`，其中 `src/mobile/` 136 个；1981 个 `.ts`）、`scripts/`、`src-tauri/src/` 仅做交叉引用检查 |
| 方法 | Biome 全仓 lint + 12 个守门脚本实测 + 自写线性扫描（零引用组件、调试残留、类型逃逸、格式化工具重复实现） |
| 判定口径 | 「冗余」只认两类：可被现有工具/组件替代的重复实现；门禁已判定为失效的僵尸条目。风格偏好不计入 |
| 未覆盖 | 未做运行时 CPU/内存采样、未接后端、未上真机，因此第 19 章把「已执行」与「待执行」严格分表，不合并统计 |

### 15.2 门禁实测结果

| 守门项 | 命令 | 结果 | 关键数字 |
| :--- | :--- | :--- | :--- |
| Lint / 格式 | `pnpm lint` | 通过 | `Checked 2769 files in 15s. No fixes applied.` |
| 类型检查 | `pnpm typecheck` | 通过 | `[check-generated-typings] OK —— 3 个生成物类型文件完整`，`vue-tsc --noEmit` 无输出即 0 错误 |
| 硬编码/分支 ratchet | `pnpm check:ratchet` | 通过 | `is_mobile_branch: 19 (baseline 19)`、`as_unknown_as: 0`、`zh_literal_rust: 0` |
| 文件体量 | `pnpm check:file-size` | 失败 | 14 个文件超基线；红线 1 个（`src/typings/components.d.ts` 808 行） |
| 孤儿文案 | `pnpm check:i18n-dead-keys` | 失败 | 孤儿 key 60 条，基线 0 |
| 组件契约 | `pnpm check:component-contracts` | 失败 | `ACCEPTED_PATTERNS` 失效 4 条，另有 28 处动态挂载跳过 |
| 设置接线 | `pnpm check:settings-wiring` | 失败 | 3 个持久化 key 未登记 manifest |
| 单元测试 | `pnpm test:run` | 失败 | `Test Files 4 failed \| 987 passed (991)`、`Tests 6 failed \| 11144 passed (11150)`，分诊见 §19.2 |

结论：**项目不存在「大面积烂代码」**。Biome 0 诊断、零引用 `.vue` 组件 0 个、生产代码 `TODO/FIXME/HACK` 0 条、格式化工具已单源（`src/utils/Formatting.ts`）。真正的债务是**门禁基线与复用边界漂移**：基线被人为抬高后失去约束力，白名单条目对应的代码已删除却没人清。

### 15.3 冗余清除清单

| 编号 | 问题 | 证据 | 处置 | 验收命令 |
| :--- | :--- | :--- | :--- | :--- |
| R-01 | 孤儿文案 60 条（无任何代码引用） | `check:i18n-dead-keys` 报 `admin.rooms.aliasRemoveNotSupported`、`chat.chat_region`、`chat.crypto_unavailable.message`、`common.chat`、`common.feature_in_development`、`common.notice`、`common.screen_share`、`dynamic.detail_placeholder`、`voip.errors.mic_busy`、`voip.errors.mic_not_found`、`voip.unknown` 等 | 按 key 分组逐条确认；确认无用的从 `src/locales/**` 删除，删除后同步下调 `scripts/i18n-dead-keys-baseline.json` 计数 | `pnpm check:i18n-dead-keys` |
| R-02 | 组件契约白名单失效 4 条 | `src/mobile/components/ImagePreview.vue` 的 `forward` / `save` / `more` 三个事件、`src/mobile/views/chat-room/MobileRoomUpgradeDialog.vue` 的 `upgraded` 事件已不存在 | 从 `check:component-contracts` 的 `ACCEPTED_PATTERNS` 删除这 4 条，禁止用「先留着以后可能加」的思路保留 | `pnpm check:component-contracts` |
| R-03 | 持久化 key 未登记 | `tjg:media-auto-cache`（`src/stores/domains/widget/thumbnailCache.ts`，localStorage）、`tjg:pending-deep-link-room`（`src/composables/common/desktopShellBridge.ts`，localStorage）、`userState`（`src/stores/domains/user/userStatus.ts`，`defineStore` + `persist`） | 在 `scripts/settings-wiring-manifest.json` 补齐 owner 与消费方；若确认是临时缓存且不需要跨会话，改为会话内存储而非登记 | `pnpm check:settings-wiring` |
| R-04 | 体量基线漂移 14 个文件 | `src/typings/components.d.ts` 808（基线 806）、`src/plugins/robot/layout/Left.vue` 762（761）、`src/components/.../ChatSidebar.vue` 682（680）、`AdminDashboard.vue` 675（657）、`src/layout/left/components/ActionList.vue` 671（670）、`src/components/.../renderMessage/Video.vue` 651（648）、`renderMessage/index.vue` 625（623）、`emoticon/index.vue` 593（592）、`ChatMsgMultiChoose.vue` 585（577）、`videoViewerWindow/index.vue` 548（545）、`common/InfoPopover.vue` 495（493）、`windows/ActionBar.vue` 451（443）、`common/ContextMenu.vue` 450（448）、`space/SpaceTree.vue` 411（410） | 只允许「降」不允许「涨」：新增代码前先把所在文件拆到基线以下，再跑 `node scripts/check-file-size.mjs --update` 冻结新基线 | `pnpm check:file-size` |
| R-05 | 生产代码类型逃逸 13 处 `: any` | `src/typings/global.d.ts` 5 处（全局声明，可保留并加注释）、`src/mobile/components/AreaDrawer.vue` 4 处、`src/layout/left/components/definePlugins/index.vue`、`ChatSidebar.vue`、`RoomSessionList.vue`、`SmartVirtualList.vue` 各 1 处 | 优先用已知接口或 `unknown` + 收窄替代；全局声明处的 `any` 必须有 `// 第三方无类型` 说明 | `pnpm typecheck` |
| R-06 | 生产代码 `console.log/debug/trace` 6 处 | `src/utils/Logger.ts` 4 处、`src/utils/Console.ts` 1 处、`src/workers/workerLogger.ts` 1 处 | **不删除**。这是日志基建的出口实现，不是调试残留；改为受 `logLevel` 门控，禁止业务代码直接调用 `console` | `pnpm check` |
| R-07 | 生成物 `src/typings/components.d.ts` 808 行 | 单文件超 800 红线，但为 `unplugin-vue-components` 自动生成 | 不手改；在生成器配置中去掉未使用组件的自动注册，或接受其进入 `check-file-size` 的生成物豁免清单 | `pnpm check:file-size` |
| R-08 | 注释掉的死代码块 | `src/components/rightBox/VoiceRecorder.vue` 的 `controls-processing` 分支内保留了一整段注释掉的取消按钮 | 直接删除死代码块，保留空状态容器（该分支本身仍有布局作用） | `pnpm lint` |

**明确判定「无需处理」的项**（避免重复立项）：

- 零引用 `.vue` 组件 0 个：548 个组件全部有引用路径，不需要做「删组件」运动。
- 格式化工具无重复实现：`formatBytes` / `formatSize` 类逻辑已集中在 `src/utils/Formatting.ts`，禁止在组件内再写一份。
- `as unknown as` 双断言 0 处：类型断言纪律良好，不需要专项治理。

### 15.4 执行顺序

1. **先清基线**（R-01 / R-02 / R-03）：这三项是纯删除与登记，风险最低，且能让后续改动的门禁信号重新可信。
2. **再压体量**（R-04 / R-07）：按「改到哪个文件就先拆哪个文件」推进，不做全仓大重构。
3. **再收类型**（R-05）：只在触碰到的文件里替换，禁止顺手全仓替换。
4. **最后清样式死代码**（R-08）：与第 18 章一起做，避免重复改动同一文件。

---

## 16. 缺失组件与工具函数补全

### 16.1 既有资产盘点

第 13 章在规划阶段假设了若干「待建组件」，本轮逐一回到代码核实，结论是大部分已存在且质量可用。

| 能力 | 现有实现 | 现状 | 复用建议 |
| :--- | :--- | :--- | :--- |
| 空态 | `src/components/common/EmptyState.vue` | 已被 32 个文件引用 | 直接复用，禁止新写空态 |
| 错误态 | `src/components/common/ErrorState.vue` | 同上 | 直接复用 |
| 错误边界 | `src/components/common/ErrorBoundary.vue` | 存在 | 页面级包裹复用 |
| 骨架屏 | `src/components/common/SkeletonBase.vue`、`SkeletonList.vue`、`SkeletonSettings.vue`、`SkeletonSpaceTree.vue`、`SkeletonFriendList.vue`、`SkeletonDmList.vue` | 6 个粒度已覆盖 | 按容器形状选型，不再新增 `SkeletonXxx` |
| 移动端四态 | `src/mobile/components/common/MobileAsyncState.vue` | `loading / empty / error / ready` 四态 + 重试事件 | 移动端统一入口 |
| 管理端表格 | `src/components/admin/AdminTable.vue` | 基于 `n-data-table`，含 `columns/data/loading/pagination/remote/rowKey` 与 `#empty` 插槽 | 直接复用 |
| 语音录制 | `src/components/rightBox/VoiceRecorder.vue` | 录制/计时/播放/重录/发送/权限回调均已实现 | 直接复用 |
| 上传进度 | `FileUploadProgress` | 存在 | 直接复用 |
| 玻璃容器 | `TjGlass` | 35 处引用 | 直接复用 |
| 校验提示 | `src/components/common/Validation.vue` | 圆环 + 勾选 SVG，用于输入校验通过提示 | **扩展**为行内错误展示，不新建组件 |
| 格式化工具 | `src/utils/Formatting.ts` | 单源 | 唯一入口 |

### 16.2 对第 13 章组件清单的修正

| 第 13 章原规划 | 修正结论 | 原因 |
| :--- | :--- | :--- |
| `AsyncStateBoundary` | **取消** | `EmptyState` + `ErrorState` + `ErrorBoundary` + 6 个 `Skeleton*` 已覆盖全部形态；再造一层包装只会增加一层 props 映射 |
| `AdminDataTable` | **取消** | `src/components/admin/AdminTable.vue` 已封装 `n-data-table` 并支持空态插槽 |
| `VoiceRecorder` | **取消** | `src/components/rightBox/VoiceRecorder.vue` 已实现完整交互与权限分支 |
| `UploadProgress` | **取消** | `FileUploadProgress` 已存在 |
| `InlineFieldError` | **改为扩展现有组件** | 在 `Validation.vue` 增加 `tone: 'success' \| 'error'` 与可选 `id`（供 `aria-describedby`），不新建文件 |
| `CapabilityBadge` / `ServiceCapabilityPanel` | **保留为真实缺口（已落地）** | 全仓无同类实现，且第 12 章能力接线需要统一的「可用/不可用/降级」表达 |
| `StickyEventsBanner` | **取消** | 实测已存在 `src/components/rightBox/renderMessage/StickyEventBanner.vue`：最多 3 条、展开、查看、设置、取消、`role="status"` 均已实现，且被 `ChatBanners.vue` 使用；§16.3 原「全仓无同类实现」结论有误，按 R1 不重复造轮子 |
| `StickyEventsEditor` | **取消** | 实测已存在 `src/components/room/settings-tabs/StickyTab.vue`：粘性事件列表、从最近消息添加、调用服务层写入均已实现；同样按 R1 取消 |

### 16.3 真实缺口组件契约

两个新增组件的共同约束：只做展示与事件上抛，不直接调用 SDK；数据由服务层与 store 注入；颜色只用 `--tjg-*`；图标为内联 SVG，`viewBox="0 0 16 16"`、线宽 1.5px。

**`CapabilityBadge`**（`src/components/common/CapabilityBadge.vue`）

| 项 | 契约 |
| :--- | :--- |
| props | `state: 'ready' \| 'degraded' \| 'unavailable'`、`label?: string`、`compact?: boolean` |
| 语义 | 状态必须同时有文案与图形（`--tjg-status-*` token），不允许只靠颜色区分 |
| 插槽 | 默认插槽覆盖 label |
| a11y | `role="status"`；`unavailable` 时附带可聚焦说明入口 |
| i18n 前缀 | `common.capability.*` |

**`ServiceCapabilityPanel`**（`src/components/common/ServiceCapabilityPanel.vue`）

| 项 | 契约 |
| :--- | :--- |
| props | `items: Array<{ key: string; label: string; state: 'ready' \| 'degraded' \| 'unavailable'; hint?: string }>` |
| 能力 | 列表渲染 + 折叠；空列表走 `EmptyState`；错误走 `ErrorState` |
| emits | `retry(key: string)`、`openSettings(key: string)` |
| 依赖 | 仅依赖 `CapabilityBadge`，不引入新依赖 |

**取消项与既有实现对照**

| 原规划组件 | 既有实现 | 覆盖的行为 |
| :--- | :--- | :--- |
| `StickyEventsBanner` | `src/components/rightBox/renderMessage/StickyEventBanner.vue`（`ChatBanners.vue` 在用） | 最多 3 条、超出折叠、查看/设置/取消、`role="status"` |
| `StickyEventsEditor` | `src/components/room/settings-tabs/StickyTab.vue` | 列表、从最近消息添加、经 `MatrixRoomService` 写入 |

后续第 12 章接线直接消费上述两个既有组件；如确有形态差异，通过新增 props 扩展既有组件，禁止新建平行组件。

### 16.4 工具函数与 composable 缺口

| 名称 | 位置 | 职责 | 复用判据 |
| :--- | :--- | :--- | :--- |
| `useCapabilityState` | 不新增 | — | `src/services/matrix/MatrixCapabilityService.ts` 已提供 `refreshCapabilities()` 与 `TjgCapability`，与新组合功能重复，按判据删除本项 |
| `useStickyEvents` | 不新增 | — | `StickyTab.vue` 已承载粘性事件的状态与读取；不另建平行 composable |
| `toViewportUnit` | 不新增 | `100vh` 改 `100dvh` 属 CSS 层修正 | 见 §17.4，用样式解决，不写运行时工具 |

**禁止新增**：`formatBytes` / `formatSize` / `formatTime` 的平行实现（已有 `src/utils/Formatting.ts` 与各 composable 内的既有实现）；`useMediaQuery` 的平行实现（若需断点判断，先查 `src/utils/performanceTier.ts` 与既有 composable）。

### 16.5 复用率目标与守门

| 指标 | 当前 | 目标 | 守门方式 |
| :--- | :--- | :--- | :--- |
| 新增组件是否先检索既有实现 | 无强制 | 100% 记录检索结论 | PR 模板增加一行「已检索的既有组件与不复用原因」 |
| 空态/错误态复用 | 32 个文件引用 EmptyState/ErrorState | 不新增手写空态 | `check:component-contracts` 扩展：新增 `empty-state` 字面量块即告警 |
| 组件契约完整性 | 4 条失效白名单 | 0 条失效 | `pnpm check:component-contracts` |
| 新增文件体量 | 红线 400 行 | 保持 | `pnpm check:file-size` |

### 16.6 落地记录（2026-11-14）

第 16 章实际交付收窄为 2 个新组件 + 1 处既有组件扩展，取消项均按 R1 复用既有实现。

| 交付物 | 文件 | 说明 |
| :--- | :--- | :--- |
| 能力三态类型 | `src/types/capability.ts` | `CapabilityState` 与 `CapabilityItem`，与 `MatrixCapabilityService` 的 `TjgCapability` 对齐 |
| 能力徽标 | `src/components/common/CapabilityBadge.vue` | 三态图标 + 文案；`unavailable` 提供可展开说明（`aria-expanded` / `aria-controls`），`compact` 用 clip 视觉隐藏文案但保留读屏 |
| 能力面板 | `src/components/common/ServiceCapabilityPanel.vue` | 列表 + 超过 5 条折叠；空态走 `EmptyState`，错误态走 `ErrorState`；`retry(key)` / `openSettings(key)` 仅上抛事件 |
| 行内错误态 | `src/components/common/Validation.vue` | 新增 `tone: 'success' \| 'error'`、`id`，错误态渲染 `role="alert"` 与 danger token 图形 |
| 文案 | `locales/{zh-CN,en}/common.json` | 新增 `capability` 命名空间 13 个 key；同步 `src/typings/i18n/common.d.ts` |
| 单测 | `src/components/common/__tests__/{CapabilityBadge,ServiceCapabilityPanel,Validation}.test.ts` | 15 个用例全部通过 |

取消项：`StickyEventsBanner`、`StickyEventsEditor`、`useCapabilityState`、`useStickyEvents`（见 §16.2 / §16.3 / §16.4 的实测依据）。

---

## 17. 多端适配与性能优化

### 17.1 现状盘点

| 测量项 | 实测 | 判定 | 动作 |
| :--- | :--- | :--- | :--- |
| 路由懒加载 | 132 处 | 已达标 | 保持，新增路由必须懒加载 |
| 虚拟列表 | 20 个文件涉及 | 长列表已覆盖 | 新增长列表必须走 `SmartVirtualList` 或既有虚拟组件 |
| `prefers-reduced-motion` | 63 个文件 | 基本达标 | 新增动效必须声明 |
| `prefers-reduced-transparency` | 6 个文件 | 覆盖不足 | 玻璃增强模块补齐（见 §17.6） |
| `env(safe-area-inset-*)` | 17 处（2026-11-17 复核：底部固定栏由 `tabBar` / `MobileLayout` / `responsive.scss` 统一消费，全屏遮罩不适用） | 底部栏已覆盖 | 留白仍以真机回归为准（§17.3） |
| `100vh` | 29 处（2026-11-17 复核：15 处真实 `height: 100vh` 所在文件全部已有 `100dvh`；其余为 `var(--tjg-viewport-height, 100vh)` 二级兜底，主变量已在 `responsive.scss` 用 `100dvh` 覆盖） | 回退对已成立 | 新增计数锁 `vh_unpaired` 看住回归，不再逐个改 |
| `loading="lazy"` | 2026-11-17 复核：全仓 117 处 `<img>`，7 处已声明；本轮给 9 个列表容器补 10 处（含 `decoding="async"`） | 列表容器已补齐；消息区图片由 `isInViewport` 可见性门控（强于原生 `lazy`） | 新增守卫 `tests/lint/image-lazy-loading.test.ts`，新增列表容器必须登记 |
| 触控目标 ≥44px 声明 | 约 5 个文件 | 不足 | 移动端可点击元素统一到 44×44 |
| 断点声明 | 2026-11-17 复核：`@media ... 1200px` 实测 0；16 处 `max-width: 1200px` 全为 admin 页面容器宽度，不是媒体查询 | 已达标（无 1200px 断点） | 新增计数锁 `breakpoint_1200` 看住回归 |
| 玻璃性能分级 | `src/utils/performanceTier.ts` 已将 `coarsePointer` 判为 `medium`；`src/styles/scss/global/mobile.scss` 已消费 `html.low-perf` / `html.medium-perf` | 第 1 章 G1/G2 已闭环 | 不重复立项，仅补回归用例 |

### 17.2 断点与栅格统一

| 断点 | 语义 | 布局规则 |
| :--- | :--- | :--- |
| `< 768px` | 移动端单列 | 单栏、底部导航、抽屉式侧栏；禁止三栏 |
| `768px - 1023px` | 平板 | 双栏（列表 + 内容），侧栏折叠为图标条 |
| `1024px - 1439px` | 桌面标准 | 三栏，右侧栏可折叠 |
| `≥ 1440px` | 桌面宽屏 | 三栏 + 内容区最大宽度约束，避免文字行宽超 80 字符 |

落地要求：新增媒体查询只能使用上述四个值。2026-11-17 复核确认仓库内**已无** `@media ... 1200px`；剩余 `max-width: 1200px` 均为 admin 页面容器宽度（布局宽度，不是断点），不需要替换。回归由 ratchet 计数 `breakpoint_1200` 看住。

### 17.3 触控与安全区

- 移动端所有可点击元素最小 `44×44px`（图标可 20-24px，但热区必须撑满）。
- 底部固定栏（输入坞、TabBar、浮动操作）必须叠加 `padding-bottom: env(safe-area-inset-bottom)`。
- 列表项滑动操作需提供非手势替代路径（长按菜单），避免与系统返回手势冲突。
- 触控反馈用 `active` 态颜色/透明度变化，禁止用 `scale` 造成布局位移。

### 17.4 视口单位修正

```scss
/* 移动端全屏容器：dvh 优先，vh 回退 */
.app-shell {
  height: 100vh;
  height: 100dvh;
}
```

约束：`100dvh` 只用于整屏容器与底部固定层；内容区高度继续用 `flex: 1` / `min-height: 0`，不堆叠多套单位。

### 17.5 图片与列表性能

| 场景 | 要求 |
| :--- | :--- |
| 列表 / 消息区图片 | `loading="lazy"` + `decoding="async"`；首屏可视区可用 `loading="eager"` |
| 头像 | 统一尺寸档位，避免超采样；`srcset` 仅在确有多分辨率资源时使用 |
| 长列表 | 超过 100 条必须虚拟化；已有 `SmartVirtualList` 优先复用 |
| 图片查看器 | 打开时按目标尺寸请求，不加载原图作为缩略图 |

### 17.6 动效与偏好

| 偏好 | 行为 |
| :--- | :--- |
| `prefers-reduced-motion: reduce` | 关闭位移/缩放/视差，仅保留 ≤100ms 透明度过渡 |
| `prefers-reduced-transparency: reduce` | 玻璃面降级为不透明 token 底色，关闭 `backdrop-filter` |
| 低性能档 `html.low-perf` | 关闭玻璃与模糊，动效降级 |
| 触控设备 `coarsePointer` | 判为 `medium` 档，减少同时存在的玻璃面数量 |

### 17.7 性能预算

| 指标 | 预算 | 采集方式 |
| :--- | :--- | :--- |
| 首屏 JS（gzip） | ≤ 350 KB | `pnpm metrics:bundle` |
| LCP | ≤ 2.5s（桌面中端机） | `WebVitalsObserver` 上报 |
| INP | ≤ 200ms | 同上 |
| CLS | ≤ 0.1 | 同上 |
| 主线程长任务 | < 50ms | SDK 重活必须留在 `src/workers/matrixSdk.worker.ts` |
| 玻璃面同屏数量 | ≤ 3 | 设计评审 + 目视回归 |

2026-11-17 运行态采样（`pnpm build` + `vite preview:4175` + `scripts/collect-perf.mjs`，3 次取均值）：LCP 587.00ms、CLS 0.0000，均在预算内；INP 尚未采样（脚本未收该指标），见 §19.57。

2026-11-17 补充采样（同一链路，脚本已扩 INP，3 次 × 15 次交互）：每次 INP 48 / 88 / 120ms，跨采样均值 85.33ms、p75 120ms、最差 120ms，均 ≤200ms 预算；LCP 534.65ms、CLS 0.0000，详见 §19.60。

---

## 18. 界面统一与美化

### 18.1 设计 token 唯一来源

- 权威文件：`src/styles/css/design-tokens.css`；`src/styles/scss/global/variable.scss` 仅作旧别名层，禁止新增变量。
- 新代码一律 `--tjg-*`；`pnpm check:ratchet` 拦截新增 `#xxx` / `rgb()` / `rgba()`。
- 语义色与状态色走 `--tjg-status-*`，禁止业务侧自定义「红/黄/绿」。

### 18.2 字体与排版

| 项 | 规范 |
| :--- | :--- |
| 字体族 | 39 处 `font-family` 声明收敛到 `--tjg-font-sans`（正文）与 `--tjg-font-mono`（代码/ID/密钥） |
| 字号档位 | `--tjg-font-size-xs/sm/md/lg` 四档，不再引入 13px、15px 等中间值 |
| 正文行高 | 1.5；标题 1.25；单行列表项用固定高度而非行高凑 |
| 字重 | 常规 400 / 中 500 / 强调 600，不使用 700 以上 |
| 数字对齐 | 时间、未读数、容量使用等宽数字（`font-variant-numeric: tabular-nums`） |

### 18.3 图标

- 必须 SVG：`<svg>`、`<use href="#xxx">` 或 Iconify；禁止 div + 背景图伪图标，禁止 emoji 当图标。
- 统一 `viewBox="0 0 24 24"`、线宽 1.5px、`aria-hidden="true"`（纯装饰时）。
- 现有 `#voice` / `#close` / `#refresh` / `#send` 等 symbol 引用方式符合规范，新增图标沿用同一 sprite 机制。
- 同一屏内图标尺寸只允许两档（如 16px 与 20px），禁止随手 14/18/22 混用。

### 18.4 间距、圆角与层级

| 类别 | 阶梯 |
| :--- | :--- |
| 间距 | 4 / 8 / 12 / 16 / 24 / 32（`--tjg-space-*`），禁止 6/10/14 等中间值新增 |
| 圆角 | 小 8 / 中 12 / 大 16 / 胶囊 999；卡片与弹层各自固定，不逐组件漂移 |
| 阴影 | 三级（浮起/弹层/模态），全部走 token，禁止手写 `box-shadow` 字面量 |
| 层级 z-index | 内容 0 / 粘性头 10 / 侧栏 20 / 浮层 30 / 弹窗 40 / Toast 50 |

### 18.5 状态与反馈统一

| 状态 | 统一实现 |
| :--- | :--- |
| 加载 | `Skeleton*`（保持容器形状）或 `Loading` 指示器；禁止空白等待 |
| 空 | `EmptyState` / `MobileAsyncState` 的 `empty` |
| 错误 | `ErrorState` / `MobileAsyncState` 的 `error`，必须带重试 |
| 成功/失败操作反馈 | 统一 Toast 或内联提示，同一场景只用一种 |
| 能力不可用 | `CapabilityBadge` 的 `unavailable` + 说明入口，不静默失效 |

### 18.6 深浅色对比

- 正文对比度 ≥ 4.5:1，次要文字 ≥ 4.5:1（不使用浅灰正文）。
- 浅色玻璃卡不透明度 ≥ 0.8；深色玻璃卡保证正文可读，不靠提高模糊度硬撑。
- 边框在浅色下必须可见（使用 token 描边，不用白色低透明度）。
- 状态不能只靠颜色：必须「文案 + 图形 + 颜色」三选二以上。

### 18.7 视觉一致性检查清单

- [x] 无新增硬编码颜色，`pnpm check:ratchet` 通过。 —— 2026-11-15 复跑 exit 0：`hardcoded_radius 0`、`inline_style 5/5`（allowlist 内）、`important_css 39/39`、`zh_literal_vue 0`、`as_unknown_as 0`。2026-11-21 复跑 exit 0：`important_css 20/20`、`backdrop_filter_raw 4/4`，其余持平。
- [x] 无 emoji 图标，新增图标为 24×24 SVG、线宽 1.5px。 —— 模板段扫描无 emoji 图标；`pnpm check:icon-colors` exit 0（585 处走 token）、`pnpm check:svg-aria` exit 0（587 处 SVG 装饰图标）。24×24 与 1.5px 线宽的逐图标几何抽查并入 §19.3 运行态视觉走查。
- [x] 间距/圆角/阴影只取自 token 阶梯。 —— `pnpm check:tokens` exit 0：token 总数 224、零引用 0、使用率 100.0%（阈值 85%）；`check:ratchet` 的 `hardcoded_radius` 为 0。
- [x] 加载、空、错误三态均有统一实现，无手写空态块。 —— 2026-11-16 已将该口径固化为 `check-ratchet` 的 `handwritten_empty_state` 计数器，七批迁移后 **0 处 / 0 文件**、基线锁定 0（`pnpm check:ratchet` exit 0，批次明细见 §19.8）；后续任何新增手写空态会直接 FAIL。
- [x] 375 / 768 / 1024 / 1440 四档无横向滚动、无内容遮挡固定栏。 —— 2026-11-16 运行态实测（`http://127.0.0.1:6130/login`，Playwright 设置视口）：四档 `scrollWidth === clientWidth`、`overflowCount = 0`、关键元素未被遮挡；仅覆盖未登录登录页，内页见 §19.3。
- [x] `prefers-reduced-motion` 与 `prefers-reduced-transparency` 下无位移动效、无模糊依赖。 —— `prefers-reduced-motion` 覆盖 66 个文件 68 处（含 `src/styles/scss/global/mobile.scss:283` 全局规则）；`prefers-reduced-transparency` 5 个文件 7 处，落点为 `src/styles/scss/global/glass.scss:80` 与 `src/styles/scss/global/mobile.scss:211`；`design-tokens.css:731` 用 `transition-duration: 0.01ms !important` 兜底关闭动效。
- [x] 图标按钮具备 `aria-label`，可点击元素具备 `cursor-pointer` 与焦点可见态。 —— `pnpm check:icon-button-aria` exit 0、`pnpm check:svg-aria` exit 0；本轮新增的 `ServiceCapabilityPanel` 重试/设置按钮带 `aria-label`、`focus-visible` 描边与 `cursor: pointer`。

---


## 19. 历史实施索引（2026-11-14 ~ 11-19，全部已完成）

> 本章原为逐条实施记录，合计约 4800 行。这些任务**均已落地**，按「删除已完成的优化任务」
> 的要求压缩为索引：保留事项名便于回溯，不再保留过程描述、验证命令与文件清单。

| # | 事项 |
| :--- | :--- |
| 19.1 | 已执行门禁实测 |
| 19.2 | 单元测试失败分诊 |
| 19.3 | 未执行项与原因 |
| 19.4 | 分批回归矩阵 |
| 19.5 | 本次变更范围与验证结论 |
| 19.6 | 门禁债务收口 |
| 19.7 | 服务能力面板接线与验收清单取证 |
| 19.8 | 空态门禁与统一迁移 |
| 19.9 | 运行态取证：对比度与键盘走查及三处缺陷修复 |
| 19.10 | partial 态统一件与首批接入 |
| 19.11 | partial 态第二批：业务端伪空态收口 |
| 19.12 | AdminDashboard 页面级用例 |
| 19.13 | isMobile() 内联分支收敛 |
| 19.14 | 房间成员 / 房间设置局部失败信号接入 |
| 19.15 | 用户 / 房间 / 举报页四态用例 |
| 19.16 | 房间成员 / 房间设置的写失败保留输入 |
| 19.17 | 成员加载错误映射的生命周期 |
| 19.18 | 消息列表的局部失败信号 |
| 19.19 | 把 `clearAllData()` 接进登出链路 |
| 19.20 | 消息缓存也随登出丢弃 |
| 19.21 | 其余业务区块四态核对 |
| 19.22 | 媒体库配额接真实数据 |
| 19.23 | `isMobile()` 下沉第一组：移动端相册扫描 |
| 19.24 | `isMobile()` 下沉第二组：右键菜单守卫平台判定上移 |
| 19.25 | `isMobile()` 下沉第三组：视频查看器的死守卫 |
| 19.26 | P0-6｜右键菜单桌面专属项的构建期裁剪 |
| 19.27 | P0-7｜共享聊天组件 5 处 isMobile 分支下沉 |
| 19.28 | P0-8：管理端写操作的失败保留与重试判据 |
| 19.29 | P0-9：媒体配额三态与上传 / 删除后即时刷新 |
| 19.30 | P0-10：空间房间变更后刷新失败不再冒充变更失败 |
| 19.31 | P0-11：组件体量收口、媒体 MIME 标准映射与消息加载失败结构化 |
| 19.32 | P0-12：SpaceChildrenPane 状态层与操作层拆分 |
| 19.33 | P0-13：右键菜单列表按用途拆分三模块 |
| 19.34 | P0-14：移动端右键菜单桌面专属项收口 |
| 19.35 | P0-15：消息加载失败按网络 / 权限 / 服务端分级展示 |
| 19.36 | P0-16：空间建房「已建未挂载」中间态与刷新失败提示保留 |
| 19.37 | P0-17：空间建房中间态提供「重新加入空间」一键动作 |
| 19.38 | P1-1：SpaceChildrenPane 测试基建修复 |
| 19.39 | P1-2：MIME 推导优先级统一 |
| 19.40 | P3/A8：`isMobile()` 分支下沉第二批次 |
| 19.41 | P1-3：上传链路 MIME 兜底统一 |
| 19.42 | P1-4：上传 MIME 文件头嗅探兜底 |
| 19.43 | P3/A8：平台差异实现改为构建期入口装配 |
| 19.44 | 本轮 6 项清单收尾核对 |
| 19.45 | P3/A8 收尾：`isMobile()` 判定器改为构建期常量 |
| 19.46 | 阶段 D / 附录 B：液态玻璃候选核实与 D1 准入门槛 |
| 19.47 | §17 存量收敛：列表图片懒加载与 ratchet 计数锁 |
| 19.48 | 批次 A2：Storybook 视觉回归基线补齐 |
| 19.49 | 批次 B（离线子集）：对比度矩阵与后台路由门控判据 |
| 19.50 | 批次 B（离线子集）：右键菜单键盘导航缺陷修复 |
| 19.51 | 三仓未闭环清单前端问题复核与修复 |
| 19.52 | §19.51 开放项收口：UI 面补齐 |
| 19.53 | §19.52 改动的单测补强 |
| 19.54 | 异步区块局部失败信号补全 |
| 19.55 | 媒体库配额区四态补全 |
| 19.56 | 批次 B（离线子集）：桌面键盘主流程 E2E |
| 19.57 | 批次 B（账号型运行态）：live E2E 与 Web Vitals 实测 |
| 19.58 | 阶段 C3：安全区与键盘弹起的移动视口回归 |
| 19.59 | 批次 1：离线代码收口 |
| 19.60 | 批次 3：INP 运行态采样 |
| 19.61 | 批次 2：账号型运行态取证 |
| 19.62 | 批次 4：液态玻璃 D1 临时 POC 取证 |
| 19.63 | 移动端配额提示形态统一 |
| 19.64 | 账号内页四态全量核对与首批修复 |
| 19.65 | 失败显示默认枚举的 4 处修复 |
| 19.66 | 剩余高严重度桌面第二批四态修复 |
| 19.67 | 剩余高严重度房间面板四态修复 |
| 19.68 | 剩余高严重度桌面最后 3 处四态修复 |
| 19.69 | 移动端高严重度最后 3 处四态修复 |
| 19.70 | 中严重度桌面 7 处四态修复 |
| 19.71 | 中严重度移动端 3 处四态修复 |
| 19.72 | 低严重度 7 处四态收尾 |
| 19.73 | 消息列表失败边界收口（实时帧 / 历史翻页 / 跳转定位） |
| 19.74 | 前端遗留问题订正 |
| 19.75 | S3-B1｜ROOM-03 三端点接线 |
| 19.76 | S3-B2｜ROOM-03 收尾：`members/recent` 接到成员 Tab |
| 19.77 | S3-B3｜B.1 剩余 P3 三端点：`permissions` / `spaces` / `turn_server` |
| 19.78 | ADM-05 收尾｜全局邀请名单整体替换，8/8 端点接通 |
| 19.79 | CAP-02 / CAP-03 收尾｜三入口能力门控 + OIDC 未启用态 |
| 19.80 | S3-B6｜§19.74 P2 余量全量核销 |
| 19.81 | S3-B7｜MED-04 移动端服务端配额接线 + VEN-04 核销 |
| 19.82 | 门禁复位与 N-03 清偿 |
| 19.83 | 重构债清偿｜SecureBackupDialog + ChatMain 双降 |
| 19.84 | 重构债清偿｜FriendsSettings + SpaceView 双降 |
| 19.85 | 重构债清偿｜P2 余量五项 |
| 19.86 | 服务层超限文件收尾：房间操作 / Crypto 状态机 / 账号服务 |
| 19.87 | 媒体配额告警语义修复｜`getQuotaAlerts()` 不再把失败折叠成空数组 |
| 19.88 | 媒体库文件列表接入｜`ChatSidebarFiles.vue` 从固定空态改为 `/messages` 分页扫描 |
| 19.89 | CAP-08 收尾｜加密设置只读误锁修复 |
| 19.90 | 移动端 Toast / ActionSheet 玻璃化与 vitrio D2 登记 |
| 19.91 | CAP-08 能力真值表改用真实后端快照 |
| 19.92 | CAP-08 能力位矩阵输入改为「别名表 ∩ 真实快照」推导 |
| 19.93 | 实时帧失败横幅接入分级文案 |
| 19.94 | S-01／N-08 能力映射表接入 SDK 真值 |
| 19.95 | 文件页签后续能力｜缩略图 / 下载 / 跳转原消息 |
| 19.96 | MatrixCryptoStateTracker `doEnsureCrypto` 下沉 |
| 19.97 | 死依赖清理｜`vite-plugin-vue-setup-extend` 及同类排查 |
| 19.98 | 超限文件拆分｜timelineOutcomes / ChatSidebarFiles / EncryptionSettings |

> 逐条的原始记录见 git 历史（本文件 2026-11-22 之前的版本）。

---

## 20. 登录页 v2 方案落地（2026-11-14）

### 20.1 现状核对结论

`docs/UI-优化方案-v2.md` 的 6 项要求中，4 项在本次改动前已存在：桌面 `LoginHomeserverField.vue`（含折叠高级提示）、移动 `MobileLoginForm.vue` 的 Homeserver 字段、`tjg-gradient-button` 已全程消费 `--tjg-color-primary-*` 渐变 token、`login.input.homeserver.*` 中英文案齐备。缺口集中在**输入校验与无障碍语义**：

| 缺口 | 影响 | 处置 |
| :--- | :--- | :--- |
| Homeserver 输入无格式/必填校验 | 用户可提交 `not a url` 后才在登录流程失败，错误定位成本高 | 失焦时校验，非法值只提示不改写，合法值补齐协议 |
| 高级提示与输入框无 `aria-describedby` 关联 | 屏幕阅读器读不到提示与错误文案 | 提示区 `id=login-homeserver-hint` / 错误区 `id=login-homeserver-error`（`role="alert"`）动态挂到 `aria-describedby` |
| 输入框无 `aria-invalid` / 错误态边框 | 键盘与读屏用户无法感知错误状态 | `aria-invalid` + `n-input` 的 `status="error"` |
| 移动端错误文案缺少 `role="alert"` 语义 | Vant `error-message` 仅视觉呈现 | 由 `van-field` 的 `error-message` + `aria-invalid` + `aria-describedby` 补齐 |

### 20.2 改动文件

| 文件 | 改动 |
| :--- | :--- |
| `src/views/loginWindow/LoginHomeserverField.vue` | 新增 `touched` / `errorMessage` / `showError` / `statusBind` / `describedBy`；失焦校验并 `normalizeHttpUrl` 写回；错误文案 `role="alert"`；新增 `.homeserver-error` 样式，颜色取 `--tjg-color-danger-600` |
| `src/mobile/components/login/MobileLoginForm.vue` | 同一套校验逻辑；`van-field` 增加 `name` / `id` / `error-message` / `aria-invalid` / `aria-describedby`；提示区补 `id` |
| `src/services/backend/index.ts` | 导出既有 `normalizeHttpUrl`（原先仅 `config.ts` 内部可引用，barrel 未导出） |
| `locales/zh-CN/login.json`、`locales/en/login.json` | 新增 `login.server_config.homeserver_empty`；非法格式复用既有 `homeserver_invalid` |

校验函数全部复用 `src/services/backend/config.ts` 的 `isPotentialHomeserverInput` / `normalizeHttpUrl`，未新建平行实现（R1）。

### 20.3 验证证据

| 项 | 命令 | 结果 |
| :--- | :--- | :--- |
| 新增单测 | `npx vitest run src/views/loginWindow/__tests__/LoginHomeserverField.test.ts` | `Test Files 1 passed`、`Tests 4 passed`（折叠展开与 `aria-describedby`、空值必填、非法格式、合法域名补协议） |
| 类型检查 | `pnpm vue-tsc --noEmit` | exit 0，无输出 |
| Lint / 格式 | `npx biome check`（6 个改动文件） | `Checked 6 files ... No fixes applied.` |
| 硬编码守护 | `pnpm check:ratchet` | 全部 OK（`zh_literal_vue: 0`、`hardcoded_radius: 0`） |
| 移动端 CSS 守护 | `pnpm check:mobile-css` | `OK — 165 个文件` |
| 全量单测 | `pnpm test:run` | `991 passed (991)`、`11150 passed (11150)`、`Duration 1608.18s` |
| 全量 lint / i18n | `pnpm check` | `Checked 2770 files ... No fixes applied.`；`i18n check passed!`；`check-i18n-refs: OK unresolved 0 / fallback 0`；token 使用率 100%、icon-button-aria / svg-aria / dead-handlers / capabilities-sync 全 OK |
| 文档覆盖 | `pnpm check:doc-coverage` | `OK — no regressions vs baseline`（587，基线 587） |
| 文档路径 | `pnpm check:doc-paths` | `OK：全部路径存在`（.rules 35 个路径引用） |
| SDK 边界 | `pnpm check:sdk-boundary` | `OK — no regressions vs baseline`（156，基线 156） |
| 裸请求守护 | `pnpm quality:no-raw-fetch` | `OK: 所有裸请求均在白名单内`（命中 3，均白名单） |

### 20.4 剩余章节落地（2.3 / 3.2 / 5.2 / 6.2）

| 章节 | 要求 | 落地方式 |
| :--- | :--- | :--- |
| 2.3 宽度约束 | 认证视图最大宽度 375px | `src/mobile/login.vue` 两处标题行、`MobileLoginForm` 与 `MobileRegisterForm` 根容器追加 `max-w-375px`，宽屏下与表单同宽居中；窄屏仍为 `w-80%` 不受影响 |
| 3.2 渐变按钮 | 统一渐变、悬停/按压/禁用/加载 | 既有 `.gradient-button`（`src/styles/scss/login.scss`）已用 `--tjg-color-primary-*` / `--tjg-brand` token 覆盖四态，本轮仅补动态偏好降级，未重写视觉 |
| 5.2 动画 | 时长与降级 | 折叠区 `max-height 0.25s`、图标 `duration-200` 既有；新增 `@media (prefers-reduced-motion: reduce)` 关闭加载脉冲与位移 |
| 6.2 ARIA | 登录按钮语义 | 桌面 `n-button` 与移动 `van-button` 补 `:aria-label="loginText"`、`:aria-busy`；输入框沿用 `sr-only` label + `aria-describedby`，比 `aria-label` 更利于读屏 |

验证：`npx vitest run src/mobile/__tests__/loginLayout.test.ts src/mobile/__tests__/login.test.ts src/views/loginWindow/__tests__` → 9 files / 34 tests passed；`pnpm vue-tsc --noEmit` exit 0；`npx biome check` 4 files 无修复项；`pnpm check:mobile-css` → `OK — 165 个文件`。

### 20.5 剩余章节收口（2.1 / 2.2 / 4.1-4.3 / 5.1 / 6.1）

逐条对照 `docs/UI-优化方案-v2.md` 与实现，只处置真实缺口：

| 章节 | 审计结论 | 处置 |
| :--- | :--- | :--- |
| 2.1 移动页面结构 | 375px 上限、原生 `<form>` 提交、头像与协议区、Homeserver 字段均已具备；唯一实质缺口是登录/注册选项卡为 `<div @click>`，键盘与读屏用户不可达 | `src/mobile/login.vue` 改为原生 `<button type="button">`，补 `aria-pressed` 表达选中态，装饰指示条 `aria-hidden="true"`，`.login-tab:focus-visible` 提供 2px 焦点环 |
| 2.2 桌面页面结构 | 固定 420×580 Tauri 窗口内居中 `login-box`，结构已符合 | 无需改动；文档 5.3 的 `min-width: 1024px` 媒体查询面向浏览器全屏，固定窗口不适用 |
| 4.1 / 4.2 色彩 token | 文档表格为原型色值，实现权威是 `--tjg-surface-app` / `--tjg-surface-panel` / `--tjg-surface-raised`，语义与明暗双份完整 | 无需改动；不引入文档中的字面色值（违反 token 单源） |
| 4.3 对比度实测 | 白字/#0f7a66 = 5.3:1、白字/#13987f = 3.6:1、白字/#1ab292 = 2.7:1；占位 #858585 叠 `rgba(33,33,33,0.95)` ≈ 4.4:1，浅色 tertiary #737373 叠 `rgba(255,255,255,0.85)` ≈ 3.6:1 | 真实不达标项：主按钮亮端渐变、加载态、占位与提示文字。按下方文件表修正 |
| 5.1 状态管理 | 登录态由 `src/shared/composables/useLoginFlow.ts` 跨端统一承载，Homeserver 校验已在 3.1 落地 | 无需改动；新增 Pinia store 会与既有单一数据源（ADR-003）形成双源 |
| 6.1 无障碍 | 30s 登录超时保护已在 `useLoginFlow` 实现；按钮与输入 ARIA 已在 6.2 落地；键盘缺口即 2.1 的选项卡 | 随 2.1 修复；超时与 ARIA 不作重复改动 |

| 文件 | 改动 |
| :--- | :--- |
| `src/mobile/login.vue` | 选项卡 `div` → `button` + `aria-pressed`；指示条 `aria-hidden`；新增 `.login-tab` 焦点环（`--tjg-color-primary-500`） |
| `src/styles/scss/login.scss` | 主按钮悬停、加载态与暗色默认态渐变统一收敛到 `--tjg-color-primary-600`/`700` 深色端（白字最低 5.3:1），保留悬停上浮与加载脉冲作为状态反馈；新增输入框占位色规则，改用 `--tjg-text-secondary` |
| `src/mobile/components/login/MobileLoginForm.vue` | 占位变量与 Homeserver 提示文案颜色由 `--tjg-text-tertiary` 提升到 `--tjg-text-secondary`（暗色 ≈5.0:1 / 浅色 ≈7.6:1） |

验证：`npx vitest run src/mobile/__tests__/login.test.ts src/mobile/__tests__/loginLayout.test.ts src/shared/composables/__tests__/useLoginFlow.test.ts src/views/loginWindow/__tests__/LoginHomeserverField.test.ts` → 4 files / 18 tests passed；`npx biome check`（3 个改动文件）无修复项；`pnpm check:ratchet` 全项与基线一致（`hardcoded_color: 0`）；`pnpm check:mobile-css` → `OK — 165 个文件`；`pnpm vue-tsc --noEmit` exit 0。

### 20.6 第 7 章与附录 A/B 收口 + 登录页玻璃底文字对比度补完

| 章节 | 审计结论 | 处置 |
| :--- | :--- | :--- |
| 7.1 组件实现 | Homeserver 输入（折叠 + 校验 + 失焦回填）、渐变主按钮、中英双语文案均已落地 | 无需改动；文档中的 `HomeserverInput` 即实现里的 `LoginHomeserverField` |
| 7.2 联调与测试 | 表单原生化、`aria-busy`/`aria-invalid`/`aria-describedby`/`role="alert"`、明暗双主题覆盖均已具备；仓库已有 `@axe-core/playwright` 与 `pnpm check:a11y`，但该门禁只扫描 Storybook story，登录组件无 story，故不在其覆盖范围 | 无需改动；本轮以源码 ARIA 断言与单测取证，不为本页面新增 story（避免扩大范围与构建成本） |
| 7.3 移动端与响应式 | Vant 表单、Homeserver 提示、375px 宽度上限已在 2.1/2.3 落地 | 无需改动 |
| 附录 A 参数映射 | 文档色值为原型命名（`--color-primary` 等），实现以 `--tjg-*` 为准 | 无需改动 |
| 附录 A i18n | `login.input.homeserver.*`、`login.mobile.tabs.*`、`login.sso_login_failed` 中英双侧均存在且被引用 | 无需改动 |
| 附录 B/C 参考与禁用写法 | 均为参考链接与约束条款，不产生代码 | 无需改动 |

同时补完 20.5 未覆盖的登录页玻璃底文字：tertiary/quaternary 在**登录页半透明底**（浅色 `rgba(255,255,255,0.85)` 叠品牌渐变、暗色 `rgba(33,33,33,0.95)`）上实测约 4.4:1，略低于 AA 4.5:1；token 本身在 `--tjg-surface-app`/`--tjg-surface-panel` 上仍满足 4.54:1（`design-tokens.test.ts` 已锁定），因此只调登录页取色，不动全局 token。

| 文件 | 改动 |
| :--- | :--- |
| `src/views/loginWindow/LoginHomeserverField.vue` | `.homeserver-hint` 由 tertiary 提升到 secondary |
| `src/views/loginWindow/ManualLoginForm.vue` | 协议勾选说明文案由 tertiary 提升到 secondary |
| `src/views/loginWindow/QRCode.vue` | 扫码状态、刷新覆盖层、加载提示、Rendezvous 提示由 tertiary/quaternary 提升到 secondary |
| `src/views/loginWindow/Network.vue` | 「返回」入口由 tertiary 提升到 secondary |
| `src/views/loginWindow/SecretChatModal.vue` | 说明文案由 tertiary 提升到 secondary |
| `src/mobile/components/login/MobileLoginForm.vue` | 协议勾选说明文案由 tertiary 提升到 secondary |
| `src/mobile/components/login/MobileRegisterForm.vue` | 协议勾选说明文案由 tertiary 提升到 secondary |
| `src/mobile/components/login/MobileCaptchaVerify.vue` | 验证码加载/未验证占位文字由 tertiary 提升到 secondary |

未改动：`LoginBottomBar.vue` 的 `hover:bg-[--tjg-text-tertiary]30`（悬停底色）、`ManualLoginForm.vue` 的 `color-mix(... tertiary 20%)`（分隔线）、`AutoLoginForm.vue` / `ManualLoginForm.vue` 的 `tertiary` 按钮属性 —— 均非文本取色。

验证：`npx vitest run`（10 files / 38 tests passed，含 `loginLayout`、`QRCode`、`ThirdPartyLogin`、`LoginHomeserverField`、`OidcCallback`、`useLoginFlow`）；`npx biome check`（8 个改动文件）无修复项；`pnpm check:ratchet` 全项与基线一致；`pnpm check:mobile-css` → `OK — 165 个文件`；`pnpm vue-tsc --noEmit --incremental` exit 0。

---

---

## 21. 本轮排查与下一步（2026-11-22）

### 21.1 排查口径

只统计**可复现的量化事实**，不写主观评价。数据来源为 `grep` 全仓扫描 + `vue-tsc` + 既有门禁。
统计范围：`src/components` / `src/views` / `src/mobile`（排除 `__tests__`、`*.stories.ts`）。

### 21.2 已经做得不错的部分（先确认基线）

| 维度 | 实测 | 说明 |
| :--- | :--- | :--- |
| 旧品牌 token 残留 | **0** | `--hula-*` 已全部清空，文档里还留着的那批已在 `admin-and-private-chat-ui.md` §2.3.5 一并修正 |
| 列表页空态覆盖 | **100%** | 所有 `n-data-table` 所在页面都有 `n-empty` 或 `EmptyState` |
| 表格入口统一 | **28/36 = 78%** | 仅剩 8 个页面仍在自写 `n-data-table` |
| 硬编码色值 | **10 处** | 相比历史基线已收敛，集中在少数可视化组件 |
| 组件零引用 | **0** | 无孤儿组件 |

### 21.3 仍然存在的问题（按影响排序）

#### P0：`outline: none` 切断焦点可见性（31 处）

键盘用户在当前焦点上**看不到任何指示**。WCAG 2.4.7（Focus Visible）明确要求焦点可见。
31 处里需要区分两类：

- 确实删掉了 `outline` 但没有替代焦点样式的 -> **真缺陷**
- 删掉 `outline` 但用 `box-shadow` / `border-color` 做了替代的 -> 只需确认对比度达标

**下一步**：逐个分类，真缺陷统一改用 `:focus-visible` + `--tjg-border-contrast` 的 2px 焦点环。

#### P0：纯图标按钮缺 `aria-label`（10 处）

读屏用户听到的是「按钮」，不知道点了会发生什么。已定位：

```
WidgetManager.vue:5, 21
WidgetDetailPanel.vue:19, 54
ThreadIndicator.vue:11
UserReportDialog.vue:38
EventReportDialog.vue:32
AdminSecurity.vue:5 等
```

**下一步**：按 `§13.7` 的规范补 `aria-label`，文案走 i18n，不写死中文。

#### P1：8 个页面仍自写表格（78% -> 100% 的最后一公里）

剩余：`AdminAppServices` / `AdminGuests` / `AdminNotifications` / `AdminRoomGovernancePanel`
`AdminRooms` / `AdminSaml` / `AdminSpaces` / `AdminUserDetailDrawer`

这些页面的共同特征是 `n-spin` **既包表格也包其他内容**（合计 20 处），删错会让卡片/描述列表失去加载态。

**下一步**：逐页拆 `n-spin` 的包裹范围，而不是机械替换标签。

#### P1：UI 文件超 400 行（8 个）

| 文件 | 行数 |
| :--- | ---: |
| `AdminRooms.vue` | 713 |
| `AdminDashboard.vue` | 687 |
| `ChatSidebar.vue` | 681 |
| `AdminSecurity.vue` | 678 |
| `renderMessage/Video.vue` | 650 |
| `RoomDetailDrawer.vue` | 627 |
| `renderMessage/index.vue` | 627 |
| `renderMessage/File.vue` | 626 |

**下一步**：优先拆 `AdminRooms`（713 行，且是剩余迁移目标之一）与 `renderMessage` 三件套
（Video / index / File 合计 1903 行，可抽公共的消息壳与媒体基类）。

#### P2：弹层组件 30 个，缺少统一壳

`*Drawer.vue` / `*Modal.vue` / `*Dialog.vue` 合计 30 个，宽度、遮罩、关闭行为、焦点管理各写一套。

**下一步**：抽 `TjDrawer` / `TjDialog` 两个壳，把宽度档位、`aria-modal`、焦点移入移出、
`Esc` 关闭统一掉。这是「一次改动、30 处受益」的杠杆点。

#### P2：i18n 文案与视觉规范未联动

§5.4 规定了「按钮用动词、错误说用户能做什么」，但现有文案没有统一审过一遍。

**下一步**：抽样 30 条高频文案做一轮改写，形成「好文案 / 坏文案」对照表放进 §5.4。

### 21.4 下一步执行顺序（建议）

| 顺序 | 事项 | 预估影响面 | 风险 |
| :--- | :--- | :--- | :--- |
| 1 | 31 处 `outline: none` 分类与修复 | 全端键盘用户 | 低（纯 CSS） |
| 2 | 10 处纯图标按钮补 `aria-label` | 读屏用户 | 低 |
| 3 | 抽 `TjDrawer` / `TjDialog` 壳 | 30 个弹层 | 中（要逐个替换） |
| 4 | 剩余 8 个表格迁移 | 后台一致性 | 中（`n-spin` 需逐处判断） |
| 5 | 拆分 8 个超 400 行文件 | 可维护性 | 中 |

前两项是**纯收益、零风险**，建议立刻做；第 3 项是杠杆最大的；第 4、5 项属于结构性还债。

### 21.5 与历史章节的关系

- §19 的 98 条已完成事项已压缩为索引，不再占用篇幅
- §13（UI/UX 设计规范）与 §18（界面统一）仍然是**现行标准**，本次排查的问题都按它们的口径归类
- §2.3.5（阅后即焚实现状态）为本轮另一条线的产出，与 UI 无关，保留原处


## 附录 A｜参数映射表

| 原始建议参数 | 本项目 token | 说明 |
| :--- | :--- | :--- |
| `blur(20px)` | `--tjg-glass-blur-medium`（18px） | 桌面面板默认；strong 28px 用于输入坞/抽屉 |
| `blur(15px)` | `--tjg-glass-blur-soft`（10px）/ medium | 按场景二选一，不新增 15px |
| `sat(180%)` | `--tjg-glass-saturate-strong`（1.8） | `saturate(1.8)` 等价 180% |
| `rgba(255,255,255,0.65)` | `--tjg-glass-tint` | 明色玻璃底 |
| `rgba(30,30,30,0.75)` | 暗色 `--tjg-glass-tint`（主题覆盖） | 不新增暗色字面量 |
| `border: 1px solid rgba(255,255,255,0.4)` | `--tjg-glass-border-soft` | 已含 `1px solid` |
| `box-shadow: 0 4px 30px rgba(0,0,0,0.1)` | `--tjg-glass-shadow-soft` | 品牌化阴影 |
| `border-radius: 20px` | `--tjg-radius-panel`（20px） | 语义圆角 |
| `border-radius: 24px` | `--tjg-radius-sheet`（24px） | 移动端抽屉 |
| `--morph-duration: 400-600ms` | 既有 `--tjg-motion-*` | 不新增时长常量 |

## 附录 B｜参考链接

| 项目 | 用途 | 是否进入产物 |
| :--- | :--- | :--- |
| `vitrio@0.1.2`（npm） | 增强首选且**唯一有效候选**：零依赖、MIT、12.2 KB min / 4.4 KB gzip，导出 ESM/CJS/UMD + `vitrio/vue` | D1 已按平台分层口径完成运行态取证（§19.62）；仍不引入依赖，真机复核归 C3 |
| ~~`https://github.com/xiaofangstudio/liquid-glass-web`~~ | 作废：npm `liquid-glass-web@1.0.0` 仅 346 B 空壳，无源码无仓库（§3.5.2） | 不适用 |
| `https://github.com/QWEA0/Liquid-Glass-Android` | SDF 折射与移动端材质参数参考 | 否 |
| `@callstack/liquid-glass` | iOS 26 `UIGlassEffect` 参数语义参考 | 否 |
| `https://github.com/yydxin/ZalithLauncher2-LiquidGlass/releases/tag/v2.4.11-LiquidGlass` | 桌面玻璃主题的布局与动效参考 | 否 |
| `@yafh/liquid-glass@1.0.3`（npm） | Vue 3 + SVG `feDisplacementMap` 实现参考；10.1 KB gzip，unpacked 5.4 MB，peer `vue ^3.5.25` | 否（备选参考） |
| `liquid-gl`（npm） | WebGPU / WebGL 折射对照；45.7 KB gzip 超 §3.4-5 包体门槛 | 否（仅对照） |
| `@liquidglassjs/element`（npm） | 自定义元素形态参考；element 4.7 KB gzip / core unpacked 88 KB | 否（观察） |
| ~~liquid-glass.io~~ | 作废：域名待售，npm 无同名包（§3.5.2） | 不适用 |
| ~~nmorph~~ | 作废：npm 404，`nmorph.com` 为无关 BPM 站点（§3.5.2） | 不适用 |

## 附录 C｜禁用写法

| 禁用 | 替代 |
| :--- | :--- |
| 组件内写 `rgba(...)` / `#hex` | `var(--tjg-glass-*)` |
| 裸 `backdrop-filter`，无 `-webkit-` | `@include liquid-glass-panel` 或成对声明 |
| 移动端使用 `backdrop-blur-*` 工具类 | SCSS 中成对声明 |
| 裸 `@include liquid-glass` 且无降级 | 改用 `liquid-glass-panel` / `liquid-glass-subtle`，或紧跟 `@include liquid-glass-fallback` |
| 用 `isMobile()` 运行时判断切换玻璃实现 | 使用 `tier` + media query + 独立移动端样式文件 |
| 玻璃容器包裹滚动列表 | 玻璃只用于固定层（导航/标签栏/输入坞/抽屉） |
| 给发送气泡加玻璃 | 保持不透明品牌底，保证 5.26:1 对比度 |
