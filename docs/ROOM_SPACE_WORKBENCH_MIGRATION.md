# 房间/空间工作台迁移方案

## 1. 目标

本方案参考 Element Desktop 的工作区入口层级，将左侧导航中的“房间列表”和“空间列表”从普通插件入口提升为独立工作区入口，同时保持项目现有三连屏结构不变：

- 左侧：工作区入口与全局导航
- 中间：房间/空间列表与搜索筛选
- 右侧：详情、成员信息、空间管理

迁移后的实现目标如下：

1. 房间列表与空间列表入口拥有更高视觉优先级，减少与普通插件入口混排造成的识别成本。
2. 原有切换、搜索、创建、管理、通知等能力全部保留，且继续复用现有路由、状态与权限逻辑。
3. 禁止新增弹窗或模态层，空间管理能力全部在三连屏右侧详情面板内联完成。
4. 入口组件支持文本/图标两种左栏模式，并在不同宽度下保持稳定布局。
5. `message`、`roomList`、`spaceList` 三类列表页逐步收敛为统一工作台模型，降低后续维护成本。

## 2. 现状分析

### 2.1 三连屏交互层级

当前首页的主要交互层级如下：

1. 左侧 `ActionList`
   - 全局导航入口
   - 插件入口
   - 设置与更多菜单
2. 中间工作台
   - `RoomSpaceToolbar`
   - `MessageSessionToolbar`（对统一工具栏的轻包装）
   - `RoomSessionList`
   - 房间或空间筛选结果
3. 右侧详情面板
   - 会话详情
   - 成员目录/成员资料
   - 空间管理表单

### 2.2 原有问题

- 房间列表与空间列表混在普通插件列表中，层级不清晰。
- 左侧入口图标使用了未注册的图标 ID，导致图标不显示。
- 文本模式下房间/空间入口和普通插件一样按“标题 + 缩写”机制渲染，造成视觉重复。
- 空间邀请、添加房间、设置曾经通过模态层展示，不符合三连屏约束。
- `message` 与 `roomList` 的工具栏、列表骨架、查询同步逻辑存在高重复度，维护成本偏高。

## 3. 新布局设计

### 3.1 设计原则

- 工作区优先：房间与空间入口置于普通插件之前，形成独立入口组。
- 单一识别：文本模式仅保留单行主标题，不再叠加重复文案。
- 状态显性：激活态、未读徽标、已打开状态与原逻辑一致。
- 响应收敛：左栏窄模式展示图标，展开模式展示图标 + 单行标签。

### 3.2 左侧入口结构

```text
顶部固定操作
  -> 房间列表入口
  -> 空间列表入口
  -> 普通插件入口
  -> 更多菜单 / 设置
```

### 3.3 入口行为

#### 房间列表按钮

- 点击后跳转 `roomList`
- 保留原有页面同步、筛选、搜索、创建与会话定位能力
- 保留原有未读与激活状态呈现

#### 空间列表按钮

- 点击后跳转 `spaceList`
- 保留原有空间选择、搜索、创建、管理、成员目录与通知能力
- 管理动作在右侧详情面板展开，不再打开模态层

### 3.4 工作台收敛策略

- `spaceList` 使用 `RoomSpaceWorkbench` 作为统一空间工作台根组件。
- `roomList` 与 `message` 复用同一套列表工作台骨架 `ListWorkbenchShell`。
- `MessageSessionToolbar` 退化为轻包装层，底层复用 `RoomSpaceToolbar` 的搜索、筛选、排序交互。
- `useWorkbenchSessionQuerySync` 统一处理 `search/type/sort` 的 query 读写，避免页面内重复维护 `watch`。

## 4. 功能对照表

