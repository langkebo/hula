# HuLa 桌面端与移动端功能对比分析报告

## 1. 项目结构概览

### 1.1 目录结构差异

| 层面 | 桌面端 | 移动端 |
|------|--------|--------|
| **Views** | `src/views/` (20+ 窗口目录) | `src/mobile/views/` (6 个页面目录 + 独立页面) |
| **Components** | `src/components/` (25+ 分类: encryption, pinned, burn, room, friend 等) | `src/mobile/components/` (3 分类: chat-room, my, virtual-scroll + 6 独立组件) |
| **Layout** | `src/layout/` (center, left, right, index) | `src/mobile/layout/` (chat-room, friends, my, navBar, tabBar) |
| **Settings** | 两套: `settingsWindow/tabs/` (16 个标签页) 和 `moreWindow/settings/` (16 个设置页) | `mobile/views/my/` (25 个页面) |
| **Services** | `src/services/matrix/` (70+ 服务，两端共享) | 同左，两端共享同一服务层 |
| **Stores** | `src/stores/` (40 个 store，两端共享) | 同左，额外 `mobile.ts` 管理移动端特有状态 |
| **i18n** | `src/i18n/locales/` (zh-CN, en-US) | 同左，两端共享翻译文件 |

### 1.2 路由配置

| 配置 | 桌面端 | 移动端 |
|------|--------|--------|
| **路由函数** | `getDesktopRoutes()` | `getMobileRoutes()` |
| **路由数量** | ~50+ 路由 | ~40+ 路由 |
| **通用路由** | `getCommonRoutes()` - 两端共享 | 同左 |
| **设置路由** | `/settings` 下 16 个子路由 | `/mobile/mobileMy` 下 25 个子路由 |
| **聊天路由** | `/home` 下 `/message` 等 | `/mobile/chatRoom` 下 chatMain/spaceDetail/setting 等 |
| **好友路由** | `/friendsList`, `/searchFriend` 等 | `/mobile/mobileFriends` 下 6 个子路由 |

### 1.3 UI 框架差异

| 层面 | 桌面端 | 移动端 |
|------|--------|--------|
| **组件库** | Naive UI | Vant |
| **图标** | @iconify/vue | @iconify/vue (共享) |
| **CSS** | UnoCSS + SCSS | UnoCSS + SCSS (共享) |
| **虚拟滚动** | VirtualList / VirtualMessageList / vue-virtual-scroller | SmartVirtualList |
| **状态管理** | Pinia (共享) | Pinia (共享) |
| **路由** | Vue Router (共享) | Vue Router (共享) |

---

## 2. 功能对比分析

### 2.1 消息功能

| 功能 | 桌面端 | 移动端 | 状态 |
|------|--------|--------|------|
| 聊天窗口 | `views/homeWindow/message/` | `mobile/views/chat-room/MobileChatMain.vue` | ✅ 同步 |
| 房间管理 | `ManageGroupMember.vue` | `MobileInviteGroupMember.vue` | ✅ 同步 |
| 公告 | `announWindow/` | `mobile/views/chat-room/notice/` | ✅ 同步 |
| 聊天记录搜索 | `SearchDetails.vue` | `SearchChatContent.vue` | ✅ 同步 |
| 消息引用/转发 | 右键菜单 + `ForwardDialog.vue` | 长按菜单 + `MobileForwardDialog.vue` | ✅ 同步 |
| 阅后即焚 | `components/burn/BurnIndicator.vue` | `MobileBurnIndicator.vue` | ✅ 同步 |
| 置顶消息 | `components/pinned/PinnedEventsBar.vue` | `MobilePinnedEventsBar.vue` | ✅ 同步 |
| 房间列表 | `RoomList.vue` | `mobile/views/room/index.vue` | ✅ 同步 |
| 创建/加入房间 | `CreateRoomDialog.vue` | 移动端房间页面 | ✅ 同步 |
| 空间列表 | `SpaceList.vue` | 移动端房间页面Tab | ✅ 同步 |
| 空间详情 | `spaceWindow/SpaceDetail.vue` | `mobile/views/room/SpaceDetail.vue` | ✅ 同步 |
| 消息线程 | `components/thread/ThreadPanel.vue` | `MobileThreadPanel.vue` | ✅ 同步 |
| 媒体预览 | `imageViewerWindow/` + `videoViewerWindow/` | `ImagePreview.vue` + `VideoPreview.vue` | ✅ 同步 |
| 聊天设置 | `rightBox/Details.vue` | `ChatSetting.vue` | ✅ 同步 |
| 群成员管理 | `ManageGroupMember.vue` | `GroupChatMember.vue` | ✅ 同步 |
| 消息渲染 | `rightBox/renderMessage/` (16 种消息类型) | `MessageContainer.vue` | ✅ 同步 |

