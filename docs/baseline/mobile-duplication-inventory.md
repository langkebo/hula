# 桌面/移动双端重复面量化盘点（MT-09）

> 文档版本：v1.0.0
> 维护人：前端负责人
> 最后更新：2026-10-12
> 关联任务：P3-5 MT-09（`docs/TJG-保守项后续优化方案-2026-10-12.md`）
> 性质：**只盘点，不改代码**
> 清理记录：2026-11-06 已删除 §6 中 2 个 `.bak` 备份残留与 `typography.scss.bak`（依据
> [`03-redundancy-report.md`](../../design-system/tjg-mobile/audit/03-redundancy-report.md) A-01）
>
> 清理记录（同批）：2026-11-06 完成 C-03（design-tokens.css 去重，token 437→386、零引用 23→0）、
> C-07（`FooterBar.vue` 删除与 `MobilePanel` 重复的语音入口，保留 `MsgInputMobileControls.vue`）、
> C-12（`mobileCssGuards.test.ts` 硬编码清单改为 `src/mobile` glob 扫描）、
> C-01（`public/msgAction/` 8 个动画表情重编码为 64px APNG，7.1M→944K）、
> B-03（`logoL.png`/`logoD.png` 与 `logo.png` 内容一致，合并为 256px `logo.png`，3.1M→30K）
> （依据同报告 C-03 / C-07 / C-12 / C-01 / B-03）

---

## 1. 目的

`src/mobile/**` 与 `src/**` 长期各自演进，规模此前未量化。本文档盘点 `src/mobile/**` **全量文件**
与桌面端同名/同职责文件的映射关系，把每个文件归入三类之一，并给出收敛优先级与影响面，为后续
「共享抽取 / 保留 / 删除」决策提供依据。

本任务**不产生任何代码变更**。

---

## 2. 盘点方法

1. 遍历 `src/mobile/**` 全部文件（含测试与备份），统计扩展名分布。
2. 以 **basename 同名**为第一判据，把 `src/mobile/**` 的每个源文件与 `src/**`（排除 `src/mobile/`）
   的源文件做映射；`index.{vue,ts}` 属通用命名，跨目录同名不算真实配对，单独剔除。
3. 对配对文件读取行数/导入来源，判定「同名不同实现」还是「真实重复」。
4. 结合目录语义（`Mobile*` 前缀、`useMobile*`、Vant 依赖）归类。

判据脚本（只读，临时）：遍历 mobile 与 src 源文件、按 basename 建索引、统计命中。
移动端引入 `vant` 的文件经 `grep` 确认 **40 个**（另有大量 `van-*` 组件由 `unplugin-vue-components`
自动导入，故 40 为下界）。

---

## 3. 总量与分类汇总

| 指标 | 数值 |
| :--- | ---: |
| `src/mobile/**` 全量文件 | **166** |
| ├─ `.vue` | 111 |
| ├─ `.ts` | 53 |
| └─ `.bak` | 2 |
| 非测试源文件（`.vue`+`.ts`，去测试） | **119** |
| 测试 `.ts`（`__tests__/` 或 `*.test.ts`） | 45 |
| 与桌面端 **真实同名配对**（剔除通用 `index.*` 噪声） | **9** |

分类结果（对 119 源文件 + 2 备份 = **121 行**逐一归类）：

| 类别 | 数量 | 说明 |
| :--- | ---: | :--- |
| ① 可共享（抽到 `src/shared/`） | **1** | `useSendCodeCountdown.ts`（已是薄适配层，委托 `src/shared/composables/useCountdown`） |
| ② 平台差异实现（保留） | **118** | 移动端专属 UI（Vant）/ composable / 路由配置 |
| ③ 纯重复（可删） | **2** | `ChatSetting.vue.bak`、`index.vue.bak`（备份残留，非构建输入） |

> 45 个测试文件跟随被测源码存在，不参与「共享/删除」判定，归为 **② 保留**（见 §4）。

---

## 4. 三类定义与判据

