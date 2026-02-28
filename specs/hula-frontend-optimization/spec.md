# HuLa 前端项目优化完善方案规格

## Why

通过对 synapse-rust 后端、matrix-js-sdk SDK 和 hula 前端三个项目的深度技术分析，发现前端项目存在以下问题：
1. Matrix SDK 服务层已建立但未充分利用 SDK 扩展功能（好友系统、私聊管理等）
2. 好友系统功能不完整，缺少好友请求处理、好友状态管理等核心功能
3. 私聊功能与后端好友系统未完全对接
4. E2EE 加密流程用户体验不完善
5. 语音消息功能未与后端 API 完全对接
6. 部分高级功能（线程、Space、投票等）UI 未实现

本方案旨在系统性地完善前端项目，实现与后端系统的完整对接，使 HuLa 成为完全适配后端系统的高质量前端项目。

## What Changes

### SDK 集成优化
- 创建 FriendService 服务层封装 FriendManager
- 优化 DirectMessageService 使用 DirectMessageManager
- 完善 VoiceService 对接 VoiceMessageManager API
- 重构 contacts store 支持好友请求状态管理

### 功能模块完善
- 完善好友系统 UI（好友列表、请求处理、状态管理）
- 优化私聊功能（创建私聊、消息加密、房间管理）
- 完善 E2EE 加密流程（设备验证、密钥备份）
- 对接语音消息 API（上传、播放、转文字）
- 实现高级功能 UI（线程、Space、投票）

### 性能优化
- 消息虚拟滚动优化
- 图片懒加载和渐进式加载
- 大文件断点续传

### 兼容性处理
- 多平台适配（桌面端、移动端）
- 离线消息处理
- 网络状态管理

## Impact

- **Affected specs**: 前端架构、状态管理、API 对接规范
- **Affected code**:
  - `src/services/matrix/` - Matrix 服务层
  - `src/stores/contacts.ts` - 联系人状态管理
  - `src/stores/chat.ts` - 聊天状态管理
  - `src/views/` - 页面组件
  - `src/components/` - UI 组件

---

## ADDED Requirements

### Requirement: 好友系统集成

系统 SHALL 完整集成 matrix-js-sdk 的 FriendManager 模块，实现好友功能。

#### Scenario: 好友列表展示
- **GIVEN** 用户已登录
- **WHEN** 进入好友页面
- **THEN** 显示好友列表，包含头像、昵称、状态、备注
- **AND** 支持按状态筛选（收藏、普通、屏蔽）

#### Scenario: 好友请求处理
- **GIVEN** 收到好友请求
- **WHEN** 用户查看请求列表
- **THEN** 显示请求者信息和附言
- **AND** 提供接受/拒绝操作按钮

#### Scenario: 好友状态管理
- **GIVEN** 好友关系已建立
- **WHEN** 用户设置好友状态
- **THEN** 更新好友为收藏/普通/屏蔽/隐藏
- **AND** 同步更新好友列表显示

---

### Requirement: 私聊功能优化

系统 SHALL 优化私聊功能，实现与好友系统的无缝对接。

#### Scenario: 从好友创建私聊
- **GIVEN** 用户在好友列表
- **WHEN** 点击好友头像或"发消息"按钮
- **THEN** 自动创建或打开与该好友的私聊房间
- **AND** 支持加密私聊选项

#### Scenario: 私聊房间管理
- **GIVEN** 存在多个私聊房间
- **WHEN** 查看私聊列表
- **THEN** 显示私聊伙伴信息和最新消息
- **AND** 支持置顶、删除、标记已读操作

---

### Requirement: E2EE 加密流程完善

系统 SHALL 完善端到端加密的用户体验流程。

#### Scenario: 设备验证流程
- **GIVEN** 用户在新设备登录
- **WHEN** 检测到未验证设备
- **THEN** 提示用户进行设备验证
- **AND** 提供二维码扫描或验证码验证方式

#### Scenario: 密钥备份恢复
- **GIVEN** 用户首次使用加密功能
- **WHEN** 系统提示设置密钥备份
- **THEN** 引导用户设置安全密钥或恢复密钥
- **AND** 提供密钥导出功能

