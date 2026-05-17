# UI Alignment Open Tasks 2026-05-15

## 目标

- 基于 `docs/ui/README.md`、UI 规范文档、交互说明、体验反馈与当前代码实现，整理一份可执行的未完成 UI 优化任务总表。
- 本文档不重复输出所有历史结论，而是聚焦：
  - 当前已完成的 UI 基线
  - 文档中明确未闭环的事项
  - 文档未完整记录、但代码核验后确认仍需推进的事项
  - 去重后的优先级任务清单

## 核验范围

- `docs/ui/README.md`
- `docs/ui/HULA_UI_SYSTEM_MESSAGES_FRIENDS.md`
- `docs/ui/HULA_COMPONENT_REFACTOR_CHECKLIST.md`
- `docs/ui/HULA_FRONTEND_WORKBREAKDOWN.md`
- `docs/ui/HULA_FIGMA_STRUCTURE.md`
- `docs/ui/UI_ALIGNMENT_VISUAL_REVIEW_2026-05-04.md`
- `docs/ui/UI_ALIGNMENT_PERF_REPORT_2026-05-04.md`
- `docs/ui/UX-03_TEST_CHECKLIST.md`
- `docs/ROOM_SPACE_UI_UX_OPTIMIZATION_PLAN.md`
- `docs/ui-unification-plan-v1.0.0-20260426-090355.md`
- 桌面/工作台/好友/消息区当前运行时代码

## 核验口径

- 以当前代码现状为准，文档作为佐证矩阵。
- 对“文档已完成但主链路未接入”的项，统一判定为“未闭环”。
- 对“组件文件存在但未在主路径使用”的项，统一判定为“已开发未接入”。
- 对“文档已定义但代码和资产都未落地”的项，统一判定为“未启动”。

## 当前已完成基线

### 结构基线

- 主工作台三栏壳层已形成：`RoomSpaceToolbar + SpaceListPane + RoomSessionList + WorkbenchDetailPane`
- 房间/好友业务窗口治理已取得阶段性成果，好友添加已迁入页内对话框，不再走独立 `searchFriend` 窗口
- `FriendListView`、`FriendDetailDrawer`、`HulaSpaceTree`、`RoomBatchActionBar`、`HulaMessageMeta` 等目标组件已存在于仓库
- 房间列表已具备虚拟列表基础能力

### 能力与链路基线

- 房间摘要已具备正常态、无权限态、空态的基础区分
- 好友接受后跳转 DM 已切换为基于返回 `roomId` 的确定性路径
- 空间列表已从纯按钮列表演进为基础分组结构，具备 `Pinned / Joined / Low priority` 视图雏形

### 工程基线

- 关键 Storybook 文件已存在，但仍未形成完整视觉回归基线与文档追溯链
- 业务域主路径已基本避免继续引入 `createWebviewWindow`

## README 与相关文档中明确未闭环的事项

### 文档级明确缺口

1. 所有改造组件都需要补齐 `Storybook / VisualSpec / MigrationId / 截图或录屏`，当前仍未闭环。
2. 房间列表、空间树分页、好友接受跳转、能力降级四类主链路需要作为联调优先项持续验证。
3. 业务信息的主呈现方式必须统一收敛到内嵌侧栏、抽屉或详情区，不能重新回流到独立业务窗口。

### 视觉审计明确缺口

1. 核心改造组件缺少稳定 Storybook 视觉基线。
2. 视觉稿链接、迁移编号、运行组件三者尚未形成统一追溯。
3. 好友页仍偏旧列表结构，尚未完成卡片化与详情抽屉统一承载。
4. 空间可见性、邀请制、公开空间等状态标签尚未全面统一。
5. 邀请态房间、已迁移房间、隐藏好友等状态模板尚未完全统一。

### 性能审计明确缺口

1. 房间列表增量 patch 与重连横幅缺少统一基线。
2. 大列表更新是否触发整表重绘尚未量化。
3. 接受好友到进入 DM 的耗时尚未形成稳定采样数据。
4. 空间树 `next_batch` 分页追加性能尚未量化。
5. 好友页筛选切换与搜索主线程成本尚未量化。

### 体验清单明确缺口

1. RTL 布局尚未实机验证。
2. 触屏点击热区、hover 在 touch 设备上的粘滞问题尚未验证。
3. 12px 圆角一致性尚未全量走查。
4. 搜索历史、请求倒计时、presence `< 200ms`、100+ 好友滚动 60fps 等仍未完成实测闭环。
5. Electron 右键菜单定位与 Mobile Web 无横向滚动仍未验收。

## 代码交叉核验结果

### 已开发未接入

- `src/components/friend/FriendListView.vue`
  - 组件已接入桌面好友主入口，`src/views/homeWindow/FriendsList.vue` 仅保留页面壳层与私密聊天 shortcut
  - capability / empty / error / normal 四态已内收至组件自身，桌面主路径不再重复分流
- `src/components/workbench/HulaSpaceTree.vue`
  - 组件已存在
  - 当前空间主路径仍以 `SpaceListPane` 为主，不构成完整的分页树导航主链路

### 已部分接入但未闭环

- `src/components/workbench/SpaceListPane.vue`
  - 已具备基础分区，并在工作台窄屏下收口为 rail 形态
  - 仍缺富卡片、状态标签、统一快捷操作、虚拟化/分页策略、完整 a11y 与 token 清理
- `src/components/workbench/WorkbenchDetailPane.vue`
  - 已承载空间管理、摘要、成员与活动详情能力，并已切换为 `summary / manage / members / activity` 模式系统
  - 当前仍需继续补 a11y、截图/录屏和更完整的窄屏交互验收
- `src/components/workbench/RoomBatchActionBar.vue`
  - 已接入 `RoomSpaceWorkbench.vue` 主路径，支持批量已读、置顶、静音、退房与全选/清空
  - 当前仍缺最终截图/录屏索引与更完整的窄屏承载策略
- `src/components/rightBox/renderMessage/HulaMessageMeta.vue`
  - 已接入消息主渲染链，统一承载时间、发送中、失败重试、回执与 typing
  - 当前仍缺 focused Storybook 状态与单组件级回归资产
- `src/views/homeWindow/FriendsList.vue`
  - 已完成“加好友不再开窗”，并已缩减为只承载页面壳层与快捷入口
  - 好友列表四态与列表正文切换已迁入 `FriendListView.vue`，但移动端尚未复用同一状态 helper

### 品牌与一致性未闭环

- `SpaceListPane.vue` 仍有 `#ffffff`、`rgba(...)` 等局部硬编码色
- `FriendListView.vue` 仍有 `#f0a020`、`text-gray-500` 等局部样式
- `ui-unification-plan` 中列出的 `variable.scss` 历史别名、主工作区硬编码颜色、长尾 i18n 文案仍有残项

## 去重后的未完成任务总表

| 优先级 | 分类 | 任务 | 当前状态 | 关联模块/文件 | 完成标准 |
| --- | --- | --- | --- | --- | --- |
| P0 | 好友域重构 | 将桌面好友主入口切换到 `FriendListView + FriendDetailDrawer` 架构 | 部分完成 | `src/views/homeWindow/FriendsList.vue`、`src/components/friend/FriendListView.vue`、`src/components/friend/FriendDetailDrawer.vue` | 桌面端仅保留卡片列表 + 抽屉/详情区一套主入口，`favorite / normal / blocked / hidden` 语义完整 |
| P0 | 好友能力降级 | 完成好友能力关闭、空态、异常态、正常态的统一降级分流 | 部分完成 | 好友页桌面/移动入口、好友 store/service | 不再出现空白页或错误混用空态，能力关闭有解释性说明 |
| P0 | 好友请求链路 | 完成请求面板三视图与接受后直达 DM 的过渡态闭环 | 部分完成 | `FriendRequestDialog`、好友请求面板、DM 打开链路 | 接受后直接进入返回的 `roomId`，拒绝/取消有明确反馈 |
| P0 | 空间树主链路 | 将分页空间树、`next_batch`、`suggested_only`、breadcrumb、parent spaces 接入主路径 | 部分完成 | `HulaSpaceTree.vue`、空间服务、工作台空间入口 | 已接入工作台主路径并补齐 story / focused test；`suggested_only` 与更完整 parents 状态仍需继续收口 |
| P0 | 空间侧栏升级 | 将空间列表升级为富卡片、统一状态标签、聚合未读与快捷操作 | 部分完成 | `SpaceListPane.vue`、`SpaceListItemCard.vue` | 公开/私有/邀请制状态一眼可辨，支持摘要信息和聚合状态 |
| P0 | 房间列表基线 | 收口房间列表的初始同步、增量同步、重连恢复与空态容器 | 部分完成 | `RoomSessionList.vue`、工作台列表数据层 | 单项变更只刷新受影响项，重连状态可解释，空态稳定 |
| P0 | 房间摘要与输入态 | 对齐 room summary 数据源，并补齐只读/tombstoned 输入禁用态 | 部分完成 | 房间详情、消息输入区、消息区状态 | 无权限、无数据、只读、已迁移等状态明确，不出现误导性输入框 |
| P0 | 验收资产 | 为核心改造组件补齐 `Storybook / VisualSpec / MigrationId / 截图录屏` | 部分完成 | `docs/ui`、Storybook、Figma 结构、PR 附件 | 任一核心组件都能追溯到视觉稿、story、运行组件与迁移记录 |
| P0 | 回归闭环 | 建立房间列表、空间树、好友接受跳转、能力关闭四条主链路回归矩阵 | 部分完成 | `docs/ui`、测试与截图基线 | 已补矩阵、检查表与资产索引；真实截图 / 录屏仍需继续补录 |
| P1 | 消息元信息 | 将 `HulaMessageMeta` 接入消息主渲染链 | 已完成 | `src/components/rightBox/renderMessage/index.vue`、`HulaMessageMeta.vue` | 已接入主渲染，并补齐 story 与 focused component test |
| P1 | 批量模式 | 在工作台接入 `RoomBatchActionBar` 与批量操作流 | 部分完成 | `RoomBatchActionBar.vue`、工作台中栏 | 可多选并执行已读、静音、置顶、降权等操作，使用内联条而非模态 |
| P1 | 工具栏效率 | 增加 active filter summary、clear all、saved presets 与快速过滤项 | 部分完成 | `RoomSpaceToolbar.vue`、工作台列表页 | 当前筛选范围一眼可见，可一键恢复默认，搜索与过滤效率提升 |
| P1 | 右侧详情模式化 | 将详情区整理为 `summary / manage / members / activity` 模式系统 | 部分完成 | `WorkbenchDetailPane.vue` | 不再把摘要、管理、成员和活动内容无差别堆叠在同一纵向流里 |
| P1 | 响应式适配 | 按桌面宽度分档收口三栏、双栏、抽屉/滑层策略 | 部分完成 | 工作台、详情区、空间侧栏、批量条 | 窄屏不互相挤压，小宽度下右侧改为抽屉或滑层，批量条可转底部 dock |
| P1 | 无障碍 | 补齐 room list / space tree / friend card / breadcrumb 的 role、aria、键盘导航与非颜色提示 | 局部完成 | 工作台、好友页、消息区 | 树节点、选中态、邀请态、分页加载都可被键盘与读屏正确感知 |
| P1 | 品牌与 token 收口 | 清理核心 workbench/friend 组件硬编码颜色与历史变量别名 | 部分完成 | `SpaceListPane.vue`、`FriendListView.vue`、`variable.scss`、主工作区 | 核心业务组件只消费 `--hula-*`，不再新增业务硬编码色 |
| P1 | 性能量化 | 补齐列表 mount、筛选耗时、space switch、分页追加等性能基线 | 部分完成 | 房间列表、空间树、好友页、性能上报 | workbench 与 room list 已有 perf story 样本，真实发布基线与报告回填仍需继续完善 |
| P2 | 实机/边缘验证 | 完成 RTL、touch target、hover on touch、12px radius、一致性验证 | 未验证 | 好友页、工作台、移动端 | 在桌面、触屏、RTL 环境下无明显错位或粘滞交互 |
| P2 | 搜索体验 | 补好友搜索历史、去抖体验与无结果反馈闭环 | 部分完成 | 好友搜索入口、搜索状态存储 | 快速输入不掉帧，历史查询可回放，无结果态明确 |
| P2 | A11y 异步播报 | 引入统一 live region，播报邀请接受、空间加入、同步恢复结果 | 部分完成 | 公共 a11y 组件、关键异步链路 | 关键异步反馈对读屏用户可感知 |
| P2 | 长尾 i18n | 收口设置体系和桌面低频页面的日志、错误提示、辅助文案国际化 | 已完成 | 设置体系、低频页面、弹窗/提示 | 用户可见文案不再出现硬编码中文或单语提示 |

## P0 执行拆解

### 批次 A：好友主入口与能力降级收口

#### 目标

- 把好友域从“局部迁移”推进到“桌面主入口完全切换”。
- 同时收口好友能力关闭、空态、异常态、正常态的分流逻辑。

#### 覆盖任务

- `P0 | 好友域重构`
- `P0 | 好友能力降级`
- `P0 | 好友请求链路`

#### 建议改动范围

- `src/views/homeWindow/FriendsList.vue`
- `src/components/friend/FriendListView.vue`
- `src/components/friend/FriendDetailDrawer.vue`
- 好友请求相关对话框/面板
- 好友 store、好友 service、DM 跳转入口

#### 前置依赖

- 现有 `roomId` 跳转链路保持稳定
- 好友 feature gate 判断口径明确且可复用

#### 交付物

- 桌面好友主入口切换 PR
- 好友四态状态矩阵截图
- 好友请求 -> 接受 -> 跳转 DM 录屏
- 对应 Storybook 状态补齐

#### 完成标准

- 桌面好友入口不再保留旧分组列表作为主路径
- 能力关闭、空态、异常态、正常态四种状态可明确区分
- 接受好友后可稳定进入返回的 `roomId`
- 不重新引入 `searchFriend`、`addFriendVerify` 等独立业务窗口

#### 最小执行清单

