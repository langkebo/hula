# TJG UI/UX 审计 · 问题清单

> 交付物 1 / 3。配套文档：[优化执行计划](./02-optimization-plan.md) · [冗余清理报告](./03-redundancy-report.md)
>
> 判定基线：[MASTER.md](../MASTER.md)、[components.md](../components.md)、[interaction.md](../interaction.md)、[pages/](../pages/)
> 审计范围：`src/views/`（27 个窗口目录）、`src/components/`（256 个 .vue）、`src/mobile/`（113 个 .vue）、`src/layout/`、`src/styles/`、`src/router/`、`index.html`
> 审计方式：静态代码扫描 + 引用计数 + 设计基线比对；所有条目均标注 `file:line` 且已抽样复核

- 版本：1.0
- 审计日期：2026-11-06
- 统计：共 68 项（P0 10 / P1 21 / P2 24 / P3 13）

---

## 0. 严重度定义

| 级别 | 判定标准 | 处置要求 |
| :--- | :--- | :--- |
| **P0 阻断性** | 用户无法完成任务 / 内容不可读 / 交互无响应 / 无障碍完全不可用 | 当轮必须修复，禁止发布 |
| **P1 严重** | 明显违反设计基线，或影响主流程效率与可访问性，用户可感知但可绕行 | 本迭代内修复 |
| **P2 一般** | 一致性与工程质量问题，累积后损害专业度 | 下迭代批量修复 |
| **P3 优化建议** | 打磨项，收益明确但非必须 | 按资源排期 |

---

## 1. P0 阻断性问题（10 项）

### 1.1 移动端 · 会话与聊天设置

