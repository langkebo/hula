# Element-Web 功能迁移规格文档

## 项目概述

本文档定义了将 Element-Web 的核心功能迁移到 HuLa 项目的完整规格。HuLa 是基于 Vue 3 + TypeScript + Tauri 的跨平台 Matrix 即时通讯客户端。

## 技术栈对比

| 层面 | Element-Web | HuLa |
|------|-------------|------|
| UI 框架 | React 19 | Vue 3.5 |
| 类型系统 | TypeScript 5 | TypeScript 5.8 |
| 状态管理 | Flux (Dispatcher + Stores) | Pinia |
| 路由 | Hash-based 自定义 | Vue Router |
| 构建工具 | Webpack 5 + Nx | Vite 7 |
| 桌面容器 | Electron (element-desktop) | Tauri 2.9 |
| SDK | matrix-js-sdk | matrix-js-sdk |
| UI 组件库 | Compound Web | Naive UI (桌面) / Vant (移动) |

## 功能迁移优先级

### P0 - 核心功能（必须实现）

| 功能模块 | Element 文件 | HuLa 目标 | 状态 |
|----------|-------------|-----------|------|
| 用户认证 | `auth/Login.tsx` | `views/loginWindow/` | ✅ 已有基础 |
| 消息收发 | `MessagePanel.tsx` | `views/message/` | ✅ 已有基础 |
| 房间列表 | `room-list/` | `layout/left/` | ✅ 已有基础 |
| 房间视图 | `RoomView.tsx` | `views/room/` | ✅ 已有基础 |
| 用户设置 | `UserSettingsDialog.tsx` | `views/settingsWindow/` | ✅ 已完成 |
| 通知系统 | `Notifier.ts` | `stores/` | ⏳ 待实现 |

### P1 - 重要功能（优先实现）

| 功能模块 | Element 文件 | HuLa 目标 | 状态 |
|----------|-------------|-----------|------|
| 空间管理 | `spaces/` | `views/spaces/` | ⏳ 待实现 |
| 线程功能 | `ThreadPanel.tsx` | `views/thread/` | ⏳ 待实现 |
| 语音通话 | `voip/CallView.tsx` | `hooks/useWebRtc.ts` | ⏳ 待实现 |
| 视频通话 | `voip/` | `hooks/useWebRtc.ts` | ⏳ 待实现 |
| E2EE 加密 | `encryption/` | `services/matrix/` | ⏳ 待实现 |
| 搜索功能 | `SpotlightDialog.tsx` | `components/search/` | ⏳ 待实现 |

### P2 - 增强功能（后续实现）

| 功能模块 | Element 文件 | HuLa 目标 | 状态 |
|----------|-------------|-----------|------|
| 位置分享 | `location/` | `components/location/` | ⏳ 待实现 |
| 投票功能 | `polls/` | `components/poll/` | ⏳ 待实现 |
| Widget | `widgets/` | `components/widget/` | ⏳ 待实现 |
| 视觉效果 | `effects/` | `utils/effects/` | ⏳ 待实现 |
| 斜杠命令 | `slash-commands/` | `utils/commands/` | ⏳ 待实现 |

### P3 - 可选功能（按需实现）

| 功能模块 | Element 文件 | HuLa 目标 | 状态 |
|----------|-------------|-----------|------|
| Mjolnir 反滥用 | `mjolnir/` | - | ⏸️ 暂缓 |
| 集成管理 | `integrations/` | - | ⏸️ 暂缓 |
| 分析追踪 | `PosthogAnalytics.ts` | - | ⏸️ 暂缓 |

## 架构映射

### 状态管理映射

| Element (Flux) | HuLa (Pinia) |
|----------------|--------------|
| `RoomViewStore` | `stores/room.ts` |
| `RoomListStore` | `stores/room.ts` |
| `SpaceStore` | `stores/space.ts` (待创建) |
| `RightPanelStore` | `stores/rightPanel.ts` (待创建) |
| `ToastStore` | Naive UI `useMessage` |
| `WidgetStore` | `stores/widget.ts` (待创建) |
| `CallStore` | `stores/call.ts` (待创建) |
| `LifecycleStore` | `stores/matrix.ts` |
| `OwnProfileStore` | `stores/user.ts` |
| `NotificationStateStore` | `stores/notice.ts` |
| `UIStore` | `stores/setting.ts` |

### 组件映射

| Element 组件 | HuLa 组件 | 说明 |
|--------------|-----------|------|
| `MatrixChat.tsx` | `App.vue` | 应用根组件 |
| `LoggedInView.tsx` | `layout/MainLayout.vue` | 登录后主布局 |
| `LeftPanel.tsx` | `layout/left/index.vue` | 左侧导航 |
| `RightPanel.tsx` | `layout/right/index.vue` | 右侧信息面板 |
| `RoomView.tsx` | `views/message/index.vue` | 房间视图 |
| `MessagePanel.tsx` | `components/message/MessagePanel.vue` | 消息面板 |
| `RoomList.tsx` | `components/room/RoomList.vue` | 房间列表 |
| `UserSettingsDialog.tsx` | `views/settingsWindow/SettingsDialog.vue` | 设置对话框 |

## 开发阶段规划

### 阶段一：核心消息功能增强（预计 5 天）

- 消息编辑/删除/回复
- 消息反应（Emoji 反应）
- 消息转发
- 消息搜索
- 阅读回执
- 正在输入指示

### 阶段二：房间管理增强（预计 4 天）

- 房间创建流程
- 房间邀请/成员管理
- 房间权限设置
- 房间别名管理
- 房间标签

### 阶段三：空间功能（预计 4 天）

- 空间面板
- 空间创建/管理
- 空间层级导航
- 空间成员管理

### 阶段四：线程功能（预计 3 天）

- 线程面板
- 线程视图
- 线程通知

### 阶段五：语音视频通话（预计 5 天）

- WebRTC 集成
- 语音通话
- 视频通话
- 屏幕共享
- Element Call 集成

### 阶段六：端到端加密（预计 4 天）

- 设备验证
- 密钥备份
- 安全密钥恢复
- 加密状态指示

### 阶段七：搜索功能（预计 3 天）

- 全局搜索（Spotlight）
- 房间内搜索
- 房间目录
- 用户搜索

### 阶段八：通知系统增强（预计 2 天）

- 桌面通知
- 通知设置完善
- 推送规则

### 阶段九：增强功能（预计 5 天）

- 位置分享
- 投票功能
- Widget 支持
- 视觉效果
- 斜杠命令

## SDK 使用规范

所有 Matrix 协议相关功能必须通过 matrix-js-sdk 实现：

```typescript
// ✅ 正确：使用 SDK
await client.sendEvent(roomId, 'm.room.message', content)

// ❌ 错误：自行实现
await fetch('/api/send', { method: 'POST', body: JSON.stringify(content) })
```

## 质量标准

- 类型检查：`vue-tsc --noEmit` 0 errors
- 单元测试：覆盖率 ≥ 70%
- 代码审查：每个阶段完成后进行
- 性能指标：首屏加载 < 3s，消息渲染 < 100ms

## 参考资源

- [Element-Web 源码](https://github.com/element-hq/element-web)
- [Matrix JS SDK 文档](https://matrix-org.github.io/matrix-js-sdk/)
- [Matrix 规范](https://spec.matrix.org/)
- [HuLa 项目规则](/.trae/rules/project_rules.md)
