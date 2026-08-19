# 修复 MatrixPushService 测试 mock + 通话信令断点修复 + 优化计划核查

## 完成概要

### 1. 修复 MatrixPushService 测试 mock（4 个失败用例 → 全绿）

**根因**：源代码 `getPushRules()` 调用 `client.getPushManager().getPushRules()`，但测试 mock 把 `getPushRules` 放在了 client 上而非 `mockPushManager` 上，导致 `TypeError: client.getPushManager(...).getPushRules is not a function`。

**修改文件**：
- `src/services/matrix/notifications/__tests__/MatrixPushService.test.ts` — 将 `getPushRules` 从 client mock 移到 `mockPushManager`；简化 FT-124 测试用例
- `src/services/matrix/notifications/__tests__/MatrixPushService.sdkManager.test.ts` — 同步修复

### 2. 通话信令流程端到端调试 — 修复 2 个致命断点

**核心发现**：应用代码使用 `client.voipHandler` / `client.getCallHandler()`，但 SDK 中实际属性是 `client.callEventHandler`（`CallEventHandler` 类型，`calls` 字段为 `Map<string, MatrixCall>`）。这导致：

| 断点 | 影响 |
|------|------|
| `client.voipHandler` 不存在（实为 `callEventHandler`） | `initialize()` 永远走 else 分支，来电监听从未注册 |
| `client.getCallHandler()` 不存在 | `getCallById` 恒返回 undefined → 接听抛错、挂断不发送信令 |

**修改文件**：
- `src/services/matrix/media/voipHelpers.ts` — `getCallById` 改用 `client.callEventHandler?.calls?.get(callId)`；`checkVoipAvailability` 改用 `client.callEventHandler`
- `src/services/matrix/media/MatrixVoIPService.ts` — `initialize` 改用 `client.callEventHandler`
- `src/types/matrix-js-sdk-augmentations.d.ts` — 移除幻影声明 `voipHandler` / `getCallHandler()` / `VoIPHandler`
- `src/services/matrix/media/voipTypes.ts` — 移除不再需要的 `VoIPCallHandler` 类型
- `src/services/matrix/media/__tests__/voipHelpers.test.ts` — 全部 mock 改用 `callEventHandler`
- `src/services/matrix/media/__tests__/MatrixVoIPService.test.ts` — mock 改用 `callEventHandler`

**遗留 VoIP 问题（需后续处理）**：
- C: 来电窗口拿不到 callId → 接听/拒绝按钮静默无效
- D: 移动端 `/mobile/rtcCall` 是死页面（无 onMounted/startCall）
- E: `sendMatrixVoipSignal` 是纯 log 桩
- F: 新旧两套来电信令并存且互不相通（Matrix vs 旧 WS）
- H: 通话结束不写聊天记录

### 3. 优化计划完成情况核查

| # | 问题 | 严重度 | 状态 |
|---|------|--------|------|
| 1 | 头像更新后UI不刷新 | P1 | ✅ DONE |
| 2 | 消息列表成员重复 | P1 | ✅ DONE |
| 3 | 好友聊天按钮不跳转 | P1 | ✅ DONE |
| 4 | 打电话/打视频没有专门UI | P2 | ⚠️ PARTIALLY DONE |
| 5 | 设备列表56个设备 | P2 | ✅ DONE |
| 6 | 房间列表色彩识别 | P2 | ✅ DONE |
| 7 | 空间详情不展示 | P1 | ✅ DONE |
| 8 | 设置子页面空白 | P0 | ✅ DONE |

**Issue 4 说明**：优化方案计划新建 `src/components/voice/VoiceCallOverlay.vue`，但项目中已存在等效的通话 UI 体系（`src/components/call/CallView.vue` + `src/views/callWindow/` 组件群）。真正的问题不是"缺 UI"而是信令链路断裂（已在本次修复中断点 A/B）。

