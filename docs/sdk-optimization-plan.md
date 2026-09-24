# SDK 使用指南优化方案

> **文档版本**: 1.0  
> **创建日期**: 2026-09-24  
> **范围**: Tjg 前端 SDK 封装层优化

---

## 一、现状问题分析

### 1.1 文档与实际代码严重脱节

**问题描述**：
`sdk-usage-guide.md` 描述的 API 架构与实际实现存在根本性差异：

| 文档声称 | 实际实现 | 影响 |
|---------|---------|------|
| `client.getSpaceManager()` 直接获取 Manager | `MatrixSpaceService` 封装类，通过 `matrixClientService` 访问 | 文档示例代码无法运行 |
| `SpaceManager.lifecycle.createSpace()` | `MatrixSpaceService.createSpace()` | 开发者按文档编写代码会失败 |
| `client.getVoiceManager()` | `MatrixVoiceService` 独立服务类 | 语音功能文档完全误导 |
| `client.getEventReportManager()` | `MatrixEventReportService` 独立服务类 | 举报功能文档无效 |
| `client.getRoomSummaryManager()` | `MatrixRoomSummaryService` / `SummaryService` | 统计功能文档无效 |
| `client.getOidcManager()` | `MatrixOidcService` 独立服务类 | OIDC 文档无效 |

**根因**：
- SDK 封装层采用 **Service 模式**（`MatrixSpaceService`、`MatrixVoiceService` 等），而非文档描述的 **Manager 模式**（`getSpaceManager()` 等）
- 文档基于 SDK Fork 的理论能力编写，未对齐 Tjg 实际的服务层封装

### 1.2 服务层架构不清晰

**问题描述**：

1. **Service 命名混乱**：
   - `MatrixSpaceService`（room 目录下）
   - `MatrixVoiceService`（media 目录下）
   - `MatrixEventReportService`（moderation 目录下）
   - 缺乏统一的命名规范和服务定位

2. **服务职责分散**：
   - Space 功能拆分为 `MatrixSpaceService` + `spaceQueries.ts` + `spaceHelpers.ts`
   - 缺少统一的服务入口，调用方需要知道内部模块结构

3. **SDK 类型导出混乱**：
   - `sdk.ts` 导出基础类型
   - `sdk-compat.ts` 导出兼容类型
   - `matrix-js-sdk-augmentations.d.ts` 扩展类型
   - 调用方难以确定从哪导入

### 1.3 服务调用方式不统一

**问题描述**：

```typescript
// 方式 1: 通过 matrixClientService 获取
import { matrixClientService } from '@/services/matrix/MatrixClientService'
const client = matrixClientService.getClient()
const spaceService = new MatrixSpaceService(client) // 手动实例化

// 方式 2: 直接导入服务单例
import { spaceService } from '@/services/matrix/room/MatrixSpaceService' // 假设存在

// 方式 3: 通过 composable 使用
import { useSpaces } from '@/composables/space/useSpaces'
const { getUserSpaces } = useSpaces()
```

三种方式并存，缺乏统一约定。

### 1.4 缓存策略缺失文档化

**问题描述**：
文档声称 `SpaceQueryManager` 有 LRU 缓存（5 分钟 TTL），但实际：
- `spaceQueries.ts` 中未见缓存实现
- `MatrixCacheManager` 存在但未在服务层集成
- 缓存命中率监控方法不存在

### 1.5 错误处理模式不统一

**问题描述**：
- 部分服务返回空数组（`return []`）
- 部分服务抛出异常
- 缺少统一的重试机制和熔断策略

---

## 二、优化目标

### 2.1 短期目标（1-2 周）

1. **文档对齐**：更新 `sdk-usage-guide.md`，反映真实的服务层架构
2. **服务发现**：创建统一的服务入口，减少调用方对内部结构的依赖
3. **类型导出规范化**：明确 `sdk.ts` / `sdk-compat.ts` 的职责边界

### 2.2 中期目标（1 个月）

1. **服务层重构**：统一 Service 命名和调用方式
2. **缓存集成**：在关键查询方法中集成 `MatrixCacheManager`
3. **错误处理标准化**：统一错误处理和重试策略

### 2.3 长期目标（3 个月）

1. **API 稳定性保障**：建立 SDK 封装层的变更防护机制
2. **性能监控**：实现服务层性能指标采集
3. **自动化测试覆盖**：核心服务单元测试覆盖率 ≥ 80%

---

## 三、实施方案

### 3.1 阶段一：文档对齐（第 1 周）

#### 任务 1.1: 更新 SDK 使用指南

**目标**：文档示例代码可实际运行

**行动**：
1. 删除所有 `client.getSpaceManager()` 等伪代码
2. 替换为真实的 `MatrixSpaceService` 用法
3. 补充 `matrixClientService` 的获取方式
4. 修正所有 Manager 相关描述为 Service

**验收标准**：
- 文档中的所有代码示例可在项目中编译通过
- 无 `getSpaceManager()` / `getVoiceManager()` 等不存在的方法引用

#### 任务 1.2: 创建服务层索引

**目标**：统一服务发现入口

**行动**：
创建 `src/services/matrix/index.ts`：

```typescript
/**
 * Matrix 服务统一导出
 * 
 * @example
 * ```typescript
 * import { 
 *   spaceService, 
 *   voiceService, 
 *   eventReportService 
 * } from '@/services/matrix'
 * ```
 */

export { MatrixSpaceService } from './room/MatrixSpaceService'
export { MatrixVoiceService } from './media/MatrixVoiceService'
export { MatrixEventReportService } from './moderation/MatrixEventReportService'
export { MatrixRoomSummaryService } from './room/MatrixRoomSummaryService'
export { MatrixOidcService } from './auth/MatrixOidcService'

// 导出单例（如已存在）
// export { spaceService } from './room/MatrixSpaceService'
```

