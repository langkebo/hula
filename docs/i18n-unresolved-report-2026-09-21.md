# i18n 未解决键逐项核对报告

**生成时间**: 2026-09-21 11:31  
**数据来源**: `node scripts/check-i18n-refs.mjs --list`  
**总计**: 280 个未解决键 (273 unresolved + 7 fallback), 20 个命名空间

---

## 一、总览表

| # | 命名空间 | 键数 | 语言文件状态 | 问题类型 | 解决方案 |
|---|----------|------|-------------|----------|----------|
| room | 65 | ⚠ 键缺失 | **B 类** | 补 JSON 键 |
| room | 65 | ⚠ 键缺失 | **B 类** | 补 JSON 键 |
| moderation | 43 | ⚠ 键缺失 | **B 类** | 补 JSON 键 |
| moderation | 43 | ⚠ 键缺失 | **B 类** | 补 JSON 键 |
| message | 29 | ⚠ 键缺失 | **B 类** | 补 JSON 键 |
| message | 29 | ⚠ 键缺失 | **B 类** | 补 JSON 键 |
| home | 26 | ⚠ 键缺失 | **B 类** | 补 JSON 键 |
| home | 26 | ⚠ 键缺失 | **B 类** | 补 JSON 键 |
| emoticon | 23 | ⚠ 键缺失 | **B 类** | 补 JSON 键 |
| emoticon | 23 | ⚠ 键缺失 | **B 类** | 补 JSON 键 |
| setting | 23 | ⚠ 键缺失 | **B 类** | 补 JSON 键 |
| setting | 23 | ⚠ 键缺失 | **B 类** | 补 JSON 键 |
| space | 23 | ⚠ 键缺失 | **B 类** | 补 JSON 键 |
| space | 23 | ⚠ 键缺失 | **B 类** | 补 JSON 键 |
| message_container | 8 | ⚠ 键缺失 | **B 类** | 补 JSON 键 |
| message_container | 8 | ⚠ 键缺失 | **B 类** | 补 JSON 键 |
| call | 7 | ✗ 文件缺失 | **A 类** | 新建 JSON 文件 |
| common | 6 | ⚠ 键缺失 | **B 类** | 补 JSON 键 |
| common | 6 | ⚠ 键缺失 | **B 类** | 补 JSON 键 |
| push | 6 | ✗ 文件缺失 | **A 类** | 新建 JSON 文件 |
| voip | 5 | ⚠ 键缺失 | **B 类** | 补 JSON 键 |
| voip | 5 | ⚠ 键缺失 | **B 类** | 补 JSON 键 |
| chat | 3 | ⚠ 键缺失 | **B 类** | 补 JSON 键 |
| chat | 3 | ⚠ 键缺失 | **B 类** | 补 JSON 键 |
| matrix_error | 3 | ⚠ 键缺失 | **B 类** | 补 JSON 键 |
| matrix_error | 3 | ⚠ 键缺失 | **B 类** | 补 JSON 键 |
| private_mode | 3 | ✗ 文件缺失 | **A 类** | 新建 JSON 文件 |
| e2ee | 2 | ✗ 文件缺失 | **A 类** | 新建 JSON 文件 |
| friend | 2 | ⚠ 键缺失 | **B 类** | 补 JSON 键 |
| friend | 2 | ⚠ 键缺失 | **B 类** | 补 JSON 键 |
| diagnostics | 1 | ⚠ 键缺失 | **B 类** | 补 JSON 键 |
| diagnostics | 1 | ⚠ 键缺失 | **B 类** | 补 JSON 键 |
| login | 1 | ⚠ 键缺失 | **B 类** | 补 JSON 键 |
| login | 1 | ⚠ 键缺失 | **B 类** | 补 JSON 键 |
| mobile_edit_profile | 1 | ⚠ 键缺失 | **B 类** | 补 JSON 键 |
| mobile_edit_profile | 1 | ⚠ 键缺失 | **B 类** | 补 JSON 键 |

## 二、A 类：物理文件缺失（需新建 JSON 文件）

**4 个命名空间 × 2 语言 = 8 个 JSON 文件需要创建**

### `call` — 需创建 `locales/zh-CN/call.json` 和 `locales/en/call.json`
**涉及源文件**: src/components/call/CallView.vue
**需添加键数**: 7

**键清单**:
- `call.connected` → `src/components/call/CallView.vue`
- `call.connecting` → `src/components/call/CallView.vue`
- `call.ended` → `src/components/call/CallView.vue`
- `call.error` → `src/components/call/CallView.vue`
- `call.ringing` → `src/components/call/CallView.vue`
- `call.video_call` → `src/components/call/CallView.vue`
- `call.voice_call` → `src/components/call/CallView.vue`

**解决方案**: 新建 `locales/zh-CN/{ns}.json` 和 `locales/en/{ns}.json`，
填入全部 7 个键值对。

### `push` — 需创建 `locales/zh-CN/push.json` 和 `locales/en/push.json`
**涉及源文件**: src/mobile/components/PushNotificationList.vue
**需添加键数**: 6

**键清单**:
- `push.clear_all` → `src/mobile/components/PushNotificationList.vue`
- `push.hours_ago` → `src/mobile/components/PushNotificationList.vue`
- `push.just_now` → `src/mobile/components/PushNotificationList.vue`
- `push.minutes_ago` → `src/mobile/components/PushNotificationList.vue`
- `push.no_notifications` → `src/mobile/components/PushNotificationList.vue`
- `push.notification_count` → `src/mobile/components/PushNotificationList.vue`

**解决方案**: 新建 `locales/zh-CN/{ns}.json` 和 `locales/en/{ns}.json`，
填入全部 6 个键值对。

### `private_mode` — 需创建 `locales/zh-CN/private_mode.json` 和 `locales/en/private_mode.json`
**涉及源文件**: src/mobile/components/chat-room/PrivateModeConfirmDialog.vue
**需添加键数**: 3

**键清单**:
- `private_mode.cancel` → `src/mobile/components/chat-room/PrivateModeConfirmDialog.vue`
- `private_mode.confirm` → `src/mobile/components/chat-room/PrivateModeConfirmDialog.vue`
- `private_mode.confirm_title` → `src/mobile/components/chat-room/PrivateModeConfirmDialog.vue`

**解决方案**: 新建 `locales/zh-CN/{ns}.json` 和 `locales/en/{ns}.json`，
填入全部 3 个键值对。

### `e2ee` — 需创建 `locales/zh-CN/e2ee.json` 和 `locales/en/e2ee.json`
**涉及源文件**: src/components/chat/E2EEBanner.vue
**需添加键数**: 2

**键清单**:
- `e2ee.banner.desc` → `src/components/chat/E2EEBanner.vue`
- `e2ee.banner.title` → `src/components/chat/E2EEBanner.vue`

**解决方案**: 新建 `locales/zh-CN/{ns}.json` 和 `locales/en/{ns}.json`，
填入全部 2 个键值对。

## 三、B 类：语言包存在但键缺失（需补充 JSON 键）

### `room/zh-CN/room.json` — 缺 65/65 个键
**已有 12 个键**

**缺失键**:
- `room.capabilities.capabilities_section` → `src/components/room/RoomCapabilitiesPanel.vue`
- `room.capabilities.disabled` → `src/components/room/RoomCapabilitiesPanel.vue`
- `room.capabilities.empty` → `src/components/room/RoomCapabilitiesPanel.vue`
- `room.capabilities.enabled` → `src/components/room/RoomCapabilitiesPanel.vue`
- `room.capabilities.features_section` → `src/components/room/RoomCapabilitiesPanel.vue`
- `room.capabilities.join_rule` → `src/components/room/RoomCapabilitiesPanel.vue`
- `room.capabilities.permissions_section` → `src/components/room/RoomCapabilitiesPanel.vue`
- `room.capabilities.room_version` → `src/components/room/RoomCapabilitiesPanel.vue`
- `room.capabilities.subtitle` → `src/components/room/RoomCapabilitiesPanel.vue`
- `room.capabilities.title` → `src/components/room/RoomCapabilitiesPanel.vue`
- `room.create.cancel` → `src/components/room/CreateRoomPane.vue`
- `room.discovery.local` → `src/components/atomic/FederationBadge.vue`
- `room.encrypted_events.algorithm` → `src/components/room/RoomEncryptedEventsPanel.vue`
- `room.encrypted_events.empty` → `src/components/room/RoomEncryptedEventsPanel.vue`
- `room.encrypted_events.event_id` → `src/components/room/RoomEncryptedEventsPanel.vue`
- `room.encrypted_events.sender` → `src/components/room/RoomEncryptedEventsPanel.vue`
- `room.encrypted_events.session_id` → `src/components/room/RoomEncryptedEventsPanel.vue`
- `room.encrypted_events.subtitle` → `src/components/room/RoomEncryptedEventsPanel.vue`
- `room.encrypted_events.title` → `src/components/room/RoomEncryptedEventsPanel.vue`
- `room.event_signature.event_id_placeholder` → `src/components/room/EventSignaturePanel.vue`
- `room.event_signature.invalid` → `src/components/room/EventSignaturePanel.vue`
- `room.event_signature.sign` → `src/components/room/EventSignaturePanel.vue`
- `room.event_signature.sign_failed` → `src/components/room/EventSignaturePanel.vue`
- `room.event_signature.sign_result` → `src/components/room/EventSignaturePanel.vue`
- `room.event_signature.sign_success` → `src/components/room/EventSignaturePanel.vue`
- `room.event_signature.subtitle` → `src/components/room/EventSignaturePanel.vue`
- `room.event_signature.title` → `src/components/room/EventSignaturePanel.vue`
- `room.event_signature.valid` → `src/components/room/EventSignaturePanel.vue`
- `room.event_signature.verify` → `src/components/room/EventSignaturePanel.vue`
- `room.event_signature.verify_failed` → `src/components/room/EventSignaturePanel.vue`
- `room.event_signature.verify_result` → `src/components/room/EventSignaturePanel.vue`
- `room.event_signature.verify_success` → `src/components/room/EventSignaturePanel.vue`
- `room.invite.accept` → `src/components/room/RoomInviteActions.vue`
- `room.invite.failed` → `src/components/room/InviteDialog.vue`
- `room.invite.invalid_user_id` → `src/components/room/InviteDialog.vue`
- `room.invite.invite` → `src/components/room/InviteDialog.vue`
- `room.invite.or_enter_id` → `src/components/room/InviteDialog.vue`
- `room.invite.reject` → `src/components/room/RoomInviteActions.vue`
- `room.invite.search_placeholder` → `src/components/room/InviteDialog.vue`
- `room.invite.success` → `src/components/room/InviteDialog.vue`
- `room.invite.title` → `src/components/room/InviteDialog.vue`
- `room.invite.user_id_placeholder` → `src/components/room/InviteDialog.vue`
- `room.message_queue.content` → `src/components/room/RoomMessageQueuePanel.vue`
- `room.message_queue.empty` → `src/components/room/RoomMessageQueuePanel.vue`
- `room.message_queue.event_id` → `src/components/room/RoomMessageQueuePanel.vue`
- `room.message_queue.subtitle` → `src/components/room/RoomMessageQueuePanel.vue`
- `room.message_queue.title` → `src/components/room/RoomMessageQueuePanel.vue`
- `room.message_queue.type` → `src/components/room/RoomMessageQueuePanel.vue`
- `room.metadata.empty` → `src/components/room/RoomMetadataPanel.vue`
- `room.metadata.subtitle` → `src/components/room/RoomMetadataPanel.vue`
- `room.metadata.title` → `src/components/room/RoomMetadataPanel.vue`
- `room.retention.count_hint` → `src/components/room/RoomRetentionPanel.vue`
- `room.retention.count_label` → `src/components/room/RoomRetentionPanel.vue`
- `room.retention.days_hint` → `src/components/room/RoomRetentionPanel.vue`
- `room.retention.days_label` → `src/components/room/RoomRetentionPanel.vue`
- `room.retention.load_failed` → `src/components/room/RoomRetentionPanel.vue`
- `room.retention.mode_by_count` → `src/components/room/RoomRetentionPanel.vue`
- `room.retention.mode_by_days` → `src/components/room/RoomRetentionPanel.vue`
- `room.retention.mode_unlimited` → `src/components/room/RoomRetentionPanel.vue`
- `room.retention.read_only_hint` → `src/components/room/RoomRetentionPanel.vue`
- `room.retention.save` → `src/components/room/RoomRetentionPanel.vue`
- `room.retention.save_failed` → `src/components/room/RoomRetentionPanel.vue`
- `room.retention.save_success` → `src/components/room/RoomRetentionPanel.vue`
- `room.retention.subtitle` → `src/components/room/RoomRetentionPanel.vue`
- `room.retention.title` → `src/components/room/RoomRetentionPanel.vue`

