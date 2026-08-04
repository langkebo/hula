# TJG（天机阁）UI 界面需求文档

> **版本**: 2.0  
> **日期**: 2026-08-02  
> **项目**: TJG（天机阁）— Greenfield 前端重构  
> **项目目录**: `/Users/ljf/Desktop/hu_ts/tjg/`（全新项目，替代 HuLa）  
> **后端项目**: synapse-rust (`/Users/ljf/Desktop/hu_ts/synapse-rust`)  
> **SDK 项目**: matrix-js-sdk v40.2.0 (`/Users/ljf/Desktop/hu_ts/matrix-js-sdk`，100+ Manager 类)  
> **技术栈**: Vue 3 + Tauri 2 + TypeScript + Vite + Pinia  
> **设计系统**: Compound Design System + TJG Design Tokens  
> **视觉参考**: 截图原型（TJG 桌面端三栏布局）  
> **架构决策**: [ADR-003 TJG Greenfield 重构](file:///Users/ljf/Desktop/hu_ts/docs/adr/ADR-003-tjg-greenfield-rewrite.md)  
> **术语表**: [TJG 术语表](file:///Users/ljf/Desktop/hu_ts/docs/glossary/tjg-glossary.md)  
> **优化依据**: [UI-UX优化方案.md](file:///Users/ljf/Desktop/hu_ts/docs/UI-UX优化方案.md)、[UI优化对比分析.md](file:///Users/ljf/Desktop/hu_ts/docs/UI优化对比分析.md)

---

## 更新日志

### v2.0 (2026-08-02) — TJG Greenfield 重构
- 🔄 **品牌变更**: HuLa → TJG（天机阁），全新 greenfield 项目
- 🆕 **§0 连接可靠性与初始化架构**: 乐观渲染 + 后台同步（永不白屏）
- 🆕 **§0.1 初始化状态机**: 六状态连接状态机 + 超时降级规范
- 🆕 **§0.2 自动恢复策略**: 指数退避重连 + 429 容错 + 离线模式
- 🆕 **§0.3 SDK Manager 使用规范**: 三层架构 + 反模式禁止清单
- 📄 **ADR-003**: 记录 TJG 重构决策
- 📄 **术语表**: 统一项目术语定义
- ✅ 保留 v1.3 全部 UI 视觉规范和功能模块设计

### v1.3 (2026-08-02)
- ✅ 补充三栏布局最终效果规范（1.3.7）：布局自适应规则、技术约束、视觉层次
- ✅ 增强粘性事件横幅 UI 设计（3.2.11）：折叠/展开态、权限控制、实时同步
- ✅ 新增公共房间目录浏览 UI（3.2.18）：搜索、过滤、分页、联邦服务器选择
- ✅ 新增房间级消息保留策略 UI（3.2.19）：管理员配置、二次确认、风险提示
- ✅ 新增访客模式入口与引导 UI（3.1.5）：登录页入口、横幅提示、权限限制
- ✅ 新增三 PID 管理面板 UI（3.8.3）：邮箱/手机号绑定、UIA 验证、脱敏显示
- ✅ 新增私密聊天模式 UI（3.13.6）：S 入口、阅后即焚、防截屏、双端适配
- ✅ 新增功能模块管理 UI（3.10.13）：模块列表、状态过滤、详情抽屉
- ✅ 新增审核工作台 UI（3.10.14）：举报队列、批量操作、事件预览
- ✅ 新增骨架屏覆盖扩展规范（5.4.5）：4 种变体、shimmer 动画、CLS 约束
- ✅ 新增空状态插图规范（8.3.1）：4 核心场景 SVG 插图 + 引导操作
- ✅ 新增按钮涟漪反馈规范（6.7）：v-ripple 指令、prefers-reduced-motion
- ✅ 新增创建房间流程分阶段（6.8）：5 步缩减为 2 步、默认加密
- ✅ 新增设置页快速搜索（6.9）：搜索索引、Ctrl+, 快捷键
- ✅ 新增好友搜索即时展示（6.10）：防抖、高亮匹配、不改变 URL
- ✅ 新增中间栏宽度持久化（4.3.4）：240-360px 拖拽、跨重启保持
- ✅ 新增移动端横屏双栏适配（4.3.5）：视口判断、keep-alive 缓存

### v1.2 (2026-07-29)
- ✅ 补充截图原型视觉规范（三栏布局配色、间距、组件样式）
- ✅ 补充聊天区渐变背景规范
- ✅ 补充会话列表选中态圆角卡片样式
- ✅ 补充左侧导航栏图标布局规范
- ✅ 补充消息输入区工具栏图标顺序

### v1.1 (2026-07-31)
- ✅ 补充聊天界面顶部工具栏图标顺序说明
- ✅ 补充单聊/群聊右侧栏显示规则
- ✅ 添加 HTTP 迁移至 SDK Manager 状态
- ✅ 优化目录结构，添加术语表
- ✅ 补充响应式断点详细说明

### v1.0 (2026-07-24)
- 🎉 初始版本发布
- ✅ 完整设计规范定义
- ✅ 功能模块界面设计
- ✅ 响应式适配要求
- ✅ 可访问性规范

---

## 目录

0. [连接可靠性与初始化架构](#0-连接可靠性与初始化架构v20-核心章节) ⭐ v2.0 核心
1. [项目概述](#1-项目概述)
2. [术语表](#2-术语表)
3. [设计规范](#3-设计规范)
4. [功能模块界面设计](#4-功能模块界面设计)
5. [响应式设计要求](#5-响应式设计要求)
6. [组件规范](#6-组件规范)
7. [交互细节](#7-交互细节)
8. [页面跳转与导航逻辑](#8-页面跳转与导航逻辑)
9. [特殊场景处理](#9-特殊场景处理)
10. [可访问性要求](#10-可访问性要求)
11. [附录](#11-附录)

---

## 0. 连接可靠性与初始化架构（v2.0 核心章节）

> **决策依据**: [ADR-003 TJG Greenfield 重构](file:///Users/ljf/Desktop/hu_ts/docs/adr/ADR-003-tjg-greenfield-rewrite.md)  
> **核心原则**: **永不白屏** — 乐观渲染 + 后台同步  
> **解决痛点**: HuLa 登录阶段连接不稳定（白屏、初始化挂起、token 过期无恢复）

### 0.1 初始化状态机：乐观渲染 + 后台同步

#### 0.1.1 设计原则

TJG 初始化流程与 HuLa 的关键区别：

| 维度 | HuLa（串行阻塞） | TJG（乐观渲染） |
|------|------------------|-----------------|
| **UI 渲染时机** | 等待全部初始化完成 | 立即用缓存数据渲染（< 100ms） |
| **初始化失败** | 白屏 | 显示缓存数据 + 错误横幅 |
| **Token 过期** | 白屏 | 清除 token + 跳登录页（仅无缓存数据时） |
| **网络断开** | 白屏 | 离线模式（只读浏览历史消息） |
| **Tauri 命令阻塞** | 永久阻塞 | 3s 超时跳过 |

#### 0.1.2 初始化流程

```
用户打开应用
    ↓
┌─ 有缓存会话数据？─┐
│ Yes              │ No
↓                  ↓
乐观渲染主界面      显示登录页
（用 chatStore    （无缓存数据
 持久化数据）       需要认证）
    ↓                  ↓
后台异步：          用户登录
1. 读 token         ↓
2. createClient    认证成功
3. loginWithToken   ↓
4. startClient      创建 client
5. waitSyncPrepared  ↓
    ↓               startClient
┌─ 成功？─┐         ↓
│ Yes    │ No      waitSyncPrepared
↓        ↓             ↓
静默更新  显示状态横幅   渲染主界面
Pinia    "正在重连"    （乐观渲染）
store    ↓
         指数退避
         重连
```

#### 0.1.3 超时与降级规范

| 操作 | 超时 | 降级策略 |
|------|------|---------|
| Tauri 命令（resizeWindow 等） | 3s | 超时跳过，记录 warn 日志，不阻塞初始化 |
| `waitForClientReady` | 30s | 超时显示"连接超时"横幅，允许手动重试 |
| `waitSyncPrepared` | 15s | 超时用缓存数据渲染，后台继续同步 |
| `restoreWithAccessToken` | 10s | 失败清除 token，跳登录页（仅无缓存数据时） |
| SDK HTTP 请求 429 | 指数退避 3 次（1s→2s→4s） | 退避后仍失败则排队，不丢弃请求 |
| Sliding Sync 首次同步 | 60s | 超时降级为传统 /sync |

#### 0.1.4 乐观渲染数据源

| 数据 | 来源 | 持久化方式 |
|------|------|-----------|
| 会话列表 | `chatStore.sessionList` | Pinia `persist: true` → localStorage |
| 当前用户信息 | `userStore.userInfo` | Pinia `persist: true` → localStorage |
| 好友列表 | `contactStore.friendList` | Pinia `persist: true` → localStorage |
| 房间列表 | `groupStore.roomList` | Pinia `persist: true` → localStorage |
| 设置项 | `settingStore.settings` | Pinia `persist: true` → localStorage |

**约束**: 所有 Pinia store 使用 `persist: true` 确保数据跨重启可用。乐观渲染时使用缓存数据，sync 完成后静默覆盖。

### 0.2 连接状态机与自动恢复

#### 0.2.1 六状态连接状态机

```
DISCONNECTED → CONNECTING → CONNECTED → SYNCING → CATCHUP → SYNCED
     ↑              ↓            ↓          ↓         ↓
     ←────────── ERROR ←───────────────────────────┘
```

| 状态 | 触发条件 | UI 表现 | 自动行为 |
|------|---------|---------|---------|
| **DISCONNECTED** | 应用启动 / 网络断开 / 未登录 | 离线图标 | 有缓存数据则乐观渲染 |
| **CONNECTING** | `createClient` + `loginWithToken` 调用中 | "正在连接..." 横幅 | 10s 超时 → ERROR |
| **CONNECTED** | `client.startClient()` 已调用 | "正在同步..." 横幅 | 等待首次 sync 事件 |
| **SYNCING** | 首次 `syncState = SYNCING` | "正在同步消息..." 横幅 | 等待 `PREPARED` |
| **CATCHUP** | 离线重连后 `syncState = CATCHUP` | "正在同步历史消息..." 横幅 | 追赶历史事件 |
| **SYNCED** | `syncState = PREPARED` | 正常界面（横幅消失） | 实时接收事件 |
| **ERROR** | 连接错误 / 401 / 超时 | "连接失败，正在重连..." 横幅 | 指数退避重连 |

#### 0.2.2 自动恢复策略

**指数退避重连**:

```
重试 1: 等待 1s
重试 2: 等待 2s
重试 3: 等待 4s
重试 4: 等待 8s
重试 5: 等待 16s
重试 6+: 等待 30s（上限）
```

- **重连条件**: 网络恢复事件 / 用户手动点击"重试"
- **重连步骤**: `stopClient()` → `createClient(token)` → `startClient()` → 等待 `PREPARED`
- **放弃条件**: access_token 明确 401（需重新登录）

**429 限流容错**:

- SDK HTTP 请求遇到 429 时，自动指数退避重试 3 次（尊重 `retry_after_ms` 响应头）
- POST 请求（如 media upload）同样重试，不丢弃
- 重试失败后请求进入队列，sync 恢复后自动发送

**Token 生命周期**:

| 场景 | 行为 |
|------|------|
| access_token 有效 | 正常请求 |
| access_token 401 + 有缓存数据 | 显示"会话已过期"横幅 + 跳登录页 |
| access_token 401 + 无缓存数据 | 立即跳登录页 |
| 网络断开 | 离线模式（只读），不跳登录页 |

#### 0.2.3 ConnectionStatusBanner 组件规格

- **位置**: 主界面顶部，`GuestModeBanner` 下方
- **高度**: 32px（折叠态）/ 48px（展开态含重试按钮）
- **背景**: `--hula-color-warning-100`（连接中）/ `--hula-color-danger-100`（错误）
- **文案**: 国际化 key `connection.status.*`
- **操作**: "重试"按钮（仅 ERROR 状态显示）
- **动画**: `slide-down` 过渡（`--hula-motion-duration-normal` 200ms）

### 0.3 SDK Manager 使用规范

#### 0.3.1 三层架构

```
┌─────────────────────────────────────────────┐
│  TJG 业务组件（views / components / stores）  │
├─────────────────────────────────────────────┤
│  L2 服务层（tjg/src/services/matrix/）        │
│  包装 SDK Manager，添加类型安全和错误处理       │
├─────────────────────────────────────────────┤
│  L1 SDK 层（matrix-js-sdk/src/）              │
│  100+ Manager 类，不修改                      │
├─────────────────────────────────────────────┤
│  后端（synapse-rust）                         │
└─────────────────────────────────────────────┘
```

| 层 | 目录 | 职责 | 规则 |
|----|------|------|------|
| **L1 (SDK)** | `matrix-js-sdk/src/` | 提供 Manager 类 | TJG **不修改**此层代码 |
| **L2 (服务)** | `tjg/src/services/matrix/` | 包装 SDK Manager | 添加类型安全、错误处理、缓存 |
| **L3 (路径)** | `tjg/src/services/matrix/paths/` | URL 常量 | **仅常量定义**，严禁 HTTP 调用 |

#### 0.3.2 L2 服务层规范

- **命名**: `Matrix{Domain}Service.ts`（如 `MatrixRoomService.ts`、`MatrixFriendService.ts`）
- **职责**: 调用 SDK Manager 方法 + 错误处理 + 数据转换
- **禁止**: L2 服务不得直接使用 `client.http.authedRequest`（必须通过 SDK Manager）
- **禁止**: L2 服务不得包含 URL 路径拼接（使用 L3 路径常量）

#### 0.3.3 反模式禁止清单

| # | 反模式 | 说明 | TJG 对策 |
|---|--------|------|---------|
| 1 | **双重状态源** | HuLa 同时用 `currentUserState.ts`（module ref）和 `useUserStore`（Pinia） | **统一 Pinia store**，禁止 module-level ref |
| 2 | **Worker 直接 fetch** | HuLa Web Worker 绕过 SDK 直接 fetch（P-083） | **所有 HTTP 必须通过 SDK Manager** |
| 3 | **无超时异步** | HuLa `resizeWindow` 无超时导致阻塞 | **所有 Tauri 命令 3s 超时**，所有异步有超时 |
| 4 | **串行初始化白屏** | HuLa 初始化任一步失败即白屏 | **乐观渲染 + 每步 catch + 降级** |
| 5 | **命名混淆** | HuLa 将 paths/ 称为"SDK 路径契约" | **paths/ 仅称"路径常量层"** |
| 6 | **直接 HTTP 调用** | HuLa 用 `client.http.authedRequest` 绕过 Manager | **必须通过 SDK Manager 方法调用** |
| 7 | **无 fallback 动态导入** | HuLa 异步组件加载失败永久遮罩 | **try/finally + ErrorComponent** |

#### 0.3.4 SDK Manager 调用示例

```typescript
// ✅ 正确：通过 L2 服务调用 SDK Manager
class MatrixRoomService {
  async createRoom(params: CreateRoomParams): Promise<Room> {
    const client = this.matrixClientService.getClient()
    const manager = client.getRoomManager()  // SDK Manager
    return manager.createRoom(params)        // 类型安全
  }
}

// ❌ 错误：直接 HTTP 调用（反模式 #6）
class MatrixRoomService {
  async createRoom(params: CreateRoomParams) {
    const client = this.matrixClientService.getClient()
    return client.http.authedRequest('POST', '/createRoom', ...)  // 禁止
  }
}

// ❌ 错误：双重状态源（反模式 #1）
const currentUserState = ref(null)  // module-level ref，禁止
// 应统一使用 useUserStore()
```

### 0.4 验收标准

| # | 验收项 | 标准 |
|---|--------|------|
| 1 | **永不白屏** | 任何初始化失败场景下 UI 始终可见（缓存数据或错误横幅） |
| 2 | **Token 过期恢复** | 401 时显示"会话过期"横幅，3s 后跳登录页，不白屏 |
| 3 | **网络断开恢复** | 断网显示离线横幅，恢复后自动重连，sync 正常 |
| 4 | **429 限流容错** | 429 自动退避重试，用户无感知 |
| 5 | **Tauri 命令超时** | 所有 Tauri 命令 3s 超时，超时不阻塞初始化 |
| 6 | **状态单一源** | 全局状态仅 Pinia store，无 module-level ref |
| 7 | **SDK Manager 调用** | L2 服务 100% 通过 SDK Manager 调用，无直接 HTTP |
| 8 | **连接状态可见** | ConnectionStatusBanner 在非 SYNCED 状态显示 |

---

## 1. 项目概述

### 1.1 背景

TJG（天机阁）是一款基于 Matrix 协议的跨平台即时通讯客户端，后端采用 synapse-rust（Rust 实现），前端采用 Vue 3 + Tauri 框架，支持 Windows / macOS / Linux 桌面端和 iOS / Android 移动端。TJG 是 HuLa 项目的 Greenfield 重构版本，核心改进是连接可靠性架构（§0）。

### 1.2 目标

- 为 synapse-rust 后端的所有功能模块提供完整的 UI 界面设计需求
- 确保界面风格与 hula 已有设计规范保持一致
- 参考 element-hq/element-web 的成熟 UI 模式，提升用户体验
- 覆盖 PC 端和移动端的双端适配要求

### 1.3 截图原型视觉规范（v1.2 新增）

以下规范基于 HuLa 桌面端截图原型，作为 UI 优化的视觉参考标准。

#### 1.3.1 整体布局

```
┌──────────────────────────────────────────────────────────────────┐
│  Left Sidebar  │  Center Panel (会话列表)  │  Right Panel (聊天) │
│  (teal 色)     │  (白色背景)               │  (渐变背景)         │
│  64-68px       │  ~320px                   │  flex-1             │
│                │                           │                     │
│  HuLa Logo     │  搜索框 + 添加按钮         │  聊天头部工具栏      │
│  用户头像       │  ────────────            │  ─────────────      │
│  ─────────     │  会话列表项                │  消息时间线          │
│  消息图标       │  - 头像 + 名称             │  (空状态:           │
│  好友图标       │  - 最后消息预览             │   "没有更多消息")   │
│  火焰图标       │  - 时间戳                  │                     │
│  AI 图标        │  - 未读徽章                │  ─────────────      │
│  加号图标       │                           │  输入工具栏          │
│                │                           │  文本输入区          │
│  ─────────     │                           │  发送按钮            │
│  文件夹图标     │                           │                     │
│  书签图标       │                           │                     │
│  菜单图标       │                           │                     │
└──────────────────────────────────────────────────────────────────┘
```

#### 1.3.2 三栏配色方案

| 区域 | 背景色 | 说明 |
|------|--------|------|
| **左侧导航栏** | `#64a29c` (teal) | 纯色背景，图标为白色/半透明白色 |
| **中间会话列表** | `#ffffff` (纯白) | 白色背景，会话项为圆角卡片 |
| **右侧聊天区** | 渐变背景 | 从粉紫 `rgba(255,209,255,0.3)` 到浅青 `rgba(130,193,187,0.3)` |

#### 1.3.3 左侧导航栏详细规范

- **背景**: `#64a29c`（teal 色，对应 `--hula-brand-sidebar`）
- **Logo 文字**: "HuLa"，白色，`font-size: 16px`，`font-weight: 600`，位于顶部
- **用户头像**: 圆形 40px，带绿色在线状态点，位于 Logo 下方
- **导航图标**: 垂直排列，间距 8px，图标尺寸 24px，颜色白色
  - 消息（对话气泡图标）
  - 好友（人物图标）
  - 火焰（热门/动态图标）
  - AI（螺旋/机器人图标）
  - 加号（添加图标）
- **底部图标**: 文件夹、书签、菜单（三条横线），间距 8px
- **未读徽章**: 红色圆形，白色数字，位于图标右上角

#### 1.3.4 中间会话列表详细规范

- **顶部搜索栏**: 圆角搜索框，灰色背景 `#f0f0f0`，高度 32px，带放大镜图标
- **添加按钮**: 搜索框右侧圆形 `+` 按钮，灰色背景
- **会话列表项**:
  - 选中态: teal 色圆角矩形卡片（`border-radius: 12px`），背景 `#4ecdc4` 渐变
  - 未选中态: 白色背景，无卡片
  - 头像: 圆形 40px
  - 名称: `font-size: 15px`，`font-weight: 600`，白色（选中）/ 黑色（未选中）
  - 最后消息: `font-size: 13px`，白色 70% 透明度（选中）/ 灰色（未选中）
  - 时间戳: `font-size: 12px`，右对齐
  - 未读徽章: 红色圆形，白色数字
- **间距**: 会话项之间间距 4px

#### 1.3.5 右侧聊天区详细规范

- **背景**: 径向渐变 `radial-gradient(circle at top left, rgba(255,209,255,0.3) 20%, rgba(130,193,187,0.3) 100%)`
- **聊天头部**:
  - 头像: 圆形 36px
  - 名称: `font-size: 16px`，`font-weight: 600`
  - 关系标签: 粉色心形图标 + "我crush了" 文字，`font-size: 13px`
  - 工具栏按钮: 圆形 28px，灰色边框，图标 18px
    - 语音通话（电话图标）
    - 视频通话（摄像头图标）
    - 发起会议（屏幕共享图标）
    - 群二维码（二维码图标）
    - 更多选项（三点图标）
- **消息区域**:
  - 空状态: "没有更多消息"，居中，灰色文字
  - 消息气泡: 圆角矩形，不对称圆角
- **输入区域**:
  - 工具栏图标: 表情、剪刀、文件夹、图片、麦克风、定位，间距 12px
  - 文本输入区: placeholder "善言一句暖人心，恶语一句伤人心"，灰色
  - 发送按钮: teal 色圆角矩形，白色文字 "发送" + 下拉箭头

#### 1.3.6 关键设计 Token 调整建议

| Token | 当前值 | 建议值 | 说明 |
|-------|--------|--------|------|
| `--hula-surface-sidebar` | `#f3f3f3` | `#64a29c` | 左侧导航栏改为 teal 色 |
| `--hula-surface-session-active` | `linear-gradient(135deg, #4ecdc4 0%, #3db8a8 100%)` | 保持 | 选中会话卡片已匹配 |
| `--right-theme-bg-color` | 已定义渐变 | 保持 | 右侧聊天区渐变已匹配 |
| `--hula-radius-lg` | `12px` | 保持 | 会话选中卡片圆角 |

#### 1.3.7 三栏布局最终效果规范（v1.3 新增）

> **来源**: [UI优化对比分析.md](file:///Users/ljf/Desktop/hu_ts/docs/UI优化对比分析.md) §10 三栏布局修复

**布局自适应规则**:

| 视图状态 | 左侧栏 | 中间栏 | 右侧栏 |
|---------|--------|--------|--------|
| **未选中会话** | 64px, teal `#64a29c` | 320px, 白色 `#ffffff` | 360px, 浅灰 `#f1f1f1`（固定宽度） |
| **选中会话（聊天）** | 64px, teal `#64a29c` | 320px, 白色 `#ffffff` | flex-1 自适应剩余空间, 渐变背景 |
| **shrink 模式（<1024px）** | 64px, teal | 64px | flex-1 全屏 |

**关键技术约束**:
- 中间栏必须设置 `bg-[--center-bg-color]` 确保白色背景，避免透明导致视觉层次混乱
- 中间栏默认宽度 320px（`settingStore.panelWidth.left = 320`），可拖拽调整 240-360px
- 右侧栏在聊天视图使用 `flex-1` 自适应（`isChatFlexMode = shouldShowChat && !isShrink`），其他视图使用固定宽度（`useRightPaneWidth` 视图驱动）
- 右侧栏非聊天视图隐藏拖拽分隔条（`v-if="!isRightPaneFullscreen && !isChatFlexMode"`）

**三栏视觉层次**:
```
优化后: L0 teal (#64a29c) → L1 白色 (#ffffff) → L2 渐变 (粉紫→浅青)
        层次区分强，三栏视觉递进清晰，品牌一致性高
```

### 1.4 后端功能模块总览

synapse-rust 后端的路由模块分为三个层级：

| 层级 | 模块 | Feature Flag |
|------|------|-------------|
| **L0 核心** | account_data, admin, app_service, auth, captcha, device, directory, dm, e2ee, ephemeral, event_report, feature_flags, federation, guest, invite_blocklist, key_backup, key_rotation, media, moderation, oidc, pinned, presence, push, push_notification, push_rules, qr_login, reactions, relations, rendezvous, room, room_summary, sliding_sync, space, state, sticky_event, sync, tags, telemetry, thirdparty, threepid, typing, verification_routes, worker | 默认启用 |
| **L1 标准** | voip | 默认启用 |
| **L3 扩展** | ai_connection, openclaw, friend_room, voice, saml, cas, widget, burn_after_read, external_service | 按需启用 |

---

## 2. 术语表

| 术语 | 英文 | 说明 |
|------|------|------|
| 单聊 | DM (Direct Message) | 一对一私密聊天，无右侧栏 |
| 群聊 | Group Chat | 多人群组聊天，显示右侧栏（群公告+成员列表） |
| 空间 | Space | Matrix 协议中的房间集合，类似 Discord 服务器 |
| 房间 | Room | Matrix 协议中的聊天室 |
| 会话 | Session | 前端显示的聊天列表项 |
| SDK Manager | SDK Manager | matrix-js-sdk 提供的管理器 API，替代直接 HTTP 调用 |
| 阅后即焚 | Burn After Reading | 消息阅读后自动销毁的功能 |
| 端到端加密 | E2EE | 消息在发送端加密，接收端解密 |
| 时间线 | Timeline | 消息按时间顺序排列的列表 |
| 回执 | Receipt | 消息已读确认标记 |
| 置顶消息 | Pinned Event | 固定在房间顶部的消息 |
| 粘性事件 | Sticky Event | 按事件类型固定在房间顶部的通知 |
| 联邦 | Federation | 跨服务器的 Matrix 通信 |

---

## 2. 设计规范

### 2.1 色彩系统

所有颜色通过 CSS 自定义属性（`--hula-*` 前缀）定义在 `src/styles/css/design-tokens.css` 中，支持亮色/暗色双主题。

#### 2.1.1 品牌色

| Token | 亮色值 | 暗色值 | 用途 |
|-------|--------|--------|------|
| `--hula-brand` | `#13987f` | `#13987f` | 品牌主色 |
| `--hula-color-primary-500` | `var(--hula-brand)` | `var(--hula-brand)` | 主交互色 |
| `--hula-color-primary-400` | `#1ab292` | `#1ab292` | 悬停态 |
| `--hula-color-primary-300` | `#64c9b3` | `#64c9b3` | 浅色变体 |
| `--hula-color-primary-600` | `#0f7a66` | `#0f7a66` | 按下态 |
| `--hula-color-primary-700` | `#0a5c4d` | `#0a5c4d` | 深色变体 |

#### 2.1.2 功能色

| Token | 亮色值 | 暗色值 | 用途 |
|-------|--------|--------|------|
| `--hula-color-success-500` | `#52c41a` | `#73d13d` | 成功/在线状态 |
| `--hula-color-warning-500` | `#faad14` | `#ffa940` | 警告/勿扰 |
| `--hula-color-danger-500` | `#ff4d4f` | `#ff7875` | 错误/忙碌 |
| `--hula-color-info-500` | `#1890ff` | `#40a9ff` | 信息提示 |

#### 2.1.3 文本色

| Token | 亮色值 | 暗色值 | 用途 |
|-------|--------|--------|------|
| `--hula-text-primary` | `#18181c` | `#ffffff` | 主要文本 |
| `--hula-text-secondary` | `#505050` | `#909090` | 次要文本 |
| `--hula-text-tertiary` | `#909090` | `#707070` | 辅助文本 |
| `--hula-text-quaternary` | `#999999` | `#595959` | 占位/禁用 |
| `--hula-text-disabled` | `#bfbfbf` | `#434343` | 禁用文本 |
| `--hula-text-inverse` | `#ffffff` | `#ffffff` | 反色文本 |

#### 2.1.4 表面色

| Token | 亮色值 | 暗色值 | 用途 |
|-------|--------|--------|------|
| `--hula-surface-app` | `#fafafa` | `#161616` | 应用背景 |
| `--hula-surface-panel` | `#ffffff` | `#1b1b1b` | 面板背景 |
| `--hula-surface-panel-muted` | `#f5f5f5` | `#262626` | 静音面板 |
| `--hula-surface-subtle` | `#f1f1f1` | `#303030` | 次级表面 |
| `--hula-surface-elevated` | `#fdfdfd` | `#303030` | 提升表面 |
| `--hula-surface-search` | `#eaeaea` | `#282828` | 搜索框 |
| `--hula-surface-sidebar` | `#64a29c` | `rgba(62,101,100,0.8)` | 侧边栏 |

#### 2.1.5 边框色

| Token | 亮色值 | 暗色值 | 用途 |
|-------|--------|--------|------|
| `--hula-border-default` | `#e3e3e3` | `#404040` | 默认边框 |
| `--hula-border-muted` | `#f0f0f0` | `#262626` | 次级边框 |
| `--hula-border-strong` | `#d9d9d9` | `#434343` | 强调边框 |

#### 2.1.6 状态色

| Token | 亮色值 | 暗色值 | 用途 |
|-------|--------|--------|------|
| `--hula-status-online` | `#52c41a` | `#73d13d` | 在线 |
| `--hula-status-offline` | `#909090` | `#595959` | 离线 |
| `--hula-status-busy` | `#ff4d4f` | `#ff7875` | 忙碌 |
| `--hula-status-away` | `#faad14` | `#ffa940` | 离开 |

### 2.2 字体规范

#### 2.2.1 字体族

```css
--hula-font-family: 'PingFang', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
--hula-font-family-mono: 'SF Mono', Monaco, 'Cascadia Code', monospace;
```

#### 2.2.2 字号层级

| Token | 值 | 用途 |
|-------|-----|------|
| `--hula-font-size-xs` | `10px` | 标签/徽章 |
| `--hula-font-size-sm` | `12px` | 辅助文本/时间戳 |
| `--hula-font-size-base` | `14px` | 正文（基准） |
| `--hula-font-size-lg` | `16px` | 列表项标题 |
| `--hula-font-size-xl` | `18px` | 页面标题 |
| `--hula-font-size-2xl` | `20px` | 区块标题 |
| `--hula-font-size-3xl` | `24px` | 页面主标题 |

#### 2.2.3 字重

| Token | 值 | 用途 |
|-------|-----|------|
| `--hula-font-weight-normal` | `400` | 正文 |
| `--hula-font-weight-medium` | `500` | 列表项/按钮 |
| `--hula-font-weight-semibold` | `600` | 小标题 |
| `--hula-font-weight-bold` | `700` | 页面标题 |

#### 2.2.4 行高

| Token | 值 | 用途 |
|-------|-----|------|
| `--hula-line-height-tight` | `1.25` | 标题 |
| `--hula-line-height-normal` | `1.5` | 正文 |
| `--hula-line-height-relaxed` | `1.75` | 长文本 |

### 2.3 间距系统

采用 4px 基准网格：

| Token | 值 | 用途 |
|-------|-----|------|
| `--hula-space-0` | `0` | 无间距 |
| `--hula-space-1` | `4px` | 图标内间距 |
| `--hula-space-2` | `8px` | 紧凑间距 |
| `--hula-space-3` | `12px` | 元素间距 |
| `--hula-space-4` | `16px` | 标准间距 |
| `--hula-space-5` | `20px` | 宽松间距 |
| `--hula-space-6` | `24px` | 区块间距 |
| `--hula-space-8` | `32px` | 大区块间距 |
| `--hula-space-10` | `40px` | 页面间距 |

### 2.4 圆角系统

| Token | 值 | 用途 |
|-------|-----|------|
| `--hula-radius-xs` | `4px` | 小元素（标签/徽章） |
| `--hula-radius-sm` | `8px` | 按钮/输入框 |
| `--hula-radius-md` | `10px` | 卡片 |
| `--hula-radius-lg` | `12px` | 大卡片 |
| `--hula-radius-xl` | `16px` | 模态框 |
| `--hula-radius-2xl` | `20px` | 大型容器 |
| `--hula-radius-full` | `9999px` | 圆形（头像/徽章） |

### 2.5 阴影系统

| Token | 亮色值 | 用途 |
|-------|--------|------|
| `--hula-shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | 微妙浮起 |
| `--hula-shadow-md` | `0 4px 12px rgba(0,0,0,0.08)` | 卡片浮起 |
| `--hula-shadow-lg` | `0 10px 30px rgba(0,0,0,0.12)` | 弹出层 |
| `--hula-shadow-xl` | `0 20px 25px rgba(0,0,0,0.15)` | 模态框 |
| `--hula-shadow-card` | `0 2px 8px rgba(0,0,0,0.1)` | 卡片 |
| `--hula-shadow-dropdown` | `0 4px 12px rgba(0,0,0,0.15)` | 下拉菜单 |
| `--hula-shadow-dialog` | `0 8px 32px rgba(0,0,0,0.2)` | 对话框 |

### 2.6 动效规范

| Token | 值 | 用途 |
|-------|-----|------|
| `--hula-motion-duration-fast` | `120ms` | 悬停/按下反馈 |
| `--hula-motion-duration-normal` | `180ms` | 展开/折叠 |
| `--hula-motion-duration-slow` | `240ms` | 页面切换 |
| `--hula-motion-duration-overlay` | `280ms` | 遮罩/模态框 |
| `--hula-motion-ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` | 标准缓动 |
| `--hula-motion-ease-enter` | `cubic-bezier(0, 0, 0, 1)` | 进入动画 |
| `--hula-motion-ease-exit` | `cubic-bezier(0.4, 0, 1, 1)` | 退出动画 |

### 2.7 Z-Index 层级

| Token | 值 | 用途 |
|-------|-----|------|
| `--z-index-dropdown` | `1000` | 下拉菜单 |
| `--z-index-sticky` | `1020` | 粘性定位 |
| `--z-index-fixed` | `1030` | 固定定位 |
| `--z-index-modal-backdrop` | `1040` | 模态遮罩 |
| `--z-index-modal` | `1050` | 模态框 |
| `--z-index-popover` | `1060` | 气泡卡片 |
| `--z-index-tooltip` | `1070` | 工具提示 |
| `--z-index-toast` | `1080` | Toast 通知 |

### 2.8 布局规范

#### 2.8.1 桌面端三栏布局

```
┌─────────────────────────────────────────────────────────┐
│  Left Panel    │  Center Panel       │  Right Panel     │
│  (64-68px)     │  (240-360px)        │  (flex-1)        │
│                │                     │                  │
│  导航图标栏     │  会话/联系人列表     │  聊天/内容区      │
│  - 消息         │  - 搜索框           │  - 消息头部       │
│  - 好友         │  - 会话列表         │  - 消息时间线     │
│  - 房间         │  - 未读徽章         │  - 消息输入框     │
│  - 空间         │                     │  - 右侧详情抽屉   │
│  - 管理         │                     │                  │
│                │                     │                  │
│  头像           │                     │                  │
│  设置入口       │                     │                  │
└─────────────────────────────────────────────────────────┘
```

- **最小宽度**: `310px`（三栏总和）
- **左侧栏**: `64px`（Windows）/ `68px`（macOS 26+）
- **中间栏**: 可拖拽调整，范围 `240px - 360px`
- **右侧栏**: `flex-1` 自适应剩余空间

#### 2.8.2 移动端单栏布局

```
┌──────────────┐
│  顶部导航栏   │  ← 返回按钮 + 标题 + 操作按钮
├──────────────┤
│              │
│  内容区域     │  ← 全屏内容
│              │
│              │
├──────────────┤
│  底部 Tab 栏  │  ← 消息/好友/房间/我的（等）
└──────────────┘
```

- 采用栈式导航（push/pop）
- 支持滑动手势返回
- 底部 Tab 栏使用 `safe-area-inset-bottom`

### 2.9 主题切换机制

- 通过 `html[data-theme="light"]` 和 `html[data-theme="dark"]` 属性切换
- UnoCSS 配置 `dark: '[data-theme="dark"]'`
- 支持 `prefers-color-scheme` 系统偏好联动
- 首绘前注入内联脚本设置 `data-theme`，避免主题闪烁（FOUC）

---

## 3. 功能模块界面设计

### 3.1 认证模块（auth_compat + captcha + oidc + saml + cas + qr_login）

#### 3.1.1 登录页面

**后端对应**: `POST /_matrix/client/v3/login`, `GET /_matrix/client/v3/login`

**界面结构**:
- 居中卡片式布局，最大宽度 `400px`
- 背景: 登录背景图（`login_bg.png`）+ 品牌色渐变遮罩
- Logo: `hula.png` 居中展示
- 表单字段:
  - 服务器地址（默认隐藏，点击"高级设置"展开）
  - 用户名/邮箱/手机号
  - 密码（可显示/隐藏切换）
  - 记住密码复选框
- 登录按钮: 全宽，品牌色背景，白色文字
- 第三方登录区: 分割线 + SSO 按钮组（SAML/CAS/OIDC）
- 二维码登录: 切换 Tab 显示扫码区域
- 注册链接: 底部文字链接

**交互流程**:
1. 输入凭据 → 点击登录 → 按钮显示 loading 状态
2. 成功 → 跳转首页，触发初始同步
3. 失败 → 表单下方显示错误提示（红色文字 + 图标）
4. 需要 UIA（User-Interactive Authentication）→ 弹出验证步骤对话框

**移动端差异**:
- 全屏布局，无卡片
- 输入框全宽，圆角 `12px`
- 底部固定登录按钮

#### 3.1.2 注册页面

**后端对应**: `POST /_matrix/client/v3/register`, `GET /_matrix/client/v3/register/available`

**界面结构**:
- 用户名输入（实时校验可用性）
- 密码输入（强度指示器）
- 确认密码
- 验证码（如启用 captcha 模块）
- 服务条款复选框
- 注册按钮

#### 3.1.3 二维码登录

**后端对应**: `POST /_matrix/client/v3/rendezvous/available`, rendezvous 协议

**界面结构**:
- PC 端: 显示二维码居中，下方提示"使用移动端扫码登录"
- 移动端: 扫码后跳转确认页面，显示登录设备信息（IP、位置、设备类型），确认/取消按钮

#### 3.1.4 验证码（Captcha）

**后端对应**: `GET /_matrix/client/v3/captcha/config`, `POST /_matrix/client/v3/captcha/verify`

**界面结构**:
- 滑块验证: 拖动滑块完成拼图
- 点选验证: 按提示点击图中目标
- 验证成功后自动关闭并继续后续流程

#### 3.1.5 访客模式入口与引导（v1.3 新增）

> **来源**: [UI-UX优化方案.md](file:///Users/ljf/Desktop/hu_ts/docs/UI-UX优化方案.md) §8.6
> **后端对应**: `guest.rs` — `POST /register?kind=guest`
> **前端服务**: [MatrixGuestService.ts](file:///Users/ljf/Desktop/hu_ts/hula/src/services/matrix/guest/MatrixGuestService.ts)

**界面结构**:
- **登录页入口**: [Login.vue](file:///Users/ljf/Desktop/hu_ts/hula/src/views/loginWindow/Login.vue) 底部添加「以访客身份浏览」链接按钮
- **访客模式横幅**: [GuestModeBanner.vue](file:///Users/ljf/Desktop/hu_ts/hula/src/components/common/GuestModeBanner.vue)
  - 位置: 顶部 32px 提示条
  - 背景: `--hula-color-warning-100`
  - 文案: "您正在以访客身份浏览，功能受限"
  - 右侧: 「登录」按钮 → 调用 `MatrixGuestService.upgradeToUser(credentials)`
- **访客权限限制**:
  - 仅展示公共房间和只读消息
  - 尝试发送消息/加入私密房间时，弹出登录引导对话框

**技术约束**:
- 访客 token 权限受限（后端 `guest.rs` 已实现权限隔离）
- 升级流程保留访客期间的状态（已加入的公开房间）
- 访客 token 过期时自动重定向到登录页
- 前端操作前检查 `isGuest` 状态

**验收标准**:
- 登录页可见访客入口
- 访客可浏览公开房间
- 访客操作受限时有明确引导
- 升级登录后状态平滑过渡

### 3.2 消息与房间模块（room + sync + sliding_sync + relations + reactions + typing + ephemeral）

#### 3.2.1 会话列表（Center Panel）

**后端对应**: `GET /_matrix/client/v3/sync`, `POST /_matrix/client/v3/filter`

**界面结构**:
- 顶部搜索框: 圆角 `--hula-radius-sm`，背景 `--hula-surface-search`
- 过滤标签: 全部/未读/群聊/单人（单选过滤器，参考 Element v1.12.0）
- 会话列表项:
  - 头像（48px 圆形，带在线状态点）
  - 名称（`--hula-font-size-lg`, `--hula-font-weight-medium`）
  - 最后消息预览（`--hula-font-size-sm`, `--hula-text-tertiary`，单行截断）
  - 时间戳（`--hula-font-size-xs`, `--hula-text-tertiary`）
  - 未读徽章（品牌色圆形，数字 >99 显示 "99+"）
  - @ 提及标记（`--hula-color-danger-500` 圆点）
  - 静音图标（铃铛斜线）
- 选中态: 左侧品牌色竖条（3px），背景 `--hula-surface-list-hover`
- 悬停态: 背景 `--hula-surface-list-hover`

**交互**:
- 单击: 切换到对应会话
- 右键/长按: 上下文菜单（置顶/免打扰/删除/标记已读）
- 拖拽: 支持拖拽排序

#### 3.2.2 聊天主界面（Right Panel）

**后端对应**: `GET /_matrix/client/v3/rooms/{roomId}/messages`, `PUT /_matrix/client/v3/rooms/{roomId}/send/{eventType}/{txnId}`

**界面结构**:
- **消息头部**（固定高度 56px）:
  - 房间名称 + 成员数
  - 加密状态图标
  - 操作按钮组（从左到右）:
    1. 🔍 搜索（搜索房间内消息）
    2.  语音通话（单聊显示，群聊隐藏）
    3.  视频通话（单聊显示，群聊隐藏）
    4. **S** 私密聊天（低调图标，点击切换私密模式）
    5. ⋮ 更多（下拉菜单：房间设置/成员列表/静音/置顶/举报）
  - 右侧抽屉切换按钮（群聊显示，单聊隐藏）
- **消息时间线**（flex-1 可滚动区域）:
  - 日期分隔条（居中，半透明背景）
  - 消息气泡:
    - 接收消息: 左对齐，背景 `--hula-surface-elevated`，圆角 `12px 12px 12px 4px`
    - 发送消息: 右对齐，背景 `--hula-color-primary-500`，文字白色，圆角 `12px 12px 4px 12px`
    - 头像（32px，仅接收消息显示，连续消息省略）
    - 发送者名称（`--hula-font-size-sm`, `--hula-font-weight-medium`，群聊显示）
    - 时间戳（`--hula-font-size-xs`, `--hula-text-tertiary`）
    - 消息状态: 发送中（loading）/已发送（单勾）/已送达（双勾）/已读（双勾蓝色）
  - 系统消息: 居中文字（加入/离开/踢出/禁言等），`--hula-font-size-sm`, `--hula-text-tertiary`
  - 加载更多: 滚动到顶部自动加载，顶部显示 loading 指示器
- **消息输入框**（底部固定区域）:
  - 工具栏: 表情/文件/图片/语音/更多
  - 文本输入区: 自适应高度，最大 120px，回车发送/Shift+回车换行
  - 发送按钮: 品牌色圆形，有内容时激活
  - 引用回复: 输入框上方显示被回复消息卡片
  - @ 提及: 输入 `@` 弹出成员选择列表
  - 斜杠命令: 输入 `/` 弹出命令列表

> **单聊 vs 群聊右侧栏规则**:
> - **单聊（DM）**: 不显示右侧栏，右侧空间全部分配给消息区域
> - **群聊**: 显示右侧栏（宽度 280px），包含：
>   - 群公告（顶部固定区域）
>   - 成员列表（可滚动，显示头像+昵称+在线状态）
>   - 成员操作菜单（点击成员头像：@提及/私聊/查看资料/设为管理员/踢出）

**消息类型支持**:

| 类型 | 后端 eventType | 界面展示 |
|------|---------------|---------|
| 文本 | `m.room.message` (m.text) | 文本气泡，支持 markdown 渲染 |
| 图片 | `m.room.message` (m.image) | 缩略图 + 点击查看大图 |
| 视频 | `m.room.message` (m.video) | 缩略图 + 播放按钮 |
| 文件 | `m.room.message` (m.file) | 文件卡片（图标+名称+大小+下载） |
| 语音 | `m.room.message` (m.audio) | 语音条（波形+时长+播放） |
| 位置 | `m.location` | 地图缩略图 + 点击打开 |
| 表情回应 | `m.reaction` | 消息底部表情徽章组 |
| 撤回 | `m.room.redaction` | "消息已撤回"占位 |
| 编辑 | `m.room.message` (m.text, body 含 `*`) | 显示编辑后内容 + "已编辑"标记 |
| 通知 | `m.room.encrypted` | 加密消息占位（解密失败时提示） |

#### 3.2.3 房间创建

**后端对应**: `POST /_matrix/client/v3/createRoom`

**界面结构**:
- 对话框/全屏页面
- 房间类型选择: 群聊/频道/空间
- 房间名称输入
- 房间主题/描述
- 隐私设置: 公开/私密
- 邀请成员选择器: 搜索 + 多选列表
- 加密设置: 默认开启（端到端加密）
- 创建按钮

#### 3.2.4 房间设置

**后端对应**: `GET /_matrix/client/v3/rooms/{roomId}/state`, `PUT /_matrix/client/v3/rooms/{roomId}/state/{eventType}`

**界面结构**:
- **基本信息**: 名称/主题/头像/描述
- **成员管理**: 成员列表 + 邀请/踢出/禁言/管理员设置
- **权限设置**: 权限等级矩阵（power levels）
- **加密设置**: 端到端加密开关 + 密钥信息
- **通知设置**: 全部/仅@提及/关闭
- **别名管理**: 房间别名列表 + 添加/删除
- **历史可见性**: 共享/邀请
- **保留策略**: 消息保留时间
- **高级**: 房间版本/升级/导出/归档

#### 3.2.5 消息搜索

**后端对应**: `POST /_matrix/client/v3/search`

**界面结构**:
- 搜索输入框（顶部）
- 结果列表: 消息预览 + 高亮关键词 + 来源房间 + 时间
- 点击跳转到对应消息位置

#### 3.2.6 消息回复与线程

**后端对应**: `GET /_matrix/client/v3/rooms/{roomId}/relations/{eventId}`, `POST /_matrix/client/v3/rooms/{roomId}/threads`

**界面结构**:
- 回复: 消息上方显示被回复消息引用卡片
- 线程: 右侧弹出线程面板，独立时间线 + 输入框
- 线程计数: 原消息底部显示线程回复数

#### 3.2.7 消息反应

**后端对应**: `PUT /_matrix/client/v3/rooms/{roomId}/send/{eventType}/{txnId}` (m.reaction)

**界面结构**:
- 悬停消息显示表情选择器（常用 6 个 + 更多按钮）
- 已有反应显示为底部徽章（表情 + 计数）
- 点击已有反应可取消

#### 3.2.8 正在输入指示

**后端对应**: `PUT /_matrix/client/v3/rooms/{roomId}/typing/{userId}`

**界面结构**:
- 消息时间线底部显示 "XXX 正在输入..." + 动画省略号
- 多人输入时显示 "XXX、YYY 正在输入..."

#### 3.2.9 置顶消息（Pinned Events）

**后端对应**:
- 获取: `GET /rooms/{room_id}/pinned_events`
- 置顶: `POST /rooms/{room_id}/pinned_events`（`{ event_id: string }`）
- 取消置顶: `DELETE /rooms/{room_id}/pinned_events/{event_id}`

**权限要求**: 需 `m.room.pinned_events` 状态事件写入权限（通常为管理员/版主）

**界面结构**:
- 房间顶部置顶横幅（可水平滚动）:
  - 置顶消息卡片: 消息预览（文本/图片缩略图）+ 发送者 + 时间
  - 左右切换按钮（多条置顶时）
  - 关闭按钮（临时隐藏，不取消置顶）
- 消息操作菜单: "置顶" / "取消置顶"（需权限）
- 房间设置 > 置顶消息管理:
  - 置顶消息列表 + 取消置顶按钮
  - 拖拽排序

#### 3.2.10 房间标签（Tags）

**后端对应**:
- 全局标签: `GET /user/{user_id}/tags`
- 房间标签: `GET /user/{user_id}/rooms/{room_id}/tags`
- 设置标签: `PUT /user/{user_id}/rooms/{room_id}/tags/{tag}`（`{ order?: number }`）
- 删除标签: `DELETE /user/{user_id}/rooms/{room_id}/tags/{tag}`

**界面结构**:
- 会话列表项右侧: 标签图标（如收藏、工作、重要等自定义标签）
- 房间右键菜单 > 添加标签:
  - 已有标签列表（可勾选）
  - 创建新标签（输入名称）
  - 排序权重（`order` 字段，影响标签显示顺序）
- 会话列表顶部标签筛选: 按标签过滤会话

#### 3.2.11 粘性事件（Sticky Events, MSC4354）

**后端对应**:
- 获取: `GET /rooms/{room_id}/sticky_events`（可按 `event_type` 过滤）
- 设置: `POST /rooms/{room_id}/sticky_events`（`{ events: [{ event_type, event_id }] }`）
- 清除: `DELETE /rooms/{room_id}/sticky_events/{event_type}`

**界面结构**:
- 房间顶部固定通知区:
  - 粘性事件卡片: 按事件类型展示（如公告、规则、活动等）
  - 多条粘性事件可滚动切换
  - 关闭按钮（仅当前会话隐藏，不删除粘性事件）
- 管理入口（需权限）: 房间设置 > 粘性事件管理

**粘性事件横幅 UI 设计**（v1.3 新增）:

> **来源**: [UI-UX优化方案.md](file:///Users/ljf/Desktop/hu_ts/docs/UI-UX优化方案.md) §8.2

- **位置**: [ChatMain.vue](file:///Users/ljf/Desktop/hu_ts/hula/src/components/rightBox/chatBox/ChatMain.vue) 消息列表上方
- **折叠态**: 高度 48px，显示最近 1-3 条粘性事件摘要（发送者头像 + 摘要文本 + 时间）
- **展开态**: 最大高度 240px，显示全部粘性事件列表
- **过渡动画**: 使用 `--hula-motion-duration-normal`（200ms）高度过渡
- **背景**: `--hula-color-primary-100` 区分普通消息
- **消息上下文菜单**: 添加「设为粘性事件」操作（仅管理员/版主可见，检查 `power_levels.state_default` 权限）
- **实时同步**: 监听 `m.room.sticky_events` 状态事件变更，实时刷新横幅
- **权限控制**: 仅房间管理员/版主可设置粘性事件

#### 3.2.12 反截图保护

**后端对应**:
- 获取状态: `GET /rooms/{room_id}/anti_screenshot`
- 设置: `PUT /rooms/{room_id}/anti_screenshot`（`{ enabled: boolean }`）

**实现机制**: 通过 `com.hula.privacy` 状态事件，`action` 字段为 `block_screenshot` 或 `allow_screenshot`

**界面结构**:
- 房间设置 > 隐私与安全 > 反截图:
  - 开关切换
  - 提示文案: "开启后，房间内截图将触发安全告警（仅客户端检测，无法完全防止）"
- 房间头部显示盾牌图标（开启时）
- 截图检测告警: 当检测到截图时，向房间发送系统消息 "XXX 截图了房间内容"

#### 3.2.13 邀请黑名单/白名单

**后端对应**:
- 黑名单: `GET/POST /rooms/{room_id}/invite_blocklist`
- 白名单: `GET/POST /rooms/{room_id}/invite_allowlist`

**界面结构**:
- 房间设置 > 邀请管理:
  - 黑名单 Tab: 被禁止邀请的用户列表 + 添加/移除
  - 白名单 Tab: 允许邀请的用户列表（启用后仅白名单用户可被邀请）
  - 搜索添加用户到名单

#### 3.2.14 消息翻译

**后端对应**:
- 翻译消息: `POST /rooms/{room_id}/translate/{event_id}`
- 翻译文本: `POST /translate`

**界面结构**:
- 消息操作菜单 > 翻译:
  - 自动检测源语言
  - 翻译为目标语言（用户设置的语言）
  - 翻译结果显示在消息气泡下方（折叠态，点击展开）
  - "查看原文"/"查看翻译"切换
- 设置 > 通用 > 翻译:
  - 目标语言选择
  - 自动翻译开关（接收消息自动翻译）

#### 3.2.15 房间通知与未读计数

**后端对应**:
- 通知: `GET /rooms/{room_id}/notifications`
- 未读计数: `GET /rooms/{room_id}/unread_count`
- 已读标记: `POST /rooms/{room_id}/read_markers`
- 回执: `POST /rooms/{room_id}/receipt/{receipt_type}/{event_id}`

**界面结构**:
- 会话列表未读徽章: 数字 + @提及红色圆点
- 房间头部未读提示: "X 条未读消息" + 跳转到第一条未读
- 滚动到底部按钮: 有新消息且不在底部时显示

#### 3.2.16 房间高级功能

> **后端路由**: 见 [room.rs](file:///Users/ljf/Desktop/hu_ts/synapse-rust/src/web/routes/room.rs)（V3 扩展端点）

**房间生命周期管理**:

| 功能 | 后端 API | 界面入口 |
|------|---------|---------|
| 房间升级 | `POST /rooms/{room_id}/upgrade` | 房间设置 > 高级 > 升级房间版本 |
| 遗忘房间 | `POST /rooms/{room_id}/forget` | 离开房间后的"遗忘"按钮 |
| 房间版本 | `GET /rooms/{room_id}/version` | 房间设置 > 高级 |
| 房间别名 | `GET /rooms/{room_id}/aliases` | 房间设置 > 别名管理 |
| 初始同步 | `GET /rooms/{room_id}/initialSync` | 房间首次进入同步（无直接 UI） |

**成员管理操作**:

| 功能 | 后端 API | 界面入口 |
|------|---------|---------|
| 踢出成员 | `POST /rooms/{room_id}/kick` | 成员列表 > 右键 > 踢出 |
| 封禁用户 | `POST /rooms/{room_id}/ban` | 成员列表 > 右键 > 封禁 |
| 解除封禁 | `POST /rooms/{room_id}/unban` | 封禁列表 > 解除封禁 |
| 成员资格查询 | `GET /rooms/{room_id}/membership/{user_id}` | 成员详情页 |
| 已加入成员 | `GET /rooms/{room_id}/joined_members` | 成员列表（精简） |
| 最近活跃成员 | `GET /rooms/{room_id}/members/recent` | 成员列表排序 |
| 成员事件 | `POST /rooms/{room_id}/get_membership_events` | 成员变更历史 |
| 邀请列表 | `GET /rooms/{room_id}/invites` | 待处理邀请管理 |
| 邀请用户 | `POST /rooms/{room_id}/invite` | 成员管理 > 邀请 |
| 通过房间 ID 邀请 | `POST /invite/{room_id}` | 全局邀请入口 |

**加入与离开**:

| 功能 | 后端 API | 界面入口 |
|------|---------|---------|
| 加入房间 | `POST /rooms/{room_id}/join` | 房间链接/邀请确认 |
| 通过别名加入 | `POST /join/{room_id_or_alias}` | 搜索加入 |
| 敲门请求 | `POST /knock/{room_id_or_alias}` | 公开房间加入流程 |
| 离开房间 | `POST /rooms/{room_id}/leave` | 房间菜单 > 离开 |

**消息与已读**:

| 功能 | 后端 API | 界面入口 |
|------|---------|---------|
| 发送回执 | `POST /rooms/{room_id}/receipt/{receipt_type}/{event_id}` | 阅读后自动发送 |
| 获取回执 | `GET /rooms/{room_id}/receipts/{receipt_type}/{event_id}` | 消息已读列表 |
| 已读标记 | `POST/PUT /rooms/{room_id}/read_markers` | 切换会话时自动标记 |
| 房间内搜索 | `POST /rooms/{room_id}/search` | 房间内搜索框 |
| 撤回消息 | `PUT/POST /rooms/{room_id}/redact/{event_id}/{txn_id}` | 消息右键 > 撤回 |
| 房间账号数据 | `GET/PUT /rooms/{room_id}/account_data/{type}` | 草稿/自定义设置 |

**线程与时间线**:

| 功能 | 后端 API | 界面入口 |
|------|---------|---------|
| 时间线 | `GET /rooms/{room_id}/timeline` | 消息时间线加载 |
| 房间同步 | `GET /rooms/{room_id}/sync` | 房间级同步 |
| 线程列表 | `GET /rooms/{room_id}/thread/{event_id}` | 线程面板 |
| 线程详情 | `GET /rooms/{room_id}/threads/{thread_id}` | 线程详情页 |
| 未读计数 | `GET /rooms/{room_id}/unread_count` | 会话列表徽章 |
| 通知设置 | `GET /rooms/{room_id}/notifications` | 房间设置 > 通知 |
| 消息队列 | `GET /rooms/{room_id}/message_queue` | 待发送消息管理 |

**元数据与能力**:

| 功能 | 后端 API | 界面入口 |
|------|---------|---------|
| 元数据 | `GET /rooms/{room_id}/metadata` | 房间信息展示 |
| 房间能力 | `GET /rooms/{room_id}/capabilities` | 客户端能力探测 |
| 权限矩阵 | `GET /rooms/{room_id}/permissions` | 房间设置 > 权限 |
| 解析房间 | `GET /rooms/{room_id}/resolve` | 别名解析 |
| 保留策略 | `GET /rooms/{room_id}/retention` | 房间设置 > 消息保留 |
| 所属空间 | `GET /rooms/{room_id}/spaces` | 房间设置 > 空间关联 |
| TURN 服务器 | `GET /rooms/{room_id}/turn_server` | VoIP 通话前获取 |
| 渲染内容 | `GET /rooms/{room_id}/rendered/` | 富文本渲染（HTML） |
| 服务类型 | `GET /rooms/{room_id}/service_types` | 应用服务集成展示 |
| 外部 ID | `GET /rooms/{room_id}/external_ids` | 第三方关联 ID |

**事件操作**:

| 功能 | 后端 API | 界面入口 |
|------|---------|---------|
| 单条事件 | `GET /rooms/{room_id}/event/{event_id}` | 消息定位/跳转 |
| 事件 URL | `GET /rooms/{room_id}/event/{event_id}/url` | 事件分享链接 |
| 事件视角 | `GET /rooms/{room_id}/event_perspective` | 事件权限视角 |
| 转换事件 | `POST /rooms/{room_id}/convert/{event_id}` | 事件格式转换 |
| 签名事件 | `PUT /rooms/{room_id}/sign/{event_id}` | 事件签名（高级） |
| 验证事件 | `POST /rooms/{room_id}/verify/{event_id}` | 事件验签（高级） |

**加密与密钥**:

| 功能 | 后端 API | 界面入口 |
|------|---------|---------|
| 房间密钥 | `GET /rooms/{room_id}/keys` | E2EE 密钥管理（高级） |
| 密钥计数 | `GET /rooms/{room_id}/keys/count` | 密钥数量展示 |
| 密钥版本 | `GET /rooms/{room_id}/keys/version` | 密钥版本信息 |
| 认领密钥 | `POST /rooms/{room_id}/keys/claim` | 设备间密钥认领 |
| 转发密钥 | `PUT /rooms/{room_id}/room_keys/keys` | 密钥转发（历史共享） |
| 事件密钥 | `GET /rooms/{room_id}/keys/{event_id}` | 单事件密钥 |
| 加密事件列表 | `GET /rooms/{room_id}/encrypted_events` | 加密消息批量获取 |
| 精简事件 | `GET /rooms/{room_id}/reduced_events` | 轻量事件列表 |
| 设备信息 | `GET /rooms/{room_id}/device/{device_id}` | 房间内设备信息 |
| 用户片段 | `GET /rooms/{room_id}/fragments/{user_id}` | 用户消息片段 |

**保险库数据**:

| 功能 | 后端 API | 界面入口 |
|------|---------|---------|
| 获取保险库 | `GET /rooms/{room_id}/vault_data` | 房间设置 > 安全保险库 |
| 更新保险库 | `PUT /rooms/{room_id}/vault_data` | 保险库数据写入 |

#### 3.2.17 举报与审核（moderation + event_report）

> **后端路由**: `/_matrix/client/v3/rooms/{room_id}/report/*`, `/_matrix/client/v1/rooms/{room_id}/report/*`, `/_matrix/client/r0/rooms/{room_id}/report/*`（见 [moderation.rs](file:///Users/ljf/Desktop/hu_ts/synapse-rust/src/web/routes/moderation.rs)、[event_report.rs](file:///Users/ljf/Desktop/hu_ts/synapse-rust/src/web/routes/event_report.rs)）

**用户端举报端点**:

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/rooms/{room_id}/report/{event_id}` | 举报单条消息 |
| `PUT` | `/rooms/{room_id}/report/{event_id}/score` | 更新举报评分 |
| `POST` | `/rooms/{room_id}/report` | 举报整个房间（V3） |
| `GET` | `/rooms/{room_id}/report/{event_id}/scanner_info` | 获取扫描器信息（V1） |

**举报请求参数**（`POST /rooms/{room_id}/report/{event_id}`）:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `reason` | string | 否 | 举报原因（预设分类） |
| `description` | string | 否 | 详细描述（用户输入） |
| `score` | number | 否 | 严重程度评分（`-100` ~ `100`，负值表示不违规） |
| `event_json` | object | 否 | 被举报事件的原始 JSON |
| `reported_user_id` | string | 否 | 被举报用户 ID |

**举报原因预设分类**:

| 分类 | 说明 |
|------|------|
| `spam` | 垃圾广告/恶意链接 |
| `harassment` | 骚扰/霸凌 |
| `hate_speech` | 仇恨言论 |
| `violence` | 暴力威胁 |
| `illegal_content` | 违法内容 |
| `nsfw` | 不适宜工作场所内容 |
| `other` | 其他（需填写描述） |

**界面结构**:
- **消息举报入口**: 消息右键/长按菜单 > "举报"
  - 举报对话框:
    - 原因选择: 单选列表（预设分类）+ "其他"展开描述输入框
    - 严重程度: 滑块或星级（对应 `score` 字段）
    - 附加描述: 多行文本框（最大 1000 字符）
    - 提交按钮 + 取消按钮
  - 提交后: 显示"举报已提交，我们将在 24 小时内处理"提示
- **房间举报入口**: 房间设置 > 滑到底部 > "举报此房间"
  - 与消息举报类似的对话框，但针对整个房间
- **举报历史**（设置 > 隐私与安全 > 我的举报）:
  - 举报列表: 时间 + 房间/消息预览 + 原因 + 处理状态
  - 状态: 待处理（`open`）/ 已解决（`resolved`）/ 已驳回（`dismissed`）

**管理端举报处理**（见 3.10.11 事件举报管理）:

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/_synapse/admin/v1/event_reports` | 举报列表（支持分页/筛选） |
| `GET` | `/_synapse/admin/v1/event_reports/{id}` | 举报详情 |
| `GET` | `/_synapse/admin/v1/event_reports/by-event/{event_id}` | 按事件查举报 |
| `PUT` | `/_synapse/admin/v1/event_reports/{id}` | 更新举报状态 |
| `POST` | `/_synapse/admin/v1/event_reports/{id}/resolve` | 解决举报 |
| `POST` | `/_synapse/admin/v1/event_reports/{id}/dismiss` | 驳回举报 |
| `POST` | `/_synapse/admin/v1/event_reports/{id}/block-user` | 封禁被举报用户 |
| `GET` | `/_synapse/admin/v1/event_reports/stats` | 举报统计 |

#### 3.2.18 公共房间目录浏览（v1.3 新增）

> **来源**: [UI-UX优化方案.md](file:///Users/ljf/Desktop/hu_ts/docs/UI-UX优化方案.md) §8.4
> **后端对应**: `GET /publicRooms`（支持 `server`、`filter`、`since` 参数）
> **前端服务**: [MatrixSearchService.ts](file:///Users/ljf/Desktop/hu_ts/hula/src/services/matrix/MatrixSearchService.ts) `searchPublicRooms()`

**界面结构**:
- **入口**: 左侧栏「添加」菜单 → 「探索公共房间」，或空间导航栏入口
- **页面布局**:
  - 顶部搜索框 + 过滤器（主题、成员数范围、是否加密）
  - 房间卡片列表: 头像 + 名称 + 成员数 + 主题摘要 + 「加入」按钮
  - 分页加载: 使用 IntersectionObserver 触发下一页（`next_batch` 游标）
- **联邦服务器选择**: 支持指定联邦服务器（`server` 参数），默认本服务器
- **加入流程**: 点击「加入」→ 调用 `room.joinRoom(roomIdOrAlias)` → 成功后跳转到房间

**技术约束**:
- 搜索使用防抖（300ms），避免频繁请求
- 房间卡片使用 `--hula-surface-panel` 背景 + `--hula-shadow-card` 阴影
- 空结果使用空状态插图（放大镜图标 + "尝试其他关键词"）
- 列表使用 [VirtualList.vue](file:///Users/ljf/Desktop/hu_ts/hula/src/components/common/VirtualList.vue) 支持大量房间

**验收标准**:
- 可搜索公共房间，支持按成员数排序
- 点击加入后 2 秒内进入房间
- 分页加载无重复项
- 联邦服务器切换后列表刷新

#### 3.2.19 房间级消息保留策略（v1.3 新增）

> **来源**: [UI-UX优化方案.md](file:///Users/ljf/Desktop/hu_ts/docs/UI-UX优化方案.md) §8.7
> **后端对应**: `m.room.retention` 状态事件（`max_lifetime`、`expire_on_clients` 字段）
> **前端服务**: [RetentionService.ts](file:///Users/ljf/Desktop/hu_ts/hula/src/services/matrix/admin/RetentionService.ts)

**界面结构**:
- **位置**: [RoomDetailPane.vue](file:///Users/ljf/Desktop/hu_ts/hula/src/components/room/RoomDetailPane.vue) 房间设置（仅管理员可见）
- **配置选项**:
  - 不限制（默认）
  - 保留最近 N 天（输入框，范围 1-3650）
  - 保留最近 N 条消息（输入框，范围 1-100000）
- **当前状态展示**: 显示当前保留策略 + 修改确认提示
- **风险提示**: 使用 `--hula-color-warning-100` 背景提示"修改保留策略将删除超期消息"

**技术约束**:
- 仅房间管理员可见（检查 `power_levels.state_default` ≥ 50）
- 修改保留策略需二次确认（会删除超期消息）
- 配置变更后通过 `m.room.retention` 状态事件广播

### 3.3 好友与联系人模块（friend_room + dm + directory）

> **后端路由**: `/_matrix/client/v3/friends/*`, `/_matrix/client/v1/friends/*`, `/_matrix/client/r0/friendships/*`（见 [friend_room.rs](file:///Users/ljf/Desktop/hu_ts/synapse-rust/src/web/routes/friend_room.rs)）
> **Feature Flag**: `friends`（L3 扩展，需显式启用）
> **跨服务器**: 通过 [federation/friend](file:///Users/ljf/Desktop/hu_ts/synapse-rust/src/federation/friend/mod.rs) 实现联邦好友关系

#### 3.3.1 好友列表

**后端对应**: `GET /_matrix/client/v3/friends`

**请求参数**:

| 参数 | 类型 | 说明 |
|------|------|------|
| `limit` | number | 每页数量（1-200，默认 50） |
| `from` | string | 分页游标（base64 编码，替代旧版 offset） |
| `offset` | number | 旧版偏移（已废弃，仅向后兼容） |
| `sort_by` | string | 排序方式（默认 `alphabet` 字母序） |

**界面结构**:
- 顶部搜索框: 圆角 `--hula-radius-sm`，背景 `--hula-surface-search`，支持昵称/用户 ID 搜索
- 分组标签栏:
  - 全部好友
  - 在线好友（按 `presence` 状态过滤）
  - 收藏好友（`status=favorite`）
  - 自定义分组（从 `GET /friends/groups` 动态加载）
- 好友列表项:
  - 头像（48px 圆形）+ 在线状态点（右下角 12px，颜色见状态色表）
  - 昵称/显示名称（`--hula-font-size-lg`, `--hula-font-weight-medium`）
  - 个性化签名/最后活跃时间（`--hula-font-size-sm`, `--hula-text-tertiary`）
  - 分组徽章（若属于多个分组，显示分组名）
  - 收藏图标（`status=favorite` 时显示星标）
- 列表底部分页: 滚动到底部自动加载下一页（使用 `next_batch` 游标）

**右键/长按操作菜单**:

| 操作 | 后端 API | 说明 |
|------|---------|------|
| 发消息 | `POST /friends/dm/{user_id}` | 创建或复用 DM 房间 |
| 查看资料 | `GET /friends/{user_id}/info` | 跳转好友详情页 |
| 设置备注 | `PUT /friends/{user_id}/note` | 弹出输入框（最大 1000 字符） |
| 修改显示名 | `PUT /friends/{user_id}/displayname` | 弹出输入框（1-256 字符） |
| 设为收藏 | `PUT /friends/{user_id}/status` (status=favorite) | 收藏/取消收藏切换 |
| 加入黑名单 | `PUT /friends/{user_id}/status` (status=blocked) | 屏蔽后不再接收消息 |
| 设为隐藏 | `PUT /friends/{user_id}/status` (status=hidden) | 列表不显示但保留关系 |
| 移入分组 | `POST /friends/groups/{group_id}/add/{user_id}` | 选择目标分组 |
| 删除好友 | `DELETE /friends/{user_id}` | 二次确认对话框 |

**好友状态枚举**（`FriendRequestStatus`）:

| 状态 | 说明 | 界面表现 |
|------|------|---------|
| `pending` | 待处理 | 申请列表显示，可接受/拒绝 |
| `accepted` | 已接受 | 好友列表显示 |
| `rejected` | 已拒绝 | 不在好友列表，可重新申请 |
| `cancelled` | 已取消 | 不在好友列表 |

**好友关系状态**（`status` 字段）:

| 状态 | 说明 | 界面表现 |
|------|------|---------|
| `favorite` | 收藏 | 星标图标，列表置顶 |
| `normal` | 普通 | 默认状态 |
| `blocked` | 黑名单 | 灰色头像，不接收消息 |
| `hidden` | 隐藏 | 列表不显示，关系保留 |

#### 3.3.2 好友申请管理

**后端对应**:
- 发送申请: `POST /_matrix/client/v3/friends` 或 `POST /friends/request`
- 收到申请: `GET /friends/requests/incoming`（推荐）/ `GET /friends/request/received`（已废弃）
- 已发申请: `GET /friends/requests/outgoing`
- 接受: `POST /friends/request/{user_id}/accept`
- 拒绝: `POST /friends/request/{user_id}/reject`
- 取消: `POST /friends/request/{user_id}/cancel`

**好友申请状态机**:

```
                  ┌──────────────┐
                  │   无关系     │
                  └──────┬───────┘
                         │ POST /friends/request
                         ▼
                  ┌──────────────┐
                  │   pending    │ ← 申请人视角（outgoing）
                  └──────┬───────┘
                         │
              ┌──────────┼──────────┐
              │          │          │
   POST /accept     POST /reject  POST /cancel
              │          │          │
              ▼          ▼          ▼
        ┌─────────┐ ┌─────────┐ ┌─────────┐
        │accepted │ │rejected │ │cancelled│
        └─────────┘ └─────────┘ └─────────┘
```

**界面结构**:
- **新好友申请入口**（顶部 Tab 或独立页面）:
  - 红点徽章显示未处理申请数
  - 双 Tab 切换: "新的朋友"（incoming）/ "我发出的"（outgoing）
  - 申请列表项: 头像 + 昵称 + 来源（用户 ID/手机号/扫码）+ 申请消息 + 时间
  - incoming 项操作: 接受（品牌色按钮）/ 拒绝（次要按钮）
  - outgoing 项操作: 取消（文字按钮）
  - 接受成功后自动创建 DM 房间（返回 `room_id`），跳转到聊天页

- **添加好友入口**（顶部 + 号按钮）:
  - 搜索用户: 输入用户 ID/昵称/手机号
  - 搜索结果列表: 头像 + 昵称 + 用户 ID + 已是好友/可添加状态
  - 点击"添加"弹出验证消息输入框（可选，最大 200 字符）
  - 发送后显示"等待对方验证"状态

#### 3.3.3 好友搜索（目录搜索）

**后端对应**: `GET /friends/search` 或 `POST /friends/search`

**请求参数**:

| 参数 | 类型 | 说明 |
|------|------|------|
| `q` / `query` | string | 搜索关键词（支持 body 或 query 传参） |
| `mode` | string | `exact` 精确匹配 / `fuzzy` 模糊匹配（默认 fuzzy） |
| `limit` | number | 返回数量（默认 20） |

**速率限制**: 每用户 20 次请求/窗口，每次消耗 2 个令牌（令牌桶算法）

**界面结构**:
- 搜索输入框: 实时搜索（防抖 300ms）
- 搜索模式切换: 精确/模糊（Segmented Control）
- 结果列表:
  - 头像 + 昵称 + 用户 ID + 在线状态（`presence` 字段）
  - `match_score` 匹配度排序（高到低）
  - `match_type` 匹配类型标识（昵称/ID/手机号匹配）
  - 个人资料可见性: `can_view_profile` 为 false 时隐藏详细信息
- 空结果: 显示"未找到相关用户"插画 + 建议文案
- 速率限制提示: 触发限流时显示 "搜索过于频繁，请稍后再试"（含 `retry_after_seconds`）

#### 3.3.4 好友分组管理

**后端对应**:
- 获取分组列表: `GET /friends/groups`
- 创建分组: `POST /friends/groups`（名称 1-50 字符）
- 删除分组: `DELETE /friends/groups/{group_id}`
- 重命名分组: `PUT /friends/groups/{group_id}/name`
- 添加好友到分组: `POST /friends/groups/{group_id}/add/{user_id}`
- 从分组移除: `DELETE /friends/groups/{group_id}/remove/{user_id}`
- 查看分组好友: `GET /friends/groups/{group_id}/friends`
- 查看好友所属分组: `GET /friends/{user_id}/groups`

**界面结构**:
- 分组管理页面（设置入口或好友页顶部编辑按钮）:
  - 分组列表: 名称 + 好友数量 + 排序拖拽手柄
  - 新建分组: 顶部按钮，弹出输入框
  - 分组编辑: 点击进入分组详情
    - 分组内好友列表（可移除）
    - 添加好友到分组（从全部好友选择）
    - 重命名/删除分组（顶部更多菜单）
- 好友详情页分组标签: 显示所属分组，点击可添加/移除

#### 3.3.5 好友详情页

**后端对应**: `GET /friends/{user_id}/info`, `GET /friends/{user_id}/status`, `GET /friends/check/{user_id}`

**界面结构**:
- 顶部卡片: 大头像（100px）+ 昵称 + 用户 ID + 在线状态
- 个人资料区:
  - 个性化签名
  - 个人简介
  - 所在地
  - 注册时间（`created_ts`）
  - 最后活跃时间（`last_active_ts`）
- 好友专属信息:
  - 好友备注（可编辑，最大 1000 字符）
  - 自定义显示名（覆盖对方昵称，1-256 字符）
  - 好友状态（favorite/normal/blocked/hidden）
  - 所属分组
  - 成为好友时间
- 操作区:
  - 发消息（跳转 DM 房间）
  - 语音通话/视频通话（若在线）
  - 二维码（展示对方二维码）
  - 设置（备注/分组/状态）

#### 3.3.6 好友建议

**后端对应**: `GET /friends/suggestions?limit=N`

**界面结构**:
- 建议列表: 头像 + 昵称 + 共同好友数 + 来源说明（"你可能认识"）
- 操作: 添加（弹出验证消息输入）/ 忽略（移除该项）
- 滚动加载更多

#### 3.3.7 群组验证

**后端对应**: friend_room feature（群聊邀请验证流程）

**界面结构**:
- 待验证群列表
- 群信息: 群名/群主/成员数/申请理由
- 操作: 同意/拒绝

#### 3.3.8 跨服务器好友联邦

**后端对应**: [federation/friend](file:///Users/ljf/Desktop/hu_ts/synapse-rust/src/federation/friend/mod.rs)

**界面表现**:
- 跨服务器好友在列表中显示服务器标识（如 `@user:other-server.com`）
- 申请跨服务器好友时显示提示: "对方属于其他服务器，申请可能需要更长时间"
- 联邦状态异常时显示警告图标（tooltip: "对方服务器当前不可达"）

### 3.4 空间模块（space + room_summary）

> **后端路由**: `/_matrix/client/v1/spaces/*`, `/_matrix/client/r0/spaces/*`, `/_matrix/client/v3/spaces/*`（见 [space.rs](file:///Users/ljf/Desktop/hu_ts/synapse-rust/src/web/routes/space.rs) 及子模块 `children_hierarchy.rs`、`membership_state.rs`、`summary.rs`、`lifecycle_query.rs`）
> **服务层**: [synapse-services/src/room/space/](file:///Users/ljf/Desktop/hu_ts/synapse-rust/synapse-services/src/room/space/)

#### 3.4.1 空间创建与生命周期

**后端对应**:
- 创建空间: `POST /spaces`
- 获取空间: `GET /spaces/{space_id}`
- 更新空间: `PUT /spaces/{space_id}`
- 删除空间: `DELETE /spaces/{space_id}`
- 通过房间获取空间: `GET /spaces/room/{room_id}`

**界面结构（创建空间对话框）**:
- 空间名称（必填，1-100 字符）
- 空间主题/描述（可选，最大 1024 字符）
- 空间头像上传
- 可见性: 公开（`is_public=true`）/ 私密
- 空间别名（可选）
- 初始成员邀请（可选，搜索选择）
- 创建按钮

#### 3.4.2 空间导航栏（左侧栏）

**界面结构**:
- 空间头像列表（垂直排列，56px 圆形）:
  - 当前用户加入的所有空间
  - 选中态: 左侧品牌色竖条 + 背景高亮
  - 悬停态: 显示空间名称 tooltip
  - 未读徽章: 右上角红色圆点
- 空间切换: 点击切换工作台内容
- 底部按钮: 创建新空间（+ 号）

#### 3.4.3 空间工作台

**后端对应**:
- 空间统计: `GET /spaces/statistics`
- 用户空间列表: `GET /spaces/user`
- 公共空间: `GET /spaces/public`
- 搜索空间: `GET /spaces/search`

**界面结构**:
- 顶部工具栏:
  - 空间名称 + 成员数 + 公开/私密标识
  - 视图切换: 卡片视图 / 树形视图
  - 搜索框（搜索空间内房间）
  - 操作按钮: 邀请成员 / 创建子空间 / 创建子房间 / 设置
- **卡片视图**（默认）:
  - 房间卡片网格（响应式 2-4 列）
  - 卡片内容: 头像 + 名称 + 主题 + 成员数 + 加入/已加入状态
  - 加入按钮 / 进入按钮
  - 子空间卡片标识（左上角空间图标）
- **树形视图**:
  - 可折叠树形结构（支持嵌套空间）
  - 节点: 房间/子空间图标 + 名称 + 成员数
  - 展开/折叠所有按钮
  - 拖拽排序（需管理员权限）

#### 3.4.4 空间层级结构（Hierarchy）

**后端对应**:
- 获取子项: `GET /spaces/{space_id}/children`
- 添加子项: `POST /spaces/{space_id}/children`
- 移除子项: `DELETE /spaces/{space_id}/children/{room_id}`
- 层级树: `GET /spaces/{space_id}/hierarchy`
- 层级树 V1: `GET /spaces/{space_id}/hierarchy/v1`
- 树路径: `GET /spaces/{space_id}/tree_path`
- 房间父空间列表: `GET /spaces/room/{room_id}/parents`

**界面结构**:
- 层级树展示（递归渲染）:
  - 根节点: 当前空间
  - 子节点: 子房间 / 子空间（可嵌套）
  - 展开图标（▶/▼）+ 房间/空间图标 + 名称 + 成员数
  - 路径面包屑: 显示从根空间到当前节点的完整路径
- 添加子项对话框:
  - 选择类型: 子房间 / 子空间
  - 选择已有房间或创建新房间
  - 排序权重（`order` 字段）
- 分页: 层级树支持 `from` 游标分页（避免大规模空间加载过慢）

#### 3.4.5 空间成员管理

**后端对应**:
- 成员列表: `GET /spaces/{space_id}/members`
- 空间房间列表: `GET /spaces/{space_id}/rooms`
- 空间状态: `GET /spaces/{space_id}/state`
- 邀请成员: `POST /spaces/{space_id}/invite`
- 加入空间: `POST /spaces/{space_id}/join`
- 离开空间: `POST /spaces/{space_id}/leave`

**界面结构**:
- 成员列表（与房间成员管理类似）:
  - 头像 + 昵称 + 角色（管理员/普通成员）+ 加入时间
  - 操作: 踢出/设置管理员/邀请权限
- 邀请对话框: 搜索用户 + 批量选择 + 发送邀请
- 加入/离开确认对话框

#### 3.4.6 空间摘要（Summary）

**后端对应**:
- 空间摘要: `GET /spaces/{space_id}/summary`
- 含子项摘要: `GET /spaces/{space_id}/summary/with_children`

**界面结构**:
- 空间预览卡片（未加入时展示）:
  - 空间头像 + 名称 + 主题
  - 成员数 + 子房间数
  - 公开/私密标识
  - 加入按钮
- 分享卡片: 在房间内分享空间链接时展示

#### 3.4.7 空间设置

**界面结构**:
- **基本信息**: 名称/主题/头像/描述/别名
- **成员管理**: 成员列表 + 邀请/踢出/角色设置
- **子房间管理**: 添加/移除子房间，排序
- **权限设置**: 空间权限矩阵（谁能邀请/谁能添加子房间等）
- **高级**: 空间可见性、删除空间（二次确认 + 输入空间名验证）

#### 3.4.8 公共空间探索

**后端对应**: `GET /spaces/public`, `GET /spaces/search`

**界面结构**:
- 探索页面: 公共空间网格/列表
- 搜索框: 按名称/主题搜索
- 分类标签: 推荐/热门/最新
- 空间卡片: 头像 + 名称 + 主题 + 成员数 + 加入按钮

### 3.5 媒体模块（media）

**后端对应**: `POST /_matrix/media/v3/upload`, `GET /_matrix/media/v3/download/{serverName}/{mediaId}`, `GET /_matrix/media/v3/preview_url`

#### 3.5.1 文件上传

**界面结构**:
- 拖拽上传: 全屏遮罩 + 中心提示框
- 选择文件: 系统文件选择器
- 上传进度: 缩略图 + 进度条 + 取消按钮
- 上传完成: 自动发送对应类型消息

#### 3.5.2 图片查看器

**界面结构**:
- 全屏黑色背景
- 图片居中展示，支持缩放/旋转/下载
- 左右切换（多图时）
- 底部工具栏: 缩放/旋转/下载/关闭

#### 3.5.3 文件管理器

**后端对应**: media quota API

**界面结构**:
- 文件列表: 网格/列表视图切换
- 文件类型筛选: 全部/图片/视频/文档/其他
- 存储配额: 进度条 + 已用/总量
- 操作: 下载/删除/转发

#### 3.5.4 链接预览

**后端对应**: `GET /_matrix/media/v3/preview_url`

**界面结构**:
- 消息气泡下方显示预览卡片
- 卡片内容: 标题 + 描述 + 缩略图 + URL

### 3.6 端到端加密模块（e2ee + key_backup + key_rotation + verification_routes）

#### 3.6.1 加密状态指示

**界面结构**:
- 消息头部: 锁图标（绿色=已加密/灰色=未加密/红色=加密失败）
- 消息气泡: 加密失败时显示 "无法解密" + 重试按钮
- 房间设置: 加密状态卡片

#### 3.6.2 密钥备份

**后端对应**: `POST /_matrix/client/v3/room_keys/version`, `GET /_matrix/client/v3/room_keys/version`

**界面结构**:
- 设置 > 安全与隐私 > 密钥备份
- 备份状态: 已启用/未启用
- 恢复密钥: 生成/输入/验证
- 导出密钥: 下载文件

#### 3.6.3 设备验证

**后端对应**: `POST /_matrix/client/v3/keys/device_signing/upload`, verification SAS protocol

**界面结构**:
- 验证对话框:
  - SAS（Short Authentication String）: 显示 emoji 对比/数字对比
  - QR 码扫描: 显示/扫描二维码
  - 匹配/不匹配按钮
- 验证成功: 绿色确认动画
- 验证失败: 红色错误提示

#### 3.6.4 交叉签名

**后端对应**: `POST /_matrix/client/v3/keys/device_signing/upload`

**界面结构**:
- 设置 > 安全与隐私 > 交叉签名
- 状态: 已启用/未启用
- 主密钥/自签名密钥/用户签名密钥
- 从其他设备恢复

#### 3.6.5 设备管理

**后端对应**: `GET /_matrix/client/v3/devices`, `DELETE /_matrix/client/v3/devices/{deviceId}`

**界面结构**:
- 设备列表: 设备名称 + ID + 最后活跃时间 + 信任状态
- 操作: 重命名/删除/验证
- 新设备登录通知

### 3.7 通知模块（push + push_notification + push_rules）

#### 3.7.1 通知设置

**后端对应**: `GET /_matrix/client/v3/pushrules/`, `PUT /_matrix/client/v3/pushrules/{scope}/{kind}/{ruleId}`

**界面结构**:
- 全局通知开关
- 按场景分级:
  - 一对一消息
  - 加密一对一消息
  - 群聊消息
  - 加密群聊消息
  - @提及和关键词
  - 邀请
  - 其他
- 每项三态: 关闭/通知/通知+声音
- 关键词管理: 添加/删除触发关键词

#### 3.7.2 桌面通知

**界面结构**:
- 系统原生通知（Tauri 通知 API）
- 通知点击: 跳转到对应会话
- 任务栏图标闪烁（Windows）/ Dock 角标（macOS）

#### 3.7.3 通知中心

**界面结构**:
- 通知列表: 按时间排序
- 通知类型: 消息/好友申请/系统通知
- 操作: 查看/忽略/批量清除

### 3.8 用户设置模块（account_data + account_compat + tags + threepid）

#### 3.8.1 个人资料

**后端对应**: `GET /_matrix/client/v3/profile/{userId}`, `PUT /_matrix/client/v3/profile/{userId}/displayname`

**界面结构**:
- 头像: 圆形 100px + 上传/查看大图
- 显示名称: 输入框
- 状态消息: 输入框（在线/离开/忙碌/隐身）
- 个人简介: 多行文本
- 二维码: 点击显示个人二维码

#### 3.8.2 设置面板

**后端对应**: account_data, feature_flags

**界面结构**:
- 左侧分类导航（240px）:
  - 通用（语言/区域/时区）
  - 外观（主题/字号/消息布局/图片大小）
  - 通知
  - 偏好设置
  - 键盘快捷键
  - 侧边栏
  - 语音和视频
  - 安全与隐私
  - 加密
  - 会话（设备管理）
  - 账号（邮箱/电话/停用账号）
  - Labs（实验功能）
  - 帮助与关于
- 右侧内容区（max-width 960px）

#### 3.8.3 邮箱与手机号管理（三 PID）（v1.3 新增）

> **来源**: [UI-UX优化方案.md](file:///Users/ljf/Desktop/hu_ts/docs/UI-UX优化方案.md) §8.5
> **后端对应**: `threepid.rs` — `GET/POST/DELETE /account/3pid`
> **前端服务**: [MatrixAccountService.ts](file:///Users/ljf/Desktop/hu_ts/hula/src/services/matrix/user/MatrixAccountService.ts) `getThreepids()`/`addThreepid()`/`deleteThreepid()`

**界面结构**:
- **位置**: 设置页 > 账号设置 > 「邮箱与手机号」区块
- **已绑定列表**:
  - 邮箱列表: 地址 + 绑定时间 + 「解绑」按钮
  - 手机号列表: 脱敏显示（`+86 138****1234`）+ 「解绑」按钮
  - 列表项使用 `--hula-surface-panel-muted` 卡片背景
- **添加邮箱表单**: 输入邮箱 → 发送验证码 → 输入验证码 → 确认
- **添加手机号表单**: 国家区号选择（`+86`/`+1` 等）+ 手机号 → 发送短信验证码 → 确认

**技术约束**:
- 邮箱验证使用 UIA（User-Interactive Authentication）流程
- 解绑操作需二次确认（Naive UI `useDialog`）
- 手机号脱敏显示
- 验证码确认调用 `MatrixAccountService.submitEmailToken(token)`

**验收标准**:
- 可添加邮箱并完成验证
- 可添加手机号并完成验证
- 可解绑已绑定的邮箱/手机号（二次确认）
- 手机号脱敏显示正确

### 3.9 VoIP 语音视频通话模块（voip + voice）

> **后端路由**: `GET /_matrix/client/v3/voip/turnServer`, `GET /_matrix/client/v3/voip/config`（见 [voip.rs](file:///Users/ljf/Desktop/hu_ts/synapse-rust/src/web/routes/voip.rs)）
> **Feature Flag**: VoIP 为 L1 标准模块（默认启用）；`voip-tracking` feature 控制通话记录追踪

#### 3.9.1 通话界面与 TURN 服务

**后端对应**:
- TURN 凭证: `GET /voip/turnServer`（返回 `username`、`password`、`uris`、`ttl`）
- VoIP 配置: `GET /voip/config`（返回 `turn_servers` 数组 + `stun_servers` 数组）

**TURN 响应数据**（`TurnServerResponse`）:

| 字段 | 类型 | 说明 |
|------|------|------|
| `username` | string | TURN 用户名（含时效，`ttl` 秒后过期） |
| `password` | string | TURN 密码 |
| `uris` | string[] | TURN 服务器地址列表（`turn:` / `turns:` 协议） |
| `ttl` | number | 凭证有效期（秒，默认 86400 = 24 小时） |

**VoIP 未启用时**: 返回空字段（`username`/`password` 为空字符串，`uris` 为空数组，`ttl` 为 0）

**界面结构**:
- 通话窗口: 独立窗口/全屏覆盖
- 语音通话: 头像 + 名称 + 通话时长 + 静音/挂断/扬声器
- 视频通话: 视频画面（全屏/小窗） + 控制栏
- 多人通话: 宫格布局 + 发言者高亮
- 画中画模式: 缩小为浮动小窗
- 通话前预检: 检查 TURN/STUN 服务器可用性，不可用时提示"网络受限，通话质量可能下降"

**通话生命周期**:
1. 发起方点击语音/视频通话按钮 → 客户端获取 TURN 凭证
2. 通过 `m.call.invite` 事件向对方发送通话邀请（含 SDP offer）
3. 接收方收到邀请 → 显示来电界面（接听/拒绝）
4. 接听 → `m.call.answer` 回复（含 SDP answer）
5. 通话中 ICE 协商完成 → 媒体流建立
6. 挂断 → `m.call.hangup` 通知对方 → 释放媒体资源

#### 3.9.2 语音消息

> **后端路由**: `/_matrix/client/v3/voice/*`, `/_matrix/client/v1/voice/*`, `/_matrix/client/r0/voice/*`（见 [voice.rs](file:///Users/ljf/Desktop/hu_ts/synapse-rust/src/web/routes/voice.rs)）
> **Feature Flag**: `voice`（L3 扩展）
> **协议规范**: MSC3245（Voice Message 语音消息扩展）

**后端端点清单**:

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/voice/config` | 获取语音消息配置 |
| `POST` | `/voice/upload` | 上传语音消息 |
| `GET` | `/voice/stats` | 当前用户全局语音统计 |
| `GET` | `/voice/room/{room_id}/stats` | 房间语音统计 |
| `GET` | `/voice/user/{user_id}/stats` | 指定用户语音统计 |
| `GET` | `/voice/room/{room_id}` | 房间语音消息列表 |
| `GET` | `/voice/user/{user_id}` | 用户语音消息列表 |
| `GET` | `/voice/{media_id}` | 获取语音消息内容 |
| `POST` | `/voice/{media_id}/transcription` | 语音转文字（服务端不支持，客户端处理） |

**语音配置**（`GET /voice/config` 响应）:

| 字段 | 值 | 说明 |
|------|-----|------|
| `enabled` | `true` | 语音消息功能启用 |
| `max_duration` | `600` | 最大时长（秒） |
| `max_duration_ms` | `600000` | 最大时长（毫秒）= 10 分钟 |
| `max_size_bytes` | `52428800` | 最大文件大小 = 50MB |
| `allowed_formats` | `["audio/ogg", "audio/mpeg", "audio/wav", "audio/webm", "audio/mp4", "audio/aac", "audio/flac"]` | 允许的音频格式 |
| `content_type` | `"m.audio"` | Matrix 消息内容类型 |
| `voice_extension` | `"org.matrix.msc3245.voice"` | 语音扩展类型 |
| `auto_transcribe` | `false` | 自动转文字（需客户端实现） |

**上传参数**（`POST /voice/upload` 请求体）:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `content` | string | 是 | Base64 编码的音频数据 |
| `content_type` | string | 否 | MIME 类型（默认 `audio/ogg`） |
| `duration_ms` | number | 是 | 时长（毫秒，必须 > 0） |
| `room_id` | string | 否 | 关联房间 ID（提供时校验成员资格） |
| `waveform` | number[] | 否 | 波形数据（`u16` 数组，用于波形可视化） |

**校验规则**:
- 文件大小 ≤ 50MB
- 必须为音频类型（`audio/*` 或 `application/ogg`）
- `duration_ms` 必须为正数
- 若提供 `room_id`，调用者必须是该房间成员

**列表查询参数**（`GET /voice/room/{room_id}` 和 `GET /voice/user/{user_id}`）:

| 参数 | 类型 | 说明 |
|------|------|------|
| `limit` | number | 每页数量（默认 50，最大 100） |
| `from` | number | 分页偏移（游标） |

**界面结构**:
- **录制界面**:
  - 录制按钮: 长按录制，松开发送（移动端）；按住空格或点击按钮录制（PC 端）
  - 录制中: 实时波形动画 + 已录制时长 + 取消/发送按钮
  - 时长上限: 10 分钟（`max_duration_ms`），接近上限时提示
  - 录制完成自动上传（显示上传进度）
- **播放界面**:
  - 语音条: 波形可视化（来自 `waveform` 字段）+ 播放/暂停按钮 + 时长显示
  - 播放进度: 已播放部分波形高亮（品牌色）
  - 多次播放: 点击波形任意位置跳转
- **语音消息列表**（房间设置 > 语音消息）:
  - 消息列表: 发送者 + 时间 + 时长 + 播放按钮
  - 分页加载（每页 50 条）
- **语音统计**（个人设置 > 语音消息统计）:
  - 全局统计: 总语音消息数、总时长
  - 房间统计: 各房间语音消息数（点击跳转房间语音列表）
- **语音转文字**:
  - 后端返回 501（`unrecognized`），提示"服务端不支持转写"
  - 客户端本地处理: 使用 Web Speech API 或本地 Whisper 模型
  - 转写结果以折叠文本显示在语音条下方（点击展开）

**移动端差异**:
- 录制使用系统原生录音 API（避免 WebView 录音延迟）
- 波形显示简化（采样点减少，降低渲染压力）
- 长按消息可快速转发语音

### 3.10 管理后台模块（admin）

#### 3.10.1 管理后台布局

**后端对应**: admin routes

**界面结构**:
- 独立路由 `/admin`
- 左侧深色导航栏（`--hula-admin-sidebar-bg: #1a1a2e`）
- 右侧内容区（`--hula-admin-bg: #f0f2f5`）
- 顶部用户信息 + 退出按钮

#### 3.10.2 仪表盘

**后端对应**: `GET /_synapse/admin/v1/statistics`

**界面结构**:
- 统计卡片: 注册用户数/活跃用户数/房间数/消息数
- 图表: 用户增长趋势/消息量趋势
- 系统健康: CPU/内存/磁盘使用率

#### 3.10.3 用户管理

**后端对应**: `GET /_synapse/admin/v2/users`, `PUT /_synapse/admin/v2/users/{userId}`

**界面结构**:
- 用户列表表格: 头像/ID/名称/状态/注册时间
- 搜索/筛选
- 用户详情: 资料/会话/账户/操作（禁用/删除/重置密码/管理员设置）

#### 3.10.4 房间管理

**后端对应**: `GET /_synapse/admin/v1/rooms`, `DELETE /_synapse/admin/v1/rooms/{roomId}`

**界面结构**:
- 房间列表表格: 名称/ID/成员数/加密/创建时间
- 操作: 查看/删除/封禁
- 房间详情: 成员列表/消息统计/事件列表

#### 3.10.5 联邦管理

**后端对应**: `GET /_synapse/admin/v1/federation/destinations`

**界面结构**:
- 联邦服务器列表
- 状态: 活跃/失败/断开
- 操作: 重试/封禁

#### 3.10.6 审计日志

**后端对应**: `GET /_synapse/admin/v1/directory/list/audit`

**界面结构**:
- 日志列表: 时间/操作者/操作类型/目标/详情
- 筛选: 按操作类型/操作者/时间范围

#### 3.10.7 注册令牌

**后端对应**: `GET /_synapse/admin/v1/registration_tokens`

**界面结构**:
- 令牌列表: 令牌/用途/使用次数/有效期/状态
- 操作: 创建/编辑/删除/禁用

#### 3.10.8 安全设置

**后端对应**: admin security routes

**界面结构**:
- 注册控制: 开放/关闭/需审批
- 联邦控制: 允许/黑名单/白名单
- IP 限制
- 密码策略

#### 3.10.9 服务器配置

**后端对应**: admin server config routes

**界面结构**:
- 服务器名称
- 联邦端口
- 媒体存储路径
- 数据库连接
- 速率限制配置

#### 3.10.10 其他管理页面

| 页面 | 后端 | 功能 |
|------|------|------|
| 通知管理 | admin notification | 服务器通知/公告 |
| 应用服务 | admin appservice | AppService 注册/管理 |
| 审核面板 | moderation | 举报处理/内容审核 |
| 数据保留 | retention | 保留策略/清理任务 |
| 服务器日志 | server logs | 实时日志查看 |
| 联邦监控 | federation monitor | 联邦状态监控 |
| SAML 配置 | saml | SAML SSO 配置 |
| 维护 | maintenance | 数据库维护/缓存清理 |
| 访客管理 | guests | 访客列表/管理 |
| 空间管理 | spaces | 空间列表/管理 |

#### 3.10.11 事件举报管理

> **后端路由**: `/_synapse/admin/v1/event_reports/*`（见 [event_report.rs](file:///Users/ljf/Desktop/hu_ts/synapse-rust/src/web/routes/event_report.rs)）
> **权限**: 需管理员权限（`AdminUser`）

**管理端点清单**:

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/event_reports` | 举报列表（分页，支持 `limit`/`since_id`/`since_ts`/`since_score`） |
| `POST` | `/event_reports` | 创建举报（用户端也可调用） |
| `GET` | `/event_reports/{id}` | 举报详情 |
| `GET` | `/event_reports/by-event/{event_id}` | 按事件 ID 查举报 |
| `GET` | `/event_reports/{id}/history` | 举报处理历史 |
| `PUT` | `/event_reports/{id}` | 更新举报状态/评分 |
| `POST` | `/event_reports/{id}/resolve` | 解决举报（需 `reason`） |
| `POST` | `/event_reports/{id}/dismiss` | 驳回举报（需 `reason`） |
| `POST` | `/event_reports/{id}/block-user` | 封禁被举报用户（需 `blocked_until` 时间戳 + `reason`） |
| `GET` | `/event_reports/stats` | 举报统计（按日期聚合） |

**举报数据模型**（`ReportResponse`）:

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | number | 举报 ID |
| `event_id` | string | 被举报事件 ID |
| `room_id` | string | 房间 ID |
| `reporter_user_id` | string | 举报人 |
| `reported_user_id` | string? | 被举报人 |
| `reason` | string? | 举报原因 |
| `description` | string? | 详细描述 |
| `status` | string | 状态（`open`/`resolved`/`dismissed`） |
| `score` | number | 严重程度（`-100` ~ `100`） |
| `received_ts` | number | 接收时间戳 |
| `resolved_ts` | number? | 解决时间戳 |
| `resolved_by` | string? | 处理人 |
| `resolution_reason` | string? | 解决原因 |

**统计响应**（`GET /event_reports/stats`）:

| 字段 | 类型 | 说明 |
|------|------|------|
| `date` | string | 统计日期 |
| `total_reports` | number | 总举报数 |
| `open_reports` | number | 待处理数 |
| `resolved_reports` | number | 已解决数 |
| `dismissed_reports` | number | 已驳回数 |
| `avg_resolution_time_hours` | number? | 平均处理时长（小时） |

**界面结构**（管理后台 > 内容审核 > 举报管理）:
- **举报列表页**:
  - 筛选栏: 状态（全部/待处理/已解决/已驳回）+ 时间范围 + 严重程度 + 搜索
  - 列表表格: ID + 举报人 + 被举报人 + 房间 + 原因 + 评分 + 状态 + 时间
  - 待处理举报红色标记，高评分优先排序
  - 点击行进入详情页
- **举报详情页**:
  - 被举报消息预览（渲染原始事件内容）
  - 举报信息: 举报人 + 原因 + 描述 + 评分 + 时间
  - 处理历史时间线（`history` 接口）
  - 操作按钮:
    - 解决（弹出原因输入框）
    - 驳回（弹出原因输入框）
    - 封禁用户（设置封禁截止时间 + 原因）
    - 查看被举报用户其他举报
- **统计仪表盘**:
  - 趋势图: 每日举报量（按状态堆叠）
  - 指标卡: 待处理数 / 今日新增 / 平均处理时长 / 解决率
  - 热门原因分布饼图

#### 3.10.12 外部服务集成管理

> **后端路由**: `/_synapse/admin/v1/external_services/*`（见 [external_service.rs](file:///Users/ljf/Desktop/hu_ts/synapse-rust/src/web/routes/external_service.rs)）
> **Feature Flag**: `external_service`（L3 扩展）
> **权限**: 需管理员权限

**支持的服务类型**（`ExternalServiceType`）:

| 类型 | 标识 | 说明 |
|------|------|------|
| TrendRadar | `trendradar` | 趋势雷达服务 |
| OpenClaw | `openclaw` | AI 聊天服务（需 `openclaw-routes` feature） |
| 通用 Webhook | `generic_webhook` / `webhook` | 通用 Webhook 集成 |
| IRC 桥接 | `irc_bridge` / `irc` | IRC 协议桥接 |
| Slack 桥接 | `slack_bridge` / `slack` | Slack 协议桥接 |
| Discord 桥接 | `discord_bridge` / `discord` | Discord 协议桥接 |
| 自定义 | `custom` | 自定义服务集成 |

**管理端点**:

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/external_services` | 注册外部服务 |
| `GET` | `/external_services` | 列出服务（支持 `service_type` 筛选） |
| `GET` | `/external_services/{as_id}` | 服务详情 |
| `PUT` | `/external_services/{as_id}` | 更新配置 |
| `DELETE` | `/external_services/{as_id}` | 注销服务 |
| `POST` | `/external_services/{as_id}/health` | 健康检查 |
| `POST` | `/external_services/webhook/{service_id}` | Webhook 回调入口 |

**注册请求参数**（`RegisterExternalServiceBody`）:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `service_type` | string | 是 | 服务类型（见上表） |
| `service_id` | string | 是 | 服务唯一标识 |
| `display_name` | string | 是 | 显示名称 |
| `webhook_url` | string | 否 | Webhook 回调 URL |
| `api_key` | string | 否 | API 密钥 |
| `config` | object | 否 | 自定义配置 JSON |

**Webhook 认证**（支持三种方式）:
- `Authorization: Bearer <token>` 头
- `X-Webhook-Token` 头
- `X-API-Key` 头
- `X-Webhook-Signature` 头（签名验证）

**服务响应数据**（`ExternalServiceResponse`）:

| 字段 | 类型 | 说明 |
|------|------|------|
| `as_id` | string | 应用服务 ID（`{service_type}_{service_id}` 格式） |
| `service_type` | string | 服务类型 |
| `service_id` | string | 服务 ID |
| `display_name` | string | 显示名称 |
| `is_enabled` | boolean | 是否启用 |
| `is_healthy` | boolean | 健康状态 |
| `created_ts` | number | 创建时间戳 |

**界面结构**（管理后台 > 集成 > 外部服务）:
- **服务列表页**:
  - 类型筛选: 全部 / TrendRadar / Webhook / 桥接服务 / 自定义
  - 服务卡片: 名称 + 类型徽章 + 启用状态 + 健康指示灯 + 创建时间
  - 操作: 编辑 / 健康检查 / 删除
- **注册服务页**:
  - 服务类型选择（下拉/卡片选择）
  - 基本信息: 服务 ID + 显示名称
  - Webhook 配置: URL + 认证方式 + API 密钥
  - 自定义配置: JSON 编辑器
- **Webhook 日志**:
  - 回调记录列表: 时间 + 服务 + 状态码 + 耗时
  - 请求/响应详情查看

#### 3.10.13 功能模块管理（v1.3 新增）

> **来源**: [UI-UX优化方案.md](file:///Users/ljf/Desktop/hu_ts/docs/UI-UX优化方案.md) §8.8
> **后端对应**: `module.rs` — 模块加载/卸载/查询
> **SDK 管理器**: `matrix-js-sdk/src/module/`

**界面结构**:
- **位置**: 管理后台 > 「功能模块」页面（路由 `/admin/modules`）
- **模块列表**:
  - 列项: 模块名称 + 版本 + 状态徽章 + 描述
  - 状态过滤: 已加载 / 未加载 / 加载失败
  - 状态标识: `--hula-status-online`（已加载）/ `--hula-status-busy`（加载中）/ `--hula-status-offline`（失败）
- **详情抽屉**: 依赖关系 + 配置项 + 日志
- **技术约束**: 列表使用 [VirtualList.vue](file:///Users/ljf/Desktop/hu_ts/hula/src/components/common/VirtualList.vue)，详情使用 [AreaDrawer.vue](file:///Users/ljf/Desktop/hu_ts/hula/src/components/common/AreaDrawer.vue)

**验收标准**:
- 管理后台可访问模块管理页
- 模块列表显示名称、版本、状态
- 可按状态过滤
- 点击模块查看详情

#### 3.10.14 审核工作台（v1.3 新增）

> **来源**: [UI-UX优化方案.md](file:///Users/ljf/Desktop/hu_ts/docs/UI-UX优化方案.md) §8.10
> **后端对应**: `admin/report.rs` + `event_report.rs`
> **前端服务**: [MatrixEventReportService.ts](file:///Users/ljf/Desktop/hu_ts/hula/src/services/matrix/moderation/MatrixEventReportService.ts)

**界面结构**:
- **位置**: 管理后台 > 「审核工作台」（路由 `/admin/moderation`）
- **举报队列**:
  - Tab 切换: 待处理 / 处理中 / 已解决
  - 列项: 举报人 + 被举报事件 + 举报原因 + 时间 + 操作按钮
  - 高优先级举报使用 `--hula-color-danger-100` 标识
- **操作按钮**: 忽略 / 隐藏事件 / 封禁用户 / 升级处理
- **批量操作**: 多选 + 批量处理
- **事件预览**: 使用 [HulaMessageMeta.vue](file:///Users/ljf/Desktop/hu_ts/hula/src/components/rightBox/renderMessage/HulaMessageMeta.vue) 渲染

**技术约束**:
- 批量操作需二次确认
- 操作记录写入审计日志（[AdminFacadeService.ts](file:///Users/ljf/Desktop/hu_ts/hula/src/services/matrix/admin/AdminFacadeService.ts)）

**验收标准**:
- 可查看待处理举报列表
- 可处理举报（忽略/隐藏/封禁）
- 操作记录写入审计日志
- 支持批量处理

### 3.11 AI 助手模块（openclaw + ai_connection）

#### 3.11.1 AI 聊天界面

**后端对应**: `openclaw-routes` feature

**界面结构**:
- 独立 AI 聊天页面
- 对话列表: 历史对话
- 聊天区: 类似消息时间线
- AI 模型选择: 下拉选择模型
- 输入区: 文本输入 + 发送
- 代码块: 语法高亮 + 复制按钮
- 流式输出: 打字机效果

#### 3.11.2 AI 连接管理

**后端对应**: `ai_connection` feature

**界面结构**:
- AI 服务列表
- 添加连接: API Key/Endpoint/模型
- 测试连接
- 默认模型设置

### 3.12 阅后即焚模块（burn_after_read）

> **后端路由**: `/_matrix/client/v1/rooms/{room_id}/burn/*`, `/_matrix/client/v3/rooms/{room_id}/burn/*`, `/_matrix/client/v1/user/burn/*`, `/_matrix/client/v3/user/burn/*`（见 [burn_after_read.rs](file:///Users/ljf/Desktop/hu_ts/synapse-rust/src/web/routes/burn_after_read.rs)）
> **Feature Flag**: `burn-after-read`（L3 扩展）

#### 3.12.1 房间级阅后即焚配置

**后端对应**:
- 开启/获取设置: `PUT/GET /rooms/{room_id}/burn`
- 待销毁列表: `GET /rooms/{room_id}/burn/pending`
- 标记已读（触发销毁）: `POST /rooms/{room_id}/burn/{event_id}`
- 取消销毁: `DELETE /rooms/{room_id}/burn/{event_id}`

**请求参数**（`PUT /rooms/{room_id}/burn`）:

| 参数 | 类型 | 说明 |
|------|------|------|
| `enabled` | boolean | 是否启用（默认 true） |
| `burn_after_ms` | number | 焚毁延迟毫秒数（默认 60000 = 1 分钟） |

**界面结构**:
- 房间设置 > 阅后即焚:
  - 开关切换: 启用/禁用
  - 焚毁时间选择器: 预设选项（10s/30s/1min/5min/10min/30min/1h）+ 自定义
  - 当前待销毁消息数显示
  - 提示文案: "开启后，新发送的消息在对方阅读后将自动销毁"

#### 3.12.2 消息标记与销毁流程

**销毁流程**:

```
用户发送消息
    │
    ▼
消息存入房间（带 burn 标记）
    │
    ▼
接收方阅读 → POST /rooms/{room_id}/burn/{event_id}
    │
    ▼
后端调度销毁任务（delete_ts = now + burn_after_ms）
    │
    ▼
倒计时期间可取消 → DELETE /rooms/{room_id}/burn/{event_id}
    │
    ▼
到达 delete_ts → 消息从数据库删除 → 通知客户端移除 → 客户端移除该消息
```

**界面表现**:
- **发送方视角**:
  - 消息气泡右上角显示焚毁图标（火焰图标）
  - 消息底部显示倒计时进度条（剩余时间）
  - 已被对方阅读后: 消息变灰 + "将在 X 秒后销毁" 文案
  - 销毁后: 消息替换为 "消息已销毁" 占位（半透明）
- **接收方视角**:
  - 消息气泡显示焚毁图标
  - 阅读后自动触发销毁倒计时
  - 倒计时期间显示剩余时间
  - 销毁动画: 消息渐隐 + 火焰特效 + 收缩占位

#### 3.12.3 待销毁消息管理

**后端对应**: `GET /rooms/{room_id}/burn/pending`

**响应数据**:

| 字段 | 类型 | 说明 |
|------|------|------|
| `event_id` | string | 事件 ID |
| `created_at` | number | 创建时间戳 |
| `delete_ts` | number | 预计销毁时间戳 |

**界面结构**:
- 房间设置 > 阅后即焚 > 待销毁消息:
  - 消息列表: 消息预览 + 创建时间 + 剩余时间（倒计时）
  - 操作: 取消销毁（恢复为普通消息，仅管理员/发送者可操作）
  - 空列表: "暂无待销毁消息"

#### 3.12.4 全局配置与统计

**后端对应**:
- 全局配置: `PUT /user/burn/config`（`default_burn_ms` 默认焚毁时间）
- 用户统计: `GET /user/burn/stats`

**统计响应**:

| 字段 | 类型 | 说明 |
|------|------|------|
| `total_burned` | number | 累计已销毁消息数 |
| `total_pending` | number | 当前待销毁消息数 |
| `rooms_with_burn_enabled` | number | 启用阅后即焚的房间数 |

**界面结构**（设置 > 安全与隐私 > 阅后即焚）:
- 全局默认焚毁时间: 下拉选择（与房间级预设一致）
- 统计卡片:
  - 累计销毁消息数
  - 当前待销毁消息数
  - 启用房间数
- 开启房间列表: 点击可快速跳转到对应房间设置

#### 3.12.5 移动端差异

- 倒计时显示更紧凑（仅显示秒数，不显示进度条）
- 销毁动画使用更轻量的渐隐效果（性能考虑）
- 长按消息可快速取消销毁（若在倒计时期内）

### 3.13 私密聊天模块（dm）

> **后端路由**: `/_matrix/client/v3/direct`, `/_matrix/client/v3/direct/{room_id}`, `/_matrix/client/v3/rooms/{room_id}/dm`, `/_matrix/client/v3/rooms/{room_id}/dm/partner`, `/_matrix/client/r0/create_dm`, `/_matrix/client/v3/create_dm`（见 [dm.rs](file:///Users/ljf/Desktop/hu_ts/synapse-rust/src/web/routes/dm.rs)）
> **与好友模块关系**: 启用 `friends` feature 时，DM 创建走 `friend_room_service`；未启用时走标准 `room_service` 的 `m.direct` account data

#### 3.13.1 DM 房间创建

**后端对应**: `POST /create_dm`（r0/v3 兼容）

**请求参数**（`CreateDmRequest`）:

| 参数 | 类型 | 说明 |
|------|------|------|
| `user_id` | string | 单人 DM 目标用户 ID（可选，与 `invite` 二选一） |
| `invite` | string[] | 邀请用户列表（最多 20 人，多人 DM） |
| `is_direct` | boolean | 是否标记为直聊（默认 true） |
| `name` | string | 房间名称（可选，最大 255 字符） |
| `topic` | string | 房间主题（可选，最大 1024 字符） |
| `visibility` | string | 可见性（默认 `private`） |

**创建逻辑**:
1. 单人 DM（invite 长度 = 1）: 优先复用已有 DM 房间（通过 `m.direct` 映射查找）
2. 多人 DM（invite 长度 > 1）: 创建新房间，`room_type` 设为 `m.direct`
3. 启用 friends feature 时: 通过 `create_or_reuse_direct_message_room` 创建，自动维护好友-DM 关联

**界面结构**:
- **从好友列表发起 DM**: 点击"发消息"按钮，调用 `POST /friends/dm/{user_id}` 或 `POST /create_dm`
- **新建对话入口**:
  - 选择联系人（单人或多人，最多 20 人）
  - 输入房间名称（多人 DM 时显示）
  - 确认创建
- **创建后行为**: 自动跳转到聊天界面

#### 3.13.2 DM 房间列表

**后端对应**: `GET /direct`（r0/v3 兼容）

**响应数据**（`m.direct` 映射）:

```json
{
  "@user1:server": ["!room1:server", "!room2:server"],
  "@user2:server": ["!room3:server"]
}
```

**界面结构**:
- 会话列表中的 DM 房间特殊标识:
  - 头像显示对方头像（单人 DM）或多人头像组合（多人 DM）
  - 名称显示对方昵称（单人 DM）或房间名称（多人 DM）
  - DM 标识图标（锁图标或人物图标）
- DM 过滤标签: 会话列表顶部"直聊"筛选

#### 3.13.3 DM 房间更新

**后端对应**: `PUT /direct/{room_id}`

**请求参数**（`UpdateDmRequest`）:

| 参数 | 类型 | 说明 |
|------|------|------|
| `users` | string[] 或 object | 关联的用户 ID 列表（替换模式） |
| `content` | object | 完整的 `m.direct` 对象（覆盖模式） |

**界面结构**:
- 房间设置 > DM 管理:
  - 当前关联用户列表
  - 添加/移除关联用户
  - 说明文案: "管理与此直聊关联的联系人"

#### 3.13.4 DM 房间检查与伙伴信息

**后端对应**:
- 检查是否 DM: `GET /rooms/{room_id}/dm`
- 获取 DM 伙伴: `GET /rooms/{room_id}/dm/partner`

**响应数据**（DM 伙伴）:

| 字段 | 类型 | 说明 |
|------|------|------|
| `room_id` | string | 房间 ID |
| `user_id` | string | 对方用户 ID |
| `display_name` | string | 对方显示名称 |
| `avatar_url` | string | 对方头像 URL |

**界面使用场景**:
- 聊天头部显示对方信息（单人 DM）
- 发起通话时确定目标用户
- 邀请第三方时显示当前 DM 成员

#### 3.13.5 DM 与好友联动（friends feature 启用时）

**后端对应**: `POST /friends/dm/{user_id}`（创建/复用好友 DM）, `GET /friends/dm/{user_id}`（获取好友 DM）

**界面联动**:
- 好友列表点击"发消息" → 自动创建或复用 DM
- 删除好友时提示: "是否同时离开直聊房间？"
- 好友详情页显示"发消息"按钮，若已有 DM 则直接进入

#### 3.13.6 私密聊天模式（v1.3 新增）

> **来源**: [UI-UX优化方案.md](file:///Users/ljf/Desktop/hu_ts/docs/UI-UX优化方案.md) §6.1
> **参考**: [admin-and-private-chat-ui.md](file:///Users/ljf/Desktop/hu_ts/docs/admin-and-private-chat-ui.md)

**入口设计**:

| 平台 | 位置 | 图标 | 激活状态 |
|------|------|------|---------|
| **PC 端** | 聊天界面顶部工具栏 | **S** 字母（`--hula-text-tertiary` 灰色） | 图标变红 + 微弱红色光晕 |
| **移动端** | 顶部导航栏右侧 | **S** 字母（16px） | 红色图标 + 红点指示器 |

- **图标顺序**: [搜索] [语音] [视频] [**S**私密] [更多]
- **点击行为**: 弹出确认对话框（二次确认，防误触）

**界面变化**:

| 元素 | PC 端 | 移动端 |
|------|-------|--------|
| **头部** | 房间名称左侧添加 🔒 锁图标（红色） | 微弱红色渐变背景 + 🔒 图标 |
| **提示条** | 顶部 32px 红色半透明提示条（可关闭） | 底部红色提示条 |
| **消息气泡** | 发送消息红色背景，接收消息红色边框 | 红色渐变/边框 |
| **输入框** | 左侧添加 🔥 阅后即焚开关 | 工具栏添加 🔥 阅后即焚按钮 |

**阅后即焚功能**:

- **发送方**: 消息气泡右上角 🔥 火焰图标 → 对方阅读后显示 30 秒倒计时 → 销毁后显示"🔥 消息已销毁"占位
- **接收方**: 首次阅读触发阅读确认 → 显示倒计时"此消息将在 30 秒后销毁" → 销毁动画: 渐隐 + 火焰特效

**防截屏功能**:

| 平台 | 实现方式 |
|------|---------|
| **PC 端** | 水印: 用户ID + 时间，半透明灰色，45度倾斜，每 200px 一个；截屏检测发送系统消息通知 |
| **Android** | `FLAG_SECURE` 标志 |
| **iOS** | 屏幕录制检测 + 内容模糊 |

**验收标准**:
- 点击 S 按钮弹出确认对话框
- 私密模式下消息气泡变红色主题
- 阅后即焚消息 30 秒后自动销毁
- 截屏时发送系统消息通知
- 移动端适配正确

### 3.14 位置共享模块（beacons）

**后端对应**: `beacons` feature

**界面结构**:
- 地图视图: 全屏地图
- 位置标记: 用户头像 + 当前位置
- 共享控制: 开始/停止共享
- 路线轨迹: 历史路径线
- 时效设置: 共享时长

### 3.15 Widget 小组件模块（widget）

> **后端路由**: `/_matrix/client/v1/widgets/*`, `/_matrix/client/v3/widgets/*`, `/_matrix/client/v1/rooms/{room_id}/widgets/*`（见 [widget.rs](file:///Users/ljf/Desktop/hu_ts/synapse-rust/src/web/routes/widget.rs)）
> **Feature Flag**: `widgets`（L3 扩展）
> **安全约束**: Widget URL 必须为 `https:` 或 `http:` 协议（后端 `validate_widget_url` 强制校验，拒绝 `javascript:`、`data:`、`file:` 等危险协议）

#### 3.15.1 Widget 管理

**后端对应**:
- 创建: `POST /widgets` 或 `POST /widgets/create`
- 查询: `GET /widgets/{widget_id}` / `GET /rooms/{room_id}/widgets`
- 更新: `PUT /widgets/{widget_id}`
- 删除: `DELETE /widgets/{widget_id}`
- 配置: `GET /widgets/{widget_id}/config`

**创建参数**（`CreateWidgetBody`）:

| 参数 | 类型 | 说明 |
|------|------|------|
| `room_id` | string | 关联房间 ID（可选，房间级 Widget） |
| `widget_type` | string | Widget 类型 |
| `url` | string | Widget URL（必须 https/http） |
| `name` | string | Widget 名称 |
| `data` | object | 自定义数据（JSON） |

**界面结构**:
- 房间设置 > Widget 管理:
  - Widget 列表: 名称 + 类型 + 状态（active/inactive）+ 创建者
  - 添加 Widget:
    - Widget 类型选择（Jitsi/看板/投票/自定义）
    - URL 输入（实时校验 https/http 协议）
    - 名称输入
    - 配置数据（JSON 编辑器，高级模式）
  - 编辑 Widget: 修改 URL/名称/数据
  - 删除 Widget: 二次确认
  - 权限提示: 仅房间管理员或创建者可管理 Widget

#### 3.15.2 Widget 权限管理

**后端对应**:
- 设置权限: `POST /widgets/{widget_id}/permissions`
- 获取权限: `GET /widgets/{widget_id}/permissions`
- 删除权限: `DELETE /widgets/{widget_id}/permissions/{user_id}`

**权限模型**:

| 权限 | 说明 |
|------|------|
| `read` | 查看 Widget |
| `write` | 编辑 Widget 数据 |
| `*` | 通配符，所有权限 |

**界面结构**:
- Widget 权限设置页:
  - 用户列表 + 权限选择（read/write/*）
  - 添加用户权限（搜索用户 + 选择权限）
  - 移除用户权限
  - 房间成员默认有 read 权限（房间级 Widget）

#### 3.15.3 Widget 会话管理

**后端对应**:
- 创建会话: `POST /widgets/{widget_id}/sessions`
- 获取会话: `GET /widgets/sessions/{session_id}`
- 会话列表: `GET /widgets/{widget_id}/sessions`
- 终止会话: `DELETE /widgets/sessions/{session_id}`

**界面结构**:
- Widget 会话管理（高级设置）:
  - 活跃会话列表: 设备 ID + 创建时间 + 过期时间
  - 终止会话按钮
  - 创建会话: 设置过期时间（`expires_in_ms`）

#### 3.15.4 房间 Widget 能力配置

**后端对应**:
- 获取能力: `GET /rooms/{room_id}/widgets/{widget_id}/capabilities`
- 设置能力: `PUT /rooms/{room_id}/widgets/{widget_id}/capabilities`

**界面结构**:
- Widget 能力配置对话框:
  - 能力列表（多选）: 如 `messaging`、`notifications`、`timeline` 等
  - 保存按钮

#### 3.15.5 Jitsi 视频会议集成

**后端对应**: `GET /rooms/{room_id}/widgets/jitsi/config`

**响应数据**:

| 字段 | 类型 | 说明 |
|------|------|------|
| `conf_id` | string | 会议 ID |
| `name` | string | 会议名称 |
| `domain` | string | Jitsi 域名（默认 meet.jit.si） |
| `app_id` | string | 应用 ID |
| `jwt` | string | JWT 令牌 |

**界面结构**:
- 视频通话按钮（房间头部）:
  - 点击发起 Jitsi 会议
  - 会议窗口: iframe 嵌入 Jitsi
  - 会议链接分享: 复制会议链接到剪贴板

#### 3.15.6 Widget 容器界面

**界面结构**:
- 房间内 Widget 区域（右侧面板或底部展开）:
  - Widget iframe 容器（圆角 `--hula-radius-lg`）
  - 顶部标题栏: Widget 名称 + 操作按钮（全屏/刷新/关闭）
  - 加载状态: 骨架屏 + loading 指示器
  - 错误状态: 显示错误信息 + 重试按钮
  - 全屏模式: Widget 占满整个内容区

### 3.16 动态/朋友圈模块

**界面结构**:
- 动态列表: 卡片式展示
- 发布动态: 文字 + 图片/视频
- 互动: 点赞/评论/转发
- 隐私: 公开/好友/指定

### 3.17 第三方协议与桥接模块（thirdparty）

> **后端路由**: `/_matrix/client/v3/thirdparty/*`, `/_matrix/client/r0/thirdparty/*`（见 [thirdparty.rs](file:///Users/ljf/Desktop/hu_ts/synapse-rust/src/web/routes/thirdparty.rs)）
> **用途**: 通过应用服务桥接 IRC / Slack / Discord 等第三方协议网络，实现跨平台消息互通

**端点清单**:

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/thirdparty/protocols` | 列出所有已注册协议 |
| `GET` | `/thirdparty/protocol/{protocol}` | 获取指定协议详情 |
| `GET` | `/thirdparty/location/{protocol}` | 按协议搜索位置（频道/房间） |
| `GET` | `/thirdparty/user/{protocol}` | 按协议搜索用户 |
| `GET` | `/thirdparty/location` | 通过 Matrix 房间别名反查第三方位置 |
| `GET` | `/thirdparty/user` | 通过 Matrix 用户 ID 反查第三方用户 |

**协议数据模型**:

```json
{
  "instances": [],
  "user_fields": ["displayname", "avatar_url"],
  "location_fields": ["alias", "name"]
}
```

**查询参数**（`GET /thirdparty/location/{protocol}` 和 `GET /thirdparty/user/{protocol}`）:

| 参数 | 类型 | 说明 |
|------|------|------|
| `search` | string | 搜索关键词 |
| `alias` | string | 按别名精确匹配（location） |
| `channel` | string | 按频道名搜索（location） |
| `server` | string | 指定服务器（location） |

**界面结构**:
- **桥接网络入口**（设置 > 桥接与集成）:
  - 已连接协议列表: 协议图标 + 名称 + 实例数 + 连接状态
  - 每个协议可展开查看实例列表
- **第三方用户搜索**（添加好友 > 跨平台搜索）:
  - 协议选择下拉框（IRC / Slack / Discord 等）
  - 搜索框: 输入昵称/ID
  - 结果列表: 第三方头像 + 昵称 + 协议标识 + "添加为 Matrix 联系人"按钮
- **第三方频道浏览**（探索 > 跨平台频道）:
  - 协议选择
  - 频道列表: 频道名 + 主题 + 成员数 + "加入"按钮
  - 加入后自动创建桥接 Matrix 房间
- **桥接房间标识**:
  - 房间头部显示桥接来源图标（如 IRC 图标）
  - 房间设置 > 桥接信息: 显示原始协议 + 频道 + 桥接服务
  - 桥接用户消息显示来源标识（如 `[irc] user: message`）

**移动端差异**:
- 第三方搜索合并到全局搜索（自动检测协议）
- 桥接房间使用简化图标标识

### 3.18 其他模块

| 模块 | 后端 | 界面需求 |
|------|------|---------|
| 已读回执 | ephemeral | 消息底部显示已读用户头像 |
| 置顶消息 | pinned | 房间顶部横幅展示置顶消息 |
| 房间标签 | tags | 会话列表项右侧标签图标 |
| 粘性事件 | sticky_event | 房间顶部固定通知 |
| 在线状态 | presence | 头像状态点 + 状态文字 |
| 功能标志 | feature_flags | 管理后台功能开关 |
| 联邦 | federation | 联邦管理界面 |
| 三方 ID | threepid | 邮箱/手机绑定 |
| 后台更新 | background_update | 数据库迁移进度 |
| 遥测 | telemetry | 使用统计（匿名） |
| 邀请黑名单 | invite_blocklist | 防骚扰设置 |
| 来宾访问 | guest | 来宾用户限制 |
| 房间摘要 | room_summary | 房间预览卡片 |
| 滑动同步 | sliding_sync | 优化同步性能（无直接 UI） |
| 工作器 | worker | 后台任务管理（无直接 UI） |

---

## 4. 响应式设计要求

### 4.1 断点定义

```scss
$breakpoints: (
  'sm': 576px,   // 手机横屏
  'md': 768px,   // 平板竖屏
  'lg': 992px,   // 平板横屏/小桌面
  'xl': 1200px,  // 标准桌面
  '2xl': 1400px  // 大桌面
);
```

### 4.2 PC 端适配规则

#### 4.2.1 大屏（≥ 1200px）

- 三栏并行展示: 左侧栏(64px) + 中间栏(320px) + 右侧栏(flex-1)
- 右侧面板可展开详情抽屉（宽度 360px）
- 消息时间线最大宽度 800px 居中

#### 4.2.2 中屏（992px - 1199px）

- 三栏并行: 左侧栏(64px) + 中间栏(280px) + 右侧栏(flex-1)
- 右侧详情抽屉改为覆盖层
- 消息时间线最大宽度 100%

#### 4.2.3 小屏（768px - 991px）

- 两栏: 中间栏 + 右侧栏（左侧栏改为可折叠图标条）
- 消息时间线全宽
- 设置面板改为全屏覆盖

### 4.3 移动端适配规则

#### 4.3.1 手机竖屏（< 768px）

- 单栏堆叠布局
- 栈式导航: 列表 → 详情 → 子详情
- 底部 Tab 栏: 消息/好友/我的
- 滑动手势: 左滑返回
- 安全区适配: `env(safe-area-inset-*)`
- 消息输入框: 点击展开全屏编辑模式

#### 4.3.2 手机横屏（576px - 767px）

- 可选双栏: 列表 + 详情
- 消息时间线优化为紧凑模式

#### 4.3.3 平板（≥ 768px）

- 可选双栏或三栏
- 支持分屏模式

#### 4.3.4 中间栏宽度持久化（v1.3 新增）

> **来源**: [UI-UX优化方案.md](file:///Users/ljf/Desktop/hu_ts/docs/UI-UX优化方案.md) §4.2

- **持久化存储**: 中间栏拖拽宽度存入 `settingStore.panelWidth.left`，启动时恢复
- **拖拽范围**: 240px - 360px（`Math.min(360, Math.max(240, newWidth))`）
- **拖拽实现**: 使用 `pointermove` 事件（兼容触摸），拖拽时添加 `cursor: col-resize` 全局样式
- **持久化机制**: `persist: true` 确保宽度跨重启保持
- **验收标准**: 拖拽分隔条可调整中间栏宽度（240-360px），重启应用后宽度恢复

#### 4.3.5 移动端横屏双栏适配（v1.3 新增）

> **来源**: [UI-UX优化方案.md](file:///Users/ljf/Desktop/hu_ts/docs/UI-UX优化方案.md) §4.3

- **横屏判断**: `window.innerWidth > window.innerHeight && window.innerWidth >= 768`（基于视口尺寸而非 `orientation` 属性）
- **横屏行为**: 切换为双栏布局（列表 + 详情），利用宽屏空间
- **监听方式**: `matchMedia('(orientation: landscape)')` 监听横竖屏切换
- **状态保持**: 切换时保持当前路由状态（不丢失选中会话），使用 `keep-alive` 缓存列表组件
- **验收标准**: 横屏（宽 ≥768px）时显示双栏，竖屏恢复单栏，切换时无闪烁

### 4.4 交互差异

| 交互行为 | PC 端 | 移动端 |
|---------|-------|--------|
| 消息操作 | 悬停显示操作栏 | 长按弹出菜单 |
| 上下文菜单 | 右键 | 长按 |
| 选择多个 | Ctrl+点击 | 进入多选模式 |
| 文件上传 | 拖拽/点击 | 系统选择器 |
| 滚动 | 鼠标滚轮 | 触摸滑动 |
| 返回 | 浏览器/按钮 | 手势滑动/按钮 |
| 文本复制 | 选中+Ctrl+C | 长按选中+复制 |
| 搜索 | Ctrl+F | 下拉搜索框 |

---

## 5. 组件规范

### 5.1 基础组件

#### 5.1.1 按钮（Button）

| 类型 | 背景 | 文字 | 圆角 | 用途 |
|------|------|------|------|------|
| Primary | `--hula-color-primary-500` | `--hula-text-inverse` | `--hula-radius-sm` | 主要操作 |
| Secondary | `--hula-surface-subtle` | `--hula-text-primary` | `--hula-radius-sm` | 次要操作 |
| Danger | `--hula-color-danger-500` | `--hula-text-inverse` | `--hula-radius-sm` | 危险操作 |
| Ghost | transparent | `--hula-color-primary-500` | `--hula-radius-sm` | 轻量操作 |
| Disabled | `--hula-surface-subtle` | `--hula-text-disabled` | `--hula-radius-sm` | 禁用 |

**状态**: default → hover（变亮 10%）→ active（变暗 10%）→ disabled

#### 5.1.2 输入框（Input）

- 高度: 36px（默认）/ 32px（紧凑）
- 圆角: `--hula-radius-sm`
- 边框: `1px solid --hula-border-default`
- 聚焦: `1px solid --hula-color-primary-500` + `box-shadow: 0 0 0 2px --hula-color-primary-200`
- 占位符: `--hula-text-quaternary`
- 禁用: 背景 `--hula-surface-subtle`，文字 `--hula-text-disabled`

#### 5.1.3 头像（Avatar）

- 尺寸: 24px / 32px / 40px / 48px / 100px
- 圆形: `--hula-radius-full`
- 在线状态点: 右下角，尺寸为头像的 1/4
- 默认头像: `--avatar-fallback-src`（`/logoD.png` 亮色 / `/logoL.png` 暗色）
- 边框: `2px solid --avatar-border-color`

#### 5.1.4 徽章（Badge）

- 数字徽章: `--hula-color-primary-500` 背景，白色文字，`--hula-radius-full`
- @ 提及徽章: `--hula-color-danger-500` 背景
- 标签徽章: 语义色 100 背景 + 语义色 500 文字

#### 5.1.5 卡片（Card）

- 背景: `--hula-surface-panel`
- 圆角: `--hula-radius-lg`
- 阴影: `--hula-shadow-card`
- 悬停: `--hula-shadow-card-hover`
- 内边距: `--hula-space-4`

### 5.2 导航组件

#### 5.2.1 侧边导航栏（Sidebar）

- 宽度: 64px（Windows）/ 68px（macOS 26+）
- 背景: `--hula-surface-sidebar`
- 导航项: 图标(24px) + 文字标签（`--hula-font-size-xs`）
- 选中态: 背景 `--hula-surface-sidebar-selected` + 左侧品牌色竖条
- 悬停态: 背景 `--hula-surface-sidebar-hover`

#### 5.2.2 标签栏（Tabs）

- 下划线样式: 选中项底部 `2px solid --hula-color-primary-500`
- 胶囊样式: 选中项背景 `--hula-color-primary-100` + 文字 `--hula-color-primary-500`

#### 5.2.3 面包屑（Breadcrumb）

- 分隔符: `/` 或 `>`
- 字号: `--hula-font-size-sm`
- 最后项: `--hula-text-primary`，其余 `--hula-text-tertiary`

### 5.3 数据展示组件

#### 5.3.1 列表（List）

- 列表项高度: 48px（标准）/ 64px（带描述）/ 72px（带头像）
- 分隔线: `1px solid --hula-border-muted`（列表项底部）
- 悬停: 背景 `--hula-surface-list-hover`
- 选中: 背景 `--hula-color-primary-100`

#### 5.3.2 表格（Table）

- 表头: 背景 `--hula-surface-panel-muted`，`--hula-font-weight-semibold`
- 行高: 48px
- 行分隔线: `1px solid --hula-border-muted`
- 悬停行: 背景 `--hula-surface-panel-muted`

#### 5.3.3 虚拟列表（VirtualList）

- 用于房间列表/消息时间线等长列表
- 仅渲染可见区域 + 缓冲区（上下各 5 项）
- 滚动条: 6px 宽，`--hula-border-strong` 颜色

### 5.4 反馈组件

#### 5.4.1 对话框（Modal/Dialog）

- 遮罩: `rgba(0,0,0,0.4)`
- 内容: `--hula-surface-panel` 背景，`--hula-radius-xl` 圆角，`--hula-shadow-dialog` 阴影
- 宽度: 400px（小）/ 520px（中）/ 720px（大）
- 动画: 淡入 + 上移 16px，`--hula-motion-duration-overlay`

#### 5.4.2 抽屉（Drawer）

- 从右侧滑入
- 宽度: 360px（PC）/ 100%（移动端）
- 遮罩: `rgba(0,0,0,0.4)`
- 动画: `--hula-motion-duration-overlay`

#### 5.4.3 Toast 通知

- 位置: 右上角 / 顶部居中
- 类型: 成功（绿）/警告（黄）/错误（红）/信息（蓝）
- 持续时间: 3s（普通）/ 5s（错误）
- 动画: 淡入 + 下移

#### 5.4.4 加载状态

- Spinner: 旋转圆形，`--hula-color-primary-500`
- 骨架屏: `--hula-surface-subtle` 背景 + 脉冲动画
- 进度条: `--hula-color-primary-500` 填充 + `--hula-surface-subtle` 背景

#### 5.4.5 骨架屏覆盖扩展（v1.3 新增）

> **来源**: [UI-UX优化方案.md](file:///Users/ljf/Desktop/hu_ts/docs/UI-UX优化方案.md) §3.1

**骨架屏变体**:

| 变体 | 适用场景 | 结构 |
|------|---------|------|
| `SkeletonFriendList` | 好友列表 | 头像（40px 圆形）+ 名称行 + 状态行 |
| `SkeletonSpaceTree` | 空间树 | 层级缩进 + 图标 + 文字 |
| `SkeletonSettings` | 设置页 | 左导航 + 右表单 |
| `SkeletonDmList` | DM 列表 | 头像 + 名称 + 消息预览 |

**技术约束**:
- 接受 `rows` prop 控制行数（默认 5）
- shimmer 动画使用 `--hula-motion-duration-slow`（240ms）+ `--hula-motion-ease-standard`
- 骨架屏尺寸与实际内容尺寸一致（避免布局跳动，CLS < 0.1）
- 暗色模式使用 `--hula-surface-panel-muted` 背景

### 5.5 图标规范

- 使用 **SVG** 图标（禁止 div-based 图标）
- 默认尺寸: 16px / 20px / 24px
- 颜色: `currentColor` 继承文本色
- 线宽: 1.5px（默认）/ 2px（强调）

---

## 6. 交互细节

### 6.1 消息发送流程

1. 用户输入文本 → 发送按钮激活
2. 点击发送/回车 → 消息立即显示在时间线（乐观更新）
3. 消息状态: 发送中（spinner） → 已发送（单勾） → 已送达（双勾） → 已读（双勾蓝色）
4. 发送失败 → 消息变红 + 重试按钮
5. 网络断开 → 输入框上方提示"网络已断开"

### 6.2 消息操作

| 操作 | 触发方式 | 交互效果 |
|------|---------|---------|
| 回复 | 悬停 → 回复按钮 | 输入框上方显示引用卡片 |
| 编辑 | 悬停 → 更多 → 编辑 | 消息变为可编辑状态 |
| 转发 | 悬停 → 更多 → 转发 | 弹出联系人选择器 |
| 撤回 | 悬停 → 更多 → 撤回 | 确认对话框 → 消息变为"已撤回" |
| 删除 | 悬停 → 更多 → 删除 | 确认对话框 → 消息消失 |
| 复制 | 悬停 → 更多 → 复制 | 文本复制到剪贴板 |
| 举报 | 悬停 → 更多 → 举报 | 弹出举报对话框 |
| 反应 | 悬停 → 表情按钮 | 弹出表情选择器 |
| 多选 | 悬停 → 多选按钮 | 进入多选模式，底部操作栏 |

### 6.3 文件拖拽

1. 拖拽文件进入窗口 → 全屏半透明遮罩 + 中心提示框
2. 松开鼠标 → 自动上传并发送
3. 拖拽离开 → 遮罩消失

### 6.4 搜索交互

1. 点击搜索框/快捷键 Ctrl+K → 搜索框聚焦
2. 输入关键词 → 实时搜索（防抖 300ms）
3. 结果分类: 消息/联系人/房间/文件
4. 键盘导航: 上下箭头选择，回车确认
5. 清除按钮: 点击清空搜索

### 6.5 主题切换

1. 设置 > 外观 > 主题
2. 选项: 跟随系统/亮色/暗色
3. 切换时平滑过渡（`transition: background-color 0.3s, color 0.3s`）
4. 首次加载: 读取 localStorage，首绘前设置 `data-theme`

### 6.6 动画效果

| 场景 | 动画 | 时长 |
|------|------|------|
| 页面切换 | 淡入淡出 | 240ms |
| 模态框 | 淡入 + 上移 | 280ms |
| 抽屉 | 右滑入 | 280ms |
| Toast | 淡入 + 下移 | 180ms |
| 列表项悬停 | 背景渐变 | 120ms |
| 按钮按下 | 缩放 0.98 | 120ms |
| 消息发送 | 上移淡入 | 180ms |
| 未读徽章 | 弹跳 | 240ms |
| 在线状态点 | 脉冲 | 2s 循环 |

### 6.7 按钮涟漪反馈（v1.3 新增）

> **来源**: [UI-UX优化方案.md](file:///Users/ljf/Desktop/hu_ts/docs/UI-UX优化方案.md) §3.2

- **`v-ripple` 自定义指令**: 品牌色按钮、列表项、图标按钮点击产生涟漪效果
- **涟漪行为**: 从点击位置扩散，使用 `--hula-motion-ease-standard` + 300ms
- **技术约束**:
  - 涟漪元素 `position: absolute` + `pointer-events: none`，不影响布局
  - 尊重 `prefers-reduced-motion: reduce`（禁用动画）
  - 300ms 后自动移除涟漪元素

### 6.8 创建房间流程分阶段（v1.3 新增）

> **来源**: [UI-UX优化方案.md](file:///Users/ljf/Desktop/hu_ts/docs/UI-UX优化方案.md) §5.1

**两阶段流程**（从 5 步缩减为 2 步）:

1. **必填阶段**: 房间类型选择（群聊/频道/空间卡片）+ 房间名称输入 → 「创建」按钮
2. **可选阶段**: 创建成功后弹出「邀请成员」步骤（可跳过）

**默认值**: `preset: 'private_chat'`、`encryption: true`（创建后可在房间设置修改）

**验收标准**: 输入名称 + 选择类型 → 点击创建 → 2 秒内进入房间；邀请成员步骤可跳过

### 6.9 设置页快速搜索（v1.3 新增）

> **来源**: [UI-UX优化方案.md](file:///Users/ljf/Desktop/hu_ts/docs/UI-UX优化方案.md) §5.2

- **位置**: [SettingsDialog.vue](file:///Users/ljf/Desktop/hu_ts/hula/src/views/settingsWindow/SettingsDialog.vue) 顶部搜索框
- **行为**: 搜索时过滤左侧导航 + 高亮匹配项（`--hula-color-primary-100`），回车跳转第一个匹配项
- **快捷键**: `Ctrl+,` 聚焦搜索框
- **搜索索引**: 从 i18n key 动态生成（支持中英文）

### 6.10 好友搜索结果即时展示（v1.3 新增）

> **来源**: [UI-UX优化方案.md](file:///Users/ljf/Desktop/hu_ts/docs/UI-UX优化方案.md) §5.3

- **位置**: [FriendListView.vue](file:///Users/ljf/Desktop/hu_ts/hula/src/components/friend/FriendListView.vue)
- **行为**: 搜索关键词非空时自动切换到搜索结果列表，清空时恢复好友列表
- **技术约束**: 防抖 300ms + 高亮匹配文本 + 无结果显示空状态插图 + 搜索不改变 URL

---

## 7. 页面跳转与导航逻辑

### 7.1 PC 端导航结构

```
登录页 → 首页（三栏布局）
          ├── /message（消息列表 + 聊天）
          ├── /friendsList（好友列表）
          ├── /roomList（房间列表）
          ├── /spaceList（空间工作台）
          ├── /robot（AI 助手）
          ├── /trendradar（动态）
          ├── /mail（邮件）
          ├── /fileManager（文件管理）
          ├── /settings（设置弹窗）
          ├── /admin/*（管理后台）
          ├── /rtcCall（通话窗口）
          ├── /chat-history（聊天历史）
          ├── /previewFile（文件预览）
          └── /multiMsg（聚合消息）
```

### 7.2 移动端导航结构

```
登录页 → 移动首页（底部 Tab）
          ├── /mobile/message（消息列表）
          │     └── /mobile/chatRoom/chatMain（聊天）
          │           ├── /mobile/chatRoom/setting（房间设置）
          │           ├── /mobile/chatRoom/groupChatMember（成员列表）
          │           ├── /mobile/chatRoom/searchContent（搜索）
          │           ├── /mobile/chatRoom/mediaViewer（媒体查看）
          │           ├── /mobile/chatRoom/thread（线程）
          │           └── /mobile/chatRoom/notice（公告）
          ├── /mobile/friends（好友）
          │     ├── /mobile/mobileFriends/addFriends（添加好友）
          │     ├── /mobile/mobileFriends/startGroupChat（发起群聊）
          │     └── /mobile/mobileFriends/friendInfo（好友详情）
          ├── /mobile/my（我的）
          │     ├── /mobile/mobileMy/editProfile（编辑资料）
          │     ├── /mobile/mobileMy/settings（设置）
          │     │     ├── securityPrivacy
          │     │     ├── devices
          │     │     ├── notifications
          │     │     ├── voiceVideo
          │     │     ├── labs
          │     │     ├── burnAfterRead
          │     │     └── ...
          │     ├── /mobile/mobileMy/myQRCode（二维码）
          │     ├── /mobile/mobileMy/share（分享）
          │     └── /mobile/mobileMy/aiAssistant（AI 助手）
          ├── /mobile/rooms（房间列表）
          ├── /mobile/dynamic（动态）
          └── /mobile/admin/*（管理后台）
```

### 7.3 路由守卫

- **authGuard**: 未登录 → 跳转登录页
- **requiresAdmin**: 非管理员 → 跳转 403 页面
- **keepAlive**: 消息列表/好友列表/我的页面保持状态

### 7.4 窗口管理（Tauri）

| 窗口 | 用途 | 尺寸 |
|------|------|------|
| home | 主窗口 | 1000x700 |
| notify | 通知窗口 | 360x80 |
| tray | 托盘窗口 | 200xauto |
| callWindow | 通话窗口 | 480x640 |
| imageViewer | 图片查看 | 全屏 |
| videoViewer | 视频查看 | 全屏 |
| chatHistory | 聊天历史 | 800x600 |
| multiMsg | 聚合消息 | 600x400 |
| previewFile | 文件预览 | 全屏 |
| about | 关于 | 400x300 |
| lockScreen | 锁屏 | 全屏 |

---

## 8. 特殊场景处理

### 8.1 加载状态

| 场景 | 展示方式 |
|------|---------|
| 首次加载 | 全屏 LoadingSpinner + 进度百分比 |
| 会话切换 | 消息区域骨架屏 |
| 列表加载 | 列表项骨架屏 |
| 按钮提交 | 按钮 loading spinner |
| 图片加载 | 模糊占位图 + 淡入动画 |
| 上传中 | 缩略图 + 进度条 |
| 搜索中 | 搜索框内 spinner |

### 8.2 错误提示

| 场景 | 展示方式 |
|------|---------|
| 网络断开 | 顶部红色横幅 "网络已断开" + 重连按钮 |
| 消息发送失败 | 消息气泡变红 + 重试按钮 |
| 登录失败 | 表单下方红色错误文字 |
| 权限不足 | Toast "您没有权限执行此操作" |
| 服务器错误 | Toast "服务器错误，请稍后重试" |
| 加密失败 | 消息显示 "无法解密" + 锁图标变红 |
| 文件过大 | Toast "文件大小超过限制" |
| 房间已满 | 对话框提示 + 升级引导 |

### 8.3 空数据展示

| 场景 | 展示内容 |
|------|---------|
| 无会话 | 插图 + "还没有消息，开始聊天吧" + 创建按钮 |
| 无好友 | 插图 + "还没有好友" + 添加按钮 |
| 无搜索结果 | "未找到相关结果" |
| 无通知 | "暂无通知" |
| 无文件 | "暂无文件" |
| 无动态 | "暂无动态" + 发布按钮 |
| 无权限 | "您没有访问权限" + 返回按钮 |

#### 8.3.1 空状态插图规范（v1.3 新增）

> **来源**: [UI-UX优化方案.md](file:///Users/ljf/Desktop/hu_ts/docs/UI-UX优化方案.md) §3.4

**核心场景插图**:

| 场景 | SVG 插图 | 引导操作 |
|------|---------|---------|
| 无会话 | 聊天图标 | "开始新对话" 按钮 |
| 无好友 | 握手图标 | "添加好友" 按钮 |
| 无空间 | 空间图标 | "创建空间" 按钮 |
| 无搜索结果 | 放大镜图标 | "尝试其他关键词" 文案 |

**技术约束**:
- SVG 内联（遵循 UI 元素必须使用 SVG 而非 div 图标的约束）
- 插图描边色: `--hula-text-quaternary`
- 引导按钮使用品牌色 `--hula-color-primary-500`
- SVG 在亮色/暗色模式下均可见
- 点击引导按钮跳转正确页面

### 8.4 网络重连

1. 网络断开 → 顶部红色横幅
2. 自动重连（指数退避: 1s, 2s, 4s, 8s, 16s, 30s）
3. 重连中 → 横幅变为 "正在重连..."
4. 重连成功 → 横幅消失 + 增量同步
5. 重连失败 → 横幅变为 "连接失败" + 手动重连按钮

### 8.5 隐私模式

- 启用后: 全屏水印（用户 ID + 时间）
- 截图检测: 提示截图行为
- 隐私遮罩: 应用切到后台时模糊内容

### 8.6 离线模式

- 本地缓存消息展示
- 未发送消息队列
- 重连后自动同步
- 离线指示器

---

## 9. 可访问性要求

### 9.1 合规标准

目标达到 **WCAG 2.1 AA 级** 合规。

### 9.2 键盘导航

- 所有交互元素可通过 Tab 键到达
- 焦点顺序符合视觉阅读顺序（从上到下、从左到右）
- 焦点可见: `:focus-visible` 样式（`outline: 2px solid --hula-color-primary-500`）
- Esc 键关闭模态框/抽屉
- Enter/Space 激活按钮
- 方向键导航列表/标签页
- Ctrl+K 聚焦搜索
- 无键盘陷阱（模态框关闭后焦点返回触发元素）

### 9.3 屏幕阅读器支持

- 语义化 HTML: `<nav>`, `<main>`, `<aside>`, `<button>`, `<a>`
- ARIA 标签:
  - `aria-label` 用于图标按钮
  - `aria-live="polite"` 用于动态消息
  - `aria-live="assertive"` 用于错误提示
  - `aria-expanded` 用于可折叠区域
  - `aria-selected` for 列表项
  - `role="dialog"` for 模态框
- 跳转链接: "跳到主内容"（Tab 首个焦点）

### 9.4 对比度

| 文本类型 | 要求 | 验证 |
|---------|------|------|
| 正文 | ≥ 4.5:1 | `--hula-text-primary` vs `--hula-surface-panel` |
| 大文本（≥ 18px） | ≥ 3:1 | `--hula-text-secondary` vs `--hula-surface-panel` |
| 交互元素边框 | ≥ 3:1 | `--hula-border-default` vs `--hula-surface-panel` |
| 焦点指示器 | ≥ 3:1 | `--hula-color-primary-500` vs 背景 |

### 9.5 动效偏好

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

### 9.6 高对比度支持

- 提供高对比度主题变体
- 监听 `prefers-contrast: more` 自动应用
- 增强: 边框加粗、阴影加深、图标增大

### 9.7 字体可缩放

- 支持 12px - 24px 字号调节
- 使用 `rem` 单位（基准 14px）
- 不使用固定 `px` 尺寸（图标除外）

### 9.8 颜色不依赖

- 不仅用颜色传达信息（同时用图标/文字）
- 状态点: 颜色 + 形状区分（在线=圆点/忙碌=三角/离开=半月）
- 错误: 红色 + 图标 + 文字描述

### 9.9 平台兼容性

| 平台 | 最低版本 | 特殊处理 |
|------|---------|---------|
| Windows | 10 | 原生通知、任务栏闪烁 |
| macOS | 12 | safe-area、Dock 角标 |
| Linux | Ubuntu 20.04 | 通知兼容 |
| iOS | 15 | safe-area、手势导航 |
| Android | 8 (API 26) | WebView 兼容、返回键 |

### 9.10 国际化

- 支持 zh-CN / en 双语
- 文本不硬编码，全部通过 i18n
- RTL 布局预留（`dir="rtl"`）
- 日期/时间本地化
- 数字格式化

---

## 附录

### A. 参考资源

| 资源 | 链接 |
|------|------|
| Element Web 仓库 | https://github.com/element-hq/element-web |
| Compound 设计系统 | https://compound.element.io/ |
| Element Web 文档 | https://web-docs.element.dev/ |
| Shared Components Storybook | https://shared-components-storybook.element.dev/ |
| Theming 指南 | https://web-docs.element.dev/theming.html |
| MVVM 文档 | https://github.com/element-hq/element-web/blob/develop/docs/MVVM.md |
| WCAG 2.1 AA | https://www.w3.org/WAI/WCAG2AA-Conformance |
| Hula Design Tokens | `src/styles/css/design-tokens.css` |
| Hula UnoCSS 配置 | `uno.config.ts` |
| Synapse-rust 路由 | `src/web/routes/mod.rs` |

### B. 设计 Token 快速查阅

完整设计 Token 定义参见: [design-tokens.css](file:///Users/ljf/Desktop/hu_ts/hula/src/styles/css/design-tokens.css)

### C. 后端路由清单

完整路由模块清单参见: [mod.rs](file:///Users/ljf/Desktop/hu_ts/synapse-rust/src/web/routes/mod.rs)
