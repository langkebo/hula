# HuLa 项目改造检查清单

## 一、冗余代码删除检查

### 1.1 WebSocket 相关文件

- [ ] `src/services/webSocketRust.ts` 已删除
- [ ] `src/services/webSocketAdapter.ts` 已删除
- [ ] `src/services/wsType.ts` 已删除
- [ ] `src-tauri/src/websocket/` 目录已删除
- [ ] 所有 WebSocket 相关导入已清理

### 1.2 朋友圈相关文件

- [ ] `src/stores/feed.ts` 已删除
- [ ] `src/stores/feedNotification.ts` 已删除
- [ ] `src/mobile/views/community/` 目录已删除
- [ ] `src/plugins/dynamic/` 目录已删除
- [ ] 所有朋友圈相关类型定义已清理
- [ ] 所有朋友圈相关导入已清理

### 1.3 Rust 后端清理

- [ ] `src-tauri/src/websocket/` 模块已删除
- [ ] Rust WebSocket 相关命令已移除
- [ ] Rust WebSocket 相关配置已清理

### 1.4 依赖清理

- [ ] `package.json` 中无用依赖已移除
- [ ] `pnpm-lock.yaml` 已更新
- [ ] 项目可正常构建

## 二、Matrix SDK 集成检查

### 2.1 依赖安装

- [ ] `matrix-js-sdk` 已安装
- [ ] `@matrix-org/olm` 已安装
- [ ] `matrix-widget-api` 已安装
- [ ] TypeScript 类型定义正确

### 2.2 服务层实现

- [ ] `MatrixClientService` 已实现
  - [ ] `initialize()` 方法正常工作
  - [ ] `login()` 方法正常工作
  - [ ] `logout()` 方法正常工作
  - [ ] `startClient()` 方法正常工作
  - [ ] `stopClient()` 方法正常工作
  - [ ] 连接状态管理正常
  - [ ] 事件监听机制正常

- [ ] `MatrixRoomService` 已实现
  - [ ] `getRooms()` 方法正常工作
  - [ ] `getRoom()` 方法正常工作
  - [ ] `createRoom()` 方法正常工作
  - [ ] `joinRoom()` 方法正常工作
  - [ ] `leaveRoom()` 方法正常工作
  - [ ] `getMembers()` 方法正常工作
  - [ ] `inviteUser()` 方法正常工作
  - [ ] `kickUser()` 方法正常工作

- [ ] `MatrixEventService` 已实现
  - [ ] `sendTextMessage()` 方法正常工作
  - [ ] `sendImageMessage()` 方法正常工作
  - [ ] `sendFileMessage()` 方法正常工作
  - [ ] `sendVideoMessage()` 方法正常工作
  - [ ] `sendAudioMessage()` 方法正常工作
  - [ ] `redactEvent()` 方法正常工作
  - [ ] `sendMessageReceipt()` 方法正常工作
  - [ ] `getRoomTimeline()` 方法正常工作
  - [ ] `paginateTimeline()` 方法正常工作

- [ ] `MatrixCryptoService` 已实现
  - [ ] `initializeCrypto()` 方法正常工作
  - [ ] `verifyDevice()` 方法正常工作
  - [ ] `backupKeys()` 方法正常工作
  - [ ] `restoreKeys()` 方法正常工作

## 三、状态管理重构检查

### 3.1 Matrix Store

- [ ] `src/stores/matrix.ts` 已创建
- [ ] `client` 状态正确管理
- [ ] `connectionState` 状态正确更新
- [ ] `userId` 状态正确设置
- [ ] `deviceId` 状态正确设置
- [ ] `isLoggedIn` 计算属性正确
- [ ] `initialize()` 方法正常工作
- [ ] `login()` 方法正常工作
- [ ] `loginWithToken()` 方法正常工作
- [ ] `logout()` 方法正常工作

### 3.2 Room Store

- [ ] `src/stores/room.ts` 已创建（从 chat.ts 重构）
- [ ] `rooms` 状态正确管理
- [ ] `roomList` 计算属性正确
- [ ] `currentRoomId` 状态正确管理
- [ ] `currentRoom` 计算属性正确
- [ ] `messages` 状态正确管理
- [ ] `loadRooms()` 方法正常工作
- [ ] `createRoom()` 方法正常工作
- [ ] `joinRoom()` 方法正常工作
- [ ] `leaveRoom()` 方法正常工作
- [ ] `setCurrentRoom()` 方法正常工作

### 3.3 User Store

- [ ] `src/stores/user.ts` 已重构
- [ ] 用户信息适配 Matrix User 模型
- [ ] `getUserInfo()` 方法正常工作
- [ ] 用户状态管理正常

### 3.4 Contacts Store

- [ ] `src/stores/contacts.ts` 已重构
- [ ] 联系人适配 Matrix 联系人 API
- [ ] 联系人列表管理正常

### 3.5 Group Store

- [ ] `src/stores/group.ts` 已重构
- [ ] 群成员适配 Matrix Room Member API
- [ ] 群成员列表管理正常

### 3.6 Global Store

- [ ] `src/stores/global.ts` 已重构
- [ ] 会话管理逻辑正确
- [ ] 未读数管理正确

## 四、UI 组件适配检查

### 4.1 登录组件