1. 以 `FriendListView` 为桌面好友主入口替换现有 `FriendsList.vue` 主渲染结构。
2. 把好友筛选、请求入口、详情抽屉、搜索入口统一收敛到同一壳层。
3. 抽出可复用的 capability / empty / error / normal 状态判定函数，避免桌面与移动端分叉。
4. 统一好友请求处理后的跳转策略，只消费服务层返回的 `roomId`。
5. 补齐好友主入口的 Storybook 状态：`CapabilityOff / Empty / Default / RequestsPending / BlockedHiddenMix`。

#### 风险点

- 旧 `FriendsList.vue` 仍与 mitt、联系人初始化和详情联动耦合较深，切换时容易遗漏隐藏交互。
- 好友能力关闭态与接口异常态若共用一个空态容器，后续仍会误导 QA。
- 若请求接受后仍残留 “按 uid 猜测房间” 的兜底逻辑，会重新引入不稳定跳转。

#### 验收出口

- 页面截图：好友能力关闭、空态、正常态、请求态
- 交互录屏：收到请求 -> 接受 -> 打开 DM
- 文档更新：将新的桌面好友主入口路径补回相关 UI 文档引用
- 回归验证：至少覆盖好友筛选、请求处理、详情打开三条主交互

#### 2026-05-15 实际落地回填

**已完成实现**

- `src/views/homeWindow/FriendsList.vue` 已缩减为页面壳层，仅保留私密聊天 shortcut 与 `FriendListView` 挂载位，不再重复承载 capability 降级判断。
- `src/components/friend/FriendListView.vue` 已内收 capability / empty / error / normal 四态，并新增统一状态判定 helper，避免页面壳层与组件内部分流重复。
- `src/stores/domains/chat/contacts.ts` 已补齐 `lastFriendError` 显式错误态，并将好友服务初始化收口为可重入但不重复绑监听的路径，支持错误态重试。
- 好友状态写回已补 `accepted -> normal` 归一化，避免“普通好友”动作后筛选与 badge 统计失真。
- Storybook 已补 `CapabilityOff / ErrorState / RequestsPending / BlockedHiddenMix`，好友主入口四态与典型混合态可直接复验。

**已补测试**

- `src/views/homeWindow/__tests__/FriendsList.test.ts` 已改为覆盖页面壳层只承载 shortcut 与 `FriendListView` 主入口。
- `src/components/friend/__tests__/friendListViewState.test.ts` 已覆盖 capability / error / empty / normal 四态判定优先级。
- `src/stores/domains/chat/__tests__/contacts.test.ts` 已补好友状态 `accepted -> normal` 归一化回归。
- 已执行 `pnpm vitest run src/views/homeWindow/__tests__/FriendsList.test.ts src/components/friend/__tests__/friendListViewState.test.ts src/stores/domains/chat/__tests__/contacts.test.ts`，当前 `19` 项测试通过。

**残余风险**

- 移动端好友页仍维护独立分组与状态渲染，尚未复用本次桌面侧的四态 helper，后续仍有桌面/移动口径漂移风险。
- `FriendListView.vue` 仍残留 `#f0a020`、`text-gray-500` 等样式硬编码，本次未一并收口到 `--hula-*` token。
- 目前补齐的是状态判定测试与 Storybook 基线，截图/录屏类验收资产尚未在本批次内入库。

### 批次 B：空间树与空间侧栏主链路接入

#### 目标

- 让空间从“分组列表 + 部分详情能力”升级为“完整导航域”。
- 优先打通分页树、breadcrumb、空间侧栏富状态。

#### 覆盖任务

- `P0 | 空间树主链路`
- `P0 | 空间侧栏升级`

#### 建议改动范围

- `src/components/workbench/SpaceListPane.vue`
- `src/components/workbench/SpaceListItemCard.vue`
- `src/components/workbench/HulaSpaceTree.vue`
- `src/components/workbench/RoomSpaceWorkbench.vue`
- 空间 service / composable / store

#### 前置依赖

- 空间 hierarchy、tree path、parents 接口能力已确认
- 当前工作台左栏与中栏通信链路稳定

#### 交付物

- 空间树主路径接入 PR
- `next_batch` 分页与 breadcrumb 交互录屏
- 公开/私有/邀请制空间状态矩阵截图
- 空间域 Storybook 补齐

#### 完成标准

- 用户可从空间侧栏进入分页树主路径
- `next_batch` 采用追加加载而非整树重建
- breadcrumb、树节点跳转、父空间定位保持一致
- 空间侧栏项可表达可见性、加入门槛、聚合状态和快捷操作

#### 最小执行清单

1. 明确当前工作台左栏中“空间分组列表”和“分页空间树”的切换入口与展示策略。
2. 接入 `hierarchy / hierarchy v1 / tree_path / parents` 四类能力到统一空间导航状态层。
3. 在 `SpaceListPane` 中补齐空间可见性、加入门槛、聚合未读、快捷操作入口。
4. 让 `HulaSpaceTree` 承担深层导航，`SpaceListPane` 负责范围与分组，不再让两者职责混杂。
5. 补 Storybook：`PinnedSpaces / PublicInviteOnly / TreeLoadMore / Breadcrumb / EmptyResults`。

#### 风险点

- 若直接把树渲染叠加到现有侧栏而不重划职责，用户会同时看到两个“空间入口体系”。
- `next_batch` 若接在错误层级节点上，极易出现 breadcrumb 与树内容不一致。
- 若空间项状态仍以局部样式拼接实现，后续品牌 token 收口会重复返工。

#### 验收出口

- 交互录屏：进入空间 -> 展开子节点 -> `load more` -> breadcrumb 回跳
- 状态截图：公开 / 私有 / 邀请制 / 无权限 / 空结果
- 回归验证：至少覆盖分页追加、父空间定位、空间切换后三栏同步
- 文档回填：更新空间域组件的 `RuntimeComponent` 与 `StorybookTarget` 映射

### 批次 C：房间列表同步基线与详情/输入态收口

#### 目标

- 收口房间列表的同步容器语义。
- 把房间摘要、只读态、tombstoned 态、无权限态和输入区行为统一到真实状态模型。

#### 覆盖任务

- `P0 | 房间列表基线`
- `P0 | 房间摘要与输入态`

#### 建议改动范围

- `src/components/workbench/RoomSessionList.vue`
- 房间列表数据层 / composable / store
- 房间详情区和消息输入区
- 房间摘要 service / 详情 pane

#### 前置依赖

- sliding sync 状态流与 room summary 状态源已明确
- 当前 tombstoned / invited / readonly 识别逻辑已可复用

#### 交付物

- 房间列表状态容器重构 PR
- 初始同步 / 增量同步 / 重连 / 空态四类截图
- 只读 / tombstoned / 无权限 输入禁用态录屏
- 对应回归测试或交互样例

#### 完成标准

- 房间列表能区分初始同步、增量同步、重连恢复和普通空态
- 单房间状态变化不触发整表重绘
- 无权限、只读、已迁移房间不会展示误导性的可编辑输入框
- 详情数据统一来自 summary 能力，不再混用旧逻辑

#### 最小执行清单

1. 明确房间列表顶层状态模型：`initial-loading / incremental-sync / reconnecting / empty / filtered-empty`。
2. 检查列表刷新粒度，避免未读变化、标签变化、时间变化触发整表重绘。
3. 统一消息输入禁用态来源，收敛 `readonly / tombstoned / invited / no-permission` 的判断和提示。
4. 清理详情区混用旧字段与 summary 字段的路径，统一以 summary 能力为准。
5. 补 Storybook 或截图基线：`SyncLoading / Reconnecting / Invite / Tombstoned / SummaryNoPermission`。

#### 风险点

- 若状态模型仍分散在列表、详情区和输入区三处维护，后续修一处会漏另外两处。
- 只读/迁移态若只做禁用按钮而不补解释文案，会造成“不能发但不知道为什么”的体验缺口。
- 如果列表键值与 patch 粒度不稳定，性能采样会失真，无法支撑后续基线。

#### 验收出口

- 页面截图：初始同步、重连、空态、邀请态、已迁移态、无权限态
- 交互录屏：网络恢复、房间切换、输入禁用提示
- 回归验证：至少覆盖单房间状态变化不整表闪动、禁用态提示、详情区状态一致性
- 指标记录：为后续性能报告预留列表刷新与切换耗时采样点

### 批次 D：验收资产与回归闭环

#### 目标

- 把前 3 个批次的改造结果转成可长期维护的设计、回归和验收资产。

#### 覆盖任务

- `P0 | 验收资产`
- `P0 | 回归闭环`

#### 建议改动范围

- `docs/ui`
- Storybook stories
- 截图/录屏资产目录
- 测试用例与 PR 模板引用内容

#### 前置依赖

- 批次 A、B、C 的核心边界趋于稳定

#### 交付物

- 组件级 `VisualSpec / StorybookTarget / RuntimeComponent / MigrationId` 对照清单
- 四条主链路回归矩阵
- 截图基线与录屏索引
- 发布前 UI 验收检查表

#### 完成标准

- 房间列表、空间树、好友接受跳转、能力关闭四条主链路都有可复验资产
- 任一核心组件都能从文档追溯到视觉稿、story、运行组件和迁移编号
- 后续 UI 迭代不再依赖口头记忆判断“是否完成”

#### 最小执行清单

1. 为房间列表、空间树、好友页、详情区建立统一的截图命名和录屏索引规则。
2. 为核心组件补充 `VisualSpec / StorybookTarget / RuntimeComponent / MigrationId` 四列映射表。
3. 为四条主链路整理一页式回归矩阵，明确入口、操作步骤、预期结果、截图位置。
4. 在 PR 描述或发布检查表中加入“是否补齐审计资产”的强制检查项。
5. 将验收清单与本目录现有文档互链，避免形成新的孤立文档。

#### 风险点

- 若先补截图而组件边界还在变化，资产会很快过时。
- 若没有统一命名规则，后续截图和录屏虽然存在，但仍不可追溯。
- 若文档映射只写一次不维护，后续新增 story 或组件迁移会再次失联。

#### 验收出口

- 可直接访问的组件映射表
- 四条主链路的截图与录屏索引
- 发布前 UI 验收检查表
- README 级别的入口链接与使用说明

#### 2026-05-17 实际落地回填

**已完成实现**

- `src/components/rightBox/MsgInput.stories.ts` 已补齐，覆盖了 `Default / Readonly / Tombstoned / NoPermission / Invited / NotFriend / Preparing` 七种状态矩阵，通过模拟 `ChatFooter` 的遮罩层逻辑实现了输入禁用态的视觉闭环。
- `src/components/workbench/HulaSpaceTree.vue` 已完善 `suggestedOnly` 与 `loader` 的递归向下透传，解决了深层空间树无法继承父级过滤策略的问题。
- `src/views/homeWindow/SpaceList.vue` 已接入 `activeTopLevelSpaceId` 计算逻辑，当用户选中深层子空间时，左侧 `SpaceListPane` 现在能正确高亮其对应的顶级祖先空间，补齐了“父空间定位”交互缺口。
- `src/components/workbench/SpaceListPane.vue` 与 `src/components/workbench/RoomSpaceWorkbench.vue` 已新增 `highlightedSpaceId` 协议，支持非直接选中态的视觉高亮，增强了深层导航时的位置感。

**已补资产索引**

- `docs/ui/UI_ALIGNMENT_ASSET_INDEX_2026-05-16.md` 已同步更新，将 `MsgInput.stories.ts` 登记为“输入禁用态”的官方复验入口。

**残余任务**

- 性能量化：`RoomSpaceWorkbench` 的 Storybook 性能采样仍需在真实环境下执行并记录数据。
- 验收录屏：`msg-input-disabled-states.mp4` 等真实资产仍需手动录制。

## P0 批次依赖关系

- 批次 A 与批次 B 可并行，但都依赖现有壳层与 service 状态口径保持稳定。
- 批次 C 依赖房间状态模型与 summary 状态源明确，建议在批次 B 启动后并行推进。
- 批次 D 必须在批次 A、B、C 的主界面结构趋稳后收口，否则验收资产会频繁失效。

## P0 推荐推进节奏

- 第 1 周：批次 A
- 第 2 周：批次 B
- 第 3 周：批次 C
- 第 4 周：批次 D，并同步回填性能、截图与文档

## P1 执行拆解

### 批次 E：消息元信息与详情区模式化

#### 目标

- 让消息区的辅助状态与详情区上下文信息从“分散存在”变成“统一承载”。
- 优先收口 `HulaMessageMeta` 接入与右侧详情区模式切换。

#### 覆盖任务

- `P1 | 消息元信息`
- `P1 | 右侧详情模式化`

#### 建议改动范围

- `src/components/rightBox/renderMessage/index.vue`
- `src/components/rightBox/renderMessage/HulaMessageMeta.vue`
- `src/components/workbench/WorkbenchDetailPane.vue`
- 相关消息状态、回执、typing、presence 数据接入层

#### 前置依赖

- P0 批次 C 已明确房间状态模型和 summary 状态源
- 详情区主承载边界稳定，不再新增独立业务窗口

#### 交付物

- `HulaMessageMeta` 接入 PR
- 详情区模式化重构 PR
- 消息状态与右侧详情区录屏
- Storybook 补充：`ReadonlyMeta / TypingMeta / SummaryMode / MembersMode / ActivityMode / ManageInvite / ManageSettings / ManageAddRoom`

#### 完成标准

- 消息时间、回执、输入中、presence、失败重试进入统一元信息层
- 详情区能在 `summary / manage / members / activity` 之间清晰切换
- 消息区与详情区状态不再相互打架或重复表达

#### 最小执行清单

1. 在消息渲染主链路中明确 `正文` 与 `元信息` 分层，避免状态组件散落在正文内部。
2. 将 `HulaMessageMeta` 接入当前主路径，先覆盖时间、回执、typing、presence 四类信息。
3. 以模式枚举重构 `WorkbenchDetailPane`，把摘要、管理、成员、活动从堆叠流改成可切换结构。
4. 对齐消息区和详情区对 `readonly / tombstoned / no-permission` 的解释文案与状态来源。
5. 补齐对应 Storybook 与截图基线。