| 类别 | 定义 | 判据 | 处置 |
| :--- | :--- | :--- | :--- |
| **① 可共享** | 逻辑与平台无关、桌面/移动可共用，当前却各自维护 | 无 Vant/Naive 强耦合、无移动专属路由常量、纯逻辑 | 抽到 `src/shared/`，双端引用同一实现 |
| **② 平台差异实现** | 交互范式/组件库不同（移动 Vant vs 桌面 Naive），语义一致但实现必须分离 | 引入 `vant`/`van-*` 或桌面 UI 组件；`Mobile*`/`useMobile*` 前缀 | **保留**；仅当内部存在**可提取的纯逻辑**时再抽 shared |
| **③ 纯重复** | 无引用、非构建输入、可安全删除 | `.bak` 备份、孤儿文件 | 删除 |

**关键结论**：本仓的「双端重复」**绝大多数是 ② 平台差异实现，而非可合并的纯重复**。
这与 AGENTS.md「优先补全 `src/mobile/` 独立实现」的策略一致——移动端有意采用 Vant 独立实现，
不应为了「去重」把两端强行合并。

---

## 5. 真实同名配对（9 处，需逐一复核内部可提取逻辑）

这 9 处移动端文件与桌面端**同名**。经行数/实现比对，均为**同名不同实现**（Vant vs Naive），
**不属纯重复**；但应复核其内部是否混有可提取到 `src/shared/` 的纯逻辑。

| 移动端 | 桌面端 | 行数（移动/桌面） | 判定 |
| :--- | :--- | :---: | :--- |
| `src/mobile/components/thread/ThreadIndicator.vue` | `src/components/thread/ThreadIndicator.vue` | 69 / 95 | ② 平台差异 |
| `src/mobile/views/dynamic/detail.vue` | `src/plugins/dynamic/detail.vue` | 53 / 90 | ② 平台差异 |
| `src/mobile/views/my/BurnAfterReadSettings.vue` | `src/views/settingsWindow/tabs/BurnAfterReadSettings.vue` | — | ② 平台差异 |
| `src/mobile/views/my/EncryptionSettings.vue` | `src/views/settingsWindow/tabs/EncryptionSettings.vue` | — | ② 平台差异 |
| `src/mobile/views/my/MjolnirSettings.vue` | `src/views/settingsWindow/tabs/MjolnirSettings.vue` | — | ② 平台差异 |
| `src/mobile/views/my/NotificationSettings.vue` | `src/views/settingsWindow/tabs/NotificationSettings.vue` | — | ② 平台差异 |
| `src/mobile/views/my/PreferencesSettings.vue` | `src/views/settingsWindow/tabs/PreferencesSettings.vue` | 290 / 640 | ② 平台差异 |
| `src/mobile/views/my/SecuritySettings.vue` | `src/views/settingsWindow/tabs/SecuritySettings.vue` | 431 / 198 | ② 平台差异 |
| `src/mobile/views/my/VoiceVideoSettings.vue` | `src/views/settingsWindow/tabs/VoiceVideoSettings.vue` | — | ② 平台差异 |

> 其余 9 处「basename 命中」为 `index.{vue,ts}` 通用命名造成的**误报**（如 `layout/index.vue`
> 命中 `src/components/rightBox/*/index.vue`），已剔除，不计入配对。

---

## 6. 全量清单（121 行 = 119 源文件 + 2 备份）

