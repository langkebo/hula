# Element-Web 功能迁移任务列表

## 开发原则

1. **SDK 集成优先**：所有 Matrix 协议功能必须通过 matrix-js-sdk 实现
2. **Vue 3 最佳实践**：使用 Composition API + TypeScript
3. **阶段审查机制**：每个阶段完成后进行代码审查
4. **渐进式开发**：优先实现核心功能，增强功能后续迭代

---

## 阶段一：核心消息功能增强 (预计 5 天)

### 1.1 消息编辑与删除

| 任务ID | 任务描述 | SDK API | 文件路径 | 状态 | 优先级 |
|--------|---------|---------|---------|------|--------|
| EM-001 | 创建 MessageEditService | `client.redactEvent()` | `src/services/matrix/MessageEditService.ts` | 待执行 | P0 |
| EM-002 | 实现消息编辑功能 | `client.editMessage()` | `src/views/message/components/MessageEditor.vue` | 待执行 | P0 |
| EM-003 | 实现消息删除功能 | `client.redactEvent()` | `src/views/message/components/MessageActions.vue` | 待执行 | P0 |
| EM-004 | 实现编辑历史查看 | `client.relations()` | `src/views/message/components/EditHistory.vue` | 待执行 | P1 |

### 1.2 消息回复与引用

| 任务ID | 任务描述 | SDK API | 文件路径 | 状态 | 优先级 |
|--------|---------|---------|---------|------|--------|
| EM-005 | 实现消息回复功能 | `client.sendEvent()` | `src/views/message/components/ReplyComposer.vue` | 待执行 | P0 |
| EM-006 | 实现引用消息显示 | - | `src/views/message/components/MessageQuote.vue` | 待执行 | P0 |
| EM-007 | 实现回复消息渲染 | - | `src/views/message/components/ReplyMessage.vue` | 待执行 | P0 |

### 1.3 消息反应（Emoji Reactions）

| 任务ID | 任务描述 | SDK API | 文件路径 | 状态 | 优先级 |
|--------|---------|---------|---------|------|--------|
| EM-008 | 创建 ReactionService | `client.sendEvent()` | `src/services/matrix/ReactionService.ts` | 待执行 | P0 |
| EM-009 | 实现反应选择器 | - | `src/views/message/components/ReactionPicker.vue` | 待执行 | P0 |
| EM-010 | 实现反应显示 | `client.relations()` | `src/views/message/components/MessageReactions.vue` | 待执行 | P0 |
| EM-011 | 实现反应统计 | - | `src/views/message/components/ReactionSummary.vue` | 待执行 | P1 |

### 1.4 消息转发

| 任务ID | 任务描述 | SDK API | 文件路径 | 状态 | 优先级 |
|--------|---------|---------|---------|------|--------|
| EM-012 | 创建 ForwardService | `client.sendEvent()` | `src/services/matrix/ForwardService.ts` | 待执行 | P0 |
| EM-013 | 实现转发对话框 | - | `src/views/message/components/ForwardDialog.vue` | 待执行 | P0 |
| EM-014 | 实现房间选择列表 | - | `src/views/message/components/ForwardRoomList.vue` | 待执行 | P0 |

### 1.5 消息搜索

| 任务ID | 任务描述 | SDK API | 文件路径 | 状态 | 优先级 |
|--------|---------|---------|---------|------|--------|
| EM-015 | 创建 SearchService | `client.search()` | `src/services/matrix/SearchService.ts` | 待执行 | P0 |
| EM-016 | 实现房间内搜索 | - | `src/views/message/components/RoomSearch.vue` | 待执行 | P0 |
| EM-017 | 实现搜索结果展示 | - | `src/views/message/components/SearchResults.vue` | 待执行 | P0 |

### 1.6 阅读回执与输入状态

| 任务ID | 任务描述 | SDK API | 文件路径 | 状态 | 优先级 |
|--------|---------|---------|---------|------|--------|
| EM-018 | 实现阅读回执发送 | `client.sendReadReceipt()` | `src/services/matrix/ReceiptService.ts` | 待执行 | P0 |
| EM-019 | 实现阅读回执显示 | - | `src/views/message/components/ReadReceipts.vue` | 待执行 | P1 |
| EM-020 | 实现输入状态发送 | `client.sendTypingNotification()` | `src/services/matrix/TypingService.ts` | 待执行 | P0 |
| EM-021 | 实现输入状态显示 | - | `src/views/message/components/TypingIndicator.vue` | 待执行 | P0 |