#### 风险点

- 若消息元信息仍直接依赖运行时全局对象，接入后可能放大渲染抖动和类型耦合。
- 若详情区只在视觉上“像模式化”，而状态仍是多布尔值并存，后续会继续互斥失控。
- 如果消息区和详情区各自维护一套房间状态文案，最终会出现提示不一致。

#### 验收出口

- 页面截图：消息回执、typing、只读态、详情区四模式
- 交互录屏：消息状态变化与详情区模式切换
- 回归验证：至少覆盖房间切换、详情模式切换、禁用态文案一致性

#### 2026-05-15 实际落地回填

**已完成实现**

- `src/components/rightBox/renderMessage/index.vue` 已将时间、发送中、失败重试、已读回执、typing 等辅助状态收口到统一元信息层，不再分散在 hover 时间条与气泡角标中重复表达。
- `src/components/rightBox/renderMessage/HulaMessageMeta.vue` 已接入消息主链路，并补齐发送中态、失败重试入口、已读回执与最后一条消息 typing 提示。
- `src/components/workbench/WorkbenchDetailPane.vue` 已从“tab + 局部布尔分支”收口为显式 `summary / manage / members / activity` 模式视图；管理态不再与浏览态内容堆叠在同一模板流中。
- 成员预览点击已切换为进入 `members` 模式，成员目录与成员资料卡统一落在成员模式中承载，`activity` 模式只保留公告、成员预览与群组动态摘要。
- `src/components/workbench/WorkbenchDetailPane.stories.ts` 已补 `SummaryMode / MembersMode / ActivityMode`，并结合原有 `ManageInvite / ManageSettings / ManageAddRoom` 形成详情区四模式 Storybook 基线。

**已补测试**

- `src/components/workbench/__tests__/WorkbenchSubcomponents.test.ts` 已补 `detail-mode-summary / detail-mode-manage / detail-mode-members / detail-mode-activity` 模式边界断言。
- 同一测试文件已覆盖 `activity -> members` 切换、成员目录展开、成员资料卡打开、公告重试与管理态表单更新等关键交互。
- 已执行 `pnpm vitest run src/components/workbench/__tests__/WorkbenchSubcomponents.test.ts`，当前 `20` 项测试通过。

**残余风险**

- `HulaMessageMeta.vue` 已补单独的 Storybook 状态与 focused 组件测试；当前剩余主要是截图/录屏类验收资产，后续若继续扩展只读/失败/回执密度展示，仍建议同步补录视觉资产。
- `WorkbenchDetailPane.stories.ts` 当前通过自动切 tab 展示 `members / activity` 模式，适合回归演示，但还未沉淀截图/录屏资产索引。
- `WorkbenchDetailPane.vue` 仍保留 `line-clamp` 兼容性 warning，这不是本轮引入的问题，但后续若做样式清理可顺手补标准属性。

### 批次 F：中栏效率与批量操作收口

#### 目标

- 把工作台中栏从“可用”提升到“高频操作友好”。
- 优先落地批量模式、筛选摘要和快速过滤能力。

#### 覆盖任务

- `P1 | 批量模式`
- `P1 | 工具栏效率`

#### 建议改动范围

- `src/components/workbench/RoomSpaceToolbar.vue`
- `src/components/workbench/RoomBatchActionBar.vue`
- 中栏筛选、搜索、排序相关状态层
- 房间列表批量选择逻辑

#### 前置依赖

- P0 批次 C 已稳定房间列表刷新粒度
- 中栏列表项结构已基本稳定，不会频繁改 key 和主布局

#### 交付物

- 批量模式接入 PR
- 工具栏筛选摘要与快捷过滤接入 PR
- Storybook 补充：`BatchMode / FilterSummary / SavedPreset / EmptyByFilter`
- 中栏操作录屏与截图

#### 完成标准

- 用户可进入批量选择模式并执行已读、静音、置顶或降权等操作
- 当前筛选条件、搜索范围、排序方式可一眼识别
- 支持一键清空筛选和保存常用过滤视图

#### 最小执行清单

1. 在工作台中栏接入 `RoomBatchActionBar`，明确进入、退出和全选逻辑。
2. 为工具栏补充 active filter summary 与 clear all 行为。
3. 梳理快速过滤项的优先顺序，优先支持 unread、mentions、invites、favorites。
4. 评估是否引入 saved presets，至少先预留状态结构和交互位。
5. 补批量模式与筛选摘要的截图、录屏和交互示例。

#### 风险点

- 若批量选择态与普通点击态没有明确切换规则，容易误触进入房间或误选房间。
- 若筛选摘要仅显示部分条件，用户会误判当前结果范围。
- 若 saved presets 过早做成复杂功能，可能拖慢这一批次交付。

#### 验收出口

- 页面截图：批量模式、筛选摘要、筛选空态
- 交互录屏：进入批量模式 -> 执行动作 -> 退出批量模式
- 回归验证：至少覆盖搜索、筛选、排序、批量选择四条中栏链路

#### 2026-05-15 实际落地回填

**已完成实现**

- `src/components/workbench/RoomSpaceWorkbench.vue` 已接入批量模式状态层，统一管理 `batchMode`、已选房间集合、全选/清空与动作触发后的退出逻辑。
- `src/components/workbench/RoomBatchActionBar.vue` 已正式进入工作台主路径，支持全选、标记已读、置顶、静音、退出房间与关闭批量模式。
- `src/components/workbench/RoomSpaceToolbar.vue` 已补批量模式入口，支持 `进入批量 / 退出批量` 文案切换，并保留现有筛选摘要与 `clear all filters` 行为。
- `src/components/workbench/RoomSpaceToolbar.vue` 已补搜索标签、`保存当前视图 / 应用已保存视图` 预设入口，`SavedPreset` 以单槽位本地持久化方式接入，不额外引入复杂配置面板。
- `src/components/workbench/HulaRoomListItem.vue` 已在批量模式下切换为选择语义：显示复选框，点击列表项不再进入会话，而是触发勾选/取消勾选。
- `src/views/homeWindow/SpaceList.vue` 已将 `batchMarkRead / batchPin / batchMute / batchLeave` 接到真实业务动作，分别联通已读、置顶、静音与退房逻辑，并在本地 session 状态上做最小同步。
- `src/components/workbench/RoomSpaceToolbar.stories.ts` 与 `src/components/workbench/RoomSpaceWorkbench.stories.ts` 已补 `FilterSummary / SavedPreset / EmptyByFilter / BatchMode` 场景，可直接做工具栏与中栏效率回归。

**已补测试**

- `src/components/workbench/__tests__/RoomSpaceWorkbench.test.ts` 已覆盖进入批量模式、切换选中、全选、触发批量动作与关闭批量模式主链路。
- `src/components/workbench/__tests__/RoomSessionList.test.ts` 已覆盖批量态 props 透传与 `batchToggle` 重新派发。
- `src/components/workbench/__tests__/HulaRoomListItem.test.ts` 已覆盖批量模式下点击列表项触发选择而非打开会话。
- `src/components/workbench/__tests__/WorkbenchSubcomponents.test.ts` 已覆盖工具栏批量入口与 `RoomBatchActionBar` 的基础交互。
- `src/views/homeWindow/__tests__/SpaceList.test.ts` 已补 `SavedPreset` 的保存/应用回归，验证本地持久化与回填到工作台筛选状态的链路。
- 已执行 `pnpm vitest run src/components/workbench/__tests__/WorkbenchSubcomponents.test.ts src/components/workbench/__tests__/RoomSessionList.test.ts src/components/workbench/__tests__/HulaRoomListItem.test.ts src/components/workbench/__tests__/RoomSpaceWorkbench.test.ts`，当前 `43` 项测试通过。
- 已追加执行 `pnpm vitest run src/components/workbench/__tests__/WorkbenchSubcomponents.test.ts src/views/homeWindow/__tests__/SpaceList.test.ts`，当前新增的 `29` 项相关测试通过。

**残余风险**

- `SavedPreset` 当前为“单条已保存视图 + 本地持久化”轻量方案，尚未扩展为多预设、命名管理或跨设备同步。
- 还未补充最终截图/录屏索引，文档资产层仍需要后续沉淀。

### 批次 G：响应式、无障碍、品牌与性能收口

#### 目标

- 为工作台和好友/空间主链路补齐质量闭环。
- 把响应式、a11y、token 收口和性能量化从“附带要求”提升为正式交付项。

#### 覆盖任务

- `P1 | 响应式适配`
- `P1 | 无障碍`
- `P1 | 品牌与 token 收口`
- `P1 | 性能量化`

#### 建议改动范围

- 工作台壳层、好友页、空间侧栏、详情区
- `SpaceListPane.vue`、`FriendListView.vue`、相关样式 token 文件
- 性能采样点与文档回填

#### 前置依赖

- P0 与 P1 前两批核心交互已稳定
- 关键组件 Storybook 和截图基线基本齐备

#### 交付物

- 响应式适配 PR
- a11y 收口 PR
- token / 硬编码色清理 PR
- 性能基线记录与报告回填

#### 完成标准

- 三栏、双栏、抽屉/滑层切换符合既定断点策略
- room list / space tree / friend card / breadcrumb 具备可用键盘与读屏支持
- 核心业务组件不再新增品牌硬编码色
- 列表 mount、筛选耗时、space switch、分页追加有稳定可复验数据

#### 最小执行清单

1. 按断点梳理工作台壳层，明确右侧详情区在窄宽度下的折叠或滑层规则。
2. 为房间列表、空间树、好友卡片和 breadcrumb 补齐 role、aria、focus、非颜色状态提示。
3. 清理 `SpaceListPane`、`FriendListView` 等核心组件里的硬编码颜色与历史变量别名。
4. 在关键交互链路埋点或记录采样点，形成列表刷新、筛选、切换、分页的基线。
5. 把结果回填到 `docs/ui` 下对应审计/性能文档。

#### 风险点

- 若响应式在主交互稳定前提前做深改，容易因布局变化导致前面批次资产失效。
- 若 a11y 只补属性不补键盘路径，验收时仍然会失败。
- 若性能采样点没有固定触发链路，最终数据无法横向比较。

#### 验收出口

- 页面截图：宽屏、紧凑宽度、窄屏滑层、focus 态、读屏友好状态
- 指标记录：mount time、filter latency、space switch、pagination append
- 回归验证：至少覆盖键盘导航、断点切换、列表性能采样三类用例

#### 2026-05-16 实际落地回填

**已完成实现**