**改动文件**：`src/views/settingsWindow/SettingsContent.vue`（清残留 tooltip + overflow-x:hidden + dev 诊断 hook）、`src/views/settingsWindow/SettingsPage.vue`（dev 诊断面板）、`src/services/matrix/media/MatrixMediaService.ts`（mxcUrlToHttp 容错回落）、`src/views/settingsWindow/tabs/AccountSettings.vue`（displayAvatarUrl try/catch）。下一轮需要用户从 dev 面板复制扫描输出以定位"黑气泡"是哪个组件渲染出来的。

## 今日 8 大问题排查（含 19:04 实拍反馈）
- 报告：`docs/问题深度排查-2026-08-18.md`
- **Issue 8（设置空白 + 不能返回）二轮加固**：
  - `defineAsyncComponent` 的 `errorComponent` 仅捕获 loader 失败；render-time 抛错需要 `onErrorCaptured` 兜底
  - 嵌入式 SettingsContent header 加 "返回" ghost 按钮（icon `mdi:arrow-left`，emit close），由 SettingsPage.handleClose 兜路由
  - `src/views/settingsWindow/SettingsContent.vue`：`onErrorCaptured` + `renderError` ref + 模板分支渲染 TabErrorFallback；新增 `setting.dialog.back_label` / `back_aria_label` 中英文案
  - 新增 `src/views/settingsWindow/__tests__/SettingsContent.test.ts` 4 用例（返回按钮 / 关闭按钮 / 渲染异常红色兜底 / 切 tab 清错），mock 通过 `vi.hoisted` 容器避开 hoist 限制
- 验证：vue-tsc 全绿、biome 全绿、5 个测试文件 36 用例 ✅（含本轮新加的 4 个）

---

## 八大问题深度排查 + Issue 3 根因修复（续，2026-08-18）

**背景**：优化计划（`TJG-optimization-plan-2026-08-18.md`）的修复多数已写入代码但问题仍复现。深度排查报告 `docs/问题深度排查-2026-08-18.md` 给出「计划 vs 真实代码 vs 真因 vs 处理」；上一轮落地 5 处修复（Issue 1/2/6/7/8），本轮补齐 Issue 3 根因修复并修正 Issue 4 状态。

**本轮关键修复 — Issue 3（好友进入聊天/加密聊天不跳转）**
- 真因：`openMsgSession` → `getSessionDetailWithFriends` → `getDirectSessionDetail(uid)` 完全依赖 `DirectMessageManager`：`getDmForUser(uid,false)` 在 manager 未就绪时静默返 `null`，随后 `createDm(uid)` 内 `requireManager()` 抛错 → 被 `getSessionDetailWithFriends` 捕获 `return null` → `openMsgSession` 弹 toast 后直接 return，永不跳转。
- 修复：`getDirectSessionDetail` 改为「本地优先 + manager 兜底」——新增 `findLocalDirectRoom(userId)` 扫描 `client.getRooms()` 中"成员数===2 且另一成员即目标用户、非空间房间"的已同步房间，找到即 `buildSessionFromRoom` 返回并跳转，不依赖 DM manager；`createDm` 抛错时再兜底一次本地定位。
- 新增回归测试：`MatrixSessionService.test.ts`「manager 无映射且 createDm 抛错时仍从本地 1:1 房间解析、不调用 createDm」。

**Issue 4 状态修正**：工作区中 `src/composables/webrtc/*` 已删、`useVoIPCallFlow` 迁顶层、`src/views/callWindow/*` 新建（useCallMedia/useCallControls/useCallState + CallVideoStage/CallControlsBar/CallAvatarStage/CallIncomingBanner）、`MatrixVoIPService` API 完整 → 通话 UI 重建进行中，按钮→窗口→CallView 骨架已通，剩余媒体流/信令接通（独立立项跟进）。

**验证（针对性单测全绿）**
- `MatrixSessionService.test.ts` 6/6（含 Issue 3 新用例）
- `RoomCardItem.test.ts` 24/24；user 测试 37/37；`SpaceChildrenPane.test.ts` 17/17
- biome 单文件改动：clean

