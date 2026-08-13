# TJG (HuLa IM) 界面设计文档

> 依据 `docs/TJG-prototype.html` 原型设计稿整理，并结合当前代码库（`src/views` + `src/components`）核验差异。
> 生成日期：2026-08-13

---

## 一、设计系统（Design Tokens）

### 1.1 颜色体系

原型采用**青绿色（Teal）**品牌色，支持深色 / 浅色双主题。当前代码已迁移至 `--tjg-*` 前缀，主色与原型一致。

| Token | 深色主题 | 浅色主题 | 当前代码对应（`--tjg-*`） |
|:---|:---|:---|:---|
| 品牌主色 accent | `#13987f` | `#0f7a66` | `--tjg-brand: #13987f` ✅ |
| 品牌强色 | `#0f7a65` | `#0a5c4d` | `--tjg-color-primary-600: #0f7a66` |
| 品牌弱色 | `#10806a` | `#13987f` | `--tjg-color-primary-400: #1ab292` |
| 发送气泡 | `#0f7a65` | `#0f7a66` | `--tjg-bubble-sent-bg: #0f7a65` ✅ |
| 接收气泡 | `#355b55` | `#e8f5f0` | `--tjg-bubble-received-bg: #355b55` ✅ |
| 背景最深 | `#000000` | `#ffffff` | — |
| 背景深 | `#161616` | `#f5f5f5` | `--tjg-surface-sidebar` |
| 背景中 | `#1b1b1b` / `#262626` | `#fafafa` / `#ffffff` | `--tjg-surface-panel` |
| 背景浅 | `#2d2d2d` | `#f0f0f0` | `--tjg-surface-app` |
| 悬浮背景 | `#323232` | `#eaeaea` | `--tjg-surface-list-hover` |
| 弹层背景 | `#303030` | `#ffffff` | — |
| 主文字 | `#ffffff` | `#18181c` | `--tjg-text-primary` |
| 次文字 | `#b1b1b1` | `#505050` | `--tjg-text-secondary` |
| 弱文字 | `#909090` | `#909090` | `--tjg-text-muted` |
| 极弱文字 | `#858585` | `#b0b0b0` | `--tjg-text-faint` |
| 图标色 | `#c1c1c1` | `#595959` | — |
| 分割线 | `#404040` | `#e3e3e3` | `--tjg-border-default` |
| 错误 | `#da8583` | — | `--tjg-color-danger-500` |
| 警告 | `#f4c375` | — | `--tjg-color-warning` |
| 信息 | `#6ba3f8` | — | `--tjg-color-info-500` |
| 成功 | `#10b981` | — | `--tjg-color-success` |
| 联邦蓝 | `#6ba3f8` | — | — |
| Beta 紫 | `#a789d9` | — | `--tjg-color-purple-500` |

### 1.2 字体规范

| 属性 | 值 |
|:---|:---|
| 字体族 | `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif` |
| 代码字体 | `monospace`（消息代码块） |
| 文字层级 | 主文字 / 次文字 / 弱文字 / 极弱文字（四级灰阶） |

### 1.3 尺寸与布局

| 页面/视口 | 尺寸 |
|:---|:---|
| PC 登录窗口 | 420 × 580 |
| 移动端登录 | 375 × 812 |
| PC 桌面端 | 1200 × 760 |
| 移动端 | 375 × 812 |

PC 桌面端为**三栏布局**：导航栏（第一栏）+ 列表面板（第二栏）+ 内容区（第三栏）。

---

## 二、全局布局框架

### 2.1 PC 桌面端框架

```
┌─────────────────────────────────────────────────────────────┐
│ titlebar：交通灯 + 全局搜索框 + 联邦状态 + 头像               │
├─────────────────────────────────────────────────────────────┤
│ conn-banner：连接状态横幅（永不白屏）                         │
├──────┬──────────────────┬───────────────────────────────────┤
│ nav  │ room-list-panel  │ chat-panel（聊天主区）              │
│ bar  │ 空间快捷入口      │  ├ chat-header                     │
│ 头像 │ 空间树形导航      │  ├ message-list                    │
│ 消息 │ 会话过滤器        │  ├ reply-preview-bar               │
│ 好友 │ 房间列表          │  └ msg-input                       │
│ 房间 │                  │                                    │
│ 空间 │                  │ 浮动面板：thread / pinned / info    │
│ 机器人│                  │                                    │
│ 联邦 │                  │                                    │
│ 设置 │                  │                                    │
│ 管理 │                  │                                    │
└──────┴──────────────────┴───────────────────────────────────┘
```

**导航栏（nav-bar）8 个图标 + 头像**（原型定义）：

