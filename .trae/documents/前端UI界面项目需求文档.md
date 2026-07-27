# HuLa 前端 UI 界面项目需求文档

> **版本**: 3.0（参考 HuLaSpark/HuLa + IM 最佳实践优化版）
> **日期**: 2026-07-26
> **项目路径**: `/Users/ljf/Desktop/hu_ts/hula`
> **后端依据**: `/Users/ljf/Desktop/hu_ts/synapse-rust`
> **核心原则**: 中间栏专注列表呈现，右侧栏整合所有辅助功能，非必要不弹窗，聊天统一"进入聊天"按钮跳转

---

## 1. 项目概述

### 1.1 目标
基于 synapse-rust 后端已实现的好友管理、房间管理、空间管理功能模块，全面优化前端 PC 端 UI 界面，重点优化中间栏与右侧栏的布局结构、交互逻辑及视觉呈现，确保每个功能按钮正确触发后端 API 接口，实现完整的用户交互流程。

### 1.2 架构层次
- **L1 SDK 层** (`matrix-js-sdk/src/`): 提供 Manager 类封装 Matrix 协议
- **L2 前端域服务层** (`hula/src/services/matrix/`): 包装 SDK Manager，提供业务语义接口
- **L3 路径常量层** (`hula/src/services/matrix/paths/`): URL 常量定义
- **L4 Store 层** (`hula/src/stores/domains/`): Pinia 状态管理
- **L5 组件层** (`hula/src/components/`): Vue 3 组件
- **L6 视图层** (`hula/src/views/`): 页面级视图

### 1.3 PC 端设计原则
1. **中间栏纯粹性**: 中间栏仅负责列表数据呈现（搜索 + 筛选 + 列表），不承载管理操作
2. **右侧栏功能整合**: 所有辅助功能（搜索结果、添加好友、创建房间、详情查看、管理操作）统一在右侧栏内展示，非必要禁止弹窗
3. **聊天入口统一**: 所有聊天入口通过"进入聊天"按钮触发，跳转至独立聊天界面（ChatBox），而非弹窗
4. **操作流程最短化**: 减少用户操作步骤，列表选择 → 右侧栏查看/操作 → 进入聊天，三步内完成核心流程

### 1.4 参考项目分析与最佳实践

本项目 UI 设计融合了 HuLaSpark/HuLa 成熟项目结构与 Discord/微信 PC/Telegram 等主流即时聊天工具的最佳实践：

#### 1.4.1 HuLaSpark/HuLa 项目分析

| 维度 | HuLaSpark/HuLa 实现 | 本项目采纳要点 |
|------|---------------------|----------------|
| 技术栈 | Tauri v2 + Vue 3 + TS + Vite 7 + Pinia | 完全一致，可直接复用模式 |
| 界面风格 | 模仿 QQ，融合 Telegram + Discord 风格 | 采用"轻社交"风格，简洁现代 |
| 状态管理 | Pinia + pinia-plugin-persistedstate + pinia-shared-state | 采纳持久化 + 跨标签页共享 |
| 状态模块 | user / chat / config / fileDownload / emoji | 按域拆分：contact / message / space / setting |
| 多窗口 | Tauri multi-window（独立聊天/通话窗口） | 采纳：通话/查看大图用独立窗口 |
| 消息功能 | 撤回/@/已读/表情/链接预览/点赞/转发 | 全部采纳，消息交互对标 HuLa |
| 主题系统 | 深色/浅色/皮肤主题切换 | 采纳：CSS 变量 + data-theme 属性 |
| 跨平台 | Win/Mac/Linux/iOS/Android | 采纳：hasTauriRuntime() 守卫 + 响应式断点 |

#### 1.4.2 即时聊天工具最佳实践对标

| 实践来源 | 最佳实践 | 本项目应用 |
|----------|----------|------------|
| **Discord** | 四栏布局（server-rail 72px + channel-list 240px + chat flex:1 + member-list 240px） | 三栏 + 可折叠成员面板（右侧栏内嵌） |
| **Discord** | 列从左到右逐渐变浅，营造深度感 | 采纳：导航栏最深 → 中间栏中等 → 右侧栏最浅 |
| **Discord** | 消息 grid 布局（avatar 40px + content 1fr） | 采纳：聊天消息采用 grid 布局 |
| **Discord** | 服务器图标 squircle → circle hover 变形 | 采纳：导航项/列表项图标 hover 圆角变化 |
| **Discord** | 频道项默认暗淡，hover/active 变亮 | 采纳：列表项三级亮度（default/hover/active） |
| **微信 PC** | 三栏布局（260px + 300px + flex:1） | 采纳：中间栏 240-360px 可拖拽 |
| **微信 PC** | 灰白色系，圆形头像，hover 效果 | 采纳：浅色模式灰白色系 |
| **微信 PC** | 搜索框置顶，不随列表滚动 | 采纳：搜索栏固定置顶 |
| **Telegram 2026** | 永久大搜索栏（非隐藏小图标） | 采纳：搜索栏 40px 高，永久可见 |
| **Telegram 2026** | Liquid Glass 半透明面板效果 | 采纳：详情面板/弹窗采用 backdrop-blur |
| **Telegram 2026** | 底部导航栏（移动端） | 采纳：移动端底部导航，桌面端侧边导航 |
| **通用 IM** | 语义化 HTML（header/main/nav/ul/li） | 采纳：提升无障碍和 SEO |
| **通用 IM** | 虚拟滚动列表 + 骨架屏加载 | 采纳：列表性能优化 |
| **通用 IM** | 消息时间戳智能显示（今天/昨天/日期） | 采纳：时间戳格式化函数 |
| **通用 IM** | 头像懒加载 + fallback 默认头像 | 采纳：avatar 懒加载 + logoD.png 兜底 |

#### 1.4.3 设计决策总结

基于以上分析，本项目 UI 设计遵循以下核心决策：

1. **布局骨架**: Discord 式三栏 + 可折叠成员面板，固定侧栏 + flex:1 内容区
2. **视觉层次**: Discord 式"渐进变浅"色彩深度，导航栏 → 中间栏 → 右侧栏
3. **消息布局**: Discord 式 grid（avatar 固定宽 + content 自适应）
4. **交互反馈**: 三级亮度（default 暗淡 → hover 微亮 → active 高亮）
5. **搜索体验**: Telegram 式永久大搜索栏，结果在右侧栏展示
6. **玻璃质感**: Telegram 式 backdrop-blur 半透明面板
7. **状态管理**: HuLa 式 Pinia 持久化 + 跨标签页共享
8. **多窗口策略**: 通话/大图查看用 Tauri 独立窗口，聊天在右侧栏内嵌

---

## 2. 后端 API 端点清单

### 2.1 好友管理 API

| 功能 | 方法 | 路径 | 认证 | 请求参数 | 响应 |
|------|------|------|------|----------|------|
| 获取好友列表 | GET | `/_matrix/client/v3/friends` | AuthenticatedUser | `?limit=20&offset=0` | `{ friends: FriendItem[] }` |
| 发送好友请求 | POST | `/_matrix/client/v3/friends` | AuthenticatedUser | `{ target_user_id, message }` | `{ request_id }` |
| 搜索好友 | GET/POST | `/_matrix/client/v3/friends/search` | AuthenticatedUser | `{ query, limit }` | `{ results: SearchResult[] }` |
| 获取收到的好友请求 | GET | `/_matrix/client/v3/friends/requests/incoming` | AuthenticatedUser | — | `{ requests: Request[] }` |
| 获取发出的好友请求 | GET | `/_matrix/client/v3/friends/requests/outgoing` | AuthenticatedUser | — | `{ requests: Request[] }` |
| 接受好友请求 | POST | `/_matrix/client/v1/friends/request/{user_id}/accept` | AuthenticatedUser | — | `{ success: bool }` |
| 拒绝好友请求 | POST | `/_matrix/client/v1/friends/request/{user_id}/reject` | AuthenticatedUser | — | `{ success: bool }` |
| 取消好友请求 | POST | `/_matrix/client/v1/friends/request/{user_id}/cancel` | AuthenticatedUser | — | `{ success: bool }` |
| 检查好友关系 | GET | `/_matrix/client/v1/friends/check/{user_id}` | AuthenticatedUser | — | `{ is_friend, status }` |
| 获取好友推荐 | GET | `/_matrix/client/v1/friends/suggestions` | AuthenticatedUser | — | `{ suggestions: User[] }` |
| 删除好友 | DELETE | `/_matrix/client/v1/friends/{user_id}` | AuthenticatedUser | — | `{ success: bool }` |
| 更新好友备注 | PUT | `/_matrix/client/v1/friends/{user_id}/note` | AuthenticatedUser | `{ note }` | `{ success: bool }` |
| 获取好友状态 | GET | `/_matrix/client/v1/friends/{user_id}/status` | AuthenticatedUser | — | `{ status }` |
| 更新好友状态 | PUT | `/_matrix/client/v1/friends/{user_id}/status` | AuthenticatedUser | `{ status: "favorite"\|"normal"\|"blocked" }` | `{ success: bool }` |
| 获取好友详情 | GET | `/_matrix/client/v1/friends/{user_id}/info` | AuthenticatedUser | — | `{ friend: FriendInfo }` |
| 更新好友显示名 | PUT | `/_matrix/client/v1/friends/{user_id}/displayname` | AuthenticatedUser | `{ displayname }` | `{ success: bool }` |
| 获取好友分组 | GET | `/_matrix/client/v1/friends/groups` | AuthenticatedUser | — | `{ groups: Group[] }` |
| 创建好友分组 | POST | `/_matrix/client/v1/friends/groups` | AuthenticatedUser | `{ name }` | `{ group_id }` |
| 删除好友分组 | DELETE | `/_matrix/client/v1/friends/groups/{group_id}` | AuthenticatedUser | — | `{ success: bool }` |
| 重命名好友分组 | PUT | `/_matrix/client/v1/friends/groups/{group_id}/name` | AuthenticatedUser | `{ name }` | `{ success: bool }` |

### 2.2 房间管理 API

| 功能 | 方法 | 路径 | 认证 |
|------|------|------|------|
| 创建房间 | POST | `/_matrix/client/v3/createRoom` | AuthenticatedUser |
| 获取房间信息 | GET | `/_matrix/client/v3/rooms/{room_id}` | AuthenticatedUser |
| 加入房间 | POST | `/_matrix/client/v3/rooms/{room_id}/join` | AuthenticatedUser |
| 离开房间 | POST | `/_matrix/client/v3/rooms/{room_id}/leave` | AuthenticatedUser |
| 忘记房间 | POST | `/_matrix/client/v3/rooms/{room_id}/forget` | AuthenticatedUser |
| 获取房间成员 | GET | `/_matrix/client/v3/rooms/{room_id}/members` | AuthenticatedUser |
| 获取已加入成员 | GET | `/_matrix/client/v3/rooms/{room_id}/joined_members` | AuthenticatedUser |
| 邀请用户 | POST | `/_matrix/client/v3/rooms/{room_id}/invite` | AuthenticatedUser |
| 踢出用户 | POST | `/_matrix/client/v3/rooms/{room_id}/kick` | AuthenticatedUser |
| 封禁用户 | POST | `/_matrix/client/v3/rooms/{room_id}/ban` | AuthenticatedUser |
| 解封用户 | POST | `/_matrix/client/v3/rooms/{room_id}/unban` | AuthenticatedUser |
| 获取房间状态 | GET | `/_matrix/client/v3/rooms/{room_id}/state` | AuthenticatedUser |
| 设置房间状态 | PUT | `/_matrix/client/v3/rooms/{room_id}/state/{event_type}/{state_key}` | AuthenticatedUser |
| 获取房间可见性 | GET | `/_matrix/client/v3/rooms/{room_id}/visibility` | AuthenticatedUser |
| 设置房间可见性 | PUT | `/_matrix/client/v3/rooms/{room_id}/visibility` | AuthenticatedUser |
| 获取用户房间列表 | GET | `/_matrix/client/v3/user/{user_id}/rooms` | AuthenticatedUser |
| 获取房间权限 | GET | `/_matrix/client/v3/rooms/{room_id}/permissions` | AuthenticatedUser |
| 获取房间通知 | GET | `/_matrix/client/v3/rooms/{room_id}/notifications` | AuthenticatedUser |
| 获取房间元数据 | GET | `/_matrix/client/v3/rooms/{room_id}/metadata` | AuthenticatedUser |

