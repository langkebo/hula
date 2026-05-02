# hula 优化 Issue Backlog

> 文档版本：v1.0.0  
> 应用版本：v3.0.9  
> 维护人：项目维护者 / 前端负责人 / Rust 负责人 / QA 负责人  
> 最后更新：2026-04-30  
> 关联文档：[`hula优化实施方案.md`](file:///Users/ljf/Desktop/hu_ts/hula/docs/hula优化实施方案.md) / [`performance-baseline.md`](file:///Users/ljf/Desktop/hu_ts/hula/docs/baseline/performance-baseline.md) / [`bundle-baseline.md`](file:///Users/ljf/Desktop/hu_ts/hula/docs/baseline/bundle-baseline.md) / [`security-baseline.md`](file:///Users/ljf/Desktop/hu_ts/hula/docs/baseline/security-baseline.md)

---

## 1. 文档目的

用于把优化方案和三份基线文档中的关键动作收敛为统一 backlog，便于直接创建 Issue、排期、指派责任人并跟踪验收结果。

本文件当前为“第一版初始 backlog”，任务优先级以 `P0 / P1 / P2` 划分；所有任务默认不代表已经开工，需在实际建单后补充负责人、计划版本和起止时间。

---

## 2. 使用规则

- 每个任务都应映射到一个真实 Issue 或 PR
- 每个任务必须有唯一 ID，禁止后续复用
- `状态` 建议使用：`待创建` / `进行中` / `已完成` / `已阻塞`
- `验收标准` 必须可观察、可回归、可证明
- 涉及发布风险的任务必须补充灰度与回滚说明

---

## 3. P0 Backlog

| ID | 领域 | 任务标题 | 目标 | 主要动作 | 验收标准 | 依赖 | 状态 |
|---|---|---|---|---|---|---|---|
| `P0-PERF-01` | 性能 | 建立首轮性能基线 | 形成可对比的首轮性能数据 | 跑通 `desktop-dev-macos`、`web-dev-chrome`、`desktop-prod-like` 三组环境；归档 Web-Vitals、trace、录屏、日志 | `performance-baseline.md` 中环境表、Web-Vitals 表、场景记录表至少完成 2 组环境 | 无 | 待创建 |
| `P0-PERF-02` | 性能 | 量化启动与登录恢复耗时 | 明确容器启动到主工作区可交互链路耗时 | 增加启动链埋点，拆分容器启动、前端挂载、登录恢复、主工作区可交互四段耗时 | 输出链路分段耗时表，且数据可重复采集 | `P0-PERF-01` | 待创建 |
| `P0-BUNDLE-01` | 构建 | 建立 desktop / mobile 首轮 bundle 基线 | 拿到当前最重资产清单 | 执行 `pnpm build`、`pnpm metrics:bundle`、`pnpm analyze`；归档 `dist/bundle-metrics.json` 与可视化分析产物 | `bundle-baseline.md` 中 desktop/mobile 表格已填，已识别最重 10 个资产 | 无 | 待创建 |
| `P0-BUNDLE-02` | 构建 | 收敛首屏重型依赖 | 优先剥离高频路径中的大依赖 | 核查 `mermaid`、`three`、`@vue-office/*`、AI/插件模块是否进入首屏；输出懒加载清单 | 超过阈值 `500KB` 的 JS 资产全部有责任人和处理方案 | `P0-BUNDLE-01` | 待创建 |
| `P0-SEC-01` | 安全 | 补齐生产 CSP 基线 | 让桌面端和移动端具备明确的生产 CSP | 产出首版 CSP 白名单；回归登录、OIDC、媒体、外链、更新流程 | 生产配置不再为 `csp: null`，关键流程回归通过 | 无 | 待创建 |
| `P0-SEC-02` | 安全 | 收敛移动端 capability | 缩小高风险权限面 | 收敛 `fs:**`、`http://**`、`https://**`、`hula:default allow *`，补 capability-to-feature 映射表 | 移动端 capability 不再保留全量授权，映射表归档 | 无 | 待创建 |
| `P0-SEC-03` | 安全 | 明确 token 存储加密方案 | 降低本地 token 泄露风险 | 梳理 Rust 侧 token 持久化现状；评估系统安全存储或本地加密方案；输出迁移计划 | 有正式方案文档、迁移步骤、回滚说明、发布阻塞条件 | 无 | 待创建 |

---

## 4. P1 Backlog

| ID | 领域 | 任务标题 | 目标 | 主要动作 | 验收标准 | 依赖 | 状态 |
|---|---|---|---|---|---|---|---|
| `P1-PERF-01` | 性能 | 验证大房间列表与消息列表边界 | 确认 5k+ 消息场景的渲染瓶颈 | 对房间列表、消息列表、大房间滚动做专项采样和录制 | 有 FPS、首渲染、longtask 数据，并形成瓶颈结论 | `P0-PERF-01` | 待创建 |
| `P1-PERF-02` | 性能 | 梳理主线程重计算路径 | 识别可 Worker 化或异步化模块 | 重点排查富文本、预览、媒体处理、AI 渲染链路 | 输出主线程热点清单与首批优化顺序 | `P0-PERF-01` | 待创建 |
| `P1-BUNDLE-01` | 构建 | 输出重型依赖导入边界清单 | 明确哪些依赖需路由级或功能级拆分 | 按依赖生成“当前加载方式 / 建议方式 / 责任人”表 | `matrix-js-sdk`、`mermaid`、`three`、`@vue-office/*`、UI 双库均有处理策略 | `P0-BUNDLE-01` | 待创建 |
| `P1-BUNDLE-02` | 构建 | 建立 chunk 预算门禁策略 | 将 bundle 阈值纳入持续治理 | 明确 `500KB` 告警、`1MB` 强告警、连续超预算阻塞规则 | 预算、责任人、放行流程写入文档并进入 CI 方案 | `P0-BUNDLE-01` | 待创建 |
| `P1-SEC-01` | 安全 | 建立 `v-html` 渲染点台账 | 识别所有富文本渲染风险点 | 追踪 `ThreadView.vue`、`SpotlightDialog.vue`、`Bot.vue` 等路径的数据来源与清洗责任 | 台账完成，且每个 `v-html` 点都有“已清洗/依赖上游/待修复”标记 | `P0-SEC-01` | 待创建 |
| `P1-SEC-02` | 安全 | 扩展日志脱敏规则 | 减少敏感数据进入日志 | 扩展 `Logger` 脱敏模式，覆盖 `refresh_token`、二维码口令、恢复密钥等 | 单元测试覆盖新增脱敏模式，抽样日志无明文敏感字段 | `P0-SEC-03` | 待创建 |
| `P1-SEC-03` | 安全 | 建立依赖审计周期任务 | 把供应链检查纳入常规流程 | 规定 `pnpm audit` 执行频率、升级时限、豁免审批 | 有固定执行节奏和结果归档位置 | 无 | 待创建 |

---

## 5. P2 Backlog

| ID | 领域 | 任务标题 | 目标 | 主要动作 | 验收标准 | 依赖 | 状态 |
|---|---|---|---|---|---|---|---|
| `P2-PERF-01` | 性能 | 建立性能回归门禁 | 把基线数据转成持续监控规则 | 把首屏、列表、longtask、FPS 指标转成回归阈值 | 出现超过阈值的性能恶化时可被识别并阻断 | `P0-PERF-01` | 待创建 |
| `P2-BUNDLE-01` | 构建 | 建立 bundle 变更审查模板 | 让每次体积增长都有可追踪说明 | 增加 PR 模板字段：体积变化、原因、截图、回滚方案 | 所有大体积变更 PR 都包含标准信息 | `P0-BUNDLE-01` | 待创建 |
| `P2-SEC-01` | 安全 | 建立 capability / CSP ADR 流程 | 提升高风险变更可追踪性 | 基于 `ADR-template.md` 规范 capability 与 CSP 变更记录 | 后续所有高风险安全配置调整均有 ADR | `P0-SEC-01` | 待创建 |
| `P2-SEC-02` | 安全 | 外链与嵌入 Webview 安全回归 | 降低开放链接相关风险 | 针对 `openUrl()`、嵌入 Webview、Markdown 外链做专项回归用例 | 有专项测试清单，覆盖白名单、异常链接与回退路径 | `P1-SEC-01` | 待创建 |
| `P2-SEC-03` | 安全 | 评估 Sentry 接入前脱敏规范 | 为后续监控体系做准备 | 先定义事件采样、字段脱敏、用户标识与隐私边界 | 有成文规范，接入前必须经过评审 | 无 | 待创建 |

---

## 6. 建单建议

### 6.1 第一批建议立即创建的 Issue

1. `P0-PERF-01` 建立首轮性能基线
2. `P0-BUNDLE-01` 建立 desktop / mobile 首轮 bundle 基线
3. `P0-SEC-01` 补齐生产 CSP 基线
4. `P0-SEC-02` 收敛移动端 capability
5. `P0-SEC-03` 明确 token 存储加密方案

### 6.2 建单字段模板

| 字段 | 内容 |
|---|---|
| 标题 | `[P0][安全] 补齐生产 CSP 基线` |
| 描述 | 背景、现状、目标、风险、范围外 |
| 验收标准 | 引用本文件中的“验收标准”列 |
| 附件 | trace / 截图 / 分析报告 / 配置 diff |
| 回滚方案 | 开关关闭、配置回退、版本回退 |
| 责任人 | 待指定 |
| 目标版本 | 待指定 |

---

## 7. 版本节奏建议

| 迭代 | 建议范围 |
|---|---|
| Sprint 1 | `P0-PERF-01`、`P0-BUNDLE-01`、`P0-SEC-01` |
| Sprint 2 | `P0-PERF-02`、`P0-BUNDLE-02`、`P0-SEC-02`、`P0-SEC-03` |
| Sprint 3 | `P1-PERF-01`、`P1-BUNDLE-01`、`P1-SEC-01`、`P1-SEC-02` |
| Sprint 4 | 剩余 `P1` 与首批 `P2` 治理任务 |

---

## 8. 更新规则

- 每周至少更新 1 次状态
- 任务完成后需回填 PR、测试记录、验收日期
- 如果任务拆分为多个子 Issue，保留原始父 ID，不改动编号
- 新增 backlog 时优先复用现有分类：`性能 / 构建 / 安全`
