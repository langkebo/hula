# UI统一与优化详细方案

## 文档信息

- 版本: `v1.0.0`
- 生成时间: `2026-04-26 09:03:55`
- 基准声明: 本方案以桌面端当前已实际启用的 `simple` 风格为唯一视觉基准，不再保留 `default` 桌面皮肤作为并行设计来源。
- 适用范围: 桌面端主工作区、设置窗口、房间/空间相关界面、公共组件库、主题系统

## 1. 统一目标

- 只保留一套桌面端视觉体系: `simple` 配色、单一圆角、单一阴影、单一字号梯度、单一组件行为。
- 只保留一套设置容器: `SettingsDialog` 作为唯一设置 Shell，旧 `moreWindow/settings` 仅允许作为迁移期中转，不再承载独立 UI 定义。
- 只保留一套房间/空间工作区范式: 在主工作区内提供统一的“房间/空间”复合组件，而不是并列维护窄栏房间列表、空间侧板、空间整页。
- 只保留一套设计令牌来源: 所有页面与组件只能消费 Design Tokens，不允许直接写品牌色、状态色、阴影色和边框色。

## 2. 视觉基线

### 2.1 配色基线

- 主色:
  - `primary.500 = #13987F`
  - `primary.100 = rgba(19, 152, 127, 0.10)`
  - `primary.200 = rgba(19, 152, 127, 0.20)`
  - `primary.300 = rgba(19, 152, 127, 0.30)`
- 辅色:
  - `accent.surface = #E5E5E6`
  - `accent.border = #E3E3E3`
  - `accent.muted = #F1F1F1`
- 中性色:
  - `neutral.0 = #FFFFFF`
  - `neutral.50 = #FAFAFA`
  - `neutral.100 = #F5F5F5`
  - `neutral.200 = #EAEAEA`
  - `neutral.300 = #D9D9D9`
  - `neutral.500 = #909090`
  - `neutral.700 = #505050`
  - `neutral.900 = #18181C`
- 功能色:
  - `success = #52C41A`
  - `warning = #FAAD14`
  - `danger = #FF4D4F`
  - `info = #1890FF`

### 2.2 布局基线

- 栅格:
  - 桌面主工作区使用 `12` 栏栅格
  - 宽侧边栏/列表区使用 `3` 栏
  - 主要内容区使用 `9` 栏
  - 弹窗/设置页内部使用 `8` 栏表单栅格
- 间距:
  - 基础单位 `4px`
  - 推荐序列: `4 / 8 / 12 / 16 / 20 / 24 / 32 / 40`
- 圆角:
  - `xs = 6px`
  - `sm = 8px`
  - `md = 10px`
  - `lg = 12px`
  - `pill = 999px`
- 阴影:
  - `shadow.sm = 0 1px 2px rgba(0,0,0,0.04)`
  - `shadow.md = 0 4px 12px rgba(0,0,0,0.08)`
  - `shadow.lg = 0 10px 30px rgba(0,0,0,0.12)`
- 字体层级:
  - `display = 24/32 600`
  - `title = 20/28 600`
  - `section = 18/26 600`
  - `body = 14/22 400`
  - `caption = 12/18 400`
  - `micro = 11/16 400`

## 3. Design Tokens 规范

### 3.1 Token 分层

- `core tokens`: 纯基础值，包含颜色、字号、圆角、阴影、间距、动效、断点。
- `semantic tokens`: 业务语义值，如 `color.text.primary`、`surface.panel`、`border.default`。
- `component tokens`: 组件级变量，如 `button.primary.bg`、`list.item.hoverBg`、`settings.sidebar.width`。

### 3.2 命名规范

- 统一使用 `--hula-*` 前缀。
- 禁止继续扩散无前缀变量，如 `--bg-color`、`--bg-main`、`--text-color-3`。
- 推荐命名格式:

```css
--hula-color-primary-500
--hula-color-text-primary
--hula-surface-panel
--hula-border-default
--hula-radius-sm
--hula-space-4
--hula-motion-duration-fast
```

### 3.3 最小 Token 集