### 2.3 空间管理 API

| 功能 | 方法 | 路径 | 认证 |
|------|------|------|------|
| 创建空间 | POST | `/_matrix/client/v3/spaces` | AuthenticatedUser |
| 获取公开空间 | GET | `/_matrix/client/v3/spaces/public` | OptionalAuth |
| 搜索空间 | GET | `/_matrix/client/v3/spaces/search` | OptionalAuth |
| 获取用户空间 | GET | `/_matrix/client/v3/spaces/user` | AuthenticatedUser |
| 获取空间详情 | GET | `/_matrix/client/v3/spaces/{space_id}` | OptionalAuth |
| 更新空间 | PUT | `/_matrix/client/v3/spaces/{space_id}` | AuthenticatedUser |
| 删除空间 | DELETE | `/_matrix/client/v3/spaces/{space_id}` | AuthenticatedUser |
| 获取空间子房间 | GET | `/_matrix/client/v3/spaces/{space_id}/children` | OptionalAuth |
| 添加子房间 | POST | `/_matrix/client/v3/spaces/{space_id}/children` | AuthenticatedUser |
| 移除子房间 | DELETE | `/_matrix/client/v3/spaces/{space_id}/children/{room_id}` | AuthenticatedUser |
| 获取空间层级 | GET | `/_matrix/client/v3/spaces/{space_id}/hierarchy` | OptionalAuth |
| 获取空间成员 | GET | `/_matrix/client/v3/spaces/{space_id}/members` | AuthenticatedUser |
| 获取空间房间列表 | GET | `/_matrix/client/v3/spaces/{space_id}/rooms` | OptionalAuth |
| 邀请加入空间 | POST | `/_matrix/client/v3/spaces/{space_id}/invite` | AuthenticatedUser |
| 加入空间 | POST | `/_matrix/client/v3/spaces/{space_id}/join` | AuthenticatedUser |
| 离开空间 | POST | `/_matrix/client/v3/spaces/{space_id}/leave` | AuthenticatedUser |
| 获取空间摘要 | GET | `/_matrix/client/v3/spaces/{space_id}/summary` | OptionalAuth |
| 获取空间统计 | GET | `/_matrix/client/v3/spaces/statistics` | AuthenticatedUser |
| 通过房间获取空间 | GET | `/_matrix/client/v3/spaces/room/{room_id}` | OptionalAuth |
| 获取房间父空间 | GET | `/_matrix/client/v3/spaces/room/{room_id}/parents` | OptionalAuth |

---

## 3. 界面布局规范

### 3.1 整体三栏布局结构

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          顶部 ActionBar (窗口控制)                        │
├──────┬───────────────────────┬───────────────────────────────────────────┤
│      │                       │                                           │
│ 导航 │   中间栏 (列表区)      │      右侧栏 (功能整合区)                    │
│ 栏   │   专注数据呈现          │      详情/搜索/管理/申请                    │
│      │                       │                                           │
│ 64px │   240-360px (可拖拽)   │      flex:1 (min 600px)                   │
│      │                       │                                           │
│      │   ┌─────────────────┐ │   ┌───────────────────────────────────┐   │
│      │   │ 搜索栏 + 筛选条  │ │   │ ActionBar (返回/标题/操作)         │   │
│      │   ├─────────────────┤ │   ├───────────────────────────────────┤   │
│      │   │                 │ │   │                                   │   │
│      │   │  虚拟滚动列表    │ │   │  视图内容区 (按状态切换)            │   │
│      │   │  (好友/房间/空间)│ │   │  - 详情面板 (Details)              │   │
│      │   │                 │ │   │  - 搜索结果 (SearchPane)            │   │
│      │   │                 │ │   │  - 添加好友 (AddFriendPane)         │   │
│      │   │                 │ │   │  - 创建房间 (CreateRoomPane)        │   │
│      │   │                 │ │   │  - 好友申请 (ApplyList)             │   │
│      │   │                 │ │   │  - 聊天界面 (ChatBox)               │   │
│      │   └─────────────────┘ │   └───────────────────────────────────┘   │
├──────┴───────────────────────┴───────────────────────────────────────────┤
│                          底部状态栏 (可选)                                 │
└──────────────────────────────────────────────────────────────────────────┘
```

### 3.1.1 视觉深度规范（Discord 式渐进变浅）

借鉴 Discord 的"列从左到右逐渐变浅"设计，营造界面深度感：

| 层级 | 区域 | 背景色（浅色模式） | 背景色（深色模式） | 视觉效果 |
|------|------|-------------------|-------------------|----------|
| L0 最深 | 导航栏 | `#F3F3F3` | `#1e1f22` | 沉稳，聚焦导航 |
| L1 中等 | 中间栏 | `#F7F7F7` | `#2b2d31` | 过渡，聚焦列表 |
| L2 最浅 | 右侧栏 | `#FFFFFF` | `#313338` | 明亮，聚焦内容 |

```scss
// CSS 变量定义
:root {
  --hula-surface-sidebar:    #F3F3F3;  /* L0 导航栏 */
  --hula-surface-list:       #F7F7F7;  /* L1 中间栏 */
  --hula-surface-panel:      #FFFFFF;  /* L2 右侧栏 */
}

[data-theme='dark'] {
  --hula-surface-sidebar:    #1e1f22;  /* L0 最深 */
  --hula-surface-list:       #2b2d31;  /* L1 中等 */
  --hula-surface-panel:      #313338;  /* L2 最浅 */
}
```

### 3.2 导航栏规范（左侧栏）
- **宽度**: 64px（窄模式）/ 80px（宽模式，含文字标签）
- **背景深度**: 最深色 `--hula-surface-sidebar`（Discord 式渐进变浅起点）
- **图标**: 内联 SVG，24x24px，颜色跟随 `--hula-text-secondary`
- **图标 hover 变形**（Discord squircle → circle）: 默认 `border-radius: 16px`（圆角方形），hover 时 `border-radius: 50%`（圆形）+ 背景填充主色，transition 0.15s
- **选中态**: 左侧 3px 竖线（`--hula-color-primary`） + 背景 `--hula-surface-sidebar-selected` + 图标变亮
- **三级亮度**（Discord 式）: default `--hula-text-tertiary`（暗淡）→ hover `--hula-text-secondary`（微亮）→ active `--hula-text-primary`（高亮）
- **菜单项**: 消息、好友、房间、空间、动态、更多
- **底部**: 用户头像（点击展开设置菜单），头像 hover 时 `border-radius` 从 50% → 25% 变形
- **实现**: `src/layout/left/index.vue`

### 3.3 中间栏规范（列表区）

#### 3.3.1 功能定位
中间栏**仅负责列表数据呈现**，不承载任何管理操作。所有创建、添加、管理功能统一收归右侧栏。

#### 3.3.2 布局结构
```
┌─────────────────────────────────┐
│  搜索栏 (固定置顶, 40px)         │  ← 输入框 + 搜索按钮
├─────────────────────────────────┤
│  筛选条 (可选, 36px)             │  ← 标签切换: 全部/群聊/未读/置顶
├─────────────────────────────────┤
│                                 │
│  虚拟滚动列表 (flex:1)           │  ← 列表项: 头像+名称+预览+时间+未读
│                                 │
│                                 │
├─────────────────────────────────┤
│  底部快捷操作栏 (可选, 48px)      │  ← 添加好友/创建房间/创建空间入口
└─────────────────────────────────┘
```

#### 3.3.3 尺寸规范
- **宽度**: 240-360px（用户可拖拽调整，持久化到 settingStore）
- **最小宽度**: 240px（低于此值触发收缩模式）
- **最大宽度**: 360px
- **拖拽分隔条**: 右边缘 14px 宽，hover 显示拖拽图标
- **收缩模式**: 当可用空间不足时，中间栏自动收缩为窄模式（仅图标）

#### 3.3.4 响应式断点与右侧栏动态宽度

**视口断点**:
| 视口宽度 | 中间栏行为 | 右侧栏行为 |
|----------|-----------|-----------|
| ≥1440px | 正常显示 (280px) | 视图驱动宽度 |
| 1024-1439px | 窄模式 (240px) | 视图驱动宽度（chat 视图压缩） |
| <1024px | 收缩模式 (仅图标 72px) | 全屏展开 |

**视图驱动动态宽度**（决策 6, 7）:

右侧栏宽度由当前视图类型决定，每个视图有独立宽度：

```typescript
const VIEW_WIDTH_MAP: Record<RightViewType, number> = {
  empty: 360,           // 空状态
  details: 380,         // 详情面板
  search: 440,          // 全局搜索结果
  addFriend: 420,       // 添加好友表单
  createRoom: 460,      // 创建房间表单
  joinRoom: 420,        // 加入房间表单
  createSpace: 460,     // 创建空间表单
  applyList: 400,       // 好友申请列表
  spaceChildren: 440,   // 空间子房间列表
  chat: 620,            // 聊天界面（最宽，容纳消息气泡和输入框）
}
```

**宽度过渡动画**:
```scss
.right-pane {
  transition: width 0.28s cubic-bezier(0.4, 0, 0.2, 1);
}
```

**用户拖拽调整**:
- 右侧栏左边缘支持拖拽调整宽度
- 范围: 360px - 800px
- 用户偏好记忆到 localStorage（key: `hula.rightPaneWidth.{viewType}`）
- 拖拽时禁用过渡动画，松开后恢复

**窗口最小尺寸**:
- **最小宽度**: 1024px（导航栏 72 + 中间栏 240 + 右侧栏最小 360 + 边距 52）
- **推荐宽度**: 1440px（舒适布局）
- Tauri 配置: `minWidth: 1024`

**窗口宽度不足时的降级**:
- 窗口宽度 < 1024px 时，右侧栏宽度 = 窗口宽度 - 导航栏 - 中间栏 - 边距
- 例如窗口 900px: 右侧栏 = 900 - 72 - 240 - 52 = 536px（chat 视图偏窄但可用）
- 显示提示条: "窗口过小可能影响体验，建议放大窗口"

#### 3.3.5 列表项规范
- **高度**: 64px（标准）/ 48px（紧凑模式）
- **内边距**: 8px 12px
- **头像**: 40px 圆形，右下角在线状态点（8px），懒加载 + fallback `logoD.png`
- **名称**: 14px / 500，单行省略
- **预览**: 12px / 400，`--hula-text-tertiary`，单行省略
- **时间**: 11px / 400，`--hula-text-quaternary`，右上角，智能格式化（今天显示 HH:mm，昨天显示"昨天"，更早显示 MM/DD）
- **未读数**: 右下角红色 badge，≥99 显示 "99+"
- **三级亮度**（Discord 式）:
  - default: 文字 `--hula-text-secondary`，背景透明
  - hover: 文字 `--hula-text-primary`，背景 `--hula-surface-list-hover`
  - active: 文字 `--hula-text-primary`，背景 `--hula-surface-list-selected` + 左侧 3px 竖线
- **hover 快速操作**: hover 时右侧显示操作图标（置顶/静音/删除），使用 squircle → circle 变形

#### 3.3.6 搜索栏规范（Telegram 式永久大搜索栏 + 内联过滤）
- **位置**: 中间栏顶部固定，不随列表滚动
- **高度**: 40px（含上下内边距，比传统 28px 更大，参考 Telegram 2026）
- **永久可见**: 非隐藏小图标，始终展示完整输入框
- **输入框**: 圆角 8px，背景 `--hula-surface-search`，placeholder 跟随当前列表类型
- **左侧图标**: 搜索 SVG（16px），`--hula-text-tertiary`
- **右侧清除按钮**: 输入内容后显示 ✕ 按钮，一键清空
- **右侧全局搜索按钮**: 搜索框右侧显示"全局搜索"展开图标，点击或 `Ctrl+Shift+F` 触发跨类型全局搜索（右侧栏 search 视图）
- **默认行为: 中间栏内联过滤**（不抢占右侧栏视图）:
  - 输入关键词时，中间栏列表**实时过滤**显示匹配项
  - 匹配项关键词高亮（`<mark>` 标签，背景 `--hula-color-warning-100`）
  - 用户可继续当前右侧栏操作（如聊天），不受搜索干扰
  - 清空关键词后恢复完整列表