### 📋 阶段一审查清单

```
□ 运行类型检查: npx vue-tsc --noEmit
□ 运行单元测试: npx vitest run
□ 启用 code-review 技能审查
□ 验证 SDK API 正确使用
□ 修复所有错误和警告
□ 更新任务状态
```

---

## 阶段二：房间管理增强 (预计 4 天)

### 2.1 房间创建

| 任务ID | 任务描述 | SDK API | 文件路径 | 状态 | 优先级 |
|--------|---------|---------|---------|------|--------|
| EM-022 | 创建 RoomCreateService | `client.createRoom()` | `src/services/matrix/RoomCreateService.ts` | 待执行 | P0 |
| EM-023 | 实现创建房间对话框 | - | `src/views/dialogs/CreateRoomDialog.vue` | 待执行 | P0 |
| EM-024 | 实现房间类型选择 | - | `src/views/dialogs/RoomTypeSelector.vue` | 待执行 | P0 |
| EM-025 | 实现房间设置表单 | - | `src/views/dialogs/RoomSettingsForm.vue` | 待执行 | P0 |

### 2.2 房间邀请与成员管理

| 任务ID | 任务描述 | SDK API | 文件路径 | 状态 | 优先级 |
|--------|---------|---------|---------|------|--------|
| EM-026 | 创建 RoomMemberService | `client.invite()` | `src/services/matrix/RoomMemberService.ts` | 待执行 | P0 |
| EM-027 | 实现邀请对话框 | - | `src/views/dialogs/InviteDialog.vue` | 待执行 | P0 |
| EM-028 | 实现成员列表组件 | - | `src/views/room/components/MemberList.vue` | 待执行 | P0 |
| EM-029 | 实现成员管理面板 | - | `src/views/room/components/MemberPanel.vue` | 待执行 | P0 |
| EM-030 | 实现成员权限管理 | `client.setPowerLevel()` | `src/views/room/components/MemberPower.vue` | 待执行 | P1 |

### 2.3 房间权限设置

| 任务ID | 任务描述 | SDK API | 文件路径 | 状态 | 优先级 |
|--------|---------|---------|---------|------|--------|
| EM-031 | 创建 RoomPowerService | `client.getStateEvent()` | `src/services/matrix/RoomPowerService.ts` | 待执行 | P0 |
| EM-032 | 实现权限设置面板 | - | `src/views/room/settings/PowerLevelSettings.vue` | 待执行 | P0 |
| EM-033 | 实现角色管理 | - | `src/views/room/settings/RoleManager.vue` | 待执行 | P1 |

### 2.4 房间别名管理

| 任务ID | 任务描述 | SDK API | 文件路径 | 状态 | 优先级 |
|--------|---------|---------|---------|------|--------|
| EM-034 | 创建 RoomAliasService | `client.createAlias()` | `src/services/matrix/RoomAliasService.ts` | 待执行 | P0 |
| EM-035 | 实现别名管理面板 | - | `src/views/room/settings/AliasSettings.vue` | 待执行 | P1 |

### 2.5 房间标签

| 任务ID | 任务描述 | SDK API | 文件路径 | 状态 | 优先级 |
|--------|---------|---------|---------|------|--------|
| EM-036 | 创建 RoomTagService | `client.setRoomTag()` | `src/services/matrix/RoomTagService.ts` | 待执行 | P0 |
| EM-037 | 实现标签管理 | - | `src/views/room/components/RoomTags.vue` | 待执行 | P1 |

### 📋 阶段二审查清单

```
□ 运行类型检查: npx vue-tsc --noEmit
□ 运行单元测试: npx vitest run
□ 启用 code-review 技能审查
□ 验证 SDK API 正确使用
□ 修复所有错误和警告
□ 更新任务状态
```

---

## 阶段三：空间功能 (预计 4 天)

### 3.1 空间基础

| 任务ID | 任务描述 | SDK API | 文件路径 | 状态 | 优先级 |
|--------|---------|---------|---------|------|--------|
| EM-038 | 创建 SpaceStore | - | `src/stores/space.ts` | 待执行 | P0 |
| EM-039 | 创建 SpaceService | `client.createRoom({ room_type: 'm.space' })` | `src/services/matrix/SpaceService.ts` | 待执行 | P0 |
| EM-040 | 实现空间面板 | - | `src/views/spaces/SpacePanel.vue` | 待执行 | P0 |
| EM-041 | 实现空间层级导航 | - | `src/views/spaces/SpaceTree.vue` | 待执行 | P0 |