- `src/components/workbench/RoomSpaceWorkbench.vue` 已引入显式 `wide / compact / narrow` 三档布局模型，并支持 `layoutModeOverride` 便于 Storybook 与测试稳定复现断点策略。
- 工作台窄屏态不再继续把三栏硬挤在同一行：左侧 `SpaceListPane` 收口为 rail，中栏保留主会话列表，右侧 `WorkbenchDetailPane` 改为 drawer/slideover 承载。
- `src/components/workbench/RoomSpaceWorkbench.vue` 已补窄屏详情切换入口，并在 `manageMode / overlayMode` 进入时自动展开详情抽屉，避免窄屏下进入管理态后内容无处承载。
- `src/components/workbench/WorkbenchDetailPane.vue` 已接入 `drawerMode / drawerVisible / closeDrawer`，在窄屏下通过绝对定位与 transform 过渡切换为滑层，同时保留 summary/manage/members/activity 模式切换。
- `src/components/workbench/SpaceListPane.vue` 已在窄屏下收口为 rail：搜索输入保留图标与 `aria-label`，隐藏低优先级 meta/count，并压缩到更稳定的窄轨宽度。
- `src/components/workbench/SpaceListPane.vue` 已为分组折叠头补齐按钮语义、`aria-expanded / aria-controls` 与分组 `role="group"` 关联，避免分组折叠仍停留在纯点击 `div`。
- `src/components/workbench/HulaRoomListItem.vue` 已补键盘激活能力，支持 `Enter / Space` 触发打开或批量切换，并在选中/批量态暴露 `aria-current / aria-pressed`。
- `src/components/workbench/RoomSessionList.vue` 已为会话列表补 `aria-label` 与 `aria-busy`，让同步中列表状态可被读屏感知。
- `src/components/friend/FriendListView.vue` 已将好友项从纯 `div` 改为可聚焦、可键盘操作的 `button`，并补上 `list/listitem` 语义。
- `src/components/workbench/HulaSpaceTree.vue` 已为树状结构添加 `tree` 和 `treeitem` 的 `role`，并实现键盘导航。
- `src/views/homeWindow/SpaceList.vue` 已通过 `useSpace().getTreePath()` 接入 `/_matrix/client/v3/spaces/{spaceId}/tree_path`，将当前选中空间的祖先链路透传到工作台头部。
- `src/services/matrix/room/MatrixSpaceService.ts` 已为 `getSpaceTreePath()` 补 `tree_path -> parents` 回退链路，确保 homeserver 未暴露 `tree_path` 时仍可拼出可用 breadcrumb 路径。
- `src/components/workbench/RoomSpaceActionBar.vue` 已将 breadcrumb 从单节点扩成多级 `nav > ol > li`，祖先空间渲染为可点击 crumb，当前空间维持 `aria-current="page"`。
- `src/components/workbench/SpaceListPane.vue` 已将激活态文字从硬编码白色收回到 `--hula-text-inverse`，并复用 `--hula-surface-session-active-shadow` 统一工作台列表选中态阴影。
- `src/components/friend/FriendListView.vue` 已将收藏徽标色与在线文案色收回到现有设计 token，移除十六进制黄与通用灰色 class 的直接依赖。
- `src/components/workbench/RoomSpaceWorkbench.stories.ts` 已将初始渲染样本统一收口为 `ui-room-space-workbench-initial-render`，并补 `PerfFilterLatency / PerfSpaceSwitch / PerfPaginationAppend` 三条固定触发链路，可在 Storybook 中稳定复验 mount、筛选、空间切换与分页追加基线。
- `src/composables/common/useAriaLive.ts` 与 `src/components/common/GlobalAriaLive.vue` 已建立统一的 live region 播报机制，通过 `polite / assertive` 优先级管理异步反馈。
- `src/composables/workbench/useSessionListState.ts` 已接入消息同步完成播报，`src/views/homeWindow/SpaceList.vue` 已接入空间切换选择播报，`src/components/friend/FriendListView.vue` 已接入新好友请求实时播报。
- `src/components/friend/FriendListView.vue` 已接入 `FriendSearchBar.vue`，将好友搜索切换为“输入值 + 去抖后查询值”双轨模型，并补本地搜索历史、历史清空、历史回放与专门的无结果空态。
- `src/components/friend/FriendSearchBar.vue` 已新增 `showHistory` 控制位，允许页面按交互状态决定是否展示最近搜索，而不是在任意输入状态下始终展开。
- `src/composables/common/useRecentSearchHistory.ts` 已统一承载搜索历史的去重、裁剪、30 天过期清理与本地存储逻辑，避免好友列表、好友请求、好友分组各自维护一套 localStorage 规则。
- `src/components/friend/FriendRequestDialog.vue` 与 `src/components/friend/FriendGroupView.vue` 已复用同一套 `FriendSearchBar.vue`，补齐最近搜索回放、专门的搜索无结果提示，以及多入口一致的历史清空策略。
- `src/components/friend/AddFriendDialog.vue` 现已接入同一套 `FriendSearchBar.vue` 与 `useRecentSearchHistory.ts`，补齐添加好友场景的最近搜索、搜索中提示、结果摘要与清空当前搜索入口。
- `src/composables/common/useSearchFeedbackSummary.ts` 已统一承载“搜索中 / 结果摘要 / 空结果描述 / 清空入口显隐”这层 UI 反馈状态，`FriendListView.vue`、`FriendGroupView.vue`、`AddFriendDialog.vue`、`FriendRequestDialog.vue` 现已共用同一套摘要拼装逻辑。
- `src/composables/common/useSearchFeedbackSummary.ts` 现已继续接入统一 `live region` 播报回调，同一份搜索反馈状态会同时驱动读屏提示“搜索中 / 匹配到 N 条 / 无结果”，避免四个好友域入口各自维护一套 `watch` 逻辑。
- `src/components/friend/FriendListView.vue`、`src/components/friend/FriendGroupView.vue`、`src/components/friend/AddFriendDialog.vue`、`src/components/friend/FriendRequestDialog.vue` 均已通过 `useAriaLive()` 把统一搜索反馈接到屏幕阅读器播报，搜索可见摘要与 a11y 异步提示现已共用同一套状态源。
- `src/components/friend/AddFriendDialog.vue` 已将“发送好友请求成功 / 失败”接入统一异步播报链路，视觉消息与屏幕阅读器提示复用同一份文案，其中失败态提升为 `assertive` 优先级。
- `src/components/friend/AddFriendDialog.vue` 现已继续将“已是好友”“搜索用户失败”“验证消息过长”等原本仅视觉可见的提示接入统一异步播报链路，搜索阶段提示与发送阶段提示的播报优先级保持一致。
- `src/components/friend/FriendListView.vue` 已将“设为私密好友”动作的成功 / 失败结果接入统一异步播报链路，好友主列表中的上下文菜单动作开始与搜索、请求处理共用同一套读屏反馈策略。
- `src/components/friend/FriendDetailDrawer.vue` 已将备注保存、显示名保存、加密聊天失败、删除好友成功 / 失败等结果型提示接入统一异步播报链路，好友详情抽屉不再只依赖视觉 toast 反馈。
- `src/views/homeWindow/FriendsList.vue` 已将“未配置私密聊天密码”警告接入统一异步播报链路，好友页壳层 shortcut 在不可达场景下对读屏用户同样可感知。
- `src/components/friend/FriendRequestDialog.vue` 已将“接受 / 拒绝 / 撤销好友请求”的成功失败结果全部接入统一异步播报链路，避免请求处理结果只停留在视觉 toast。
- `src/composables/common/useActionFeedback.ts` 已抽出好友域动作反馈 helper，统一承载 `window.$message + live region announce` 的组合写法，`AddFriendDialog.vue`、`FriendDetailDrawer.vue`、`FriendRequestDialog.vue`、`FriendListView.vue` 与 `FriendsList.vue` 已开始复用，避免同类提示在不同组件内重复拼装。
- 经过本轮收尾，`src/components/friend/` 与 `src/views/homeWindow/FriendsList.vue` 主路径内已无残留的 `window.$message` 直连调用；另外已补齐 `friend.detail.notFound` 中英文文案，清理好友详情抽屉的既有 i18n 信息诊断。
- `src/components/room/JoinRoomDialog.vue` 与 `src/components/room/InviteDialog.vue` 现已开始复用 `useActionFeedback.ts`，把加入房间成功/失败、房间邀请成功/失败及手动输入校验警告纳入统一 `toast + live region` 反馈模式，标志着该 helper 已从好友域扩展到房间主路径对话框。
- `src/components/room/CreateRoomDialog.vue` 现已接入 `useActionFeedback.ts`，把房间创建成功/失败与头像上传失败统一收口到 `toast + live region` 反馈链路，补齐房间创建入口的结果型提示。
- `src/components/room/AnnouncementPanel.vue` 已将公告内容为空警告、发布成功与发布失败提示接入统一异步播报链路，标志着该 helper 已从房间主路径对话框继续扩展到房间管理动作。
- `src/components/room/RoomDetailPane.vue` 已将复制房间 ID 提示接入统一异步播报链路，房间详情侧栏内的轻量结果提示不再只停留在视觉 toast。
- `src/components/rightBox/ForwardDialog.vue` 已将单条消息转发成功/失败结果切到 `useActionFeedback.ts`，并修正对话框对只读 `visible` prop 误用 `v-model:show` 的问题，使消息转发入口也开始遵循统一播报规范。
- `src/components/rightBox/chatBox/ChatMsgMultiChoose.vue` 已将批量删除、批量转发、发送前未选择目标会话、未实现动作提示及房间缺失错误统一切到 `useActionFeedback.ts`，消息批量操作主路径现已开始复用同一套 `toast + live region` 反馈模式。
- `src/views/homeWindow/SpaceList.vue` 已将空间邀请成员、添加房间、空间设置保存三条管理提交链路接入统一异步播报链路，房间/空间管理反馈现已从子面板继续收口到 workbench 壳层。
- `src/components/rightBox/renderMessage/MessageEditor.vue`、`src/components/rightBox/renderMessage/useMessageActions.ts` 与 `src/components/rightBox/renderMessage/File.vue` 已将消息编辑成功/失败、消息重发成功/失败、复制翻译成功、重复表情提示及文件缺失/下载失败错误统一切到 `useActionFeedback.ts`，消息渲染层的公共动作反馈开始复用同一套播报规范。
- `src/components/rightBox/renderMessage/Text.vue` 与 `src/components/rightBox/renderMessage/Beacon.vue` 已将链接复制成功提示、位置共享已结束/无法获取位置/位置信息格式无效等轻量结果提示接入统一异步播报链路，`renderMessage` 长尾结果提示继续向同一套反馈规范收口。
- `src/components/rightBox/MsgInput.vue` 与 `src/components/rightBox/chatBox/ChatFooter.vue` 现已将 Beacon 启动成功/失败、位置发送失败、拖拽文件失败、AI 空内容警告、表情包发送失败、阅后即焚开关成功/关闭提示以及移动端发送文件失败统一切到 `useActionFeedback.ts`，消息输入与操作壳层开始复用同一套 `toast + live region` 反馈规范。
- `src/components/rightBox/chatBox/ChatMain.vue` 已将消息回复跳转过程中的“正在查找消息...”与“无法找到原始消息，可能已被删除或太久远”统一切到 `useActionFeedback.ts`，消息区壳层的过程态 `info / warning` 提示也开始遵循同一套 `toast + live region` 反馈规范。
- `src/components/rightBox/Details.vue`、`src/components/rightBox/chatBox/ChatMultiMsg.vue` 与 `src/components/rightBox/VoiceRecorder.vue` 已分别将好友信息缺失警告、打开聊天记录失败错误和录音失败错误统一切到 `useActionFeedback.ts`，消息详情与长尾操作壳层中的结果提示继续向同一套反馈规范收口。
- `src/components/rightBox/chatBox/useBotView.ts` 与 `src/components/rightBox/emoticon/index.vue` 已将“选择本地模型失败”错误和“删除收藏表情成功 / 失败”提示统一切到 `useActionFeedback.ts`，AI 助手辅助入口与表情面板也开始复用同一套 `toast + live region` 反馈规范。
- `src/components/rightBox/chatBox/HuLaAssistant.vue` 已将“暂不支持压缩后的 glb 模型，请选择原始模型文件”与“模型没有几何数据或存在损坏，请检查后重新导入”两条 warning 统一切到 `useActionFeedback.ts`；至此 `src/components/rightBox/` 运行态残留的 `window.$message` 已清空，仅剩 `ChatMsgMultiChoose.vue` 中一处注释里的旧示例。
- `src/views/loginWindow/ThirdPartyLogin.vue`、`OidcCallback.vue`、`ServerConfigModal.vue`、`src/views/announWindow/index.vue`、`src/views/onlineStatusWindow/index.vue`、`src/views/modalWindow/index.vue` 与 `src/views/LockScreen.vue` 已全部切到 `useActionFeedback.ts`，登录/公告/在线状态/邀请/锁屏等低频页面层运行态旧提示已清空。
- `src/components/friend/FriendGroupView.vue`、`src/components/common/InfoPopover.vue`、`src/components/userMenu/UserMenuHeader.vue`、`src/components/space/CreateSpaceDialog.vue`、`src/components/workbench/HulaSpaceJoinCta.vue`、`src/components/workbench/WorkbenchQuickCreate.vue`、`src/components/widget/WidgetManager.vue`、`src/components/common/ConnectionStatusBanner.vue`、`src/components/common/HomeserverDialog.vue`、`src/components/dm/CreateDmDialog.vue`、`src/components/workbench/WorkbenchForwardPane.vue`、`src/components/voice/VoiceMessageEnhanced.vue`、`src/components/common/Screenshot/ScreenshotRoot.vue` 与加密域 `CrossSigningDialog.vue / KeyBackupSetupDialog.vue / DeviceVerifyDialog.vue / KeyBackupRestoreDialog.vue / KeyRotationDialog.vue` 现已统一接入 `useActionFeedback.ts`，跨域长尾组件中的运行态旧提示也已基本清空。
- 已移除 `ChatMsgMultiChoose.vue` 中残留的旧 `window.$message` 注释示例，并清掉其未再消费的 `mergeMessageType` 历史影子状态。
- `src/typings/global.d.ts` 与 `src/typings/env.d.ts` 的全局窗口注入类型已完成收口，`NaiveProvider.vue` 中的 `$message` 注册逻辑也已改写为更明确的“统一反馈桥接”基础设施；当前 `src/components` 运行态旧提示仅剩 `NaiveProvider.vue` 为 hooks / mobile / 非组件上下文保留的全局桥接赋值。
- 已新增 focused 测试覆盖 `HomeserverDialog.vue`、`ConnectionStatusBanner.vue` 与 `HulaSpaceJoinCta.vue` 三个公共组件的统一反馈出口，分别锁定配置保存、连接诊断与加入/离开空间的 success / warning / error 播报行为。
- `src/App.vue`、`src/mobile/login.vue` 与 `src/mobile/views/MobileForgetPassword.vue` 已将代理保存失败、移动端注册验证码发送/注册成功失败、忘记密码验证码/邮箱校验/重置密码等认证链路结果提示统一切到 `useActionFeedback.ts`。
- `src/mobile/views/friends/StartGroupChat.vue`、`src/mobile/views/chat-room/MobileInviteGroupMember.vue`、`src/mobile/views/chat-room/notice/NoticeEdit.vue`、`src/mobile/views/chat-room/notice/NoticeDetail.vue`、`src/mobile/views/friends/ConfirmAddGroup.vue`、`src/mobile/views/friends/ConfirmAddFriend.vue`、`src/mobile/views/friends/AddFriends.vue`、`src/mobile/views/my/EditProfile.vue`、`src/mobile/views/my/MyAlbum.vue`、`src/mobile/components/VideoPreview.vue`、`src/mobile/components/chat-room/panel/More.vue`、`src/mobile/views/chat-room/ChatSetting.vue`、`src/mobile/views/chat-room/ManageGroupMember.vue`、`src/mobile/views/chat-room/MobileChatMain.vue`、`src/mobile/layout/my/MyLayout.vue`、`src/mobile/components/ImagePreview.vue`、`src/mobile/components/my/PersonalInfo.vue`、`src/mobile/views/message/index.vue` 与 `src/mobile/views/friends/index.vue` 已将移动端群聊创建/邀请、群公告编辑查看、资料保存、联系人/消息入口、二维码扫码、媒体保存与预览、群设置与成员管理等结果提示统一切到 `useActionFeedback.ts`。
- 复扫 `src/mobile` 与 `src/App.vue` 后，运行态 `window.$message` 已全部清空；移动端本轮已从初始 `75` 处命中压缩到 `0`，仅 `src/mobile/views/friends/index.vue` 仍保留一组与本次改动无关的既有模板类型诊断，后续可单独收敛其状态暴露问题。
- `src/hooks/session/openMsgSession.ts`、`src/views/loginWindow/hooks/useSsoCallback.ts` 与 `src/hooks/useMessage.ts` 已将会话打开失败、SSO 回调失败、会话置顶/降权/复制账号/屏蔽/隐藏/删除好友/退出群聊/通知设置等桌面主链路 hook 提示统一切到 `useActionFeedback.ts`。
- `src/hooks/useDownload.ts`、`src/hooks/useUpload.ts`、`src/hooks/chatMain/useChatCopy.ts` 与 `src/hooks/chatMain/useChatFileDownload.ts` 已将下载失败、上传超限、文本/图片复制成功与失败、文件显隐/下载成功失败，以及下载过程中的可销毁 `info` 进度提示统一切到 `useActionFeedback.ts`。
- `src/hooks/useChatMain.ts` 已将图片取链失败、移动端暂未开放、撤回失败、翻译空内容、图片保存/定位失败、设置/撤销管理员、移出群聊、举报成功失败、删除消息成功失败等消息主链路结果提示统一切到 `useActionFeedback.ts`，并同步清理了文件内残留的旧 `window.$message` 注释示例。
- `src/hooks/chatMain/useGroupNicknameModal.ts`、`src/hooks/useLoginFlow.ts`、`src/hooks/useAvatarUpload.ts`、`src/hooks/useVoiceRecordRust.ts` 与 `src/hooks/msgInput/useMsgInputMentionActions.ts` 已将群昵称无房间报错、登录失败、头像加载/裁剪/上传失败、录音失败、AI mention 占位提示等轻量 hook 结果提示统一切到 `useActionFeedback.ts`。
- `src/hooks/useWindow.ts` 已将模态窗口创建失败、RTC 会话未就绪、群聊不支持直呼、缺少远端用户信息等窗口主链路结果提示统一切到 `useActionFeedback.ts`。
- `src/hooks/msgInput/useMsgInputSend.ts` 已将图片数量超限、消息类型不支持、文件直发失败等发送主链路结果提示统一切到 `useActionFeedback.ts`。
- `src/hooks/useWebRtc.ts` 已将无可用设备、设备获取失败、本地流拉取失败、RTC 断连、通话超时、清理失败、房间不存在、摄像头恢复失败等通话主链路结果提示统一切到 `useActionFeedback.ts`，并将 `useCameraSwitch.ts` / `useScreenShare.ts` 的提示出口改为通过 `notify` 注入统一反馈。
- 复扫 `src/hooks` 后，该域运行态业务提示中的 `window.$message` 直连已清空；仓库中其余 `$message` 命中位于测试桩、helper、provider 或其他尚未迁移的业务域，不再属于当前 hooks 收口范围。
- `src/layout/left/components/InfoEdit.vue`、`src/layout/left/config.tsx`、`src/layout/left/hook.ts`、`src/layout/index.vue` 与 `src/layout/left/model.tsx` 已将头像上传成功、退出登录失败、昵称/徽章保存结果、拖拽文件解析失败、更新下载成功/失败等桌面布局层结果提示统一切到 `useActionFeedback.ts`；复扫 `src/layout` 后，运行态业务结果提示已清空。
- `src/utils/AttachmentSaver.ts` 与 `src/utils/PathUtil.ts` 已将附件保存成功/失败、缺失下载链接、HEAD 检查后“找不到文件”等工具层结果提示统一切到 `useActionFeedback.ts`；复扫 `src/utils` 后，运行态业务结果提示已清空。
- `src/plugins/robot/components/ApiKeyManagement.vue`、`ModelManagement.vue`、`ChatRoleManagement.vue` 以及 `useRobotChat.ts`、`useAiGenerationParams.ts`、`useAiHistoryView.ts`、`useAiTitleEdit.ts`、`useAiProviderConfig.ts`、`useAiConversationMessages.ts`、`useAiConversationLifecycle.ts`、`useAiGenerationPolling.ts`、`useAiMediaGeneration.ts`、`useAiRoleManagement.ts`、`useAiModelManagement.ts` 与 `src/plugins/robot/layout/Left.vue` 已将 AI provider 配置、会话创建删除、消息删除、模型/角色切换、生成轮询成功失败、token 超限、列表加载失败等 `success / warning / error` 结果提示统一切到 `useActionFeedback.ts`。
- `src/plugins/robot/composables/useAiStreaming.ts` 本轮已将 `openclaw` 未连接、token 超限、发送失败、停止生成成功/失败，以及流式生成中的可销毁 `loading` 进度提示统一切到 `useActionFeedback.ts`；`useAiRoleManagement.ts` 与 `useAiModelManagement.ts` 中原先用于清理旧 toast 的 `destroyAll()` 也已改为 helper 统一出口。
- 复扫 `src/plugins/robot` 后，该域运行态业务提示中的 `window.$message` 直连已清空；仓库中其余残留命中位于 helper / provider / 测试代码或其他尚未迁移的业务域，不属于本批次 `robot` 收口范围。
- `src/main.ts` 已将 `AppException` 在 Vue 全局错误处理中的 `error` 提示切到 `useActionFeedback.ts`，避免应用启动后的顶层异常仍直连全局 `$message`。
- `src/stores/domains/chat/emoji.ts`、`src/stores/domains/widget/fileDownload.ts`、`src/stores/domains/widget/scanner.ts` 与 `src/stores/domains/widget/downloadQueue.ts` 已将添加表情成功、文件下载失败、扫描器初始化失败、未选择目录 warning、另存为失败等 store 层运行态提示统一切到 `useActionFeedback.ts`。
- `src/common/exception.ts` 已将 `AppException` 的 `showError` 分支切到 `useActionFeedback.ts`，保留原有“2 秒内只显示一次”的去重策略，同时把异常提示接入统一 `toast + live region` 反馈链路。
- 复扫 `src/main.ts`、`src/stores` 与 `src/common` 后，当前运行态业务提示中的 `window.$message` 直连已清空；该范围内仅剩测试文件中的 mock/注释命中。
- 下一轮建议从 `rightBox` 扩展到相邻消息交互域之外的长尾入口，或回头清理注释中的旧 `window.$message` 示例与更外层业务组件中的历史提示点。

