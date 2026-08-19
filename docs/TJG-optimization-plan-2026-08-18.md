# TJG 项目全面优化方案（2026-08-18）

## 问题总览

| # | 问题 | 严重度 | 根因 |
|---|------|--------|------|
| 1 | 头像更新后UI不刷新 | P1 | 浏览器缓存 + 缓存清除不一致 |
| 2 | 消息列表成员重复（test1多次出现） | P1 | 多个DM房间去重逻辑缺陷 |
| 3 | 好友界面进入聊天/加密聊天按钮不跳转 | P1 | 两步导航中间步骤被guard阻断 |
| 4 | 打电话和打视频没有专门UI界面 | P2 | 功能缺失，需新建组件 |
| 5 | 设备列表56个设备 | P2 | 服务端返回全量历史设备，无过滤 |
| 6 | 房间列表不同种类房间没有色彩识别 | P2 | 缺少房间类型→颜色映射 |
| 7 | 空间详情不展示 | P1 | sdkSpaceToSpaceInfo计数始终为0 + 竞态 |
| 8 | 设置子页面空白无内容 | P0 | defineAsyncComponent在computed内调用（反模式） |

---

## 优化方案

### P0: 设置子页面空白（Issue 8）

**根因**：`SettingsContent.vue` 中 `defineAsyncComponent` 在 `computed` 内调用，每次切换tab都创建新组件实例，Vue无法正确复用，导致渲染空白。

**修复方案**：

```typescript
// SettingsContent.vue - 修复前（反模式）
const currentTabComponent = computed(() => {
  const loader = SETTINGS_TAB_COMPONENT_LOADERS[props.activeTab]
  return defineAsyncComponent(loader as () => Promise<Component>)
})

// 修复后 - 在模块作用域一次性创建
const tabComponents = Object.fromEntries(
  Object.entries(SETTINGS_TAB_COMPONENT_LOADERS).map(([key, loader]) => [
    key,
    defineAsyncComponent({
      loader: loader as () => Promise<Component>,
      loadingComponent: defineComponent({
        template: '<div style="display:flex;justify-content:center;padding:40px"><n-spin /></div>'
      })
    })
  ])
) as Record<string, Component>

const currentTabComponent = computed(() => tabComponents[props.activeTab])
```

**涉及文件**：`src/views/settingsWindow/SettingsContent.vue`

---

### P1: 头像更新后UI不刷新（Issue 1）

**根因**：
1. 浏览器缓存相同URL的图片
2. `AccountSettings.vue` 更新头像后未清除 `AvatarUtils` 缓存
3. `LeftAvatar` 和 `UserMenuHeader` 读取不同的avatar字段

**修复方案**：

1. 在 `AvatarUtils` 中添加缓存破坏机制：
```typescript
// src/utils/AvatarUtils.ts
static getAvatarUrl(mxcUrl: string | null | undefined, bustCache = false): string {
  if (!mxcUrl) return ''
  const httpUrl = client.mxcUrlToHttp(mxcUrl)
  if (!httpUrl) return ''
  return bustCache ? `${httpUrl}?t=${Date.now()}` : httpUrl
}
```

2. 在 `AccountSettings.vue` 的头像更新回调中添加缓存清除：
```typescript
import { AvatarUtils } from '@/utils/AvatarUtils'
// ... 更新成功后
AvatarUtils.clearCache()
```

3. 确保所有头像更新路径同步更新 `userInfo.avatar` 和 `matrixProfile.avatarUrl`

**涉及文件**：
- `src/utils/AvatarUtils.ts`
- `src/views/settingsWindow/tabs/AccountSettings.vue`
- `src/components/left/InfoEdit.vue`

---

### P1: 好友聊天按钮不跳转（Issue 3）

**根因**：`focusSessionRoom()` 导航到 `/message`（无roomId），然后message view的watcher检测到 `currentSessionRoomId` 已匹配，跳过了第二次导航到 `/message/:roomId`。

**修复方案**：让 `focusSessionRoom` 直接导航到带roomId的路由：

```typescript
// src/composables/chat/openMsgSession.ts
// 修改 focusSessionRoom 函数
const currentPath = router.currentRoute.value.path
if (currentPath !== '/message') {
  await router.push({ name: 'message', params: { roomId } })
} else {
  // 已在message页，只需更新session
  globalStore.updateCurrentSessionRoomId(roomId)
}
```

同时为"加密聊天"按钮添加错误反馈：
```typescript
// SingleDetails.vue
const handleEncryptedChat = async () => {
  // ... 现有逻辑
  if (roomId) {
    await openMsgSessionByRoomId(roomId)
  } else {
    showFeedback(t('friend.detail.chat_error'), 'error', 'assertive')
  }
}
```

**涉及文件**：
- `src/composables/chat/openMsgSession.ts`
- `src/components/rightBox/SingleDetails.vue`

---

### P1: 空间详情不展示（Issue 7）

**根因**：
1. `sdkSpaceToSpaceInfo` 始终返回 `memberCount: 0, childCount: 0`
2. `getSpace` 方法中房间对象可能未加载，无法获取真实计数

**修复方案**：

1. 修正 `spaceHelpers.ts`：
```typescript
// src/services/matrix/room/spaceHelpers.ts
export function sdkSpaceToSpaceInfo(space: SdkSpace, room?: Room): SpaceInfo {
  return {
    spaceId: space.space_id,
    name: space.name || '',
    topic: space.topic || undefined,
    avatarUrl: space.avatar_url || undefined,
    memberCount: room ? room.getJoinedMembers().length : 0,
    childCount: room ? getSpaceChildIds(room).length : 0
  }
}
```

