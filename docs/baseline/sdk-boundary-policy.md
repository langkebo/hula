# hula SDK 边界基线与递减策略

> 文档版本：v1.0.0
> 应用版本：v3.0.9
> 维护人：SDK 负责人 / 前端负责人
> 最后更新：2026-05-04
> 关联工具：[`scripts/check-sdk-boundary.mjs`](file:///Users/ljf/Desktop/hu_ts/hula/scripts/check-sdk-boundary.mjs) · [`scripts/sdk-boundary-baseline.json`](file:///Users/ljf/Desktop/hu_ts/hula/scripts/sdk-boundary-baseline.json)
> 关联标准：§5.2 / §21.2 P1 (SDK boundary enforcement)

---

## 1. 目的

只允许下列 **白名单边界文件** 直接 `import` `matrix-js-sdk` 或任何
`matrix-js-sdk/<subpath>`：

```
src/services/matrix/sdk.ts               -- 直接从 matrix-js-sdk/core 再导出
src/services/matrix/sdk-entry.ts         -- hula 业务代码的规范入口
src/services/matrix/sdk-compat.ts        -- 治理钩子 / subpath 隔离
src/services/matrix/sdk-errors.ts        -- SDK 错误归一化
src/types/matrix-js-sdk/index.ts         -- 类型再导出桶
src/types/matrix-js-sdk-augmentations.d.ts -- SDK 类型增强
```

`src/**` 的其他任何文件出现 `from 'matrix-js-sdk'` 或 `from 'matrix-js-sdk/<subpath>'`
都记为 **违规 (violation)**。当前违规集合锁定在 `scripts/sdk-boundary-baseline.json`，
仅允许下降不允许上升。

---

## 2. 现状快照 (2026-05-04)

| 指标                          | 数值     |
| ----------------------------- | -------- |
| 扫描文件数                    | 1 137    |
| 基线违规总数                  | **130**  |
| bare `matrix-js-sdk`          | 120      |
| subpath `matrix-js-sdk/*`     | 10       |
| 触发 CI 失败的新增违规上限    | **0**    |

### 2.1 顶层分布

| 路径                                | 违规数 |
| ----------------------------------- | ----: |
| `src/services/matrix`               | 127   |
| `src/test-helpers/matrixMocks.ts`   |   1   |
| `src/types/matrix-extensions.d.ts`  |   1   |
| `src/workers/indexeddb.worker.ts`   |   1   |

### 2.2 subpath 分布 (10 条)

| 子路径                             | 违规数 | 推荐归宿                                             |
| ---------------------------------- | -----: | ---------------------------------------------------- |
| `matrix-js-sdk/manager-extensions` | 2      | `sdk-compat.ts` (已在用，迁移未完成的调用点)         |
| `matrix-js-sdk/friend`             | 2      | `sdk-entry.ts` 的 friend 类型再导出                 |
| `matrix-js-sdk/crypto`             | 1      | `sdk-entry.ts` (crypto 命名空间)                    |
| `matrix-js-sdk/telemetry`          | 1      | `sdk-entry.ts`                                       |
| `matrix-js-sdk/push`               | 1      | `sdk-entry.ts`                                       |
| `matrix-js-sdk/space`              | 1      | `sdk-entry.ts`                                       |
| `matrix-js-sdk/dm`                 | 1      | `sdk-entry.ts`                                       |
| `matrix-js-sdk/store/worker`       | 1      | `sdk-compat.ts` (Worker 侧桥接)                     |

---

## 3. 棘轮规则

### 3.1 零容忍新增 (硬门)

- `pnpm check:sdk-boundary` 在每条 PR 上为绿，已纳入 `check:release` 链路。
- 新增任意 `matrix-js-sdk` / `matrix-js-sdk/*` 引用到非白名单文件 → CI 失败。
- 文件改名等效于 "旧记录删除 + 新记录新增"；重命名方必须在同一 PR 内
  把引用迁走，否则新文件会作为违规出现。

### 3.2 只降不升 (计数约束)

- `scripts/sdk-boundary-baseline.json` 的 `count` 字段 **只允许减小**。
- 允许的 baseline 更新路径：
  - `node scripts/check-sdk-boundary.mjs --update-baseline`
  - `SDK_BOUNDARY_BASELINE_UPDATE=1 pnpm check:sdk-boundary`
- 更新后的 `count` 必须 ≤ 旧 `count`；评审需在 diff 中看到 `count` 变小
  (或 `violations` 数组有条目被移除)。

### 3.3 类型迁移优先 (低成本)

基线里 **109 / 120 条 bare 引用是 type-only 导入** (`import type { … } from
'matrix-js-sdk'`)。这类迁移只需：

1. 确认 `sdk-entry.ts` 已经再导出目标类型；若没有，先在 `sdk.ts` +
   `sdk-entry.ts` 中加 `export type`。
2. 把原文件的 `from 'matrix-js-sdk'` 改为 `from '@/services/matrix/sdk-entry'`。
3. 跑 `pnpm vue-tsc --noEmit` 验证。

推荐批次：一次 PR 吃掉一个服务子目录 (`room/`、`crypto/` 等)。

### 3.4 值迁移 (11 条)

剩余 11 条是值级 import (`import { Preset, Visibility } from 'matrix-js-sdk'`
等)。这些需要：

1. 把枚举 / `const` 加进 `sdk.ts` + `sdk-entry.ts` 的 `export { … }`。
2. 更新调用点从 `sdk-entry` 取值。
3. 运行相关子域的单测。

### 3.5 subpath 迁移 (10 条)

subpath import 只允许出现在 `sdk-compat.ts`。迁移步骤：

1. 目标 subpath 的公共类型 → 在 `sdk-entry.ts` 中 `export type { … } from './sdk'`
   (或 `./sdk-compat` 视治理需要)。
2. 运行时钩子 (如 `extendMatrixClientWithManagers`、`IndexedDBStoreWorker`)
   → 作为命名导出放到 `sdk-compat.ts`。
3. 调用点切到 `@/services/matrix/sdk-entry` 或 `@/services/matrix/sdk-compat`。

### 3.6 月度楼层

| 周期          | 月度最小降幅 | 目标剩余 |
| -------------: | ----------: | ------: |
| M0 (2026-05)   | —           | 130    |
| M1 (2026-06)   | −30         | ≤ 100  |
| M2 (2026-07)   | −30         | ≤ 70   |
| M3 (2026-08)   | −30         | ≤ 40   |
| M4 (2026-09)   | −40         | **0**  |

归零后切换为 `--strict` 模式，保留 baseline 文件以历史追踪即可。

---

## 4. 流程

### 4.1 本地验证

```bash
pnpm check:sdk-boundary                             # 棘轮检查 (与 CI 等价)
pnpm check:sdk-boundary -- --strict                 # 按 "任何违规即失败" 验证
node scripts/check-sdk-boundary.mjs --json          # 机器可读报告
```

### 4.2 更新 baseline

当一条 PR 把若干违规迁进边界文件后：

```bash
SDK_BOUNDARY_BASELINE_UPDATE=1 pnpm check:sdk-boundary
git add scripts/sdk-boundary-baseline.json
```

PR 描述需包含：

- 旧 `count` → 新 `count` 的差值；
- 迁移的子目录 / 文件列表；
- 是否触发了月度楼层的达成记录 (§3.6)。

---

## 5. 例外

- `src/types/` 里的 `.d.ts` 仅作类型再导出用，目前允许 `src/types/matrix-extensions.d.ts`
  和 `src/types/matrix-js-sdk-augmentations.d.ts` 中的引用，但新增文件需要走白名单。
- 扫描器看到的每一行都必须匹配真实 `import` / `export ... from` 语句；字符串字面量
  (例如 `'matrix-js-sdk'` 出现在日志里) 不会被算为违规。
- 生成代码 (`docs/generated/**`、Worker 构建产物) 不在扫描范围；若新路径需要
  豁免，应扩展 `SKIP_PATTERN`。

---

## 6. 升级终局

当 `count` 归零：

1. 把 `pnpm check:sdk-boundary` 改为 `--strict` 模式。
2. 在 `check:release` 链路上维持硬门禁。
3. 保留 baseline 文件作为历史，或归档到 `docs/baseline/sdk-boundary-history.md`。
4. 考虑把白名单进一步收紧 (例如把 `sdk.ts` 合并进 `sdk-entry.ts`)。