| 图标 | 语义 | 图标标识 | 视图 |
|:---|:---|:---|:---|
| 头像 | 个人中心 | `av-2` | — |
| 消息 | 消息列表 | `i-chat`（带未读 badge） | view-message |
| 好友 | 联系人 | `i-users` | view-contacts |
| 房间 | 房间列表 | `i-room`（带拱门的房间） | view-rooms |
| 空间 | 空间列表 | `i-space`（3D 立方体） | view-spaces |
| 机器人 | TJG-ChatBot | `i-bot` | view-robot |
| 联邦 | 联邦服务器 | `i-globe` | view-federation |
| 设置 | 设置 | `i-settings` | view-settings |
| 管理后台 | 仅管理员可见 | `i-wrench` | view-admin |

### 2.2 移动端框架

```
┌─────────────────────┐
│ dynamic-island      │
│ iOS 状态栏 (9:41)    │
│ conn-banner 横幅     │
├─────────────────────┤
│ m-header：标题+操作  │
│ m-search 搜索框      │
├─────────────────────┤
│ m-content：内容区    │
├─────────────────────┤
│ 底部 Tab 导航        │
└─────────────────────┘
```

移动端 6 个页面（`mobile-page`）：消息 / 空间 / 联系人 / 房间 / 我的 / 聊天。

---

## 三、各页面设计

### 3.1 登录 / 注册页

**PC 登录（420×580）**：
- 顶部 macOS 交通灯（红黄绿）
- 头像（圆形）+ 登录表单
- 表单字段：服务器地址（含高级服务器设置折叠）、账号/邮箱、密码（含可见性切换）
- 协议勾选：《服务协议》《隐私保护指引》
- 渐变登录按钮
- 第三方登录：Gitee / GitHub / GitCode / 微信
- 底部操作栏：二维码登录、更多菜单

**当前实现**：`src/views/loginWindow/Login.vue`（+ `QRCode.vue` 二维码登录）、`src/views/registerWindow/index.vue`（注册）、`src/views/forgetPasswordWindow/index.vue`（忘记密码）。

### 3.2 主界面（消息视图 view-message）

- **第二栏（房间列表）**：
  - 标题「消息」+ 添加/更多按钮
  - 空间快捷入口（头像式快捷入口 + 收藏 + 添加）
  - 空间树形导航（可折叠，展示空间 → 子频道）
  - 会话过滤器：全部 / 未读 / 群聊 / 单人
  - 房间列表（由 JS 渲染）
- **第三栏（聊天区）**：
  - 私密模式提示条（阅后即焚等）
  - 聊天头部（房间名、成员数、操作）
  - 消息列表
  - 回复预览条（reply-preview-bar）
  - 消息输入框（含 @提及、附件、表情、语音）
  - 浮动面板：房间内搜索（inRoomSearchPanel）、线程（threadPanel）、置顶（pinnedPanel）、群信息（infoPanel）

**当前实现**：`src/layout/index.vue`（三栏）+ `src/views/homeWindow/message/index.vue`（消息）+ `src/components/rightBox/*`（聊天区组件）。

### 3.3 联系人（view-contacts）

- 视图头部：「联系人」+ 操作按钮
- 联系人列表（好友分组、在线状态、最近活跃时间）

**当前实现**：`src/views/homeWindow/FriendsList.vue`。

### 3.4 房间（view-rooms）

- 视图头部：「房间」+ 操作按钮
- 房间列表（房间卡片：头像、名称、成员数、类型）

**当前实现**：`src/views/homeWindow/RoomList.vue`。

### 3.5 空间（view-spaces）

- 视图头部：「空间」+ 空间切换器（下拉搜索空间）+ 搜索 + 创建空间
- 空间内容（空间卡片/树形导航，由 JS 渲染）

**当前实现**：`src/views/homeWindow/SpaceList.vue`。

### 3.6 机器人（view-robot，TJG-ChatBot）

- **侧边栏**：品牌标题「TJG-ChatBot Beta」、用户信息（含配额/过期时间）、会话列表、底部操作（设置/GitHub、新的聊天/全部删除）
- **主区域**：欢迎页 / 对话（由 JS 渲染）

**当前实现**：`src/plugins/robot/index.vue` + `src/views/openclaw/OpenClawView.vue`（OpenClaw 已替代机器人）。

### 3.7 联邦（view-federation）

- 视图头部：「联邦」+ 刷新按钮
- 统计卡（联邦服务器统计）
- 服务器列表（由 JS 渲染）

> ⚠️ **当前桌面端缺联邦主视图**，联邦能力仅存在于管理后台的 `federation-monitor` 页面。

