## 深度优化方案（运行时问题清单）

基于代码分析，我发现了以下关键问题和优化方案：

### 问题0：消息只显示一个气泡（渲染层回归）

**根因**：
1. **v-memo 阻止重渲染**（`renderMessage/index.vue` 第 3-10、142-148、176-182 行）
   - v-memo 追踪的字段缺失 `message.message.body.content`
   - 后果：消息内容变化但 id/status 不变时，组件不会重渲染

2. **DynamicScroller 高度估算错误**（`ChatMessageList.vue` 第 20 行）
   - `min-item-size="40"` vs 实际最小高度 `min-h-62px`（第 48 行）
   - 22px 差距导致虚拟列表计算错误

3. **size-dependencies 字段名错误**（`ChatMessageList.vue` 第 29 行）
   - 使用 `item.message.msgtype` 但实际字段是 `item.message.type`

**优化方案**：
1. **移除 v-memo 测试验证**（优先执行）
2. **修复 DynamicScroller 高度**：`min-item-size` 从 40 改为 62
3. **修复 size-dependencies**：`msgtype` 改为 `type`

### 问题1：客户端反复重建 + 启动超15s

**根因**：
1. **登录流程重复 initialize() 调用**
   - `SessionRestoreService.restoreWithAccessToken()` 调用 `initialize()`
   - `MatrixClientAuth.loginWithToken()` 内部又调用 `initialize()`

2. **crypto 初始化慢**
   - `ensureCrypto()` 有独立 15s 超时，可能卡住

**优化方案**：
1. **修复重复 initialize() 调用**：添加初始化状态检查
2. **优化 crypto 初始化**：添加超时机制或异步初始化
3. **改进监听器管理**：确保 client 重建时正确清理旧监听器

### 问题2：@test3 幽灵联系人

**根因**：
1. **loadContacts() 未验证用户是否存在**（`list.ts` 第 149-172 行）
2. **好友端点不可用时降级创建 DM 房间，不检查用户是否存在**
3. **Presence 降级但未清理脏数据**

**优化方案**：
1. **添加用户存在性验证**：在加载联系人时验证用户是否存在
2. **添加定期清理机制**：在后台定期验证并清理不存在的联系人
3. **Presence 同步触发清理**：检测到 M_NOT_FOUND 时清理联系人

### 问题4：Space 加入失败

**根因**：
1. **403 错误**：Space 是 invite-only，用户未被邀请
2. **400 错误**：federation make_join connection error，viaServers 参数问题
3. **Space 创建者未被正确加入为成员**

**优化方案**：
1. **改进错误提示**：为不同错误类型提供用户友好的错误信息
2. **优化加入逻辑**：自动获取 viaServers 参数
3. **添加重试机制**：对于临时性错误自动重试
4. **修复 Space 创建者成员问题**：在 initial_state 中明确添加成员状态

### 问题6：HMR 全量重建

**根因**：
`MatrixEventService.ts` 被全局单例强依赖，HMR 无法热替换

**优化方案**：
1. **延迟初始化依赖**：避免 HMR 触发全量重建
2. **模块热替换支持**：添加 HMR accept 逻辑

## 实施优先级

### 第一阶段：高优先级（影响主流程）
1. **问题0 优化**：移除 v-memo 测试 + 修复 DynamicScroller 高度
2. **问题4 优化**：改进错误提示 + 优化加入逻辑
3. **问题1 优化**：修复重复 initialize() 调用

### 第二阶段：中优先级（数据健康）
1. **问题2 优化**：添加用户存在性验证 + 定期清理
2. **问题3 优化**：修复 enterChat 空 targetId

### 第三阶段：低优先级（开发体验）
1. **问题6 优化**：HMR 全量重建优化

## 验证方案

### 问题0 验证
1. 移除 v-memo 后，刷新页面检查是否显示多条消息
2. 检查 DynamicScroller DOM 输出，确认是否渲染多个 `<DynamicScrollerItem>`
3. 验证 `chatStore.chatMessageList.length` 是否正确

### 问题1 验证
1. 登录后检查日志，确认 `initialize()` 只被调用一次
2. 监控启动时间，确认是否 < 15s
3. 检查监听器数量，确认无内存泄漏

### 问题2 验证
1. 添加不存在的用户为好友，检查是否被清理
2. 检查联系人列表，确认无幽灵联系人
3. 验证 presence 同步是否触发清理

### 问题4 验证
1. 尝试加入 invite-only 空间，检查错误提示
2. 尝试加入联邦空间，检查 viaServers 参数
3. 验证重试机制是否生效

## 风险评估

### 问题0 优化风险
- **低风险**：移除 v-memo 可能轻微影响性能，但优先确保功能正确
- **缓解措施**：后续可重新添加正确的 v-memo 依赖

### 问题1 优化风险
- **中风险**：修改初始化流程可能引入新的时序问题
- **缓解措施**：充分测试登录/恢复流程，添加日志监控

### 问题2 优化风险
- **低风险**：添加验证可能增加启动时间
- **缓解措施**：异步验证，不影响 UI 响应

### 问题4 优化风险
- **低风险**：改进错误提示不影响核心逻辑
- **缓解措施**：保持向后兼容，仅增强用户体验