**验收标准**：
- 调用方可从统一入口导入所有服务
- 减少跨目录导入的耦合

### 3.2 阶段二：类型导出规范化（第 2 周）

#### 任务 2.1: 明确 sdk.ts 职责

**目标**：单一来源原则

**行动**：
1. `sdk.ts` 仅导出 SDK 原生类型和函数
2. `sdk-compat.ts` 导出兼容性 shim 和本地扩展类型
3. `matrix-js-sdk-augmentations.d.ts` 仅做类型增强，不导出值

**验收标准**：
- 清晰的职责边界文档
- 调用方能明确知道从哪导入什么

#### 任务 2.2: 添加服务层类型定义

**目标**：服务层自有类型独立导出

**行动**：
创建 `src/services/matrix/types.ts`：

```typescript
/**
 * Matrix 服务层类型定义
 * 
 * 包含服务层特有的接口和类型，与 SDK 原生类型区分
 */

export interface SpaceInfo {
  spaceId: string
  name: string
  topic?: string
  avatarUrl?: string
  memberCount: number
  childCount: number
}

// ... 其他服务层类型
```

### 3.3 阶段三：服务层重构（第 3-4 周）

#### 任务 3.1: 统一服务调用方式

**目标**：消除多种调用方式并存

**行动**：
1. 评估现有调用模式（matrixClientService.getClient() + 手动实例化 vs 单例）
2. 确定推荐模式（建议：服务单例）
3. 重构不一致的服务

**验收标准**：
- 所有服务采用统一的调用方式
- 提供迁移指南

#### 任务 3.2: 集成缓存机制

**目标**：关键查询方法支持缓存

**行动**：
1. 在 `MatrixSpaceService` 的 `getUserSpaces()` 等方法中集成 `MatrixCacheManager`
2. 实现 TTL 和缓存失效策略
3. 添加缓存统计接口

**验收标准**：
- 高频查询方法有缓存支持
- 提供缓存控制 API

### 3.4 阶段四：错误处理标准化（第 5-6 周）

#### 任务 4.1: 统一错误处理模式

**目标**：一致的错误处理体验

**行动**：
1. 定义服务层错误分类（网络错误、权限错误、业务错误等）
2. 实现统一的重试策略
3. 添加熔断机制

**验收标准**：
- 错误类型明确可识别
- 可配置的重试策略
- 熔断器可监控

---

## 四��风险与缓解

### 4.1 技术风险

| 风险 | 影响 | 缓解措施 |
|-----|------|---------|
| 重构破坏现有功能 | 高 | 逐步迁移，每步都有测试验证 |
| 服务层循环依赖 | 中 | 明确依赖方向，使用依赖注入 |
| 缓存引入数据不一致 | 中 | 明确缓存失效时机，提供强制刷新 API |

### 4.2 项目风险

| 风险 | 影响 | 缓解措施 |
|-----|------|---------|
| 开发进度延误 | 中 | 优先完成文档对齐，其他分阶段 |
| 团队成员不熟悉 SDK 封装 | 中 | 编写详细的设计文档和迁移指南 |
| 测试覆盖不足 | 高 | 重构前补充关键路径测试 |

---

## 五、验收标准

### 5.1 文档对齐完成

- [ ] `sdk-usage-guide.md` 所有代码示例可运行
- [ ] 删除所有虚假的 Manager 方法引用
- [ ] 补充真实的服务层调用示例

### 5.2 服务层改进

- [ ] 创建统一的服务索引入口
- [ ] 明确 sdk.ts / sdk-compat.ts 职责边界
- [ ] 服务层类型独立导出

### 5.3 质量保证

- [ ] vue-tsc 无类型错误
- [ ] biome 格式检查通过
- [ ] 关键服务单元测试覆盖率 ≥ 60%

---

## 六、下一步行动

### 立即可执行（本周）

1. **更新 sdk-usage-guide.md** - 修正所有 Manager 引用为 Service
2. **创建服务索引** - `src/services/matrix/index.ts`
3. **明确类型边界** - 梳理 sdk.ts / sdk-compat.ts 职责

### 下周开始

1. **服务层类型定义** - 创建 `types.ts`
2. **调用方式调研** - 分析现有调用模式，确定统一方案
3. **缓存集成设计** - 设计缓存策略

---

## 附录：当前服务清单

### 核心服务

| 服务 | 路径 | 状态 |
|-----|------|------|
| MatrixSpaceService | `src/services/matrix/room/MatrixSpaceService.ts` | 活跃 |
| MatrixVoiceService | `src/services/matrix/media/MatrixVoiceService.ts` | 活跃 |
| MatrixEventReportService | `src/services/matrix/moderation/MatrixEventReportService.ts` | 活跃 |
| MatrixRoomSummaryService | `src/services/matrix/room/MatrixRoomSummaryService.ts` | 活跃 |
| MatrixOidcService | `src/services/matrix/auth/MatrixOidcService.ts` | 活跃 |

### 辅助模块

| 模块 | 路径 | 用途 |
|-----|------|------|
| spaceQueries | `src/services/matrix/room/spaceQueries.ts` | Space 查询操作 |
| spaceHelpers | `src/services/matrix/room/spaceHelpers.ts` | Space 工具函数 |
| SummaryService | `src/services/matrix/room/SummaryService.ts` | 房间摘要服务 |

---

**文档维护**：
- 如有问题或建议，请提交 Issue 或 PR
- 优化进度追踪：关联项目看板 "SDK 封装层优化"
