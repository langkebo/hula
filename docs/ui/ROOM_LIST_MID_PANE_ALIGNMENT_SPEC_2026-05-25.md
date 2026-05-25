# 房间列表中间栏对齐落地方案

## 1. 参考基线

- 参考页面：`src/views/homeWindow/FriendsList.vue`
- 参考主体：`src/components/friend/FriendListView.vue`
- 对齐目标：房间列表中间栏在布局、视觉、交互反馈上与好友列表中间栏保持同一设计语言
- 对齐范围：标题区、搜索区、筛选区、列表区、空态、加载态、网络异常提示

## 2. 规范对照清单

| 维度 | 好友列表中间栏基线 | 房间列表原状态 | 本次落地 |
| --- | --- | --- | --- |
| 头部结构 | 标题在左、主操作在右、12px 内边距 | 标题区较简化，动作层级弱 | 统一为标题 + 操作按钮双端布局 |
| 间距体系 | 内层 12px，组件间 12px，列表项 12px/8px 节奏 | 列表容器与项间距偏散，边界不统一 | 统一头部 12px、列表 8px、单项 12px |
| 搜索区 | 搜索框单独一行，圆角 12px，弱背景 | 搜索框样式较基础 | 统一为圆角 12px 的搜索输入 |
| 筛选区 | 胶囊按钮、紧跟搜索区、节奏紧凑 | 筛选控件风格偏通用 | 统一为胶囊化筛选按钮 |
| 列表项高度 | 76px 左右的双行信息密度 | 视觉高度偏松散，选中态弱 | 统一为 76px 节奏、双行内容 |
| 列表项圆角 | 8px~12px 圆角，hover/active 明显 | 仅基础 hover，激活态层次不足 | 统一为 12px 圆角 + 激活阴影 |
| 文本排版 | 标题 14px/20px，辅助 12px/18px | 名称、时间、预览排布不够统一 | 统一标题、时间、预览文字规格 |
| 交互反馈 | hover、active、focus-visible 全覆盖 | focus 与 active 表现不完全一致 | 统一 hover/active/focus-visible 反馈 |
| 空态/加载态 | 与列表容器同节奏，居中展示 | 有空态但与列表栅格边界不完全一致 | 统一容器 padding 和骨架屏节奏 |
| 异常提示 | 与主体卡片同圆角和边界体系 | 网络横幅偏硬朗、边距略碎 | 统一为 12px 圆角告警卡片 |

## 3. 设计 token 与尺寸标注

### 3.1 布局与间距

- 工具栏内容区内边距：`12px`
- 列表滚动区内边距：`8px 8px 0`
- 列表项高度：`76px`
- 列表项内边距：`12px`
- 列表项底间距：`4px`
- 列表项圆角：`12px`

### 3.2 字体与文本

- 标题：`14px / 20px / 600`
- 时间：`12px / 18px`
- 消息预览：`12px / 18px`
- 统计摘要：`12px`

### 3.3 色彩与状态

- 背景：`--hula-surface-panel`
- 搜索底：`--hula-surface-search`
- hover：`--hula-surface-list-hover`
- active：`--hula-surface-session-active`
- active shadow：`--hula-surface-session-active-shadow`
- 主文本：`--hula-text-primary`
- 次文本：`--hula-text-secondary`
- 辅助文本：`--hula-text-tertiary`

## 4. 代码落地点

- `src/components/workbench/MessageSessionToolbar.vue`
  - 增加房间标题透传
  - 增加筛选后计数摘要
  - 补全加入房间按钮
  - 统一搜索框圆角和筛选按钮样式
- `src/components/workbench/HulaRoomListItem.vue`
  - 统一房间项高度、圆角、文本规格与选中态
  - 收敛 hover/active/focus-visible 行为
  - 对齐与好友列表一致的 12px 间距体系
- `src/components/workbench/RoomSessionList.vue`
  - 统一滚动区边距
  - 统一网络异常卡片圆角和骨架屏节奏
- `src/views/homeWindow/RoomList.vue`
  - 使用房间标题文案 `home.plugins.room_list_short_title`

## 5. 切图与标注文件

### 5.1 切图

- `docs/ui/assets/room-list-mid-pane-2026-05-25/room-list-mid-pane-slice-header-2026-05-25.png`
- `docs/ui/assets/room-list-mid-pane-2026-05-25/room-list-mid-pane-slice-toolbar-2026-05-25.png`
- `docs/ui/assets/room-list-mid-pane-2026-05-25/room-list-mid-pane-slice-list-2026-05-25.png`

### 5.2 标注文件

- `docs/ui/assets/room-list-mid-pane-2026-05-25/room-list-mid-pane-annotation-2026-05-25.svg`
- `docs/ui/assets/room-list-mid-pane-2026-05-25/room-list-mid-pane-annotation-2026-05-25.json`

## 6. 标注区域说明

- A 区：标题、计数摘要、主操作按钮
- B 区：搜索框、筛选按钮、筛选反馈
- C 区：列表项密度、时间轴、预览文案、未读角标、hover/active

## 7. 落地结论

- 房间列表中间栏已经切换到与好友列表一致的间距节奏与卡片语言
- 操作入口、搜索筛选、列表项排布、异常卡片都收敛到了统一体系
- 后续若继续做消息列表与空间列表统一，可直接复用本次房间列表的中间栏规范