- **全局搜索行为**（仅用户主动触发时）:
  - 跨类型搜索（好友 + 房间 + 空间），结果在右侧栏 search 视图展示
  - 触发方式: 点击搜索框右侧全局搜索按钮 / `Ctrl+Shift+F`
  - 全局搜索会通过 `router.push('/search?q=keyword')` 切换路由
- **快捷键**: `Ctrl+F` 聚焦搜索框（内联过滤），`Ctrl+Shift+F` 全局搜索，`Esc` 清空并失焦
- **防抖**: 输入后 300ms 防抖触发过滤/搜索，避免频繁计算/请求
- **搜索历史**: 聚焦时下拉显示最近 5 条搜索记录（本地存储），仅全局搜索记录历史

#### 3.3.7 筛选条规范
- **位置**: 搜索栏下方，可滚动
- **样式**: 标签按钮组，选中态填充色，非选中态描边
- **好友筛选**: 全部 / 在线 / 收藏 / 屏蔽
- **房间筛选**: 全部 / 群聊 / 未读 / 置顶
- **空间筛选**: 全部 / 我的空间 / 公开空间

### 3.4 右侧栏规范（功能整合区）

#### 3.4.1 功能定位
右侧栏是**所有辅助功能的统一入口**，通过视图状态切换展示不同内容。非必要情况禁止使用弹窗形式。

#### 3.4.2 视图状态机
右侧栏通过 `RightViewType` 状态切换，定义如下：

```typescript
type RightViewType =
  | 'empty'           // 空状态（未选择任何项）
  | 'details'         // 详情面板（好友/房间/空间详情）
  | 'search'          // 搜索结果（好友/房间/空间搜索）
  | 'addFriend'       // 添加好友表单
  | 'createRoom'      // 创建房间表单
  | 'joinRoom'        // 加入房间表单
  | 'createSpace'     // 创建空间表单
  | 'applyList'       // 好友申请列表
  | 'chat'            // 聊天界面（ChatBox，进入聊天后）
```

#### 3.4.3 视图切换规则
```
                    ┌─────────────────────────────────┐
                    │         empty (初始状态)          │
                    └──────────┬──────────────────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
    列表项单击         搜索栏输入         工具栏按钮
              │                │                │
              ▼                ▼                ▼
        ┌──────────┐    ┌──────────┐    ┌──────────────┐
        │ details  │    │  search  │    │ addFriend    │
        └────┬─────┘    └────┬─────┘    │ createRoom   │
             │               │          │ joinRoom     │
             │               │          │ createSpace  │
             │               │          │ applyList    │
             │               │          └──────┬───────┘
             │               │                 │
             │     ┌─────────┘                 │
             │     │                           │
             ▼     ▼                           ▼
        ┌──────────────────────────────────────────┐
        │           chat (进入聊天后)                │
        │    点击"进入聊天"按钮或双击列表项触发        │
        └──────────────────────────────────────────┘
```

#### 3.4.4 布局结构
```
┌──────────────────────────────────────────┐
│  ActionBar (48px)                        │  ← 返回按钮 + 标题 + 操作按钮
├──────────────────────────────────────────┤
│                                          │
│  视图内容区 (flex:1, overflow-y:auto)     │
│                                          │
│  根据 RightViewType 切换:                 │
│                                          │
│  ┌─ details ──────────────────────────┐  │
│  │ 头像区 (148px)                      │  │
│  │ 操作按钮区 (4列网格, 72px)           │  │
│  │ 管理区 (备注/显示名/状态/分组)       │  │
│  └────────────────────────────────────┘  │
│                                          │
│  ┌─ search ───────────────────────────┐  │
│  │ 搜索结果列表 (好友/房间/空间分类)    │  │
│  └────────────────────────────────────┘  │
│                                          │
│  ┌─ addFriend/createRoom ─────────────┐  │
│  │ 表单区 (输入框 + 选项 + 提交按钮)    │  │
│  └────────────────────────────────────┘  │
│                                          │
│  ┌─ chat ─────────────────────────────┐  │
│  │ ChatBox (聊天界面)                   │  │
│  └────────────────────────────────────┘  │
│                                          │
└──────────────────────────────────────────┘
```

#### 3.4.5 尺寸规范
- **宽度**: `flex:1`（自适应剩余空间）
- **最小宽度**: 600px（确保聊天界面不过度挤压）
- **内边距**: 0（ActionBar 全宽，内容区内边距 16px）
- **背景**: `--right-bg-color`（聊天态为 `--right-theme-bg-color`）

#### 3.4.5b 玻璃质感规范（Telegram Liquid Glass）

借鉴 Telegram 2026 的 Liquid Glass 设计，右侧栏详情面板采用半透明 + 模糊效果：

```scss
// 详情面板玻璃质感
.right-pane--glass {
  background: color-mix(in srgb, var(--hula-surface-panel) 85%, transparent);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--hula-border-layout-divider) 50%, transparent);
}

// 深色模式调整
[data-theme='dark'] .right-pane--glass {
  background: color-mix(in srgb, var(--hula-surface-panel) 75%, transparent);
}
```

**应用场景**:
- 详情面板（details 视图）的头部区域
- 搜索结果面板（search 视图）
- 添加好友/创建房间表单面板
- 仅右侧栏内容区使用，ActionBar 保持不透明

**性能注意**: `backdrop-filter` 在大量元素上使用会影响性能，仅在面板级别使用，列表项不使用。

#### 3.4.6 ActionBar 规范
- **高度**: 48px
- **左侧**: 返回按钮（**所有非 empty 状态均显示**，点击 `router.back()` 返回上一视图）
  - chat 视图: 返回进入聊天前的上一个视图（由 Vue Router 历史栈管理）
  - details/addFriend/createRoom 等视图: 返回 empty 或上一视图
  - 实现方式: `router.back()`，不维护自定义视图历史栈
- **中间**: 视图标题（如"好友详情"、"添加好友"、"创建房间"）
- **右侧**: 上下文操作按钮（如"好友请求"角标、"更多"菜单、chat 视图的"独立窗口打开"按钮）
- **拖拽**: 支持 `data-tauri-drag-region` 拖动窗口

#### 3.4.7 详情面板（details 视图）规范
```
┌──────────────────────────────────────┐
│  ← 好友详情                    ⋯     │  ActionBar
├──────────────────────────────────────┤
│                                      │
│         [头像 148px 圆形]             │
│                                      │
│           张三                        │
│         @zhangsan:matrix.test         │
│                                      │
│      "这个人很懒，什么都没留下"        │  签名
│                                      │
│      [在线] [密友]                    │  状态标签
│                                      │
│    最后活跃: 5分钟前                  │
│    地区: 未知  账号: zhangsan         │
│                                      │
├──────────────────────────────────────┤
│  ┌────────┐ ┌────────┐ ┌────────┐    │
│  │ 进入聊天│ │加密聊天 │ │语音通话 │    │  操作按钮区
│  └────────┘ └────────┘ └────────┘    │  (4列网格)
│  ┌────────┐                          │
│  │视频通话 │                          │
│  └────────┘                          │
├──────────────────────────────────────┤
│  备注              [编辑]             │
│  ┌──────────────────────────────┐    │
│  │ 好友备注内容                  │    │  管理区
│  └──────────────────────────────┘    │
│                                      │
│  显示名            [编辑]             │
│  ┌──────────────────────────────┐    │
│  │ 显示名内容                    │    │
│  └──────────────────────────────┘    │
│                                      │
│  好友状态                             │
│  [设为收藏] [设为普通] [屏蔽好友]      │
│                                      │
│  分组管理          [管理]             │
│  ┌──────────────────────────────┐    │
│  │ 同事  家人  朋友              │    │
│  └──────────────────────────────┘    │
│                                      │
│  ┌──────────────────────────────┐    │
│  │      删除好友 (危险按钮)       │    │
│  └──────────────────────────────┘    │
└──────────────────────────────────────┘
```

#### 3.4.8 搜索结果（search 视图）规范
```
┌──────────────────────────────────────┐
│  ← 搜索: "张"                 ✕      │  ActionBar
├──────────────────────────────────────┤
│  好友 (2)                             │
│  ┌──────────────────────────────┐    │
│  │ [头像] 张三  在线              │    │
│  ├──────────────────────────────┤    │
│  │ [头像] 张伟  离线              │    │
│  └──────────────────────────────┘    │
│                                      │
│  房间 (1)                             │
│  ┌──────────────────────────────┐    │
│  │ [头像] 张三的群  5人           │    │
│  └──────────────────────────────┘    │
│                                      │
│  空间 (0)                             │
│  暂无匹配空间                         │
└──────────────────────────────────────┘
```

### 3.5 间距与字体

| 用途 | 尺寸 |
|------|------|
| 页面内边距 | 16px |
| 卡片内边距 | 12px |
| 列表项内边距 | 8px 12px |
| 按钮间距 | 8px |
| 按钮组间距 | 12px |
| 章节间距 | 16px |
| 主标题 | 18px / 600 |
| 副标题 | 14px / 500 |
| 正文 | 14px / 400 |
| 辅助文字 | 12px / 400 |
| 标签 | 11px / 500 |
| ActionBar 标题 | 15px / 600 |

### 3.6 颜色规范

| 用途 | CSS 变量 |
|------|----------|
| 面板背景 | `--hula-surface-panel` |
| 列表 hover | `--hula-surface-list-hover` |
| 列表选中 | `--hula-surface-list-selected` |
| 搜索框背景 | `--hula-surface-search` |
| 主色 | `--hula-color-primary` / `--hula-color-primary-500` |
| 危险色 | `--hula-color-danger-500` |
| 主文本 | `--hula-text-primary` |
| 次要文本 | `--hula-text-secondary` |
| 辅助文本 | `--hula-text-tertiary` |
| 弱化文本 | `--hula-text-quaternary` |
| 分隔线 | `--hula-border-layout-divider` |

---

## 4. 功能模块设计

### 4.1 好友管理模块

#### 4.1.1 好友列表页 (`/friendsList`)

**中间栏布局**:
```
┌─────────────────────────────────┐
│  🔍 搜索好友...          [✕]    │  搜索栏
├─────────────────────────────────┤
│  [全部] [在线] [收藏] [屏蔽]    │  筛选条
├─────────────────────────────────┤
│  ▼ 全部好友 (12)                │
│   [头像] 张三  在线  5分钟前     │
│   [头像] 李四  离线  2小时前     │
│  ▼ 收藏 (3)                     │
│   [头像] 王五  在线              │
│  ▼ 屏蔽 (1)                     │
│   [头像] 赵六  离线              │
├─────────────────────────────────┤
│  [添加好友] [好友请求 🔴3]      │  底部快捷操作
└─────────────────────────────────┘
```

**按钮功能清单**:

| 按钮 | 位置 | API 端点 | 交互逻辑 |
|------|------|----------|----------|
| 搜索好友 | 中间栏搜索栏 | 内联过滤（无 API） | 默认**中间栏内联过滤**；`Ctrl+Shift+F` 触发全局搜索→右侧栏 search 视图 |
| 添加好友 | 中间栏底部 / 右侧栏 | `POST /friends` | **右侧栏 addFriend 视图**：输入用户ID + 验证消息 |
| 好友请求列表 | 中间栏底部 / 右侧栏 | `GET /friends/requests/incoming` | **右侧栏 applyList 视图**展示所有待处理请求 |
| 接受请求 | 右侧栏 applyList | `POST /friends/request/{uid}/accept` | 点击接受，刷新申请列表 |
| 拒绝请求 | 右侧栏 applyList | `POST /friends/request/{uid}/reject` | 点击拒绝，刷新申请列表 |
| 查看详情 | 中间栏单击 | — | **右侧栏 details 视图**显示好友详情 |
| 进入聊天 | 右侧栏 details | — | 统一"进入聊天"按钮，**右侧栏切换 chat 视图** |
| 加密聊天 | 右侧栏 details | `POST /createRoom` (encrypted) | 创建加密 DM，**右侧栏切换 chat 视图** |
| 语音通话 | 右侧栏 details | Tauri 窗口 | 创建独立 rtcCall 窗口 |
| 视频通话 | 右侧栏 details | Tauri 窗口 | 创建独立 rtcCall 窗口 |
| 设置备注 | 右侧栏 details | `PUT /friends/{uid}/note` | **内联编辑**（非弹窗），点击编辑展开输入框 |
| 设置显示名 | 右侧栏 details | `PUT /friends/{uid}/displayname` | **内联编辑**（非弹窗） |
| 设为收藏 | 右侧栏 details | `PUT /friends/{uid}/status` (favorite) | 状态切换按钮 |
| 设为普通 | 右侧栏 details | `PUT /friends/{uid}/status` (normal) | 状态切换按钮 |
| 屏蔽好友 | 右侧栏 details | `PUT /friends/{uid}/status` (blocked) | 状态切换按钮 |
| 删除好友 | 右侧栏 details | `DELETE /friends/{uid}` | **确认弹窗**（危险操作保留弹窗） |
| 好友分组 | 右侧栏 details | `GET/POST /friends/groups` | **右侧栏内嵌分组管理区** |

