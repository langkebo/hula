# VoIP 通话媒体层接通（独立立项收尾）

> 2026-08-18 ｜ 触发来源：Issue 4「打电话 / 打视频没有专门的 UI 界面」深度排查

## 一、现状盘点

通话 UI 链路在工作区已重建完成，骨架是通的：

- `windowRtc.ts` `startRtcCall` → 创建 `rtcCall` Tauri 窗口
- `CallWindow/index.vue` 完整 UI（`CallVideoStage` / `CallAvatarStage` / `CallControlsBar` / `CallIncomingBanner` + 铃声 + 计时器 + 窗口管理）
- `useVoIPCallFlow.ts` 跨端通话流程；`useCallState` / `useCallControls` / `useCallMedia` 状态与媒体绑定
- `MatrixVoIPService` 具备 `startCall` / `answerCall` / `rejectCall` / `hangupCall` / `toggleMute` / `toggleVideo` / `startScreenshare` 完整 API
- `MatrixClientLifecycle.initialize()` 已调用 `matrixVoIPService.initialize()` 挂载 `Call.incoming / Call.hangup / Call.replaced` 监听；`App.vue` 注册 `useVoIPIncomingCall` 来电窗口

即「按钮 → 窗口 → CallView 骨架」已通，**缺的是媒体层真正接通**——SDK 的 WebRTC 调用契约与代码实际写法错配，导致通话要么不连、要么静音/关视频失效。

## 二、根因（SDK v40 API 错配）

`MatrixVoIPService` 沿用了旧版 / 自定义形态的 `MatrixCall` 媒体 API，与 vendored `matrix-js-sdk` v40.2.0 的真实契约不符：

| 调用点 | 旧写法（错误） | v40 真实契约 | 后果 |
|--------|----------------|--------------|------|
| `startCall` | `call.placeCall(this.localStream, options.video)` | `placeCall(audio: boolean, video: boolean)` | 把 `MediaStream` 当 `audio` 布尔传入；SDK 仍会自行 `getUserMedia` 采集，与 `this.localStream` 重复竞争摄像头/麦克风；实际发送流 ≠ 预览流 |
| `answerCall` | `call.answer(this.localStream, options.video)` | `answer(audio?: boolean, video?: boolean)` | 同上；静音/关视频只作用在预览流，对方仍可见可闻 |
| `toggleMute` | 操作 `this.localStream.getAudioTracks()[0].enabled` | `setMicrophoneMuted(muted)` | 只静音本地预览，对方仍能听到（静音失效） |
| `toggleVideo` | 操作 `this.localStream.getVideoTracks()[0].enabled` | `setLocalVideoMuted(muted)` | 只关预览视频，对方仍能看到 |
| `handleFeedsChanged` | 全部 feed 当一个远端流 | feed 同时含本地+远端，按 `isLocal()` 拆分 | 本地预览流缺失 / 远端流错乱 |

SDK 权威契约（`node_modules/matrix-js-sdk/lib/web-rtc/call.d.ts`）：

- `placeCall(audio: boolean, video: boolean): Promise<void>`（line 530）
- `answer(audio?: boolean, video?: boolean): Promise<void>`（line 349）
- `setLocalVideoMuted(muted: boolean): Promise<boolean>`（line 411）
- `setMicrophoneMuted(muted: boolean): Promise<boolean>`（line 427）—— **音频静音方法名为 `setMicrophoneMuted`，不是 `setLocalAudioMuted`**
- `CallFeed.isLocal(): boolean`、`CallFeed.stream: MediaStream`（`callFeed.d.ts:84,12`）

## 三、修复清单（`src/services/matrix/media/`）

1. `voipTypes.ts` — `VoIPCall` 接口对齐 v40：`answer(audio?, video?)`、`placeCall(audio, video)`、`setLocalVideoMuted` / `setMicrophoneMuted`（移除 SDK 不存在的 `setLocalAudioMuted`）。
2. `MatrixVoIPService.startCall` — 不再由服务层 `getUserMedia`；`call.placeCall(options.audio, options.video)` 让 SDK 内部采集并发起邀请。
3. `MatrixVoIPService.answerCall` — 同上 `call.answer(options.audio, options.video)`。
4. `handleFeedsChanged` — 按 `feed.isLocal()` 拆分本地预览流 / 远端流（兼容方法或属性两种形态）。
5. `toggleMute` — `call.setMicrophoneMuted(next)`，返回新静音态。
6. `toggleVideo` — `call.setLocalVideoMuted(next)`，返回新视频态。
7. 移除服务层持有的 `localStream`（避免与 SDK 重复采集）；`cleanupCall` / `resetRuntimeState` 不再 `stop` SDK 拥有的轨道（屏幕共享流 `screenStream` 仍由服务层释放）。

## 四、验证

- `vue-tsc --noEmit` 无错误
- `biome check` clean
- `MatrixVoIPService.test.ts` 6/6（含 5 个新增 v40 契约回归用例：placeCall/answer 布尔参数、feeds_changed 本地/远端拆分、mute 走 `setMicrophoneMuted`）

## 五、端到端手动验收清单（需真机）

媒体 / WebRTC 无法在单测覆盖，需实机双客户端验证：

1. A 在单聊点「视频通话」→ B 收到来电横幅 → 接听 → 双方均见对方视频、本地预览正确
2. 通话中 A 点静音 → B 侧听不到 A → A 再取消静音恢复
3. 通话中 A 关视频 → B 侧看不到 A 视频 → 再开恢复
4. 挂断 → 双方窗口关闭、无残留「设备列表暴涨」
5. 确认 synapse `keys/query` 无 429（关联 Issue 5 / MatrixClient 重复初始化专项）

## 六、已知限制（本期不修）

- `CallWindow/index.vue` `handleSwitchCamera` 直接操作 `localStream` 包装流，切换摄像头不一定作用于 SDK 真实发送轨道；属增强项，留待后续。
- TURN 未部署时 NAT 环境可能不通（已有 `checkVoipAvailability` / `checkTurnAvailability` 预警）。
- 发起通话前置条件：`startRtcCall` 要求 `globalStore.currentSession` 为 SINGLE 且带 `detailId`，否则弹 toast 不建窗口——若「点按钮没反应」，先确认当前会话上下文是否就绪。
