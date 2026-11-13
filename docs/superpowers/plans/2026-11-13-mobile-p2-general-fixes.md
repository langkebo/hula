# 移动端「一般」级遗留修复实施计划（2026-11-13）

> 来源：`docs/移动端界面全面审查报告-2026-11-13.md`。C-16、T-20 已完成，本计划处理重核后仍未修的 41 条「一般」级问题（G-12 含双文件、Y-13/Y-14 同属 Files.vue）。

**Goal:** 按批次修复移动端 41 条一般级问题，每批独立可验收、可提交。

**Architecture:** 全部改动在 `src/mobile/**` 优先落地；涉及 Matrix 能力必须先复用 `src/services/matrix/**` 现有方法（R1），禁止组件直连 SDK、禁止新建平行客户端。若服务端/SDK 无对应能力（如反馈单号、文件真实删除、二维码登录 IP），一律隐藏入口或降级为已有能力，不做假入口。

**Tech Stack:** Vue 3 `<script setup>`、Vant、Pinia、vue-router、vue-i18n、UnoCSS、`--tjg-*` design tokens。

## Global Constraints

- 颜色只用 `--tjg-*` token，禁止新增 `#xxx`/`rgb()`。
- 图标只用 SVG，装饰性图标补 `aria-hidden="true"`。
- 新 i18n key 必须同步 `locales/zh-CN`、`locales/en` 并跑 `pnpm gen:i18n`。
- 单文件不得超过 800 行；超限拆分。
- 移动端不得出现 admin / AI 入口（R2）。
- 每批完成后串行执行验收命令。

---

## Batch A：导航 / 壳层 / 全局（8 项）

| ID | 文件 | 修复动作 |
| --- | --- | --- |
| S-3 | `src/mobile/layout/chat-room/ChatRoomLayout.vue` | 返回按钮：`history.state.back` 为空时 `router.replace('/mobile/message')`，否则 `router.back()` |
| S-4 | `src/mobile/views/chat-room/notice/NoticeList.vue` | 列表滚动位置缓存（路由 query 或模块级 Map），返回时恢复；`keepAlive` 按路由配置可行性评估后再开 |
| L-5 | `src/router/routes/mobile.ts`、`src/router/routes/common.ts` | 移动端启动页改独立路由名 `mobileSplashscreen`，消除与 common 的 `splashscreen` 重名 |
| L-9 | `src/mobile/login.vue` | `onMounted` 用 `hasAuthenticatedSession()` 判定已有会话时 `router.replace('/mobile/message')` |
| Q-11 | `src/mobile/views/secretChat/SecretChatPage.vue` | 显式补顶部 `safe-area-inset-top`（页面壳未套 MobileLayout），不新增路由壳 |
| S-8 | `src/mobile/components/common/MobileConnectionBanner.vue` | 按连接状态机区分「重连中 / 已离线 / 同步落后」文案与重试按钮，文案走 i18n |
| S-6 | `src/mobile/layout/navBar/index.vue` | 标题容器补 `min-w-0 overflow-hidden`，左右按钮 `shrink-0`；调用方标题补 `truncate` |
| S-1 | `src/mobile/layout/my/MyLayout.vue` | 删除无样式的 `page-view` class |

验收：`vue-tsc`、定向路由/布局测试、`pnpm test:run`。

## Batch B：聊天室交互（10 项）

| ID | 文件 | 修复动作 |
| --- | --- | --- |
| C-8 | `src/mobile/components/chat-room/HeaderBar.vue` | 窄屏（<360dp）通过媒体查询收起次要按钮（私密开关收进更多菜单），群名保持 `truncate` |
| C-12 | 录音入口（`VoiceRecorder.vue` 对应移动端调用处） | 识别 `NotAllowedError` 时弹确认框提供「去设置」，其余错误保持 toast |
| C-14 | `src/mobile/views/chat-room/MobileForwardDialog.vue` | 目标列表按 roomId 去重；批量转发逐条收集失败并汇总提示 |
| C-17 | `src/mobile/views/chat-room/LocationShare.vue` | 上次选择的有效期/精度写入共享 store（localStorage），重进回填 |
| C-18 | `LocationMessage.vue`、`BeaconMessage.vue` | 静态地图 `map-error` 显示占位图 + 重试按钮 |
| C-20 | `ChatMessageList.vue` 时间分隔 | 分隔文字改用 `--tjg-text-secondary`，补未读分隔线（若 SDK 已有未读标记则复用） |
| G-12 | `ChatRemarkField.vue`、`ContactAliasField.vue` | 备注/别名 `:maxlength="32"` + `show-word-limit` |
| G-14 | `src/mobile/views/chat-room/ChatSetting.vue` | 先查 `MatrixRoomService` 邀请链接/二维码能力；有则加入口，无则不加假入口 |
| R-11 | `src/mobile/views/chat-room/notice/NoticeList.vue` | 空态「发布公告」引导（按 `canAddAnnouncement`）+ 本地已读标记 |
| R-6 | `src/mobile/components/VideoPreview.vue` | `visibilitychange` 为 hidden 时 `video.pause()`，卸载移除监听 |