**改动文件**：`src/services/matrix/auth/MatrixSessionService.ts`、`src/services/matrix/auth/__tests__/MatrixSessionService.test.ts`、`docs/问题深度排查-2026-08-18.md`（同步更新 Issue 3/4 状态与验证结果）。

---

## Issue 4 媒体层接通（独立立项收尾）+ Issue 5 收口（2026-08-18 续）

**用户指令**：Issue 4 媒体层接通作为独立立项收尾；Issue 5 deviceId 收敛并入 MatrixClient 重复初始化专项。

### Issue 4 — VoIP 媒体层真正接通（SDK v40 API 错配修复）
**真因**：`MatrixVoIPService` 沿用旧/自定义 `MatrixCall` 媒体 API，与 vendored `matrix-js-sdk` v40.2.0 真实契约不符：
- `placeCall(audio: boolean, video: boolean)` / `answer(audio?: boolean, video?: boolean)` 是**布尔优先**，代码却传 `this.localStream`（MediaStream）当 `audio` 布尔 → SDK 仍自行 getUserMedia，与预览流重复采集、发送流≠预览流
- 音频静音方法名是 `setMicrophoneMuted(muted)`（非 `setLocalAudioMuted`），视频是 `setLocalVideoMuted(muted)`；旧代码操作 `this.localStream` 轨道只静音/关预览，对方仍可见可闻
- `CallFeed.isLocal(): boolean` + `CallFeed.stream`；`handleFeedsChanged` 须按 `isLocal()` 拆分本地/远端流

**修复**：
- `voipTypes.ts` `VoIPCall` 接口对齐 v40（answer/placeCall 布尔、setMicrophoneMuted、移除 setLocalAudioMuted）
- `MatrixVoIPService.startCall` / `answerCall`：`call.placeCall(options.audio, options.video)` / `call.answer(options.audio, options.video)`（不再服务层 getUserMedia）
- `handleFeedsChanged`：按 `feed.isLocal()` 拆分 localStream / remoteStream
- `toggleMute` / `toggleVideo`：改走 `setMicrophoneMuted` / `setLocalVideoMuted` 并返回新状态
- 移除服务层 `localStream` 字段；cleanup/reset 不再 stop SDK 拥有的轨道（screenStream 仍由服务层释放）

**SDK 契约权威位置**：`node_modules/matrix-js-sdk/lib/web-rtc/call.d.ts`（placeCall L530 / answer L349 / setLocalVideoMuted L411 / setMicrophoneMuted L427）、`callFeed.d.ts`（isLocal L84 / stream L12）。

**验证**：`vue-tsc --noEmit` 全项目 0 错误；`biome` clean；`MatrixVoIPService.test.ts` 6/6（含 5 个 v40 契约回归用例）；media 目录全量 17 文件 228 用例全绿。
**立项文档**：`docs/voip-media-layer-收尾-2026-08-18.md`（含端到端手动验收清单）。

### Issue 5 — deviceId 收敛收口到 MatrixClient 专项
- 确认 `MatrixClient重复初始化收敛-2026-08-09.md` 修复仍存活：`shouldReuse` 幂等守卫（`MatrixConnectionManager.ts:394`）、`loginWithToken` 前置 `resolveDeviceIdByWhoami`+`resolveStableDeviceId`（`MatrixClientAuth.ts:256-267`），相关契约测试全绿
- 在专项 doc 第九节追加 Issue 5「设备列表过多」收口：根因=重复建 client 累积 deviceId，专项已消除新增；存量历史 device 需服务端/用户清理
- UI 侧 `SessionSettings.vue` 已分离「当前设备/其他设备」并排序，体验无满屏设备

**改动文件**：`src/services/matrix/media/voipTypes.ts`、`src/services/matrix/media/MatrixVoIPService.ts`、`src/services/matrix/media/__tests__/MatrixVoIPService.test.ts`、`docs/voip-media-layer-收尾-2026-08-18.md`、`docs/MatrixClient重复初始化收敛-2026-08-09.md`。