**已补测试**

- `src/components/workbench/__tests__/RoomSpaceWorkbench.test.ts` 已覆盖 `wide / compact / narrow` 断点切换、窄屏详情开关、以及管理态/overlay 态自动打开抽屉。
- `src/components/workbench/__tests__/WorkbenchSubcomponents.test.ts` 已补 `SpaceListPane` 的 rail 收口断言，以及 `WorkbenchDetailPane` 在 drawer 模式下的样式类与关闭事件断言。
- `src/components/workbench/__tests__/WorkbenchSubcomponents.test.ts` 现已继续覆盖空间分组按钮的 `aria-expanded` 和导航语义断言。
- `src/components/workbench/__tests__/RoomSessionList.test.ts` 已补会话列表 `aria-label / aria-busy` 断言，`src/components/workbench/__tests__/HulaRoomListItem.test.ts` 已补键盘激活与 aria 状态断言。
- `src/components/friend/__tests__/FriendListView.test.ts` 已补好友列表 `list / listitem` 语义、点击后 `aria-current` 更新，以及详情抽屉 userId 回填断言。
- `src/components/workbench/__tests__/HulaSpaceTree.test.ts` 已覆盖根节点 `tree / treeitem` 语义、`Enter` 触发选择，以及 `ArrowRight` 展开后渲染子级 `group` 的键盘路径。
- `src/components/workbench/__tests__/WorkbenchSubcomponents.test.ts` 已补 `RoomSpaceActionBar` breadcrumb `nav` 与当前节点 `aria-current="page"` 断言。
- `src/components/workbench/__tests__/WorkbenchSubcomponents.test.ts` 现已继续覆盖多级 ancestor crumb 点击后抛出 `selectBreadcrumb`，`src/components/workbench/__tests__/RoomSpaceWorkbench.test.ts` 已覆盖 breadcrumb 事件透传，`src/views/homeWindow/__tests__/SpaceList.test.ts` 已覆盖 `tree_path` 加载与祖先跳转。
- `src/services/matrix/room/__tests__/MatrixSpaceService.test.ts` 已覆盖 `tree_path` 不可用时回退到 `parents` API 拼接祖先链路。
- 已执行 `pnpm vitest run src/components/workbench/__tests__/WorkbenchSubcomponents.test.ts src/components/workbench/__tests__/RoomSessionList.test.ts src/components/workbench/__tests__/HulaRoomListItem.test.ts`，当前 `38` 项测试通过。
- 已追加执行 `pnpm vitest run src/components/friend/__tests__/FriendListView.test.ts src/components/workbench/__tests__/HulaSpaceTree.test.ts`，当前新增 `3` 项测试通过。
- 已追加执行 `pnpm vitest run src/components/workbench/__tests__/HulaSpaceTree.test.ts`，当前新增 `2` 项测试通过。
- 已追加执行 `pnpm vitest run src/components/workbench/__tests__/WorkbenchSubcomponents.test.ts src/components/workbench/__tests__/RoomSpaceWorkbench.test.ts src/views/homeWindow/__tests__/SpaceList.test.ts`，当前 `48` 项测试通过。
- 已追加执行 `pnpm vitest run src/components/workbench/__tests__/WorkbenchSubcomponents.test.ts src/components/friend/__tests__/FriendListView.test.ts`，当前 `28` 项测试通过，确认 token 清理未影响 workbench/friend 主路径行为。
- 已追加执行 `pnpm vitest run src/components/friend/__tests__/FriendSearchBar.test.ts src/components/friend/__tests__/FriendListView.test.ts`，当前 `6` 项测试通过，确认搜索历史、无结果提示与好友列表主路径回归正常。
- 已追加执行 `pnpm vitest run src/composables/__tests__/useRecentSearchHistory.test.ts src/components/friend/__tests__/FriendGroupView.test.ts src/components/friend/__tests__/FriendRequestDialog.test.ts`，当前 `5` 项测试通过，确认历史清理策略、分组搜索复用与好友请求搜索复用正常。
- 已追加执行 `pnpm vitest run src/components/friend/__tests__/AddFriendDialog.test.ts`，当前 `1` 项测试通过，确认添加好友入口已复用统一搜索条与本地历史策略。
- 已追加执行 `pnpm vitest run src/composables/__tests__/useSearchFeedbackSummary.test.ts src/components/friend/__tests__/FriendGroupView.test.ts src/components/friend/__tests__/AddFriendDialog.test.ts src/components/friend/__tests__/FriendListView.test.ts`，当前 `8` 项测试通过，确认统一搜索摘要 composable 与三个入口接线稳定。
- 已追加执行 `pnpm vitest run src/components/friend/__tests__/FriendRequestDialog.test.ts src/composables/__tests__/useSearchFeedbackSummary.test.ts`，当前 `4` 项测试通过，确认好友请求入口也已接入统一搜索摘要反馈。
- 已追加执行 `pnpm vitest run src/composables/__tests__/useSearchFeedbackSummary.test.ts src/components/friend/__tests__/FriendListView.test.ts src/components/friend/__tests__/FriendGroupView.test.ts src/components/friend/__tests__/AddFriendDialog.test.ts src/components/friend/__tests__/FriendRequestDialog.test.ts`，当前 `11` 项测试通过，确认统一搜索反馈的 `live region` 播报在四个好友搜索入口上均已稳定覆盖“搜索中 / 匹配结果 / 无结果”。
- 已追加执行 `pnpm vitest run src/components/friend/__tests__/AddFriendDialog.test.ts src/components/friend/__tests__/FriendRequestDialog.test.ts`，当前 `5` 项测试通过，确认发送好友请求与接受/拒绝请求的成功失败结果均已接入统一 `live region` 播报。
- 已追加执行 `pnpm vitest run src/components/friend/__tests__/FriendRequestDialog.test.ts`，当前 `4` 项测试通过，确认撤销好友请求的成功 / 失败结果也已接入统一 `live region` 播报。
- 已追加执行 `pnpm vitest run src/components/friend/__tests__/AddFriendDialog.test.ts`，当前 `4` 项测试通过，确认 `AddFriendDialog` 中“已是好友 / 搜索失败 / 验证消息过长 / 发送成功失败”均已接入统一 `live region` 播报。
- 已追加执行 `pnpm vitest run src/components/friend/__tests__/FriendDetailDrawer.test.ts`，当前 `2` 项测试通过，确认好友详情抽屉中的备注保存、显示名保存、加密聊天失败、删除好友成功 / 失败均已接入统一 `live region` 播报。
- 已追加执行 `pnpm vitest run src/components/friend/__tests__/FriendListView.test.ts src/views/homeWindow/__tests__/FriendsList.test.ts`，当前 `8` 项测试通过，确认好友主列表的私密好友动作与好友页壳层的“未配置私密聊天密码”警告均已接入统一 `live region` 播报。
- 已追加执行 `pnpm vitest run src/composables/__tests__/useActionFeedback.test.ts src/components/friend/__tests__/AddFriendDialog.test.ts src/components/friend/__tests__/FriendRequestDialog.test.ts src/components/friend/__tests__/FriendDetailDrawer.test.ts src/components/friend/__tests__/FriendListView.test.ts src/views/homeWindow/__tests__/FriendsList.test.ts`，当前 `20` 项测试通过，确认好友域动作反馈 helper 收口后，既有播报行为保持稳定。
- 已追加执行 `pnpm vitest run src/components/room/__tests__/JoinRoomDialog.test.ts src/components/room/__tests__/InviteDialog.test.ts`，当前 `2` 项测试通过，确认 `useActionFeedback` 向房间加入/邀请对话框扩展后，成功、失败与校验警告提示均已走统一反馈 helper。
- 已追加执行 `pnpm vitest run src/components/room/__tests__/CreateRoomDialog.test.ts src/components/room/__tests__/AnnouncementPanel.test.ts src/components/rightBox/__tests__/ForwardDialog.test.ts`，当前 `13` 项测试通过，确认房间创建、房间公告管理与单条消息转发三条入口的成功/失败/校验提示均已接入统一异步播报链路。
- 已追加执行 `pnpm vitest run src/components/rightBox/chatBox/__tests__/ChatMsgMultiChoose.test.ts`，当前 `5` 项测试通过，确认消息批量操作中的删除、转发、未选择目标、未实现提示与房间缺失错误均已接入统一异步播报链路。
- 已追加执行 `pnpm vitest run src/components/room/__tests__/RoomDetailPane.test.ts src/views/homeWindow/__tests__/SpaceList.test.ts`，当前 `17` 项测试通过，确认房间详情复制提示与空间管理壳层中的邀请成员、添加房间、设置保存三条提交链路均已接入统一异步播报链路。
- 已追加执行 `pnpm vitest run src/components/rightBox/renderMessage/__tests__/MessageEditor.test.ts src/components/rightBox/renderMessage/__tests__/useMessageActions.test.ts src/components/rightBox/renderMessage/__tests__/File.test.ts`，当前 `8` 项测试通过，确认消息编辑、消息重发、翻译复制、重复表情提示与文件错误反馈均已接入统一异步播报链路。
- 已追加执行 `pnpm vitest run src/components/rightBox/renderMessage/__tests__/Text.test.ts src/components/rightBox/renderMessage/__tests__/Beacon.test.ts`，当前 `4` 项测试通过，确认链接复制成功提示与位置共享状态提示也已接入统一异步播报链路。
- 已追加执行 `pnpm vitest run src/components/rightBox/__tests__/MsgInput.test.ts src/components/rightBox/chatBox/__tests__/ChatFooter.test.ts`，当前 `8` 项测试通过，确认消息输入与操作壳层中的 Beacon、位置、拖拽文件、AI 空内容、阅后即焚、表情包发送失败与移动端发送文件失败提示均已接入统一异步播报链路。
- 已追加执行 `pnpm vitest run src/components/rightBox/chatBox/__tests__/ChatMain.test.ts`，当前 `2` 项测试通过，确认消息回复跳转过程中的“查找中 / 未找到原始消息”提示也已接入统一异步播报链路。
- 已追加执行 `pnpm vitest run src/components/rightBox/__tests__/Details.test.ts src/components/rightBox/chatBox/__tests__/ChatMultiMsg.test.ts src/components/rightBox/__tests__/VoiceRecorder.test.ts`，当前 `5` 项测试通过，确认好友信息缺失警告、打开聊天记录失败错误与录音失败错误也已接入统一异步播报链路。
- 已追加执行 `pnpm vitest run src/components/rightBox/chatBox/__tests__/useBotView.test.ts src/components/rightBox/emoticon/__tests__/index.test.ts`，当前 `3` 项测试通过，确认选择本地模型失败错误与删除收藏表情成功 / 失败提示也已接入统一异步播报链路。
- `HuLaAssistant.vue` 的 warning 分支已完成代码接线，但由于 Three.js / WebGL 运行时 mock 成本较高，本轮未保留对应自动化测试；当前通过 `rightBox` 范围复扫确认运行态 `window.$message` 仅剩一处注释示例，后续若继续深挖 3D 助手入口，可再补更稳定的运行时测试。
- 已追加执行 `pnpm vitest run src/views/loginWindow/__tests__/OidcCallback.test.ts src/views/loginWindow/__tests__/ThirdPartyLogin.test.ts`，对应测试当前均通过；其中 `ThirdPartyLogin.test.ts` 仍存在既有 `matrix.test/_matrix/client/v3/login` 异步 fetch 被 `happy-dom` 中止后的退出日志噪音，但不影响用例结果，后续可单独补更彻底的登录流 mock 来消除此 hanging-process 提示。
- 已追加执行 `pnpm vitest run src/components/common/__tests__/HomeserverDialog.test.ts src/components/common/__tests__/ConnectionStatusBanner.test.ts src/components/workbench/__tests__/HulaSpaceJoinCta.test.ts`，当前 `8` 项 focused 测试通过，确认公共配置、公共诊断与空间 CTA 这批新收口组件的统一反馈出口已被稳定覆盖。
- 已追加执行 `pnpm vitest run src/hooks/session/__tests__/openMsgSession.test.ts src/views/loginWindow/__tests__/Login.test.ts`，当前 `17` 项测试通过，确认会话打开链路与 SSO 登录回调已切换到统一反馈出口且未引入回归。
- 已追加执行 `pnpm vitest run src/hooks/__tests__/useDownload.test.ts src/hooks/__tests__/useUpload.test.ts src/hooks/chatMain/__tests__/useChatCopy.test.ts src/hooks/chatMain/__tests__/useChatFileDownload.test.ts`，当前 `37` 项测试通过；其中 `useUpload.test.ts` 仍保留既有 `vi.fn()` 实现方式的 stderr 提示噪音，但不影响测试结果。
- 已新增 `src/hooks/__tests__/useChatMain.test.ts`，focused 覆盖 `handleConfirm` 的删除成功/缺少会话 error、`menu.set_admin` 的 success/error，以及 `menu.report` 的 warning/success；已执行 `pnpm vitest run src/hooks/__tests__/useChatMain.test.ts`，当前 `4` 项测试通过。
- 已追加执行 `pnpm vitest run src/hooks/chatMain/__tests__/useGroupNicknameModal.test.ts src/hooks/msgInput/__tests__/useMsgInputMentionActions.test.ts src/hooks/__tests__/useLogin.test.ts`，当前 `19` 项测试通过，确认群昵称弹窗、AI mention 占位提示与登录失败反馈已切换到统一反馈出口且未引入回归。
- 已重写 `src/hooks/__tests__/useWindow.test.ts`，focused 覆盖非桌面短路、桌面建窗、`startRtcCall` 的 warning/error 分支，以及模态窗口创建失败时的 error 反馈；已执行 `pnpm vitest run src/hooks/__tests__/useWindow.test.ts`，当前 `5` 项测试通过。
- 已新增 `src/hooks/msgInput/__tests__/useMsgInputSend.test.ts`，focused 覆盖图片数量超限 warning、消息类型不支持 warning、文件直发失败 error；已执行 `pnpm vitest run src/hooks/msgInput/__tests__/useMsgInputSend.test.ts`，当前 `3` 项测试通过。
- 已新增 `src/hooks/__tests__/useWebRtc.test.ts`，focused 覆盖 `getLocalStream` 无设备 error、`startCall` 获取设备失败 error、通话超时 warning、`toggleVideo` 摄像头恢复失败 error 与 `clear` 清理失败 error；已执行 `pnpm vitest run src/hooks/__tests__/useWebRtc.test.ts`，当前 `5` 项测试通过。测试进程仍带有既有 hanging-process 退出提示，但用例结果正常。
- 已追加执行 `pnpm vitest run src/mobile/__tests__/login.test.ts`，当前 `2` 项测试通过，确认移动端 SSO 登录回调链路在本轮认证提示迁移后未引入回归。
- 已追加执行 `pnpm vitest run src/plugins/robot/composables/__tests__/useAiGenerationParams.test.ts src/plugins/robot/composables/__tests__/useAiGenerationPolling.test.ts src/plugins/robot/composables/__tests__/useAiMediaGeneration.test.ts`，当前 `24` 项测试通过，确认 `robot` 域最近一批提示迁移与测试断言切换到 `showFeedback` 后未引入回归。
- 已追加执行 `pnpm vitest run src/stores/domains/chat/__tests__/emoji.test.ts src/common/__tests__/exception.test.ts`，当前 `9` 项测试通过，确认 store 层表情上传成功提示与 `AppException` 的 surfaced error 提示已切换到统一反馈出口。