### `room/en/room.json` — 缺 65/65 个键
**已有 12 个键**

**缺失键**:
- `room.capabilities.capabilities_section` → `src/components/room/RoomCapabilitiesPanel.vue`
- `room.capabilities.disabled` → `src/components/room/RoomCapabilitiesPanel.vue`
- `room.capabilities.empty` → `src/components/room/RoomCapabilitiesPanel.vue`
- `room.capabilities.enabled` → `src/components/room/RoomCapabilitiesPanel.vue`
- `room.capabilities.features_section` → `src/components/room/RoomCapabilitiesPanel.vue`
- `room.capabilities.join_rule` → `src/components/room/RoomCapabilitiesPanel.vue`
- `room.capabilities.permissions_section` → `src/components/room/RoomCapabilitiesPanel.vue`
- `room.capabilities.room_version` → `src/components/room/RoomCapabilitiesPanel.vue`
- `room.capabilities.subtitle` → `src/components/room/RoomCapabilitiesPanel.vue`
- `room.capabilities.title` → `src/components/room/RoomCapabilitiesPanel.vue`
- `room.create.cancel` → `src/components/room/CreateRoomPane.vue`
- `room.discovery.local` → `src/components/atomic/FederationBadge.vue`
- `room.encrypted_events.algorithm` → `src/components/room/RoomEncryptedEventsPanel.vue`
- `room.encrypted_events.empty` → `src/components/room/RoomEncryptedEventsPanel.vue`
- `room.encrypted_events.event_id` → `src/components/room/RoomEncryptedEventsPanel.vue`
- `room.encrypted_events.sender` → `src/components/room/RoomEncryptedEventsPanel.vue`
- `room.encrypted_events.session_id` → `src/components/room/RoomEncryptedEventsPanel.vue`
- `room.encrypted_events.subtitle` → `src/components/room/RoomEncryptedEventsPanel.vue`
- `room.encrypted_events.title` → `src/components/room/RoomEncryptedEventsPanel.vue`
- `room.event_signature.event_id_placeholder` → `src/components/room/EventSignaturePanel.vue`
- `room.event_signature.invalid` → `src/components/room/EventSignaturePanel.vue`
- `room.event_signature.sign` → `src/components/room/EventSignaturePanel.vue`
- `room.event_signature.sign_failed` → `src/components/room/EventSignaturePanel.vue`
- `room.event_signature.sign_result` → `src/components/room/EventSignaturePanel.vue`
- `room.event_signature.sign_success` → `src/components/room/EventSignaturePanel.vue`
- `room.event_signature.subtitle` → `src/components/room/EventSignaturePanel.vue`
- `room.event_signature.title` → `src/components/room/EventSignaturePanel.vue`
- `room.event_signature.valid` → `src/components/room/EventSignaturePanel.vue`
- `room.event_signature.verify` → `src/components/room/EventSignaturePanel.vue`
- `room.event_signature.verify_failed` → `src/components/room/EventSignaturePanel.vue`
- `room.event_signature.verify_result` → `src/components/room/EventSignaturePanel.vue`
- `room.event_signature.verify_success` → `src/components/room/EventSignaturePanel.vue`
- `room.invite.accept` → `src/components/room/RoomInviteActions.vue`
- `room.invite.failed` → `src/components/room/InviteDialog.vue`
- `room.invite.invalid_user_id` → `src/components/room/InviteDialog.vue`
- `room.invite.invite` → `src/components/room/InviteDialog.vue`
- `room.invite.or_enter_id` → `src/components/room/InviteDialog.vue`
- `room.invite.reject` → `src/components/room/RoomInviteActions.vue`
- `room.invite.search_placeholder` → `src/components/room/InviteDialog.vue`
- `room.invite.success` → `src/components/room/InviteDialog.vue`
- `room.invite.title` → `src/components/room/InviteDialog.vue`
- `room.invite.user_id_placeholder` → `src/components/room/InviteDialog.vue`
- `room.message_queue.content` → `src/components/room/RoomMessageQueuePanel.vue`
- `room.message_queue.empty` → `src/components/room/RoomMessageQueuePanel.vue`
- `room.message_queue.event_id` → `src/components/room/RoomMessageQueuePanel.vue`
- `room.message_queue.subtitle` → `src/components/room/RoomMessageQueuePanel.vue`
- `room.message_queue.title` → `src/components/room/RoomMessageQueuePanel.vue`
- `room.message_queue.type` → `src/components/room/RoomMessageQueuePanel.vue`
- `room.metadata.empty` → `src/components/room/RoomMetadataPanel.vue`
- `room.metadata.subtitle` → `src/components/room/RoomMetadataPanel.vue`
- `room.metadata.title` → `src/components/room/RoomMetadataPanel.vue`
- `room.retention.count_hint` → `src/components/room/RoomRetentionPanel.vue`
- `room.retention.count_label` → `src/components/room/RoomRetentionPanel.vue`
- `room.retention.days_hint` → `src/components/room/RoomRetentionPanel.vue`
- `room.retention.days_label` → `src/components/room/RoomRetentionPanel.vue`
- `room.retention.load_failed` → `src/components/room/RoomRetentionPanel.vue`
- `room.retention.mode_by_count` → `src/components/room/RoomRetentionPanel.vue`
- `room.retention.mode_by_days` → `src/components/room/RoomRetentionPanel.vue`
- `room.retention.mode_unlimited` → `src/components/room/RoomRetentionPanel.vue`
- `room.retention.read_only_hint` → `src/components/room/RoomRetentionPanel.vue`
- `room.retention.save` → `src/components/room/RoomRetentionPanel.vue`
- `room.retention.save_failed` → `src/components/room/RoomRetentionPanel.vue`
- `room.retention.save_success` → `src/components/room/RoomRetentionPanel.vue`
- `room.retention.subtitle` → `src/components/room/RoomRetentionPanel.vue`
- `room.retention.title` → `src/components/room/RoomRetentionPanel.vue`

### `moderation/zh-CN/moderation.json` — 缺 43/43 个键
**已有 16 个键**