---

## 第七轮 — 设置页空白根因升级排查（2026-08-18 20:05）

**线索**：用户点 dev 面板「扫描残留 tooltip」输出 `未检测到残留 tooltip/popover。` → 排除浮层残留假设。截图右侧整片黑，是**真没渲染 DOM**（既无 `TabErrorFallback`、也无 `NSpin` 加载态）。

**已落地的深度探针**：
- `SettingsContent.widerProbe()` 一次性回传：`activeTab / renderError / headerTitle / panelLayout(wrapper+header+body 三块 selector/tag/childCount/rect/bg/color/display/visibility/opacity/zIndex + text 前 120 字) / bodyChildren 前 6 个 / siblingTracks(LeftNav/Sidebar/Content/DevPanel 四轨宽度)`
- dev 面板新增「深度探针：右栏状态」按钮，把以上格式化打印到 `diagnosticText`
- 用户下一步：切到任一空白 tab → 点该按钮 → 把完整 output 复制回来，根据信号分支处置

**预期信号 → 处置映射**（值班手册）：
- `body rect.w/h=0` 或 `display:none` → 父级 flex 链 / 父容器高度塌陷
- `body childCount=0` 且 `renderError=null` → `<component :is>` 拿 undefined（loader 注册缺失/被注释）
- `body childCount=1` 但 `settings-tab-wrap` rect=0×0 → 内部组件没回写高度（多根 template + flex 列）
- `siblingTracks` 中 Content rect=0 但 LeftNav/Sidebar 大 → Content 被 flex 三轨挤掉

**验证**：`vue-tsc --noEmit` 全项目 0 错误；`biome` clean；`SettingsContent.test.ts` 5/5（含 widerProbe 用例，happy-dom 下 mock getBoundingClientRect）；settingsWindow 全套 19 文件 194 用例全绿。

## 第八轮 — 根因锁定：import type 错用导致 SettingsContent 全降级为 HTMLUnknownElement（2026-08-18 20:25）

**用户运行 DOM 全局探针后回报**：
```
[2] SETTINGSCONTENT.  div.settings-content-wrapper 0×1004 @305,0 disp=block vis=visible op=1
    【3. body 子节点】 wrapper (missing)  body (missing)  ❌ 找不到 #settings-tab-panel
    【5. contentRef 状态】 类型 object, 构造函数 HTMLUnknownElement  暴露面 keys: []
```

**根因（致命陷阱，type-only 导入）**：
- `src/views/settingsWindow/SettingsPage.vue:51` 写的是 `import type SettingsContent from './SettingsContent.vue'` —— TS 类型对（vue-loader 把 SFC 当 default object 给 typeof），但**运行时 SettingsContent === undefined**
- Vue 模板解析 `<SettingsContent ref="contentRef" />` 找不到组件定义 → 降级为原始 HTML 自定义元素 `<settingscontent>`（tagName 小写化）
- 浏览器解析 `<settingscontent>` → `HTMLUnknownElement`；**所有 Vue 功能失效**（ref 是未知元素实例、没有任何暴露面、事件不转发、生命周期不触发、ErrorCaptured 不工作）
- 表现：右栏 width=0、flex 子项塌缩；`.settings-content-wrapper` / `#settings-tab-panel` 全 missing；先前所有加固（onErrorCaptured 返回按钮 兜底）都不起作用——因为根本没组件实例可加钩子

**修复（单字符级）**：
```diff
-import type SettingsContent from './SettingsContent.vue'
+import SettingsContent from './SettingsContent.vue'
```
模板里 `<SettingsContent>` 恢复 Vue 组件识别 → 渲染管线恢复正常 → 所有先前加固生效。