### 3.2 空间管理

| 任务ID | 任务描述 | SDK API | 文件路径 | 状态 | 优先级 |
|--------|---------|---------|---------|------|--------|
| EM-042 | 实现创建空间对话框 | - | `src/views/dialogs/CreateSpaceDialog.vue` | 待执行 | P0 |
| EM-043 | 实现空间设置对话框 | - | `src/views/dialogs/SpaceSettingsDialog.vue` | 待执行 | P0 |
| EM-044 | 实现空间成员管理 | - | `src/views/spaces/SpaceMembers.vue` | 待执行 | P1 |

### 3.3 空间房间管理

| 任务ID | 任务描述 | SDK API | 文件路径 | 状态 | 优先级 |
|--------|---------|---------|---------|------|--------|
| EM-045 | 实现添加房间到空间 | `client.sendStateEvent()` | `src/views/spaces/AddToSpaceDialog.vue` | 待执行 | P0 |
| EM-046 | 实现空间房间列表 | - | `src/views/spaces/SpaceRoomList.vue` | 待执行 | P0 |

### 📋 阶段三审查清单

```
□ 运行类型检查: npx vue-tsc --noEmit
□ 运行单元测试: npx vitest run
□ 启用 code-review 技能审查
□ 验证 SDK API 正确使用
□ 修复所有错误和警告
□ 更新任务状态
```

---

## 阶段四：线程功能 (预计 3 天)

### 4.1 线程基础

| 任务ID | 任务描述 | SDK API | 文件路径 | 状态 | 优先级 |
|--------|---------|---------|---------|------|--------|
| EM-047 | 创建 ThreadStore | - | `src/stores/thread.ts` | 待执行 | P0 |
| EM-048 | 创建 ThreadService | `client.createThread()` | `src/services/matrix/ThreadService.ts` | 待执行 | P0 |
| EM-049 | 实现线程面板 | - | `src/views/thread/ThreadPanel.vue` | 待执行 | P0 |
| EM-050 | 实现线程视图 | - | `src/views/thread/ThreadView.vue` | 待执行 | P0 |

### 4.2 线程交互

| 任务ID | 任务描述 | SDK API | 文件路径 | 状态 | 优先级 |
|--------|---------|---------|---------|------|--------|
| EM-051 | 实现线程消息发送 | - | `src/views/thread/ThreadComposer.vue` | 待执行 | P0 |
| EM-052 | 实现线程通知 | - | `src/views/thread/ThreadNotifications.vue` | 待执行 | P1 |
| EM-053 | 实现线程活动中心 | - | `src/views/thread/ThreadActivityCentre.vue` | 待执行 | P2 |

### 📋 阶段四审查清单

```
□ 运行类型检查: npx vue-tsc --noEmit
□ 运行单元测试: npx vitest run
□ 启用 code-review 技能审查
□ 验证 SDK API 正确使用
□ 修复所有错误和警告
□ 更新任务状态
```

---

## 阶段五：语音视频通话 (预计 5 天)

### 5.1 WebRTC 基础

| 任务ID | 任务描述 | SDK API | 文件路径 | 状态 | 优先级 |
|--------|---------|---------|---------|------|--------|
| EM-054 | 完善 WebRTC Hook | `client.createCall()` | `src/hooks/useWebRtc.ts` | 待执行 | P0 |
| EM-055 | 创建 CallStore | - | `src/stores/call.ts` | 待执行 | P0 |
| EM-056 | 创建 CallService | - | `src/services/matrix/CallService.ts` | 待执行 | P0 |

### 5.2 语音通话

| 任务ID | 任务描述 | SDK API | 文件路径 | 状态 | 优先级 |
|--------|---------|---------|---------|------|--------|
| EM-057 | 实现语音通话视图 | - | `src/views/call/VoiceCallView.vue` | 待执行 | P0 |
| EM-058 | 实现通话控制栏 | - | `src/views/call/CallControls.vue` | 待执行 | P0 |
| EM-059 | 实现通话状态显示 | - | `src/views/call/CallStatus.vue` | 待执行 | P0 |

### 5.3 视频通话