#### 4.1.2 组件清单

| 组件 | 路径 | 状态 | 说明 |
|------|------|------|------|
| FriendListView | `components/friend/FriendListView.vue` | ✅ 保留 | 好友列表主组件（中间栏） |
| FriendListItem | `components/friend/FriendListItem.vue` | ✅ 保留 | 好友列表项 |
| FriendSearchBar | `components/friend/FriendSearchBar.vue` | ✅ 保留 | 搜索栏 |
| AddFriendDialog | `components/friend/AddFriendDialog.vue` | 🔄 改造 | **改为右侧栏内嵌面板** AddFriendPane |
| FriendRequestDialog | `components/friend/FriendRequestDialog.vue` | 🔄 改造 | **改为右侧栏内嵌面板** FriendRequestPane |
| FriendRequestCard | `components/friend/FriendRequestCard.vue` | ✅ 保留 | 请求卡片（在 applyList 视图中复用） |
| FriendGroupDialog | `components/friend/FriendGroupDialog.vue` | 🔄 改造 | **改为右侧栏内嵌分组管理区** |
| FriendGroupView | `components/friend/FriendGroupView.vue` | ✅ 保留 | 分组视图 |
| Details | `components/rightBox/Details.vue` | ✅ 保留 | 右侧详情面板（已内嵌） |
| ApplyList | `components/rightBox/ApplyList.vue` | ✅ 保留 | 好友申请列表（已内嵌） |

### 4.2 房间管理模块

#### 4.2.1 房间列表页 (`/roomList`)

**中间栏布局**:
```
┌─────────────────────────────────┐
│  🔍 搜索房间...          [✕]    │  搜索栏
├─────────────────────────────────┤
│  [全部] [群聊] [未读] [置顶]    │  筛选条
├─────────────────────────────────┤
│  [头像] 群组A  5条未读  最后...  │
│  [头像] 群组B  0条未读  最后...  │
│  [头像] 群组C  2条未读  最后...  │
├─────────────────────────────────┤
│  [创建房间] [加入房间]          │  底部快捷操作
└─────────────────────────────────┘
```

**按钮功能清单**:

| 按钮 | 位置 | API 端点 | 交互逻辑 |
|------|------|----------|----------|
| 搜索房间 | 中间栏搜索栏 | 内联过滤（无 API） | 默认**中间栏内联过滤**；`Ctrl+Shift+F` 触发全局搜索→右侧栏 search 视图 |
| 创建房间 | 中间栏底部 / 右侧栏 | `POST /createRoom` | **右侧栏 createRoom 视图**：房间名+类型+可见性+加密 |
| 加入房间 | 中间栏底部 / 右侧栏 | `POST /rooms/{room_id}/join` | **右侧栏 joinRoom 视图**：输入房间ID或别名 |
| 查看详情 | 中间栏单击 | `GET /rooms/{room_id}` | **右侧栏 details 视图**显示房间详情 |
| 进入聊天 | 右侧栏 details | — | 统一"进入聊天"按钮，**右侧栏切换 chat 视图** |
| 视频通话 | 右侧栏 details | Tauri 窗口 | 创建群视频通话窗口 |
| 查看成员 | 右侧栏 details | `GET /rooms/{room_id}/members` | **右侧栏内嵌成员列表区** |
| 邀请成员 | 右侧栏 details | `POST /rooms/{room_id}/invite` | **右侧栏内嵌邀请表单** |
| 踢出成员 | 右侧栏 details | `POST /rooms/{room_id}/kick` | **确认弹窗**后踢出 |
| 封禁成员 | 右侧栏 details | `POST /rooms/{room_id}/ban` | **确认弹窗**后封禁 |
| 解封成员 | 右侧栏 details | `POST /rooms/{room_id}/unban` | **确认弹窗**后解封 |
| 离开房间 | 右侧栏 details | `POST /rooms/{room_id}/leave` | **确认弹窗**后离开 |
| 忘记房间 | 右侧栏 details | `POST /rooms/{room_id}/forget` | **确认弹窗**后忘记 |
| 修改房间名 | 右侧栏 details | `PUT /rooms/{room_id}/state/m.room.name/` | **内联编辑** |
| 修改房间头像 | 右侧栏 details | `PUT /rooms/{room_id}/state/m.room.avatar/` | 上传图片 |
| 设置可见性 | 右侧栏 details | `PUT /rooms/{room_id}/visibility` | 切换公开/私密 |

#### 4.2.2 组件清单

| 组件 | 路径 | 状态 | 说明 |
|------|------|------|------|
| RoomList | `views/homeWindow/RoomList.vue` | ✅ 保留 | 房间列表视图（中间栏） |
| RoomSessionList | `components/workbench/RoomSessionList.vue` | ✅ 保留 | 会话列表 |
| HulaRoomListItem | `components/workbench/HulaRoomListItem.vue` | ✅ 保留 | 房间列表项 |
| RoomSpaceWorkbench | `components/workbench/RoomSpaceWorkbench.vue` | ✅ 保留 | 工作台主组件 |
| RoomSpaceToolbar | `components/workbench/RoomSpaceToolbar.vue` | ✅ 保留 | 工具栏 |
| RoomSpaceActionBar | `components/workbench/RoomSpaceActionBar.vue` | ✅ 保留 | 操作栏 |
| WorkbenchDetailPane | `components/workbench/WorkbenchDetailPane.vue` | ✅ 保留 | 详情面板 |
| WorkbenchSearchPane | `components/workbench/WorkbenchSearchPane.vue` | ✅ 保留 | 搜索结果面板 |
| CreateRoomDialog | `components/workbench/CreateRoomDialog.vue` | 🔄 改造 | **改为右侧栏内嵌面板** |
| JoinRoomDialog | `components/workbench/JoinRoomDialog.vue` | 🔄 改造 | **改为右侧栏内嵌面板** |

### 4.3 空间管理模块

#### 4.3.1 空间列表页 (`/spaceList`)

**中间栏布局**:
```
┌─────────────────────────────────┐
│  🔍 搜索空间...          [✕]    │  搜索栏
├─────────────────────────────────┤
│  [全部] [我的] [公开]           │  筛选条
├─────────────────────────────────┤
│  我的空间                        │
│  [头像] 开发团队  12房间  5成员  │
│  [头像] 产品组    8房间   3成员  │
│  公开空间                        │
│  [头像] 开源社区  公开  100+成员 │
├─────────────────────────────────┤
│  [创建空间] [发现空间]          │  底部快捷操作
└─────────────────────────────────┘
```

**按钮功能清单**:

| 按钮 | 位置 | API 端点 | 交互逻辑 |
|------|------|----------|----------|
| 搜索空间 | 中间栏搜索栏 | `GET /spaces/search` | **右侧栏 search 视图**展示结果 |
| 创建空间 | 中间栏底部 / 右侧栏 | `POST /spaces` | **右侧栏 createSpace 视图**：空间名+描述+可见性 |
| 查看详情 | 中间栏单击 | `GET /spaces/{space_id}` | **右侧栏 details 视图**显示空间详情 |
| 进入聊天 | 右侧栏 details | — | 统一"进入聊天"按钮，**右侧栏切换 chat 视图** |
| 加入空间 | 右侧栏 details | `POST /spaces/{space_id}/join` | 点击加入按钮 |
| 离开空间 | 右侧栏 details | `POST /spaces/{space_id}/leave` | **确认弹窗**后离开 |
| 删除空间 | 右侧栏 details | `DELETE /spaces/{space_id}` | **确认弹窗**后删除（仅创建者） |
| 编辑空间 | 右侧栏 details | `PUT /spaces/{space_id}` | **内联编辑**空间信息 |
| 查看成员 | 右侧栏 details | `GET /spaces/{space_id}/members` | **右侧栏内嵌成员列表区** |
| 邀请成员 | 右侧栏 details | `POST /spaces/{space_id}/invite` | **右侧栏内嵌邀请表单** |
| 查看子房间 | 右侧栏 details | `GET /spaces/{space_id}/children` | **右侧栏内嵌房间列表区** |
| 添加子房间 | 右侧栏 details | `POST /spaces/{space_id}/children` | **右侧栏内嵌选择列表** |
| 移除子房间 | 右侧栏 details | `DELETE /spaces/{space_id}/children/{room_id}` | **确认弹窗**后移除 |
| 查看层级 | 右侧栏 details | `GET /spaces/{space_id}/hierarchy` | **右侧栏内嵌树形视图** |

#### 4.3.2 组件清单

| 组件 | 路径 | 状态 | 说明 |
|------|------|------|------|
| SpaceList | `views/homeWindow/SpaceList.vue` | ✅ 保留 | 空间列表视图（中间栏） |
| SpaceListItemCard | `components/workbench/SpaceListItemCard.vue` | ✅ 保留 | 空间列表项（含离开/删除按钮） |
| SpaceListPane | `components/workbench/SpaceListPane.vue` | ✅ 保留 | 空间列表面板 |
| HulaSpaceTree | `components/workbench/HulaSpaceTree.vue` | ✅ 保留 | 空间树形视图 |
| HulaSpaceJoinCta | `components/workbench/HulaSpaceJoinCta.vue` | ✅ 保留 | 加入空间引导 |

---

## 5. 交互逻辑规范

### 5.1 列表项交互

| 操作 | 行为 | 适用范围 | 实现方式 |
|------|------|----------|----------|
| 单击 | 右侧栏切换到 details 视图 | 好友/房间/空间 | mitt `DETAILS_SHOW` 事件 |
| 双击 | 直接进入聊天 | 好友/房间/空间 | 调用 `enterChat()` 跳转 |
| 右键 | 显示上下文菜单 | 好友/房间/空间 | n-dropdown 上下文菜单 |
| hover | 显示快速操作按钮 | 好友/房间/空间 | CSS hover 显示操作图标 |

### 5.2 统一"进入聊天"按钮规范

**核心原则**: 所有聊天入口统一为"进入聊天"按钮，点击后右侧栏切换到 `chat` 视图（ChatBox），**禁止弹窗展示聊天界面**。空间场景使用"进入空间"按钮，按子房间数量智能跳转。

```
┌──────────────────────────────────────────────────┐
│  进入聊天/进入空间按钮统一规范                       │
├──────────────────────────────────────────────────┤
│                                                    │
│  【好友/房间场景】按钮文案: "进入聊天"               │
│  按钮图标: #message SVG                             │
│  按钮样式: 主色填充, 圆角 8px, 高度 36px             │
│  按钮位置: details 视图操作按钮区第一个               │
│                                                    │
│  点击行为:                                          │
│  1. 调用 openMsgSession() 创建/复用会话              │
│  2. 设置 globalStore.currentSessionRoomId           │
│  3. 路由跳转到 /message/{roomId}                    │
│  4. 右侧栏视图通过路由派生自动切换到 'chat'           │
│                                                    │
│  适用场景:                                          │
│  - 好友详情: "进入聊天" (替代原"发消息")              │
│  - 房间详情: "进入聊天" (替代原"进入聊天")            │
│  - 搜索结果: 点击结果项直接进入聊天                   │
│  - 好友申请: 接受后自动进入聊天                       │
│                                                    │
│  【空间场景】按钮文案: "进入空间"                     │
│  按钮图标: #space SVG                               │
│  点击行为: 智能跳转（见下方空间进入逻辑）              │
│                                                    │
└──────────────────────────────────────────────────┘
```

**空间"进入空间"按钮智能跳转逻辑**:

空间是容器，包含多个子房间，后端无"默认聊天室"概念。根据子房间数量智能跳转：