**残余风险**

- 本次已完成 workbench 主路径与好友主入口中 `space list / room list / space tree / friend card / breadcrumb` 的首轮键盘与 aria 收口；token 清理已覆盖 `workbench / friend` 核心业务组件的主要硬编码尾巴。
- `RoomSpaceWorkbench.stories.ts` 当前已具备 `mount / filter latency / space switch / pagination append` 四类可重复触发的 Storybook 样本，基线已初步建立。
- 目前 `RoomBatchActionBar` 在窄屏下仍沿用中栏内联承载，是否需要进一步转为底部 dock 仍待后续根据真实交互再收一轮。

## P1 批次依赖关系

- 批次 E 依赖 P0 批次 C 的房间状态模型稳定，否则消息元信息和详情模式会反复返工。
- 批次 F 依赖房间列表结构和刷新粒度稳定，否则批量模式与筛选摘要容易失效。
- 批次 G 建议在批次 E、F 后收口，以免响应式、a11y 和性能资产因主界面结构变动而过期。

## P1 推荐推进节奏

- 第 5 周：批次 E
- 第 6 周：批次 F
- 第 7 周：批次 G

## P2 执行拆解

### 批次 H：实机与边缘场景验证收口

#### 目标

- 将当前尚停留在清单层的边缘场景验证转化为实际验收结果。
- 优先完成真实设备、RTL、触屏、桌面 Electron 和移动 Web 的 UI 行为确认。

#### 覆盖任务

- `P2 | 实机/边缘验证`

#### 建议改动范围

- 好友页桌面/移动入口
- 工作台主壳层、空间侧栏、消息区
- Electron 桌面端上下文菜单
- Mobile Web 窄屏布局

#### 前置依赖

- P0、P1 主链路界面结构已基本稳定
- 关键截图基线与 Storybook 状态已具备参考价值

#### 交付物

- 实机验证记录
- RTL、触屏、桌面 Electron、Mobile Web 截图或录屏
- 边缘场景问题单与修复回填清单

#### 完成标准

- RTL 下头像、状态徽标、布局流向无明显错位
- Touch target、hover on touch、12px radius 一致性均有实测结果
- Electron 右键菜单定位与 Mobile Web 无横向滚动得到验证

#### 最小执行清单

1. 按 `UX-03_TEST_CHECKLIST.md` 为好友页和工作台建立实机验证记录模板。
2. 在桌面端验证右键菜单定位、hover 行为与紧凑布局表现。
3. 在触屏或移动 Web 验证点击热区、hover 粘滞和横向滚动问题。
4. 在 RTL 环境下验证头像、presence badge、操作按钮位置和文本流向。
5. 把结果回填到文档，明确“通过 / 未通过 / 需修复”。

#### 风险点

- 若没有统一设备与浏览器记录，后续很难复现问题发生环境。
- 若边缘验证只记录“通过/失败”而不附截图，后续复查价值很低。
- 如果实机验证过晚，修复问题可能会反向影响前面已沉淀的截图基线。

#### 验收出口

- 实机截图与录屏索引
- 边缘场景验证结论表
- 问题清单与是否已修复的状态记录

### 批次 I：搜索体验、异步播报与长尾文案收尾

#### 目标

- 把剩余的搜索体验、读屏播报和长尾 i18n 残项彻底收口。
- 让产品从“主流程可用”推进到“细节体验完整”。

#### 覆盖任务

- `P2 | 搜索体验`
- `P2 | A11y 异步播报`
- `P2 | 长尾 i18n`

#### 建议改动范围

- 好友搜索入口与搜索状态存储
- 公共 a11y 组件或状态播报组件
- 设置体系、低频页面、错误提示与辅助提示文案

#### 前置依赖

- P1 批次 G 已完成基础 a11y、响应式和核心交互收口
- 搜索主链路和关键异步交互已经稳定，不再频繁变动

#### 交付物

- 搜索历史与无结果反馈 PR
- `live region` 或等效异步播报组件 PR
- 长尾 i18n 收口 PR
- 文案和播报行为截图/录屏

#### 下一轮优先入口

- `src/components/room/CreateRoomDialog.vue`：优先补齐创建房间成功/失败、命名或配置校验警告的统一 `toast + live region` 反馈。
- `src/components/room/InviteDialog.vue` 之外的房间管理动作：重点筛查房间设置、成员管理、空间挂载、权限或别名维护等仍停留在视觉提示的结果型交互。
- `src/components/chat/ForwardDialog.vue` 与消息批量操作类对话框：优先利用其既有成功/失败提示文案，把“已明确结果”的异步动作先纳入统一播报规范。
- 本轮扩展目标：让批次 I 的“统一异步播报”从好友域和房间域主路径进一步收口为真正的公共交互规范，而不只停留在单一业务域内。

#### 完成标准

- 搜索历史可回放，快速输入不掉帧，无结果态明确
- 邀请接受、空间加入、同步恢复等关键异步结果可被读屏感知
- 用户可见的日志、错误提示、辅助提示不再遗留明显硬编码中文

#### 最小执行清单

1. 为好友搜索补历史记录、无结果反馈与去抖体验复核。
2. 明确哪些异步链路必须播报，至少覆盖邀请接受、空间加入、同步恢复，并把 `CreateRoomDialog.vue`、房间管理动作、`ForwardDialog.vue` / 消息批量操作对话框列为下一轮优先盘点入口。
3. 设计并接入统一 `live region` 承载层，避免每个页面各自拼接播报逻辑。
4. 盘点设置体系与低频页面的残余硬编码提示文案并逐步替换为 i18n。
5. 为搜索历史、播报结果、长尾文案收口补充演示截图或录屏。

#### 风险点

- 如果搜索历史只做本地缓存而不处理清理策略，后续会出现噪音或脏数据问题。
- 若 `live region` 没有统一优先级和节流策略，连续播报会影响可用性。
- 长尾 i18n 若只替换静态标题而忽略运行时错误提示，最终仍会残留明显不一致。

#### 验收出口

- 页面截图：搜索历史、无结果态、播报触发场景
- 交互录屏：快速搜索、异步结果播报、错误提示国际化结果
- 回归验证：至少覆盖搜索体验、播报可用性、长尾文案三类细节链路

#### 2026-05-17 实际落地回填

**已完成实现**

