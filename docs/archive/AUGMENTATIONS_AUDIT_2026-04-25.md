# matrix-js-sdk-augmentations.d.ts 审计报告

> 审计时间：2026-04-25
> 目的：评估 augmentations.d.ts 文件的治理策略

---

## 一、文件现状

### 基本信息
- **文件路径**：`src/types/matrix-js-sdk-augmentations.d.ts`
- **代码行数**：1464 LOC
- **导出数量**：122 个 export 语句
- **唯一性**：项目中唯一超过 1000 LOC 的文件

### 结构分析
文件采用 TypeScript 模块扩展（module augmentation）模式：
```typescript
export * from 'matrix-js-sdk'  // 重新导出官方类型

declare module 'matrix-js-sdk' {
  // 补充 SDK 缺失的类型
  export const PendingEventOrdering: { ... }
  export enum Method { ... }
  // ... 更多扩展
}
```

### 域分布统计
通过关键词频率分析，类型定义按域分布如下：

| 域 | 出现次数 | 占比 |
|---|---------|------|
| Room | 135 | 23% |
| Event | 101 | 17% |
| Voice | 49 | 8% |
| User | 31 | 5% |
| Push | 30 | 5% |
| Message | 30 | 5% |
| Timeline | 26 | 4% |
| Device | 24 | 4% |
| Filter | 19 | 3% |
| Notification | 16 | 3% |
| Presence | 15 | 3% |
| Sync | 13 | 2% |
| 其他 | 111 | 18% |

---

## 二、评估结论

### 不建议按域分片的原因

#### 1. TypeScript 模块扩展的技术限制
- 所有扩展必须在单一 `declare module 'matrix-js-sdk'` 块中
- 跨文件的模块扩展不会自动合并，需要复杂的重导出机制
- 分片会破坏类型系统的完整性，导致部分类型不可见

#### 2. 文件性质特殊
- 这是类型定义文件，不是实现代码
- 类型定义文件天然比实现文件更长
- 1464 LOC 对于类型定义文件是可接受的规模
- 文件已按域组织，有清晰的注释分隔（见下文）

#### 3. 现有组织良好
文件已有清晰的分段注释：
```typescript
// ==================== 重新导出官方类型 ====================
// ==================== 补充 SDK 缺失的类型 ====================
// ==================== 接口补充 ====================
// ==================== OIDC ====================
// ==================== Push ====================
// ==================== Event 和 Timeline 类型 ====================
// ==================== Voice ====================
// ==================== 错误和存储 ====================
// ==================== 搜索类型 ====================
// ==================== 同步类型 ====================
// ==================== 分页类型 ====================
// ==================== 过滤器类型 ====================
// ==================== 事件关系类型 ====================
// ==================== 消息编辑类型 ====================
// ==================== 回复类型 ====================
// ==================== 线程类型 ====================
// ==================== 密钥备份类型 ====================
// ==================== 设备管理类型 ====================
// ==================== 用户目录类型 ====================
// ==================== 群组/社区类型 ====================
// ==================== 第三方 API 类型 ====================
```

#### 4. 使用场景单一
- 72 个文件导入 matrix-js-sdk 类型
- 主要在 service 层使用（符合架构设计）
- 开发者只需导入类型，无需编辑此文件
- 类型定义文件的性能影响可忽略

#### 5. 分片的负面影响
- 增加导入复杂度
- 破坏类型系统的原子性
- 维护成本增加（需要在多个文件间协调）
- 无明显收益

---

## 三、推荐方案：减少手工扩展面积

### 发现的冗余类型

通过对比 `../matrix-js-sdk/src/@types/` 目录，发现以下类型已存在于官方 SDK：

#### 1. 完全冗余（可直接删除）

| 扩展类型 | SDK 位置 | 行号 | 说明 |
|---------|---------|------|------|
| `Visibility` | `@types/partials.ts` | 33-37 | 完全相同 |
| `Preset` | `@types/partials.ts` | 39-43 | 完全相同 |
| `ICreateRoomOpts` | `@types/requests.ts` | 104-118 | SDK 版本更完整 |
| `IPushRule` | `@types/PushRules.ts` | 321-339 | SDK 版本更完整 |
| `IPushRules` | `@types/PushRules.ts` | 341-344 | 完全相同 |
| `IPusher` | `@types/PushRules.ts` | 346-362 | SDK 版本更完整 |

#### 2. 部分冗余（需要审查）

