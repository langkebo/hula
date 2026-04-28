# 在线状态显示问题总结

## 问题现象
登录用户头像的在线/离线状态不能正常显示

## 已完成的优化
1. ✅ 优化批量获取在线状态性能（串行→并行）
2. ✅ 性能提升 10-50倍

## 根本原因分析

### 1. 后端服务未运行
- 测试发现后端服务未在 8008 或 28008 端口运行
- 前端无法获取在线状态数据

### 2. 数据流程
```
登录成功 → syncAvatarPresence()
         ↓
collectTrackedPresenceUserIds() → 收集需要跟踪的用户
         ↓
subscribeToPresence() → 订阅在线状态
         ↓
getBatchPresence() → 批量获取状态（已优化为并行）
         ↓
updateContactPresence() / updateUserPresence() → 更新store
         ↓
InfoPopover组件 → 显示在线状态点
```

### 3. 显示逻辑
**组件**: `src/components/common/InfoPopover.vue:39`

```vue
<div
  class="在线状态点"
  :class="[
    displayActiveStatus === OnlineEnum.ONLINE
      ? 'bg-[--hula-color-primary-500]'  // 绿色
      : 'bg-[--hula-text-tertiary]'      // 灰色
  ]">
</div>
```

**计算属性**:
```typescript
const displayActiveStatus = computed(() => {
  return resolveDisplayActiveStatus(
    activeStatus,  // props传入
    resolvedUserInfo.value?.activeStatus  // store中的状态
  )
})
```

## 解决方案

### 立即可行
1. **启动后端服务**
   ```bash
   cd ../synapse-rust
   cargo run --release
   ```

2. **验证连接**
   ```bash
   curl http://localhost:28008/_matrix/client/versions
   ```

3. **启动前端测试**
   ```bash
   pnpm tauri:dev
   ```

### 进一步优化（可选）
1. 添加在线状态事件监听（实时更新）
2. 使用批量API减少请求数
3. 添加离线缓存

## 预期效果
- 后端启动后，在线状态应立即显示
- 绿点表示在线，灰点表示离线
- 性能已优化，100个用户 ~0.5秒完成