---

### Requirement: 语音消息功能对接

系统 SHALL 完整对接后端语音消息 API。

#### Scenario: 语音消息发送
- **GIVEN** 用户在聊天界面
- **WHEN** 录制并发送语音消息
- **THEN** 调用后端语音上传 API
- **AND** 显示上传进度和发送状态

#### Scenario: 语音消息播放
- **GIVEN** 收到语音消息
- **WHEN** 用户点击播放
- **THEN** 调用后端获取语音 API
- **AND** 支持播放进度控制和倍速播放

#### Scenario: 语音转文字
- **GIVEN** 语音消息已接收
- **WHEN** 用户点击转文字按钮
- **THEN** 调用后端语音转文字 API
- **AND** 在消息气泡中显示转换结果

---

### Requirement: 高级功能 UI 实现

系统 SHALL 实现线程消息、Space、投票等高级功能的 UI。

#### Scenario: 线程消息
- **GIVEN** 用户查看消息
- **WHEN** 点击消息的"回复到线程"
- **THEN** 展开线程面板显示回复列表
- **AND** 支持在线程中发送新回复

#### Scenario: Space 管理
- **GIVEN** 用户创建 Space
- **WHEN** 添加子房间
- **THEN** 显示 Space 层级结构
- **AND** 支持房间排序和分组

#### Scenario: 投票功能
- **GIVEN** 用户发起投票
- **WHEN** 设置投票选项
- **THEN** 发送投票消息到房间
- **AND** 实时显示投票结果

---

### Requirement: 性能优化

系统 SHALL 实施性能优化措施提升用户体验。

#### Scenario: 消息虚拟滚动
- **GIVEN** 房间有大量消息
- **WHEN** 用户滚动消息列表
- **THEN** 只渲染可见区域的消息
- **AND** 保持流畅的滚动体验

#### Scenario: 图片懒加载
- **GIVEN** 消息包含多张图片
- **WHEN** 用户滚动到图片位置
- **THEN** 开始加载图片
- **AND** 显示加载占位符和进度

#### Scenario: 大文件断点续传
- **GIVEN** 上传大文件中断
- **WHEN** 网络恢复
- **THEN** 从断点继续上传
- **AND** 显示上传进度

---

### Requirement: 多平台兼容

系统 SHALL 支持多平台兼容性处理。

#### Scenario: 桌面端适配
- **GIVEN** 用户使用桌面应用
- **WHEN** 窗口大小变化
- **THEN** 自适应调整布局
- **AND** 支持多窗口模式

#### Scenario: 移动端适配
- **GIVEN** 用户使用移动应用
- **WHEN** 触摸操作
- **THEN** 响应手势操作
- **AND** 优化移动端性能

#### Scenario: 离线消息处理
- **GIVEN** 用户离线
- **WHEN** 重新连接
- **THEN** 自动同步离线消息
- **AND** 显示未读消息提示

---

## MODIFIED Requirements

### Requirement: Matrix 服务层重构

系统 SHALL 重构 Matrix 服务层以充分利用 SDK 扩展功能。

**修改内容**:
- 新增 FriendService 封装 FriendManager
- 优化 DirectMessageService 使用 DirectMessageManager
- 完善 VoiceService 对接语音消息 API
- 新增 ThreadService 封装线程功能

---

### Requirement: 状态管理优化

系统 SHALL 优化状态管理以支持新功能。

**修改内容**:
- contacts store 增加好友请求状态
- chat store 增加线程消息支持
- 新增 space store 管理 Space 数据

---

## REMOVED Requirements

### Requirement: 冗余 API 调用

**Reason**: 部分功能已由 SDK Manager 封装，无需直接调用 HTTP API。

**Migration**:
- 移除直接的好友 API 调用，使用 FriendManager
- 移除直接的私聊 API 调用，使用 DirectMessageManager
- 使用 SDK 提供的事件机制替代轮询

---

## 技术架构

### SDK 集成架构

