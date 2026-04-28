# 在线状态显示问题分析报告

## 问题描述
用户在线状态无法正常显示

## 根本原因

### 1. 批量获取效率问题
**位置**: `src/services/matrix/user/MatrixPresenceService.ts:231`

```typescript
async getBatchPresence(userIds: string[]): Promise<PresenceInfo[]> {
  const presences: PresenceInfo[] = []
  
  // 问题：串行获取，效率低
  for (const userId of userIds) {
    try {
      const presence = await this.getPresence(userId)
      presences.push(presence)
    } catch (err) {
      error(`[Presence] 获取用户 ${userId} 在线状态失败: ${err}`)
    }
  }
  
  return presences
}
```

**问题**：
- 串行执行，每个用户都要等待前一个完成
- 如果有100个用户，需要100次HTTP请求
- 单个请求失败会阻塞后续请求

### 2. 缺少批量API调用
Matrix协议支持批量获取在线状态，但当前实现未使用：
- `POST /_matrix/client/v3/presence/batch` - 批量获取
- 当前使用：`GET /_matrix/client/v3/presence/{userId}/status` - 单个获取

### 3. 订阅机制未充分利用
- `subscribeToPresence()` 已实现但可能未正确处理响应
- 订阅后应该通过事件推送更新，而不是轮询

## 解决方案

### 方案1：并行获取（快速修复）
```typescript
async getBatchPresence(userIds: string[]): Promise<PresenceInfo[]> {
  const promises = userIds.map(userId => 
    this.getPresence(userId).catch(err => {
      error(`[Presence] 获取用户 ${userId} 在线状态失败: ${err}`)
      return null
    })
  )
  
  const results = await Promise.all(promises)
  return results.filter((p): p is PresenceInfo => p !== null)
}
```

### 方案2：使用批量API（推荐）
```typescript
async getBatchPresence(userIds: string[]): Promise<PresenceInfo[]> {
  if (userIds.length === 0) return []
  
  try {
    const client = this.getClient()
    
    // 使用批量API
    const response = await client.http.authedRequest(
      'POST',
      '/_matrix/client/v3/presence/batch',
      undefined,
      { user_ids: userIds }
    ) as { presences: Record<string, Omit<PresenceInfo, 'user_id'>> }
    
    return Object.entries(response.presences).map(([userId, presence]) => ({
      user_id: userId,
      ...presence
    }))
  } catch (err) {
    // 降级到并行获取
    return this.getBatchPresenceParallel(userIds)
  }
}
```

### 方案3：优化订阅机制
- 订阅后监听 `User.presence` 事件
- 实时更新store，减少轮询

## 优先级
1. **P0**: 实现并行获取（立即提升性能）
2. **P1**: 使用批量API（减少请求数）
3. **P2**: 优化事件监听（实时更新）

## 预期效果
- 获取100个用户状态：从 ~10秒 降至 ~0.5秒
- 请求数：从 100次 降至 1次
- 实时性：从轮询 改为 事件推送