```css
:root {
  --hula-color-primary-500: #13987f;
  --hula-color-primary-100: rgba(19, 152, 127, 0.1);
  --hula-color-text-primary: #18181c;
  --hula-color-text-secondary: #505050;
  --hula-color-text-tertiary: #909090;
  --hula-surface-app: #fafafa;
  --hula-surface-panel: #ffffff;
  --hula-surface-muted: #f1f1f1;
  --hula-border-default: #e3e3e3;
  --hula-border-strong: #d9d9d9;
  --hula-radius-sm: 8px;
  --hula-radius-md: 10px;
  --hula-shadow-md: 0 4px 12px rgba(0, 0, 0, 0.08);
  --hula-space-2: 8px;
  --hula-space-3: 12px;
  --hula-space-4: 16px;
  --hula-space-5: 20px;
}
```

### 3.4 清理规则

- 删除桌面端 `default.scss` 的消费路径，迁移期结束后物理移除文件。
- `variable.scss` 只保留基础和语义 Token，不再维护组件专属变量。
- 组件样式中禁止出现新的十六进制颜色和 `rgba()`，只允许引用 Token。
- 对 `var(--token, fallback)` 进行专项治理，最终仅允许第三方库兼容层保留 fallback。

## 4. 组件库原子化拆分

### 4.1 分层架构

- 原子层 `atoms`
  - `HButton`
  - `HIconButton`
  - `HInput`
  - `HBadge`
  - `HAvatar`
  - `HStatusTag`
  - `HSkeleton`
- 分子层 `molecules`
  - `SearchField`
  - `SegmentedTabs`
  - `FilterBar`
  - `ListToolbar`
  - `EmptyState`
  - `RetryBanner`
  - `OfflineIndicator`
- 组织层 `organisms`
  - `SettingsShell`
  - `RoomSpaceWorkbench`
  - `RoomSpaceList`
  - `RoomSpaceDetailPanel`
  - `SettingsSectionCard`
  - `QuickActionBar`
- 模板层 `templates`
  - `DesktopSettingsTemplate`
  - `DesktopWorkspaceTemplate`
  - `EntityManagementTemplate`

### 4.2 组件治理原则

- 同类组件只允许一个权威实现，旧实现要么迁移要么删除，不允许“新版 + 兼容版 + 临时版”长期共存。
- `RoomVirtualList` 和 `SpacePanel` 不能继续作为两个平行入口，应合并为 `RoomSpaceList` 的不同数据视图。
- `SettingsDialog` 升级为唯一设置容器，旧设置中的页脚、侧栏、菜单项行为统一迁入该容器。
- 所有业务组件必须依赖统一 Atom/Molecule，不再直接散落使用不同风格的 Naive UI 组合。

## 5. 页面级模板

### 5.1 主工作区模板

- 模板结构:
  - 顶部 `WorkbenchHeader`
  - 左侧 `RoomSpaceListPanel`
  - 右侧 `ContextDetailPanel`
- 顶部统一承载:
  - 全局搜索
  - 房间/空间分段切换
  - 筛选器
  - 排序器
  - 快捷操作
- 列表区统一承载:
  - 实时列表
  - 状态筛选
  - 空状态
  - 离线状态提示
  - 重试提示
- 详情区统一承载:
  - 基本信息
  - 快捷操作
  - 成员/子房间摘要
  - 权限提示

### 5.2 设置模板

- 左侧固定导航宽度: `240px`
- 右侧主内容区最小宽度: `720px`
- 标题区固定包含:
  - 页面标题
  - 未保存状态提示
  - 搜索框
  - 关闭动作
- 内容区统一使用 `SectionCard + FieldRow` 模式，不再每个 Tab 自定义一套标题和卡片风格。

## 6. 交互一致性规则

- 搜索:
  - 主工作区默认内联搜索，不以聚焦直接跳路由。
  - 输入 `300ms` 去抖。
  - 清空后列表恢复默认排序，不保留“伪搜索态”。
- 筛选:
  - 筛选器始终展示当前激活条件。
  - 支持一键清空。
- 排序:
  - 默认排序规则必须显式展示，如“最近活跃优先”。