```
┌─────────────────────────────────────────────────────────────┐
│                      HuLa 前端应用                           │
├─────────────────────────────────────────────────────────────┤
│  Views/Components                                           │
│  ├── FriendListView.vue                                    │
│  ├── ChatMain.vue                                          │
│  └── SpacePanel.vue                                        │
├─────────────────────────────────────────────────────────────┤
│  Stores (Pinia)                                            │
│  ├── contacts.ts ─────────────────────────────────────────┐│
│  ├── chat.ts                                              ││
│  └── matrix.ts                                            ││
├─────────────────────────────────────────────────────────────┤
│  Services                                                  │
│  ├── FriendService.ts ─────── FriendManager               ││
│  ├── DirectMessageService.ts ─ DirectMessageManager       ││
│  ├── VoiceService.ts ──────── VoiceMessageManager         ││
│  └── MatrixClientService.ts ── MatrixClient               ││
├─────────────────────────────────────────────────────────────┤
│                    matrix-js-sdk                            │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │
│  │FriendManager│ │DirectMsgMgr │ │VoiceMsgMgr  │          │
│  └─────────────┘ └─────────────┘ └─────────────┘          │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │
│  │ RoomManager │ │MessagingMgr │ │PresenceMgr  │          │
│  └─────────────┘ └─────────────┘ └─────────────┘          │
├─────────────────────────────────────────────────────────────┤
│                    HTTP API Layer                           │
└─────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                  Synapse Rust 后端                           │
│  /_matrix/client/v1/friends/*                               │
│  /_matrix/client/v3/rooms/*                                 │
│  /_matrix/client/r0/voice/*                                 │
└─────────────────────────────────────────────────────────────┘
```

### 后端 API 与前端功能映射

| 后端 API 模块 | SDK Manager | 前端服务 | UI 组件 |
|--------------|-------------|---------|---------|
| 好友系统 (11 端点) | FriendManager | FriendService | FriendListView, FriendRequestDialog |
| 私聊管理 (8 端点) | DirectMessageManager | DirectMessageService | ChatMain, DmList |
| 房间管理 (14 端点) | RoomManager | RoomService | RoomList, CreateRoomDialog |
| 消息管理 (9 端点) | MessagingManager | MessageService | MsgInput, MessageList |
| 语音消息 (10 端点) | VoiceMessageManager | VoiceService | VoiceRecorder, VoicePlayer |
| 在线状态 (5 端点) | PresenceManager | PresenceService | UserStatus |
| 账户管理 (5 端点) | AccountManager | AccountService | ProfileSettings |
| E2EE (14 端点) | 核心 SDK | CryptoService | DeviceVerifyDialog |
| VoIP (3 端点) | 核心 SDK | VoIPService | CallView |

---

## 实施优先级

| 优先级 | 功能模块 | 预计工作量 |
|--------|---------|-----------|
| P0 | 好友系统集成 | 3-4 天 |
| P0 | 私聊功能优化 | 2-3 天 |
| P1 | E2EE 流程完善 | 3-4 天 |
| P1 | 语音消息对接 | 2-3 天 |
| P2 | 线程消息 UI | 2 天 |
| P2 | Space 功能 | 2-3 天 |
| P3 | 性能优化 | 2-3 天 |
| P3 | 多平台兼容 | 2 天 |

---

## 风险与缓解措施

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| SDK 版本兼容性 | 高 | 使用锁定版本，充分测试 |
| E2EE 实现复杂度 | 高 | 参考官方实现，渐进式完善 |
| 性能优化效果不确定 | 中 | 先做基准测试，逐步优化 |
| 多平台适配工作量大 | 中 | 优先核心平台，逐步扩展 |

---

## 验收标准

### 功能验收
- 所有好友系统功能正常工作
- 所有私聊功能正常工作
- E2EE 加密流程正常工作
- 语音消息功能正常工作
- 高级功能（线程、Space、投票）正常工作

### 性能验收
- 消息列表滚动帧率 >= 60fps
- 首屏加载时间 < 3s
- 内存占用合理
- CPU 占用合理

### 兼容性验收
- Windows 桌面端测试通过
- macOS 桌面端测试通过
- iOS 移动端测试通过
- Android 移动端测试通过

### 代码质量验收
- TypeScript 编译无错误
- ESLint 检查通过
- 单元测试覆盖率 >= 80%
- 无控制台错误或警告