| 能力 | 原入口/容器 | 新入口/容器 | 迁移结果 |
| --- | --- | --- | --- |
| 房间列表切换 | 左侧插件入口 | 左侧独立工作区按钮 | 保留 |
| 空间列表切换 | 左侧插件入口 | 左侧独立工作区按钮 | 保留 |
| 房间搜索/筛选 | 中间工具栏 | 中间工具栏 | 保留 |
| 空间搜索/筛选 | 中间工具栏 | 中间工具栏 | 保留 |
| 创建空间 | `SpaceView` / 中间区域 | `SpaceView` / 中间区域 | 保留 |
| 邀请成员 | 空间页模态层 | 右侧 `WorkbenchDetailPane` | 已迁移 |
| 添加房间到空间 | 空间页模态层 | 右侧 `WorkbenchDetailPane` | 已迁移 |
| 空间设置 | 空间页模态层 | 右侧 `WorkbenchDetailPane` | 已迁移 |
| 成员资料查看 | 模态层 | 右侧详情卡片 | 已迁移 |
| 未读/徽标显示 | 插件配置驱动 | 工作区按钮配置驱动 | 保留 |
| 权限控制 | 页面内部判断 | 页面内部判断 + 右侧表单禁用 | 保留 |
| 路由同步 | `spaceNavigation.ts` | `spaceNavigation.ts` | 保留 |
| 房间页工具栏 | 页面内独立实现 | `MessageSessionToolbar` -> `RoomSpaceToolbar` | 已收敛 |
| 消息页工具栏 | 页面内独立实现 | `MessageSessionToolbar` -> `RoomSpaceToolbar` | 已收敛 |
| 房间/消息列表骨架 | 页面内独立布局 | `ListWorkbenchShell` | 已收敛 |
| 房间/消息 query 同步 | 页面内 `watch` + `router.replace` | `useWorkbenchSessionQuerySync` | 已收敛 |

## 5. 交互流程

### 5.1 房间列表流程

```text
点击房间列表按钮
  -> 进入 roomList 页面
  -> 通过 query 恢复筛选、排序、搜索状态
  -> 中间列表展示房间会话
  -> 右侧详情展示当前会话信息
```

### 5.2 空间列表流程

```text
点击空间列表按钮
  -> 进入 spaceList 页面
  -> 根据路由参数恢复空间选择与筛选条件
  -> 中间列表展示空间下会话/房间
  -> 右侧详情展示空间信息与成员目录
```

### 5.3 空间管理流程

```text
点击空间管理动作
  -> 校验当前选中空间与权限
  -> 设置 manageMode
  -> 右侧详情面板切换到管理态
  -> 用户填写表单并提交
  -> 调用原有 API / store 操作
  -> 刷新空间详情与列表
  -> 关闭管理态并回到详情态
```

### 5.4 统一 query 同步流程

```text
页面进入（message / roomList）
  -> useWorkbenchSessionQuerySync 读取 route.query
  -> 规范化 search / type / sort
  -> 回填页面本地 ref
  -> 工具栏显示当前筛选状态

用户修改搜索或筛选
  -> 更新页面本地 ref
  -> search 通过 debounce 延迟回写 query
  -> type / sort 立即回写 query
  -> 默认值不写入 query
  -> 路由保持可分享、可恢复
```

### 5.5 房间/消息统一骨架流程

```text
进入 message 或 roomList
  -> ListWorkbenchShell 渲染 toolbar 插槽
  -> MessageSessionToolbar 挂载统一筛选头部
  -> RoomSessionList 渲染中间列表
  -> roomList 可选挂载 WorkbenchDetailPane
  -> 页面仅保留各自业务逻辑，公共布局由骨架层承担
```

## 6. 组件接口定义

### 6.1 左侧入口层

#### `ActionList.vue`

新增/调整：

- `workspacePlugins`
  - 从插件列表中抽取 `roomList` 与 `space`
- `WORKBENCH_PLUGIN_URLS`
  - 用于将工作区入口与普通插件入口分流
- `workspace-entry`
  - 新的独立入口样式

职责：

- 负责工作区入口渲染
- 复用 `pageJumps()` 完成原有路由/窗口跳转逻辑
- 复用原有 badge、active、open 状态

### 6.2 统一工作台层

#### `RoomSpaceWorkbench.vue`

新增 props：