**缺失键**:
- `moderation.event_reports.actions.delete` → `src/views/admin/ModerationPanel.vue`
- `moderation.event_reports.actions.dismiss` → `src/views/admin/ModerationPanel.vue`
- `moderation.event_reports.actions.escalate` → `src/views/admin/ModerationPanel.vue`
- `moderation.event_reports.actions.history` → `src/views/admin/ModerationPanel.vue`
- `moderation.event_reports.actions.resolve` → `src/views/admin/ModerationPanel.vue`
- `moderation.event_reports.dialog.deleteConfirm` → `src/views/admin/ModerationPanel.vue`
- `moderation.event_reports.dialog.dismissTitle` → `src/views/admin/ModerationPanel.vue`
- `moderation.event_reports.dialog.reasonPlaceholder` → `src/views/admin/ModerationPanel.vue`
- `moderation.event_reports.dialog.reasonRequired` → `src/views/admin/ModerationPanel.vue`
- `moderation.event_reports.dialog.resolveTitle` → `src/views/admin/ModerationPanel.vue`
- `moderation.event_reports.history.title` → `src/views/admin/ModerationPanel.vue`
- `moderation.event_reports.loadFailed` → `src/views/admin/ModerationPanel.vue`
- `moderation.event_reports.stats.dismissed` → `src/views/admin/ModerationPanel.vue`
- `moderation.event_reports.stats.open` → `src/views/admin/ModerationPanel.vue`
- `moderation.event_reports.stats.resolved` → `src/views/admin/ModerationPanel.vue`
- `moderation.event_reports.stats.total` → `src/views/admin/ModerationPanel.vue`
- `moderation.event_reports.table.actions` → `src/views/admin/ModerationPanel.vue`
- `moderation.event_reports.table.event_id` → `src/views/admin/ModerationPanel.vue`
- `moderation.event_reports.table.reason` → `src/views/admin/ModerationPanel.vue`
- `moderation.event_reports.table.reported_user` → `src/views/admin/ModerationPanel.vue`
- `moderation.event_reports.table.reporter` → `src/views/admin/ModerationPanel.vue`
- `moderation.event_reports.table.status` → `src/views/admin/ModerationPanel.vue`
- `moderation.event_reports.title` → `src/views/admin/ModerationPanel.vue`
- `moderation.event_reports.toast.deleteFailed` → `src/views/admin/ModerationPanel.vue`
- `moderation.event_reports.toast.deleteSuccess` → `src/views/admin/ModerationPanel.vue`
- `moderation.event_reports.toast.dismissSuccess` → `src/views/admin/ModerationPanel.vue`
- `moderation.event_reports.toast.escalateFailed` → `src/views/admin/ModerationPanel.vue`
- `moderation.event_reports.toast.escalateSuccess` → `src/views/admin/ModerationPanel.vue`
- `moderation.event_reports.toast.resolveSuccess` → `src/views/admin/ModerationPanel.vue`
- `moderation.report_user.comment` → `src/components/moderation/UserReportDialog.vue`
- `moderation.report_user.comment_placeholder` → `src/components/moderation/UserReportDialog.vue`
- `moderation.report_user.failed` → `src/components/moderation/UserReportDialog.vue`
- `moderation.report_user.reason` → `src/components/moderation/UserReportDialog.vue`
- `moderation.report_user.reason_abuse` → `src/components/moderation/UserReportDialog.vue`
- `moderation.report_user.reason_inappropriate` → `src/components/moderation/UserReportDialog.vue`
- `moderation.report_user.reason_other` → `src/components/moderation/UserReportDialog.vue`
- `moderation.report_user.reason_placeholder` → `src/components/moderation/UserReportDialog.vue`
- `moderation.report_user.reason_required` → `src/components/moderation/UserReportDialog.vue`
- `moderation.report_user.reason_spam` → `src/components/moderation/UserReportDialog.vue`
- `moderation.report_user.submit` → `src/components/moderation/UserReportDialog.vue`
- `moderation.report_user.success` → `src/components/moderation/UserReportDialog.vue`
- `moderation.report_user.title` → `src/components/moderation/UserReportDialog.vue`
- `moderation.report_user.user_preview` → `src/components/moderation/UserReportDialog.vue`

### `moderation/en/moderation.json` — 缺 43/43 个键
**已有 16 个键**

**缺失键**:
- `moderation.event_reports.actions.delete` → `src/views/admin/ModerationPanel.vue`
- `moderation.event_reports.actions.dismiss` → `src/views/admin/ModerationPanel.vue`
- `moderation.event_reports.actions.escalate` → `src/views/admin/ModerationPanel.vue`
- `moderation.event_reports.actions.history` → `src/views/admin/ModerationPanel.vue`
- `moderation.event_reports.actions.resolve` → `src/views/admin/ModerationPanel.vue`
- `moderation.event_reports.dialog.deleteConfirm` → `src/views/admin/ModerationPanel.vue`
- `moderation.event_reports.dialog.dismissTitle` → `src/views/admin/ModerationPanel.vue`
- `moderation.event_reports.dialog.reasonPlaceholder` → `src/views/admin/ModerationPanel.vue`
- `moderation.event_reports.dialog.reasonRequired` → `src/views/admin/ModerationPanel.vue`
- `moderation.event_reports.dialog.resolveTitle` → `src/views/admin/ModerationPanel.vue`
- `moderation.event_reports.history.title` → `src/views/admin/ModerationPanel.vue`
- `moderation.event_reports.loadFailed` → `src/views/admin/ModerationPanel.vue`
- `moderation.event_reports.stats.dismissed` → `src/views/admin/ModerationPanel.vue`
- `moderation.event_reports.stats.open` → `src/views/admin/ModerationPanel.vue`
- `moderation.event_reports.stats.resolved` → `src/views/admin/ModerationPanel.vue`
- `moderation.event_reports.stats.total` → `src/views/admin/ModerationPanel.vue`
- `moderation.event_reports.table.actions` → `src/views/admin/ModerationPanel.vue`
- `moderation.event_reports.table.event_id` → `src/views/admin/ModerationPanel.vue`
- `moderation.event_reports.table.reason` → `src/views/admin/ModerationPanel.vue`
- `moderation.event_reports.table.reported_user` → `src/views/admin/ModerationPanel.vue`
- `moderation.event_reports.table.reporter` → `src/views/admin/ModerationPanel.vue`
- `moderation.event_reports.table.status` → `src/views/admin/ModerationPanel.vue`
- `moderation.event_reports.title` → `src/views/admin/ModerationPanel.vue`
- `moderation.event_reports.toast.deleteFailed` → `src/views/admin/ModerationPanel.vue`
- `moderation.event_reports.toast.deleteSuccess` → `src/views/admin/ModerationPanel.vue`
- `moderation.event_reports.toast.dismissSuccess` → `src/views/admin/ModerationPanel.vue`
- `moderation.event_reports.toast.escalateFailed` → `src/views/admin/ModerationPanel.vue`
- `moderation.event_reports.toast.escalateSuccess` → `src/views/admin/ModerationPanel.vue`
- `moderation.event_reports.toast.resolveSuccess` → `src/views/admin/ModerationPanel.vue`
- `moderation.report_user.comment` → `src/components/moderation/UserReportDialog.vue`
- `moderation.report_user.comment_placeholder` → `src/components/moderation/UserReportDialog.vue`
- `moderation.report_user.failed` → `src/components/moderation/UserReportDialog.vue`
- `moderation.report_user.reason` → `src/components/moderation/UserReportDialog.vue`
- `moderation.report_user.reason_abuse` → `src/components/moderation/UserReportDialog.vue`
- `moderation.report_user.reason_inappropriate` → `src/components/moderation/UserReportDialog.vue`
- `moderation.report_user.reason_other` → `src/components/moderation/UserReportDialog.vue`
- `moderation.report_user.reason_placeholder` → `src/components/moderation/UserReportDialog.vue`
- `moderation.report_user.reason_required` → `src/components/moderation/UserReportDialog.vue`
- `moderation.report_user.reason_spam` → `src/components/moderation/UserReportDialog.vue`
- `moderation.report_user.submit` → `src/components/moderation/UserReportDialog.vue`
- `moderation.report_user.success` → `src/components/moderation/UserReportDialog.vue`
- `moderation.report_user.title` → `src/components/moderation/UserReportDialog.vue`
- `moderation.report_user.user_preview` → `src/components/moderation/UserReportDialog.vue`

### `message/zh-CN/message.json` — 缺 29/29 个键
**已有 24 个键**

**缺失键**:
- `message.copy_empty` → `src/components/rightBox/renderMessage/useMessageActionHandlers.ts`
- `message.copy_failed` → `src/components/rightBox/renderMessage/useMessageActionHandlers.ts`
- `message.copy_success` → `src/components/rightBox/renderMessage/useMessageActionHandlers.ts`
- `message.delete_confirm_content` → `src/components/rightBox/renderMessage/useMessageActionHandlers.ts`
- `message.delete_confirm_title` → `src/components/rightBox/renderMessage/useMessageActionHandlers.ts`
- `message.delete_failed` → `src/components/rightBox/renderMessage/useMessageActionHandlers.ts`
- `message.delete_success` → `src/components/rightBox/renderMessage/useMessageActionHandlers.ts`
- `message.edit_failed` → `src/components/rightBox/renderMessage/MessageEditInline.vue`
- `message.edit_inline_hint` → `src/components/rightBox/renderMessage/MessageEditInline.vue`
- `message.edit_placeholder` → `src/components/rightBox/renderMessage/MessageEditInline.vue`
- `message.edit_success` → `src/components/rightBox/renderMessage/MessageEditInline.vue`
- `message.editing` → `src/components/rightBox/renderMessage/MessageEditInline.vue`
- `message.load_messages_failed` → `src/stores/domains/chat/chat/messageLoading.ts`
- `message.mark_failed` → `src/components/rightBox/renderMessage/useMessageActionHandlers.ts`
- `message.no_actions` → `src/components/rightBox/renderMessage/MessageActionMenu.vue`
- `message.pin_failed` → `src/components/rightBox/renderMessage/useMessageActionHandlers.ts`
- `message.pin_success` → `src/components/rightBox/renderMessage/useMessageActionHandlers.ts`
- `message.recall_confirm_content` → `src/components/rightBox/renderMessage/useMessageActionHandlers.ts`
- `message.recall_confirm_title` → `src/components/rightBox/renderMessage/useMessageActionHandlers.ts`
- `message.recall_failed` → `src/components/rightBox/renderMessage/useMessageActionHandlers.ts`
- `message.recall_success` → `src/components/rightBox/renderMessage/useMessageActionHandlers.ts`
- `message.unpin_success` → `src/components/rightBox/renderMessage/useMessageActionHandlers.ts`
- `message.voice_recorder.cancel_recording` → `src/components/rightBox/VoiceRecorder.vue`
- `message.voice_recorder.pause` → `src/components/rightBox/VoiceRecorder.vue`
- `message.voice_recorder.play` → `src/components/rightBox/VoiceRecorder.vue`
- `message.voice_recorder.re_record` → `src/components/rightBox/VoiceRecorder.vue`
- `message.voice_recorder.send` → `src/components/rightBox/VoiceRecorder.vue`
- `message.voice_recorder.start_recording` → `src/components/rightBox/VoiceRecorder.vue`
- `message.voice_recorder.stop_recording` → `src/components/rightBox/VoiceRecorder.vue`

