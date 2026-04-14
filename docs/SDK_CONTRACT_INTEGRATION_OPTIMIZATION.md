# SDK 契约集成优化文档

> 版本: v3.0.0
> 日期: 2026-04-13
> 审查范围: 18 个 SDK 契约文档 + synapse-rust 后端 250+ API 端点 vs hula 前端项目（桌面端 + 移动端）

---

## 1. 执行摘要

### 1.1 审查结论

| 集成状态 | 模块数 | 占比 |
|----------|--------|------|
| ✅ 已集成（走 SDK Manager） | 24 | 92% |
| ⚠️ 部分集成（服务已走 SDK，缺 UI） | 1 | 4% |
| 🔴 未集成（后端有但前端无） | 1 | 4% |

### 1.2 已集成模块（桌面端 + 移动端）

| 模块 | SDK Manager | 服务文件 | 桌面端 UI | 移动端 UI | 状态 |
|------|-------------|----------|-----------|-----------|------|
| Device | DeviceManager | MatrixAccountService | Sessions.vue | DeviceManagement.vue | ✅ 双端完成 |
| DM | DirectMessageManager | MatrixRoomService | ChatMain.vue | message/index.vue | ✅ 双端完成 |
| Push | PushManager | MatrixPushService | Notification.vue | NotificationSettings.vue | ✅ 双端完成 |
| Space | SpaceManager | MatrixSpaceService | SpacesView.vue | SpaceDetail.vue | ✅ 双端完成 |
| Room | RoomManager/RoomJoiningManager/RoomSettingsManager | MatrixRoomService | ChatMain.vue | message/index.vue | ✅ 双端完成 |
| Admin | AdminManager | MatrixAdminService | - | - | ✅ 完成 |
| RoomSummary | RoomSummaryManager | MatrixRoomService | ChatMain.vue | message/index.vue | ✅ 双端完成 |
| Auth | AuthManager | MatrixAuthService | Login.vue | Login.vue | ✅ 双端完成 |
| Presence | PresenceManager | MatrixPresenceService | SecurityPrivacy.vue | StatusSettings.vue | ✅ 双端完成 |
| KeyBackup | KeyBackupManager | MatrixKeyBackupService | KeyBackupVersionManager.vue | MobileKeyBackup.vue | ✅ 双端完成 |
| Verification | KeyVerificationManager | MatrixVerificationService | SasVerificationDialog.vue | SecuritySettings.vue(内嵌) | ✅ 双端完成 |
| SecureBackup | SecureBackupManager | MatrixSecureBackupService | - | - | ✅ 完成 |
| AccountData | AccountDataManager | MatrixAccountDataService | - | - | ✅ 完成 |
| SlidingSync | SlidingSync (SDK类) | MatrixSlidingSyncService | - | - | ✅ 完成 |
| Beacon | BeaconManager | MatrixBeaconService | - | - | ✅ 完成 |
| Location | LocationManager | MatrixLocationService | - | - | ✅ 完成 |
| Media | MediaManager | MatrixMediaService | - | - | ✅ 完成 |
| MediaQuota | MediaQuotaManager | MatrixQuotaService | - | - | ✅ 完成 |
| Widget | WidgetManager | MatrixWidgetService | - | - | ✅ 完成 |
| KeyRotation | KeyRotationManager | MatrixKeyRotationService | KeyRotationDialog.vue | SecuritySettings.vue(内嵌) | ✅ 双端完成 |
| Thread | ThreadManager | MatrixThreadService | ThreadPanel.vue | MobileThreadPanel.vue | ✅ 双端完成 |
| Friend | FriendManager | MatrixFriendService | FriendListView.vue | friends/*.vue | ✅ 双端完成 |
| AIConnection | AIConnectionManager | MatrixAIConnectionService | - | - | ✅ 完成 |
| QRLogin | QrLoginManager | MatrixQrLoginService | QRCode.vue | MobileQRCode.vue | ✅ 双端完成 |
| BurnAfterRead | BurnAfterReadManager | MatrixBurnAfterReadService | useBurnAfterRead.ts | MobileBurnIndicator.vue | ✅ 双端完成 |
| PinnedEvents | PinnedEventsManager | MatrixPinnedEventsService | PinnedEventsBar.vue | MobilePinnedEventsBar.vue | ✅ 双端完成 |
| Guest | GuestManager | MatrixGuestService | - | - | ✅ 完成 |

### 1.3 桌面端与移动端功能对比

| 模块 | 桌面端 | 移动端 | 功能差异 |
|------|--------|--------|----------|
| Device | ✅ 完整 | ✅ 完整 | 移动端新增设备重命名（2026-04-13） |
| Push | ✅ 完整 | ✅ 完整 | 功能一致 |
| Presence | ✅ 完整 | ✅ 完整 | 功能一致 |
| Auth | ✅ 完整 | ✅ 完整 | 功能一致 |
| QRLogin | ✅ 扫码登录 | ✅ 扫码+确认 | 移动端可确认扫码 |
| Space | ✅ 完整 | ✅ 完整 | 移动端新增 SpaceDetail.vue（2026-04-13） |
| Thread | ✅ 完整 | ✅ 完整 | 移动端新增 MobileThreadPanel.vue（2026-04-13） |
| Friend | ✅ 完整 | ✅ 完整 | 移动端已实现 friends 页面组（2026-04-13） |
| KeyBackup | ✅ 完整 | ✅ 完整 | 移动端新增 MobileKeyBackup.vue（2026-04-13） |
| Verification | ✅ 完整 | ✅ 完整 | 移动端内嵌 SecuritySettings.vue 弹窗（2026-04-14） |
| KeyRotation | ✅ 完整 | ✅ 完整 | 移动端内嵌 SecuritySettings.vue 弹窗（2026-04-14） |
| PinnedEvents | ✅ 完整 | ✅ 完整 | 移动端新增 MobilePinnedEventsBar.vue（2026-04-14） |
| BurnAfterRead | ✅ 完整 | ✅ 完整 | 移动端新增 MobileBurnIndicator.vue（2026-04-14） |

### 1.4 部分集成模块（服务已走 SDK，缺 UI）

| 模块 | 优先级 | 核心问题 |
|------|--------|----------|
| Rendezvous | P3 | 服务已走 SDK RendezvousManager，功能已被 QRLogin 覆盖 |

### 1.5 未集成模块

| 模块 | 优先级 | 说明 |
|------|--------|------|
| AI 功能服务 | P3 | MatrixAIService 使用 Tauri IPC，非 SDK Manager（功能完整） |

---

## 2. 已完成优化详情

### 2.1 Sliding Sync 模块 ✅

**优化内容**:
- 消除 `as unknown as ExtendedMatrixSDK` 类型断言
- 改用 `(sdk as any).SlidingSync` 获取构造函数
- 移除 `ExtendedMatrixSDK` 接口定义

### 2.2 Beacon 模块 ✅

**优化内容**:
- 重构走 SDK BeaconManager
- 修复事件类型错误（消息事件 → 状态事件）
- 修复 `stopBeacon` 实现错误
- 移除 `ExtendedMatrixClientForBeacon` 接口

### 2.3 Location 模块 ✅

**优化内容**:
- 在 SDK 中创建 `LocationManager` ([location/index.ts](file:///Users/ljf/Desktop/hu/matrix-js-sdk/src/location/index.ts))
- 重构前端 `MatrixLocationService` 走 SDK LocationManager
- 移除非标准的实时位置分享方法（`startLiveLocationShare`/`updateLiveLocation`/`stopLiveLocationShare`）
- 统一使用 MSC3489 Beacon 方案作为实时位置分享

### 2.4 Widget 模块 ✅

**优化内容**:
- 重构 `MatrixWidgetService` 走 SDK `WidgetManager`（单数，非 `WidgetsManager`）
- 使用 REST API 对接后端 `synapse-rust/src/web/routes/widget.rs`
- 新增功能：
  - `getWidget(widgetId)` - 获取单个小组件
  - `updateWidget()` - 更新小组件
  - `getWidgetConfig()` - 获取配置
  - `getJitsiConfig(roomId)` - 获取 Jitsi 视频会议配置
  - `checkWidgetPermission()` / `grantWidgetPermission()` / `denyWidgetPermission()` - 权限管理
  - `createWidgetSession()` / `getWidgetSessions()` / `terminateWidgetSession()` - 会话管理
- 实现 fallback 机制，兼容无 SDK Manager 场景

### 2.5 KeyRotation 模块 ✅

**优化内容**:
- 重构 `KeyRotationDialog.vue` 使用 `MatrixKeyRotationService`
- 更新 `EncryptionSettings.vue` 集成 `MatrixKeyRotationService`
- 新增功能：
  - 显示待轮转设备数量
  - 显示轮转原因
  - 配置自动轮转间隔

### 2.6 Thread 模块 ✅

**优化内容**:
- 更新 `ThreadPanel.vue` 集成 `MatrixThreadService`
- 实现 `loadThreadReplies()` 调用 SDK Manager
- 新增功能：
  - 订阅/取消订阅线程
  - 静音线程
  - 发送线程回复
- 添加 `roomId` prop 支持服务调用

### 2.7 Friend 模块 ✅

**优化内容**:
- `MatrixFriendService` 已正确集成 SDK `FriendManager`
- `FriendListView.vue` 使用 `contactStore` 完整实现好友列表
- 支持功能：
  - 好友列表/搜索/过滤
  - 好友请求处理
  - 设置好友状态（特别关注/拉黑）
  - 好友详情查看

### 2.8 AIConnection 模块 ✅

**优化内容**:
- 创建 `MatrixAIConnectionService` 集成 SDK `AIConnectionManager`
- 对接后端 `synapse-rust/src/web/routes/ai_connection.rs`
- 支持功能：
  - 管理 AI Provider 连接（OpenAI、Anthropic 等）
  - MCP 工具列表查询
  - MCP 工具调用
- 注意：`MatrixAIService`（AI 对话/生成功能）使用 Tauri IPC，功能完整

### 2.9 QRLogin 模块 ✅

**优化内容**:
- `MatrixQrLoginService` 已正确集成 SDK `QrLoginManager`
- `QRCode.vue`（桌面端）和 `MobileQRCode.vue`（移动端）使用服务实现完整登录流程
- 支持功能：
  - 生成 QR 码
  - 轮询检查扫码状态
  - 处理扫码确认
  - 处理过期/刷新
- 移动端支持扫码确认（`ConfirmQRLogin.vue`）

### 2.10 BurnAfterRead 模块 ✅

**优化内容**:
- 更新 `useBurnAfterRead.ts` composable 集成 `MatrixBurnAfterReadService`
- `BurnMessage.vue` 和 `BurnIndicator.vue` 组件已存在
- 支持功能：
  - 消息阅后即焚倒计时
  - 标记消息已读（同步后端）
  - 取消阅后即焚
  - 房间配置管理
  - 加载待销毁消息

### 2.11 PinnedEvents 模块 ✅

**优化内容**:
- 创建 `PinnedEventsBar.vue` 组件集成 `MatrixPinnedEventsService`
- 集成到 `ChatMain.vue` 消息列表顶部
- 支持功能：
  - 显示置顶消息数量
  - 展开/收起置顶消息列表
  - 点击跳转到原消息位置
  - 取消置顶消息
- 注意：与现有 `handlePinRoom`（置顶房间）区分，此为置顶消息事件

### 2.12 Guest 模块 ✅

**优化内容**:
- 创建 `MatrixGuestService` 集成 SDK `GuestManager`
- 对接后端 `synapse-rust/src/web/routes/guest.rs`
- 支持功能：
  - 访客注册 (`registerGuest`)
  - 访客登录 (`loginGuest`)
  - 检查访客状态 (`isGuest`)
  - 获取访客信息 (`getGuestInfo` / `getGuestInfoFromServer`)
  - 升级访客账户 (`upgradeGuestAccount`)
  - 访客加入房间 (`joinRoomAsGuest`)
  - 检查房间访问权限 (`canJoinRoom`)

### 2.13 移动端设备管理增强 ✅ (2026-04-13)

**优化内容**:
- 移动端 `DeviceManagement.vue` 新增设备重命名功能
- 新增 `handleRenameDevice()` 和 `confirmRenameDevice()` 方法
- 使用 `matrixAccountService.setDeviceName()` 调用 SDK
- 添加 `van-popup` 弹窗用于输入新设备名称
- 添加完整的 i18n 翻译支持

### 2.14 移动端 3PID 管理 ✅ (2026-04-13)

**优化内容**:
- 新建 `ThreePidManagement.vue` 移动端组件
- 集成到路由系统 `/mobile/mobileMy/threePid`
- 支持功能：
  - 邮箱列表显示/添加/移除
  - 手机列表显示/添加/移除
  - 验证状态显示
- 使用 `matrixAccountService.getThreePids()` / `addThreePid()` / `deleteThreePid()`

---

## 3. 剩余优化任务

### 3.1 高优先级任务 (P1)

| 模块 | 移动端 UI | 说明 |
|------|-----------|------|
| Space | 需要实现 | 移动端 Spaces 视图 |
| Thread | 需要实现 | 移动端 Thread 面板 |
| Friend | 需要实现 | 移动端好友列表 |

### 3.2 中优先级任务 (P2)

| 模块 | 移动端 UI | 说明 |
|------|-----------|------|
| KeyBackup | 需要实现 | 密钥备份管理 |
| Verification | 需要实现 | 交叉签名验证流程 |
| KeyRotation | 需要实现 | 密钥轮转设置 |
| PinnedEvents | 需要实现 | 置顶消息管理 |
| BurnAfterRead | 需要实现 | 阅后即焚功能 |

### 3.3 低优先级任务 (P3)

| 模块 | 说明 |
|------|------|
| Rendezvous | 功能已被 QRLogin 覆盖，可视为可选 |
| AI 功能服务 | MatrixAIService 使用 Tauri IPC，功能完整，无需修改 |

---

## 4. SDK 扩展记录

### 4.1 新增 SDK Manager

| Manager | 文件路径 | 说明 |
|---------|----------|------|
| LocationManager | `matrix-js-sdk/src/location/index.ts` | 位置消息管理 |
| WidgetManager | `matrix-js-sdk/src/widget/index.ts` | 小组件管理（REST API） |
| AIConnectionManager | `matrix-js-sdk/src/ai-connection/index.ts` | AI Provider 连接管理 |
| GuestManager | `matrix-js-sdk/src/guest/index.ts` | 访客账户管理 |

### 4.2 SDK 类型声明更新

- `matrix-client-extensions.d.ts`: 添加 `getLocationManager()` / `getWidgetManager()` / `getAIConnectionManager()` / `getGuestManager()` 声明
- `matrix.ts`: 导出 `LocationManager`、`WidgetManager`、`AIConnectionManager`、`GuestManager` 和相关类型

---

## 5. 清理的冗余代码

| 类型 | 文件 | 说明 |
|------|------|------|
| `ExtendedMatrixSDK` | matrix-api.ts | 不再需要 |
| `ExtendedMatrixClientForBeacon` | matrix-api.ts | 不再需要 |
| `EventResponse` | matrix-api.ts | 不再需要 |
| 非标准实时位置方法 | MatrixLocationService.ts | 移除 `startLiveLocationShare` 等 |

---

## 6. 服务初始化注册清单

以下服务已在 `MatrixClientService.initializeServices()` 中注册：

```typescript
matrixPresenceService.initialize(this.client)
matrixKeyBackupService.initialize(this.client)
matrixVerificationService.initialize(this.client)
matrixSecureBackupService.initialize(this.client)
matrixAccountDataService.initialize(this.client)
matrixRendezvousService.initialize(this.client)
matrixBeaconService.initialize()
matrixLocationService.initialize()
matrixThreadService.initialize()
matrixKeyRotationService.initialize()
matrixBurnAfterReadService.initialize()
matrixPinnedEventsService.initialize()
matrixWidgetService.initialize()
matrixAIConnectionService.initialize()
matrixGuestService.initialize()
```

---

## 7. API 端点对照

### 7.1 Widget API

| 前端方法 | SDK 方法 | 后端端点 |
|----------|----------|----------|
| `getWidgets(roomId)` | `getRoomWidgets()` | `GET /_matrix/client/v1/rooms/{room_id}/widgets` |
| `getWidget(widgetId)` | `getWidget()` | `GET /_matrix/client/v1/widgets/{widget_id}` |
| `addWidget()` | `addWidget()` | `POST /_matrix/client/v1/widgets` |
| `removeWidget()` | `removeWidget()` | `DELETE /_matrix/client/v1/widgets/{widget_id}` |
| `getJitsiConfig()` | `getJitsiConfig()` | `GET /_matrix/client/v1/rooms/{room_id}/widgets/jitsi/config` |

### 7.2 AI Connection API

| 前端方法 | SDK 方法 | 后端端点 |
|----------|----------|----------|
| `getConnections()` | `getConnections()` | `GET /connections` |
| `createConnection()` | `createConnection()` | `POST /connections` |
| `deleteConnection()` | `deleteConnection()` | `DELETE /connections/{id}` |
| `listMcpTools()` | `listMcpTools()` | `GET /mcp/tools?provider=X` |
| `callMcpTool()` | `callMcpTool()` | `POST /mcp/tools/call` |

### 7.3 Pinned Events API

| 前端方法 | SDK 方法 | 后端端点 |
|----------|----------|----------|
| `getPinnedEvents(roomId)` | `getPinnedEvents()` | Room state event `m.room.pinned_events` |
| `pinEvent(roomId, eventId)` | `pinEvent()` | PUT `m.room.pinned_events` |
| `unpinEvent(roomId, eventId)` | `unpinEvent()` | PUT `m.room.pinned_events` |

### 7.4 Guest API

| 前端方法 | SDK 方法 | 后端端点 |
|----------|----------|----------|
| `registerGuest()` | `registerGuestOnServer()` | `POST /_matrix/client/v3/register/guest` |
| `getGuestInfoFromServer()` | `getGuestInfoFromServer()` | `GET /_matrix/client/v3/account/guest` |
| `upgradeGuestAccount()` | `upgradeGuestAccountOnServer()` | `POST /_matrix/client/v3/account/guest/upgrade` |

---

## 8. 移动端路由配置

移动端设置页面路由已配置于 `src/router/index.ts`：

| 路由路径 | 组件 | 功能 |
|----------|------|------|
| `/mobile/mobileMy` | index.vue | 设置主页 |
| `/mobile/mobileMy/security` | SecuritySettings.vue | 安全设置 |
| `/mobile/mobileMy/deviceManagement` | DeviceManagement.vue | 设备管理 |
| `/mobile/mobileMy/threePid` | ThreePidManagement.vue | 3PID 管理 |
| `/mobile/mobileMy/ignoredUsers` | IgnoredUsers.vue | 忽略用户 |
| `/mobile/mobileMy/notification` | NotificationSettings.vue | 通知设置 |
| `/mobile/mobileMy/status` | StatusSettings.vue | 状态设置 |
| `/mobile/mobileMy/loginHistory` | LoginHistory.vue | 登录历史 |
| `/mobile/mobileMy/qrcode` | MobileQRCode.vue | 二维码扫描 |
| `/mobile/mobileMy/confirmQRLogin` | ConfirmQRLogin.vue | 确认扫码登录 |
| `/mobile/mobileMy/favorites` | Favorites.vue | 收藏夹 |
| `/mobile/mobileMy/keyBackup` | MobileKeyBackup.vue | 密钥备份（新增 2026-04-13） |
| `/mobile/chatRoom/spaceDetail/:roomId` | SpaceDetail.vue | Space 详情（新增 2026-04-13） |
| `/mobile/mobileFriends/*` | friends/*.vue | 好友相关页面（新增 2026-04-13） |

---

## 9. 变更日志

### 2026-04-14 (v3.0.5)
- 移动端 Verification 模块：内嵌 SecuritySettings.vue 弹窗（SAS 验证流程）
- 移动端 KeyRotation 模块：内嵌 SecuritySettings.vue 弹窗（轮转状态/历史/配置）
- 移动端 PinnedEvents 模块：新增 `MobilePinnedEventsBar.vue` 组件
- 移动端 BurnAfterRead 模块：新增 `MobileBurnIndicator.vue` 组件
- 更新 i18n 中英文翻译：verification、key_rotation 相关
- 更新文档：Verification、KeyRotation、PinnedEvents、BurnAfterRead 模块从"桌面端完成"改为"双端完成"
- 所有 P2 移动端 UI 模块已完成，1.5 未集成模块仅剩 P3 的 AI 功能服务

### 2026-04-13 (v3.0.4)
- 新增移动端密钥备份页面 `MobileKeyBackup.vue`
- 移动端 KeyBackup 模块从"桌面端完成"改为"双端完成"
- 路由：`/mobile/mobileMy/keyBackup`

### 2026-04-13 (v3.0.3)
- 新增移动端 Thread 面板 `MobileThreadPanel.vue`
- 移动端 Space 页面已完成：SpaceDetail.vue、SpaceDetail 路由
- 移动端 Friend 页面已实现：friends 页面组
- 更新文档：Thread、Friend 模块从"桌面端完成"改为"双端完成"

### 2026-04-13 (v3.0.2)
- 新增移动端 Space 详情页 `SpaceDetail.vue`
- 移动端 Space 路由：`/mobile/chatRoom/spaceDetail/:roomId`
- 支持功能：查看 Space 信息、Rooms 列表、Members 列表、添加/移除房间、邀请成员
- 更新 i18n 中英文翻译
- 更新文档：Space 模块从"桌面端完成"改为"双端完成"

### 2026-04-13 (v3.0.1)
- 新增 `MatrixAccountService.test.ts` 单元测试文件
- 测试覆盖：getDevices、getDevice、setDeviceName、deleteDevice、deleteDevices、getThreePids、getIgnoredUsers、setIgnoredUsers
- 测试结果：13 个测试用例全部通过
- 总测试数更新：560 个测试（新增 13 个）

### 2026-04-13 (v3.0.0)
- 添加桌面端和移动端完整对比分析
- 更新已集成模块表格，添加桌面端/移动端 UI 列
- 新增 1.3 桌面端与移动端功能对比表
- 新增 1.5 未集成模块（移动端待实现）
- 新增 2.13 移动端设备管理增强
- 新增 2.14 移动端 3PID 管理
- 新增第 8 节移动端路由配置
- 更新集成状态：Device、3PID 已实现双端

### 2026-04-09 (v2.8.0)
- Guest 模块完整集成：创建 MatrixGuestService
- 支持访客注册、登录、升级、加入房间等功能
- 更新集成状态：已集成 92%，部分集成 4%，未集成 4%

### 2026-04-09 (v2.7.0)
- PinnedEvents 模块完整集成：创建 PinnedEventsBar.vue 组件
- 集成到 ChatMain.vue 消息列表顶部
- 支持显示置顶消息、跳转、取消置顶功能
- 更新集成状态：已集成 88%，部分集成 4%，未集成 8%

### 2026-04-09 (v2.6.0)
- BurnAfterRead 模块完整集成：更新 useBurnAfterRead.ts 集成服务
- QRLogin 模块确认已完整集成：服务 + UI 组件
- 更新集成状态：已集成 85%，部分集成 8%，未集成 7%

### 2026-04-09 (v2.5.0)
- Thread 模块完整集成：更新 ThreadPanel.vue 使用 MatrixThreadService
- Friend 模块确认已完整集成：服务 + UI 组件
- AIConnection 模块集成：创建 MatrixAIConnectionService
- 更新集成状态：已集成 81%，部分集成 12%，未集成 7%

### 2026-04-09 (v2.4.0)
- KeyRotation 模块完整集成：服务 + UI 组件
- 更新 KeyRotationDialog.vue 使用 MatrixKeyRotationService
- 更新 EncryptionSettings.vue 集成 MatrixKeyRotationService
- 更新集成状态：KeyRotation 从部分集成改为已完成

### 2026-04-09 (v2.3.0)
- Widget 模块重构走 SDK `WidgetManager`（单数），使用 REST API 对接后端
- 新增 Widget 权限管理、会话管理、Jitsi 配置等功能
- 更新文档：添加 Widget API 端点对照表

### 2026-04-09 (v2.2.0)
- Widget 模块重构走 SDK WidgetsManager
- 更新集成状态统计：已集成 73%，部分集成 23%，未集成 4%
- 添加服务初始化注册清单

### 2026-04-09 (v2.1.0)
- 完成所有 P0/P1 模块的 SDK Manager 集成
- 在 SDK 中创建 LocationManager
- 新建 4 个服务：ThreadService, KeyRotationService, BurnAfterReadService, PinnedEventsService
- 清理 3 个冗余类型定义
- 更新集成状态统计：已集成 69%，部分集成 15%，未集成 16%

### 2026-04-09 (v2.0.0)
- 新增 Sliding Sync、Beacon、Location 模块分析
- 新增 synapse-rust 后端功能前端待实现清单
- 新增 Thread/KeyRotation/BurnAfterRead/PinnedEvents 模块分析

### 2026-04-09 (v1.0.0)
- 初始版本，18 个 SDK 契约文档审查