| 文件 | 类别 | 说明 |
| :--- | :---: | :--- |
| `src/mobile/components/AreaDrawer.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/components/ImagePreview.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/components/MobileLayout.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/components/PushNotificationList.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/components/RtcCallFloatCell.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/components/VideoPreview.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/components/chat-room/AutoFixHeightPage.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/components/chat-room/BeaconMessage.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/components/chat-room/FooterBar.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/components/chat-room/HeaderBar.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/components/chat-room/LocationMessage.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/components/chat-room/MobileBatchToolbar.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/components/chat-room/PrivateModeConfirmDialog.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/components/chat-room/panel/More.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/components/chat-room/panel/VoicePanel.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/components/common/MobileConnectionBanner.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/components/encryption/MobileDehydratedDeviceDialog.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/components/encryption/MobileDeviceTrustManager.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/components/encryption/MobileDeviceVerifyDialog.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/components/encryption/MobileKeyBackupDialog.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/components/encryption/MobileSecureBackupDialog.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/components/login/MobileCaptchaVerify.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/components/login/MobileLoginForm.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/components/login/MobileRegisterForm.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/components/message/MobileCreateDialogs.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/components/message/MobileReactionPicker.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/components/message/MobileSessionHeader.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/components/message/MobileSessionList.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/components/my/MobileApplyList.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/components/my/MobileQuickActions.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/components/my/PersonalInfo.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/components/my/Settings.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/components/thread/ThreadIndicator.vue` | ② | 移动端实现（Vant），与 `src/components/thread/ThreadIndicator.vue` 同名不同实现 |
| `src/mobile/components/thread/ThreadView.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/components/virtual-scroll/SmartVirtualList.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/composables/useMobileCreateDialogs.ts` | ② | 移动端专属 composable |
| `src/mobile/composables/useMobileLongPress.ts` | ② | 移动端专属 composable |
| `src/mobile/composables/useMobileMessageActions.ts` | ② | 移动端专属 composable |
| `src/mobile/composables/useMobileScrollRefresh.ts` | ② | 移动端专属 composable |
| `src/mobile/composables/useMobileSessionList.ts` | ② | 移动端专属 composable |
| `src/mobile/composables/useSendCodeCountdown.ts` | ① | 薄适配层，已委托 `src/shared/composables/useCountdown` |
| `src/mobile/layout/chat-room/ChatRoomLayout.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/layout/chat-room/NoticeLayout.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/layout/friends/FriendsLayout.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/layout/index.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/layout/my/MyLayout.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/layout/navBar/index.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/layout/tabBar/index.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/login.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/views/AddGroupQRCode.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/views/ConfirmQRLogin.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/views/MobileForgetPassword.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/views/MobilePrivacyAgreement.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/views/MobileServiceAgreement.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/views/MyQRCode.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/views/Splashscreen.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/views/SyncData.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/views/chat-room/ChatSetting.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/views/chat-room/GroupChatMember.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/views/chat-room/LocationShare.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/views/chat-room/ManageGroupMember.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/views/chat-room/MediaViewer.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/views/chat-room/MobileChatMain.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/views/chat-room/MobileForwardDialog.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/views/chat-room/MobileInviteGroupMember.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/views/chat-room/MobileListManagementDialog.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/views/chat-room/MobileRoomUpgradeDialog.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/views/chat-room/SearchChatContent.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/views/chat-room/notice/NoticeDetail.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/views/chat-room/notice/NoticeEdit.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/views/chat-room/notice/NoticeList.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/views/dynamic/detail.vue` | ② | 移动端实现（Vant），与 `src/plugins/dynamic/detail.vue` 同名不同实现 |
| `src/mobile/views/dynamic/index.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/views/friends/AddFriends.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/views/friends/ConfirmAddFriend.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/views/friends/ConfirmAddGroup.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/views/friends/FriendGroups.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/views/friends/FriendInfo.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/views/friends/StartGroupChat.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/views/friends/index.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/views/message/index.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/views/my/AiAssistant.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/views/my/BurnAfterReadSettings.vue` | ② | 移动端实现（Vant），与 `src/views/settingsWindow/tabs/BurnAfterReadSettings.vue` 同名不同实现 |
| `src/mobile/views/my/DeviceManagement.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/views/my/EditBio.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/views/my/EditBirthday.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/views/my/EditProfile.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/views/my/EncryptionSettings.vue` | ② | 移动端实现（Vant），与 `src/views/settingsWindow/tabs/EncryptionSettings.vue` 同名不同实现 |
| `src/mobile/views/my/Files.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/views/my/HelpFeedback.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/views/my/HomeserverSettings.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/views/my/IntegrationsSettings.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/views/my/LabsSettings.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/views/my/MjolnirSettings.vue` | ② | 移动端实现（Vant），与 `src/views/settingsWindow/tabs/MjolnirSettings.vue` 同名不同实现 |
| `src/mobile/views/my/MobileDeactivateAccount.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/views/my/MobileEmojiManager.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/views/my/MobileIgnoredUsers.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/views/my/MobileInvitePermission.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/views/my/MobilePushSettings.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/views/my/MobileQRCode.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/views/my/MobileSecurityKeySetup.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/views/my/MobileSettings.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/views/my/MobileStorageSettings.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/views/my/MyAlbum.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/views/my/MyMessages.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/views/my/NotificationSettings.vue` | ② | 移动端实现（Vant），与 `src/views/settingsWindow/tabs/NotificationSettings.vue` 同名不同实现 |
| `src/mobile/views/my/PasswordSettings.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/views/my/PreferencesSettings.vue` | ② | 移动端实现（Vant），与 `src/views/settingsWindow/tabs/PreferencesSettings.vue` 同名不同实现 |
| `src/mobile/views/my/SecuritySettings.vue` | ② | 移动端实现（Vant），与 `src/views/settingsWindow/tabs/SecuritySettings.vue` 同名不同实现 |
| `src/mobile/views/my/Share.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/views/my/SimpleBio.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/views/my/StatusSettings.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/views/my/VoiceVideoSettings.vue` | ② | 移动端实现（Vant），与 `src/views/settingsWindow/tabs/VoiceVideoSettings.vue` 同名不同实现 |
| `src/mobile/views/my/index.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/views/my/mobileSettingsConfig.ts` | ② | 移动端专属配置 |
| `src/mobile/views/my/settingsRoutes.ts` | ② | 移动端专属路由常量 |
| `src/mobile/views/rooms/index.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/views/rtcCall/index.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/views/space/SpaceView.vue` | ② | 移动端专属 UI（Vant） |
| `src/mobile/views/chat-room/ChatSetting.vue.bak` | ③ | 已删除（备份残留，非构建输入） |
| `src/mobile/views/message/index.vue.bak` | ③ | 已删除（备份残留，非构建输入） |