- `manageMode`
- `inviteUserId`
- `addRoomId`
- `addRoomSuggested`
- `settingsName`
- `settingsTopic`
- `manageSubmitting`

新增事件：

- `closeManagePane`
- `submitManagePane`
- `update:inviteUserId`
- `update:addRoomId`
- `update:addRoomSuggested`
- `update:settingsName`
- `update:settingsTopic`

#### `ListWorkbenchShell.vue`

职责：

- 提供统一的三段式列表页骨架：`toolbar` / 列表主体 / `detail`
- 仅处理布局，不承载业务状态与权限判断
- 供 `message` 与 `roomList` 复用，保持房间页与消息页结构一致

插槽：

- `toolbar`
- `default`
- `detail`（可选）

#### `RoomSpaceToolbar.vue`

关键 props：

- `searchKeyword`
- `sessionTypeFilter`
- `sessionSort`
- `filteredCount`
- `totalCount`
- `compact`
- `showCreateAction`
- `rootTestId`
- `testIdPrefix`

关键事件：

- `update:searchKeyword`
- `update:sessionTypeFilter`
- `update:sessionSort`
- `createSpace`

说明：

- 作为统一筛选头部实现，被 `spaceList` 直接使用。
- 被 `MessageSessionToolbar` 以“隐藏创建按钮 + 自定义测试标识”的方式复用。

#### `MessageSessionToolbar.vue`

职责：

- 为 `message` 与 `roomList` 提供兼容层，继续暴露原有事件命名
- 内部直接复用 `RoomSpaceToolbar`，不再维护独立搜索/筛选/排序实现

### 6.3 右侧详情层

#### `WorkbenchDetailPane.vue`

新增能力：

- 管理态 `manageMode`
  - `invite`
  - `add-room`
  - `settings`
- 成员资料内联展示
- 右侧管理表单提交与关闭事件

### 6.4 组合式能力层

#### `useWorkbenchSessionQuerySync.ts`

职责：

- 统一读取 `search/type/sort` query 并回填页面本地状态
- 统一在筛选值变化后通过去抖方式更新 query
- 保持“默认值不入 query”的路由洁净策略

适用页面：

- `message`
- `roomList`
- 后续可扩展到其他遵循相同筛选模型的工作台页面

### 6.5 组件关系图

#### 空间工作台组件关系

```text
ActionList
  -> 路由切换到 spaceList
  -> RoomSpaceWorkbench
       -> RoomSpaceToolbar
       -> SpaceListPane
       -> RoomSpaceActionBar
       -> RoomSessionList
       -> WorkbenchDetailPane
```

#### 房间/消息列表组件关系

```text
ActionList
  -> 路由切换到 roomList / message
  -> ListWorkbenchShell
       -> MessageSessionToolbar
            -> RoomSpaceToolbar
       -> RoomSessionList
       -> WorkbenchDetailPane（仅 roomList）
```

#### 组合式与页面依赖关系

```text
message / roomList
  -> useMessageSessionFilters
  -> useWorkbenchSessionQuerySync
  -> useSessionPageSync（按页面保留未读/定位逻辑）

spaceList
  -> spaceNavigation.ts
  -> useViewport
  -> RoomSpaceWorkbench
```

## 7. 状态管理变更说明

### 7.1 保持不变

- 路由参数同步继续由 `spaceNavigation.ts` 负责
- 插件列表基础状态继续由设置域 store 管理
- 房间/空间选择状态继续由各页面与领域 store 维护
- 快捷键与权限判断继续复用原页面逻辑

### 7.2 新增的本地视图状态

- `manageMode`
  - 控制右侧详情面板是“详情态”还是“管理态”
- `inviteForm`
  - 邀请成员输入值
- `addRoomForm`
  - 房间 ID 与 suggested 标记
- `settingsForm`
  - 空间名称与主题
- `manageSubmitting`
  - 统一提交 loading 状态
- `isCompactLayout` / `isNarrowLayout`
  - 由 `useViewport()` 驱动，控制统一工作台在窄宽度下的压缩布局

### 7.3 状态流转原则