### `message/en/message.json` — 缺 29/29 个键
**已有 24 个键**

**缺失键**:
- `message.copy_empty` → `src/components/rightBox/renderMessage/useMessageActionHandlers.ts`
- `message.copy_failed` → `src/components/rightBox/renderMessage/useMessageActionHandlers.ts`
- `message.copy_success` → `src/components/rightBox/renderMessage/useMessageActionHandlers.ts`
- `message.delete_confirm_content` → `src/components/rightBox/renderMessage/useMessageActionHandlers.ts`
- `message.delete_confirm_title` → `src/components/rightBox/renderMessage/useMessageActionHandlers.ts`
- `message.delete_failed` → `src/components/rightBox/renderMessage/useMessageActionHandlers.ts`
- `message.delete_success` → `src/components/rightBox/renderMessage/useMessageActionHandlers.ts`
- `message.edit_failed` → `src/components/rightBox/renderMessage/MessageEditInline.vue`
- `message.edit_inline_hint` → `src/components/rightBox/renderMessage/MessageEditInline.vue`
- `message.edit_placeholder` → `src/components/rightBox/renderMessage/MessageEditInline.vue`
- `message.edit_success` → `src/components/rightBox/renderMessage/MessageEditInline.vue`
- `message.editing` → `src/components/rightBox/renderMessage/MessageEditInline.vue`
- `message.load_messages_failed` → `src/stores/domains/chat/chat/messageLoading.ts`
- `message.mark_failed` → `src/components/rightBox/renderMessage/useMessageActionHandlers.ts`
- `message.no_actions` → `src/components/rightBox/renderMessage/MessageActionMenu.vue`
- `message.pin_failed` → `src/components/rightBox/renderMessage/useMessageActionHandlers.ts`
- `message.pin_success` → `src/components/rightBox/renderMessage/useMessageActionHandlers.ts`
- `message.recall_confirm_content` → `src/components/rightBox/renderMessage/useMessageActionHandlers.ts`
- `message.recall_confirm_title` → `src/components/rightBox/renderMessage/useMessageActionHandlers.ts`
- `message.recall_failed` → `src/components/rightBox/renderMessage/useMessageActionHandlers.ts`
- `message.recall_success` → `src/components/rightBox/renderMessage/useMessageActionHandlers.ts`
- `message.unpin_success` → `src/components/rightBox/renderMessage/useMessageActionHandlers.ts`
- `message.voice_recorder.cancel_recording` → `src/components/rightBox/VoiceRecorder.vue`
- `message.voice_recorder.pause` → `src/components/rightBox/VoiceRecorder.vue`
- `message.voice_recorder.play` → `src/components/rightBox/VoiceRecorder.vue`
- `message.voice_recorder.re_record` → `src/components/rightBox/VoiceRecorder.vue`
- `message.voice_recorder.send` → `src/components/rightBox/VoiceRecorder.vue`
- `message.voice_recorder.start_recording` → `src/components/rightBox/VoiceRecorder.vue`
- `message.voice_recorder.stop_recording` → `src/components/rightBox/VoiceRecorder.vue`

### `home/zh-CN/home.json` — 缺 26/26 个键
**已有 26 个键**

**缺失键**:
- `home.chat_header.chat_info` → `src/components/rightBox/chatBox/ChatHeader/ChatHeaderSidebar.vue`
- `home.chat_header.clear_messages` → `src/components/rightBox/chatBox/ChatHeader/ChatHeaderSidebar.vue`
- `home.chat_header.clear_messages_confirm_message` → `src/components/rightBox/chatBox/ChatHeader/ChatHeaderRoot.vue`
- `home.chat_header.delete_friend` → `src/components/rightBox/chatBox/ChatHeader/ChatHeaderSidebar.vue`
- `home.chat_header.delete_friend_confirm` → `src/components/rightBox/chatBox/ChatHeader/ChatHeaderRoot.vue`
- `home.chat_header.delete_room` → `src/components/rightBox/chatBox/ChatHeader/ChatHeaderSidebar.vue`
- `home.chat_header.delete_room_confirm` → `src/components/rightBox/chatBox/ChatHeader/ChatHeaderRoot.vue`
- `home.chat_header.group_info` → `src/components/rightBox/chatBox/ChatHeader/ChatHeaderSidebar.vue`
- `home.chat_header.group_members` → `src/components/rightBox/chatBox/ChatHeader/ChatHeaderSidebar.vue`
- `home.chat_header.group_name` → `src/components/rightBox/chatBox/ChatHeader/ChatHeaderSidebar.vue`
- `home.chat_header.group_qr_code` → `src/components/rightBox/chatBox/ChatHeader/ChatHeaderRoot.vue`
- `home.chat_header.input_group_name` → `src/components/rightBox/chatBox/ChatHeader/ChatHeaderSidebar.vue`
- `home.chat_header.input_my_name` → `src/components/rightBox/chatBox/ChatHeader/ChatHeaderSidebar.vue`
- `home.chat_header.input_remark` → `src/components/rightBox/chatBox/ChatHeader/ChatHeaderSidebar.vue`
- `home.chat_header.message_setting` → `src/components/rightBox/chatBox/ChatHeader/ChatHeaderSidebar.vue`
- `home.chat_header.my_name_in_group` → `src/components/rightBox/chatBox/ChatHeader/ChatHeaderSidebar.vue`
- `home.chat_header.pin_room` → `src/components/rightBox/chatBox/ChatHeader/ChatHeaderSidebar.vue`
- `home.chat_header.remark` → `src/components/rightBox/chatBox/ChatHeader/ChatHeaderSidebar.vue`
- `home.chat_header.share_qr_code` → `src/components/rightBox/chatBox/ChatHeader/ChatHeaderRoot.vue`
- `home.chat_sidebar.empty.files` → `src/components/rightBox/chatBox/ChatSidebar.vue`
- `home.chat_sidebar.groups.offline` → `src/components/rightBox/chatBox/ChatSidebar.vue`
- `home.chat_sidebar.groups.online` → `src/components/rightBox/chatBox/ChatSidebar.vue`
- `home.chat_sidebar.pins.selector_empty` → `src/components/rightBox/chatBox/PinMessageSelector.vue`
- `home.chat_sidebar.pins.selector_title` → `src/components/rightBox/chatBox/PinMessageSelector.vue`
- `home.chat_sidebar.quota.title` → `src/components/rightBox/chatBox/ChatSidebar.vue`
- `home.profile_edit.toast.save_failed` → `src/layout/left/hook.ts`

### `home/en/home.json` — 缺 26/26 个键
**已有 26 个键**

**缺失键**:
- `home.chat_header.chat_info` → `src/components/rightBox/chatBox/ChatHeader/ChatHeaderSidebar.vue`
- `home.chat_header.clear_messages` → `src/components/rightBox/chatBox/ChatHeader/ChatHeaderSidebar.vue`
- `home.chat_header.clear_messages_confirm_message` → `src/components/rightBox/chatBox/ChatHeader/ChatHeaderRoot.vue`
- `home.chat_header.delete_friend` → `src/components/rightBox/chatBox/ChatHeader/ChatHeaderSidebar.vue`
- `home.chat_header.delete_friend_confirm` → `src/components/rightBox/chatBox/ChatHeader/ChatHeaderRoot.vue`
- `home.chat_header.delete_room` → `src/components/rightBox/chatBox/ChatHeader/ChatHeaderSidebar.vue`
- `home.chat_header.delete_room_confirm` → `src/components/rightBox/chatBox/ChatHeader/ChatHeaderRoot.vue`
- `home.chat_header.group_info` → `src/components/rightBox/chatBox/ChatHeader/ChatHeaderSidebar.vue`
- `home.chat_header.group_members` → `src/components/rightBox/chatBox/ChatHeader/ChatHeaderSidebar.vue`
- `home.chat_header.group_name` → `src/components/rightBox/chatBox/ChatHeader/ChatHeaderSidebar.vue`
- `home.chat_header.group_qr_code` → `src/components/rightBox/chatBox/ChatHeader/ChatHeaderRoot.vue`
- `home.chat_header.input_group_name` → `src/components/rightBox/chatBox/ChatHeader/ChatHeaderSidebar.vue`
- `home.chat_header.input_my_name` → `src/components/rightBox/chatBox/ChatHeader/ChatHeaderSidebar.vue`
- `home.chat_header.input_remark` → `src/components/rightBox/chatBox/ChatHeader/ChatHeaderSidebar.vue`
- `home.chat_header.message_setting` → `src/components/rightBox/chatBox/ChatHeader/ChatHeaderSidebar.vue`
- `home.chat_header.my_name_in_group` → `src/components/rightBox/chatBox/ChatHeader/ChatHeaderSidebar.vue`
- `home.chat_header.pin_room` → `src/components/rightBox/chatBox/ChatHeader/ChatHeaderSidebar.vue`
- `home.chat_header.remark` → `src/components/rightBox/chatBox/ChatHeader/ChatHeaderSidebar.vue`
- `home.chat_header.share_qr_code` → `src/components/rightBox/chatBox/ChatHeader/ChatHeaderRoot.vue`
- `home.chat_sidebar.empty.files` → `src/components/rightBox/chatBox/ChatSidebar.vue`
- `home.chat_sidebar.groups.offline` → `src/components/rightBox/chatBox/ChatSidebar.vue`
- `home.chat_sidebar.groups.online` → `src/components/rightBox/chatBox/ChatSidebar.vue`
- `home.chat_sidebar.pins.selector_empty` → `src/components/rightBox/chatBox/PinMessageSelector.vue`
- `home.chat_sidebar.pins.selector_title` → `src/components/rightBox/chatBox/PinMessageSelector.vue`
- `home.chat_sidebar.quota.title` → `src/components/rightBox/chatBox/ChatSidebar.vue`
- `home.profile_edit.toast.save_failed` → `src/layout/left/hook.ts`

