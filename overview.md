# 架构优化执行 — P2 收尾（2026-08-13）

## 本次完成项

### P2-7: `services/types.ts` 按域拆分 ✅
- 608 行单文件拆分为 6 个域模块 + barrel 入口：
  - `types/user.ts`（用户：RegisterUserReq / UserItem / UserInfoType / BadgeType / ModifyUserInfoType / UserState）
  - `types/message.ts`（消息：消息体 / MsgType / ReplyType / 互动标记）
  - `types/notice.ts`（通知：RequestNoticeAgreeStatus / NoticeType / NoticeItem）
  - `types/contact.ts`（联系人/会话：FriendItem / IsAllUserEnum / SessionItem）
  - `types/room.ts`（房间：DetailsContent / RoomMemberInfo / RoomDetail / RoomInfo）
  - `types/misc.ts`（杂项：AIModel / FilesMeta）
- `types.ts` 保留为 barrel（`export *`），`@/services/types` 导入路径不变 → **零调用点改动**（66 处无后缀 + 23 处 `.ts` 后缀引用全部兼容）

### P2-8: 审计 41 处 `biome-ignore` ✅
- 结论：仅 `RoomSettingsDrawer.vue` 的 `biome-ignore-all noConsole` 为非必要豁免（掩盖调试 console），已移除
- 其余 40 处均为合法豁免：Worker/Logger/CLI 的 `noConsole`、模板 enum 的 `useImportType`、SDK 类型的 `noExplicitAny`、生成 `.d.ts` 的 `lint: disable`、测试桩

### P2-9: 清理调试 console ✅
- `RoomSettingsDrawer.vue` 是唯一含真实调试 console 的源码文件（6 处）
- 清理：`onErrorCaptured` 错误边界改 `logger.error`，移除 5 处调试 `console.log` + 1 个调试 `watch`
- 其余 4 个"文件"为统计误报（Logger.ts 本体 / Console.ts 助手 / workerLogger.ts worker / PathUtil.ts JSDoc 示例）

### P2-2: `services/` 根目录杂项归类 ✅（核验确认，历史已完成）
- `BadgeService→notification/`、`ConfigService→backend/`、`UploadService→performance/`、`fingerprint→secure/`、`mapApi→legacy/`；根目录仅剩 `i18n.ts / renderWorker.ts / types.ts`

### P2-5: three.js / shiki 按需加载评估 ✅
- 结论：已充分优化，无需改动——`shiki` 全动态 import，`three` 组件级懒加载（`TjgAssistant` 经 `defineAsyncComponent`），`manualChunks` + `modulePreload` 过滤重 chunk

### P2-6: 双平台共享逻辑评估 ✅
- 深入核验 11 个同名组件（10 组有效）：**结论是无需大规模提取**
- 已共享：BurnAfterReadSettings（`useBurnAfterRead`）、PreferencesSettings（`useSettingStore`）
- 同名不同责：NotificationSettings（本地偏好 vs Matrix 推送规则）、SecuritySettings（会话安全 vs 加密账号）
- 逻辑轻量：Labs/Mjolnir/VoiceVideoSettings、ThreadIndicator
- 有限重叠仅 ThreadView/EncryptionSettings 的编排层，但核心逻辑已下沉 service，强行提取 ROI 低

## 守门验证结果

| 命令 | 结果 |
|:---|:---|
| `vue-tsc --noEmit` | 0 errors ✅ |
| `biome check`（改动文件） | clean ✅ |
| `RoomSettingsDrawer.test.ts` | 22/22 全绿 ✅ |

## 提交记录

| 提交 | 内容 |
|:---|:---|
| `c4c9f318` | refactor(core): P2-7 types.ts 按域拆分 6 个域模块 |
| `194266f9` | refactor(core): P2-9 清理 RoomSettingsDrawer 调试 console |

## 剩余待处理项

- **P2-4**：Storybook 覆盖率提升至 20%+（3-5 人日，未启动）
- **P1-3**：Service 层单元测试（进行中，约 30 个测试文件待提交验证）
- **P1-8**：组件测试继续补测（ROI 递减）