- 列表选择:
  - 单击选中并展示详情。
  - 双击进入具体会话或空间详情。
- 快捷操作:
  - 创建、编辑、删除、邀请、加入、离开等动作必须在同一位置与同一按钮风格出现。
- 错误处理:
  - 网络失败优先展示内联错误 Banner。
  - 支持重试按钮与最近一次错误摘要。
- 离线行为:
  - 所有可排队操作统一显示“已离线排队”状态。
  - 恢复网络后以同一提示样式展示回放结果。

## 7. 可访问性要求

- 颜色对比度:
  - 正文文本对比度 `>= 4.5:1`
  - 大号文本对比度 `>= 3:1`
- 键盘可达:
  - 所有列表项、按钮、筛选器、搜索框、弹窗主操作必须可通过 `Tab` 到达
  - 焦点样式统一使用 `2px` 主色描边
- 语义结构:
  - 主区域使用 `main`
  - 导航使用 `nav`
  - 列表使用 `list/listitem` 或语义化替代
- 屏幕阅读器:
  - 图标按钮必须提供 `aria-label`
  - 空状态、错误状态、离线状态需有可读文本
- 动效降级:
  - 支持 `prefers-reduced-motion`
  - 减弱缩放和透明度动画

## 8. 动效规范

- 时长:
  - `fast = 120ms`
  - `normal = 180ms`
  - `slow = 240ms`
  - `overlay = 280ms`
- 曲线:
  - `standard = cubic-bezier(0.2, 0, 0, 1)`
  - `enter = cubic-bezier(0, 0, 0, 1)`
  - `exit = cubic-bezier(0.4, 0, 1, 1)`
- 使用限制:
  - 列表 hover 仅允许颜色和阴影轻微变化
  - 模态层仅允许透明度和 `8px` 以内的位移
  - 禁止页面级大幅弹跳、闪烁、旋转

## 9. 响应式断点

- `xs`: `< 640px`
- `sm`: `640px - 767px`
- `md`: `768px - 1023px`
- `lg`: `1024px - 1279px`
- `xl`: `1280px - 1439px`
- `2xl`: `>= 1440px`

### 9.1 桌面端适配策略

- `>= 1440px`: 列表区 `320px`，详情区自适应
- `1280px - 1439px`: 列表区 `280px`
- `1024px - 1279px`: 列表区 `240px`
- `< 1024px`: 房间/空间筛选折叠到工具栏抽屉

## 10. 房间/空间复合组件方案

### 10.1 目标组件

- 名称: `RoomSpaceWorkbench`
- 位置: 桌面端 `src/layout/center/index.vue` 主列表区域
- 数据源:
  - 房间: `useRoomStore`
  - 空间: `useSpaceStore`
  - 离线能力: `offlineQueueService`
  - 后端接口:
    - WebSocket 增量事件
    - Matrix REST 接口

### 10.2 统一功能

- 实时列表
- 搜索
- 类型筛选
- 排序
- 快捷操作
- 新建 / 编辑 / 删除 / 邀请 / 加入 / 离开
- 权限校验
- 异常重试
- 离线缓存与回放提示

### 10.3 统一数据流

- 读取层:
  - 首屏优先读取本地缓存
  - 并发拉取 REST 基础列表
  - WebSocket/Sliding Sync 增量刷新
- 操作层:
  - 在线直写
  - 离线入队
  - 恢复网络后统一回放
- 展示层:
  - 单一列表组件根据 `entityType = room | space` 切换渲染字段

### 10.4 权限规则

- 房间:
  - 仅拥有对应成员权限的用户可编辑或邀请
- 空间:
  - 仅空间管理员可添加子房间、邀请成员、更新资料
- UI:
  - 无权限动作必须置灰并展示 tooltip 说明，不允许点击后再报错

## 11. 实施路线

### Phase 1: 样式治理

- 建立 `--hula-*` Token 清单
- 替换设置窗口和主工作区硬编码色值
- 标记并清理 `default.scss` 桌面消费路径

### Phase 2: 容器统一