- [ ] `src/views/loginWindow/Login.vue` 已重构
- [ ] 密码登录正常工作
- [ ] SSO 登录正常工作（如适用）
- [ ] OIDC 登录正常工作（如适用）
- [ ] 服务器配置正常工作
- [ ] 登录错误处理正确

### 4.2 消息渲染组件

- [ ] 文本消息渲染正确
- [ ] 图片消息渲染正确
- [ ] 视频消息渲染正确
- [ ] 文件消息渲染正确
- [ ] 音频消息渲染正确
- [ ] 位置消息渲染正确（如适用）
- [ ] 撤回消息显示正确
- [ ] 成员变更通知显示正确
- [ ] 加密消息占位显示正确

### 4.3 房间列表组件

- [ ] 房间列表显示正确
- [ ] 房间排序正常
- [ ] 未读数显示正确
- [ ] 置顶房间正常
- [ ] 房间分类正常（直接消息/群组）

### 4.4 聊天输入组件

- [ ] 文本消息发送正常
- [ ] 文件上传正常
- [ ] 图片上传正常
- [ ] 语音上传正常
- [ ] 消息回复正常

## 五、功能验收检查

### 5.1 用户认证

- [ ] 用户名密码登录成功
- [ ] Token 登录成功
- [ ] SSO 登录成功（如适用）
- [ ] OIDC 登录成功（如适用）
- [ ] 登出成功
- [ ] Token 自动刷新正常
- [ ] 会话持久化正常

### 5.2 消息收发

- [ ] 文本消息发送成功
- [ ] 图片消息发送成功
- [ ] 视频消息发送成功
- [ ] 文件消息发送成功
- [ ] 音频消息发送成功
- [ ] 消息接收正常
- [ ] 消息撤回正常
- [ ] 已读回执正常
- [ ] 消息分页加载正常

### 5.3 房间管理

- [ ] 房间列表获取正常
- [ ] 房间创建正常
- [ ] 房间加入正常
- [ ] 房间离开正常
- [ ] 房间成员管理正常
- [ ] 房间设置正常

### 5.4 端到端加密

- [ ] 加密房间创建正常
- [ ] 加密消息发送正常
- [ ] 加密消息接收正常
- [ ] 设备验证正常
- [ ] 密钥备份正常
- [ ] 密钥恢复正常

### 5.5 VoIP 通话

- [ ] 音频通话正常
- [ ] 视频通话正常
- [ ] 通话邀请正常
- [ ] 通话接听正常
- [ ] 通话挂断正常

### 5.6 文件传输

- [ ] 文件上传正常
- [ ] 文件下载正常
- [ ] 大文件传输正常
- [ ] 断点续传正常（如实现）

## 六、性能验收检查

### 6.1 启动性能

- [ ] 启动时间 < 3s
- [ ] 首屏渲染时间 < 1s
- [ ] 骨架屏显示正常

### 6.2 运行时性能

- [ ] 消息加载时间 < 500ms
- [ ] 内存占用 < 500MB（空闲状态）
- [ ] CPU 占用 < 5%（空闲状态）
- [ ] 虚拟滚动正常

### 6.3 网络性能

- [ ] 网络断开后自动重连
- [ ] 离线消息同步正常
- [ ] 网络状态监听正常

## 七、安全验收检查

### 7.1 凭证安全

- [ ] Access Token 加密存储
- [ ] Refresh Token 加密存储
- [ ] 敏感数据不暴露在日志中

### 7.2 通信安全

- [ ] 强制使用 HTTPS/WSS
- [ ] 证书验证正常
- [ ] 代理支持正常（如适用）

### 7.3 数据安全

- [ ] 本地数据加密
- [ ] 安全删除敏感数据
- [ ] 生物识别支持（如适用）

## 八、跨平台验收检查

### 8.1 桌面端

- [ ] Windows 平台正常
- [ ] macOS 平台正常
- [ ] Linux 平台正常

### 8.2 移动端

- [ ] iOS 平台正常
- [ ] Android 平台正常
- [ ] 移动端 UI 适配正常

### 8.3 平台特性

- [ ] 文件系统访问正常
- [ ] 系统通知正常
- [ ] 系统托盘正常（桌面端）
- [ ] 后台运行正常

## 九、测试验收检查

### 9.1 单元测试

- [ ] MatrixClientService 测试通过
- [ ] MatrixRoomService 测试通过
- [ ] MatrixEventService 测试通过
- [ ] Store 测试通过
- [ ] 测试覆盖率 ≥ 80%

### 9.2 集成测试

- [ ] 登录流程测试通过
- [ ] 消息收发流程测试通过
- [ ] 房间管理流程测试通过

### 9.3 端到端测试

- [ ] 完整登录流程测试通过
- [ ] 完整消息收发流程测试通过
- [ ] 完整房间管理流程测试通过

## 十、发布验收检查

### 10.1 构建检查

- [ ] 生产构建成功
- [ ] 构建产物大小合理
- [ ] Source Map 生成正常

### 10.2 文档检查

- [ ] README 更新完成
- [ ] API 文档更新完成
- [ ] 用户文档更新完成

### 10.3 版本检查

- [ ] 版本号更新正确
- [ ] CHANGELOG 更新完成
- [ ] 发布说明准备完成

## 验收签字

| 角色 | 姓名 | 日期 | 签字 |
|-----|------|------|------|
| 开发负责人 | | | |
| 测试负责人 | | | |
| 产品负责人 | | | |
| 技术负责人 | | | |
