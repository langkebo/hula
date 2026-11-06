# TJG UI/UX 优化执行计划

> 交付物 2 / 3。配套：[问题清单](./01-issue-inventory.md) · [冗余清理报告](./03-redundancy-report.md)
>
> 判定基线：[MASTER.md](../MASTER.md)、[components.md](../components.md)、[interaction.md](../interaction.md)
> 问题编号沿用问题清单（`M-` 移动端 / `D-` 桌面端 / `S-` 样式 / `A-` 无障碍 / `B-` 工程 / `I-` i18n / `R-` 响应式）

- 版本：1.0
- 原则：先止血、再收口、后打磨；每批次独立可发布、可回滚

---

## 1. 批次总览

| 批次 | 目标 | 覆盖问题 | 出口条件 |
| :--- | :--- | :--- | :--- |
| **B0 热修** | 消除阻断与死入口 | 10 项 P0 + 3 项死代码 | 全部 P0 关闭；`vue-tsc` 0 错误 |
| **B1 结构收口** | 消除双套实现与非法样式 | M-P1-05/06/07/10、D-P1-01/02、S-P1-01/02/05/06/07、D-P0-02 收尾 | 双套工具栏合一；`check:ratchet` 通过 |
| **B2 无障碍与响应式** | 达到可用性底线 | A-P2-01~06、M-P1-01~04、S-P1-04/08/11、R 系列 | `focus-visible` 覆盖率 ≥ 60%；热区 0 违规 |
| **B3 一致性打磨** | token 与动效归口 | S-P2-01~04、M-P2-01~05、P3-01~03 | token 使用率 ≥ 85%；`!important` ≤ 40 |
| **B4 长尾优化** | 剩余 P3 | P3-04~13 | 按资源排期 |

批次间无强依赖，B1 可与 B2 并行；B0 必须先合入。

---

## 2. B0 热修（P0，最高优先级）

### OP-01 修复聊天设置「清空聊天记录」失效