- `SettingsDialog` 成为唯一设置容器
- 拆除旧设置目录对业务组件的反向依赖
- 把旧设置页脚、配置项映射、发送选项迁出 `moreWindow/settings`

### Phase 3: 房间/空间合并

- 实现 `RoomSpaceWorkbench`
- 合并 `RoomVirtualList` 与 `SpacePanel/SpaceView` 的入口策略
- 统一搜索、筛选、排序、快捷操作与错误状态

### Phase 4: 清理与验收

- 删除未引用样式、旧路由、无效资源
- 执行单元测试、E2E、性能与可访问性检查
- 输出正式验收报告

## 12. 交付约束

- 任何新增界面都必须先落在模板和组件层，而不是先写页面。
- 不允许再新增旧设置目录的引用。
- 不允许再新增桌面端第二套主题皮肤。
- 不允许在业务组件中新增硬编码色值。
- 清理动作必须以引用关系和构建验证为准，禁止经验式删除。

## 13. 建议的落地顺序

1. 先完成 Token 命名收敛和设置容器统一。
2. 再拆除 `MsgInput.vue -> moreWindow/settings/config.ts` 这类隐藏依赖。
3. 再将房间与空间入口收拢到 `RoomSpaceWorkbench`。
4. 最后做样式死代码、旧路由、旧资源的物理清理和体积验证。

## 14. 当前进展