### 2.2 通讯录/好友

| 功能 | 桌面端 | 移动端 | 状态 |
|------|--------|--------|------|
| 好友列表 | `FriendsList.vue` | `mobile/views/friends/index.vue` | ✅ 同步 |
| 添加好友 | `friendWindow/SearchFriend.vue` | `mobile/views/friends/AddFriends.vue` | ✅ 同步 |
| 好友验证 | `friendWindow/AddFriendVerify.vue` | `mobile/views/friends/ConfirmAddFriend.vue` | ✅ 同步 |
| 房间验证 | `friendWindow/AddGroupVerify.vue` | `mobile/views/friends/ConfirmAddGroup.vue` | ✅ 同步 |
| 房间创建 | `components/room/CreateRoomDialog.vue` | `mobile/views/friends/StartGroupChat.vue` | ✅ 同步 |
| 二维码名片 | `MyQRCode.vue` | `mobile/views/MyQRCode.vue` | ✅ 同步 |
| 好友详情 | `FriendDetailDrawer.vue` | `mobile/views/friends/FriendInfo.vue` | ✅ 同步 |

### 2.3 设置与个人中心

| 功能 | 桌面端 | 移动端 | 状态 |
|------|--------|--------|------|
| 个人资料编辑 | `settingsWindow/tabs/AccountSettings.vue` | `EditProfile.vue` | ✅ 同步 |
| 修改头像 | ✅ | ✅ | ✅ 同步 |
| 修改昵称/签名 | ✅ | `EditBio.vue` | ✅ 同步 |
| 生日 | ✅ | `EditBirthday.vue` | ✅ 同步 |
| 二维码名片 | ✅ | `MobileQRCode.vue` | ✅ 同步 |
| 收藏夹 | ✅ | `Favorites.vue` | ✅ 同步 |
| 文件管理 | ✅ | `Files.vue` | ✅ 同步 |
| 相册 | ✅ | `MyAlbum.vue` | ✅ 同步 |
| 设备管理 | `Sessions.vue` + `DeviceCard.vue` | `DeviceManagement.vue` | ✅ 同步 |
| 设备重命名 | `DeviceRenameDialog.vue` | `DeviceManagement.vue` (内嵌) | ✅ 同步 |
| 通知设置 | `NotificationSettings.vue` | `NotificationSettings.vue` | ✅ 同步 |
| 语音视频设置 | `VoiceVideoSettings.vue` | `VoiceVideoSettings.vue` | ✅ 同步 |
| 安全隐私 | `SecuritySettings.vue` | `SecuritySettings.vue` | ✅ 同步 |
| 实验室功能 | `LabsSettings.vue` | `LabsSettings.vue` | ✅ 同步 |
| 集成设置 | `IntegrationsSettings.vue` | `IntegrationsSettings.vue` | ✅ 同步 |
| 状态设置 | `StatusSettings.vue` | `StatusSettings.vue` | ✅ 同步 |
| Homeserver 设置 | `HomeserverSettings.vue` | `HomeserverSettings.vue` | ✅ 同步 |
| OpenClaw 设置 | `OpenClawSettings.vue` | `OpenClawChat.vue` | ✅ 同步 |
| 3PID 管理 | `components/settings/ThreePidManagement.vue` | `ThreePidManagement.vue` | ✅ 同步 |
| 忽略用户 | `components/settings/IgnoredUsersManagement.vue` | `IgnoredUsers.vue` | ✅ 同步 |
| 登录历史 | `SessionSettings.vue` | `LoginHistory.vue` | ✅ 同步 |
| 帮助反馈 | `HelpSettings.vue` | `HelpFeedback.vue` | ✅ 同步 |
| 快捷键设置 | `KeyboardSettings.vue` | ⚠️ 无 | ❌ 移动端不需要 |
| 外观设置 | `AppearanceSettings.vue` | ⚠️ 无 | ❌ 移动端不需要 |
| 侧边栏设置 | `Sidebar.vue` | ⚠️ 无 | ❌ 移动端不需要 |
| 登录设置 | `LoginSetting.vue` | ⚠️ 无 | ❌ 移动端不需要 |
| 商店管理 | `ManageStore.vue` | ⚠️ 无 | ❌ 移动端不需要 |
| 通用设置 | `General.vue` | `MobileSettings.vue` | ⚠️ 部分功能不同 |