### `emoticon/zh-CN/emoticon.json` — 缺 23/23 个键
**已有 4 个键**

**缺失键**:
- `emoticon.packs.add_emoji` → `src/mobile/views/my/MobileEmojiManager.vue`
- `emoticon.packs.add_emoji_success` → `src/composables/emoji/useEmojiPackManager.ts`
- `emoticon.packs.confirm_uninstall` → `src/mobile/views/my/MobileEmojiManager.vue`
- `emoticon.packs.create` → `src/mobile/views/my/MobileEmojiManager.vue`
- `emoticon.packs.create_failed` → `src/composables/emoji/useEmojiPackManager.ts`
- `emoticon.packs.create_success` → `src/composables/emoji/useEmojiPackManager.ts`
- `emoticon.packs.description` → `src/mobile/views/my/MobileEmojiManager.vue`
- `emoticon.packs.empty` → `src/mobile/views/my/MobileEmojiManager.vue`
- `emoticon.packs.load_failed` → `src/composables/emoji/useEmojiPackManager.ts`
- `emoticon.packs.pack_count` → `src/mobile/views/my/MobileEmojiManager.vue`
- `emoticon.packs.pack_name` → `src/mobile/views/my/MobileEmojiManager.vue`
- `emoticon.packs.pack_name_placeholder` → `src/mobile/views/my/MobileEmojiManager.vue`
- `emoticon.packs.remove_emoji` → `src/mobile/views/my/MobileEmojiManager.vue`
- `emoticon.packs.remove_emoji_failed` → `src/composables/emoji/useEmojiPackManager.ts`
- `emoticon.packs.remove_emoji_success` → `src/composables/emoji/useEmojiPackManager.ts`
- `emoticon.packs.rename` → `src/mobile/views/my/MobileEmojiManager.vue`
- `emoticon.packs.rename_failed` → `src/composables/emoji/useEmojiPackManager.ts`
- `emoticon.packs.rename_success` → `src/composables/emoji/useEmojiPackManager.ts`
- `emoticon.packs.title` → `src/mobile/views/my/MobileEmojiManager.vue`
- `emoticon.packs.uninstall` → `src/mobile/views/my/MobileEmojiManager.vue`
- `emoticon.packs.uninstall_failed` → `src/composables/emoji/useEmojiPackManager.ts`
- `emoticon.packs.uninstall_success` → `src/composables/emoji/useEmojiPackManager.ts`
- `emoticon.packs.upload_failed` → `src/composables/emoji/useEmojiPackManager.ts`

### `emoticon/en/emoticon.json` — 缺 23/23 个键
**已有 4 个键**

**缺失键**:
- `emoticon.packs.add_emoji` → `src/mobile/views/my/MobileEmojiManager.vue`
- `emoticon.packs.add_emoji_success` → `src/composables/emoji/useEmojiPackManager.ts`
- `emoticon.packs.confirm_uninstall` → `src/mobile/views/my/MobileEmojiManager.vue`
- `emoticon.packs.create` → `src/mobile/views/my/MobileEmojiManager.vue`
- `emoticon.packs.create_failed` → `src/composables/emoji/useEmojiPackManager.ts`
- `emoticon.packs.create_success` → `src/composables/emoji/useEmojiPackManager.ts`
- `emoticon.packs.description` → `src/mobile/views/my/MobileEmojiManager.vue`
- `emoticon.packs.empty` → `src/mobile/views/my/MobileEmojiManager.vue`
- `emoticon.packs.load_failed` → `src/composables/emoji/useEmojiPackManager.ts`
- `emoticon.packs.pack_count` → `src/mobile/views/my/MobileEmojiManager.vue`
- `emoticon.packs.pack_name` → `src/mobile/views/my/MobileEmojiManager.vue`
- `emoticon.packs.pack_name_placeholder` → `src/mobile/views/my/MobileEmojiManager.vue`
- `emoticon.packs.remove_emoji` → `src/mobile/views/my/MobileEmojiManager.vue`
- `emoticon.packs.remove_emoji_failed` → `src/composables/emoji/useEmojiPackManager.ts`
- `emoticon.packs.remove_emoji_success` → `src/composables/emoji/useEmojiPackManager.ts`
- `emoticon.packs.rename` → `src/mobile/views/my/MobileEmojiManager.vue`
- `emoticon.packs.rename_failed` → `src/composables/emoji/useEmojiPackManager.ts`
- `emoticon.packs.rename_success` → `src/composables/emoji/useEmojiPackManager.ts`
- `emoticon.packs.title` → `src/mobile/views/my/MobileEmojiManager.vue`
- `emoticon.packs.uninstall` → `src/mobile/views/my/MobileEmojiManager.vue`
- `emoticon.packs.uninstall_failed` → `src/composables/emoji/useEmojiPackManager.ts`
- `emoticon.packs.uninstall_success` → `src/composables/emoji/useEmojiPackManager.ts`
- `emoticon.packs.upload_failed` → `src/composables/emoji/useEmojiPackManager.ts`

### `setting/zh-CN/setting.json` — 缺 23/23 个键
**已有 31 个键**

**缺失键**:
- `setting.push.editor.action_coalesce` → `src/components/notifications/PushRuleEditor.vue`
- `setting.push.editor.action_dont_notify` → `src/components/notifications/PushRuleEditor.vue`
- `setting.push.editor.action_notify` → `src/components/notifications/PushRuleEditor.vue`
- `setting.push.editor.default_rule` → `src/components/notifications/PushRuleEditor.vue`
- `setting.push.editor.desc` → `src/components/notifications/PushRuleEditor.vue`
- `setting.push.editor.disabled` → `src/components/notifications/PushRuleEditor.vue`
- `setting.push.editor.empty` → `src/components/notifications/PushRuleEditor.vue`
- `setting.push.editor.load_failed` → `src/composables/notifications/usePushRuleEditor.ts`
- `setting.push.editor.refresh` → `src/components/notifications/PushRuleEditor.vue`
- `setting.push.editor.rule_not_found` → `src/composables/notifications/usePushRuleEditor.ts`
- `setting.push.editor.title` → `src/components/notifications/PushRuleEditor.vue`
- `setting.push.editor.update_failed` → `src/composables/notifications/usePushRuleEditor.ts`
- `setting.push.editor.update_success` → `src/composables/notifications/usePushRuleEditor.ts`
- `setting.sessions.current` → `src/views/settingsWindow/tabs/SessionSettings.vue`
- `setting.sessions.days_ago` → `src/views/settingsWindow/tabs/SessionSettings.vue`
- `setting.sessions.hours_ago` → `src/views/settingsWindow/tabs/SessionSettings.vue`
- `setting.sessions.just_now` → `src/views/settingsWindow/tabs/SessionSettings.vue`
- `setting.sessions.minutes_ago` → `src/views/settingsWindow/tabs/SessionSettings.vue`
- `setting.threepid.emails_title` → `src/components/userMenu/ThreepidManager.vue`
- `setting.threepid.no_emails` → `src/components/userMenu/ThreepidManager.vue`
- `setting.threepid.no_phones` → `src/components/userMenu/ThreepidManager.vue`
- `setting.threepid.phones_title` → `src/components/userMenu/ThreepidManager.vue`
- `setting.threepid.region_label` → `src/components/userMenu/ThreepidManager.vue`

### `setting/en/setting.json` — 缺 23/23 个键
**已有 31 个键**

**缺失键**:
- `setting.push.editor.action_coalesce` → `src/components/notifications/PushRuleEditor.vue`
- `setting.push.editor.action_dont_notify` → `src/components/notifications/PushRuleEditor.vue`
- `setting.push.editor.action_notify` → `src/components/notifications/PushRuleEditor.vue`
- `setting.push.editor.default_rule` → `src/components/notifications/PushRuleEditor.vue`
- `setting.push.editor.desc` → `src/components/notifications/PushRuleEditor.vue`
- `setting.push.editor.disabled` → `src/components/notifications/PushRuleEditor.vue`
- `setting.push.editor.empty` → `src/components/notifications/PushRuleEditor.vue`
- `setting.push.editor.load_failed` → `src/composables/notifications/usePushRuleEditor.ts`
- `setting.push.editor.refresh` → `src/components/notifications/PushRuleEditor.vue`
- `setting.push.editor.rule_not_found` → `src/composables/notifications/usePushRuleEditor.ts`
- `setting.push.editor.title` → `src/components/notifications/PushRuleEditor.vue`
- `setting.push.editor.update_failed` → `src/composables/notifications/usePushRuleEditor.ts`
- `setting.push.editor.update_success` → `src/composables/notifications/usePushRuleEditor.ts`
- `setting.sessions.current` → `src/views/settingsWindow/tabs/SessionSettings.vue`
- `setting.sessions.days_ago` → `src/views/settingsWindow/tabs/SessionSettings.vue`
- `setting.sessions.hours_ago` → `src/views/settingsWindow/tabs/SessionSettings.vue`
- `setting.sessions.just_now` → `src/views/settingsWindow/tabs/SessionSettings.vue`
- `setting.sessions.minutes_ago` → `src/views/settingsWindow/tabs/SessionSettings.vue`
- `setting.threepid.emails_title` → `src/components/userMenu/ThreepidManager.vue`
- `setting.threepid.no_emails` → `src/components/userMenu/ThreepidManager.vue`
- `setting.threepid.no_phones` → `src/components/userMenu/ThreepidManager.vue`
- `setting.threepid.phones_title` → `src/components/userMenu/ThreepidManager.vue`
- `setting.threepid.region_label` → `src/components/userMenu/ThreepidManager.vue`

### `space/zh-CN/space.json` — 缺 23/23 个键
**已有 202 个键**