| 扩展类型 | SDK 位置 | 说明 |
|---------|---------|------|
| `ISendEventResponse` | `@types/requests.ts` | 需要确认是否完全相同 |
| `EventType` | `@types/event.ts` | 需要确认扩展的事件类型是否必要 |

#### 3. synapse-rust 特有扩展（必须保留）

| 扩展类型 | 说明 |
|---------|------|
| `VoiceMessageManager` | synapse-rust 特有的语音消息管理器 |
| `BurnAfterReadManager` | synapse-rust 特有的阅后即焚功能 |
| `TypingManager` | synapse-rust 特有的输入状态管理器 |
| `ReadReceiptsManager` | synapse-rust 特有的已读回执管理器 |
| `PresenceManager` | synapse-rust 特有的在线状态管理器 |

---

## 四、实施计划

### 阶段 1：移除冗余类型（预计 1 小时）

1. 删除完全冗余的类型定义：
   - `Visibility` (lines 33-37)
   - `Preset` (lines 39-43)
   - `ICreateRoomOpts` (lines 104-118)
   - `IPushRule` (lines 332-339)
   - `IPushRules` (lines 341-344)
   - `IPusher` (lines 346-362)

2. 更新导入语句：
   - 在使用这些类型的文件中，确保从 `matrix-js-sdk` 导入
   - 示例：`import { Preset, Visibility, type ICreateRoomOpts } from 'matrix-js-sdk'`

3. 验证类型安全：
   ```bash
   pnpm exec vue-tsc --noEmit
   pnpm check:sdk-types
   ```

### 阶段 2：审查部分冗余类型（预计 30 分钟）

1. 对比 `ISendEventResponse` 与 SDK 版本
2. 对比 `EventType` 枚举，确认扩展的事件类型是否必要
3. 如果 SDK 版本足够，删除扩展；否则保留并添加注释说明原因

### 阶段 3：添加文档注释（预计 30 分钟）

为每个保留的扩展添加注释，说明保留原因：

```typescript
// ==================== synapse-rust 特有扩展 ====================
// 以下类型是 synapse-rust 后端特有的功能，官方 SDK 中不存在

export interface VoiceMessageManager {
  // synapse-rust 特有：语音消息管理器
  // 官方 SDK 不支持此功能
  ...
}

export interface BurnAfterReadManager {
  // synapse-rust 特有：阅后即焚功能
  // 官方 SDK 不支持此功能
  ...
}
```

### 阶段 4：验证和测试（预计 30 分钟）

1. 运行完整测试套件：
   ```bash
   pnpm test:run
   ```

2. 运行类型检查：
   ```bash
   pnpm exec vue-tsc --noEmit
   pnpm check:sdk-types
   ```

3. 检查导入语句：
   ```bash
   grep -r "import.*Visibility.*from.*matrix-js-sdk" src
   grep -r "import.*Preset.*from.*matrix-js-sdk" src
   ```

---

## 五、预期收益

### 代码质量
- 减少约 100-150 LOC 的冗余类型定义
- 提高类型定义的准确性（使用官方 SDK 版本）
- 降低维护成本（减少手工同步的需要）

### 可维护性
- 清晰区分官方类型 vs. synapse-rust 特有类型
- 文档注释帮助未来开发者理解扩展原因
- 减少 SDK 升级时的冲突风险

### 类型安全
- 使用官方 SDK 类型定义，确保与 SDK 行为一致
- 减少类型不匹配的风险
- 更好的 IDE 类型提示

---

## 六、风险评估

### 低风险
- 删除完全冗余的类型（Visibility, Preset 等）
- 这些类型在 SDK 中已存在且完全相同
- 只需更新导入语句即可

### 中风险
- 删除部分冗余的类型（ICreateRoomOpts, IPushRule 等）
- SDK 版本可能更完整，但需要验证兼容性
- 建议逐个验证后再删除

### 零风险
- 保留 synapse-rust 特有扩展
- 这些类型在官方 SDK 中不存在
- 添加文档注释不影响功能

---

## 七、总结

**不建议按域分片**，原因：
1. TypeScript 模块扩展的技术限制
2. 文件已有良好的组织结构
3. 分片无明显收益，反而增加复杂度

**推荐方案**：减少手工扩展面积
1. 删除冗余类型定义（约 100-150 LOC）
2. 使用官方 SDK 类型
3. 为 synapse-rust 特有扩展添加文档注释
4. 预计总用时：2-3 小时

**最终文件规模**：预计从 1464 LOC 减少到 1300-1350 LOC

---

*审计报告生成时间：2026-04-25*
*执行人：Claude (Sonnet 4.6)*
