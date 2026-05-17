# UI Alignment Regression Matrix 2026-05-16

## 适用范围

- 房间列表主链路
- 空间树主链路
- 好友接受后进入 DM
- 好友能力关闭 / 降级主链路

## 证据类型约定

- `Storybook`：用于稳定复现 UI 状态与交互样例
- `Focused Test`：用于校验关键状态流或事件转发
- `Manual Asset`：截图 / 录屏占位，后续可补充到同名目录

## 回归矩阵

| 主链路 | 入口 | 操作步骤 | 预期结果 | Storybook / 代码证据 | Manual Asset |
| --- | --- | --- | --- | --- | --- |
| 房间列表同步与重连 | `homeWindow/SpaceList` | 打开工作台；观察 `SyncLoading / Reconnecting / Invite / Tombstoned` 状态；切换筛选与空间 | 状态容器语义稳定；单项状态变化不影响整表交互；邀请态与迁移态不误导用户输入 | `src/components/workbench/RoomSessionList.stories.ts`；`src/components/workbench/__tests__/RoomSpaceWorkbench.test.ts`；`src/components/workbench/__tests__/WorkbenchSubcomponents.test.ts` | 待补：`room-list-sync-loading.png`、`room-list-reconnecting.png` |
| 空间树分页导航 | `homeWindow/SpaceList` -> 工作台左栏 | 选中空间；展开树节点；触发 `load more`；通过 breadcrumb 回跳 | 选中空间后出现树导航；`next_batch` 采用追加加载；树选择与 breadcrumb 保持一致 | `src/components/workbench/RoomSpaceWorkbench.stories.ts`；`src/components/workbench/HulaSpaceTree.stories.ts`；`src/components/workbench/SpaceListPane.stories.ts`；`src/components/workbench/__tests__/RoomSpaceWorkbench.test.ts`；`src/components/workbench/__tests__/HulaSpaceTree.test.ts` | 待补：`space-tree-load-more.mp4`、`space-tree-breadcrumb.mp4` |
| 好友接受后进入 DM | 好友请求面板 | 接受好友请求；确认进入对应 DM；返回列表后状态已更新 | 不再依赖延迟推断；进入确定的 `roomId`；请求状态与列表状态同步 | `src/components/friend/FriendRequestDialog.stories.ts`；`src/components/friend/__tests__/FriendRequestDialog.test.ts` | 待补：`friend-request-accept-to-dm.mp4` |
| 好友能力关闭 / 降级 | 好友列表页 | 切换能力关闭、空态、异常态、正常态；切换筛选与详情 | 四态展示稳定；无权限与能力关闭时不暴露误导动作；详情抽屉行为一致 | `src/components/friend/FriendListView.stories.ts`；`src/components/friend/FriendDetailDrawer.stories.ts`；`src/components/friend/__tests__/FriendListView.test.ts`；`src/components/friend/__tests__/FriendDetailDrawer.test.ts` | 待补：`friend-capability-off.png`、`friend-four-state.png` |

## 补充建议

- 若后续补录截图/录屏，建议统一放到 `docs/ui/assets/` 下，并按主链路命名。
- 每次更新主链路结构时，同时回填本表中的 `Storybook / 代码证据` 列，避免再次失联。