- **对应问题**：M-P0-01
- **优先级**：P0
- **技术实现路径**：
  1. 在 [ChatSetting.vue](file:///Users/ljf/Desktop/hu_ts/Tjg/src/mobile/views/chat-room/ChatSetting.vue#L237-L239) 的 `van-button` 上绑定 `@click="handleClearHistory"`。
  2. `handleClearHistory` 走二次确认（`showConfirmDialog`），确认后调用现有消息服务清空接口，**不得新增平行实现**（R1）。
  3. 清空成功后 `router.back()` 并刷新会话列表；失败走统一错误提示。
- **预期效果**：按钮可点击、有确认、有结果反馈；不再出现「点了没反应」。
- **验收标准**：
  - 点击弹出确认框，取消不产生任何请求；
  - 确认后本地与服务端消息均清空，返回会话列表能看到列表项副标题已重置；
  - 失败时出现可见错误提示，按钮恢复可点。

### OP-02 移除「我的」页分享死入口

- **对应问题**：M-P0-02
- **优先级**：P0
- **技术实现路径**（二选一，建议 A）：
  - **A（回收）**：删除 [Settings.vue](file:///Users/ljf/Desktop/hu_ts/Tjg/src/mobile/components/my/Settings.vue#L14-L20) 的分享按钮、`@click="activate"`、`activate` 空函数、[van-popup](file:///Users/ljf/Desktop/hu_ts/Tjg/src/mobile/components/my/Settings.vue#L38-L40) 及 `active` ref、`mobile_my.share_to` 的引用（key 若停用则同步清理）。
  - **B（补齐）**：真正实现分享（调用系统分享能力），`activate` 改为 `active.value = true`，弹层内提供复制链接/二维码。
- **预期效果**：入口与实现一一对应，无空点击、无死弹层。
- **验收标准**：
  - 全仓库搜索 `activate` 在该文件内 0 命中（方案 A）；
  - 或分享按钮点击 100ms 内出现弹层（方案 B）；
  - `pnpm test:run` 通过。

### OP-03 修复四处暗色白底浅字

- **对应问题**：M-P0-03、M-P0-04
- **优先级**：P0
- **技术实现路径**：
  1. [dynamic/detail.vue:10](file:///Users/ljf/Desktop/hu_ts/Tjg/src/mobile/views/dynamic/detail.vue#L10) 与 `:16` 的 `bg-white` 改为 `bg-[--tjg-glass-row-bg]`（L3 内容面）。
  2. `text-gray-500`（`:13`、`:16`）改为 `text-[--tjg-text-secondary]`。
  3. `ConfirmAddFriend.vue`、`ConfirmAddGroup.vue`、`NoticeEdit.vue` 同样把 `bg-white` 换成 `bg-[--tjg-glass-row-bg]`。
  4. 全局补充 ratchet 规则：`src/mobile/**` 禁止新增 `bg-white` / `text-gray-*`。
- **预期效果**：亮/暗两套主题下文字对比度均 ≥ 4.5:1。
- **验收标准**：
  - 暗色主题下四处页面文字可读，DevTools 取色对比度 ≥ 4.5:1；
  - `pnpm check:ratchet` 通过且新增规则命中数为 0；
  - 亮色主题无回归（截图对比）。

### OP-04 移除 mail 死入口与死页面

- **对应问题**：D-P0-01
- **优先级**：P0
- **技术实现路径**：
  1. 删除 [left/config.tsx:30-L41](file:///Users/ljf/Desktop/hu_ts/Tjg/src/layout/left/config.tsx#L30-L41) 中指向 `/mail` 的菜单项。
  2. 删除 [desktop.ts:68-L70](file:///Users/ljf/Desktop/hu_ts/Tjg/src/router/routes/desktop.ts#L68-L70) 的 `/mail` 路由。
  3. 删除 `src/views/mailWindow/`（详见冗余报告 R-14）。
  4. 同步移除 [i18n 字面量守卫](file:///Users/ljf/Desktop/hu_ts/Tjg/src/mobile/__tests__/i18nLiteralGuards.test.ts#L66) 白名单中的 `mailWindow`。
- **预期效果**：侧栏入口与路由一一对应，无「功能开发中」死页面。
- **验收标准**：
  - 全局搜索 `mailWindow` 0 命中；搜索 `/mail` 仅剩注释或无命中；
  - 侧栏菜单项数量正确，点击各项均进入实现页；
  - `pnpm vue-tsc --noEmit` 与 `pnpm test:run` 通过。

### OP-05 顶层路由补齐统一 layout

- **对应问题**：D-P0-02、D-P1-06
- **优先级**：P0
- **技术实现路径**：
  1. 在 [desktop.ts](file:///Users/ljf/Desktop/hu_ts/Tjg/src/router/routes/desktop.ts) 中把 `/settings`、`/admin`、`/fileManager`、`/trendradar` 的顶级 `component` 改为 `layout/index.vue` + `children`。
  2. 移除各页面自绘标题栏，改用共享 `WindowTitleBar`（新增，收口拖拽区高度、按钮顺序、圆角）。
  3. 逐页比对：拖拽区高度统一，最小化/最大化/关闭按钮位置一致。
- **预期效果**：所有窗口标题栏一致，拖拽热区统一，`/fileManager` 等页面可正常拖动。
- **验收标准**：
  - 5 个窗口逐一验证：可拖拽、可最小化、标题栏高度一致；
  - 无页面残留自绘标题栏（搜索 `data-tauri-drag-region` 仅出现在共享组件内）；
  - 视觉回归截图通过。

### OP-06 注册页滚动兜底

- **对应问题**：D-P0-03、D-P1-03
- **优先级**：P0
- **技术实现路径**：
  1. [registerWindow/index.vue:10](file:///Users/ljf/Desktop/hu_ts/Tjg/src/views/registerWindow/index.vue#L10) 的 `overflow-hidden` 改为 `overflow-y-auto`，并给内容区 `min-h-0`。
  2. `n-checkbox` 外包 `<label>`，或补 `aria-labelledby` 指向条款文本。
- **预期效果**：任意窗口高度下注册表单可完整访问。
- **验收标准**：
  - 窗口高度 480px 时可滚动到提交按钮；
  - 点击条款文案可勾选；读屏可读出条款文本。

### OP-07 来电横幅改为可访问按钮

- **对应问题**：A-P0-01
- **优先级**：P0
- **技术实现路径**：
  1. [CallIncomingBanner.vue](file:///Users/ljf/Desktop/hu_ts/Tjg/src/views/callWindow/components/CallIncomingBanner.vue#L38-L47) 的 `div @click` 改为 `<button type="button">`，补 `aria-label`（接听/拒接）。
  2. `:hover` 背景改为 `--tjg-color-primary-600` / `--tjg-color-danger-600`，与默认底色形成可见差异。
  3. 补 `focus-visible` ring。
- **预期效果**：键盘可接听/拒接，鼠标悬停有明确反馈。
- **验收标准**：
  - Tab 可依次聚焦两个按钮，`Enter`/`Space` 触发；
  - 悬停时按钮背景变化肉眼可辨；
  - 读屏播报「接听」「拒接」。

### OP-08 查看器补键盘操作

- **对应问题**：A-P0-02
- **优先级**：P0
- **技术实现路径**：
  1. [imageViewerWindow](file:///Users/ljf/Desktop/hu_ts/Tjg/src/views/imageViewerWindow/index.vue#L41-L103) 与 [videoViewerWindow](file:///Users/ljf/Desktop/hu_ts/Tjg/src/views/videoViewerWindow/index.vue#L42-L80) 的控件改为 `<button>` 并补 `aria-label`。
  2. 根容器挂 `keydown` 监听：`Esc` 关闭、`+/-` 缩放、`←/→` 切换。
  3. 首个控件 `autofocus`。
- **预期效果**：纯键盘可完成查看与关闭。
- **验收标准**：
  - 打开查看器后按 `Esc` 关闭；Tab 可遍历全部控件；
  - 每个控件有可读名称。

### OP-09 修复文档语言声明

- **对应问题**：A-P0-03
- **优先级**：P0
- **技术实现路径**：[index.html:2](file:///Users/ljf/Desktop/hu_ts/Tjg/index.html#L2) 改为 `lang="zh-CN"`。
- **预期效果**：读屏按中文音素朗读。
- **验收标准**：`document.documentElement.lang === 'zh-CN'`；Lighthouse a11y 不再报 `html-has-lang` 相关错误。

### OP-10 登录过渡尺寸冲突

- **对应问题**：D-P1-05（与 D-P0-02 同批）
- **优先级**：P0（体验阻断级闪动）
- **技术实现路径**：统一 [DesktopSessionTransition.ts:61](file:///Users/ljf/Desktop/hu_ts/Tjg/src/services/matrix/auth/DesktopSessionTransition.ts#L61) 的收缩尺寸与 home 窗口最小尺寸：要么把 home `minW` 降至 310，要么把过渡尺寸提到 ≥ 1024×720。
- **预期效果**：登录后窗口无尺寸跳变。
- **验收标准**：登录全流程录屏无跳帧；窗口尺寸单调变化，无反向弹跳。

---

## 3. B1 结构收口

### OP-11 输入区工具栏去重

- **对应问题**：M-P1-05
- **优先级**：P1
- **技术实现路径**：
  1. 以 [FooterBar.vue](file:///Users/ljf/Desktop/hu_ts/Tjg/src/mobile/components/chat-room/FooterBar.vue) 为移动端唯一工具条实现。
  2. 从 [MsgInput.vue](file:///Users/ljf/Desktop/hu_ts/Tjg/src/components/rightBox/MsgInput.vue#L21-L26) 移除对 `MsgInputMobileControls` 的移动端分支，桌面端保留桌面工具条。
  3. 删除 [MsgInputMobileControls.vue](file:///Users/ljf/Desktop/hu_ts/Tjg/src/components/rightBox/MsgInputMobileControls.vue)（若桌面无引用），或明确其仅桌面使用。
- **预期效果**：同一功能单实现，样式与埋点不再分裂。
- **验收标准**：`MsgInputMobileControls` 引用数 0 或仅桌面；移动端输入区视觉与 `components.md` 一致。

### OP-12 拆分 ChatSetting 与 MsgInput

- **对应问题**：M-P1-10、D-P2-02
- **优先级**：P1
- **技术实现路径**：
  - `ChatSetting.vue`（727 行）拆为：`ChatSettingBase`（基础开关）、`ChatSettingMembers`（成员/禁言名单）、`ChatSettingDanger`（清空/退出/解散）。
  - `MsgInput.vue`（782 行）拆为：`MsgInputCore`（输入与发送）、`MsgInputToolbar`、`MsgInputActions`。
- **预期效果**：单文件均 < 500 行，职责清晰。
- **验收标准**：`wc -l` 全部 < 500；功能无回归；`pnpm test:run` 通过。

### OP-13 发送防重

- **对应问题**：D-P1-01
- **优先级**：P1
- **技术实现路径**：在 [useMsgInput.ts](file:///Users/ljf/Desktop/hu_ts/Tjg/src/composables/chat/useMsgInput.ts) 的发送动作加 `isSending` 互斥（`try/finally` 复位），发送中禁用回车与发送按钮。
- **预期效果**：连续回车只发一条。
- **验收标准**：500ms 内连按回车 5 次，仅产生 1 条消息；发送失败后可再次发送。

### OP-14 修复非法/失效样式

- **对应问题**：M-P1-06、M-P1-07、M-P2-03、M-P1-12、M-P1-13、M-P2-04、S-P1-06
- **优先级**：P1
- **技术实现路径**：
  1. `::deep(#search)` → `:deep(#search)`；若无效则改用 `:deep(.van-search)`。
  2. `item-height` 68 → 与实测行高一致（或反向把行高调到 72，与 `components.md` 对齐）。
  3. `rounded-6px` → `--tjg-radius-md`。
  4. `duration-3000` → `--tjg-motion-duration-slow`。
  5. 背景图去掉并存的 `absolute`/`fixed`，保留 `fixed inset-0` + `object-cover`。
  6. 全局 SCSS 中的 `:deep()` 全部移除或改为普通后代选择器。
- **预期效果**：声明即生效，无空转规则。
- **验收标准**：DevTools 中相关规则不再显示删除线；视觉比对一致。

### OP-15 字号标度统一

- **对应问题**：S-P1-01
- **优先级**：P1
- **技术实现路径**：
  1. 以 `--tjg-font-size-*` 为唯一标度。
  2. [typography.scss](file:///Users/ljf/Desktop/hu_ts/Tjg/src/styles/scss/global/typography.scss#L3-L36) 的 `--text-*` 改为对 `--tjg-font-size-*` 的别名，`body` 字号改为 `--tjg-font-size-base`。
  3. 全仓库 `text-xs/sm/base/...` 若来自 UnoCSS 预设则保留，但基准值需与 token 一致。
- **预期效果**：全局基准字号唯一，16px/14px 冲突消除。
- **验收标准**：`getComputedStyle(document.body).fontSize` 等于 `--tjg-font-size-base`；无组件字号意外变大。

### OP-16 variable.scss 拆分与去重

- **对应问题**：S-P1-05、S-P1-07
- **优先级**：P1
- **技术实现路径**：
  1. 把纯变量定义与产出 CSS 的规则分离：变量进 `_variables.scss`（不输出），规则进 `global.scss`。
  2. 移除 `* { font-family: ... !important }`，改为 `body` 继承 + 必要处显式声明。
  3. 6 处 `@use 'variable'` 收敛为 1 处入口引入。
- **预期效果**：`:root` 只输出一次；字体无需 `!important`。
- **验收标准**：构建产物中 `--tjg-*` 定义只出现一次；`!important` 总数下降 ≥ 30 处。

### OP-17 响应式断点补齐

- **对应问题**：S-P1-02、S-P1-03、R 系列
- **优先级**：P1
- **技术实现路径**：
  1. [responsive.scss](file:///Users/ljf/Desktop/hu_ts/Tjg/src/styles/scss/global/responsive.scss#L5-L11) 的断点表改为 `@mixin up($bp)` / `@mixin down($bp)`。
  2. 桌面端在 1024/1280/1440 三档收敛侧栏宽度与内容最大宽。
  3. 移动端横屏（≥ 768）切换到 `vertical` 侧边标签栏（`tabBar` 已支持）。
- **预期效果**：宽屏与横屏布局真正适配。
- **验收标准**：1024 / 1280 / 1440 / 768(横屏) / 390 五档截图无溢出、无拉伸；断点表使用处 > 0。

---

## 4. B2 无障碍与响应式

### OP-18 焦点可见性

- **对应问题**：A-P2-01
- **技术实现路径**：全局加 `:focus-visible { outline: 2px solid var(--tjg-color-primary-500); outline-offset: 2px }`；逐条清理 40 处 `outline: none`，改为 `:focus:not(:focus-visible) { outline: none }`。
- **预期效果**：键盘用户全程可见焦点。
- **验收标准**：`focus-visible` 覆盖 ≥ 60% 交互文件；Tab 遍历主流程无「焦点丢失」。

### OP-19 图片替代文本

- **对应问题**：A-P2-02、M-P1-08
- **技术实现路径**：14 处缺失/空 `alt` 补语义化 `alt`；头像用 `t('common.user_avatar', { name })`；纯装饰图用 `alt=""` + `aria-hidden="true"`。
- **验收标准**：`grep` 检查 `<img` 均有 `alt` 属性；Lighthouse a11y ≥ 90。

### OP-20 可点击元素语义化

- **对应问题**：A-P2-03、A-P2-04、A-P2-05
- **技术实现路径**：
  1. 178 处 `div/span @click` 分批改为 `<button>`；确实不能改的补 `role="button" tabindex="0" @keydown.enter @keydown.space`。
  2. 147 个纯图标按钮补 `aria-label`。
  3. 52 处 < 44px 热区用 `after:absolute after:-inset-*` 扩展（参照 [Settings.vue](file:///Users/ljf/Desktop/hu_ts/Tjg/src/mobile/components/my/Settings.vue#L17) 已有写法）。
- **验收标准**：`axe-core` 扫描 0 个 `click-events-have-key-events` / `interactive-supports-focus`；移动端热区 0 违规。

### OP-21 暗色对比度

- **对应问题**：A-P2-06
- **技术实现路径**：调整 [design-tokens.css:471/473/475](file:///Users/ljf/Desktop/hu_ts/Tjg/src/styles/css/design-tokens.css#L471-L475) 的暗色文本值，目标 ≥ 4.5:1（正文）/ ≥ 3:1（大字）。
- **验收标准**：对比度脚本全部通过；暗色截图人工复核无「灰糊」。

### OP-22 视口高度收口

- **对应问题**：S-P1-04
- **技术实现路径**：`100vh` → `100dvh`，保留 `100vh` 作为前一行回退；复用 [mobileCssGuards.test.ts](file:///Users/ljf/Desktop/hu_ts/Tjg/src/mobile/layout/__tests__/mobileCssGuards.test.ts) 的 dvh 断言思路扩到桌面。
- **验收标准**：`100dvh` 数量 ≥ `100vh`；移动端工具栏收放无跳动。

### OP-23 动效降级

- **对应问题**：S-P1-08、S-P1-09、S-P1-11、P3-01、P3-02
- **技术实现路径**：
  1. `transition: all` → 显式属性列表（69 处）。
  2. 裸时长归并到 `--tjg-motion-duration-fast|normal|slow`（133 处）。
  3. 177 个含动效文件中补 `@media (prefers-reduced-motion: reduce)`。
- **验收标准**：`transition: all` 归零；动效 token 采纳率 ≥ 90%；reduced-motion 覆盖率 ≥ 90%。

---

## 5. B3 一致性与 token 治理

### OP-24 token 去重与收敛

- **对应问题**：S-P2-01、S-P2-02、S-P2-03、S-P2-04、P3-10
- **技术实现路径**：
  1. 解决 224/829、220/525/813、226/833 的重复定义，保留权威值并删除覆盖项。
  2. 删除 34 个零引用 token；98 个 1–2 次引用的逐个判定「保留/合并/删除」。
  3. 清空行与注释残留。
  4. 新增 `scripts/check-token-usage.mjs`，接入 `pnpm check`，冻结基线防止回涨。
- **验收标准**：同文件内同一 token 定义 1 次；token 使用率 ≥ 85%；新脚本在 CI 生效。

### OP-25 移动端玻璃层级纠偏

- **对应问题**：S-P1-10、M-P2-01、M-P2-02、M-P2-05、M-P1-14、P3-04
- **技术实现路径**：
  1. 删除 [mobile.scss](file:///Users/ljf/Desktop/hu_ts/Tjg/src/styles/scss/global/mobile.scss#L128-L133) 的 `.tjg-glass--row`（含 `backdrop-filter` 且零引用）。
  2. 置顶态改用 `--tjg-glass-tint-soft` + 左侧 2px 品牌色条。
  3. 聊天页底部安全区改为透明，玻璃面板延伸到底。
  4. 标签栏选中胶囊宽度改 `min-w` 自适应。
- **验收标准**：长列表滚动帧率 ≥ 55fps（中端机）；L3 层无 `backdrop-filter`；安全区无实色横带。

### OP-26 移动端尺寸令牌化

- **对应问题**：M-P1-11、P3-06、P3-13
- **技术实现路径**：`340px`、`h-75px` 提取为具名 token；行高统一为 `components.md` 的 72；九宫格单项 ≥ 88px。
- **验收标准**：`grep` 该文件内魔法值 0 命中；行高与文档一致。

### OP-27 依赖归类修正

- **对应问题**：B-P2-01、B-P2-02
- **技术实现路径**：把 `@iconify/vue`、`@vueuse/core` 从 `devDependencies` 移到 `dependencies`；按 `knip` 报告分批删除未使用导出（先删 43 个值导出，再评估 156 个类型导出）。
- **验收标准**：`pnpm install --prod` 后构建成功；`knip` 未使用导出 ≤ 10。

### OP-28 冷启动白闪

- **对应问题**：B-P2-03、P3-11
- **技术实现路径**：[index.html:40-L70](file:///Users/ljf/Desktop/hu_ts/Tjg/index.html#L40-L70) 内联脚本在首帧前读 `localStorage` 主题并设 `data-theme`，同时 `html { color-scheme: light dark }`。
- **验收标准**：暗色主题冷启动录屏首帧即为深色，无白闪。

### OP-29 守卫测试去硬编码

- **对应问题**：B-P2-04
- **技术实现路径**：`blurSurfaces` 改为 `glob('src/mobile/**/*.vue')` 扫描 `backdrop-filter` 使用点，自动纳入校验。
- **验收标准**：新增一个模糊面后守卫自动覆盖；现有断言不退化。

---

## 6. 里程碑与守门

### 每个 PR 必跑（强制）

```bash
pnpm vue-tsc --noEmit
pnpm test:run
pnpm check:ratchet
pnpm check:doc-coverage
pnpm check:doc-paths
pnpm check:sdk-boundary
pnpm quality:no-raw-fetch
pnpm check
pnpm check:mobile-css
```

### 批次出口附加检查

| 批次 | 附加检查 |
| :--- | :--- |
| B0 | 暗色/亮色双主题逐页截图；5 个窗口手动拖拽验证 |
| B1 | 双套实现引用数归零；`wc -l` 红线检查 |
| B2 | `axe-core` 扫描 0 critical；五档视口截图 |
| B3 | token 使用率报告；`!important` 计数；`transition: all` 计数 |

### 风险与回滚

| 风险 | 缓解 |
| :--- | :--- |
| 拆分大组件引入回归 | 拆分前后各跑一次全量测试 + 关键路径截图对比 |
| 玻璃层级调整导致可读性下降 | 每处改动同时输出对比度数值，< 4.5:1 直接回退 |
| token 删除误伤运行时主题 | 先标记 `@deprecated` 一个版本，再删除；用 `grep` 二次确认 |
| 路由改造影响深链 | 保留旧路径的 `redirect` 一个版本 |

---

## 7. 预期收益

| 指标 | 现状 | 目标 |
| :--- | :--- | :--- |
| P0 问题 | 10 | 0 |
| 键盘可完成主流程 | 否（来电、查看器阻断） | 是 |
| `focus-visible` 覆盖 | 5.9% | ≥ 60% |
| 触控热区违规 | 52 处 | 0 |
| 动效 token 采纳率 | 25% | ≥ 90% |
| `prefers-reduced-motion` 覆盖 | 32% | ≥ 90% |
| token 使用率 | 57% | ≥ 85% |
| `!important` | 113 | ≤ 40 |
| 单文件 > 800 行 | 2 个 | 0 |
| 死入口 / 死页面 | 2 处 | 0 |