**缺失键**:
- `space.detail_title` → `src/layout/right/index.vue`
- `space.edit_name` → `src/components/workbench/SpaceDetailsPane.vue`
- `space.edit_topic` → `src/components/workbench/SpaceDetailsPane.vue`
- `space.empty_tree` → `src/components/workbench/TjgSpaceTree.vue`
- `space.invite_only_message` → `src/components/workbench/TjgSpaceJoinCta.vue`
- `space.join` → `src/components/workbench/TjgSpaceJoinCta.vue`
- `space.join_failed` → `src/components/workbench/TjgSpaceJoinCta.vue`
- `space.join_public` → `src/components/workbench/TjgSpaceJoinCta.vue`
- `space.join_success` → `src/components/workbench/TjgSpaceJoinCta.vue`
- `space.leave` → `src/components/workbench/TjgSpaceJoinCta.vue`
- `space.leave_failed` → `src/components/workbench/TjgSpaceJoinCta.vue`
- `space.leave_success` → `src/components/workbench/TjgSpaceJoinCta.vue`
- `space.name_error` → `src/components/space/SpaceChildrenPane.vue`
- `space.name_label` → `src/components/workbench/SpaceDetailsPane.vue`
- `space.name_saved` → `src/components/space/SpaceChildrenPane.vue`
- `space.remove_room` → `src/components/space/SpaceChildrenPane.vue`
- `space.remove_room_confirm` → `src/components/space/SpaceChildrenPane.vue`
- `space.remove_room_failed` → `src/components/space/SpaceChildrenPane.vue`
- `space.remove_room_success` → `src/components/space/SpaceChildrenPane.vue`
- `space.request_to_join` → `src/components/workbench/TjgSpaceJoinCta.vue`
- `space.topic_error` → `src/components/space/SpaceChildrenPane.vue`
- `space.topic_label` → `src/components/workbench/SpaceDetailsPane.vue`
- `space.topic_saved` → `src/components/space/SpaceChildrenPane.vue`

### `space/en/space.json` — 缺 23/23 个键
**已有 202 个键**

**缺失键**:
- `space.detail_title` → `src/layout/right/index.vue`
- `space.edit_name` → `src/components/workbench/SpaceDetailsPane.vue`
- `space.edit_topic` → `src/components/workbench/SpaceDetailsPane.vue`
- `space.empty_tree` → `src/components/workbench/TjgSpaceTree.vue`
- `space.invite_only_message` → `src/components/workbench/TjgSpaceJoinCta.vue`
- `space.join` → `src/components/workbench/TjgSpaceJoinCta.vue`
- `space.join_failed` → `src/components/workbench/TjgSpaceJoinCta.vue`
- `space.join_public` → `src/components/workbench/TjgSpaceJoinCta.vue`
- `space.join_success` → `src/components/workbench/TjgSpaceJoinCta.vue`
- `space.leave` → `src/components/workbench/TjgSpaceJoinCta.vue`
- `space.leave_failed` → `src/components/workbench/TjgSpaceJoinCta.vue`
- `space.leave_success` → `src/components/workbench/TjgSpaceJoinCta.vue`
- `space.name_error` → `src/components/space/SpaceChildrenPane.vue`
- `space.name_label` → `src/components/workbench/SpaceDetailsPane.vue`
- `space.name_saved` → `src/components/space/SpaceChildrenPane.vue`
- `space.remove_room` → `src/components/space/SpaceChildrenPane.vue`
- `space.remove_room_confirm` → `src/components/space/SpaceChildrenPane.vue`
- `space.remove_room_failed` → `src/components/space/SpaceChildrenPane.vue`
- `space.remove_room_success` → `src/components/space/SpaceChildrenPane.vue`
- `space.request_to_join` → `src/components/workbench/TjgSpaceJoinCta.vue`
- `space.topic_error` → `src/components/space/SpaceChildrenPane.vue`
- `space.topic_label` → `src/components/workbench/SpaceDetailsPane.vue`
- `space.topic_saved` → `src/components/space/SpaceChildrenPane.vue`

### `message_container/zh-CN/message_container.json` — 缺 8/8 个键
**已有 12 个键**

**缺失键**:
- `message_container.long_press.forward` → `src/mobile/views/chat-room/MobileForwardDialog.vue`
- `message_container.reaction.add_failed` → `src/composables/messaging/useReactionFlow.ts`
- `message_container.reaction.add_success` → `src/composables/messaging/useReactionFlow.ts`
- `message_container.reaction.menu_title` → `src/mobile/components/message/MobileReactionPicker.vue`
- `message_container.reaction.more_emoji` → `src/mobile/components/message/MobileReactionPicker.vue`
- `message_container.reaction.pick_emoji` → `src/mobile/components/message/MobileReactionPicker.vue`
- `message_container.reaction.remove_failed` → `src/composables/messaging/useReactionFlow.ts`
- `message_container.reaction.remove_success` → `src/composables/messaging/useReactionFlow.ts`

### `message_container/en/message_container.json` — 缺 8/8 个键
**已有 12 个键**

**缺失键**:
- `message_container.long_press.forward` → `src/mobile/views/chat-room/MobileForwardDialog.vue`
- `message_container.reaction.add_failed` → `src/composables/messaging/useReactionFlow.ts`
- `message_container.reaction.add_success` → `src/composables/messaging/useReactionFlow.ts`
- `message_container.reaction.menu_title` → `src/mobile/components/message/MobileReactionPicker.vue`
- `message_container.reaction.more_emoji` → `src/mobile/components/message/MobileReactionPicker.vue`
- `message_container.reaction.pick_emoji` → `src/mobile/components/message/MobileReactionPicker.vue`
- `message_container.reaction.remove_failed` → `src/composables/messaging/useReactionFlow.ts`
- `message_container.reaction.remove_success` → `src/composables/messaging/useReactionFlow.ts`

### `common/zh-CN/common.json` — 缺 6/6 个键
**已有 33 个键**

**缺失键**:
- `common.copy` → `src/components/room/RoomDetailDrawer.vue`
- `common.exit` → `src/components/common/GuestModeBanner.vue`
- `common.load_more` → `src/components/workbench/TjgSpaceTree.vue`
- `common.login` → `src/components/common/GuestModeBanner.vue`
- `common.saving` → `src/components/rightBox/renderMessage/MessageEditInline.vue`
- `common.unknownUser` → `src/components/room/RoomDetailLastMessage.vue`

### `common/en/common.json` — 缺 6/6 个键
**已有 33 个键**

**缺失键**:
- `common.copy` → `src/components/room/RoomDetailDrawer.vue`
- `common.exit` → `src/components/common/GuestModeBanner.vue`
- `common.load_more` → `src/components/workbench/TjgSpaceTree.vue`
- `common.login` → `src/components/common/GuestModeBanner.vue`
- `common.saving` → `src/components/rightBox/renderMessage/MessageEditInline.vue`
- `common.unknownUser` → `src/components/room/RoomDetailLastMessage.vue`

### `voip/zh-CN/voip.json` — 缺 5/5 个键
**已有 10 个键**

**缺失键**:
- `voip.call.hangup` → `src/mobile/views/rtcCall/index.vue`
- `voip.call.mute` → `src/mobile/views/rtcCall/index.vue`
- `voip.call.speaker` → `src/mobile/views/rtcCall/index.vue`
- `voip.call.switch_camera` → `src/mobile/views/rtcCall/index.vue`
- `voip.unknown` → `src/mobile/views/rtcCall/index.vue`

### `voip/en/voip.json` — 缺 5/5 个键
**已有 10 个键**

**缺失键**:
- `voip.call.hangup` → `src/mobile/views/rtcCall/index.vue`
- `voip.call.mute` → `src/mobile/views/rtcCall/index.vue`
- `voip.call.speaker` → `src/mobile/views/rtcCall/index.vue`
- `voip.call.switch_camera` → `src/mobile/views/rtcCall/index.vue`
- `voip.unknown` → `src/mobile/views/rtcCall/index.vue`

### `chat/zh-CN/chat.json` — 缺 3/3 个键
**已有 15 个键**

**缺失键**:
- `chat.burn.toggle_title` → `src/components/burn/BurnAfterReadToggle.vue`
- `chat.private_mode.burning` → `src/components/common/PrivateModeBanner.vue`
- `chat.private_mode.enabled` → `src/components/common/PrivateModeBanner.vue`

### `chat/en/chat.json` — 缺 3/3 个键
**已有 15 个键**

**缺失键**:
- `chat.burn.toggle_title` → `src/components/burn/BurnAfterReadToggle.vue`
- `chat.private_mode.burning` → `src/components/common/PrivateModeBanner.vue`
- `chat.private_mode.enabled` → `src/components/common/PrivateModeBanner.vue`

### `matrix_error/zh-CN/matrix_error.json` — 缺 3/3 个键
**已有 13 个键**

**缺失键**:
- `matrix_error.event_report.manager_not_initialized` → `src/services/matrix/moderation/MatrixEventReportService.ts`
- `matrix_error.guest.manager_not_initialized` → `src/services/matrix/guest/MatrixGuestService.ts`
- `matrix_error.messaging.pack_not_found` → `src/services/matrix/messaging/MatrixEmojiService.ts`

### `matrix_error/en/matrix_error.json` — 缺 3/3 个键
**已有 13 个键**

**缺失键**:
- `matrix_error.event_report.manager_not_initialized` → `src/services/matrix/moderation/MatrixEventReportService.ts`
- `matrix_error.guest.manager_not_initialized` → `src/services/matrix/guest/MatrixGuestService.ts`
- `matrix_error.messaging.pack_not_found` → `src/services/matrix/messaging/MatrixEmojiService.ts`

### `friend/zh-CN/friend.json` — 缺 2/2 个键
**已有 12 个键**

**缺失键**:
- `friend.request.expired` → `src/components/friend/FriendRequestCard.vue`
- `friend.request.expires_in` → `src/components/friend/FriendRequestCard.vue`

### `friend/en/friend.json` — 缺 2/2 个键
**已有 12 个键**

**缺失键**:
- `friend.request.expired` → `src/components/friend/FriendRequestCard.vue`
- `friend.request.expires_in` → `src/components/friend/FriendRequestCard.vue`

### `diagnostics/zh-CN/diagnostics.json` — 缺 1/1 个键
**已有 11 个键**