```typescript
const enterSpace = async (spaceId: string) => {
  // 1. 获取空间的子房间列表
  const children = await spaceService.getChildren(spaceId)

  // 2. 根据子房间数量智能跳转
  if (children.length === 0) {
    // 空空间: 进入 spaceChildren 视图，显示空状态 + 创建子房间按钮
    await router.push(`/space/${spaceId}`)
  } else if (children.length === 1) {
    // 单子房间: 直接进入该子房间的 chat 视图
    await router.push(`/message/${children[0].roomId}`)
  } else {
    // 多子房间: 进入 spaceChildren 视图，展示子房间列表
    await router.push(`/space/${spaceId}`)
  }
}
```

**spaceChildren 视图内容**:
- 顶部: 空间名称 + 成员数
- 列表: 子房间卡片（房间名、未读数、最后一条消息）
- 底部: "创建子房间"按钮
- 点击子房间卡片 → 进入该房间的 chat 视图 (`/message/{roomId}`)

**实现代码规范**:
```typescript
// 统一的进入聊天函数（好友/房间）
const enterChat = async (targetId: string, targetType: 'friend' | 'room') => {
  // 1. 创建或复用会话
  const roomId = await openMsgSession(targetId, targetType)
  // 2. 设置当前会话
  globalStore.currentSessionRoomId = roomId
  // 3. 路由跳转，右侧栏视图通过路由派生自动切换
  await router.push(`/message/${roomId}`)
}

// 进入空间（非聊天）
const enterSpace = async (spaceId: string) => {
  await router.push(`/space/${spaceId}`)
}
```

### 5.2.5 路由设计（路由为单一真相源）

路由是右侧栏视图状态的唯一来源，视图从路由派生，不反向更新。

**路由结构**:

| 路由路径 | 右侧栏视图 | 说明 |
|----------|-----------|------|
| `/` | empty | 默认空状态 |
| `/friend` | empty | 好友列表（中间栏） |
| `/friend/{userId}` | details | 好友详情 |
| `/friend/add` | addFriend | 添加好友表单 |
| `/friend/requests` | applyList | 好友申请列表 |
| `/room` | empty | 房间列表 |
| `/room/{roomId}` | details | 房间详情 |
| `/room/create` | createRoom | 创建房间表单 |
| `/room/join` | joinRoom | 加入房间表单 |
| `/space` | empty | 空间列表 |
| `/space/{spaceId}` | spaceChildren | 空间子房间列表 |
| `/space/create` | createSpace | 创建空间表单 |
| `/message/{roomId}` | chat | 聊天界面 |
| `/search?q={query}` | search | 全局搜索结果 |
| `/window/chat/{roomId}` | chat（独立窗口） | 独立聊天窗口（与主窗口隔离） |

**路由 ↔ 视图双向同步规范**:

1. **路由 → 视图（单向派生）**: 右侧栏视图通过 `computed` 从路由派生，不维护独立状态
2. **视图切换 → 路由更新（通过 router.push）**: 所有视图切换通过 `router.push()` 触发，视图自动跟随路由变化
3. **浏览器后退/前进**: 使用 `router.back()` / `router.forward()`，视图自动跟随
4. **草稿保护**: 被动事件（新消息/新请求）不触发路由跳转，只更新角标，避免打断用户当前操作

### 5.3 右侧栏视图切换状态机（路由为单一真相源）

**核心原则**: 路由是状态的唯一来源，视图状态从路由派生，不维护自定义视图历史栈（用 Vue Router 管理）。

```typescript
// 右侧栏视图类型
type RightViewType =
  | 'empty'          // 空状态
  | 'details'        // 详情面板
  | 'search'         // 全局搜索结果
  | 'addFriend'      // 添加好友
  | 'createRoom'     // 创建房间
  | 'joinRoom'       // 加入房间
  | 'createSpace'    // 创建空间
  | 'applyList'      // 好友申请列表
  | 'spaceChildren'  // 空间子房间列表（新增）
  | 'chat'           // 聊天界面

// 视图从路由派生（单向，不反向更新）
const rightView = computed<RightViewType>(() => {
  const route = useRoute()
  const path = route.path

  // 聊天视图
  if (path.startsWith('/message/')) return 'chat'
  // 空间子房间视图
  if (path.startsWith('/space/') && route.params.spaceId) return 'spaceChildren'
  // 全局搜索视图
  if (path === '/search') return 'search'
  // 表单视图
  if (path === '/friend/add') return 'addFriend'
  if (path === '/room/create') return 'createRoom'
  if (path === '/room/join') return 'joinRoom'
  if (path === '/space/create') return 'createSpace'
  if (path === '/friend/requests') return 'applyList'
  // 详情视图
  if (path.startsWith('/friend/') && route.params.userId) return 'details'
  if (path.startsWith('/room/') && route.params.roomId && !path.includes('/create')) return 'details'
  // 默认空状态
  return 'empty'
})

// 视图切换通过 router.push（不直接修改状态）
const switchView = (view: RightViewType, params?: Record<string, string>) => {
  const routeMap: Record<RightViewType, string> = {
    empty: '/friend',
    chat: `/message/${params?.roomId}`,
    spaceChildren: `/space/${params?.spaceId}`,
    search: `/search?q=${params?.query ?? ''}`,
    addFriend: '/friend/add',
    createRoom: '/room/create',
    joinRoom: '/room/join',
    createSpace: '/space/create',
    applyList: '/friend/requests',
    details: params?.userId
      ? `/friend/${params.userId}`
      : `/room/${params?.roomId}`,
  }
  router.push(routeMap[view])
}
```

**用户主动操作优先原则**（被动事件不抢占视图）:

| 事件类型 | 行为 | 说明 |
|----------|------|------|
| 新消息到来 | 仅更新中间栏列表项未读 badge + 消息预览 | **不抢占当前视图**，用户点击列表项后才 `router.push` |
| 新好友请求 | 仅更新"好友请求"按钮角标数字 | **不抢占当前视图**，用户点击角标后才 `router.push('/friend/requests')` |
| 用户点击列表项 | `router.push` 切换到 details | 用户主动操作，正常切换 |
| 用户点击"进入聊天" | `router.push` 切换到 chat | 用户主动操作，正常切换 |
| 用户点击角标 | `router.push` 切换到对应视图 | 用户主动操作，正常切换 |

**草稿保护**: 路由切换会触发视图切换。被动事件（新消息/新请求）不抢占视图，因此不会丢失用户正在填写的表单。用户主动切换时，表单草稿通过决策 4 的草稿持久化保留。

### 5.4 上下文菜单项

**好友右键菜单**:
- 进入聊天（主操作，加粗）
- 加密聊天
- 语音通话
- 视频通话
- ──── 分隔线 ────
- 设置备注
- 设为收藏/取消收藏
- 屏蔽好友/取消屏蔽
- ──── 分隔线 ────
- 删除好友（危险色）

**房间右键菜单**:
- 进入聊天（主操作，加粗）
- 视频通话
- ──── 分隔线 ────
- 邀请成员
- 修改房间信息
- 设置可见性
- ──── 分隔线 ────
- 离开房间
- 忘记房间（危险色）

**空间右键菜单**:
- 进入聊天（主操作，加粗）
- ──── 分隔线 ────
- 编辑空间
- 邀请成员
- 管理子房间
- ──── 分隔线 ────
- 离开空间
- 删除空间（危险色）

### 5.5 确认弹窗规范（仅限危险操作）

**保留弹窗的场景**（仅危险操作）:
- 删除好友
- 删除空间
- 离开房间 / 离开空间
- 忘记房间
- 踢出 / 封禁成员
- 移除子房间

**弹窗规范**:
- 标题: 操作名称（如"删除好友"）
- 内容: 描述操作后果（如"确定要删除张三吗？删除后将无法恢复"）
- 按钮: 取消（默认） + 确认（危险色 `--hula-color-danger-500`）
- 实现: `window.$dialog.create()`

### 5.6 操作反馈规范

| 操作类型 | 成功反馈 | 失败反馈 |
|----------|----------|----------|
| 创建/添加 | Toast success + 列表刷新 + 右侧栏切回 details | Toast error |
| 修改/更新 | Toast success + 详情刷新 | Toast error |
| 删除/移除 | Toast success + 列表刷新 + 右侧栏切回 empty | Toast error |
| 进入聊天 | 右侧栏切换 chat 视图 | Toast error |
| 网络请求 | Loading 状态 | Toast error + 重试按钮 |

### 5.7 内联编辑规范

所有可编辑字段（备注、显示名、房间名等）采用**内联编辑**模式，不弹窗:

```
┌──────────────────────────────────────┐
│  备注                    [编辑]       │  ← 查看态
│  好友备注内容                         │
└──────────────────────────────────────┘

         ↓ 点击 [编辑]

┌──────────────────────────────────────┐
│  备注                   [取消]        │  ← 编辑态
│  ┌──────────────────────────────┐    │
│  │ 好友备注内容|                 │    │  ← 输入框 + 自动聚焦
│  └──────────────────────────────┘    │
│              [确认] (loading)         │
└──────────────────────────────────────┘
```

---

## 6. 组件设计要求

### 6.1 通用组件规范

1. **SVG 图标**: 所有图标必须使用内联 SVG，禁止使用 div 模拟图标
2. **内联样式**: 组件内 CSS 必须使用 `<style scoped>`，公共样式使用 SCSS 变量
3. **无外部资源**: 禁止引用外部 CDN 资源
4. **响应式**: 组件必须适配窄屏（240px）和宽屏（360px）模式
5. **无障碍**: 关键操作按钮必须有 `aria-label`，列表使用 `<ul>/<li>` 语义化标签
6. **懒加载**: 头像图片必须使用 `loading="lazy"` + fallback 默认头像
7. **虚拟滚动**: 列表超过 100 项必须使用虚拟滚动（如 `vue-virtual-scroller`）
8. **骨架屏**: 数据加载时必须显示骨架屏，禁止白屏或 spinner 居中

### 6.2 列表项组件规范

```vue
<template>
  <!-- 语义化 HTML: 使用 li 而非 div -->
  <li class="list-item" :class="{ 'list-item--active': isActive }" @click="handleClick">
    <n-avatar :src="avatar" :size="40" loading="lazy" :fallback-src="'/logoD.png'" />
    <div class="list-item__content">
      <div class="list-item__header">
        <span class="list-item__name">{{ name }}</span>
        <time class="list-item__time" :datetime="isoTime">{{ time }}</time>
      </div>
      <div class="list-item__footer">
        <span class="list-item__preview">{{ preview }}</span>
        <n-badge v-if="unread > 0" :value="unread" />
      </div>
    </div>
  </li>
</template>

<style scoped>
.list-item {
  display: grid;
  grid-template-columns: 40px 1fr;  /* Discord 式 grid: avatar 固定 + content 自适应 */
  gap: 12px;
  padding: 8px 12px;
  cursor: pointer;
  transition: background 0.15s ease;

  &:hover { background: var(--hula-surface-list-hover); }
  &--active {
    background: var(--hula-surface-list-selected);
    border-left: 3px solid var(--hula-color-primary);
  }
}
</style>
```

### 6.3 右侧栏面板组件规范

```vue
<template>
  <div class="right-pane">
    <!-- ActionBar -->
    <div class="right-pane__actionbar">
      <button class="right-pane__back" @click="emit('back')">
        <svg><use href="#arrow-left" /></svg>
      </button>
      <h3 class="right-pane__title">{{ title }}</h3>
      <div class="right-pane__actions">
        <slot name="actions" />
      </div>
    </div>
    <!-- 内容区 -->
    <div class="right-pane__body">
      <slot />
    </div>
  </div>
</template>
```

### 6.4 "进入聊天"按钮规范

```vue
<template>
  <button class="enter-chat-btn" type="button" @click="handleEnterChat">
    <svg class="size-16px">
      <use href="#message" />
    </svg>
    <span>{{ t('chat.enter') }}</span>
  </button>
</template>

<style scoped>
.enter-chat-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  height: 36px;
  border: 0;
  border-radius: 8px;
  background: var(--hula-color-primary);
  color: var(--hula-text-inverse);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: var(--hula-color-primary-600);
  }

  &:active {
    transform: scale(0.98);
  }
}
</style>
```

### 6.5 聊天消息布局规范（Discord 式 grid）

借鉴 Discord 的消息 grid 布局，头像固定宽度，内容自适应：