### 3.8 设置（view-settings）

**侧边栏 14 个菜单项**（原型定义）：

| # | 菜单项 | 图标 | data-stab |
|:---|:---|:---|:---|
| 1 | 通用设置 | `i-settings` | general |
| 2 | 账号管理 | `i-user` | account |
| 3 | 偏好设置 | `i-sliders` | preferences |
| 4 | 通知提醒 | `i-bell` | notification |
| 5 | 快捷键 | `i-key` | shortcut |
| 6 | 语音视频 | `i-mic` | voiceVideo |
| 7 | 存储管理 | `i-file` | storage |
| 8 | 账号安全 | `i-shield-check` | security |
| 9 | 加密设置 | `i-lock` | encryption |
| 10 | 阅后即焚 | `i-flame` | burnAfterRead |
| 11 | 外观主题 | `i-palette`（标「新」） | appearance |
| 12 | 实验室 | `i-flask` | labs |
| 13 | AI 连接 | `i-bot` | aiConnection |
| 14 | 帮助关于 | `i-info` | helpAbout |

**当前实现**：`src/views/settingsWindow/index.vue` + `src/views/settingsWindow/tabs/*`。对比原型缺失：**存储管理（storage）、实验室（labs）、AI 连接（aiConnection）**；当前新增：会话（sessions）、侧边栏（sidebar）。

### 3.9 管理后台（view-admin）

- 侧边栏 + 内容区（dashboard/users/rooms/federation/notices/security/audit/retention/server-logs 等 20+ 子页面）

**当前实现**：`src/views/admin/*`（AdminLayout + 20+ 子页面，已较完整）。

### 3.10 移动端

| 原型页面 | 当前实现 | 状态 |
|:---|:---|:---|
| 消息（mPageMsg） | `/mobile/home` → message tab | ✅ |
| 空间（mPageSpace） | —（home 无 space tab） | ⚠️ 缺失 |
| 联系人（mPageContact） | `/mobile/home` → friends tab | ✅（命名差异） |
| 房间（mPageRoom） | `/mobile/home` → rooms tab | ✅ |
| 我的（mPageMe） | `/mobile/mobileMy` | ✅ |
| 聊天（mPageChat） | `/mobile/chatRoom` | ✅ |
| — | `/mobile/dynamic`（动态） | 扩展项 |

---

## 四、核心组件清单

| 组件 | 原型定位 | 当前代码位置 |
|:---|:---|:---|
| 连接状态横幅 conn-banner | 永不白屏、可重试/忽略 | `src/components/common/NetworkStatusBar.vue` |
| 导航栏 nav-bar | 8 图标导航 | `src/layout/left/`（ActionList + config.tsx） |
| 房间列表 panel | 会话列表 + 过滤器 | `src/views/homeWindow/*` |
| 聊天面板 chat-panel | 消息流 + 输入框 | `src/components/rightBox/chatBox/*` |
| 消息渲染 | 各类消息体 | `src/components/rightBox/renderMessage/*` |
| 线程面板 thread-panel | 主题帖 | `src/components/thread/ThreadPanel.vue` |
| 置顶面板 pinned-panel | 收藏消息 | `src/components/rightBox/chatBox/*` |
| 群信息面板 info-panel | 成员 + 房间设置 | `src/components/room/*` |
| 房间设置抽屉 | 多 Tab 设置 | `src/components/room/RoomSettingsDrawer.vue` |
| 通话面板 incoming-call-panel | 来电接听 | `src/views/callWindow/*` |

---

## 五、交互行为规范

| 交互 | 原型行为 |
|:---|:---|
| 登录 | 服务器地址可切换（含高级折叠）；密码可见性切换；协议勾选；第三方登录；二维码登录 |
| 导航切换 | 点击导航图标切换视图；图标含 tooltip 与未读 badge |
| 会话过滤 | 全部 / 未读 / 群聊 / 单人 四 Tab 切换 |
| 空间切换 | 空间切换器（下拉搜索、选中切换） |
| 连接状态 | 横幅展示「正在连接/已连接/连接失败」，失败可重试或忽略 |
| 线程 | 打开线程面板、回复、关闭 |
| @提及 | `↑↓ 选择 · Enter 确认 · Esc 取消` |
| 全局搜索 | 快捷键提示「ESC 关闭」 |
| 通话 | 来电面板：接听/挂断/静音/视频开关 |

---

## 六、当前实现与原型差异分析

### 6.1 差异清单