**缺失键**:
- `diagnostics.cors_not_required` → `src/utils/MatrixDiagnostics.ts`

### `diagnostics/en/diagnostics.json` — 缺 1/1 个键
**已有 11 个键**

**缺失键**:
- `diagnostics.cors_not_required` → `src/utils/MatrixDiagnostics.ts`

### `login/zh-CN/login.json` — 缺 1/1 个键
**已有 38 个键**

**缺失键**:
- `login.guest` → `src/views/loginWindow/LoginBottomBar.vue`

### `login/en/login.json` — 缺 1/1 个键
**已有 38 个键**

**缺失键**:
- `login.guest` → `src/views/loginWindow/LoginBottomBar.vue`

### `mobile_edit_profile/zh-CN/mobile_edit_profile.json` — 缺 1/1 个键
**已有 14 个键**

**缺失键**:
- `mobile_edit_profile.extended_profile_unsupported` → `src/mobile/views/my/EditProfile.vue`

### `mobile_edit_profile/en/mobile_edit_profile.json` — 缺 1/1 个键
**已有 14 个键**

**缺失键**:
- `mobile_edit_profile.extended_profile_unsupported` → `src/mobile/views/my/EditProfile.vue`

## 四、按源文件归类

### `src/views/admin/ModerationPanel.vue` — 29 个未解决键（涉及 1 个命名空间）

- `moderation.event_reports.actions.delete` (moderation)
- `moderation.event_reports.actions.dismiss` (moderation)
- `moderation.event_reports.actions.escalate` (moderation)
- `moderation.event_reports.actions.history` (moderation)
- `moderation.event_reports.actions.resolve` (moderation)
- `moderation.event_reports.dialog.deleteConfirm` (moderation)
- `moderation.event_reports.dialog.dismissTitle` (moderation)
- `moderation.event_reports.dialog.reasonPlaceholder` (moderation)
- `moderation.event_reports.dialog.reasonRequired` (moderation)
- `moderation.event_reports.dialog.resolveTitle` (moderation)
- `moderation.event_reports.history.title` (moderation)
- `moderation.event_reports.loadFailed` (moderation)
- `moderation.event_reports.stats.dismissed` (moderation)
- `moderation.event_reports.stats.open` (moderation)
- `moderation.event_reports.stats.resolved` (moderation)
- `moderation.event_reports.stats.total` (moderation)
- `moderation.event_reports.table.actions` (moderation)
- `moderation.event_reports.table.event_id` (moderation)
- `moderation.event_reports.table.reason` (moderation)
- `moderation.event_reports.table.reported_user` (moderation)
- `moderation.event_reports.table.reporter` (moderation)
- `moderation.event_reports.table.status` (moderation)
- `moderation.event_reports.title` (moderation)
- `moderation.event_reports.toast.deleteFailed` (moderation)
- `moderation.event_reports.toast.deleteSuccess` (moderation)
- `moderation.event_reports.toast.dismissSuccess` (moderation)
- `moderation.event_reports.toast.escalateFailed` (moderation)
- `moderation.event_reports.toast.escalateSuccess` (moderation)
- `moderation.event_reports.toast.resolveSuccess` (moderation)

### `src/components/rightBox/renderMessage/useMessageActionHandlers.ts` — 15 个未解决键（涉及 1 个命名空间）

- `message.copy_empty` (message)
- `message.copy_failed` (message)
- `message.copy_success` (message)
- `message.delete_confirm_content` (message)
- `message.delete_confirm_title` (message)
- `message.delete_failed` (message)
- `message.delete_success` (message)
- `message.mark_failed` (message)
- `message.pin_failed` (message)
- `message.pin_success` (message)
- `message.recall_confirm_content` (message)
- `message.recall_confirm_title` (message)
- `message.recall_failed` (message)
- `message.recall_success` (message)
- `message.unpin_success` (message)

### `src/components/rightBox/chatBox/ChatHeader/ChatHeaderSidebar.vue` — 14 个未解决键（涉及 1 个命名空间）

- `home.chat_header.chat_info` (home)
- `home.chat_header.clear_messages` (home)
- `home.chat_header.delete_friend` (home)
- `home.chat_header.delete_room` (home)
- `home.chat_header.group_info` (home)
- `home.chat_header.group_members` (home)
- `home.chat_header.group_name` (home)
- `home.chat_header.input_group_name` (home)
- `home.chat_header.input_my_name` (home)
- `home.chat_header.input_remark` (home)
- `home.chat_header.message_setting` (home)
- `home.chat_header.my_name_in_group` (home)
- `home.chat_header.pin_room` (home)
- `home.chat_header.remark` (home)

### `src/components/moderation/UserReportDialog.vue` — 14 个未解决键（涉及 1 个命名空间）

- `moderation.report_user.comment` (moderation)
- `moderation.report_user.comment_placeholder` (moderation)
- `moderation.report_user.failed` (moderation)
- `moderation.report_user.reason` (moderation)
- `moderation.report_user.reason_abuse` (moderation)
- `moderation.report_user.reason_inappropriate` (moderation)
- `moderation.report_user.reason_other` (moderation)
- `moderation.report_user.reason_placeholder` (moderation)
- `moderation.report_user.reason_required` (moderation)
- `moderation.report_user.reason_spam` (moderation)
- `moderation.report_user.submit` (moderation)
- `moderation.report_user.success` (moderation)
- `moderation.report_user.title` (moderation)
- `moderation.report_user.user_preview` (moderation)

### `src/components/room/RoomRetentionPanel.vue` — 14 个未解决键（涉及 1 个命名空间）

- `room.retention.count_hint` (room)
- `room.retention.count_label` (room)
- `room.retention.days_hint` (room)
- `room.retention.days_label` (room)
- `room.retention.load_failed` (room)
- `room.retention.mode_by_count` (room)
- `room.retention.mode_by_days` (room)
- `room.retention.mode_unlimited` (room)
- `room.retention.read_only_hint` (room)
- `room.retention.save` (room)
- `room.retention.save_failed` (room)
- `room.retention.save_success` (room)
- `room.retention.subtitle` (room)
- `room.retention.title` (room)

### `src/components/room/EventSignaturePanel.vue` — 13 个未解决键（涉及 1 个命名空间）

- `room.event_signature.event_id_placeholder` (room)
- `room.event_signature.invalid` (room)
- `room.event_signature.sign` (room)
- `room.event_signature.sign_failed` (room)
- `room.event_signature.sign_result` (room)
- `room.event_signature.sign_success` (room)
- `room.event_signature.subtitle` (room)
- `room.event_signature.title` (room)
- `room.event_signature.valid` (room)
- `room.event_signature.verify` (room)
- `room.event_signature.verify_failed` (room)
- `room.event_signature.verify_result` (room)
- `room.event_signature.verify_success` (room)

### `src/mobile/views/my/MobileEmojiManager.vue` — 12 个未解决键（涉及 1 个命名空间）

- `emoticon.packs.add_emoji` (emoticon)
- `emoticon.packs.confirm_uninstall` (emoticon)
- `emoticon.packs.create` (emoticon)
- `emoticon.packs.description` (emoticon)
- `emoticon.packs.empty` (emoticon)
- `emoticon.packs.pack_count` (emoticon)
- `emoticon.packs.pack_name` (emoticon)
- `emoticon.packs.pack_name_placeholder` (emoticon)
- `emoticon.packs.remove_emoji` (emoticon)
- `emoticon.packs.rename` (emoticon)
- `emoticon.packs.title` (emoticon)
- `emoticon.packs.uninstall` (emoticon)

### `src/composables/emoji/useEmojiPackManager.ts` — 11 个未解决键（涉及 1 个命名空间）

- `emoticon.packs.add_emoji_success` (emoticon)
- `emoticon.packs.create_failed` (emoticon)
- `emoticon.packs.create_success` (emoticon)
- `emoticon.packs.load_failed` (emoticon)
- `emoticon.packs.remove_emoji_failed` (emoticon)
- `emoticon.packs.remove_emoji_success` (emoticon)
- `emoticon.packs.rename_failed` (emoticon)
- `emoticon.packs.rename_success` (emoticon)
- `emoticon.packs.uninstall_failed` (emoticon)
- `emoticon.packs.uninstall_success` (emoticon)
- `emoticon.packs.upload_failed` (emoticon)

### `src/components/room/RoomCapabilitiesPanel.vue` — 10 个未解决键（涉及 1 个命名空间）

- `room.capabilities.capabilities_section` (room)
- `room.capabilities.disabled` (room)
- `room.capabilities.empty` (room)
- `room.capabilities.enabled` (room)
- `room.capabilities.features_section` (room)
- `room.capabilities.join_rule` (room)
- `room.capabilities.permissions_section` (room)
- `room.capabilities.room_version` (room)
- `room.capabilities.subtitle` (room)
- `room.capabilities.title` (room)

### `src/components/notifications/PushRuleEditor.vue` — 9 个未解决键（涉及 1 个命名空间）

- `setting.push.editor.action_coalesce` (setting)
- `setting.push.editor.action_dont_notify` (setting)
- `setting.push.editor.action_notify` (setting)
- `setting.push.editor.default_rule` (setting)
- `setting.push.editor.desc` (setting)
- `setting.push.editor.disabled` (setting)
- `setting.push.editor.empty` (setting)
- `setting.push.editor.refresh` (setting)
- `setting.push.editor.title` (setting)

### `src/components/workbench/TjgSpaceJoinCta.vue` — 9 个未解决键（涉及 1 个命名空间）

- `space.invite_only_message` (space)
- `space.join` (space)
- `space.join_failed` (space)
- `space.join_public` (space)
- `space.join_success` (space)
- `space.leave` (space)
- `space.leave_failed` (space)
- `space.leave_success` (space)
- `space.request_to_join` (space)

### `src/components/room/InviteDialog.vue` — 8 个未解决键（涉及 1 个命名空间）

- `room.invite.failed` (room)
- `room.invite.invalid_user_id` (room)
- `room.invite.invite` (room)
- `room.invite.or_enter_id` (room)
- `room.invite.search_placeholder` (room)
- `room.invite.success` (room)
- `room.invite.title` (room)
- `room.invite.user_id_placeholder` (room)