| 任务ID | 任务描述 | SDK API | 文件路径 | 状态 | 优先级 |
|--------|---------|---------|---------|------|--------|
| EM-060 | 实现视频通话视图 | - | `src/views/call/VideoCallView.vue` | 待执行 | P0 |
| EM-061 | 实现视频网格布局 | - | `src/views/call/VideoGrid.vue` | 待执行 | P0 |
| EM-062 | 实现屏幕共享 | - | `src/views/call/ScreenShare.vue` | 待执行 | P1 |

### 5.4 Element Call 集成

| 任务ID | 任务描述 | SDK API | 文件路径 | 状态 | 优先级 |
|--------|---------|---------|---------|------|--------|
| EM-063 | 集成 Element Call Widget | - | `src/views/call/ElementCallWidget.vue` | 待执行 | P1 |
| EM-064 | 实现画中画模式 | - | `src/views/call/PictureInPicture.vue` | 待执行 | P2 |

### 📋 阶段五审查清单

```
□ 运行类型检查: npx vue-tsc --noEmit
□ 运行单元测试: npx vitest run
□ 启用 code-review 技能审查
□ 验证 SDK API 正确使用
□ 修复所有错误和警告
□ 更新任务状态
```

---

## 阶段六：端到端加密 (预计 4 天)

### 6.1 加密基础

| 任务ID | 任务描述 | SDK API | 文件路径 | 状态 | 优先级 |
|--------|---------|---------|---------|------|--------|
| EM-065 | 完善 EncryptionService | `client.crypto` | `src/services/matrix/EncryptionService.ts` | 待执行 | P0 |
| EM-066 | 实现加密状态指示 | - | `src/components/encryption/EncryptionStatus.vue` | 待执行 | P0 |
| EM-067 | 实现加密房间设置 | - | `src/views/room/settings/EncryptionSettings.vue` | 待执行 | P0 |

### 6.2 设备验证

| 任务ID | 任务描述 | SDK API | 文件路径 | 状态 | 优先级 |
|--------|---------|---------|---------|------|--------|
| EM-068 | 实现设备验证流程 | `client.crypto.verifyDevice()` | `src/views/encryption/DeviceVerification.vue` | 待执行 | P0 |
| EM-069 | 实现验证对话框 | - | `src/views/dialogs/VerificationDialog.vue` | 待执行 | P0 |
| EM-070 | 实现交叉签名设置 | `client.crypto.crossSigning` | `src/views/encryption/CrossSigningSetup.vue` | 待执行 | P1 |

### 6.3 密钥备份

| 任务ID | 任务描述 | SDK API | 文件路径 | 状态 | 优先级 |
|--------|---------|---------|---------|------|--------|
| EM-071 | 实现密钥备份创建 | `client.crypto.backup` | `src/views/encryption/BackupCreate.vue` | 待执行 | P0 |
| EM-072 | 实现密钥恢复流程 | - | `src/views/encryption/BackupRestore.vue` | 待执行 | P0 |
| EM-073 | 实现安全密钥导出 | - | `src/views/encryption/KeyExport.vue` | 待执行 | P1 |

### 📋 阶段六审查清单

```
□ 运行类型检查: npx vue-tsc --noEmit
□ 运行单元测试: npx vitest run
□ 启用 code-review 技能审查
□ 验证加密功能安全性
□ 修复所有错误和警告
□ 更新任务状态
```

---

## 阶段七：搜索功能 (预计 3 天)

### 7.1 全局搜索

| 任务ID | 任务描述 | SDK API | 文件路径 | 状态 | 优先级 |
|--------|---------|---------|---------|------|--------|
| EM-074 | 创建 SpotlightStore | - | `src/stores/spotlight.ts` | 待执行 | P0 |
| EM-075 | 实现全局搜索对话框 | - | `src/views/dialogs/SpotlightDialog.vue` | 待执行 | P0 |
| EM-076 | 实现搜索结果分类 | - | `src/views/search/SearchResults.vue` | 待执行 | P0 |

### 7.2 房间目录

| 任务ID | 任务描述 | SDK API | 文件路径 | 状态 | 优先级 |
|--------|---------|---------|---------|------|--------|
| EM-077 | 实现房间目录浏览 | `client.publicRooms()` | `src/views/search/RoomDirectory.vue` | 待执行 | P0 |
| EM-078 | 实现房间预览 | - | `src/views/search/RoomPreview.vue` | 待执行 | P1 |

### 📋 阶段七审查清单