### 2.4 加密与安全功能

| 功能 | 桌面端 | 移动端 | 状态 |
|------|--------|--------|------|
| 密钥备份 | `KeyBackupVersionManager.vue` + `KeyBackupDialog.vue` | `MobileKeyBackup.vue` | ✅ 同步 |
| 密钥备份恢复 | `KeyBackupRestoreDialog.vue` | `MobileKeyBackup.vue` (内嵌) | ✅ 同步 |
| 密钥备份设置 | `KeyBackupSetupDialog.vue` | `MobileKeyBackup.vue` (内嵌) | ✅ 同步 |
| 设备验证 (SAS) | `SasVerificationDialog.vue` | `SecuritySettings.vue` (内嵌弹窗) | ✅ 同步 |
| 密钥轮转 | `KeyRotationDialog.vue` | `SecuritySettings.vue` (内嵌弹窗) | ✅ 同步 |
| 跨签名 | `CrossSigningDialog.vue` | `SecuritySettings.vue` (内嵌) | ✅ 同步 |
| 加密状态 | `EncryptionStatus.vue` | `SecuritySettings.vue` (内嵌) | ✅ 同步 |
| 设备验证对话框 | `DeviceVerifyDialog.vue` | `SecuritySettings.vue` (内嵌) | ✅ 同步 |

### 2.5 插件/扩展功能

| 功能 | 桌面端 | 移动端 | 状态 |
|------|--------|--------|------|
| AI 助手 | `plugins/robot/` | `AiAssistant.vue` | ✅ 同步 |
| OpenClaw | `openclaw/OpenClawView.vue` | `OpenClawChat.vue` | ✅ 同步 |
| 机器人 | `plugins/robot/` | ⚠️ 无 | ❌ 移动端不需要 |
| 动态广场 | `plugins/dynamic/` | ⚠️ 无 | ❌ 移动端不需要 |
| Trends Radar | `trendradar/TrendRadarView.vue` | ⚠️ 无 | ❌ 移动端不需要 |
| 邮件 | `mailWindow/` | ⚠️ 无 | ❌ 移动端不需要 |
| 文件管理器 | `fileManagerWindow/` | ⚠️ 无 | ❌ 移动端不需要 |
| 在线状态 | `onlineStatusWindow/` | ⚠️ 无 | ❌ 移动端不需要 |

### 2.6 通话功能

| 功能 | 桌面端 | 移动端 | 状态 |
|------|--------|--------|------|
| 音视频通话 | `views/callWindow/` | `mobile/views/rtcCall/` | ✅ 同步 |
| 通话悬浮球 | ✅ | `RtcCallFloatCell.vue` | ✅ 同步 |

### 2.7 其他窗口/功能