| # | 差异点 | 原型 | 当前实现 | 严重度 |
|:---|:---|:---|:---|:---|
| D1 | 导航栏结构 | 8 图标（消息/好友/房间/空间/机器人/联邦/设置/管理） | 房间/空间/机器人插件 + 文件/邮件 + 更多菜单 | **高** |
| D2 | 「消息」「好友」「联邦」独立入口 | 有 | 缺（消息靠 /message 路由，好友靠 roomList 内入口，联邦缺失） | **高** |
| D3 | 图标语义 | 房间=i-room(拱门)、空间=i-space(立方体)、好友=i-users | 房间=view-grid-card(网格)、空间=peoples-two(多人) | 中 |
| D4 | 联邦主视图 | view-federation（统计卡+服务器列表） | 仅管理后台 federation-monitor | **高** |
| D5 | 设置菜单项 | 14 项（含存储/实验室/AI连接/阅后即焚） | 缺 storage/labs/aiConnection | 中 |
| D6 | 移动端「空间」页 | mPageSpace 独立页 | home 无 space tab | 中 |
| D7 | 功能扩展 | — | 动态/邮件/文件管理/趋势雷达/openclaw 等 | 有意扩展 |

### 6.2 差异原因分析

1. **历史演进未同步**：当前导航沿用了早期「插件列表 + 更多菜单」模式（`left/config.tsx` 的 `basePluginsList`），未按新原型 8 图标模式重构。
2. **组件未同步更新**：原型迭代新增「联邦」「空间」等视图后，主布局导航（`layout/left`）未跟随增加对应入口。
3. **死代码残留**：`src/components/thread/ThreadView.vue`（桌面端，零引用）、`src/services/discovery/adapters/static.ts`（废弃 StaticRegistry）等死文件未清理，说明多次重构后存在清理遗漏。
4. **代码冲突/失效引用**：e2e 测试 `room-settings-live.spec.ts` 引用了已不存在的 store 路径（`/src/stores/domains/chat/chat/session.ts`、`/src/stores/domains/widget/global.ts`），说明 store 迁移后引用未同步。
5. **样式覆盖**：设计 token 已统一迁移到 `--tjg-*`，但组件内仍有局部硬编码样式覆盖设计规范（如 left 栏的 `--left-icon-color` 等旧变量）。
6. **功能有意扩展**：项目在原型基础上新增了动态、邮件、文件管理、趋势雷达、OpenClaw 等功能，这部分差异属于产品演进，非缺陷。

### 6.3 冗余文件清理结果

| 文件 | 类型 | 处理 |
|:---|:---|:---|
| `src/components/thread/ThreadView.vue` | 死代码（桌面端，零引用，被移动端版替代） | ✅ 已 `git rm` |
| `src/services/discovery/adapters/static.ts` | 废弃（StaticRegistry 被 ConsulRegistry 取代） | ✅ 已 `git rm` |
| 22 个 `.DS_Store` | macOS 系统垃圾（git 未跟踪） | ✅ 已删除 |
| `.storybook/setup-file.ts` | knip 误报（被 vitest.config 引用） | 保留 |
| 9 个 devDependencies | knip 误报（vite 插件） | 保留 |
| e2e 失效引用（3 处） | store 路径迁移后未同步 | 待修复 |

---

## 七、样式规范速查

- **主色**：`#13987f`（Teal），hover 用 `--tjg-surface-list-hover`，激活用主色边框/文字
- **气泡**：发送 `#0f7a65`（深色）/ `#0f7a66`（浅色），接收 `#355b55`（深色）/ `#e8f5f0`（浅色）
- **圆角**：消息气泡、头像、卡片统一圆角（卡片 `--tjg-radius-sm`，弹层 `--tjg-radius-lg`）
- **阴影**：弹层 `--tjg-shadow-lg`
- **间距**：导航栏图标间距 10px，列表项 padding 12px 上下
- **过渡**：`--tjg-motion-duration-fast` / `normal`，缓动 `--tjg-motion-ease-standard`
- **无障碍**：导航图标含 `aria-label` + tooltip；连接横幅 `role="status"` + `aria-live="polite"`；支持 `prefers-reduced-motion` 降级

---

## 八、对齐建议（按优先级）

1. **P0**：恢复「联邦」主视图入口（导航图标 + 视图，复用后端 federation 模块）。
2. **P0**：导航栏重构为原型 8 图标模式，补齐「消息」「好友」独立入口，修正房间/空间图标语义。
3. **P1**：设置页补齐 storage / labs / aiConnection 菜单项。
4. **P1**：修复 e2e 失效引用（更新 store 路径）。
5. **P2**：移动端补「空间」页；统一左栏旧变量（`--left-*`）到 `--tjg-*`。
6. **P2**：功能扩展项（动态/邮件/文件管理）纳入导航一致性评估，避免与原型冲突。