```
□ 运行类型检查: npx vue-tsc --noEmit
□ 运行单元测试: npx vitest run
□ 启用 code-review 技能审查
□ 验证 SDK API 正确使用
□ 修复所有错误和警告
□ 更新任务状态
```

---

## 阶段八：通知系统增强 (预计 2 天)

### 8.1 桌面通知

| 任务ID | 任务描述 | SDK API | 文件路径 | 状态 | 优先级 |
|--------|---------|---------|---------|------|--------|
| EM-079 | 完善 NotificationService | `client.setPusher()` | `src/services/matrix/NotificationService.ts` | 待执行 | P0 |
| EM-080 | 实现 Tauri 原生通知 | Tauri API | `src/utils/notifications.ts` | 待执行 | P0 |
| EM-081 | 实现通知权限管理 | - | `src/views/settings/NotificationPermission.vue` | 待执行 | P0 |

### 8.2 推送规则

| 任务ID | 任务描述 | SDK API | 文件路径 | 状态 | 优先级 |
|--------|---------|---------|---------|------|--------|
| EM-082 | 实现推送规则管理 | `client.getPushRules()` | `src/views/settings/PushRulesSettings.vue` | 待执行 | P1 |

### 📋 阶段八审查清单

```
□ 运行类型检查: npx vue-tsc --noEmit
□ 运行单元测试: npx vitest run
□ 启用 code-review 技能审查
□ 验证 SDK API 正确使用
□ 修复所有错误和警告
□ 更新任务状态
```

---

## 阶段九：增强功能 (预计 5 天)

### 9.1 位置分享

| 任务ID | 任务描述 | SDK API | 文件路径 | 状态 | 优先级 |
|--------|---------|---------|---------|------|--------|
| EM-083 | 创建 LocationService | - | `src/services/matrix/LocationService.ts` | 待执行 | P0 |
| EM-084 | 实现位置选择器 | - | `src/views/location/LocationPicker.vue` | 待执行 | P0 |
| EM-085 | 实现位置消息显示 | - | `src/views/message/components/LocationMessage.vue` | 待执行 | P0 |
| EM-086 | 实现实时位置分享 | `client.unstable_` | `src/views/location/LiveLocationShare.vue` | 待执行 | P1 |

### 9.2 投票功能

| 任务ID | 任务描述 | SDK API | 文件路径 | 状态 | 优先级 |
|--------|---------|---------|---------|------|--------|
| EM-087 | 创建 PollService | `client.sendEvent()` | `src/services/matrix/PollService.ts` | 待执行 | P0 |
| EM-088 | 实现创建投票对话框 | - | `src/views/dialogs/CreatePollDialog.vue` | 待执行 | P0 |
| EM-089 | 实现投票消息显示 | - | `src/views/message/components/PollMessage.vue` | 待执行 | P0 |
| EM-090 | 实现投票历史 | - | `src/views/poll/PollHistory.vue` | 待执行 | P1 |

### 9.3 Widget 支持

| 任务ID | 任务描述 | SDK API | 文件路径 | 状态 | 优先级 |
|--------|---------|---------|---------|------|--------|
| EM-091 | 创建 WidgetStore | - | `src/stores/widget.ts` | 待执行 | P0 |
| EM-092 | 实现 Widget 容器 | - | `src/views/widget/WidgetContainer.vue` | 待执行 | P0 |
| EM-093 | 实现 Widget 权限管理 | - | `src/views/widget/WidgetPermissions.vue` | 待执行 | P0 |

### 9.4 视觉效果

| 任务ID | 任务描述 | SDK API | 文件路径 | 状态 | 优先级 |
|--------|---------|---------|---------|------|--------|
| EM-094 | 实现彩带效果 | - | `src/effects/ConfettiEffect.vue` | 待执行 | P2 |
| EM-095 | 实现烟花效果 | - | `src/effects/FireworksEffect.vue` | 待执行 | P2 |
| EM-096 | 实现雪花效果 | - | `src/effects/SnowfallEffect.vue` | 待执行 | P2 |

### 9.5 斜杠命令

| 任务ID | 任务描述 | SDK API | 文件路径 | 状态 | 优先级 |
|--------|---------|---------|---------|------|--------|
| EM-097 | 创建命令解析器 | - | `src/utils/commands/CommandParser.ts` | 待执行 | P0 |
| EM-098 | 实现命令自动补全 | - | `src/components/composer/CommandAutocomplete.vue` | 待执行 | P0 |
| EM-099 | 实现内置命令 | - | `src/utils/commands/BuiltInCommands.ts` | 待执行 | P0 |