```vue
<template>
  <!-- 消息行: avatar 40px + content 1fr -->
  <div class="message-row" :class="{ 'message-row--own': isOwn }">
    <n-avatar :src="avatar" :size="40" class="message-row__avatar" loading="lazy" />
    <div class="message-row__content">
      <div class="message-row__header">
        <span class="message-row__name" :style="{ color: nameColor }">{{ name }}</span>
        <time class="message-row__time" :datetime="isoTime">{{ formattedTime }}</time>
      </div>
      <div class="message-row__body" v-html="renderedContent" />
      <!-- 消息操作按钮组 (hover 显示) -->
      <div class="message-row__actions">
        <button class="msg-action-btn" aria-label="点赞">👍</button>
        <button class="msg-action-btn" aria-label="回复">↩</button>
        <button class="msg-action-btn" aria-label="更多">⋯</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.message-row {
  display: grid;
  grid-template-columns: 40px 1fr;  /* Discord 式: 固定头像列 + 自适应内容列 */
  gap: 12px;
  padding: 4px 16px;
  position: relative;
  transition: background 0.1s ease;

  &:hover {
    background: rgba(0, 0, 0, 0.04);  /* Discord 式 hover 高亮 */
    .message-row__actions { opacity: 1; }
  }
}

.message-row__actions {
  position: absolute;
  right: 16px;
  top: -12px;
  opacity: 0;  /* 默认隐藏，hover 显示 */
  transition: opacity 0.15s ease;
  background: var(--hula-surface-panel);
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.msg-action-btn {
  border: 0;
  background: transparent;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  &:hover { background: var(--hula-surface-list-hover); }
}
</style>
```

**消息时间戳智能格式化**:
```typescript
function formatMessageTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  const date = new Date(timestamp)

  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}分钟前`
  if (isToday(date)) return format(date, 'HH:mm')
  if (isYesterday(date)) return '昨天 HH:mm'
  if (diff < 7 * 86_400_000) return format(date, 'EEEE HH:mm')  // 本周
  return format(date, 'yyyy/MM/dd HH:mm')
}
```

### 6.6 图标 hover 变形规范（Discord squircle → circle）

所有可点击的图标按钮采用 Discord 式 squircle → circle hover 变形：

```scss
// 通用图标按钮 mixin
@mixin squircle-to-circle($size: 40px, $bg-hover: var(--hula-color-primary)) {
  width: $size;
  height: $size;
  border-radius: 25%;          /* 默认: 圆角方形 (squircle) */
  display: grid;
  place-items: center;
  transition: border-radius 0.15s ease, background 0.15s ease;
  cursor: pointer;

  &:hover {
    border-radius: 50%;        /* hover: 圆形 */
    background: $bg-hover;
  }

  &--active {
    border-radius: 50%;
    background: $bg-hover;
  }
}

// 导航栏图标 (24px)
.nav-icon { @include squircle-to-circle(40px); }

// 列表项操作图标 (16px)
.list-action-icon { @include squircle-to-circle(28px, var(--hula-surface-list-hover)); }

// 消息操作图标 (20px)
.msg-action-icon { @include squircle-to-circle(32px, var(--hula-surface-list-hover)); }
```

### 6.7 语义化 HTML 规范

借鉴微信 PC 端的无障碍最佳实践，所有组件必须使用语义化 HTML：

| 场景 | ❌ 错误用法 | ✅ 正确用法 |
|------|-----------|-----------|
| 页面头部 | `<div class="header">` | `<header role="banner">` |
| 主内容区 | `<div class="main">` | `<main role="main">` |
| 导航区 | `<div class="nav">` | `<nav role="navigation" aria-label="主导航">` |
| 列表 | `<div class="list">` | `<ul><li>` 或 `<ol><li>` |
| 列表项 | `<div class="item">` | `<li>` |
| 时间 | `<span class="time">14:30</span>` | `<time datetime="2026-07-26T14:30">14:30</time>` |
| 标题 | `<div class="title">好友详情</div>` | `<h3>好友详情</h3>` |
| 按钮 | `<div class="btn" @click="...">` | `<button type="button">` |
| 图标按钮 | `<div class="icon">` | `<button aria-label="搜索">` |
| 表单 | `<div class="form">` | `<form>` + `<label>` |
| 输入框 | `<div class="input">` | `<input aria-label="用户名">` |
| 分隔线 | `<div class="divider">` | `<hr>` |
| 侧边栏 | `<div class="sidebar">` | `<aside role="complementary">` |

**无障碍属性要求**:
- 所有图标按钮必须有 `aria-label`
- 导航区域必须有 `role="navigation"` + `aria-label`
- 列表必须有 `role="list"`，列表项必须有 `role="listitem"`
- 动态内容更新必须有 `aria-live="polite"`
- 加载状态必须有 `aria-busy="true"`
- 模态框必须有 `role="dialog"` + `aria-modal="true"`

---

## 7. 冗余组件清理计划

### 7.1 已删除的组件

| 组件 | 原因 | 状态 |
|------|------|------|
| `FriendDetailDrawer.vue` | 已废弃，被 Details.vue 替代 | ✅ 已删除 |
| `HulaFriendListItem.vue` | 与 FriendListItem.vue 功能重复 | ✅ 已删除 |
| `FriendItemActions.vue` | 操作按钮已整合到 Details.vue | ✅ 已删除 |

### 7.2 需改造为右侧栏内嵌面板的弹窗组件

| 组件 | 改造方案 | 优先级 |
|------|----------|--------|
| `AddFriendDialog.vue` | 改为右侧栏 addFriend 视图内嵌面板 | P0 |
| `FriendRequestDialog.vue` | 改为右侧栏 applyList 视图（复用 ApplyList.vue） | P0 |
| `FriendGroupDialog.vue` | 改为右侧栏 details 视图内嵌分组管理区 | P1 |
| `CreateRoomDialog.vue` | 改为右侧栏 createRoom 视图内嵌面板 | P0 |
| `JoinRoomDialog.vue` | 改为右侧栏 joinRoom 视图内嵌面板 | P0 |
| `CreateSpaceDialog` | 改为右侧栏 createSpace 视图内嵌面板 | P0 |

### 7.3 表单草稿持久化规范（决策 4）

弹窗改为内嵌面板后，用户切换视图时表单数据需要保留，避免丢失。

**草稿存储**（Pinia store，会话级别，非 localStorage）:

```typescript
// stores/domains/widget/rightViewDraft.ts
interface FormData {
  addFriend: { userId: string; message: string }
  createRoom: { name: string; description: string; visibility: 'public' | 'private'; encrypted: boolean }
  joinRoom: { roomIdOrAlias: string }
  createSpace: { name: string; description: string; visibility: 'public' | 'private' }
}

const drafts = ref<FormData>({
  addFriend: { userId: '', message: '' },
  createRoom: { name: '', description: '', visibility: 'private', encrypted: false },
  joinRoom: { roomIdOrAlias: '' },
  createSpace: { name: '', description: '', visibility: 'private' },
})

// 自动同步: 表单输入时通过 watch 自动同步到 draft store
// 恢复机制: 进入表单视图时从 draft store 恢复数据
```

**清除时机**:
- 表单提交成功后清除对应 draft
- 用户手动点击"清空"按钮
- **不在视图切换时清除**（保留草稿）

**UI 提示**:
- 如果表单有未提交的草稿数据，进入表单视图时显示"已恢复上次编辑内容"提示条
- 提示条 3 秒后自动消失

**退出保护**（可选增强）:
- 表单有数据且用户尝试切换视图时，显示轻量确认条"有未保存的内容，切换后将保留草稿"
- 3 秒后自动消失，不阻塞操作

### 7.4 需评估的组件

| 组件 | 评估点 |
|------|--------|
| `WorkbenchActivityPane.vue` | 是否有实际使用场景 |
| `WorkbenchForwardPane.vue` | 是否与转发功能重复 |
| `WorkbenchHistoryPane.vue` | 是否与聊天历史重复 |
| `WorkbenchMergedMsgPane.vue` | 是否与合并消息重复 |
| `WorkbenchPaneTabs.vue` | 是否有实际使用场景 |

---

## 8. 功能实现标准

### 8.1 API 调用规范

所有 API 调用必须通过 L2 服务层进行，禁止在组件中直接构造 HTTP 请求：

```typescript
// ✅ 正确：通过服务层
const contactStore = useContactStore()
await contactStore.startDirectRoom(userId, true)

// ❌ 错误：直接 fetch
fetch('/_matrix/client/v3/friends', { ... })
```

### 8.2 错误处理规范

```typescript
try {
  await contactStore.removeFriend(userId)
  showFeedback(t('friend.detail.remove_success'), 'success')
} catch (error) {
  const translated = translateMatrixError(error, { context: 'friend' })
  showFeedback(t(translated.userMessage), 'error')
}
```

### 8.3 加载状态规范

```vue
<n-button :loading="savingNote" :disabled="!noteValue.trim()" @click="handleSaveNote">
  {{ t('common.confirm') }}
</n-button>
```

### 8.4 权限控制

- 创建者才能编辑/删除房间和空间
- 管理员才能踢出/封禁成员
- 普通成员只能查看和离开
- 权限通过 `power_level` 判断

### 8.5 进入聊天实现规范

```typescript
// src/composables/chat/useEnterChat.ts
import { useGlobalStore } from '@/stores/domains/widget/global'
import { useContactStore } from '@/stores/domains/chat/contacts'
import router from '@/router'

export function useEnterChat() {
  const globalStore = useGlobalStore()
  const contactStore = useContactStore()

  const enterChat = async (targetId: string, targetType: 'friend' | 'room' | 'space') => {
    let roomId = targetId

    if (targetType === 'friend') {
      // 好友：创建或复用 DM 房间
      roomId = await contactStore.startDirectRoom(targetId, false)
    }
    // room 和 space 直接使用 targetId

    globalStore.currentSessionRoomId = roomId
    await router.push('/message')
  }

  return { enterChat }
}
```

---

## 9. 兼容性要求

### 9.1 浏览器兼容
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

### 9.2 平台兼容
- **桌面端**: Windows 10+ / macOS 11+ / Ubuntu 20.04+ (Tauri)
- **移动端**: Android 8+ / iOS 14+ (Tauri Mobile)
- **Web 端**: 现代浏览器（降级模式，无 Tauri 运行时）

### 9.3 Tauri 环境守卫

所有 Tauri 专属 API 调用必须使用 `hasTauriRuntime()` 守卫：

```typescript
import { hasTauriRuntime } from '@/utils/AppHarness'

if (hasTauriRuntime()) {
  await createWebviewWindow(title, label, width, height)
} else {
  await router.push('/target-route')
}
```

### 9.4 深色模式

所有组件必须支持深色模式，通过 CSS 变量自动适配：

```scss
.component {
  background: var(--hula-surface-panel);
  color: var(--hula-text-primary);
}