> 45 个测试 `.ts`（`__tests__/` 或 `*.test.ts`）归 **② 保留**：它们跟随被测源码存在，
> 不参与共享/删除判定；若源码被抽到 `src/shared/`，其测试同步迁移。

---

## 7. 收敛优先级与影响面（不改代码，仅建议）

| 优先级 | 动作 | 对象 | 影响面 | 风险 |
| :---: | :--- | :--- | :--- | :--- |
| **P0** | 删除备份残留 | 2 个 `.bak`（③） | 零构建影响（非构建输入） | 极低；确认无人在用后删除 |
| **P1** | 内联薄适配层 | `useSendCodeCountdown.ts`（①） | 调用点改为直接用 `src/shared/composables/useCountdown` | 低；需改所有引用点并跑测试 |
| **P2** | 复核 9 处同名配对内部可提取逻辑 | §5 表 9 处 | 仅当内部确有平台无关纯逻辑时抽 shared | 中；逐文件评审，避免误并入 UI |
| **—** | **不做** | 118 处平台差异实现（②） | — | 强行合并会破坏移动端 Vant 交互范式 |

**结论**：本仓移动端重复面 **98.3%（118/119）为有意保留的平台差异实现**，
真正可收敛的仅 **1 处薄适配层（P1）+ 2 处备份残留（P0）**，加上 9 处同名配对需人工复核。
不存在需要「大规模合并双端」的场景。

---

## 8. 验收对照

| 验收判据 | 达成 |
| :--- | :---: |
| 清单覆盖 `src/mobile/**` 全量文件 | ✅ 166 文件全量统计（111 `.vue` + 53 `.ts` + 2 `.bak`） |
| 每文件归入三类之一 | ✅ 119 源文件 + 2 备份逐行归类（§6） |
| 产出收敛建议（含优先级） | ✅ §7（P0/P1/P2 + 明确不做项） |
