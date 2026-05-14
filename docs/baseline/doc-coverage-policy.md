# hula Doc-Coverage 基线与递减策略

> 文档版本：v1.0.0
> 应用版本：v3.0.9
> 维护人：前端负责人 / SDK 负责人
> 最后更新：2026-05-04
> 关联工具：[`scripts/check-doc-coverage.mjs`](file:///Users/ljf/Desktop/hu_ts/hula/scripts/check-doc-coverage.mjs) · [`scripts/doc-coverage-baseline.json`](file:///Users/ljf/Desktop/hu_ts/hula/scripts/doc-coverage-baseline.json)
> 关联标准：§18.5.1 / §20.1 KPI #8 (Doc ↔ code sync)

---

## 1. 目的

`src/services/**` 下所有导出方法 / `public` 方法必须带前置 JSDoc 摘要。项目当前尚未达到
100% 覆盖，因此采用 **棘轮 (ratchet)** 模型：先锁定现状为基线、只允许下降不允许上升，
再通过周期性递减规则把基线推到 0。

本文件为该棘轮的治理条款：什么情况下基线可以变、由谁变、变多少。

---

## 2. 现状快照 (2026-05-04)

| 指标                        | 数值        |
| --------------------------- | ----------- |
| 扫描文件数                  | 167         |
| 基线记录的未文档方法数      | **1 022**   |
| 触发 CI 失败的新增未文档上限 | **0** (零容忍回归) |

### 2.1 域分布 (top 10)

| 路径                                                   | 未文档数 |
| ------------------------------------------------------ | -------: |
| `src/services/matrix/room`                             |      233 |
| `src/services/matrix/admin`                            |      191 |
| `src/services/matrix/crypto`                           |       99 |
| `src/services/matrix/messaging`                        |       95 |
| `src/services/matrix/media`                            |       51 |
| `src/services/matrix/user`                             |       50 |
| `src/services/matrix/friends`                          |       39 |
| `src/services/matrix/notifications`                    |       37 |
| `src/services/matrix/SynapseRustExtensionsService.ts`  |       31 |
| `src/services/matrix/ai`                               |       30 |

`src/services/matrix` 独占 954 / 1 022 (93%)；非 matrix 服务合计 68 条，建议优先清零。

---

## 3. 棘轮规则

### 3.1 零容忍回归 (硬门)

- CI 流水线的 `pnpm check:doc-coverage` 必须在每条 PR 上为绿。
- 新增未文档导出方法 **会直接失败**，不区分文件归属。
- 对基线里已存在的未文档方法进行重命名等效于新增一条记录 + 移除旧条目；
  重命名方 **必须** 在同一 PR 内为新名称补齐 JSDoc。

### 3.2 只降不升 (计数约束)

- `scripts/doc-coverage-baseline.json` 的 `count` 字段 **只允许减小**。
- 允许的 baseline 更新路径：
  - `node scripts/check-doc-coverage.mjs --update-baseline`
  - `DOC_COVERAGE_BASELINE_UPDATE=1 pnpm check:doc-coverage`
- 更新后的 `count` 必须 ≤ 旧文件中的 `count`。PR 评审需要在 diff 中看到
  `count` 减少；若相同，PR 不应带上 baseline 文件的变动。

### 3.3 月度楼层 (收敛保证)

| 周期 | 月度最小降幅 | 目标累计剩余 |
| ----: | -----------: | -----------: |
| M0 (2026-05)   | —             | 1 022        |
| M1 (2026-06)   | −50          | ≤ 972        |
| M2 (2026-07)   | −75          | ≤ 897        |
| M3 (2026-08)   | −100         | ≤ 797        |
| M4+ (每月)     | −100         | −100/月      |
| 终点 (2027 Q1) | —            | **0**        |

- 每个自然月末由维护人核对 `count`；未达到月度降幅视为治理警报 (不阻断发布，但
  下一个 Sprint 必须优先排布追赶任务)。
- 楼层单调下降；若某月超额完成 (例如 −150)，**下个月的楼层仍按表格里的 −100**
  从新的 count 起算，不叠加。

### 3.4 领域清零 (优先级)

非 matrix 的 68 条基线记录属于小面积域，建议按以下优先级在 RC 前清零：

1. `src/services/backend` (13)
2. `src/services/offline` (10)
3. `src/services/trendradar` (10)
4. `src/services/discovery` (9)
5. `src/services/siliconflow` (9)
6. `src/services/ai-provider.ts` 等顶层文件 (17)

matrix 子域按现有业务权重顺序推进 (room → admin → messaging → crypto → …)，
由各子域负责人认领。

---

## 4. 流程

### 4.1 写 JSDoc

```ts
/**
 * 发送消息。
 *
 * @param roomId 目标房间 ID
 * @param content 文本或富文本内容
 * @returns 发送后 SDK 返回的 event_id
 * @throws {AppError} 网络失败、权限不足、或房间不存在时抛出
 */
async sendMessage(roomId: string, content: MessageContent): Promise<string> { … }
```

- 摘要不可为空，不可仅复述方法名。
- 有副作用 / 抛异常 / 幂等约束的方法必须在正文或标签中说明。
- 覆盖 `ledger_route` 关联方法时，摘要应引用对应路径 (例如 `POST /_matrix/client/v3/login`)
  以便 §20.2 的 contract-coverage 反查。

### 4.2 本地验证

```bash
pnpm check:doc-coverage                           # 棘轮检查 (与 CI 等价)
pnpm check:doc-coverage -- --strict               # 按 "任何未文档即失败" 验证 (推荐写完域后跑一次)
node scripts/check-doc-coverage.mjs --json        # 机器可读报告
```

### 4.3 更新 baseline

当一条 PR 消除了一批未文档方法时：

```bash
DOC_COVERAGE_BASELINE_UPDATE=1 pnpm check:doc-coverage
git add scripts/doc-coverage-baseline.json
```

PR 描述需包含：

- 旧 `count` → 新 `count` 的差值；
- 对应清理的文件 / 域；
- 是否触发了月度楼层 (§3.3) 的达成记录。

---

## 5. 例外

- 自动生成代码 (`docs/generated/`、SDK 桥接层的 `// AUTO-GENERATED` 段) 不列入扫描范围；
  如扫描器误报，需要在 `scripts/check-doc-coverage.mjs` 的 `SKIP_PATTERN` 中加入排除。
- `interface` / `type` 声明体内的方法签名已经被扫描器的 `computeDeclOnlyRanges`
  豁免，不在基线内；新增 interface 成员无需额外文档。
- 对于仅为向后兼容而保留的 deprecated 方法，允许以 `@deprecated` 标签 + 一句话迁移
  指引作为摘要。

---

## 6. 升级终局

当 `count` 归零后：

1. 删除 `scripts/doc-coverage-baseline.json`。
2. 把 `pnpm check:doc-coverage` 改为 `--strict` 模式。
3. 在 `check:release` 链路里把本项提升为硬门禁 (目前已含，仅去掉 baseline 回退)。
4. 此文件归档为 `docs/baseline/doc-coverage-history.md`，保留历史轨迹。