[data-theme='dark'] {
  .component {
    // 深色模式特定样式
  }
}
```

---

## 10. 测试要求

### 10.1 单元测试
- 每个组件必须有对应的 `__tests__/` 测试文件
- 测试覆盖率不低于 80%
- 关键交互逻辑（按钮点击、API 调用）必须测试

### 10.2 集成测试
- MSW 契约测试验证 URL 构造
- 验证组件与服务层的集成

### 10.3 E2E 测试
- Playwright 测试覆盖关键用户流程
- 登录 → 好友操作 → 房间操作 → 空间操作

---

## 11. 交付物清单

| 交付物 | 路径 | 状态 |
|--------|------|------|
| 需求文档 | `.trae/documents/前端UI界面项目需求文档.md` | ✅ 本文档 (v2.0) |
| 冗余组件清理 | `src/components/friend/` | ✅ 已完成 |
| 空间管理按钮完善 | `src/components/workbench/SpaceListItemCard.vue` | ✅ 已完成 |
| 弹窗转内嵌面板改造 | `src/components/friend/`, `src/components/workbench/` | 🔄 待实施 |
| 统一进入聊天按钮 | `src/composables/chat/useEnterChat.ts` | 🔄 待实施 |
| 右侧栏视图状态机 | `src/layout/right/index.vue` | 🔄 待实施 |
| 功能测试报告 | `.trae/documents/功能测试报告.md` | 待更新 |

---

## 12. 界面布局图

### 12.1 完整三栏布局图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ⚙ HuLa                                          ─  □  ✕                    │ ActionBar (窗口控制)
├──────┬──────────────────────────┬────────────────────────────────────────────┤
│      │                          │                                            │
│  💬  │  🔍 搜索好友...    [✕]   │  ← 好友详情                        ⋯      │
│      │                          │                                            │
│  👥  ├──────────────────────────┤                                            │
│      │  [全部] [在线] [收藏]    │                                            │
│  🏠  │                          │              [头像 148px]                  │
│      │  ▼ 全部好友 (12)         │                                            │
│  🌐  │   [头像] 张三  在线      │                张三                         │
│      │   [头像] 李四  离线      │              @zhangsan:matrix.test         │
│  📊  │   [头像] 王五  在线      │                                            │
│      │                          │         "这个人很懒，什么都没留下"          │
│      │  ▼ 收藏 (3)              │                                            │
│      │   [头像] 赵六  在线      │           [在线] [密友]                    │
│      │                          │                                            │
│      │                          │       最后活跃: 5分钟前                     │
│      │                          │                                            │
│      │                          │   ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐   │
│      │                          │   │进入   │ │加密   │ │语音   │ │视频   │   │
│      │                          │   │聊天   │ │聊天   │ │通话   │ │通话   │   │
│      │                          │   └──────┘ └──────┘ └──────┘ └──────┘   │
│      │                          │                                            │
│      │                          │   备注                          [编辑]    │
│      │                          │   ┌──────────────────────────────────┐   │
│      │                          │   │ 好友备注内容                      │   │
│      │                          │   └──────────────────────────────────┘   │
│      │                          │                                            │
│      │                          │   显示名                        [编辑]    │
│      │                          │   ┌──────────────────────────────────┐   │
│      │                          │   │ 显示名内容                        │   │
│      │                          │   └──────────────────────────────────┘   │
│      │                          │                                            │
│      │                          │   好友状态                                 │
│      │                          │   [设为收藏] [设为普通] [屏蔽好友]         │
│      │                          │                                            │
│      │  [添加好友] [好友请求🔴3] │   ┌──────────────────────────────────┐   │
│      │                          │   │         删除好友 (危险)           │   │
│      │                          │   └──────────────────────────────────┘   │
│  64px│     240-360px            │           flex:1 (min 600px)              │
└──────┴──────────────────────────┴────────────────────────────────────────────┘
```

### 12.2 右侧栏视图切换图

```
                    ┌─────────────────┐
                    │     empty       │ ← 初始空状态
                    │  (未选择会话)    │
                    └────────┬────────┘
                             │
            ┌────────────────┼────────────────────┐
            │                │                    │
     列表项单击        搜索栏输入            底部按钮点击
            │                │                    │
            ▼                ▼                    ▼
     ┌──────────┐    ┌──────────┐    ┌──────────────────────┐
     │ details  │    │  search  │    │ addFriend            │
     │ (详情)   │    │ (搜索)   │    │ createRoom           │
     └────┬─────┘    └────┬─────┘    │ joinRoom             │
          │               │          │ createSpace          │
          │               │          │ applyList            │
          │               │          └──────────┬───────────┘
          │               │                     │
          │               │     ┌───────────────┘
          │               │     │
          ▼               ▼     ▼
     ┌──────────────────────────────┐
     │         chat (聊天)          │ ← 点击"进入聊天"按钮
     │       ChatBox 渲染            │
     └──────────────────────────────┘
```

---

## 13. 交互流程图

### 13.1 好友管理完整流程

```
用户点击"好友"导航
        │
        ▼
┌──────────────────┐
│ 中间栏: 好友列表  │ ← 加载好友列表 GET /friends
└────────┬─────────┘
         │
    ┌────┼────────────────┬─────────────────┐
    │    │                │                 │
    ▼    ▼                ▼                 ▼
 单击好友  双击好友    点击"添加好友"    点击"好友请求"
    │    │                │                 │
    ▼    ▼                ▼                 ▼
 右侧栏   进入聊天       右侧栏            右侧栏
 details  (chat视图)    addFriend         applyList
    │                    │                 │
    │                    ▼                 ▼
    │                 输入用户ID        接受/拒绝
    │                 +验证消息         POST /accept
    │                 POST /friends       │
    │                    │                 ▼
    │                    ▼              刷新申请列表
    │                 刷新好友列表         │
    │                    │                 ▼
    │                    └─────→ 自动进入聊天
    │
    ├─→ 点击"进入聊天" → 进入聊天 (chat视图)
    ├─→ 点击"加密聊天" → 创建加密房间 → 进入聊天
    ├─→ 点击"语音/视频" → Tauri 独立窗口
    ├─→ 内联编辑备注 → PUT /friends/{uid}/note → 刷新详情
    ├─→ 内联编辑显示名 → PUT /friends/{uid}/displayname → 刷新详情
    ├─→ 切换状态 → PUT /friends/{uid}/status → 刷新详情
    ├─→ 管理分组 → 右侧栏内嵌分组区 → GET/POST /friends/groups
    └─→ 删除好友 → 确认弹窗 → DELETE /friends/{uid} → 刷新列表
```

### 13.2 房间管理完整流程

```
用户点击"房间"导航
        │
        ▼
┌──────────────────┐
│ 中间栏: 房间列表  │ ← 加载房间列表 GET /user/{uid}/rooms
└────────┬─────────┘
         │
    ┌────┼────────────────┬─────────────────┐
    │    │                │                 │
    ▼    ▼                ▼                 ▼
 单击房间  双击房间    点击"创建房间"    点击"加入房间"
    │    │                │                 │
    ▼    ▼                ▼                 ▼
 右侧栏   进入聊天       右侧栏            右侧栏
 details  (chat视图)    createRoom        joinRoom
    │                    │                 │
    │                    ▼                 ▼
    │                 填写房间信息       输入房间ID
    │                 POST /createRoom    POST /rooms/{id}/join
    │                    │                 │
    │                    ▼                 ▼
    │                 刷新房间列表       刷新房间列表
    │                    │                 │
    │                    └─────→ 自动进入聊天
    │
    ├─→ 点击"进入聊天" → 进入聊天 (chat视图)
    ├─→ 点击"视频通话" → Tauri 独立窗口
    ├─→ 查看成员 → 右侧栏内嵌成员列表 → GET /rooms/{id}/members
    ├─→ 邀请成员 → 右侧栏内嵌邀请表单 → POST /rooms/{id}/invite
    ├─→ 内联编辑房间名 → PUT /rooms/{id}/state/m.room.name/
    ├─→ 离开房间 → 确认弹窗 → POST /rooms/{id}/leave → 刷新列表
    └─→ 忘记房间 → 确认弹窗 → POST /rooms/{id}/forget → 刷新列表
```

### 13.3 空间管理完整流程

```
用户点击"空间"导航
        │
        ▼
┌──────────────────┐
│ 中间栏: 空间列表  │ ← 加载空间列表 GET /spaces/user
└────────┬─────────┘
         │
    ┌────┼────────────────┬─────────────────┐
    │    │                │                 │
    ▼    ▼                ▼                 ▼
 单击空间  双击空间    点击"创建空间"    点击"发现空间"
    │    │                │                 │
    ▼    ▼                ▼                 ▼
 右侧栏   进入聊天       右侧栏            右侧栏
 details  (chat视图)    createSpace       search
    │                    │                 (公开空间)
    │                    ▼                 │
    │                 填写空间信息          ▼
    │                 POST /spaces       加入空间
    │                    │                 POST /spaces/{id}/join
    │                    ▼                 │
    │                 刷新空间列表          ▼
    │                    │               刷新空间列表
    │                    └─────→ 自动进入聊天
    │
    ├─→ 点击"进入聊天" → 进入聊天 (chat视图)
    ├─→ 查看成员 → 右侧栏内嵌成员列表 → GET /spaces/{id}/members
    ├─→ 邀请成员 → 右侧栏内嵌邀请表单 → POST /spaces/{id}/invite
    ├─→ 查看子房间 → 右侧栏内嵌房间列表 → GET /spaces/{id}/children
    ├─→ 添加子房间 → 右侧栏内嵌选择列表 → POST /spaces/{id}/children
    ├─→ 查看层级 → 右侧栏内嵌树形视图 → GET /spaces/{id}/hierarchy
    ├─→ 内联编辑空间 → PUT /spaces/{id}
    ├─→ 离开空间 → 确认弹窗 → POST /spaces/{id}/leave → 刷新列表
    └─→ 删除空间 → 确认弹窗 → DELETE /spaces/{id} → 刷新列表
```

---

## 14. 关键状态设计说明

### 14.1 空状态设计

| 场景 | 视觉表现 | 文案 |
|------|----------|------|
| 未选择会话 | 居中 SVG 图标 + 描述文字 | "选择一个会话或发起新聊天" |
| 好友列表为空 | 居中加好友图标 + 引导按钮 | "还没有好友，去添加吧" |
| 房间列表为空 | 居中创建房间图标 + 引导按钮 | "还没有房间，去创建吧" |
| 空间列表为空 | 居中创建空间图标 + 引导按钮 | "还没有空间，去创建吧" |
| 搜索无结果 | 居中搜索图标 + 描述文字 | "未找到匹配结果" |
| 好友申请为空 | 居中申请图标 + 描述文字 | "暂无好友申请" |

### 14.2 加载状态设计

| 场景 | 视觉表现 |
|------|----------|
| 列表加载 | 骨架屏（Skeleton）3-5 个列表项占位 |
| 详情加载 | 头像骨架 + 名称骨架 + 操作按钮骨架 |
| 搜索中 | 搜索框内 loading 图标旋转 |
| 按钮提交 | 按钮内 loading 图标 + 禁用状态 |
| 进入聊天 | 全屏 loading 覆盖层 + 进度百分比 |

### 14.3 错误状态设计

| 场景 | 视觉表现 | 操作 |
|------|----------|------|
| 网络错误 | 居中错误图标 + 错误描述 + 重试按钮 | 点击重试重新请求 |
| 权限不足 | 居中锁图标 + 权限说明 | 无操作，仅提示 |
| 房间不存在 | 居中 404 图标 + 描述 + 返回按钮 | 点击返回列表 |
| API 请求失败 | Toast 错误提示（顶部） | 自动消失，可手动关闭 |

### 14.4 选中状态设计

| 元素 | 选中态 | hover 态 |
|------|--------|----------|
| 列表项 | 背景 `--hula-surface-list-selected` + 左侧 3px 主色竖线 | 背景 `--hula-surface-list-hover` |
| 筛选标签 | 填充主色 + 白色文字 | 描边主色 + 主色文字 |
| 操作按钮 | 主色填充 + 白色文字 | 主色加深 10% |
| 导航项 | 左侧 3px 竖线 + 背景高亮 | 背景轻微高亮 |
| 搜索结果项 | 背景 `--hula-surface-list-selected` | 背景 `--hula-surface-list-hover` |

### 14.5 拖拽调整状态设计

| 状态 | 视觉表现 |
|------|----------|
| 默认 | 分隔条透明，不可见 |
| hover | 分隔条区域显示拖拽图标（14px 宽，60px 高） |
| 拖拽中 | 全局 `cursor: col-resize`，分隔条高亮显示 |
| 拖拽结束 | 宽度持久化到 settingStore，分隔条淡出 |

### 14.6 收缩模式状态设计

当视口宽度不足以同时显示三栏时，中间栏自动收缩为窄模式：

| 状态 | 中间栏 | 右侧栏 |
|------|--------|--------|
| 正常模式 | 280px，显示完整列表 | flex:1，显示详情/聊天 |
| 窄模式 | 240px，列表项紧凑 | flex:1，显示详情/聊天 |
| 收缩模式 | 64px，仅显示图标 | 全屏展开，显示详情/聊天 |
| 隐藏模式 | 隐藏 | 全屏展开，显示详情/聊天 |

---

## 15. 视觉设计规范

### 15.1 色彩深度体系（Discord 式渐进变浅）

#### 15.1.1 浅色模式

| 层级 | 区域 | 背景色 | 文字色 | 用途 |
|------|------|--------|--------|------|
| L0 | 导航栏 | `#F3F3F3` | `#2B2B2B` | 最深，聚焦导航 |
| L1 | 中间栏 | `#F7F7F7` | `#333333` | 中等，聚焦列表 |
| L2 | 右侧栏 | `#FFFFFF` | `#1A1A1A` | 最浅，聚焦内容 |
| L3 | 弹出层 | `#FFFFFF` + shadow | `#1A1A1A` | 浮于最上层 |

#### 15.1.2 深色模式

