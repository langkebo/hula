# [P0][性能] 建立首轮性能基线

> Task ID：`P0-PERF-01`  
> 优先级：`P0`  
> 建议负责人：前端负责人 / QA  
> 目标版本：待填写  
> 计划周期：第 1 周  
> 关联文档：[`performance-baseline.md`](file:///Users/ljf/Desktop/hu_ts/hula/docs/baseline/performance-baseline.md) / [`issue-backlog.md`](file:///Users/ljf/Desktop/hu_ts/hula/docs/issue-backlog.md)

## 背景

当前优化方案已明确“先测量，后优化”，但项目尚未形成统一、可追踪、可复测的首轮性能基线数据。现需基于 `docs/baseline/performance-baseline.md` 完成第一轮基线采集，为后续首屏优化、列表优化和 Worker 化提供依据。

## 现状

- 当前已接入 `WebVitalsObserver`
- 已可采集 `FCP / LCP / INP / CLS / TTFB / longtask`
- 已有 `pnpm check`、`pnpm test:run`、`pnpm test:e2e`、`pnpm metrics:bundle`
- `performance-baseline.md` 仍以 `待采集` 为主

## 目标

- 建立开发态与类生产态的首轮性能基线
- 固化首屏、列表、滚动、登录恢复的首轮数据
- 为后续优化任务提供统一对比口径

## 范围

### 包含

- `desktop-dev-macos`
- `web-dev-chrome`
- `desktop-prod-like`
- Web-Vitals、trace、录屏、日志归档

### 不包含

- 直接进行性能重构
- 改动业务逻辑

## 交付物

- 已填写的 `docs/baseline/performance-baseline.md`
- 首轮 trace 文件
- 首轮录屏
- Web-Vitals 结果表
- 首轮瓶颈结论

## 执行步骤

1. 按文档要求准备 3 组环境。
2. 执行 `pnpm check`、`pnpm test:run`、`pnpm test:e2e`。
3. 运行 `pnpm dev`、`pnpm tauri:dev` 完成基线采样。
4. 填写 Web-Vitals、典型场景 A/B/C/D 记录表。
5. 归档 trace、录屏、日志与 commit SHA。
6. 输出首轮瓶颈总结。

## 验收标准

- [ ] `performance-baseline.md` 至少完成 2 个环境 ID 的首轮数据填写
- [ ] Web-Vitals 表已填充
- [ ] 场景 A/B/C 至少完成 1 轮记录
- [ ] 已输出首轮性能瓶颈结论

## 测试与验证

- 本地验证：`pnpm check` / `pnpm test:run` / `pnpm test:e2e`
- 人工验证：记录采集环境、样本数、录屏、trace
- CI 验证：如有，补 workflow 链接

## 风险与依赖

- 风险：环境不稳定导致数据不可比
- 风险：开发态与类生产态混填
- 依赖：本地 Matrix 服务可用

## 灰度与回滚

- 灰度方式：无，此任务为基线采集
- 回滚方式：无代码回滚，仅需重新采样并替换错误数据
- 回滚触发条件：采集方法不一致或样本失真

## 待补字段

- Issue 编号：待填写
- Owner：待填写
- Reviewer：待填写
- QA：待填写
- 起止时间：待填写