- `src/components/friend/FriendSearchBar.vue` 已形成“输入去抖 + 回车立即搜索”的统一入口行为，历史面板仍保留 `showHistory` 开关，避免空历史或嵌入式场景出现冗余承载。
- `src/components/friend/FriendSearchBar.stories.ts` 已补 `Default / NoHistory / HiddenHistory / Rtl` 四个 Storybook 场景，可直接演示有历史、空历史、隐藏历史与 RTL 布局下的搜索入口表现。
- `src/components/friend/__tests__/FriendSearchBar.test.ts` 已覆盖去抖搜索、历史面板显隐、选择历史、清空历史与回车立即搜索，锁定快速输入与历史入口的基础交互。
- `src/components/friend/__tests__/FriendListView.test.ts` 已覆盖好友搜索历史恢复、无结果空态与 live region 搜索摘要播报，证明“搜索历史 / 无结果态 / 结果反馈”三条主链路可回归。
- `src/components/friend/__tests__/AddFriendDialog.test.ts` 已覆盖加好友搜索历史恢复与清空逻辑，保证搜索体验不是只在好友列表主入口可用，而是复用到搜索型弹窗链路。
- `src/views/loginWindow/ThirdPartyLogin.vue` 已将 OIDC / SAML / CAS 的未配置、不可用、授权 URL 获取失败与登录失败提示全部切到 `login.json`，不再残留中文硬编码反馈。
- `src/views/loginWindow/RemoteLoginModal.vue` 已改为消费 `login.remote_login.*` 文案键，统一承载标题、未知 IP、正文说明与确认按钮文案。
- `src/views/loginWindow/SecretChatModal.vue` 已改为消费 `login.secret_chat.*` 文案键，密码占位、校验提示、错误态与确认按钮均不再写死中文。
- `src/views/loginWindow/Login.vue` 已将忘记密码窗口标题切到 `login.option.items.forget`，补齐低频入口标题国际化。
- `locales/zh-CN/login.json`、`locales/en/login.json` 与 `src/typings/i18n.d.ts` 已同步补齐新增键位，保证桌面登录低频弹窗和 SSO 提示在中英文下都可稳定解析。
- `src/views/loginWindow/__tests__/ThirdPartyLogin.test.ts` 已补 OIDC 不可用与授权 URL 失败两条回归，锁定新引入的翻译反馈分支。

**搜索体验证据回填**

- Storybook：
  - `src/components/friend/FriendSearchBar.stories.ts`
    - `Default`：带历史 chips 的标准搜索入口
    - `NoHistory`：空历史态下仅保留输入框
    - `HiddenHistory`：上层主动关闭历史面板时的嵌入式入口
    - `Rtl`：RTL 布局下的搜索入口
- Focused tests：
  - `src/components/friend/__tests__/FriendSearchBar.test.ts`
    - 去抖搜索会正常触发
    - 空历史 / 隐藏历史不渲染历史面板
    - 回车会立即搜索且不会重复触发去抖结果
  - `src/components/friend/__tests__/FriendListView.test.ts`
    - 搜索历史恢复
    - 无结果空态
    - 搜索中与结果摘要播报
  - `src/components/friend/__tests__/AddFriendDialog.test.ts`
    - 加好友搜索历史恢复与清空

**搜索体验录屏脚本（待人工补录）**

1. 快速输入
   - 入口：好友列表主入口 `FriendListView`
   - 步骤：连续输入 `A -> Al -> Ali -> Alice`，最后按 Enter
   - 预期：列表结果稳定刷新，不出现明显掉帧；回车后立即提交搜索，不再额外等待去抖窗口
2. 无结果态
   - 入口：好友列表主入口 `FriendListView`
   - 步骤：输入不存在的关键词，例如 `Charlie-not-found`
   - 预期：显示 `friend.search.empty_title / empty_description` 对应空态，且保留“清除搜索”返回主列表的入口
3. 历史恢复
   - 入口：好友列表主入口与 `AddFriendDialog`
   - 步骤：先执行一次搜索，关闭/重开入口，再观察历史 chips；随后清空历史
   - 预期：历史记录能恢复显示，点击可回放，清空后 localStorage 对应键位被移除

**残余任务**

- 验收资产：本批次涉及的快速输入、无结果态、历史恢复以及中英文切换截图和录屏仍需人工补录并登记到资产索引。

## P2 批次依赖关系

- 批次 H 依赖前面主界面结构基本稳定，否则实机截图和问题结论很快过期。
- 批次 I 依赖 P1 批次 G 的基础 a11y 和主交互稳定，否则会在细节层反复返工。
- 批次 H 与批次 I 可以部分并行，但建议先完成实机验证，再集中收尾细节体验。

## P2 推荐推进节奏

- 第 8 周：批次 H
- 第 9 周：批次 I

## 组件映射附录

### 使用说明

- 本附录用于把“批次执行计划”直接映射到运行时代码、Storybook、迁移编号和回归资产。
- `StorybookTarget` 标为“待补”表示当前仓库中尚未发现对应 story 文件，需在相关批次内补齐。
- `MigrationId` 为空表示当前更多属于增强项或质量项，不直接对应业务窗口迁移编号。
- `回归资产` 为建议至少沉淀的截图、录屏或验证材料类型。

### 组件与资产映射表

| 批次 | 主题 | RuntimeComponent | StorybookTarget | VisualSpec / 文档锚点 | MigrationId | 回归资产 |
| --- | --- | --- | --- | --- | --- | --- |
| A | 好友主入口切换 | `src/views/homeWindow/FriendsList.vue` | 待补 | `Friend/*`、`HULA_COMPONENT_REFACTOR_CHECKLIST.md` 好友段落 | `MW-FRIEND-003` | 好友四态截图、旧入口替换前后对比 |
| A | 好友卡片视图 | `src/components/friend/FriendListView.vue` | `src/components/friend/FriendListView.stories.ts` | `Friend/List/*` | `MW-FRIEND-003` | `CapabilityOff / Empty / Default / BlockedHiddenMix` 截图 |
| A | 好友详情抽屉 | `src/components/friend/FriendDetailDrawer.vue` | `src/components/friend/FriendDetailDrawer.stories.ts` | `Friend/List/*` | `MW-FRIEND-003`、`MW-FRIEND-VERIFY-004` | 抽屉打开、切换好友、关闭回到列表录屏 |
| A | 好友请求面板 | `src/components/friend/FriendRequestDialog.vue` | `src/components/friend/FriendRequestDialog.stories.ts` | `Friend/Requests/*`、好友请求相关规范 | `MW-FRIEND-VERIFY-004` | 请求接受 -> 打开 DM 录屏 |
| B | 空间侧栏 | `src/components/workbench/SpaceListPane.vue` | `src/components/workbench/SpaceListPane.stories.ts` (`PinnedSpaces / PublicInviteOnly / EmptyResults / RailMode`) | `Space/*`、`ROOM_SPACE_UI_UX_OPTIMIZATION_PLAN.md` 空间侧栏章节 | 无 | 公开/私有/邀请制/空结果截图 |
| B | 空间项卡片 | `src/components/workbench/SpaceListItemCard.vue` | `src/components/workbench/SpaceListItemCard.stories.ts` (`Default / InviteOnly / ActiveCompact`) | `Space/Card/*` | 无 | 空间快捷操作、聚合状态截图 |
| B | 空间树 | `src/components/workbench/HulaSpaceTree.vue` | `src/components/workbench/HulaSpaceTree.stories.ts` (`Default / TreeLoadMore / Breadcrumb`) | `Space/Tree/*`、`HULA_COMPONENT_REFACTOR_CHECKLIST.md` 空间树段落 | 无 | `load more`、breadcrumb、父空间定位录屏 |
| B | 工作台空间接入 | `src/components/workbench/RoomSpaceWorkbench.vue` | `src/components/workbench/RoomSpaceWorkbench.stories.ts` (`Default / Compact / EmptySessions / EmptyByFilter / Loading / HighDensity / BatchMode / SavedPreset / NarrowDrawer / PerfFilterLatency / PerfSpaceSwitch / PerfPaginationAppend`) | `Space/*`、`RoomList/*` | 无 | 左栏切换空间后三栏同步录屏、perf 样本记录 |
| C | 房间列表容器 | `src/components/workbench/RoomSessionList.vue` | `src/components/workbench/RoomSessionList.stories.ts` | `RoomList/*` | 无 | `SyncLoading / Reconnecting / Empty / Invite / Tombstoned` 截图 |
| C | 工作台详情承载 | `src/components/workbench/WorkbenchDetailPane.vue` | `src/components/workbench/WorkbenchDetailPane.stories.ts` (`SummaryMode / MembersMode / ActivityMode / ManageInvite / ManageSettings / ManageAddRoom`) | `RoomSummary/*`、`Space/*` | `MW-INVITE-001`、`MW-ANNOUNCEMENT-002`、`MW-ROOM-SETTINGS-005` | 详情切换、公告预览、设置分段录屏 |
| C | 房间详情区 | `src/components/room/RoomDetailPane.vue` | `src/components/room/RoomDetailPane.stories.ts` | `RoomSummary/*` | `MW-INVITE-001`、`MW-ROOM-SETTINGS-005` | 邀请、设置、无权限态截图 |
| C | 消息输入区 | `src/components/rightBox/MsgInput.vue` | `src/components/rightBox/MsgInput.stories.ts` (`Default / Readonly / Tombstoned / NoPermission / Invited / NotFriend / Preparing`) | 消息区输入禁用态规范 | 无 | `readonly / tombstoned / invited / no-permission` 提示录屏 |
| D | 文档入口 | `docs/ui/README.md` | 不适用 | `README.md` | 无 | 文档入口可追溯性检查 |
| D | 开放任务总表 | `docs/ui/UI_ALIGNMENT_OPEN_TASKS_2026-05-15.md` | 不适用 | 本文档 | 无 | 批次执行记录、回归矩阵 |
| E | 消息元信息 | `src/components/rightBox/renderMessage/HulaMessageMeta.vue` | `src/components/rightBox/renderMessage/HulaMessageMeta.stories.ts` (`ReceiptsAndPresence / Sending / RetryState`) | `HULA_COMPONENT_REFACTOR_CHECKLIST.md` 消息元信息段落 | 无 | 回执、typing、presence、只读态截图 |
| E | 消息主渲染 | `src/components/rightBox/renderMessage/index.vue` | 待补 | 消息渲染规范 | 无 | 正文与元信息分层录屏 |
| E | 详情区模式化 | `src/components/workbench/WorkbenchDetailPane.vue` | `src/components/workbench/WorkbenchDetailPane.stories.ts` (`SummaryMode / MembersMode / ActivityMode / ManageInvite / ManageSettings / ManageAddRoom`) | `RoomSummary/*`、`Space/*` | `MW-ANNOUNCEMENT-002`、`MW-ROOM-SETTINGS-005` | `summary / manage / members / activity` 四模式截图 |
| F | 工具栏效率 | `src/components/workbench/RoomSpaceToolbar.vue` | `src/components/workbench/RoomSpaceToolbar.stories.ts` (`Default / FilterSummary / SavedPreset`) | `ROOM_SPACE_UI_UX_OPTIMIZATION_PLAN.md` 工具栏章节 | 无 | 筛选摘要、clear all、快速过滤录屏 |
| F | 批量操作条 | `src/components/workbench/RoomBatchActionBar.vue` | 通过 `src/components/workbench/RoomSpaceWorkbench.stories.ts` 中 `BatchMode` 覆盖 | `ROOM_SPACE_UI_UX_OPTIMIZATION_PLAN.md` batch mode 章节 | 无 | 进入批量模式 -> 执行动作 -> 退出录屏 |
| G | 品牌 token 收口 | `src/components/workbench/SpaceListPane.vue`、`src/components/friend/FriendListView.vue` | 对应 story 沿用现有或待补 | `ui-unification-plan` token 章节 | 无 | 硬编码色清理前后对比 |
| G | 响应式壳层 | `src/components/workbench/RoomSpaceWorkbench.vue` | `src/components/workbench/RoomSpaceWorkbench.stories.ts` (`Compact / NarrowDrawer / BatchMode`) | workbench 响应式规范 | 无 | 宽屏、紧凑宽度、窄屏滑层截图 |
| G | 无障碍主链路 | room/space/friend 相关组件集合 | 部分已有、其余待补 | WCAG / a11y 规范段落 | 无 | focus 态、键盘导航、读屏验证记录 |
| H | 实机验证 | friend/workbench/mobile 相关入口集合 | 不适用 | `UX-03_TEST_CHECKLIST.md` | 无 | RTL、touch、Electron、Mobile Web 实测索引 |
| I | 搜索体验 | `src/components/friend/FriendSearchBar.vue`、`src/components/friend/FriendListView.vue`、`src/components/friend/AddFriendDialog.vue` | `src/components/friend/FriendSearchBar.stories.ts` (`Default / NoHistory / HiddenHistory / Rtl`) | `Friend/Search/*` | 无 | 搜索历史、无结果态、快速输入录屏；回归见 `FriendSearchBar.test.ts`、`FriendListView.test.ts`、`AddFriendDialog.test.ts` |
| I | 异步播报 | `src/components/common/GlobalAriaLive.vue`、`src/composables/common/useAriaLive.ts`；优先覆盖 `CreateRoomDialog.vue`、房间管理动作、`ForwardDialog.vue` 与消息批量操作对话框 | `src/components/common/GlobalAriaLive.stories.ts` | a11y 播报规范 | 无 | 邀请接受、空间加入、同步恢复、房间创建/管理与消息转发播报录屏 |
| I | 长尾 i18n | 设置体系与低频页面提示文案 | 不适用 | `ui-unification-plan` i18n 残项段落 | 无 | 文案替换前后对照、语言切换验证 |

### 建议追踪字段

- `Owner`: 负责人
- `Status`: `未启动 / 进行中 / 已联调 / 已验收`
- `PR`: 对应变更链接
- `Assets`: 截图、录屏、Storybook、测试链接
- `LastCheck`: 最近一次复核日期

### 建议维护方式

- 每完成一个批次，至少更新一次本附录中的 `StorybookTarget`、`MigrationId` 和 `回归资产`。
- 若某组件在执行过程中被重命名或移动，先更新本附录，再更新相关规范文档。
- 若新增了新的业务窗口迁移编号，应先补 `README.md` 再补本附录，避免编号失联。

## 建议执行顺序

### 第一批

- 好友桌面主入口切换
- 空间树主链路接入
- 房间列表同步/重连基线收口
- 房间摘要与输入禁用态收口
- 验收资产补齐

### 第二批

- `HulaMessageMeta` 接入
- `RoomBatchActionBar` 与批量模式
- 详情区模式化
- 响应式与 a11y 收口
- token 与硬编码色清理

### 第三批

- 实机与边缘场景验证
- 性能量化回填
- 搜索历史与交互细节补齐
- 长尾 i18n 与 live region 收尾

## 剩余任务执行附录

### 使用说明