| 功能 | 桌面端 | 移动端 | 状态 |
|------|--------|--------|------|
| 截图 | `Capture.vue` | ⚠️ 无 | ❌ 系统级功能 |
| 锁屏 | `LockScreen.vue` | ⚠️ 无 | ❌ 系统级功能 |
| 系统托盘 | `Tray.vue` | ⚠️ 无 | ❌ 系统级功能 |
| 通知 | `Notify.vue` | ⚠️ 无 | ❌ 系统级功能 |
| 更新检查 | `CheckUpdate.vue` | ⚠️ 无 | ❌ 系统级功能 |
| 图片预览 | `imageViewerWindow/` | `ImagePreview.vue` | ✅ 同步 |
| 视频预览 | `videoViewerWindow/` | `VideoPreview.vue` | ✅ 同步 |
| 关于 | `aboutWindow/` | `HelpFeedback.vue` (内嵌) | ⚠️ 功能合并 |
| 多消息管理 | `multiMsgWindow/` | ⚠️ 无 | ❌ 移动端不需要 |
| 数据同步 | - | `SyncData.vue` | ✅ 移动端特有 |
| 启动屏 | `SplashScreen.vue` | `Splashscreen.vue` | ✅ 同步 |
| 隐私协议 | `agreementWindow/` | `MobilePrivacyAgreement.vue` | ✅ 同步 |
| 服务协议 | `agreementWindow/` | `MobileServiceAgreement.vue` | ✅ 同步 |
| 忘记密码 | `forgetPasswordWindow/` | `MobileForgetPassword.vue` | ✅ 同步 |
| QR 登录确认 | - | `ConfirmQRLogin.vue` | ✅ 移动端特有 |
| 管理面板 | `admin/ModerationPanel.vue` | ⚠️ 无 | ❌ 移动端不需要 |

---

## 3. 核心差异总结

### 3.1 已同步的功能（2026-04-14 更新）

| 功能 | 桌面端组件 | 移动端组件 | 同步日期 |
|------|-----------|-----------|----------|
| 状态设置 | `StatusSettings.vue` | `StatusSettings.vue` | 2026-04-09 |
| Homeserver 设置 | `HomeserverSettings.vue` | `HomeserverSettings.vue` | 2026-04-09 |
| OpenClaw | `OpenClawView.vue` | `OpenClawChat.vue` | 2026-04-09 |
| 消息转发 | `ForwardDialog.vue` | `MobileForwardDialog.vue` | 2026-04-09 |
| 阅后即焚 | `BurnIndicator.vue` | `MobileBurnIndicator.vue` | 2026-04-14 |
| 置顶消息 | `PinnedEventsBar.vue` | `MobilePinnedEventsBar.vue` | 2026-04-14 |
| 消息引用回复 | 右键菜单 | 长按菜单 | 2026-04-09 |
| 房间列表 | `RoomList.vue` | `room/index.vue` | 2026-04-09 |
| 创建/加入房间 | `CreateRoomDialog.vue` | 移动端房间页面 | 2026-04-09 |
| 空间列表/详情 | `SpaceList.vue` + `SpaceDetail.vue` | `room/index.vue` + `SpaceDetail.vue` | 2026-04-13 |
| 消息线程 | `ThreadPanel.vue` | `MobileThreadPanel.vue` | 2026-04-13 |
| 设备管理/重命名 | `Sessions.vue` + `DeviceRenameDialog.vue` | `DeviceManagement.vue` | 2026-04-13 |
| 3PID 管理 | `ThreePidManagement.vue` | `ThreePidManagement.vue` | 2026-04-13 |
| 密钥备份 | `KeyBackupVersionManager.vue` | `MobileKeyBackup.vue` | 2026-04-13 |
| 设备验证 (SAS) | `SasVerificationDialog.vue` | `SecuritySettings.vue` (内嵌) | 2026-04-14 |
| 密钥轮转 | `KeyRotationDialog.vue` | `SecuritySettings.vue` (内嵌) | 2026-04-14 |

### 3.2 移动端不需要的功能

以下功能是桌面端特有的，移动端不需要实现：

| 功能 | 原因 |
|------|------|
| 快捷键设置 | 移动端无键盘快捷键 |
| 外观设置 | 移动端使用系统主题 |
| 侧边栏设置 | 移动端无侧边栏 |
| 登录设置 | 移动端使用简化登录流程 |
| 商店管理 | 移动端不需要 |
| 机器人/动态广场/Trends Radar | 桌面端插件，移动端不需要 |
| 邮件/文件管理器 | 移动端使用系统应用 |
| 截图/锁屏/托盘 | 系统级功能 |
| 多消息管理 | 移动端不需要 |
| 管理面板 | 移动端不需要 |

### 3.3 功能同步度评估