- 入口切换不直接变更业务数据，只负责切换目标页面
- 空间管理不新增全局 store，避免把一次性表单状态扩散到全局
- 提交成功后再刷新页面级数据，防止中间态污染列表展示
- 通用筛选状态优先保留在页面本地 `ref` 中，再通过 query 与路由同步，避免为了视图参数引入额外全局 store

### 7.4 状态映射表

| 状态 | 归属层 | 典型载体 | 说明 |
| --- | --- | --- | --- |
| 当前工作区入口激活态 | 导航层 | `ActionList.vue` | 控制房间/空间入口高亮与 badge 展示 |
| 搜索/筛选/排序 | 页面局部状态 + 路由层 | `ref` + `route.query` | 由 `useWorkbenchSessionQuerySync` 统一同步 |
| 当前选中空间 | 页面局部状态 + 路由层 | `selectedSpaceId` + `query.spaceId` | 空间工作台刷新后可恢复上下文 |
| 当前选中会话 | 领域状态 | `globalStore.currentSessionRoomId` | 控制会话详情和未读清理 |
| 管理态表单输入 | 页面局部状态 | `manageMode` / `inviteUserId` / `settingsName` 等 | 仅服务右侧内联管理面板 |
| 响应式压缩态 | 视口派生状态 | `isCompactLayout` / `isNarrowLayout` | 由 `useViewport()` 实时计算 |

### 7.5 路由参数定义

| 参数 | 页面 | 含义 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `spaceId` | `spaceList` | 当前选中的空间 ID | 空 | 控制空间工作台恢复到哪个空间上下文 |
| `search` | `message` / `roomList` / `spaceList` | 搜索关键词 | 空字符串 | 进入页面时恢复搜索输入 |
| `type` | `message` / `roomList` / `spaceList` | 会话类型筛选 | `all` | 支持 `all` / `group` / `single` |
| `sort` | `message` / `roomList` / `spaceList` | 排序方式 | `recent` | 支持 `recent` / `name` |

约束：

- 默认值不写入 query，避免 URL 噪声。
- query 恢复时先做 normalize，非法值自动回退默认值。
- `roomList` 与 `message` 通过 `useWorkbenchSessionQuerySync` 统一处理；`spaceList` 继续由 `spaceNavigation.ts` 管理。

### 7.6 快捷键与权限控制说明

快捷键：

- 不新增新的全局快捷键。
- 原有页面级快捷键与会话打开逻辑保持不变，仍由既有页面和业务 hooks 负责。
- 本次迁移只调整入口层与容器层，不改动消息打开、会话切换、未读清理的原始触发语义。

权限控制：

- 空间管理权限继续按当前页面业务判断执行，不上提到通用布局组件。
- `WorkbenchDetailPane` 仅负责根据 `canManageSpace` 控制管理入口和表单禁用态。
- 无权限用户仍可查看空间详情与成员预览，但不能提交邀请、加房间或设置修改。

## 8. 响应式策略

- 左栏图标模式下只显示图标与徽标，减少窄宽度拥挤
- 左栏文本模式下显示单行标签，不引入副标题，避免两行文字占位
- 工作区入口组与普通插件列表分离，防止窗口高度变化时互相挤压
- 右侧管理表单沿用现有详情面板宽度约束，不新增额外容器层级
- `RoomSpaceWorkbench` 通过 `useViewport()` 计算 `compact` / `narrow`，向 `RoomSpaceToolbar`、`SpaceListPane`、`WorkbenchDetailPane` 透传压缩态
- `message` 与 `roomList` 通过统一骨架 `ListWorkbenchShell` 保持主列表区在不同窗口尺寸下的稳定伸缩

## 9. 测试方案

### 9.1 单元测试

已补充：

- `RoomSpaceWorkbench.test.ts`
  - 校验响应式 `compact` / `narrow` 状态透传
  - 校验管理态 props 透传
  - 校验右侧详情面板事件回传