### 📋 阶段九审查清单

```
□ 运行类型检查: npx vue-tsc --noEmit
□ 运行单元测试: npx vitest run
□ 启用 code-review 技能审查
□ 验证 SDK API 正确使用
□ 修复所有错误和警告
□ 更新任务状态
```

---

## 任务依赖关系

```
阶段一 (消息增强)
    ↓ [审查通过]
阶段二 (房间管理)
    ↓ [审查通过]
阶段三 (空间功能)
    ↓ [审查通过]
阶段四 (线程功能)
    ↓ [审查通过]
阶段五 (语音视频)
    ↓ [审查通过]
阶段六 (E2EE加密)
    ↓ [审查通过]
阶段七 (搜索功能)
    ↓ [审查通过]
阶段八 (通知增强)
    ↓ [审查通过]
阶段九 (增强功能)
    ↓ [最终审查]
交付
```

---

## 风险任务

| 任务ID | 风险描述 | 应对措施 |
|--------|---------|---------|
| EM-054~064 | WebRTC 兼容性问题 | 使用 Element Call Widget 替代原生实现 |
| EM-065~073 | 加密功能安全性 | 严格使用 SDK API，禁止自行实现 |
| EM-086 | 实时位置分享依赖 MSC | 检查 SDK 版本支持 |

---

## 里程碑

| 里程碑 | 预计完成时间 | 交付物 | 审查要求 |
|--------|-------------|--------|----------|
| M1 - 消息功能完善 | 阶段一完成 | 消息编辑/回复/反应可用 | 类型检查 + 测试 + 代码审查 |
| M2 - 房间管理完善 | 阶段二完成 | 房间创建/邀请/权限可用 | 类型检查 + 测试 + 代码审查 |
| M3 - 空间功能可用 | 阶段三完成 | 空间创建/导航可用 | 类型检查 + 测试 + 代码审查 |
| M4 - 线程功能可用 | 阶段四完成 | 线程讨论可用 | 类型检查 + 测试 + 代码审查 |
| M5 - 通话功能可用 | 阶段五完成 | 语音视频通话可用 | 类型检查 + 测试 + 代码审查 |
| M6 - 加密功能完善 | 阶段六完成 | 设备验证/密钥备份可用 | 类型检查 + 测试 + 代码审查 |
| M7 - 搜索功能可用 | 阶段七完成 | 全局搜索可用 | 类型检查 + 测试 + 代码审查 |
| M8 - 通知系统完善 | 阶段八完成 | 桌面通知可用 | 类型检查 + 测试 + 代码审查 |
| M9 - 增强功能完成 | 阶段九完成 | 位置/投票/Widget可用 | 最终审查 |

---

## SDK API 使用规范

### ✅ 必须使用 SDK 的功能

| 功能 | SDK API | 禁止操作 |
|------|---------|----------|
| 消息发送 | `client.sendEvent()` | ❌ 自定义 HTTP 请求 |
| 消息编辑 | `client.editMessage()` | ❌ 自定义编辑逻辑 |
| 消息删除 | `client.redactEvent()` | ❌ 自定义删除逻辑 |
| 反应 | `client.sendEvent('m.reaction')` | ❌ 自定义反应协议 |
| 房间创建 | `client.createRoom()` | ❌ 自定义房间协议 |
| 邀请 | `client.invite()` | ❌ 自定义邀请逻辑 |
| 权限管理 | `client.setPowerLevel()` | ❌ 自定义权限逻辑 |
| 加密 | `client.crypto` | ❌ 自定义加密算法 |
| 通话 | `client.createCall()` | ❌ 自定义通话协议 |
| 搜索 | `client.search()` | ❌ 自定义搜索逻辑 |

### ⚠️ 可自定义实现的功能

| 功能 | 实现方式 | 说明 |
|------|---------|------|
| UI 组件 | Vue 组件 | 纯 UI 层 |
| 状态管理 | Pinia Store | UI 状态 |
| 视觉效果 | CSS/Canvas | UI 特效 |
| 快捷键 | 本地事件监听 | 桌面端特有 |

---

## 任务统计

| 指标 | 数值 |
|------|------|
| 总任务数 | 99 |
| 阶段数 | 9 |
| 预计总工时 | 31 天 |