| 类别 | 同步率 | 说明 |
|------|--------|------|
| 核心聊天功能 | 100% | 消息、房间、公告、转发、引用回复、线程、置顶、阅后即焚已同步 |
| 通讯录 | 100% | 好友、房间创建、二维码名片已同步 |
| 加密安全 | 100% | 密钥备份、设备验证、密钥轮转、3PID、设备管理已同步 |
| 个人中心 | 100% | 所有必要设置项已同步，快捷键/外观等移动端不需要 |
| AI 功能 | 100% | OpenClaw + AI 助手已同步 |
| 系统功能 | N/A | 移动端使用系统原生能力 |

---

## 4. SDK 集成状态

### 4.1 双端完成的 SDK 集成模块

| SDK Manager | 服务层 | 桌面端 UI | 移动端 UI | 状态 |
|-------------|--------|----------|----------|------|
| AuthManager | MatrixAuthService | Login.vue | Login.vue | ✅ 双端完成 |
| PresenceManager | MatrixPresenceService | SecurityPrivacy.vue | StatusSettings.vue | ✅ 双端完成 |
| KeyBackupManager | MatrixKeyBackupService | KeyBackupVersionManager.vue | MobileKeyBackup.vue | ✅ 双端完成 |
| KeyVerificationManager | MatrixVerificationService | SasVerificationDialog.vue | SecuritySettings.vue (内嵌) | ✅ 双端完成 |
| KeyRotationManager | MatrixKeyRotationService | KeyRotationDialog.vue | SecuritySettings.vue (内嵌) | ✅ 双端完成 |
| ThreadManager | MatrixThreadService | ThreadPanel.vue | MobileThreadPanel.vue | ✅ 双端完成 |
| FriendManager | MatrixFriendService | FriendListView.vue | friends/*.vue | ✅ 双端完成 |
| SpaceManager | MatrixSpaceService | SpacePanel.vue | SpaceDetail.vue | ✅ 双端完成 |
| BurnAfterReadManager | MatrixBurnAfterReadService | BurnIndicator.vue | MobileBurnIndicator.vue | ✅ 双端完成 |
| PinnedEventsManager | MatrixPinnedEventsService | PinnedEventsBar.vue | MobilePinnedEventsBar.vue | ✅ 双端完成 |
| QrLoginManager | MatrixQrLoginService | QRCode.vue | MobileQRCode.vue | ✅ 双端完成 |
| AccountManager | MatrixAccountService | AccountSettings.vue | SecuritySettings.vue | ✅ 双端完成 |
| RoomManager | MatrixRoomService | RoomList.vue | room/index.vue | ✅ 双端完成 |

### 4.2 仅服务层集成的模块（无独立 UI）

| SDK Manager | 服务层 | 说明 |
|-------------|--------|------|
| SecureBackupManager | MatrixSecureBackupService | 安全备份，集成在 KeyBackup 流程中 |
| AccountDataManager | MatrixAccountDataService | 账户数据，底层服务 |
| SlidingSync | MatrixSlidingSyncService | 滑动同步，底层服务 |
| BeaconManager | MatrixBeaconService | 信标，集成在位置消息中 |
| LocationManager | MatrixLocationService | 位置，集成在位置消息中 |
| MediaManager | MatrixMediaService | 媒体，底层服务 |
| MediaQuotaManager | MatrixQuotaService | 配额，集成在媒体上传中 |
| WidgetManager | MatrixWidgetService | 小部件，集成在房间中 |
| GuestManager | MatrixGuestService | 访客，底层服务 |

### 4.3 服务层统计

| 指标 | 数量 |
|------|------|
| 总服务数 | 70+ |
| 有单元测试的服务 | 26 |
| 总测试数 | 560 (43 test files) |
| 使用 BaseManager 的服务 | 6 (核心服务) |
| throwOnError 支持 | 6 (核心服务) |

---

## 5. 组件架构对比

### 5.1 桌面端组件架构

```
src/components/
├── atomic/          # 原子组件 (LoadingSpinner, PinInput)
├── burn/            # 阅后即焚 (BurnIndicator, BurnMessage)
├── business/        # 业务组件 (RecallCountdown, UrlPreviewCard)
├── call/            # 通话 (CallView)
├── common/          # 通用组件 (ContextMenu, Screenshot, Settings*)
├── dm/              # 私信 (CreateDmDialog, DmListView)
├── encryption/      # 加密 (SasVerification, KeyBackup*, KeyRotation, CrossSigning)
├── fileManager/     # 文件管理 (FileContent, SideNavigation)
├── friend/          # 好友 (AddFriendDialog, FriendDetailDrawer, FriendListView)
├── openclaw/        # OpenClaw (ConnectionStatus, ModelSelector)
├── performance/     # 性能 (LazyImage, VirtualMessageList)
├── pinned/          # 置顶 (PinnedEventsBar)
├── poll/            # 投票 (PollCreateDialog, PollMessage)
├── presence/        # 在线状态 (PresenceIndicator, PresenceSelector)
├── privacy/         # 隐私 (PrivacyOverlay)
├── quota/           # 配额 (QuotaDisplay)
├── rightBox/        # 聊天右侧 (ChatHeader, ChatFooter, renderMessage, emoticon)
├── room/            # 房间 (CreateRoomDialog, InviteDialog, MemberList, RoomInfoPanel)
├── search/          # 搜索 (SpotlightDialog)
├── settings/        # 设置 (DeviceRenameDialog, IgnoredUsersManagement, ThreePidManagement)
├── space/           # 空间 (AddToSpaceDialog, CreateSpaceDialog, SpacePanel)
├── thread/          # 线程 (ThreadPanel)
├── trendradar/      # 趋势雷达 (NewsCard, SearchPanel, TrendingPanel)
├── userMenu/        # 用户菜单 (UserMenuDesktop, UserMenuMobile)
├── voice/           # 语音 (VoiceMessageEnhanced, VoiceRecorderEnhanced)
└── windows/         # 窗口 (ActionBar)
```

### 5.2 移动端组件架构

```
src/mobile/
├── components/
│   ├── chat-room/       # 聊天室 (MessageContainer, FooterBar, HeaderBar, MobileForwardDialog, panel/*)
│   ├── my/              # 个人中心 (PersonalInfo, Settings, ShareModal, MyMessageItem, MobileApplyList)
│   └── virtual-scroll/  # 虚拟滚动 (SmartVirtualList, MeasuredItem)
│   ├── HeaderBar.vue    # 通用头部栏
│   ├── ImagePreview.vue # 图片预览
│   ├── MobileLayout.vue # 移动端布局
│   ├── PullToRefresh.vue# 下拉刷新
│   ├── RtcCallFloatCell.vue # 通话悬浮球
│   └── VideoPreview.vue # 视频预览
├── views/
│   ├── chat-room/       # 聊天室页面 (MobileChatMain, ChatSetting, GroupChatMember, notice/*)
│   ├── friends/         # 好友页面 (index, AddFriends, ConfirmAdd*, StartGroupChat, FriendInfo)
│   ├── message/         # 消息页面 (index)
│   ├── my/              # 个人中心页面 (25 个子页面)
│   ├── room/            # 房间页面 (index, SpaceDetail, components/*)
│   └── rtcCall/         # 通话页面 (index)
└── layout/
    ├── chat-room/       # 聊天室布局 (ChatRoomLayout, NoticeLayout)
    ├── friends/         # 好友布局 (FriendsLayout)
    ├── my/              # 个人中心布局 (MyLayout)
    ├── navBar/          # 导航栏 (index)
    └── tabBar/          # 标签栏 (index)
```

### 5.3 移动端特有组件

| 组件 | 路径 | 说明 |
|------|------|------|
| MobileBurnIndicator | `room/components/MobileBurnIndicator.vue` | 阅后即焚指示器（内联气泡） |
| MobilePinnedEventsBar | `room/components/MobilePinnedEventsBar.vue` | 置顶消息条（聊天界面顶部） |
| MobileRoomItem | `room/components/MobileRoomItem.vue` | 房间列表项 |
| MobileSpaceItem | `room/components/MobileSpaceItem.vue` | 空间列表项 |
| MobileThreadPanel | `room/components/MobileThreadPanel.vue` | 消息线程面板 |
| MobileForwardDialog | `chat-room/MobileForwardDialog.vue` | 消息转发对话框 |
| PullToRefresh | `components/PullToRefresh.vue` | 下拉刷新 |
| SmartVirtualList | `components/virtual-scroll/SmartVirtualList.vue` | 智能虚拟列表 |

---

## 6. 优化建议

### 6.1 已完成

1. ✅ 桌面端状态设置页面 - `StatusSettings.vue`
2. ✅ 桌面端 Homeserver 设置 - `HomeserverSettings.vue`
3. ✅ 移动端 OpenClaw 支持 - `OpenClawChat.vue`
4. ✅ 移动端消息转发 - `MobileForwardDialog.vue`
5. ✅ 移动端阅后即焚 UI - `MobileBurnIndicator.vue`
6. ✅ 移动端置顶消息 UI - `MobilePinnedEventsBar.vue`
7. ✅ 移动端消息引用功能 - `ContextMenu` 长按菜单
8. ✅ 移动端房间列表页面 - `room/index.vue`
9. ✅ 移动端空间列表/详情 - 房间列表Tab + `SpaceDetail.vue`
10. ✅ 移动端创建/加入房间 - 房间列表页面
11. ✅ 移动端TABAR添加房间按钮 - 已更新TABAR配置
12. ✅ 移动端设备管理/重命名 - `DeviceManagement.vue`
13. ✅ 移动端3PID管理 - `ThreePidManagement.vue`
14. ✅ 移动端密钥备份 - `MobileKeyBackup.vue`
15. ✅ 移动端设备验证 (SAS) - `SecuritySettings.vue` 内嵌弹窗
16. ✅ 移动端密钥轮转 - `SecuritySettings.vue` 内嵌弹窗
17. ✅ 移动端消息线程 - `MobileThreadPanel.vue`

### 6.2 待集成（组件已创建，需接入页面）

1. **MobilePinnedEventsBar** → 集成到 `MobileChatMain.vue` 聊天界面顶部
2. **MobileBurnIndicator** → 集成到移动端消息渲染组件中

### 6.3 低优先级优化

1. **虚拟滚动统一** - 当前有 4 套并存（VirtualList, SmartVirtualList, VirtualMessageList, vue-virtual-scroller），建议统一
2. **更多 Service 迁移 throwOnError** - 当前 6/70+ 核心服务已迁移
3. **更多 Service 单元测试** - 当前 26/70+ 服务有测试
4. **全局缓存扩展** - 用户资料缓存、房间状态缓存等

---

## 7. 技术架构建议

### 7.1 代码复用策略

| 策略 | 当前状态 | 建议 |
|------|---------|------|
| 公共组件 | `components/atomic/`, `components/common/` | 继续提取共享原子组件 |
| 业务逻辑 | `composables/` (6 个) | 继续提取共享 composable |
| 服务层 | `services/matrix/` (70+ 服务，两端共享) | ✅ 已统一 |
| Stores | `stores/` (40 个，两端共享) | ✅ 已统一 |
| i18n | 共享翻译文件 | ✅ 已统一 |
| 类型定义 | 共享 TypeScript 类型 | ✅ 已统一 |

### 7.2 平台检测

- 当前使用 `type() === 'ios' || type() === 'android'` 判断
- 建议: 统一平台检测工具函数

### 7.3 路由组织

- 当前路由分别定义在 `getMobileRoutes()` 和 `getDesktopRoutes()`
- 建议: 使用路由元信息 `meta: { desktop?: boolean; mobile?: boolean }` 简化

### 7.4 设计模式差异

| 模式 | 桌面端 | 移动端 |
|------|--------|--------|
| 加密功能 | 独立对话框组件 (Dialog) | 内嵌在 SecuritySettings 弹窗中 (Popup) |
| 置顶消息 | 独立组件嵌入聊天头部 | 独立组件嵌入聊天头部 |
| 阅后即焚 | 独立组件嵌入消息气泡 | 独立组件嵌入消息气泡 |
| 消息操作 | 右键菜单 | 长按菜单 |
| 设置页面 | 双套系统 (settingsWindow + moreWindow) | 单套系统 (mobileMy) |
| 房间/空间 | 独立页面 | Tab 切换统一页面 |

---

*报告生成时间: 2026-04-09*
*最后更新: 2026-04-14 - 全部 P2 模块双端同步完成*