- 更新时间: `2026-04-27`
- 当前执行主线: `Phase 1 / Design Tokens`
- 已完成:
  - `src/styles/css/design-tokens.css` 继续作为当前权威 Token 注册中心
  - `src/styles/scss/theme/simple.scss` 的桌面 `simple` 主题别名已开始改为直接消费 `--hula-*` Token
  - `src/styles/scss/global/variable.scss` 已完成第二轮全局变量收敛，继续替换消息激活态、气泡、翻译层、回复态、危险/警告态等高频语义变量的旧别名和硬编码值
  - `src/styles/css/design-tokens.css` 已新增菜单浮层、Beta 辅助色与管理后台 Token，`variable.scss` 的菜单层阴影和 admin 色板已改为桥接权威 Token
  - `src/layout/center/model.tsx` 已移除两处直接写死的灰色文字，改为消费语义文字 Token
  - `src/views/settingsWindow/tabs/AppearanceSettings.vue`、`NotificationSettings.vue`、`SessionSettings.vue`、`VoiceVideoSettings.vue`、`PreferencesSettings.vue`、`SecuritySettings.vue`、`KeyboardSettings.vue`、`SidebarSettings.vue`、`FriendsSettings.vue`、`PushSettings.vue`、`HelpSettings.vue`、`LabsSettings.vue`、`AccountSettings.vue`、`EncryptionSettings.vue`、`BurnAfterReadSettings.vue`、`MjolnirSettings.vue` 已完成设置页全量样式收敛，统一改用 `--hula-*` 字号、间距、圆角与语义色值
  - `src/styles/scss/theme/default.scss` 已完成一轮主题别名收敛，默认皮肤中的侧边栏、消息激活态、渐变背景和 hover 变量已开始改为直接消费 `--hula-*`
  - `src/components/rightBox/Details.vue`、`FileUploadModal.vue`、`FileUploadProgress.vue` 与 `src/views/friendWindow/SearchFriend.vue` 已完成一轮低风险样式收敛，替换旧 `--bg-*` / `--text-color*` 别名、白色边框、主色阴影与上传弹层硬编码色为 `--hula-*` 语义 Token
  - `src/components/rightBox/chatBox/ChatSidebar.vue`、`src/components/rightBox/renderMessage/ReactionPicker.vue`、`MessageEditor.vue`、`Announcement.vue`、`LinkPreview.vue`、`Location.vue`、`Beacon.vue` 以及 `src/components/friend/AddFriendDialog.vue`、`FriendGroupView.vue`、`src/components/room/InviteDialog.vue`、`CreateRoomDialog.vue` 已完成一轮低风险样式收敛，继续清理右侧聊天区、消息预览卡片和好友/房间弹窗中的旧 `--bg-*` / `--text-color*` / `--line-color` / `--emoji-hover` 别名与硬编码辅助色
  - `src/components/rightBox/chatBox/ChatMain.vue`、`ChatFooter.vue`、`ChatMsgMultiChoose.vue` 与 `src/components/rightBox/renderMessage/Text.vue`、`File.vue`、`Voice.vue` 已完成下一批右侧聊天主区样式收敛，替换公告/底栏/多选转发弹层中的旧 `--chat-text-color`、`--bg-popover`、`--bg-emoji`、`--line-color`、`--icon-color`、`--file-bg-color` 等历史别名，并清理链接卡片、文件进度环、语音波形和提示浮层中的硬编码色值
  - `src/components/rightBox/chatBox/ChatMultiMsg.vue`、`src/components/rightBox/renderMessage/index.vue`、`Image.vue`、`Emoji.vue`、`Video.vue`、`special/BotMessage.vue` 与 `src/styles/scss/renderMessage/video.scss` 已完成后续一批展示层样式收敛，替换合并消息卡片、消息容器头像浮层、媒体加载失败态、视频遮罩/进度环与机器人提示条中的旧 `--text-color`、`--chat-text-color`、`--bg-info`、`--group-notice-bg`、`--right-chat-reply-color` 及十六进制/rgba 硬编码
  - `src/components/rightBox/chatBox/ChatHeader/ChatHeaderRoot.vue`、`ChatHeaderSidebar.vue`、`ChatHeaderInfo.vue` 与 `src/styles/scss/render-message.scss` 已完成右侧聊天头部与共享消息样式收敛，替换头部区域旧 `--bg-color`、`--border-color`、`--text-color-*`、`--primary-color`、`--error-color` 别名，并清理消息气泡、回复态、公告条和选区高亮中的历史回复/公告变量及硬编码色值
  - `src/components/rightBox/ForwardDialog.vue`、`ApplyList.vue`、`ReplyComposer.vue`、`src/components/rightBox/renderMessage/RenderPollMessage.vue` 与 `src/components/rightBox/location/LocationModal.vue` 已完成下一批右侧聊天尾部低风险样式收敛，替换转发弹窗、申请列表、回复预览、投票卡片和定位弹窗中的旧 `--border-color`、`--text-color`、`--bg-popover`、`--center-bg-color`、`--right-chat-reply-color`、`--bg-edit`、`--line-color` 等历史别名，并清理定位弹窗中的硬编码面板色
  - `src/components/rightBox/MsgInput.vue`、`src/styles/scss/msg-input.scss` 与 `src/components/rightBox/emoticon/index.vue` 已完成右侧输入区与表情面板下一批低风险样式收敛，替换输入联想弹层与表情面板中的旧 `--center-bg-color`、`--box-shadow-color`、`--text-color`、`--chat-text-color`、`--line-color`、`--emoji-hover`、`--emoji-active-color`，并清理输入区边线与光标色中的历史硬编码
  - `src/components/rightBox/VoiceRecorder.vue`、`src/components/rightBox/chatBox/HuLaAssistant.vue` 与 `Bot.vue` 已完成语音录制面板、机器人工作区与小管家占位层下一批低风险样式收敛，替换旧 `--bg-color`、`--text-color`、`--chat-text-color`、`--line-color`、`--bg-msg-hover` 与按钮/遮罩/Markdown 皮肤中的十六进制、`rgba(...)` 硬编码，统一改为 `--hula-*` 语义 Token
  - `src/components/rightBox/chatBox/index.vue`、`src/components/rightBox/location/StaticProxyMap.vue` 与 `src/components/rightBox/location/LocationMap.vue` 已完成聊天区分割拖拽柄与定位地图控件下一批硬编码清理，将分割条、缩放按钮和定位标记中的灰阶/黑白透明/红色直写值收敛到 `--hula-*` Token 与基于 Token 的 `color-mix(...)`
  - `src/components/search/SpotlightDialog.vue` 已移除最后一处 `--emoji-hover` 消费，`src/styles/scss/global/variable.scss` 随后物理删除无外部消费的 `--box-shadow-color`、`--emoji-hover` 与 `--emoji-active-color` 历史别名，进一步缩小全局桥接层
  - `src/views/announWindow/index.vue`、`Tray.vue`、`Notify.vue`、`friendWindow/AddFriendVerify.vue`、`friendWindow/AddGroupVerify.vue`、`onlineStatusWindow/index.vue`、`modalWindow/index.vue`、`previewFileWindow/index.vue` 以及 `src/components/fileManager/UserList.vue`、`SideNavigation.vue`、`UserItem.vue`、`src/styles/scss/agreement.scss` 已完成窗口壳层与文件管理侧栏下一批低风险样式收敛，替换旧 `--center-bg-color`、`--line-color`、`--chat-text-color` 为 `--hula-surface-panel`、`--hula-border-default`、`--hula-text-secondary`
  - `src/components/fileManager/FileContent.vue`、`src/components/common/AvatarCropper.vue`、`ContextMenu.vue`、`InfoPopover.vue`、`src/layout/left/components/InfoEdit.vue`、`definePlugins/List.vue`、`src/layout/center/model.tsx` 与 `src/views/loginWindow/Login.vue` 已完成又一批低风险历史别名收敛，替换文件管理内容区、头像裁剪、右键菜单、资料弹层、插件列表、主工作区占位文案和登录页中的旧 `--line-color`、`--chat-text-color` 为 `--hula-border-default`、`--hula-text-secondary`
  - `src/mobile/views/chat-room/ManageGroupMember.vue`、`src/views/trendradar/TrendRadarView.vue`、`src/views/openclaw/OpenClawView.vue`、`src/views/LockScreen.vue`、`src/styles/scss/chat-header.scss` 与 `src/plugins/robot/views/chatSettings/model.tsx` 已完成新一批低频历史别名收敛，替换旧 `--line-color`、`--chat-text-color`、`--text-color`、`--text-color-secondary` 为 `--hula-border-default`、`--hula-text-primary`、`--hula-text-secondary`，残留扫描与诊断校验均通过
  - `src/components/trendradar/TrendingPanel.vue`、`NewsCard.vue`、`SearchPanel.vue`、`src/components/openclaw/ModelSelector.vue` 与 `src/mobile/views/friends/AddFriends.vue` 已完成同功能面子组件的下一批低频历史别名收敛，替换旧 `--chat-text-color`、`--text-color`、`--text-color-secondary`、`--text-color-tertiary` 为 `--hula-text-primary`、`--hula-text-secondary`、`--hula-text-tertiary`，残留扫描与诊断校验均通过
  - `src/mobile/views/friends/ConfirmAddFriend.vue`、`ConfirmAddGroup.vue` 与 `src/views/homeWindow/SecretChatPage.vue` 已完成同链路页面的又一批低频历史别名与悬空变量收敛，替换旧 `--text-color`、`--text-color-secondary`、`--text-color-disabled`、`--bg-primary`、`--border-color` 为 `--hula-text-primary`、`--hula-text-secondary`、`--hula-text-disabled`、`--hula-surface-app`、`--hula-border-default`，残留扫描与诊断校验均通过
  - `src/components/widget/WidgetManager.vue`、`src/components/thread/ThreadView.vue`、`ThreadIndicator.vue` 与 `ThreadPanel.vue` 已完成下一批低频历史文字色变量收敛，替换旧 `--text-color`、`--text-color-secondary`、`--text-color-tertiary`、`--text-color-3` 为 `--hula-text-primary`、`--hula-text-secondary`、`--hula-text-tertiary`，残留扫描与诊断校验均通过
  - `src/components/encryption/KeyBackupDialog.vue`、`KeyRotationDialog.vue`、`CrossSigningDialog.vue`、`DeviceVerifyDialog.vue` 与 `KeyBackupSetupDialog.vue` 已完成加密弹窗一批低风险样式变量收敛，替换旧 `--border-color`、`--bg-color`、`--bg-color-secondary`、`--text-color`、`--text-color-secondary` 为 `--hula-border-default`、`--hula-surface-panel`、`--hula-surface-panel-muted`、`--hula-text-primary`、`--hula-text-secondary`，残留扫描与诊断校验均通过
  - `src/components/encryption/DeviceVerifyDialog.vue` 与 `KeyBackupSetupDialog.vue` 已完成一轮运行时硬编码文案国际化收敛，接入 `setting.json` 中新增的 `encryption.device_verify_dialog.*`、`encryption.backup_setup_dialog.*` 键，移除页面内中文硬编码，并同步清理相关中文日志
  - `src/components/encryption/KeyBackupRestoreDialog.vue` 已完成同链路恢复弹窗的运行时硬编码文案国际化收敛，接入 `setting.json` 中新增的 `encryption.backup_restore_dialog.*` 键；`KeyRotationDialog.vue`、`CrossSigningDialog.vue` 的中文日志与固定 `zh-CN` 时间格式已同步清理，当前 `src/components/encryption` 目录本批已无中文残留
  - `src/components/fileManager/FileContent.vue`、`EmptyState.vue`、`UserList.vue`、`SideNavigation.vue`、`UserItem.vue`，`src/components/common/AvatarCropper.vue`、`ContextMenu.vue`、`InfoPopover.vue` 与 `src/components/search/SpotlightDialog.vue` 已完成下一批低频历史别名收敛，替换旧 `--text-color` 与 `--bg-color` 为 `--hula-text-primary`、`--hula-text-secondary`、`--hula-surface-panel`，其中 `UserList.vue` 的加载中文已同步接入 `fileManager.common.loading`，相关目录残留扫描与诊断校验均通过
  - `src/composables/settings/settingsOptions.ts`、`src/views/settingsWindow/tabs/PreferencesSettings.vue` 与 `locales/zh-CN/setting.json`、`locales/en/setting.json` 已完成设置偏好页一轮低风险国际化收敛，语言选项与发送键选项不再内联硬编码标签，统一改为消费 `setting.*` i18n 文案键
  - `src/stores/domains/settings/settingsSchema.ts`、`src/composables/settings/useSettingsShell.ts`、`src/composables/settings/settingsSearchIndex.ts`、`src/views/settingsWindow/SettingsDialog.vue` 与 `locales/zh-CN/setting.json`、`locales/en/setting.json` 已完成设置壳层第二轮国际化收敛，设置导航标题、当前标签标题和搜索匹配项不再依赖固定中文标签，改为通过运行时翻译生成；设置搜索关键词别名也已从运行时代码迁移到语言包数组；移动端 `src/mobile/views/my/PreferencesSettings.vue`、`BurnAfterReadSettings.vue` 中的阅后即焚时长标签与格式化逻辑、`src/mobile/views/my/MobileQRCode.vue` 中的扫码状态/权限提示、`src/mobile/views/my/EditProfile.vue` 中的资料保存反馈，以及 `src/mobile/views/my/AiAssistant.vue` 中的新建会话标题与空响应占位也已切换到共享翻译键；`src/mobile/views/my` 目录中的运行时中文日志与用户可见硬编码文案已完成一轮清理
- 仍待处理:
  - `variable.scss` 中剩余的历史业务别名和少量业务辅助色仍需继续收敛
  - 主工作区其他组件中的硬编码颜色仍需分批迁移
  - `default.scss` 当前未见桌面端显式运行时导入，且 `setting.ts` 中 `themes.versatile` 固定为 `simple`、代码侧未发现 `.default` 主题类动态挂载；可按高概率遗留文件继续推进物理清理评估
  - 房间/空间工作区与设置壳层统一仍未进入实施阶段
  - 设置体系中的日志、错误提示和辅助提示文案仍需继续补齐到 i18n，下一批可优先处理设置体系其他目录与桌面端页面中的残余日志/提示，并并行回到低频历史别名消费者的样式收敛

## 结论

- 当前最关键的不是“补一个新页面”，而是先把设计真相从多源状态压缩为单源状态。
- 只要 Design Tokens、Settings Shell、Room/Space Workbench 三条主线统一完成，桌面端 UI 就能从“历史堆叠”转为“可扩展体系”。