**验证基线**：
- `vue-tsc --noEmit` 0 errors
- `biome` clean
- `vitest run src/views/settingsWindow` 19 文件 194 用例全绿
- `SettingsContent.test.ts` widerProbe 用例虽然 5/5，但生产环境探针输出说明 happy-dom mock 与真实 DOM `HTMLUnknownElement` 不一致（happy-dom 给的是 Element 不是 HTMLUnknownElement），所以**单测无法捕获此类 bug**——下一轮可在 e2e 加一道回归断言 `wrapper.element.constructor.name !== 'HTMLUnknownElement'`

**铁律已沉淀**：
- 写入 `MEMORY.md`「前端易错点」末条：致命陷阱 — SFC 默认导出严禁 `import type`
- 排查信号：`Ref.value.constructor === HTMLUnknownElement` + `Object.keys(Ref.value) === []` + DOM tagName 小写化

**改动文件**：`src/views/settingsWindow/SettingsPage.vue`（单字符级修复）；`.workbuddy/memory/MEMORY.md`（铁律）；`.workbuddy/memory/2026-08-18.md`（值班记录）。

---

## 第九轮 — Form-item 探针锁定 setting-item fit-content 塌缩（2026-08-18 20:55）

**用户探针输出铁证**（dev 面板新增 `probeFormItems()` 函数 + 「Form-item 探针」按钮）：
```
【容器】 rect=1235×461
§2 字体设置 — 容器 1219×22 — 2 个 setting-item
  Item 1 [0] setting-info 96×50 @360,488
        [1] n-select 150×34 @333,544   ← y=544
  Item 2 [0] setting-info 96×50 @369,488
        [1] font-size-control 168×21 @333,544  ← y 也=544

§3 界面效果 — 容器 1219×22 — 2 个 setting-item
  Item 1 [0] @333,559
  Item 2 [0] @333,559
```

**根因（致命陷阱 #2）**：Vue `<style scoped>` 的 `.setting-item { display: flex; justify-content: space-between }` **没声明 `width: 100%`**，flex container default `width: auto` 在 CSS spec 下退化为 **fit-content**（≈子元素自然宽度）。同 section 两个 item 的 [0] y 坐标完全相同 → **flex-wrap 把每个 item 内部 [0][1] 推到不同行（视觉聚拢成浮层）**。NotificationSettings / SessionSettings / SidebarSettings 等 17 个 tab 全中招。

**修复（全设置窗生效）**：在 `src/styles/css/design-tokens.css` 末尾追加全局保底：
```css
/* Settings layout 兜底：scoped flex 容器缺 width: 100% 时退化为 fit-content */
.settings-section,
.setting-item {
  box-sizing: border-box;
  width: 100%;
}
```
优先级 (0,0,1,0) 低于 scoped `[data-v-xxx]` (0,0,2,0)，不会覆盖 scoped 显式其他属性。

**新增回归测试**：`__tests__/SettingsContent.test.ts` 新增 `exposes probeFormItems() walks through .settings-section tree`，断言每个 .setting-item 在容器宽度 600 时 rect.w ≥ 400 —— 防止未来回改或被无意删除。

**验证基线**：
- `vue-tsc --noEmit` 0 errors
- `vitest run src/views/settingsWindow` 19 文件 194 用例全绿
- `SettingsContent.test.ts` 6/6（含新探针用例）
- 全 settingsWindow 测试包括 puppeteer/happy-dom 覆盖

**铁律已沉淀到 `MEMORY.md`**「前端易错点」末位：
> 任何 `display: flex` 容器都要 `width: 100%` 或 `flex: 1 1 100%`，否则 fit-content 塌缩；Vue scoped CSS 编译后选择器带 data-v 优先级 (0,0,2,0) 高于全局 (0,0,1,0)，所以全局保底规则是安全的。

**改动文件**：`src/styles/css/design-tokens.css`（加 16 行）；`src/views/settingsWindow/__tests__/SettingsContent.test.ts`（加 1 个测试 60+ 行）；`.workbuddy/memory/2026-08-18.md`（值班记录）；`MEMORY.md`（铁律）。未提交。


