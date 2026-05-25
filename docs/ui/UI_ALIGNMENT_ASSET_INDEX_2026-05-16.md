# UI Alignment Asset Index 2026-05-16

## 命名规则

- 截图：`<domain>-<state>.png`
- 录屏：`<domain>-<flow>.mp4`
- 若某资产暂未实录，可先在本表登记预期文件名和对应 Storybook / 测试入口

## 当前资产索引

| 域 | 资产类型 | 预期文件名 | 对应 Storybook / 测试 | 当前状态 |
| --- | --- | --- | --- | --- |
| 空间树 | 录屏 | `space-tree-load-more.mp4` | `src/components/workbench/HulaSpaceTree.stories.ts`、`src/components/workbench/__tests__/HulaSpaceTree.test.ts` | 待补实录 |
| 空间树 | 录屏 | `space-tree-breadcrumb.mp4` | `src/components/workbench/RoomSpaceWorkbench.stories.ts`、`src/components/workbench/__tests__/RoomSpaceWorkbench.test.ts` | 待补实录 |
| 空间侧栏 | 截图 | `space-sidebar-public.png` | `src/components/workbench/SpaceListPane.stories.ts` | 待补截图 |
| 空间侧栏 | 截图 | `space-sidebar-invite-only.png` | `src/components/workbench/SpaceListItemCard.stories.ts` | 待补截图 |
| 房间列表 | 截图 | `room-list-sync-loading.png` | `src/components/workbench/RoomSessionList.stories.ts` | 待补截图 |
| 房间列表 | 截图 | `room-list-reconnecting.png` | `src/components/workbench/RoomSessionList.stories.ts` | 待补截图 |
| 房间列表中间栏 | 截图切图 | `room-list-mid-pane-slice-header-2026-05-25.png` | `docs/ui/ROOM_LIST_MID_PANE_ALIGNMENT_SPEC_2026-05-25.md`、`src/views/homeWindow/__tests__/RoomList.test.ts` | 已补齐 |
| 房间列表中间栏 | 截图切图 | `room-list-mid-pane-slice-toolbar-2026-05-25.png` | `docs/ui/ROOM_LIST_MID_PANE_ALIGNMENT_SPEC_2026-05-25.md`、`src/components/workbench/__tests__/MessageSessionToolbar.test.ts` | 已补齐 |
| 房间列表中间栏 | 截图切图 | `room-list-mid-pane-slice-list-2026-05-25.png` | `docs/ui/ROOM_LIST_MID_PANE_ALIGNMENT_SPEC_2026-05-25.md`、`src/components/workbench/__tests__/RoomSessionList.test.ts` | 已补齐 |
| 房间列表中间栏 | 标注文件 | `room-list-mid-pane-annotation-2026-05-25.svg` | `docs/ui/ROOM_LIST_MID_PANE_CONSISTENCY_REPORT_2026-05-25.md` | 已补齐 |
| 房间列表中间栏 | 标注文件 | `room-list-mid-pane-annotation-2026-05-25.json` | `docs/ui/ROOM_LIST_MID_PANE_CONSISTENCY_REPORT_2026-05-25.md` | 已补齐 |
| 输入禁用态 | 录屏 | `msg-input-disabled-states.mp4` | `src/components/rightBox/MsgInput.stories.ts` | 待补实录 |
| 消息元信息 | 截图 | `message-meta-receipts-presence.png` | `src/components/rightBox/renderMessage/HulaMessageMeta.stories.ts` | 待补截图 |
| 好友请求 | 录屏 | `friend-request-accept-to-dm.mp4` | `src/components/friend/FriendRequestDialog.stories.ts`、`src/components/friend/__tests__/FriendRequestDialog.test.ts` | 待补实录 |
| 好友四态 | 截图 | `friend-four-state.png` | `src/components/friend/FriendListView.stories.ts` | 待补截图 |

## 维护要求

- 若本轮只补了 Storybook 和 focused test，也要先在本表登记“待补实录”。
- 后续补真实截图 / 录屏时，只更新文件名状态，不要删除对应的 Storybook / 测试入口。
- 每次发布前至少复核一次本表，避免主链路已经变更但资产索引未同步。
