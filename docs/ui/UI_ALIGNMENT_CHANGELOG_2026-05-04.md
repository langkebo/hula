# UI Alignment Changelog 2026-05-04

## 本次迭代目标

- 建立 UI 文档对齐审计基线
- 修复首批会直接影响后续重构稳定性的工程问题
- 输出后续一周与下个 Sprint 的执行顺序

## 已完成

### 工程修复

- 修复 `AddFriendRequestDialog.vue` 的错误 store 引用与弹窗状态绑定
- 修复 `AddGroupRequestDialog.vue` 的错误弹窗状态绑定
- 清理 `layout/left/config.tsx` 遗留无效引用
- 清理 `Tray.vue` 遗留未使用窗口创建引用
- 完成 BR-01：统一 feature gate 与降级态收口
- `FriendsList.vue` 已区分好友能力关闭态与普通空态
- `RoomSpaceWorkbench.vue` 已区分空间不存在/无权访问与普通空态
- `WorkbenchDetailPane.vue` 新增房间摘要无权限态，并在无权限时隐藏群公告与成员假操作
- `MatrixSessionService` 改为输出 `hasPermission`，统一会话详情权限判断来源
- 完成 BR-02：好友接受后按返回 `room_id` 稳定进入 DM
- 新增 `openMsgSessionByRoomId()`，统一房间打开链路
- `ApplyList.vue` 与 `FriendRequestDialog.vue` 改为复用 `roomId` 跳转
- `ContactStore` 与 `MatrixFriendService` 改为返回可消费的 `roomId`
- 补齐好友接受跳转相关单测

### 审计交付

- 新增 `docs/ui/UI_ALIGNMENT_AUDIT_2026-05-04.md`
- 建立阻塞发布 / 影响体验 / 性能优化 / 视觉打磨四级任务矩阵
- 为每项任务补齐验收标准、工时、依赖与测试用例

## 未完成但已入排期

- 核心 UI Storybook 补齐
- 业务窗口清零彻底收口
- 性能基线与回归门禁

## 验证

- `GetDiagnostics`
  - `AddFriendRequestDialog.vue`：通过
  - `AddGroupRequestDialog.vue`：通过
  - `layout/left/config.tsx`：通过
  - `Tray.vue`：保留既有 `scss @apply` warning
  - `MatrixFriendService.ts`、`openMsgSession.ts`、`ApplyList.vue`、`FriendRequestDialog.vue`：通过
- 定向测试
  - `MatrixSessionService.test.ts`：通过
  - `WorkbenchSubcomponents.test.ts`：通过
  - `contacts.test.ts`：通过
  - `openMsgSession.test.ts`：通过
  - `MatrixFriendService.test.ts`：通过
- `pnpm vue-tsc --noEmit`
  - 全量执行暴露仓库既有类型错误，本轮未新增对应报错

## 风险备注

- 业务窗口迁移仍处于半收口阶段，后续改动必须避免重新引入 `createWebviewWindow` 到业务域主路径
- Storybook 与验收资产缺口仍然是发布阻塞项
- 仓库当前存在一批与本轮无关的全局 TypeScript 历史错误，仍需单独清债