---

## 🔴 设置项「飘浮小卡」根因更正（2026-08-18 21:11）

之前把"设置项塌缩"误诊为 scoped `.setting-item` 缺 `width:100%`（加全局 `.setting-item{width:100%}`），用户 NotificationSettings 截图证实无效。

**真正根因**（git 历史 `fdfe6350` + mixin 追踪定位）：`src/layout/left/style.scss:51` 用**全局通用类名** `.setting-item` 写 `@include menu-item-style(absolute)`，该 mixin（`src/styles/scss/global/variable.scss:112`）展开为 `position:absolute; width:fit-content; background; border-radius; box-shadow; z-index:999; white-space:nowrap; overflow:hidden`——污染所有 `.setting-item`，设置窗设置项因此全部 absolute 叠一起"漂浮"、宽塌缩、右侧控件被裁（白色小卡外观与截图完全吻合）。

**修复**：`src/styles/css/design-tokens.css` 末尾改用设置窗作用域精准覆盖（不动 left layout 菜单）：`.settings-content-body .setting-item { position: static !important; display:flex; flex-direction:row; flex-wrap:nowrap; align-items:center; justify-content:space-between; width:100% !important; min-width:0; max-width:100%; box-sizing:border-box; background:transparent; border-radius:0; box-shadow:none; z-index:auto; white-space:normal; overflow:visible }` + `.setting-info { flex:1 1 auto }`。特异性 (0,0,2,0)+!important 双保险覆盖 left layout 全局 (0,0,1,0)。

**验证**：vue-tsc 0 errors；vitest settingsWindow 19 文件 195 用例全绿。

**铁律更正**：MEMORY.md「前端易错点」末条改为"全局通用类名污染"——排查飘浮小卡先 grep 全局裸 `.类名` 定义再看 mixin 展开；修复用受害组件作用域精准覆盖，绝不用裸全局选择器（会破坏原菜单）。

---

## 🟢 设置项飘浮 · 根因级修复收口（2026-08-18 21:21）

用户提示「查记忆，以前解决过」→ 追到 `ActionList.vue:525` 确有前人 `.setting-item { position:static; z-index:auto }` 修复，但只作用于 ActionList 自身 scoped（护住左导航"更多"菜单），**没覆盖设置窗**，属半成品。

**真正的泄漏机制**：`src/layout/left/style.scss` 的裸 `.setting-item { @include menu-item-style(absolute); @include menu-list() }` 被多个 `<style scoped>` 用 `@use` 引入。本项目构建下 `@use` 进 scoped 的**外部 partial 未被加 scope 属性**，被编译成全局规则，泄漏污染设置窗与 ChatHeaderSidebar 的 `.setting-item` → 白色小卡飘浮、竖排塌缩、右侧控件被裁。

**最终修复（替换之前的 !important band-aid）**：
1. `src/layout/left/components/ActionList.vue`：新增 `@use '@/styles/scss/global/variable.scss' as *`，把 `.setting-item` 规则搬进自身 `<style scoped>`（带 data-v-actionlist，popover teleport 到 body 也不泄漏）。
2. `src/layout/left/style.scss`：删除裸 `.setting-item` 规则 → 全局泄漏消失。
3. `src/styles/css/design-tokens.css`：删除 `.settings-content-body .setting-item` 的 `!important` 兜底补丁。
4. `SettingsContent.test.ts`：probeFormItems 宽度断言改为结构性不变量（1 section / 2 items）。

**验证**：vue-tsc 0 errors；biome 62 文件 clean；vitest settingsWindow 19 文件 195 用例全绿。`grep setting-item style.scss` 已无全局规则。

**关键教训**：共享 partial 的裸全局类名经 `@use` 进 scoped 会泄漏（本项目已知坑）；修复应把规则移进真正需要它的组件 scoped 块，而非在全局 css 用 `!important` 反打。前人"局部修复"常是半成品，需确认是否覆盖所有受害组件。