- 本附录基于当前仍未完成的 `19` 项任务整理，按“当前最大阻塞项”拆分为 `代码缺口 / 文档缺口 / 仅缺截图录屏 / 仅缺实机验证` 四类。
- `建议负责人类型` 采用简写：
  - `FE`：前端实现
  - `FE+QA`：前端联动验收
  - `FE+Design`：前端与设计/规范对齐
  - `FE+QA+Design`：需要三方一起闭环
- `建议周次` 仅沿用本文既有“推荐推进节奏”，不额外虚构具体日历日期。
- `可合并 PR` 用于帮助把多个关联任务合并到一个执行批次中，降低拆分成本。

### 一、代码缺口

| 任务 | 优先级 | 当前状态 | 建议周次 | 建议负责人类型 | 前置依赖 | 最小交付物 | 可合并 PR | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 将桌面好友主入口切换到 `FriendListView + FriendDetailDrawer` 架构 | `P0` | 部分完成 | 第 1 周 | `FE` | 桌面主入口已切换 | 移动端或剩余入口与桌面统一为同一主路径口径 | `PR-Friend-01` | 当前主要缺口是跨入口状态口径未完全统一 |
| 完成好友能力关闭、空态、异常态、正常态的统一降级分流 | `P0` | 部分完成 | 第 1 周 | `FE` | 桌面四态 helper 已存在 | 桌面/移动端共用状态判定逻辑并清理重复分流 | `PR-Friend-01` | 若继续维持两套 helper，后续 QA 口径会继续漂移 |
| 完成请求面板三视图与接受后直达 DM 的过渡态闭环 | `P0` | 部分完成 | 第 1 周 | `FE+QA` | `roomId` 跳转链路稳定 | 请求态、处理反馈与列表/DM 联动闭环自测通过 | `PR-Friend-02` | 功能主链路已通，但完整闭环未到“已验收” |
| 将分页空间树、`next_batch`、`suggested_only`、breadcrumb、parent spaces 接入主路径 | `P0` | 部分完成 | 第 2 周 | `FE` | `tree_path / parents` 与 breadcrumb 已落地 | `suggested_only`、更完整 parents 状态和分页树职责彻底收口 | `PR-Space-01` | 当前更像“主链路已接入但深层状态未完全统一” |
| 将空间列表升级为富卡片、统一状态标签、聚合未读与快捷操作 | `P0` | 部分完成 | 第 2 周 | `FE+Design` | 左栏分组与 rail 已稳定 | 富卡片、公开/私有/邀请制标签、快捷操作和摘要信息落齐 | `PR-Space-02` | 这是当前最典型的功能缺口项 |
| 收口房间列表的初始同步、增量同步、重连恢复与空态容器 | `P0` | 部分完成 | 第 3 周 | `FE` | 列表 story / 状态容器已有基础 | `initial-loading / incremental-sync / reconnecting / empty / filtered-empty` 模型与刷新粒度完全收口 | `PR-Room-01` | 仍需避免局部状态变更触发整表体验回退 |
| 对齐 room summary 数据源，并补齐只读/tombstoned 输入禁用态 | `P0` | 部分完成 | 第 3 周 | `FE` | `MsgInput` 状态矩阵已补 | summary 数据源统一、输入区与详情区禁用态解释一致 | `PR-Room-02` | 当前 `MsgInput` 已有 story，但状态源统一仍未宣告完成 |
| 在工作台接入 `RoomBatchActionBar` 与批量操作流 | `P1` | 部分完成 | 第 6 周 | `FE+QA` | 批量模式主路径已接入 | 窄屏承载策略、退出/误触规则与最终交互录屏明确 | `PR-Workbench-01` | 现有实现可用，但文档仍记为未完全闭环 |
| 增加 active filter summary、clear all、saved presets 与快速过滤项 | `P1` | 部分完成 | 第 6 周 | `FE` | `SavedPreset` 轻量版已存在 | 明确是否升级为多预设或冻结单预设方案，并补完整交互说明 | `PR-Workbench-01` | 当前预设能力仍是轻量方案，不宜误判为完成 |
| 清理核心 workbench/friend 组件硬编码颜色与历史变量别名 | `P1` | 部分完成 | 第 7 周 | `FE+Design` | 核心组件已清理首轮硬编码 | 长尾 token、历史别名与残留硬编码色清理完成 | `PR-Quality-01` | 核心路径已改善，但 `ui-unification-plan` 残项仍在 |
| 补齐列表 mount、筛选耗时、space switch、分页追加等性能基线 | `P1` | 部分完成 | 第 7 周 | `FE+QA` | perf stories 已可复现 | 真实环境采样、基线记录、报告回填 | `PR-Perf-01` | 目前只有可复验 story 样本，未形成发布级基线 |

### 二、文档缺口

| 任务 | 优先级 | 当前状态 | 建议周次 | 建议负责人类型 | 前置依赖 | 最小交付物 | 可合并 PR | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 补好友搜索历史、去抖体验与无结果反馈闭环 | `P2` | 部分完成 | 第 9 周 | `FE` | 搜索历史、去抖、无结果态与相关 tests/stories 已存在 | 更新任务状态、证据链接与残余事项描述 | `PR-Docs-01` | 该项当前更像“代码已到位但文档状态仍滞后” |
| 引入统一 live region，播报邀请接受、空间加入、同步恢复结果 | `P2` | 部分完成 | 第 9 周 | `FE` | `useAriaLive`、`GlobalAriaLive` 与多条链路已接线 | 修正总表状态并补 Storybook/资产映射与证据引用 | `PR-Docs-01` | 本文旧状态“未启动”已过期，应按“进行中/部分完成”维护 |

### 三、仅缺截图录屏

| 任务 | 优先级 | 当前状态 | 建议周次 | 建议负责人类型 | 前置依赖 | 最小交付物 | 可合并 PR | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 为核心改造组件补齐 `Storybook / VisualSpec / MigrationId / 截图录屏` | `P0` | 部分完成 | 第 4 周 | `FE+QA` | Storybook、映射表与索引已初步建立 | 真实截图/录屏入库并补全索引状态 | `PR-Assets-01` | 当前最大缺口是人工资产而非代码本体 |
| 建立房间列表、空间树、好友接受跳转、能力关闭四条主链路回归矩阵 | `P0` | 部分完成 | 第 4 周 | `FE+QA` | 回归矩阵、验收清单与资产索引已存在 | 将矩阵中的待补截图/录屏补齐到可复验状态 | `PR-Assets-01` | 文档基线已建，当前主要差最后一批手工资产 |
| 将详情区整理为 `summary / manage / members / activity` 模式系统 | `P1` | 部分完成 | 第 5 周 | `FE+QA` | 四模式实现、story 与测试已到位 | 四模式截图、切换录屏、资产索引登记 | `PR-Assets-02` | 当前残余风险已收敛到资产层，而不是主实现层 |
| 按桌面宽度分档收口三栏、双栏、抽屉/滑层策略 | `P1` | 部分完成 | 第 7 周 | `FE+QA` | `wide / compact / narrow` 布局模型已实现 | 宽屏、紧凑、窄屏截图和一条切换录屏 | `PR-Assets-02` | 结构逻辑已基本完成，缺的是验收材料 |

### 四、仅缺实机验证

| 任务 | 优先级 | 当前状态 | 建议周次 | 建议负责人类型 | 前置依赖 | 最小交付物 | 可合并 PR | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 补齐 room list / space tree / friend card / breadcrumb 的 role、aria、键盘导航与非颜色提示 | `P1` | 局部完成 | 第 7 周 | `FE+QA` | 首轮 aria/键盘路径实现已完成 | 键盘导航、读屏、focus 态验证记录与问题单 | `PR-Verify-01` | 当前阻塞更多是实测，而不是继续堆属性 |
| 完成 RTL、touch target、hover on touch、12px radius、一致性验证 | `P2` | 未验证 | 第 8 周 | `FE+QA+Design` | 主界面结构趋稳 | RTL、触屏、圆角一致性的实机记录与结论表 | `PR-Verify-02` | 这是最典型的“只差实机”任务 |
| 实机与边缘场景验证收口 | `P2` | 未验证 | 第 8 周 | `FE+QA` | 桌面与移动端主链路稳定 | Electron / Mobile Web / touch 环境截图、录屏与结论 | `PR-Verify-02` | 可与上一项合并执行，减少重复搭建环境成本 |

### 建议 PR 分组

- `PR-Docs-01`
  - 搜索体验状态回填
  - A11y 异步播报状态回填
  - 开放任务总表、映射表与证据链接同步
- `PR-Friend-01`
  - 好友主入口完全闭环
  - 好友能力降级全端统一
- `PR-Friend-02`
  - 好友请求三视图闭环
  - 同步补好友请求交互录屏索引
- `PR-Space-01`
  - 空间树主链路收口
  - breadcrumb / parents / `suggested_only` 统一
- `PR-Space-02`
  - 空间侧栏富卡片
  - 状态标签、快捷操作、聚合未读
- `PR-Room-01`
  - 房间列表同步基线
  - 重连 / 空态 / filtered-empty 容器语义
- `PR-Room-02`
  - 房间摘要与输入态统一
  - 输入禁用解释文案与 summary 状态对齐
- `PR-Workbench-01`
  - 批量模式尾项
  - 工具栏效率尾项
- `PR-Quality-01`
  - 品牌 token 收口
  - 历史变量别名清理
- `PR-Perf-01`
  - 性能真实采样
  - 性能报告回填
- `PR-Assets-01`
  - P0 四条主链路截图 / 录屏
  - 资产索引与回归矩阵同步
- `PR-Assets-02`
  - 详情区四模式
  - 响应式壳层
  - 相关验收附件登记
- `PR-Verify-01`
  - a11y 键盘 / 读屏实测
  - 验收清单回填
- `PR-Verify-02`
  - RTL / touch / Electron / Mobile Web 实机验证
  - 边缘问题单与结论表

### 建议执行顺序（排期版）

1. 先发 `PR-Docs-01`，先纠正文档失真。
2. 并行推进 `PR-Assets-01` 与 `PR-Friend-01`，快速缩短 P0 未完成清单。
3. 继续推进 `PR-Space-01`、`PR-Space-02`、`PR-Room-01`、`PR-Room-02`，完成核心主链路功能收口。
4. 再推进 `PR-Workbench-01`、`PR-Quality-01`、`PR-Perf-01`，收 P1 尾项。
5. 最后集中执行 `PR-Verify-01` 与 `PR-Verify-02`，避免实机截图和结论因界面再变动而失效。

## 周会简版看板

### 使用说明

- 本表用于周会同步，不展开到单项组件，只保留“本周关注什么、卡在哪里、下一步做什么、建议并到哪个 PR 批次”。
- `主阻塞项` 只写当前最影响推进的一个因素，避免会上展开成技术细节清单。
- `建议动作` 以“本周可完成的最小闭环”为准，适合直接转成周计划。

| 看板项 | 覆盖任务 | 优先级 | 当前状态 | 主阻塞项 | 本周建议动作 | 建议 PR |
| --- | --- | --- | --- | --- | --- | --- |
| 文档状态纠偏 | 搜索体验、A11y 异步播报 | `P2` | 待回填 | 总表状态与实际落地不一致 | 补证据链接并统一改为“部分完成/进行中”口径 | `PR-Docs-01` |
| 好友域主链路收口 | 好友主入口、能力降级、请求链路 | `P0` | 进行中 | 桌面与其他入口状态口径未完全统一 | 收口 helper、请求反馈与 DM 联动，形成好友域闭环 | `PR-Friend-01`、`PR-Friend-02` |
| 空间主链路收口 | 空间树主链路、空间侧栏升级 | `P0` | 进行中 | 树状态与富卡片表达仍未完全闭环 | 先补 `suggested_only / parents`，再补状态标签和快捷操作 | `PR-Space-01`、`PR-Space-02` |
| 房间主链路收口 | 房间列表基线、房间摘要与输入态 | `P0` | 进行中 | 同步/重连/空态与输入禁用态仍有分散口径 | 统一状态模型与 summary 数据源，补主链路自测 | `PR-Room-01`、`PR-Room-02` |
| 资产补录 | 验收资产、回归闭环、详情区模式化、响应式适配 | `P0/P1` | 待补资产 | 截图和录屏缺口大，影响验收可追溯性 | 先补 P0 四条主链路，再补详情区与响应式截图 | `PR-Assets-01`、`PR-Assets-02` |
| 工作台体验尾项 | 批量模式、工具栏效率 | `P1` | 进行中 | 窄屏承载与预设能力方案仍未定稿 | 明确产品范围，补交互说明并收尾实现 | `PR-Workbench-01` |
| 视觉一致性收口 | 品牌与 token 收口 | `P1` | 进行中 | 长尾硬编码色和历史变量别名仍残留 | 清理 token/alias 残项并补前后对照 | `PR-Quality-01` |
| 性能基线落表 | 性能量化 | `P1` | 进行中 | 有 perf story，但缺真实环境数据 | 跑真实采样并回填指标、结论和风险 | `PR-Perf-01` |
| 无障碍实测 | 无障碍主链路、A11y 异步播报 | `P1/P2` | 待实测 | 键盘/读屏验证记录尚未形成 | 集中做一次键盘导航与读屏走查 | `PR-Verify-01` |
| 实机与边缘验证 | RTL、touch、Electron、Mobile Web | `P2` | 未验证 | 真实环境验证尚未开始 | 集中安排设备与环境，输出验证结论表 | `PR-Verify-02` |

### 周会建议话术

- 本周优先收 `P0` 主链路与文档纠偏，避免任务状态继续失真。
- 资产补录与功能收口并行推进，确保每个主链路在完成时就具备截图/录屏证据。
- 实机验证统一放在主界面相对稳定后集中执行，减少重复验证成本。

## 结论

- 当前项目的 UI 状态应定义为“主壳层已形成、核心迁移进行中、若干目标组件已开发但未全部接入、质量闭环和验收资产仍未完成”。
- 后续迭代不应再用“是否已有组件文件”作为完成标准，而应统一使用：
  - 是否进入主业务路径
  - 是否覆盖正常态、空态、无权限态、能力关闭态、加载态
  - 是否具备响应式、a11y、性能和验收资产闭环
