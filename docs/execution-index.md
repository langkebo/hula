# hula 优化执行导航

> 文档版本：v1.0.0  
> 应用版本：v3.0.9  
> 维护人：项目维护者 / 前端负责人 / Rust 负责人 / QA 负责人 / DevOps  
> 最后更新：2026-04-30  
> 关联文档：[`hula优化实施方案.md`](file:///Users/ljf/Desktop/hu_ts/hula/docs/hula优化实施方案.md)

---

## 1. 文档目的

用于把当前已经产出的优化方案、基线文档、建单模板、PR 模板和发布模板收敛成一个统一入口，方便团队直接回答以下问题：

- 先看哪份文档
- 第 1 周先做什么
- 要建哪些 Issue
- 提交 PR 时用哪份模板
- 发布、灰度、回滚时用哪份模板

如果团队只打开一份执行类文档，优先打开本文件。

---

## 2. 执行总入口

### 2.1 文档阅读顺序

建议按以下顺序阅读：

1. [hula优化实施方案.md](file:///Users/ljf/Desktop/hu_ts/hula/docs/hula优化实施方案.md)
2. [performance-baseline.md](file:///Users/ljf/Desktop/hu_ts/hula/docs/baseline/performance-baseline.md)
3. [bundle-baseline.md](file:///Users/ljf/Desktop/hu_ts/hula/docs/baseline/bundle-baseline.md)
4. [security-baseline.md](file:///Users/ljf/Desktop/hu_ts/hula/docs/baseline/security-baseline.md)
5. [issue-backlog.md](file:///Users/ljf/Desktop/hu_ts/hula/docs/issue-backlog.md)
6. [issue-templates.md](file:///Users/ljf/Desktop/hu_ts/hula/docs/issue-templates.md)
7. [pr-templates.md](file:///Users/ljf/Desktop/hu_ts/hula/docs/pr-templates.md)
8. [release-templates.md](file:///Users/ljf/Desktop/hu_ts/hula/docs/release-templates.md)
9. [onboarding/checklist.md](file:///Users/ljf/Desktop/hu_ts/hula/docs/onboarding/checklist.md)
10. [hula-core-architecture.puml](file:///Users/ljf/Desktop/hu_ts/hula/docs/hula-core-architecture.puml)

### 2.2 每份文档解决什么问题

| 文档 | 作用 | 适用阶段 |
|---|---|---|
| [hula优化实施方案.md](file:///Users/ljf/Desktop/hu_ts/hula/docs/hula优化实施方案.md) | 总体目标、12 周排期、任务拆解、策略原则 | 立项 / 排期 |
| [performance-baseline.md](file:///Users/ljf/Desktop/hu_ts/hula/docs/baseline/performance-baseline.md) | 性能基线采集、记录规范、回归阈值 | 测量 / 复测 |
| [bundle-baseline.md](file:///Users/ljf/Desktop/hu_ts/hula/docs/baseline/bundle-baseline.md) | 构建产物体积、chunk 风险、预算治理 | 构建治理 |
| [security-baseline.md](file:///Users/ljf/Desktop/hu_ts/hula/docs/baseline/security-baseline.md) | 安全基线、权限面、CSP、会话与敏感信息风险 | 安全治理 |
| [issue-backlog.md](file:///Users/ljf/Desktop/hu_ts/hula/docs/issue-backlog.md) | 统一任务池与优先级 | 建单 / 排期 |
| [issue-templates.md](file:///Users/ljf/Desktop/hu_ts/hula/docs/issue-templates.md) | 标准 Issue 模板 | 建单 |
| [pr-templates.md](file:///Users/ljf/Desktop/hu_ts/hula/docs/pr-templates.md) | 优化专项 PR 模板 | 开发 / 评审 |
| [release-templates.md](file:///Users/ljf/Desktop/hu_ts/hula/docs/release-templates.md) | 发布清单、灰度、回滚、复盘模板 | 发布 / 回滚 |
| [onboarding/checklist.md](file:///Users/ljf/Desktop/hu_ts/hula/docs/onboarding/checklist.md) | 新成员入项检查清单 | 入项引导 |
| [hula-core-architecture.puml](file:///Users/ljf/Desktop/hu_ts/hula/docs/hula-core-architecture.puml) | 项目核心架构图 (PlantUML) | 架构理解 |
| [scripts/bootstrap.sh](file:///Users/ljf/Desktop/hu_ts/hula/scripts/bootstrap.sh) | 项目一键启动脚本 | 环境搭建 |

---

## 3. 第 1 周执行顺序

### 3.1 本周目标

根据 [hula优化实施方案.md](file:///Users/ljf/Desktop/hu_ts/hula/docs/hula优化实施方案.md#L822-L851) 的 12 周排期，第 1 周的核心目标是：

- 建立性能基线
- 建立 bundle 基线
- 建立安全基线
- 固定预算阈值和风险清单
- 为后续优化任务建单并明确负责人

### 3.2 建议执行顺序

1. 阅读 [issue-backlog.md](file:///Users/ljf/Desktop/hu_ts/hula/docs/issue-backlog.md#L29-L39)，确认首批 `P0` 任务。
2. 访问 [docs/issues/](file:///Users/ljf/Desktop/hu_ts/hula/docs/issues/) 目录，查看预设的 Issue 草稿文件。
3. 创建首批核心 Issue：
   - [P0-PERF-01-建立首轮性能基线.md](file:///Users/ljf/Desktop/hu_ts/hula/docs/issues/P0-PERF-01-建立首轮性能基线.md)
   - [P0-PERF-02-量化启动与登录恢复耗时.md](file:///Users/ljf/Desktop/hu_ts/hula/docs/issues/P0-PERF-02-量化启动与登录恢复耗时.md)
   - [P0-BUNDLE-01-建立desktop-mobile首轮bundle基线.md](file:///Users/ljf/Desktop/hu_ts/hula/docs/issues/P0-BUNDLE-01-建立desktop-mobile首轮bundle基线.md)
   - [P0-BUNDLE-02-收敛首屏重型依赖.md](file:///Users/ljf/Desktop/hu_ts/hula/docs/issues/P0-BUNDLE-02-收敛首屏重型依赖.md)
   - [P0-SEC-01-补齐生产CSP基线.md](file:///Users/ljf/Desktop/hu_ts/hula/docs/issues/P0-SEC-01-补齐生产CSP基线.md)
   - [P0-SEC-02-收敛移动端capability.md](file:///Users/ljf/Desktop/hu_ts/hula/docs/issues/P0-SEC-02-收敛移动端capability.md)
   - [P0-SEC-03-明确token存储加密方案.md](file:///Users/ljf/Desktop/hu_ts/hula/docs/issues/P0-SEC-03-明确token存储加密方案.md)
4. 补齐负责人与时间，并在内部系统完成建单。
5. 先执行性能 / bundle / 安全三份基线采集，不急于改代码。
6. 将采集结果回填到三份基线文档。
7. 根据采集结果决定第 2 周的首批代码改造项。

### 3.3 第 1 周完成定义

- [x] 三份基线文档已从“待采集”为主，变为“已有首轮记录” (已完成静态审计与 Batch 1 自动化采集)
- [x] 执行一次真实环境下的 `pnpm build` 与性能采样
- [x] 核心 P0 Issue 已全部创建并完成首轮代码修复 (Token 加密, CSP 加固, Three.js 异步化)
- [x] 产出关键架构重构方案 (Render Worker, Matrix Memory Cap)
- [ ] 每个 Issue 已指定负责人和目标版本

---

## 4. 任务导航与 Issue 草稿

### 4.1 P0 级任务 (核心基线与风险收敛)

| Task ID | Issue 草稿文件 | 对应基线文档 | 状态 |
|---|---|---|---|
| `P0-PERF-01` | [P0-PERF-01-建立首轮性能基线.md](file:///Users/ljf/Desktop/hu_ts/hula/docs/issues/P0-PERF-01-建立首轮性能基线.md) | [performance-baseline.md](file:///Users/ljf/Desktop/hu_ts/hula/docs/baseline/performance-baseline.md) | `web-dev` & `prod-like` 已采集 |
| `P0-PERF-02` | [P0-PERF-02-量化启动与登录恢复耗时.md](file:///Users/ljf/Desktop/hu_ts/hula/docs/issues/P0-PERF-02-量化启动与登录恢复耗时.md) | [performance-baseline.md](file:///Users/ljf/Desktop/hu_ts/hula/docs/baseline/performance-baseline.md) | 埋点已合入 `main.ts` |
| `P0-BUNDLE-01` | [P0-BUNDLE-01-建立desktop-mobile首轮bundle基线.md](file:///Users/ljf/Desktop/hu_ts/hula/docs/issues/P0-BUNDLE-01-建立desktop-mobile首轮bundle基线.md) | [bundle-baseline.md](file:///Users/ljf/Desktop/hu_ts/hula/docs/baseline/bundle-baseline.md) | `desktop` 已采集 |
| `P0-BUNDLE-02` | [P0-BUNDLE-02-收敛首屏重型依赖.md](file:///Users/ljf/Desktop/hu_ts/hula/docs/issues/P0-BUNDLE-02-收敛首屏重型依赖.md) | [bundle-baseline.md](file:///Users/ljf/Desktop/hu_ts/hula/docs/baseline/bundle-baseline.md) | `three.js` 已按需 / `shiki` 异步确认 |
| `P0-SEC-01` | [P0-SEC-01-补齐生产CSP基线.md](file:///Users/ljf/Desktop/hu_ts/hula/docs/issues/P0-SEC-01-补齐生产CSP基线.md) | [security-baseline.md](file:///Users/ljf/Desktop/hu_ts/hula/docs/baseline/security-baseline.md) | CSP 已收紧 (移除 eval/inline) |
| `P0-SEC-02` | [P0-SEC-02-收敛移动端capability.md](file:///Users/ljf/Desktop/hu_ts/hula/docs/issues/P0-SEC-02-收敛移动端capability.md) | [security-baseline.md](file:///Users/ljf/Desktop/hu_ts/hula/docs/baseline/security-baseline.md) | 权限已收敛至 `hula` 子目录 |
| `P0-SEC-03` | [P0-SEC-03-明确token存储加密方案.md](file:///Users/ljf/Desktop/hu_ts/hula/docs/issues/P0-SEC-03-明确token存储加密方案.md) | [security-baseline.md](file:///Users/ljf/Desktop/hu_ts/hula/docs/baseline/security-baseline.md) | AES-GCM 加密已落地 (含 Keyring) |

### 4.2 P1 级任务 (专项性能与安全审计)

| Task ID | Issue 草稿文件 | 对应基线文档 | 状态 |
|---|---|---|---|
| `P1-PERF-01` | [P1-PERF-01-验证大房间列表与消息列表边界.md](file:///Users/ljf/Desktop/hu_ts/hula/docs/issues/P1-PERF-01-验证大房间列表与消息列表边界.md) | [performance-baseline.md](file:///Users/ljf/Desktop/hu_ts/hula/docs/baseline/performance-baseline.md) | 已提供自动化压测框架 |
| `P1-PERF-02` | [P1-PERF-02-梳理主线程重计算路径.md](file:///Users/ljf/Desktop/hu_ts/hula/docs/issues/P1-PERF-02-梳理主线程重计算路径.md) | [performance-baseline.md](file:///Users/ljf/Desktop/hu_ts/hula/docs/baseline/performance-baseline.md) | 分析完成，产出 [Worker 迁移建议](file:///Users/ljf/Desktop/hu_ts/hula/docs/performance/main-thread-optimization-worker.md) |
| `P1-SEC-01` | [P1-SEC-01-建立v-html渲染点台账.md](file:///Users/ljf/Desktop/hu_ts/hula/docs/issues/P1-SEC-01-建立v-html渲染点台账.md) | [security-baseline.md](file:///Users/ljf/Desktop/hu_ts/hula/docs/baseline/security-baseline.md) | 已普查，全量使用 `v-safe-html` |
| `P1-SEC-02` | [P1-SEC-02-扩展日志脱敏规则.md](file:///Users/ljf/Desktop/hu_ts/hula/docs/issues/P1-SEC-02-扩展日志脱敏规则.md) | [security-baseline.md](file:///Users/ljf/Desktop/hu_ts/hula/docs/baseline/security-baseline.md) | 已增强递归脱敏逻辑 |
| `P1-SEC-03` | [P1-SEC-03-建立依赖审计周期任务.md](file:///Users/ljf/Desktop/hu_ts/hula/docs/issues/P1-SEC-03-建立依赖审计周期任务.md) | [security-baseline.md](file:///Users/ljf/Desktop/hu_ts/hula/docs/baseline/security-baseline.md) | 已集成 `pnpm audit` 脚本 |

### 4.3 P2 级任务 (持续治理与合规)

| Task ID | Issue 草稿文件 | 对应基线文档 | 状态 |
|---|---|---|---|
| `P2-PERF-01` | [P2-PERF-01-建立性能回归门禁.md](file:///Users/ljf/Desktop/hu_ts/hula/docs/issues/P2-PERF-01-建立性能回归门禁.md) | [performance-baseline.md](file:///Users/ljf/Desktop/hu_ts/hula/docs/baseline/performance-baseline.md) | 预算已定义 |
| `P2-PERF-02` | [P2-PERF-02-Matrix-SDK内存泄露普查.md](file:///Users/ljf/Desktop/hu_ts/hula/docs/issues/P2-PERF-02-Matrix-SDK内存泄露普查.md) | [performance-baseline.md](file:///Users/ljf/Desktop/hu_ts/hula/docs/baseline/performance-baseline.md) | 内存限额与裁剪逻辑已合入 Worker |
| `P2-BUNDLE-01` | [P2-BUNDLE-01-建立bundle变更审查模板.md](file:///Users/ljf/Desktop/hu_ts/hula/docs/issues/P2-BUNDLE-01-建立bundle变更审查模板.md) | [bundle-baseline.md](file:///Users/ljf/Desktop/hu_ts/hula/docs/baseline/bundle-baseline.md) | PR 模板已更新 |
| `P2-SEC-01` | [P2-SEC-01-建立capability-CSP-ADR流程.md](file:///Users/ljf/Desktop/hu_ts/hula/docs/issues/P2-SEC-01-建立capability-CSP-ADR流程.md) | [security-baseline.md](file:///Users/ljf/Desktop/hu_ts/hula/docs/baseline/security-baseline.md) | [ADR-003](file:///Users/ljf/Desktop/hu_ts/hula/docs/adr/ADR-003-Capability-CSP-Governance.md) 已发布 |
| `P2-SEC-02` | [P2-SEC-02-外链与嵌入Webview安全回归.md](file:///Users/ljf/Desktop/hu_ts/hula/docs/issues/P2-SEC-02-外链与嵌入Webview安全回归.md) | [security-baseline.md](file:///Users/ljf/Desktop/hu_ts/hula/docs/baseline/security-baseline.md) | [安全回归方案](file:///Users/ljf/Desktop/hu_ts/hula/docs/security/webview-security-tests.md) 已产出 |
| `P2-SEC-03` | [P2-SEC-03-评估Sentry接入前脱敏规范.md](file:///Users/ljf/Desktop/hu_ts/hula/docs/issues/P2-SEC-03-评估Sentry接入前脱敏规范.md) | [security-baseline.md](file:///Users/ljf/Desktop/hu_ts/hula/docs/baseline/security-baseline.md) | [隐私脱敏规范](file:///Users/ljf/Desktop/hu_ts/hula/docs/security/sentry-privacy-spec.md) 已产出 |

### 4.2 PR 入口

| Task ID | PR 模板 |
|---|---|
| `P0-PERF-01` | [pr-templates.md](file:///Users/ljf/Desktop/hu_ts/hula/docs/pr-templates.md#L107-L183) |
| `P0-BUNDLE-01` | [pr-templates.md](file:///Users/ljf/Desktop/hu_ts/hula/docs/pr-templates.md#L185-L261) |
| `P0-SEC-01` | [pr-templates.md](file:///Users/ljf/Desktop/hu_ts/hula/docs/pr-templates.md#L263-L339) |
| `P0-SEC-02` | [pr-templates.md](file:///Users/ljf/Desktop/hu_ts/hula/docs/pr-templates.md#L341-L417) |
| `P0-SEC-03` | [pr-templates.md](file:///Users/ljf/Desktop/hu_ts/hula/docs/pr-templates.md#L419-L488) |

### 4.3 发布入口

适用安全配置或会话链路改动时，优先查看：

- [release-templates.md](file:///Users/ljf/Desktop/hu_ts/hula/docs/release-templates.md#L51-L109) 的发布前检查清单
- [release-templates.md](file:///Users/ljf/Desktop/hu_ts/hula/docs/release-templates.md#L113-L172) 的灰度记录模板
- [release-templates.md](file:///Users/ljf/Desktop/hu_ts/hula/docs/release-templates.md#L175-L260) 的回滚与复盘模板

---

## 5. 角色分工建议

| 角色 | 第 1 周建议工作 |
|---|---|
| 前端负责人 | 推动 `P0-PERF-01`、`P0-BUNDLE-01`，组织基线采集与首轮结论 |
| Rust 负责人 | 参与 `P0-SEC-03`，梳理 token 存储链路与迁移风险 |
| QA | 参与性能场景记录、安全回归和发布前检查清单制定 |
| DevOps | 对齐现有 workflow、artifact、release 流程与发布模板 |
| 安全负责人 | 推动 `P0-SEC-01`、`P0-SEC-02`、`P0-SEC-03` |
| 项目维护者 | 确认优先级、负责人、目标版本与周会节奏 |

---

## 6. 常用命令导航

### 6.1 基线采集

```bash
pnpm check
pnpm test:run
pnpm test:e2e
pnpm metrics:bundle
pnpm build
pnpm analyze
pnpm dev
pnpm tauri:dev
pnpm audit
pnpm check:sdk-types
```

### 6.2 适用场景

| 命令 | 用途 |
|---|---|
| `pnpm check` | 代码检查与格式门禁 |
| `pnpm test:run` | 单元测试 |
| `pnpm test:e2e` | E2E 回归 |
| `pnpm metrics:bundle` | bundle 指标汇总 |
| `pnpm build` | 生产构建 |
| `pnpm analyze` | 产物可视化分析 |
| `pnpm dev` | Web 侧开发态采样 |
| `pnpm tauri:dev` | 桌面端开发态采样 |
| `pnpm audit` | 依赖漏洞扫描 |
| `pnpm check:sdk-types` | Matrix SDK 类型约束检查 |

---

## 7. 周会使用建议

每周例会可直接按本文件顺序过一遍：

1. 本周目标是否完成
2. 三份基线是否有新增数据
3. P0 / P1 任务状态是否变化
4. 是否有新的 PR 需要套用专项模板
5. 是否有发布、灰度或回滚风险需要提前准备

---

## 8. 建议下一步

如果继续往下推进，建议按以下顺序执行：

1. 先用 [issue-templates.md](file:///Users/ljf/Desktop/hu_ts/hula/docs/issue-templates.md) 创建首批 5 个 P0 Issue
2. 开始真实采集并回填 [performance-baseline.md](file:///Users/ljf/Desktop/hu_ts/hula/docs/baseline/performance-baseline.md)、[bundle-baseline.md](file:///Users/ljf/Desktop/hu_ts/hula/docs/baseline/bundle-baseline.md)、[security-baseline.md](file:///Users/ljf/Desktop/hu_ts/hula/docs/baseline/security-baseline.md)
3. 在产生首批真实数据后，再决定是否继续细化 `P0-PERF-02`、`P0-BUNDLE-02` 和 `P1-SEC-01`
