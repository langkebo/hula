# HuLa 多端同步状态盘点

> 更新时间：2026-04-25
> 目的：盘点桌面端与移动端的代码共享情况，识别需要统一的模块

---

## 一、已完成多端同步的模块 ✅

### 1. Space 模块（参考样板）

**共享 Composables**：
- `src/composables/space/useSpaces.ts` - 空间列表管理
- `src/composables/space/useSpace.ts` - 单个空间详情
- `src/composables/space/useSpaceMembers.ts` - 空间成员管理
- `src/composables/space/useSpaceRooms.ts` - 空间房间管理

**桌面端消费者**：
- `src/views/homeWindow/SpaceView.vue`

**移动端消费者**：
- `src/mobile/views/space/SpaceView.vue`

**状态**：✅ 完全同步，双端共享所有业务逻辑

---

### 2. Integrations 模块

**共享 Composable**：
- `src/composables/useIntegrations.ts` (356 LOC)
  - 状态管理：localStorage 统一键名 `hula-integrations-*`
  - 安装逻辑：`installIntegration()`
  - 启用逻辑：`setIntegrationEnabled()`
  - 权限管理：`setPermission()`

**桌面端消费者**：
- `src/views/settingsWindow/tabs/IntegrationsSettings.vue` (440 LOC)
  - UI 框架：Naive UI
  - 特有功能：搜索框、集成商店入口、配置对话框

**移动端消费者**：
- `src/mobile/views/my/IntegrationsSettings.vue` (181 LOC)
  - UI 框架：Vant
  - 特有功能：Beta 警告提示

**状态**：✅ 完全同步，双端共享所有业务逻辑

---

### 3. Dynamic 模块

**共享 Composable**：
- `src/composables/useDynamic.ts` (70 LOC)
  - 动态路线图数据：`roadmap`
  - 状态文本转换：`getStatusText()`
  - 移动端入口检测：`hasMobileEntry`

**桌面端消费者**：
- `src/plugins/dynamic/index.vue` (106 LOC)
- `src/plugins/dynamic/detail.vue` (83 LOC)

**移动端消费者**：
- `src/mobile/views/dynamic/index.vue` (74 LOC)
- `src/mobile/views/dynamic/detail.vue` (53 LOC)

**状态**：✅ 完全同步，双端共享所有业务逻辑

---

### 4. Favorites 模块

**共享 Composable**：
- `src/composables/useFavorites.ts` (307 LOC)
  - 收藏消息管理：`favoriteMessages`
  - 收藏图片管理：`favoriteImages`
  - 收藏链接管理：`favoriteLinks`
  - 统计数据：`favoriteStats`
  - 移除操作：`removeMessageFavorite()` / `removeImageFavorite()` / `removeLinkFavorite()`

**桌面端消费者**：
- `src/views/favoritesWindow/index.vue` (106 LOC)
  - UI 框架：Naive UI (Tabs)
  - 布局：网格布局（图片 2 列）

**移动端消费者**：
- `src/mobile/views/my/Favorites.vue` (126 LOC)
  - UI 框架：Vant (Tabs)
  - 布局：网格布局（图片 3 列）

**状态**：✅ 完全同步，双端共享所有业务逻辑

---

### 5. Friends 模块

**共享 Composable**：
- `src/composables/useFriends.ts` (528 LOC)
  - 搜索功能：推荐用户、搜索好友、搜索群组
  - 列表管理：特别关心、普通好友、已屏蔽、群聊列表
  - 请求确认：好友申请发送、默认消息管理
  - 共享谓词：isFriend、isCurrentUser、isInGroup、isBotUser

**桌面端消费者**：
- `src/views/friendWindow/SearchFriend.vue` (325 LOC)
- `src/views/friendWindow/AddFriendVerify.vue` (84 LOC)
- `src/views/homeWindow/FriendsList.vue` (423 LOC)

**移动端消费者**：
- `src/mobile/views/friends/index.vue` (432 LOC)
- `src/mobile/views/friends/AddFriends.vue` (271 LOC)
- `src/mobile/views/friends/ConfirmAddFriend.vue` (92 LOC)

**状态**：✅ 完全同步，双端共享所有业务逻辑

**完成时间**：2026-04-25

---

## 二、未同步的模块 ❌

### 6. Contact 模块

**当前状态**：
- ❌ 没有找到独立的 Contact 视图或 composable
- 联系人功能分散在 Friends 模块和其他组件中
- 需要进一步调研是否需要独立的 Contact 模块

**建议**：
- 如果 Contact 是指通讯录功能，可能已经包含在 Friends 模块中
- 如果需要独立的 Contact 模块，建议先明确需求再设计

---

## 四、总结与建议

### 完成度统计

| 模块 | 状态 | 共享 Composable | 桌面端 | 移动端 | 备注 |
|------|------|----------------|--------|--------|------|
| Space | ✅ 完全同步 | 4 个 | ✅ | ✅ | 参考样板 |
| Integrations | ✅ 完全同步 | 1 个 | ✅ | ✅ | 已完成 |
| Dynamic | ✅ 完全同步 | 1 个 | ✅ | ✅ | 已完成 |
| Favorites | ✅ 完全同步 | 1 个 | ✅ | ✅ | 已完成 |
| Friends | ✅ 完全同步 | 1 个 | ✅ | ✅ | 2026-04-25 完成 |
| Contact | ❌ 未明确 | 0 个 | ❌ | ❌ | 需要调研 |

### 下一步行动

**优先级 P1**：
1. ✅ ~~Integrations 共享 composable 化~~（已完成）
2. ✅ ~~Friends 模块统一~~（2026-04-25 完成）

**优先级 P2**：
3. ❓ Contact 模块需求调研（预计 0.5 天）
   - 明确 Contact 模块的定位和需求
   - 决定是否需要独立的 Contact 模块

### 成功案例参考

**Space 模块**是最完整的多端同步样板，具有以下特点：
- 4 个细粒度的 composables，职责清晰
- 桌面端和移动端完全共享业务逻辑
- 仅 UI 层使用不同的组件库（Naive UI vs Vant）
- 状态管理、API 调用、错误处理完全统一

**建议其他模块参考 Space 模块的设计模式**。

---

*文档生成时间：2026-04-25*