### `src/components/space/SpaceChildrenPane.vue` — 8 个未解决键（涉及 1 个命名空间）

- `space.name_error` (space)
- `space.name_saved` (space)
- `space.remove_room` (space)
- `space.remove_room_confirm` (space)
- `space.remove_room_failed` (space)
- `space.remove_room_success` (space)
- `space.topic_error` (space)
- `space.topic_saved` (space)

### `src/components/call/CallView.vue` — 7 个未解决键（涉及 1 个命名空间）

- `call.connected` (call)
- `call.connecting` (call)
- `call.ended` (call)
- `call.error` (call)
- `call.ringing` (call)
- `call.video_call` (call)
- `call.voice_call` (call)

### `src/components/rightBox/VoiceRecorder.vue` — 7 个未解决键（涉及 1 个命名空间）

- `message.voice_recorder.cancel_recording` (message)
- `message.voice_recorder.pause` (message)
- `message.voice_recorder.play` (message)
- `message.voice_recorder.re_record` (message)
- `message.voice_recorder.send` (message)
- `message.voice_recorder.start_recording` (message)
- `message.voice_recorder.stop_recording` (message)

### `src/components/room/RoomEncryptedEventsPanel.vue` — 7 个未解决键（涉及 1 个命名空间）

- `room.encrypted_events.algorithm` (room)
- `room.encrypted_events.empty` (room)
- `room.encrypted_events.event_id` (room)
- `room.encrypted_events.sender` (room)
- `room.encrypted_events.session_id` (room)
- `room.encrypted_events.subtitle` (room)
- `room.encrypted_events.title` (room)

### `src/components/rightBox/renderMessage/MessageEditInline.vue` — 6 个未解决键（涉及 2 个命名空间）

- `common.saving` (common)
- `message.edit_failed` (message)
- `message.edit_inline_hint` (message)
- `message.edit_placeholder` (message)
- `message.edit_success` (message)
- `message.editing` (message)

### `src/mobile/components/PushNotificationList.vue` — 6 个未解决键（涉及 1 个命名空间）

- `push.clear_all` (push)
- `push.hours_ago` (push)
- `push.just_now` (push)
- `push.minutes_ago` (push)
- `push.no_notifications` (push)
- `push.notification_count` (push)

### `src/components/room/RoomMessageQueuePanel.vue` — 6 个未解决键（涉及 1 个命名空间）

- `room.message_queue.content` (room)
- `room.message_queue.empty` (room)
- `room.message_queue.event_id` (room)
- `room.message_queue.subtitle` (room)
- `room.message_queue.title` (room)
- `room.message_queue.type` (room)

### `src/components/rightBox/chatBox/ChatHeader/ChatHeaderRoot.vue` — 5 个未解决键（涉及 1 个命名空间）

- `home.chat_header.clear_messages_confirm_message` (home)
- `home.chat_header.delete_friend_confirm` (home)
- `home.chat_header.delete_room_confirm` (home)
- `home.chat_header.group_qr_code` (home)
- `home.chat_header.share_qr_code` (home)

### `src/views/settingsWindow/tabs/SessionSettings.vue` — 5 个未解决键（涉及 1 个命名空间）

- `setting.sessions.current` (setting)
- `setting.sessions.days_ago` (setting)
- `setting.sessions.hours_ago` (setting)
- `setting.sessions.just_now` (setting)
- `setting.sessions.minutes_ago` (setting)

### `src/components/userMenu/ThreepidManager.vue` — 5 个未解决键（涉及 1 个命名空间）

- `setting.threepid.emails_title` (setting)
- `setting.threepid.no_emails` (setting)
- `setting.threepid.no_phones` (setting)
- `setting.threepid.phones_title` (setting)
- `setting.threepid.region_label` (setting)

### `src/mobile/views/rtcCall/index.vue` — 5 个未解决键（涉及 1 个命名空间）

- `voip.call.hangup` (voip)
- `voip.call.mute` (voip)
- `voip.call.speaker` (voip)
- `voip.call.switch_camera` (voip)
- `voip.unknown` (voip)

### `src/components/rightBox/chatBox/ChatSidebar.vue` — 4 个未解决键（涉及 1 个命名空间）

- `home.chat_sidebar.empty.files` (home)
- `home.chat_sidebar.groups.offline` (home)
- `home.chat_sidebar.groups.online` (home)
- `home.chat_sidebar.quota.title` (home)

### `src/composables/messaging/useReactionFlow.ts` — 4 个未解决键（涉及 1 个命名空间）

- `message_container.reaction.add_failed` (message_container)
- `message_container.reaction.add_success` (message_container)
- `message_container.reaction.remove_failed` (message_container)
- `message_container.reaction.remove_success` (message_container)

### `src/composables/notifications/usePushRuleEditor.ts` — 4 个未解决键（涉及 1 个命名空间）

- `setting.push.editor.load_failed` (setting)
- `setting.push.editor.rule_not_found` (setting)
- `setting.push.editor.update_failed` (setting)
- `setting.push.editor.update_success` (setting)

### `src/components/workbench/SpaceDetailsPane.vue` — 4 个未解决键（涉及 1 个命名空间）

- `space.edit_name` (space)
- `space.edit_topic` (space)
- `space.name_label` (space)
- `space.topic_label` (space)

### `src/mobile/components/message/MobileReactionPicker.vue` — 3 个未解决键（涉及 1 个命名空间）

- `message_container.reaction.menu_title` (message_container)
- `message_container.reaction.more_emoji` (message_container)
- `message_container.reaction.pick_emoji` (message_container)

### `src/mobile/components/chat-room/PrivateModeConfirmDialog.vue` — 3 个未解决键（涉及 1 个命名空间）

- `private_mode.cancel` (private_mode)
- `private_mode.confirm` (private_mode)
- `private_mode.confirm_title` (private_mode)

### `src/components/room/RoomMetadataPanel.vue` — 3 个未解决键（涉及 1 个命名空间）

- `room.metadata.empty` (room)
- `room.metadata.subtitle` (room)
- `room.metadata.title` (room)

### `src/components/common/PrivateModeBanner.vue` — 2 个未解决键（涉及 1 个命名空间）

- `chat.private_mode.burning` (chat)
- `chat.private_mode.enabled` (chat)

### `src/components/common/GuestModeBanner.vue` — 2 个未解决键（涉及 1 个命名空间）

- `common.exit` (common)
- `common.login` (common)

### `src/components/workbench/TjgSpaceTree.vue` — 2 个未解决键（涉及 2 个命名空间）

- `common.load_more` (common)
- `space.empty_tree` (space)

### `src/components/chat/E2EEBanner.vue` — 2 个未解决键（涉及 1 个命名空间）

- `e2ee.banner.desc` (e2ee)
- `e2ee.banner.title` (e2ee)

### `src/components/friend/FriendRequestCard.vue` — 2 个未解决键（涉及 1 个命名空间）

- `friend.request.expired` (friend)
- `friend.request.expires_in` (friend)

### `src/components/rightBox/chatBox/PinMessageSelector.vue` — 2 个未解决键（涉及 1 个命名空间）

- `home.chat_sidebar.pins.selector_empty` (home)
- `home.chat_sidebar.pins.selector_title` (home)

### `src/components/room/RoomInviteActions.vue` — 2 个未解决键（涉及 1 个命名空间）

- `room.invite.accept` (room)
- `room.invite.reject` (room)

### `src/components/burn/BurnAfterReadToggle.vue` — 1 个未解决键（涉及 1 个命名空间）

- `chat.burn.toggle_title` (chat)

### `src/components/room/RoomDetailDrawer.vue` — 1 个未解决键（涉及 1 个命名空间）

- `common.copy` (common)

### `src/components/room/RoomDetailLastMessage.vue` — 1 个未解决键（涉及 1 个命名空间）

- `common.unknownUser` (common)

### `src/utils/MatrixDiagnostics.ts` — 1 个未解决键（涉及 1 个命名空间）

- `diagnostics.cors_not_required` (diagnostics)

### `src/layout/left/hook.ts` — 1 个未解决键（涉及 1 个命名空间）

- `home.profile_edit.toast.save_failed` (home)

### `src/views/loginWindow/LoginBottomBar.vue` — 1 个未解决键（涉及 1 个命名空间）

- `login.guest` (login)

### `src/services/matrix/moderation/MatrixEventReportService.ts` — 1 个未解决键（涉及 1 个命名空间）

- `matrix_error.event_report.manager_not_initialized` (matrix_error)

### `src/services/matrix/guest/MatrixGuestService.ts` — 1 个未解决键（涉及 1 个命名空间）

- `matrix_error.guest.manager_not_initialized` (matrix_error)

### `src/services/matrix/messaging/MatrixEmojiService.ts` — 1 个未解决键（涉及 1 个命名空间）

- `matrix_error.messaging.pack_not_found` (matrix_error)

### `src/mobile/views/chat-room/MobileForwardDialog.vue` — 1 个未解决键（涉及 1 个命名空间）

- `message_container.long_press.forward` (message_container)

### `src/stores/domains/chat/chat/messageLoading.ts` — 1 个未解决键（涉及 1 个命名空间）

- `message.load_messages_failed` (message)

### `src/components/rightBox/renderMessage/MessageActionMenu.vue` — 1 个未解决键（涉及 1 个命名空间）

- `message.no_actions` (message)

### `src/mobile/views/my/EditProfile.vue` — 1 个未解决键（涉及 1 个命名空间）

- `mobile_edit_profile.extended_profile_unsupported` (mobile_edit_profile)

### `src/components/room/CreateRoomPane.vue` — 1 个未解决键（涉及 1 个命名空间）

- `room.create.cancel` (room)

### `src/components/atomic/FederationBadge.vue` — 1 个未解决键（涉及 1 个命名空间）

- `room.discovery.local` (room)

### `src/layout/right/index.vue` — 1 个未解决键（涉及 1 个命名空间）

- `space.detail_title` (space)
