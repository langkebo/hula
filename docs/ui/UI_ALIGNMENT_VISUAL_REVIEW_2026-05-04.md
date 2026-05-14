# UI Alignment Visual Review 2026-05-04

## 走查目标

- 确认本轮工程收口未引入新的 UI 结构偏差
- 建立后续视觉专项的检查模板
- 记录当前与 `docs/ui` 的主要视觉/交互差距

## 本轮已确认

### 已对齐

- 房间列表未读语义已拆分为 `highlight_count` 与 `notification_count`
- tombstoned 房间在列表中已有“已迁移”标签
- 房间详情与房间设置已开始回收至详情区承载
- 左侧头像入口的在线状态已具备页内 modal 方案
- 好友接受后跳转链路已改为基于返回 `roomId` 的确定性流程，避免因延迟猜测导致错误会话打开
- 房间摘要详情区已区分“正常态 / 无权限态 / 空态”，无权限时不再展示公告、成员等误导性内容

### 待继续确认

- 邀请态房间是否具备行内 CTA
- 只读 / tombstoned 房间输入区是否具备完整禁用态
- 好友页能力关闭态、空态、正常态是否可一眼区分
- 空间侧栏 / 空间树 / 面包屑是否已形成统一视觉结构

## 当前视觉缺口

### 阻塞发布级

1. 核心改造组件缺少 Storybook 视觉基线，无法稳定回归
2. 视觉稿链接、迁移编号、运行组件三者尚未形成统一追溯

### 影响体验级

1. 好友页仍偏向旧列表结构，尚未完成卡片化与详情抽屉统一承载
2. 在线状态入口仍存在页内化与旧开窗入口并存的风险
3. 空间可见性、邀请制、公开空间的视觉标签尚未全面统一
4. 邀请态房间、已迁移房间、隐藏好友等状态的视觉规范还未完全模板化

### 视觉打磨级

1. invite/highlight/tombstoned/friend-status 语义 token 仍需进一步收敛
2. 部分状态仍依赖局部样式而非统一 token

## 本轮记录方式

- 本轮未新增截图资产
- 原因：当前仍处在阻塞发布项收口阶段；虽然 BR-01、BR-02 已完成，但 Storybook 和标准截图基线尚未建立

## 下一轮走查清单

1. 房间列表：
   - 默认态
   - HighlightUnread
   - Invite
   - Tombstoned
   - Empty
   - Reconnecting
2. 好友页：
   - Capability Off
   - Empty
   - Favorite / Normal / Blocked / Hidden
   - Request Accepted -> DM 跳转过渡态
3. 空间域：
   - User Spaces
   - Public Spaces
   - Invite-only
   - Tree `load more`
   - Breadcrumb
4. 消息区：
   - Readonly
   - Tombstoned
   - Summary No Permission

## 结论

- 当前可以继续推进开发，但还不能做最终视觉验收签字
- 视觉验收的前提是：阻塞发布项完成、Storybook 补齐、关键链路截图/录屏可回放
