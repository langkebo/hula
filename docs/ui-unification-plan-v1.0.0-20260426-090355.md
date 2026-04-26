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

## 结论

- 当前最关键的不是“补一个新页面”，而是先把设计真相从多源状态压缩为单源状态。
- 只要 Design Tokens、Settings Shell、Room/Space Workbench 三条主线统一完成，桌面端 UI 就能从“历史堆叠”转为“可扩展体系”。
