# HuLa 前端重构优化方案

> 整合日期: 2026-03-22
> 版本: v1.0
> 整合自:
>
> - synapse-rust/docs/REVIEW\_REPORT.md
> - matrix-js-sdk/docs/REVIEW\_REPORT.md
> - hula/docs/ANALYSIS\_REPORT.md

***

## 一、项目整体现状

### 1.1 技术架构

```
┌─────────────────────────────────────────────────────────────┐
│                      HuLa 前端应用 (Tauri + Vue 3)          │
├─────────────────────────────────────────────────────────────┤
│  状态层: Pinia (30+ stores)                                 │
│  服务层: 33 个 Matrix 服务类 + 自定义服务                     │
│  SDK层: matrix-js-sdk (138 模块)                           │
├─────────────────────────────────────────────────────────────┤
│              synapse-rust (Rust Matrix Homeserver)          │
│  API: 64 端点 | DB: 152+ 表 | 模块: 400+ Rust 文件          │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 各项目评分

| 项目            | 综合评分   | 主要问题              |
| ------------- | ------ | ----------------- |
| synapse-rust  | 88/100 | 测试覆盖 72%，OIDC 不完整 |
| matrix-js-sdk | 75/100 | 15+ 模块覆盖 <20%     |
| hula (前端)     | 80/100 | 7 个 TS 错误，死代码需清理  |

***

## 二、重构目标

### 2.1 总体目标

1. **消除前端 TypeScript 编译错误** (7 个)
2. **清理后端死代码和冗余** (140+ 函数)
3. **提升 SDK 测试覆盖率至 80%**
4. **完善缺失的 Matrix SDK 方法**
5. **优化前端大型 store**

### 2.2 优先级矩阵

| 优先级 | 任务                    | 影响范围         | 预计工作量 |
| --- | --------------------- | ------------ | ----- |
| P0  | 修复前端 TS 错误            | hula 编译      | 3h    |
| P0  | 补充 SDK 缺失方法           | hula + SDK   | 4h    |
| P1  | 清理 ImRequestUtils 死代码 | hula         | 8h    |
| P1  | 提升 SDK 测试覆盖           | SDK          | 16h   |
| P2  | 优化大型 Store            | hula         | 8h    |
| P2  | 完善后端 OIDC             | synapse-rust | 12h   |

***

## 三、详细重构计划

### 3.1 P0: 前端 TypeScript 错误修复

#### 3.1.1 contacts.ts (4 个错误)

| 行号  | 错误                        | 修复方案                              |
| --- | ------------------------- | --------------------------------- |
| 176 | `getDmRoomInfos` 不存在      | 改用 `getDmRoomInfo(roomId)` 或添加该方法 |
| 292 | `roomId` 属性不存在            | 检查数据结构                            |
| 366 | `cancelFriendRequest` 不存在 | 添加方法或改用现有 API                     |
| 501 | `Promise<boolean>` 类型不匹配  | 移除 `return await`                 |

#### 3.1.2 TrendRadarService.ts

| 行号      | 错误          | 修复方案            |
| ------- | ----------- | --------------- |
| 502-511 | 重复导出 10 个类型 | 移除重复的 export 声明 |

#### 3.1.3 sdk-check.ts

| 行号 | 错误                    | 修复方案  |
| -- | --------------------- | ----- |
| 34 | 未使用的 @ts-expect-error | 移除或修复 |

#### 修复步骤

```bash
# 1. 修复 contacts.ts
cd /Users/ljf/Desktop/hu/hula
# 修改 src/stores/contacts.ts

# 2. 修复 TrendRadarService.ts
# 修改 src/services/trendradar/TrendRadarService.ts

# 3. 修复 sdk-check.ts
# 修改 src/utils/matrix/sdk-check.ts