2. 在 `MatrixSpaceService.getSpace` 中确保room已加载：
```typescript
async getSpace(spaceId: string): Promise<SpaceInfo | null> {
  const space = await this.getSpaceManager().getSpace(spaceId)
  const client = this.getClient()
  // 确保room已加载
  let room = client.getRoom(spaceId)
  if (!room) {
    await client.joinRoom(spaceId)
    room = client.getRoom(spaceId)
  }
  return sdkSpaceToSpaceInfo(space, room)
}
```

**涉及文件**：
- `src/services/matrix/room/spaceHelpers.ts`
- `src/services/matrix/room/MatrixSpaceService.ts`

---

### P1: 消息列表成员重复（Issue 2）

**根因**：同一用户存在多个DM房间时，去重逻辑在 `detailId` 为空时失效。

**修复方案**：

1. 在 `useSessionListState.ts` 中增强去重逻辑：
```typescript
// src/composables/workbench/useSessionListState.ts
const dmSeen = new Set<string>()
const sessionItems = [...dedupedByRoom]
  .sort((a, b) => b.activeTime - a.activeTime)
  .filter((item) => {
    if (item.type !== RoomTypeEnum.SINGLE) return true
    // 增强：优先用detailId，其次用account，最后用roomId
    const counterpartKey = item.detailId || item.account || ''
    if (!counterpartKey) {
      // 无counterpart信息时，用roomId作为fallback去重
      if (dmSeen.has(item.roomId)) return false
      dmSeen.add(item.roomId)
      return true
    }
    const key = toLocalpart(counterpartKey)
    if (!key) return true
    if (dmSeen.has(key)) return false
    dmSeen.add(key)
    return true
  })
```

2. 在 `MatrixSessionService.getSessionList()` 中添加防御性去重：
```typescript
// 按counterpart用户去重，保留最新活跃的
const seen = new Map<string, SessionItem>()
for (const session of sessions) {
  const key = session.detailId || session.roomId
  const existing = seen.get(key)
  if (!existing || session.activeTime > existing.activeTime) {
    seen.set(key, session)
  }
}
return Array.from(seen.values())
```

**涉及文件**：
- `src/composables/workbench/useSessionListState.ts`
- `src/services/matrix/auth/MatrixSessionService.ts`

---

### P2: 设备列表56个设备（Issue 5）

**根因**：Matrix服务端返回全量历史设备，无过滤。

**修复方案**：

1. 在设备列表中添加"最近活跃"筛选和排序：
```typescript
// src/views/settingsWindow/tabs/SessionSettings.vue
// 按最后登录时间排序，突出当前设备
const sortedDevices = computed(() => {
  return [...devices.value].sort((a, b) => {
    // 当前设备置顶
    if (a.isCurrent) return -1
    if (b.isCurrent) return 1
    // 按最后活跃时间降序
    return (b.lastSeenTs || 0) - (a.lastSeenTs || 0)
  })
})
```

2. 添加"清除所有旧设备"批量操作按钮
3. 在设备项中显示"X天前活跃"等相对时间

**涉及文件**：
- `src/views/settingsWindow/tabs/SessionSettings.vue`

---

### P2: 房间列表色彩识别（Issue 6）

**根因**：所有房间使用相同样式，缺少类型→颜色映射。

**修复方案**：

1. 在设计令牌中添加房间类型颜色：
```css
/* src/styles/css/design-tokens.css */
--tjg-room-type-group: var(--tjg-color-primary-500);
--tjg-room-type-dm: var(--tjg-color-success-500);
--tjg-room-type-space: var(--tjg-color-warning-500);
```

2. 在房间卡片组件中添加类型标识：
```vue
<!-- RoomCardItem.vue -->
<template>
  <div class="room-card" :class="`room-type-${room.type}`">
    <div class="room-type-indicator" />
    <!-- ... -->
  </div>
</template>

<style>
.room-type-indicator {
  width: 3px;
  border-radius: 2px;
  background: var(--tjg-room-type-group);
}
.room-type-dm .room-type-indicator {
  background: var(--tjg-room-type-dm);
}
.room-type-space .room-type-indicator {
  background: var(--tjg-room-type-space);
}
</style>
```

**涉及文件**：
- `src/styles/css/design-tokens.css`
- `src/components/room/RoomCardItem.vue` 或类似房间卡片组件

---

### P2: 打电话/打视频没有专门UI（Issue 4）

**根因**：功能缺失，需要新建通话UI组件。

**修复方案**（需要新建组件）：

1. 创建通话浮层组件 `src/components/voice/VoiceCallOverlay.vue`
2. 创建视频通话组件 `src/components/voice/VideoCallOverlay.vue`
3. 在通话状态store中管理通话状态
4. 在全局布局中挂载通话浮层

这是一个较大的功能开发，建议单独立项。

---

## 执行优先级

| 阶段 | 任务 | 预估工时 |
|------|------|----------|
| Phase 1 | Issue 8: 设置页面空白修复 | 0.5天 |
| Phase 1 | Issue 3: 好友聊天按钮跳转修复 | 0.5天 |
| Phase 1 | Issue 1: 头像缓存刷新修复 | 0.5天 |
| Phase 2 | Issue 7: 空间详情展示修复 | 1天 |
| Phase 2 | Issue 2: 成员列表去重增强 | 1天 |
| Phase 3 | Issue 5: 设备列表优化 | 1天 |
| Phase 3 | Issue 6: 房间列表色彩识别 | 1天 |
| Phase 4 | Issue 4: 通话UI组件开发 | 3-5天 |

---

## 验证方案

每个修复完成后需验证：
1. `pnpm vue-tsc --noEmit` - 类型检查通过
2. `pnpm test:run` - 单元测试通过
3. `pnpm check` - 代码规范检查通过
4. 手动测试 - 相关功能正常工作