| ID | 位置 | 问题 | 影响 |
| :--- | :--- | :--- | :--- |
| **M-P0-01** | [ChatSetting.vue](file:///Users/ljf/Desktop/hu_ts/Tjg/src/mobile/views/chat-room/ChatSetting.vue#L237-L239) | 「清空聊天记录」`van-button` 只有文案，**无 `@click` 绑定**，点击完全无响应 | 用户以为已清空或误以为功能损坏；数据实际未清理，属功能级缺陷 |
| **M-P0-02** | [Settings.vue](file:///Users/ljf/Desktop/hu_ts/Tjg/src/mobile/components/my/Settings.vue#L14-L20) + [:38-L40](file:///Users/ljf/Desktop/hu_ts/Tjg/src/mobile/components/my/Settings.vue#L38-L40) + [:57](file:///Users/ljf/Desktop/hu_ts/Tjg/src/mobile/components/my/Settings.vue#L57) | 分享按钮 `@click="activate"`，而 `activate = () => {}` 是空函数；同时 `van-popup` 绑定的 `active` 从未被置 `true`，整块分享弹层是死代码 | 「我的」页分享入口点击无任何反馈；死代码同时误导维护者 |
| **M-P0-03** | [dynamic/detail.vue](file:///Users/ljf/Desktop/hu_ts/Tjg/src/mobile/views/dynamic/detail.vue#L10-L18) | 卡片硬编码 `bg-white`，标题用 `text-[--tjg-text-primary]`。暗色主题下 `--tjg-text-primary` 为浅色，形成**白底浅字**，标题不可读 | 暗色模式下动态详情标题完全不可读 |
| **M-P0-04** | [ConfirmAddFriend.vue](file:///Users/ljf/Desktop/hu_ts/Tjg/src/mobile/views/friends/ConfirmAddFriend.vue#L16-L24)、[ConfirmAddGroup.vue](file:///Users/ljf/Desktop/hu_ts/Tjg/src/mobile/views/friends/ConfirmAddGroup.vue#L16)、[NoticeEdit.vue](file:///Users/ljf/Desktop/hu_ts/Tjg/src/mobile/views/my/NoticeEdit.vue#L6) | 与 M-P0-03 同源：硬编码 `bg-white` 承载主题化文字色 | 暗色模式下三处表单/提示区文字不可读 |

### 1.2 桌面端 · 窗口与路由

| ID | 位置 | 问题 | 影响 |
| :--- | :--- | :--- | :--- |
| **D-P0-01** | [mailWindow/index.vue](file:///Users/ljf/Desktop/hu_ts/Tjg/src/views/mailWindow/index.vue#L1-L21) | 页面仅渲染 `common.feature_in_development` 提示，是明确的未实现占位页；但 [desktop.ts:68-L70](file:///Users/ljf/Desktop/hu_ts/Tjg/src/router/routes/desktop.ts#L68-L70) 仍注册 `/mail` 路由，[left/config.tsx:30-L41](file:///Users/ljf/Desktop/hu_ts/Tjg/src/layout/left/config.tsx#L30-L41) 仍把「收藏」入口指向它 | 用户从侧栏点入得到「功能开发中」，属死入口；同时白白加载一个窗口 |
| **D-P0-02** | [desktop.ts](file:///Users/ljf/Desktop/hu_ts/Tjg/src/router/routes/desktop.ts#L12-L14) · [:68-L70](file:///Users/ljf/Desktop/hu_ts/Tjg/src/router/routes/desktop.ts#L68-L70) · [:73-L75](file:///Users/ljf/Desktop/hu_ts/Tjg/src/router/routes/desktop.ts#L73-L75) · [:113-L116](file:///Users/ljf/Desktop/hu_ts/Tjg/src/router/routes/desktop.ts#L113-L116) · [:214-L218](file:///Users/ljf/Desktop/hu_ts/Tjg/src/router/routes/desktop.ts#L214-L218) | `/settings`、`/admin`、`/mail`、`/fileManager`、`/trendradar` 等顶层路由**未挂载 `layout/index.vue`** | 这些窗口丢失统一标题栏与窗口拖拽/最小化区，各页自绘，视觉与交互均不一致 |
| **D-P0-03** | [registerWindow/index.vue](file:///Users/ljf/Desktop/hu_ts/Tjg/src/views/registerWindow/index.vue#L10) | 根容器 `overflow-hidden`，内部无滚动容器兜底 | 小屏/低分辨率窗口下注册表单下半部分（含提交按钮）被裁切且无法滚动，注册流程被阻断 |

### 1.3 无障碍 · 键盘与读屏

| ID | 位置 | 问题 | 影响 |
| :--- | :--- | :--- | :--- |
| **A-P0-01** | [CallIncomingBanner.vue](file:///Users/ljf/Desktop/hu_ts/Tjg/src/views/callWindow/components/CallIncomingBanner.vue#L38-L47) | 接听/拒接用 `div @click`，无 `role`、`tabindex`、键盘事件；且 `:hover` 背景色与默认底色相同，鼠标也无任何反馈 | 来电横幅无法用键盘接听/拒接，读屏不可识别，是通话主流程的单点阻断 |
| **A-P0-02** | [imageViewerWindow/index.vue](file:///Users/ljf/Desktop/hu_ts/Tjg/src/views/imageViewerWindow/index.vue#L41-L103)、[videoViewerWindow/index.vue](file:///Users/ljf/Desktop/hu_ts/Tjg/src/views/videoViewerWindow/index.vue#L42-L80) | 缩放/旋转/关闭等控件全部是不可聚焦的 `svg`/`div`，且未监听 `Esc` | 键盘用户无法关闭查看器，只能依赖鼠标；无 `Esc` 也不符合桌面窗口惯例 |
| **A-P0-03** | [index.html](file:///Users/ljf/Desktop/hu_ts/Tjg/index.html#L2) | `<html lang="en">`，而应用为简体中文 | 读屏按英文音素朗读全部界面文案，属全局性无障碍缺陷 |

---

## 2. P1 严重问题（21 项）

### 2.1 移动端 · 交互与触控

| ID | 位置 | 问题 | 基线要求 |
| :--- | :--- | :--- | :--- |
| **M-P1-01** | [message/index.vue](file:///Users/ljf/Desktop/hu_ts/Tjg/src/mobile/views/message/index.vue#L68-L82) | 长按菜单项实际热区约 22px | `interaction.md`：热区 ≥ 44px |
| **M-P1-02** | [message/index.vue](file:///Users/ljf/Desktop/hu_ts/Tjg/src/mobile/views/message/index.vue#L67) | 长按菜单横向未做视口避让，靠边行的菜单会溢出屏幕 | 弹层必须夹在安全区内 |
| **M-P1-03** | [useMobileMessageActions.ts](file:///Users/ljf/Desktop/hu_ts/Tjg/src/mobile/composables/useMobileMessageActions.ts#L36-L45) | 删除会话**无二次确认**，且接口失败时静默吞掉错误 | 破坏性操作须二次确认 + 失败可见 |
| **M-P1-04** | [MobilePanel.vue](file:///Users/ljf/Desktop/hu_ts/Tjg/src/components/rightBox/chatBox/MobilePanel.vue#L54) · [:77](file:///Users/ljf/Desktop/hu_ts/Tjg/src/components/rightBox/chatBox/MobilePanel.vue#L77) | 面板 `height: 18rem` 配 `overflow: hidden`，键盘弹起或小屏时表情/功能项被裁切且不可滚动 | 面板高度须 `min(18rem, 可用视口)` 且可滚 |
| **M-P1-05** | [FooterBar.vue](file:///Users/ljf/Desktop/hu_ts/Tjg/src/mobile/components/chat-room/FooterBar.vue#L12-L33) vs [MsgInput.vue](file:///Users/ljf/Desktop/hu_ts/Tjg/src/components/rightBox/MsgInput.vue#L21-L26) + [MsgInputMobileControls.vue](file:///Users/ljf/Desktop/hu_ts/Tjg/src/components/rightBox/MsgInputMobileControls.vue#L3) | 输入区工具栏存在**两套并列实现**（移动端 FooterBar 与桌面组件内嵌的 MobileControls） | 同一功能只允许一套实现 |
| **M-P1-06** | [MobileSessionList.vue](file:///Users/ljf/Desktop/hu_ts/Tjg/src/mobile/components/message/MobileSessionList.vue#L251) | 选择器 `::deep(#search)` 为非法语法（应为 `:deep()`），样式实际不生效 | 使用合法深度选择器 |
| **M-P1-07** | [MobileSessionList.vue](file:///Users/ljf/Desktop/hu_ts/Tjg/src/mobile/components/message/MobileSessionList.vue#L66) | 虚拟列表 `item-height` 声明 72，实际行高 68，导致滚动定位漂移 | 声明值与实测一致 |
| **M-P1-08** | [MobileSessionList.vue](file:///Users/ljf/Desktop/hu_ts/Tjg/src/mobile/components/message/MobileSessionList.vue#L93-L96) | 会话头像 `<img>` 无 `alt`、无 `loading="lazy"` | 头像须有可读替代文本，长列表须懒加载 |
| **M-P1-09** | [ChatSetting.vue](file:///Users/ljf/Desktop/hu_ts/Tjg/src/mobile/views/chat-room/ChatSetting.vue#L92) | 「添加」`+` 图标按钮无可访问名称 | 图标按钮须有 `aria-label` |
| **M-P1-10** | [ChatSetting.vue](file:///Users/ljf/Desktop/hu_ts/Tjg/src/mobile/views/chat-room/ChatSetting.vue) | 文件 727 行，逼近 800 行红线，且已混入禁言名单、成员管理、危险操作三类职责 | 超 800 行必须拆分；当前应先拆 |
| **M-P1-11** | [friends/index.vue](file:///Users/ljf/Desktop/hu_ts/Tjg/src/mobile/views/friends/index.vue#L169) · [:202](file:///Users/ljf/Desktop/hu_ts/Tjg/src/mobile/views/friends/index.vue#L202) · [:240](file:///Users/ljf/Desktop/hu_ts/Tjg/src/mobile/views/friends/index.vue#L240) · [:279](file:///Users/ljf/Desktop/hu_ts/Tjg/src/mobile/views/friends/index.vue#L279) | 魔法值 `340px` 重复 4 次、`h-75px` 重复 4 次 | 尺寸须走 token 或具名变量 |
| **M-P1-12** | [friends/index.vue](file:///Users/ljf/Desktop/hu_ts/Tjg/src/mobile/views/friends/index.vue#L11) | `duration-3000` 为拼写错误（UnoCSS 无此值），动效实际不生效 | 时长须用动效 token |
| **M-P1-13** | [friends/index.vue](file:///Users/ljf/Desktop/hu_ts/Tjg/src/mobile/views/friends/index.vue#L5) | 背景图同时声明 `absolute` 与 `fixed`，且缺 `object-cover`，不同宽高比下变形 | 背景图须单一定位 + `object-cover` |
| **M-P1-14** | [ChatRoomLayout.vue](file:///Users/ljf/Desktop/hu_ts/Tjg/src/mobile/layout/chat-room/ChatRoomLayout.vue#L20-L24) | 底部安全区用实色横带填充，破坏玻璃材质连续性 | 安全区应透明并延伸玻璃面 |

### 2.2 桌面端 · 流程与状态

| ID | 位置 | 问题 | 影响 |
| :--- | :--- | :--- | :--- |
| **D-P1-01** | [useMsgInput.ts](file:///Users/ljf/Desktop/hu_ts/Tjg/src/composables/chat/useMsgInput.ts) + [MsgInput.vue](file:///Users/ljf/Desktop/hu_ts/Tjg/src/components/rightBox/MsgInput.vue)（782 行） | 发送动作**无 in-flight 保护**，连续回车/连点可重复提交同一条消息；文件本身已达 782 行 | 消息重复发送，且组件逼近拆分红线 |
| **D-P1-02** | [ManualLoginForm.vue](file:///Users/ljf/Desktop/hu_ts/Tjg/src/views/loginWindow/ManualLoginForm.vue#L85-L108) · [:125](file:///Users/ljf/Desktop/hu_ts/Tjg/src/views/loginWindow/ManualLoginForm.vue#L125) | 账号/密码输入框无 `<label>` 或 `aria-label`；删除已保存账号**无二次确认** | 读屏无法识别字段；误删账号不可恢复 |
| **D-P1-03** | [registerWindow/index.vue](file:///Users/ljf/Desktop/hu_ts/Tjg/src/views/registerWindow/index.vue#L138) | 同意条款 `n-checkbox` 无关联 `<label>`，点击文案不勾选 | 表单可用性差，读屏读不出条款文本 |
| **D-P1-04** | [checkUpdate.vue](file:///Users/ljf/Desktop/hu_ts/Tjg/src/views/checkUpdate.vue#L104-L105) · [:198-L200](file:///Users/ljf/Desktop/hu_ts/Tjg/src/views/checkUpdate.vue#L198-L200) · [:298-L301](file:///Users/ljf/Desktop/hu_ts/Tjg/src/views/checkUpdate.vue#L298-L301) | 「立即更新」与「稍后」同为 `primary` 样式（主次不分）；检查/下载失败**静默无提示**；展开区收起时内容被裁切 | 用户无法判断该点哪个；失败后无从排查 |
| **D-P1-05** | [ActionBar.vue](file:///Users/ljf/Desktop/hu_ts/Tjg/src/components/windows/ActionBar.vue#L303-L307) + [DesktopSessionTransition.ts](file:///Users/ljf/Desktop/hu_ts/Tjg/src/services/matrix/auth/DesktopSessionTransition.ts#L61) | 登录过渡把窗口收缩到 **310×720**，而 home 窗口 `minW = 1024`，两者冲突 | 登录后窗口尺寸跳变/被强制撑开，出现闪动 |
| **D-P1-06** | [desktop.ts](file:///Users/ljf/Desktop/hu_ts/Tjg/src/router/routes/desktop.ts)（D-P0-02 的连带） | 各顶层窗口自绘标题栏，拖拽区高度、按钮顺序、圆角不统一 | 窗口观感不一致，拖拽热区大小随机 |

### 2.3 样式与响应式

| ID | 位置 | 问题 | 影响 |
| :--- | :--- | :--- | :--- |
| **S-P1-01** | [typography.scss](file:///Users/ljf/Desktop/hu_ts/Tjg/src/styles/scss/global/typography.scss#L3-L36) | 存在**第二套字号标度** `--text-*`（12/14/16/18/20/24/30/36），且 `body { font-size: var(--text-base) }` = 16px，与 `--tjg-font-size-base: 14px` 直接冲突 | 全局基准字号二义性，组件继承到的字号取决于加载顺序 |
| **S-P1-02** | [responsive.scss](file:///Users/ljf/Desktop/hu_ts/Tjg/src/styles/scss/global/responsive.scss#L5-L11) | 定义了 576/768/992/1200/1400 五档断点，但全仓库**实际媒体查询 0 处**；辅助类 `.responsive-container` 引用数 0 | 响应式体系是空壳，宽屏/窄屏均无适配 |
| **S-P1-03** | [More.vue](file:///Users/ljf/Desktop/hu_ts/Tjg/src/views/homeWindow/components/More.vue#L356) | 全项目**唯一**生效的媒体查询只有 360px 一处 | 平板与小窗场景完全未覆盖 |
| **S-P1-04** | 全仓库统计 | `100vh` 28 处 vs `100dvh` 17 处 | 移动端浏览器工具栏收起/展开时高度跳变，内容被裁 |
| **S-P1-05** | [variable.scss](file:///Users/ljf/Desktop/hu_ts/Tjg/src/styles/scss/global/variable.scss#L2-L5) | 用 `*` 通配 + `!important` 强制字体，全仓库 `!important` 共 113 处（`login.scss` 单文件 26 处居首） | 主题与字号覆盖困难，样式优先级失控 |
| **S-P1-06** | [variable.scss](file:///Users/ljf/Desktop/hu_ts/Tjg/src/styles/scss/global/variable.scss#L89) · [:96](file:///Users/ljf/Desktop/hu_ts/Tjg/src/styles/scss/global/variable.scss#L89) · [:156](file:///Users/ljf/Desktop/hu_ts/Tjg/src/styles/scss/global/variable.scss#L156) | `:deep()` 写在全局 SCSS 中不生效（无 scoped 上下文），相关选择器为空转 | 预期的深度覆写从未生效，实际样式由其它规则偶然命中 |
| **S-P1-07** | [variable.scss](file:///Users/ljf/Desktop/hu_ts/Tjg/src/styles/scss/global/variable.scss) | 该文件被 6 处 `@use`，每次引入都会重复输出同一批 `:root` 变量 | 产物冗余，变量定义多处重复 |

### 2.4 动效与性能

| ID | 位置 | 问题 | 影响 |
| :--- | :--- | :--- | :--- |
| **S-P1-08** | 全仓库统计 | `transition: all` 69 处；裸时长（非 token）133 处；动效 token 采纳率仅 25% | 无法统一降级，`prefers-reduced-motion` 覆盖不全 |
| **S-P1-09** | [MobilePanel.vue](file:///Users/ljf/Desktop/hu_ts/Tjg/src/components/rightBox/chatBox/MobilePanel.vue#L82) · [:109-L110](file:///Users/ljf/Desktop/hu_ts/Tjg/src/components/rightBox/chatBox/MobilePanel.vue#L109-L110) | `transition: all` + `0.25s ease` 手写，未走 `--tjg-motion-*` | 面板动效节奏与全站不一致 |
| **S-P1-10** | [mobile.scss](file:///Users/ljf/Desktop/hu_ts/Tjg/src/styles/scss/global/mobile.scss#L128-L133) | `.tjg-glass--row` 内含 `backdrop-filter`，但全仓库**零引用**；且其存在本身违反「长列表逐行禁止模糊」 | 一旦有人引用即造成长列表掉帧；当前是无用且危险的类 |
| **S-P1-11** | 全仓库统计 | `prefers-reduced-motion` 覆盖率 32%（177 个含动效文件仅 56 个有降级） | 前庭功能敏感用户无法关闭动效 |

---

## 3. P2 一般问题（24 项）

### 3.1 可访问性

| ID | 位置 | 问题 | 量化 |
| :--- | :--- | :--- | :--- |
| **A-P2-01** | 全仓库 | `focus-visible` 仅出现在 28 / 474 个 `.vue`（5.9%）；`outline: none` 40 处 | 键盘焦点大量不可见 |
| **A-P2-02** | 全仓库 | `<img>` 109 个，`alt` 缺失 10 个、空 `alt` 4 个（合计 12.8%） | 头像、插图、预览图为主 |
| **A-P2-03** | 全仓库 | 可点击标签 250 个无 `aria-label`，其中纯图标按钮 147 个 | 图标按钮缺少可读名称 |
| **A-P2-04** | 全仓库 | `div/span @click` 220 处，其中 178 处（81%）无 `role` / `tabindex` / 键盘事件 | 键盘与读屏大面积不可用 |
| **A-P2-05** | 全仓库 | 触控热区 < 44px 共 52 处（移动端 18 处） | 与 `interaction.md` 44px 基线冲突 |
| **A-P2-06** | [design-tokens.css](file:///Users/ljf/Desktop/hu_ts/Tjg/src/styles/css/design-tokens.css#L471) · [:473](file:///Users/ljf/Desktop/hu_ts/Tjg/src/styles/css/design-tokens.css#L473) · [:475](file:///Users/ljf/Desktop/hu_ts/Tjg/src/styles/css/design-tokens.css#L475) | 暗色文本对比度不足：3.96:1 / 3.43:1 / 4.32:1，均低于 4.5:1 | 正文与次要文字在暗色下偏灰 |

### 3.2 设计 token

| ID | 位置 | 问题 | 量化 |
| :--- | :--- | :--- | :--- |
| **S-P2-01** | [design-tokens.css](file:///Users/ljf/Desktop/hu_ts/Tjg/src/styles/css/design-tokens.css#L224) · [:829](file:///Users/ljf/Desktop/hu_ts/Tjg/src/styles/css/design-tokens.css#L829) | 同一 token 在文件内被**二次定义**并覆盖（如 224 与 829） | 后值静默覆盖前值，改前者无效 |
| **S-P2-02** | [design-tokens.css:220](file:///Users/ljf/Desktop/hu_ts/Tjg/src/styles/css/design-tokens.css#L220) · [:525](file:///Users/ljf/Desktop/hu_ts/Tjg/src/styles/css/design-tokens.css#L525) · [:813](file:///Users/ljf/Desktop/hu_ts/Tjg/src/styles/css/design-tokens.css#L813)；[:226](file:///Users/ljf/Desktop/hu_ts/Tjg/src/styles/css/design-tokens.css#L226) · [:833](file:///Users/ljf/Desktop/hu_ts/Tjg/src/styles/css/design-tokens.css#L833) | 同类三重定义与三重覆盖，语义层级混乱 | 维护者无法判断哪一行是权威值 |
| **S-P2-03** | [design-tokens.css](file:///Users/ljf/Desktop/hu_ts/Tjg/src/styles/css/design-tokens.css) | 307 个 token 中 34 个零引用、98 个仅 1–2 次引用（43% 低效） | 近半数 token 是「定义即闲置」 |
| **S-P2-04** | [design-tokens.css](file:///Users/ljf/Desktop/hu_ts/Tjg/src/styles/css/design-tokens.css#L355-L376) · [:638-L643](file:///Users/ljf/Desktop/hu_ts/Tjg/src/styles/css/design-tokens.css#L638-L643) | 成片空行与注释残留 | 文件可读性下降 |

### 3.3 移动端一致性

| ID | 位置 | 问题 |
| :--- | :--- | :--- |
| **M-P2-01** | [mobile.scss](file:///Users/ljf/Desktop/hu_ts/Tjg/src/styles/scss/global/mobile.scss#L128-L133) | `.tjg-glass--row` 与 `MASTER.md` §2「L3 内容面不模糊」直接矛盾（详见 S-P1-10） |
| **M-P2-02** | [MobileSessionList.vue](file:///Users/ljf/Desktop/hu_ts/Tjg/src/mobile/components/message/MobileSessionList.vue#L271-L274) | 置顶态用纯色 `primary-100`，未走玻璃层级，浅色背景上对比不足 |
| **M-P2-03** | [friends/index.vue](file:///Users/ljf/Desktop/hu_ts/Tjg/src/mobile/views/friends/index.vue#L38) | `rounded-6px` 不在圆角 token 梯度内（应为 `--tjg-radius-md` 等） |
| **M-P2-04** | [AutoFixHeightPage.vue](file:///Users/ljf/Desktop/hu_ts/Tjg/src/mobile/components/chat-room/AutoFixHeightPage.vue#L4-L8) | 背景图同时带 `absolute` 与 `fixed`，两者语义冲突（`fixed` 生效时 `absolute` 无效） |
| **M-P2-05** | [tabBar/index.vue](file:///Users/ljf/Desktop/hu_ts/Tjg/src/mobile/layout/tabBar/index.vue) | 选中态胶囊宽度固定 46px，长语言（德语/俄语）标签换行时图标底与文字宽度不匹配 |

### 3.4 桌面端与工程

| ID | 位置 | 问题 |
| :--- | :--- | :--- |
| **D-P2-01** | [desktop.ts](file:///Users/ljf/Desktop/hu_ts/Tjg/src/router/routes/desktop.ts) | 路由与 `left/config.tsx` 入口存在双份维护，`mail` 已出现「有入口无功能」漂移 |
| **D-P2-02** | [MsgInput.vue](file:///Users/ljf/Desktop/hu_ts/Tjg/src/components/rightBox/MsgInput.vue) | 782 行，职责包含输入、附件、表情、语音、快捷发送，接近红线 |
| **B-P2-01** | [package.json](file:///Users/ljf/Desktop/hu_ts/Tjg/package.json#L177-L209) | `@iconify/vue`、`@vueuse/core` 被 51 / 100 个生产文件引用，却声明在 `devDependencies`。生产依赖裁剪安装与打包时会缺失 |
| **B-P2-02** | 全仓库 | `knip` 报告 43 个未使用导出 + 156 个未使用导出类型 |
| **B-P2-03** | [index.html](file:///Users/ljf/Desktop/hu_ts/Tjg/index.html#L40-L70) | 深色主题冷启动时先渲染浅色底再切换，出现白闪 |
| **B-P2-04** | [mobileCssGuards.test.ts](file:///Users/ljf/Desktop/hu_ts/Tjg/src/mobile/layout/__tests__/mobileCssGuards.test.ts) | 守卫测试硬编码 4 个文件路径，新增模糊面不会被自动纳入校验 |

### 3.5 i18n

| ID | 位置 | 问题 |
| :--- | :--- | :--- |
| **I-P2-01** | 全仓库 | 未使用的 i18n key 为 0（健康），但存在 3 处硬编码中文兜底字符串与 locale 文件重复 |
| **I-P2-02** | [mobile/__tests__/i18nLiteralGuards.test.ts](file:///Users/ljf/Desktop/hu_ts/Tjg/src/mobile/__tests__/i18nLiteralGuards.test.ts#L66) | 白名单含 `mailWindow`，未来删页需同步改白名单（见冗余报告 R-14） |

---

## 4. P3 优化建议（13 项）

| ID | 位置 | 建议 |
| :--- | :--- | :--- |
| **P3-01** | 全局 | 将 `--tjg-motion-*` 采纳率从 25% 提升到 90%，裸时长按梯度（fast 120 / normal 220 / slow 320ms）归并 |
| **P3-02** | 全局 | `transition: all` 69 处改为显式属性列表，避免布局属性被动画 |
| **P3-03** | 全局 | `!important` 从 113 处压到 30 以内，优先用 `layer` 或提高选择器特异性替代 |
| **P3-04** | [tabBar/index.vue](file:///Users/ljf/Desktop/hu_ts/Tjg/src/mobile/layout/tabBar/index.vue) | 标签栏选中胶囊可加 0.5px 内外双描边，提升浅色背景下的边界可见度 |
| **P3-05** | 移动端会话列表 | 会话行滑动操作可补 `prefers-reduced-motion` 下的即时切换（无过渡） |
| **P3-06** | [components.md](../components.md) §会话行 | 行高 68 与文档 72 的差异需统一（建议以文档 72 为准，同时修 M-P1-07） |
| **P3-07** | 全局 | 补充 `prefers-contrast: more` 分支，为低视力用户提供实色高对比方案 |
| **P3-08** | 全局 | 为所有异步操作补统一的 loading / empty / error 三态组件，减少各页重复实现 |
| **P3-09** | 桌面端 | 统一窗口标题栏为共享 `layout/index.vue` 后，抽出 `WindowTitleBar` 组件收口拖拽区 |
| **P3-10** | [design-tokens.css](file:///Users/ljf/Desktop/hu_ts/Tjg/src/styles/css/design-tokens.css) | 34 个零引用 token 清理后，补充 token 使用率检查脚本，防止再次沉积 |
| **P3-11** | 全局 | `<html>` 增加 `color-scheme: light dark`，让原生控件跟随主题 |
| **P3-12** | [responsive.scss](file:///Users/ljf/Desktop/hu_ts/Tjg/src/styles/scss/global/responsive.scss) | 断点表改为 SCSS mixin（`@mixin up($bp)`）供组件消费，避免「有表无用」 |
| **P3-13** | 移动端 | 九宫格功能面板按 `components.md` 校验单项 ≥ 88px、图标 44px，当前存在 80px 项 |

---

## 5. 按模块汇总

| 模块 | P0 | P1 | P2 | P3 | 小计 |
| :--- | ---: | ---: | ---: | ---: | ---: |
| 移动端 · 会话列表 | 0 | 3 | 2 | 2 | 7 |
| 移动端 · 聊天页与设置 | 3 | 6 | 2 | 0 | 11 |
| 移动端 · 联系人/我的 | 3 | 5 | 3 | 1 | 12 |
| 桌面端 · 窗口与路由 | 3 | 3 | 2 | 1 | 9 |
| 桌面端 · 登录/注册/更新 | 0 | 4 | 0 | 0 | 4 |
| 桌面端 · 通话/查看器 | 2 | 0 | 0 | 0 | 2 |
| 样式与设计 token | 0 | 8 | 4 | 5 | 17 |
| 可访问性（跨端） | 1 | 0 | 5 | 2 | 8 |
| 工程与构建 | 0 | 0 | 4 | 1 | 5 |
| i18n | 0 | 0 | 2 | 0 | 2 |
| **合计** | **10** | **21** | **24** | **13** | **68** |

---

## 6. 健康项（明确无问题，避免重复审计）

| 检查项 | 结论 |
| :--- | :--- |
| 移动端 R2 合规 | `src/mobile/**` 内无 `@/views/admin`、`@/plugins/robot`、`@/services/matrix/ai`、`@/services/siliconflow`、`@/services/trendradar` 引用 |
| 内联 `isMobile()` 分支 | 移动端目录内 0 处新增 |
| 单文件体量红线 | 移动端最大 727 行，无超 800 行文件 |
| 未使用组件 | 0 个（`build/config/components.ts` 自动注册范围内全部有引用） |
| 未使用 i18n key | 0 个 |
| 未使用依赖 | 0 个（但 B-P2-01 的归类错误仍存在） |
| 平行 SDK 实现 | 未发现组件/store 内直接 `fetch` Matrix 端点 |