| 层级 | 区域 | 背景色 | 文字色 | 用途 |
|------|------|--------|--------|------|
| L0 | 导航栏 | `#1E1F22` | `#DBDEE1` | 最深（Discord 式） |
| L1 | 中间栏 | `#2B2D31` | `#DBDEE1` | 中等 |
| L2 | 右侧栏 | `#313338` | `#DBDEE1` | 最浅 |
| L3 | 弹出层 | `#383A40` | `#DBDEE1` | 浮于最上层 |

### 15.2 Liquid Glass 玻璃质感（Telegram 2026 式）

#### 15.2.1 应用场景

| 场景 | 模糊半径 | 透明度 | 饱和度 |
|------|----------|--------|--------|
| 详情面板头部 | 20px | 85% | 180% |
| 搜索结果面板 | 16px | 90% | 150% |
| 确认弹窗背景 | 24px | 80% | 200% |
| 工具提示 | 12px | 95% | 120% |

#### 15.2.2 实现规范

```scss
// 玻璃质感 mixin
@mixin liquid-glass($blur: 20px, $opacity: 0.85, $saturate: 1.8) {
  background: color-mix(in srgb, var(--hula-surface-panel) #{$opacity * 100}%, transparent);
  backdrop-filter: blur(#{$blur}) saturate(#{$saturate * 100}%);
  -webkit-backdrop-filter: blur(#{$blur}) saturate(#{$saturate * 100}%);
  border: 1px solid color-mix(in srgb, var(--hula-border-layout-divider) 50%, transparent);
}
```

#### 15.2.3 性能约束
- `backdrop-filter` 仅用于面板级别（≤3 个元素/视图）
- 列表项、消息行禁止使用 `backdrop-filter`
- 低性能设备（检测 `navigator.hardwareConcurrency < 4`）降级为纯色背景

### 15.3 动效规范

#### 15.3.1 过渡动画

| 场景 | 属性 | 时长 | 缓动函数 |
|------|------|------|----------|
| 列表项 hover | background | 0.15s | ease |
| 图标 hover 变形 | border-radius | 0.15s | ease |
| 视图切换 | opacity + transform | 0.2s | ease-out |
| 弹窗出现 | opacity + scale | 0.2s | cubic-bezier(0.4, 0, 0.2, 1) |
| 侧边栏展开/收起 | width | 0.25s | cubic-bezier(0.4, 0, 0.2, 1) |
| 消息发送 | opacity + translateY | 0.15s | ease-out |
| 未读 badge 出现 | scale | 0.2s | cubic-bezier(0.34, 1.56, 0.64, 1) |

#### 15.3.2 微交互

| 交互 | 效果 | 实现 |
|------|------|------|
| 按钮点击 | scale(0.98) | `transform: scale(0.98)` |
| 图标 hover | squircle → circle | `border-radius: 25% → 50%` |
| 头像 hover | 圆角变化 | `border-radius: 50% → 25%` |
| 消息 hover | 背景微亮 + 操作按钮出现 | `background + opacity` |
| 列表项拖拽 | 阴影 + 缩放 | `box-shadow + scale(1.02)` |

#### 15.3.3 动画性能
- 优先使用 `transform` 和 `opacity`（GPU 加速）
- 避免动画 `width`/`height`/`top`/`left`（触发重排）
- 复杂动画使用 `will-change: transform` 提示浏览器
- 移动端禁用非必要动画（`prefers-reduced-motion`）

```scss
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 16. 性能优化规范

### 16.1 列表性能

| 场景 | 优化方案 | 实现方式 |
|------|----------|----------|
| 好友列表 > 100 项 | 虚拟滚动 | `vue-virtual-scroller` RecycleScroller |
| 房间列表 > 100 项 | 虚拟滚动 + 分页加载 | 滚动到底部加载下一页（20 项/页） |
| 空间树 > 50 节点 | 懒加载子节点 | 展开时才请求子空间数据 |
| 消息列表 > 500 条 | 虚拟滚动 + 双向加载 | 向上加载历史，向下保持最新 |

### 16.2 图片性能

| 场景 | 优化方案 |
|------|----------|
| 头像加载 | `loading="lazy"` + fallback `logoD.png` |
| 头像缓存 | Service Worker 缓存 + IndexedDB 离线 |
| 大图查看 | 点击打开独立 Tauri 窗口，非模态弹窗 |
| 图片压缩 | 上传前 Tauri 原生压缩（quality 0.8） |
| 缩略图 | 列表用 40px 缩略图，详情用原图 |

### 16.3 数据加载

| 场景 | 优化方案 |
|------|----------|
| 首屏加载 | 骨架屏 + 并行请求（Promise.all） |
| 列表数据 | 分页加载 + 本地缓存（Pinia persist） |
| 详情数据 | 按需加载（单击时才请求详情） |
| 搜索结果 | 300ms 防抖 + 取消上次请求（AbortController） |
| 消息同步 | Sliding Sync 增量同步 |

### 16.4 渲染性能

| 场景 | 优化方案 |
|------|----------|
| 频繁更新 | `shallowRef` + 手动触发更新 |
| 大列表 | `v-memo` 缓存列表项渲染 |
| 计算属性 | 昂贵计算用 `computed` + 缓存 |
| 事件防抖 | 搜索输入 300ms 防抖，滚动 16ms 节流 |
| 组件卸载 | `onUnmounted` 清理定时器和事件监听 |

---

## 17. 无障碍设计规范

### 17.1 键盘导航

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+F` | 聚焦搜索框 |
| `Esc` | 清空搜索 / 关闭弹窗 / 返回上一视图 |
| `↑` / `↓` | 列表项上下移动 |
| `Enter` | 选中列表项 / 发送消息 |
| `Tab` / `Shift+Tab` | 焦点切换 |
| `Ctrl+Enter` | 换行（消息输入框） |
| `Alt+←` | 返回上一视图 |

### 17.2 ARIA 属性

```vue
<!-- 导航栏 -->
<nav role="navigation" aria-label="主导航">
  <ul role="list">
    <li role="listitem">
      <button aria-label="好友" :aria-current="isActive ? 'page' : undefined">
        <svg aria-hidden="true"><use href="#friend" /></svg>
      </button>
    </li>
  </ul>
</nav>

<!-- 列表区 -->
<main role="main" aria-label="好友列表" aria-busy="loading">
  <ul role="list">
    <li role="listitem" :aria-selected="isSelected">
      <!-- 列表项内容 -->
    </li>
  </ul>
</main>

<!-- 详情面板 -->
<aside role="complementary" aria-label="好友详情">
  <button aria-label="返回" @click="goBack">
    <svg aria-hidden="true"><use href="#arrow-left" /></svg>
  </button>
</aside>

<!-- 加载状态 -->
<div role="status" aria-live="polite" aria-busy="true">
  <span class="sr-only">正在加载...</span>
</div>

<!-- 确认弹窗 -->
<div role="dialog" aria-modal="true" aria-labelledby="dialog-title">
  <h2 id="dialog-title">删除好友</h2>
</div>
```

### 17.3 对比度标准

所有文字必须满足 WCAG AA 对比度标准（≥4.5:1）：

| 文字类型 | 浅色模式对比度 | 深色模式对比度 |
|----------|---------------|---------------|
| 主文本 | ≥7:1 (AAA) | ≥7:1 (AAA) |
| 次要文本 | ≥4.5:1 (AA) | ≥4.5:1 (AA) |
| 辅助文本 | ≥3:1 (AA Large) | ≥3:1 (AA Large) |
| 按钮文字 | ≥4.5:1 (AA) | ≥4.5:1 (AA) |
| 链接文字 | ≥4.5:1 (AA) | ≥4.5:1 (AA) |

### 17.4 焦点管理

- 所有可交互元素必须有可见的焦点轮廓（`outline: 2px solid var(--hula-color-primary)`）
- 弹窗打开时焦点移至弹窗内第一个可交互元素
- 弹窗关闭时焦点返回触发元素
- Tab 顺序必须符合视觉顺序（左到右、上到下）

```scss
// 焦点样式
*:focus-visible {
  outline: 2px solid var(--hula-color-primary);
  outline-offset: 2px;
}

// 隐藏非键盘聚焦的轮廓
*:focus:not(:focus-visible) {
  outline: none;
}
```

---

## 附录 A: 弹窗 vs 内嵌决策矩阵

| 功能 | 原实现 | 优化后 | 原因 |
|------|--------|--------|------|
| 添加好友 | n-modal 弹窗 | 右侧栏内嵌面板 | 表单内容简单，无需遮罩 |
| 好友请求 | n-modal 弹窗 | 右侧栏内嵌（ApplyList） | 列表型内容，适合滚动浏览 |
| 创建房间 | n-modal 弹窗 | 右侧栏内嵌面板 | 表单内容中等，无需遮罩 |
| 加入房间 | n-modal 弹窗 | 右侧栏内嵌面板 | 输入简单，无需遮罩 |
| 创建空间 | n-modal 弹窗 | 右侧栏内嵌面板 | 表单内容中等，无需遮罩 |
| 分组管理 | n-modal 弹窗 | 右侧栏内嵌分组区 | 管理型内容，适合内嵌 |
| 删除好友 | 确认弹窗 | **保留弹窗** | 危险操作，需遮罩强调 |
| 离开房间 | 确认弹窗 | **保留弹窗** | 危险操作，需遮罩强调 |
| 删除空间 | 确认弹窗 | **保留弹窗** | 危险操作，需遮罩强调 |
| 设置备注 | 弹窗 | **内联编辑** | 简单文本，内联最自然 |
| 设置显示名 | 弹窗 | **内联编辑** | 简单文本，内联最自然 |
| 修改房间名 | 弹窗 | **内联编辑** | 简单文本，内联最自然 |

## 附录 B: 可扩展性预留

| 预留位置 | 用途 | 实现方式 |
|----------|------|----------|
| 右侧栏 RightViewType | 新增视图类型 | 扩展联合类型 + 添加视图组件 |
| 中间栏底部快捷操作 | 新增快捷功能 | 扩展操作按钮组 |
| 上下文菜单 | 新增菜单项 | 扩展菜单配置数组 |
| 筛选条 | 新增筛选维度 | 扩展筛选标签数组 |
| 导航栏 | 新增导航项 | 扩展导航配置 |

---

## 附录 C: 多窗口策略（决策 8）

**核心原则**: 主窗口退让 + 独立窗口自治

### C.1 主窗口退让策略

当用户将聊天"拖出"到独立窗口时，主窗口右侧栏**自动返回上一个视图**（`router.back()`），不再显示该聊天，避免双窗口数据同步问题。

### C.2 独立窗口自治

每个独立聊天窗口是自包含的，拥有独立的：
- Matrix client 实例（共享 SDK 但独立 EventEmitter 订阅）
- 消息列表状态
- 输入框草稿
- 已读状态

### C.3 窗口间通信

使用 Tauri 的 `emit`/`listen` 事件系统同步状态：

```typescript
// 独立窗口通知主窗口
emit('chat:opened-independently', { roomId, windowId })
emit('chat:unread-updated', { roomId, unreadCount })
emit('chat:closed', { roomId })

// 主窗口监听
listen('chat:unread-updated', (event) => {
  updateUnreadBadge(event.payload.roomId, event.payload.unreadCount)
})

// 独立窗口处于焦点状态时，主窗口对应列表项不显示未读
```

### C.4 独立窗口生命周期

| 阶段 | 行为 |
|------|------|
| 创建 | 用户在 chat 视图点击"在新窗口打开"按钮（图标: 方框带箭头） |
| 焦点 | 独立窗口获得焦点，主窗口对应列表项不显示未读 badge |
| 后台 | 独立窗口收到新消息时，通过 `emit` 通知主窗口更新未读数 |
| 关闭 | 用户关闭独立窗口 → `emit('chat:closed')` 通知主窗口 → 主窗口不自动切回 chat |
| 重复打开 | 用户再次点击"在新窗口打开"同一聊天 → 焦点切换到已存在的独立窗口，不重复创建 |

### C.5 独立窗口路由

独立聊天窗口使用独立路由，与主窗口路由隔离：
- 主窗口聊天路由: `/message/{roomId}`
- 独立窗口路由: `/window/chat/{roomId}`
- 两者互不影响，各自维护独立的 Vue Router 实例

### C.6 触发入口

"在新窗口打开"按钮位置:
- chat 视图 ActionBar 右侧（图标: 方框带箭头）
- details 视图操作按钮区（好友/房间详情）
- 中间栏列表项右键菜单（"在新窗口打开"）