## Batch C：好友 / 房间 / 空间（9 项）

| ID | 文件 | 修复动作 |
| --- | --- | --- |
| M-7 | `src/mobile/composables/useMobileCreateDialogs.ts` | 建群前校验成员数 >=1 且 <= 上限，不满足阻断并提示 |
| F-10 | `src/mobile/views/friends/ConfirmAddFriend.vue` | `submitting` 锁 + 按钮 `loading/disabled` |
| F-11 | `src/mobile/views/friends/ConfirmAddGroup.vue` | `try/catch` 并按 Matrix errcode 分支提示（已加入/需审批/群满/封禁） |
| F-13 | `src/mobile/views/friends/FriendGroups.vue` | 分组变更后清 `membersByGroup` 缓存并触发联系人列表重拉 |
| O-4 | `src/mobile/views/rooms/index.vue` | 首屏 `van-skeleton`；分页按 SDK 房间列表能力评估，无分页 API 则只补骨架 |
| O-5 | `src/mobile/views/rooms/index.vue` | 加入房间失败经 `matrixErrorTranslator` 转译 |
| P-3 | `src/mobile/views/space/SpaceView.vue` | 详情层顶部补可点击层级面包屑 |
| P-4 | `src/mobile/views/space/SpaceView.vue` | 空间头像编辑：复用 `useAvatarUpload` + `MatrixSpaceService` 已有方法 |
| P-5 | `src/mobile/views/space/components/SpaceChildrenList.vue` | 按成员状态区分「进入 / 加入」并分流动作 |

## Batch D：我的 / 设置 / 通话（14 项）

| ID | 文件 | 修复动作 |
| --- | --- | --- |
| T-14 | `src/mobile/views/my/MobileInvitePermission.vue` | 保存成功补 toast |
| T-16 | `src/mobile/views/my/BurnAfterReadSettings.vue` | 补「全局默认 → 房间级覆盖」层级说明 |
| T-19 | `src/mobile/components/message/MobileReactionPicker.vue` | 「更多」跳转表情管理页（路由已存在） |
| T-21 | `src/mobile/views/my/HelpFeedback.vue` | 先查后端反馈接口：有则补附件/联系方式/回执；无则仅回填联系方式，不加假单号 |
| T-22 | `src/mobile/views/my/HomeserverSettings.vue` | 增加「测试连接」按钮，只探测不落库 |
| T-24 | `src/mobile/views/my/VoiceVideoSettings.vue` | 展示麦克风/摄像头权限状态并支持申请 |
| Y-10 | `src/mobile/views/my/MyAlbum.vue` | 分页/懒加载；预览传 originalUrl；开启保存并补结果提示 |
| Y-12 | `src/mobile/views/my/StatusSettings.vue` | 状态有效期 + 清除状态（复用 `matrixPresenceService`） |
| Y-13 | `src/mobile/views/my/Files.vue` | 打开走媒体/文件服务；删除调用 `MatrixMediaService` 真实接口 |
| Y-14 | `src/mobile/views/my/Files.vue` | 上传入口（复用现有上传统一入口）+ 已用容量汇总 |
| Y-15 | `src/mobile/views/my/components/MobileMyEntryList.vue` | 复用能力过滤/服务端能力判定动态构建入口 |
| Y-16 | `src/mobile/views/my/MobileSettings.vue` | 搜索关键词写入 route.query 或会话缓存，返回回填 |
| X-5 | `src/mobile/components/MobileLayout.vue` | 底部固定区按 `keyboardInset` 抬升（仅应用于输入页底栏） |
| X-7 | `src/mobile/components/chat-room/HeaderBar.vue` 等 | 装饰性 `<svg>` 统一补 `aria-hidden="true"` + 守卫测试扫描 `src/mobile` |
| Q-4 | `src/mobile/views/ConfirmQRLogin.vue` | 仅当 sessionInfo 含设备名/IP 时展示；无数据不编造 |
| Q-8 | `src/mobile/views/rtcCall/index.vue` | `peerDisplayName` 为空时用 `remoteUserId` 拉 profile，最终兜底 unknown |
| Q-10 | `src/mobile/views/secretChat/SecretChatPage.vue` | 补「退出私密模式」入口（复用现有会话级移除动作） |

## 执行与验收

1. 每批内按表格顺序逐项修改，涉及 i18n 的一次性补齐后 `pnpm gen:i18n`。
2. 每批结束串行执行：
   `pnpm vue-tsc --noEmit` → 定向 vitest → `pnpm test:run` → `pnpm check:ratchet` → `pnpm check:doc-coverage` → `pnpm check:doc-paths` → `pnpm check:sdk-boundary` → `pnpm quality:no-raw-fetch` → `pnpm check`
3. 每批通过后按用户指示提交；`.workbuddy/memory/*.md` 不纳入提交。
4. 若某项确认无 SDK/服务端能力支撑，记录「不可复用原因」并把该项降级为「不做假入口」，不从计划中静默删除。