# 4. 验证修复
pnpm tsc --noEmit
```

***

### 3.2 P0: SDK 方法补充

#### 3.2.1 缺失方法清单

| 服务类                        | 缺失方法                                  | 优先级 |
| -------------------------- | ------------------------------------- | --- |
| MatrixDirectMessageService | `getDmRoomInfos(userIds: string[])`   | P0  |
| MatrixFriendService        | `cancelFriendRequest(userId: string)` | P0  |
| MatrixDirectMessageService | `getDmRoomInfo(roomId: string)`       | P0  |

#### 3.2.2 低覆盖率模块补充

| 模块         | 当前覆盖 | 目标覆盖 | 优先级 |
| ---------- | ---- | ---- | --- |
| device     | 0%   | 80%  | P1  |
| dm         | 3%   | 80%  | P1  |
| admin      | 5.4% | 80%  | P1  |
| account    | 4.9% | 80%  | P1  |
| federation | 4.1% | 80%  | P1  |

#### 3.2.3 SDK 补充步骤

```bash
# 1. 添加缺失方法
cd /Users/ljf/Desktop/hu/matrix-js-sdk

# 2. 补充测试
# 在 spec/ 目录添加对应测试文件

# 3. 重新构建
pnpm build

# 4. 前端同步
cd ../hula
pnpm install
```

***

### 3.3 P1: ImRequestUtils 死代码清理

#### 3.3.1 函数分类

| 类别         | 数量   | 处理方式                 |
| ---------- | ---- | -------------------- |
| AI 对话/媒体生成 | \~45 | 保留 (后端独立服务)          |
| API 密钥管理   | 7    | 保留                   |
| 好友相关 Mock  | 8    | 迁移到 Matrix SDK       |
| 群组相关 Mock  | 15   | ⚠️ 后端无 `im/room/*` 端点，建议迁移到 Matrix SDK 房间服务或删除 |
| 消息相关 Mock  | 5    | ⚠️ 后端无实现，已添加 `matrixMessageRelationService.deleteMessage()` 方法 |
| 通知相关 Mock  | 4    | ✅ 后端 push.rs 有完整实现，前端 MatrixPushService 已对接 |
| 用户状态 Mock  | 2    | ⚠️ 后端无 `im/user/*` 端点，建议迁移到 Matrix SDK 或删除 |
| 朋友圈相关      | 15   | 已删除                  |
| 其他 Mock    | \~50 | 逐步清理                 |

#### 3.3.2 清理步骤

1. **第一阶段**: 修复 contacts.ts 类型错误 (P0)
2. **第二阶段**: 移除通知/用户状态 Mock (安全删除)
3. **第三阶段**: 确认群组需求，处理好友 Mock
4. **第四阶段**: 清理 ImUrlEnum 遗留枚举

#### 3.3.3 风险控制

- 编译检查: 每次修改后运行 `pnpm tsc --noEmit`
- 引用检查: 使用 IDE 分析未使用函数
- 逐步删除: 每次删除 5-10 个函数，避免大规模改动

***

### 3.4 P1: 后端测试覆盖提升

#### 3.4.1 覆盖目标

| 模块         | 当前覆盖 | 目标覆盖 | 需补充测试   |
| ---------- | ---- | ---- | ------- |
| worker     | 45%  | 80%  | \~150 行 |
| federation | 55%  | 80%  | \~200 行 |
| cache      | 65%  | 80%  | \~100 行 |

#### 3.4.2 测试策略

```bash
cd /Users/ljf/Desktop/hu/synapse-rust

# 运行测试覆盖率
cargo test --coverage

# 查看具体覆盖报告
# target/coverage/html/index.html
```

***

### 3.5 P2: 前端 Store 优化

#### 3.5.1 大型 Store 分析

| Store       | 大小   | 问题   |
| ----------- | ---- | ---- |
| chat.ts     | 37KB | 过于复杂 |
| contacts.ts | 18KB | 类型问题 |
| group.ts    | 19KB | 可拆分  |

#### 3.5.2 优化方案

**chat.ts 拆分建议**:

```
stores/
├── chat/
│   ├── index.ts        # 入口，组合子 store
│   ├── messages.ts    # 消息数据
│   ├── timeline.ts    # 时间线逻辑
│   ├── pending.ts     # 待发送消息
│   └── reactions.ts   # 表情回应
```

***

### 3.6 P2: 后端 OIDC 完善

#### 3.6.1 当前状态

| 功能         | 状态     |
| ---------- | ------ |
| OIDC 授权    | ⚠️ 存根  |
| OIDC Token | ⚠️ 存根  |
| OIDC 动态注册  | ⚠️ 不支持 |

#### 3.6.2 实现建议

1. 集成外部 OIDC Provider (如 Keycloak, Auth0)
2. 实现动态客户端注册
3. 添加完整的 Token 颁发/刷新/撤销流程

***

## 四、任务清单

### 4.1 短期 (1 周)

- [ ] 修复 contacts.ts 4 个 TypeScript 错误
- [ ] 修复 TrendRadarService.ts 重复导出
- [ ] 修复 sdk-check.ts 未使用指令
- [ ] 添加 MatrixDirectMessageService.getDmRoomInfos
- [ ] 添加 MatrixFriendService.cancelFriendRequest
- [ ] 补充 device, dm, admin 模块测试 (覆盖 >50%)

### 4.2 中期 (2 周)

- [x] 清理 ImRequestUtils 通知/状态 Mock - ✅ 通知 Mock 已分析，前端已对接后端 API
- [x] 分析消息相关 Mock 问题 - ✅ 后端无实现，已添加 `matrixMessageRelationService.deleteMessage()`
- [x] 分析群组相关 Mock - ⚠️ 后端无 `im/room/*` 端点，建议迁移到 Matrix SDK
- [x] 分析用户状态 Mock - ⚠️ 后端无 `im/user/*` 端点，建议迁移到 Matrix SDK
- [ ] 补充 SDK 测试覆盖至 80%
- [ ] 完善 synapse-rust OIDC 实现
- [ ] 优化 chat.ts store 结构
- [ ] 提升 worker/federation 模块测试覆盖

### 4.3 长期 (1 个月)

- [ ] 清理 ImRequestUtils 全部死代码
- [ ] 完善前端错误边界和异常处理
- [ ] 添加完整的 API 文档
- [ ] 建立性能监控体系

***

## 五、依赖关系

```
┌─────────────────────────────────────────────────────────────┐
│                        重构依赖图                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   [P0: TS 错误修复] ─────┐                                  │
│      │                   │                                  │
│      ▼                   ▼                                  │
│   [P0: SDK 方法补充] ───►│                                  │
│      │                   │                                  │
│      ▼                   ▼                                  │
│   [P1: 死代码清理] ◄─────┘                                  │
│      │                                                      │
│      ▼                                                      │
│   [P1: 测试覆盖] ◄────────────────────────────────┐        │
│      │                                           │         │
│      └──────────┬────────────────────────────────┘         │
│                 ▼                                           │
│   [P2: Store 优化]                                         │
│                 │                                           │
│   [P2: OIDC 完善]                                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

***

## 六、验证清单

每次重构完成后执行:

```bash
# 1. TypeScript 检查
cd /Users/ljf/Desktop/hu/hula
pnpm tsc --noEmit

# 2. SDK 构建
cd /Users/ljf/Desktop/hu/matrix-js-sdk
pnpm build
pnpm test:coverage

# 3. 后端测试
cd /Users/ljf/Desktop/hu/synapse-rust
cargo test

# 4. 前端构建
cd /Users/ljf/Desktop/hu/hula
pnpm build
```

***

## 七、风险与缓解

| 风险               | 影响 | 缓解措施        |
| ---------------- | -- | ----------- |
| 删除 Mock 函数导致编译错误 | 高  | 先分析引用，再逐步删除 |
| SDK 修改破坏现有功能     | 中  | 添加集成测试验证    |
| Store 拆分引入回归     | 中  | 拆分后运行完整测试   |

***

*文档版本: v1.0*
*生成时间: 2026-03-22 23:51*