- `WorkbenchSubcomponents.test.ts`
  - 校验统一工具栏的创建按钮显隐与测试标识复用
  - 校验成员资料改为内联卡片
  - 校验邀请、添加房间、设置表单的渲染与事件
- `RoomList.test.ts`
  - 校验房间页工具栏接入、query 同步、详情联动
- `message/index.test.ts`
  - 校验消息页 query 初始恢复与搜索回写
- `useWorkbenchSessionQuerySync.test.ts`
  - 校验筛选 query 初始化、去抖回写与路由名保护
- `config.test.ts`
  - 校验房间/空间入口使用有效图标配置

### 9.2 集成测试建议

当前已完成的集成级覆盖：

1. 房间列表视图的工具栏接入、query 同步与详情联动
2. 消息列表视图的 query 初始恢复与搜索回写
3. 空间工作台的响应式状态透传与右侧管理面板联动

建议继续补充以下场景：

1. 左侧点击“房间列表”后，中间列表与右侧详情正确联动
2. 左侧点击“空间列表”后，右侧管理态可完成邀请/添加房间/设置修改
3. 文本模式与图标模式切换时，入口无重复文案
4. 窄窗口下左栏入口不遮挡 badge、hover 与 active 样式
5. 三类列表页在真实窗口尺寸变化下的响应式回归

### 9.3 当前回归结果

最近一次针对本迁移链路执行的测试命令：

```bash
pnpm vitest run src/composables/workbench/__tests__/useWorkbenchSessionQuerySync.test.ts \
src/views/homeWindow/__tests__/RoomList.test.ts \
src/views/homeWindow/message/__tests__/index.test.ts \
src/components/workbench/__tests__/WorkbenchSubcomponents.test.ts \
src/components/workbench/__tests__/RoomSpaceWorkbench.test.ts \
src/composables/workbench/__tests__/useSessionPageSync.test.ts
```

结果：

- `6` 个测试文件通过
- `40` 个测试用例通过
- 当前未发现本轮迁移引入的诊断错误

## 10. 视觉与可用性走查清单

- 图标是否使用已注册的 SVG symbol
- 房间/空间入口是否位于普通插件之前
- 文本模式是否仅显示单一主标签
- 激活态底色与现有设计系统是否一致
- 右侧管理态切换后是否仍能快速返回详情态
- 成员资料是否在右侧内联显示，无额外弹层
- `message`、`roomList`、`spaceList` 顶部头部间距、搜索框尺寸、chip 交互是否保持一致
- 紧凑态下 `SpaceListPane`、详情面板与主列表是否仍保持明确层级

### 10.1 当前走查状态

- 已完成代码级走查：图标 ID、入口分组、统一头部、统一骨架、query 同步链路与响应式透传逻辑均已核对
- 已完成单元测试与视图级回归测试验证
- 尚未完成真实窗口下的人工视觉预览与可用性点按验证
- 发布前仍建议补一次本地预览走查，重点验证左栏文本模式、窄窗口和右侧管理态切换

## 11. 已完成迁移项

- 修复房间列表与空间列表入口图标 ID
- 将房间/空间入口从普通插件流中抽离为独立工作区入口组
- 修复文本模式重复文案问题
- 将空间邀请、添加房间、设置迁移到右侧内联详情面板
- 将成员资料从模态层迁移到右侧内联卡片
- 将消息页头部收敛为 `MessageSessionToolbar` -> `RoomSpaceToolbar` 轻包装复用
- 新增 `ListWorkbenchShell`，统一消息页与房间页的列表工作台骨架
- 新增 `useWorkbenchSessionQuerySync`，统一 `message` 与 `roomList` 的 query 同步
- 补充对应单元测试并完成通过验证

## 12. 后续建议

1. 为 `ActionList.vue` 增加独立组件测试，覆盖文本/图标两种展示模式
2. 增加 Playwright 工作区切换与响应式回归用例
3. 继续评估是否将 `message` 与 `roomList` 的会话定位/外部事件同步逻辑进一步抽成共享 composable
4. 若后续再新增一级工作区，继续复用当前 `workspacePlugins` 分组策略
