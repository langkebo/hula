# [P0][构建] 建立 desktop / mobile 首轮 bundle 基线

> Task ID：`P0-BUNDLE-01`  
> 优先级：`P0`  
> 建议负责人：前端负责人 / DevOps  
> 目标版本：待填写  
> 计划周期：第 1 周  
> 关联文档：[`bundle-baseline.md`](file:///Users/ljf/Desktop/hu_ts/hula/docs/baseline/bundle-baseline.md) / [`issue-backlog.md`](file:///Users/ljf/Desktop/hu_ts/hula/docs/issue-backlog.md)

## 背景

当前项目已具备 `pnpm analyze` 和 `pnpm metrics:bundle` 两类构建分析能力，但尚未形成 desktop / mobile 双端可对比的首轮 bundle 基线。现需基于 `docs/baseline/bundle-baseline.md` 建立第一版资产体积记录。

## 现状

- 当前构建主链路为 `Vite 7`
- 已存在 `pnpm build`、`pnpm analyze`、`pnpm metrics:bundle`
- `scripts/report-bundle-metrics.mjs` 已固定 `500KB` JS chunk 预警阈值
- 当前尚未沉淀最重资产和双端差异数据

## 目标

- 建立 desktop / mobile 两套真实 bundle 基线
- 识别最重 10 个资产与超过阈值的 JS 文件
- 形成首批懒加载与拆分建议

## 范围

### 包含

- desktop 构建产物采集
- mobile 构建产物采集
- `dist/bundle-metrics.json` 归档
- 可视化分析结果归档

### 不包含

- 直接实施拆包重构
- 修改功能逻辑

## 交付物

- 已填写的 `docs/baseline/bundle-baseline.md`
- `dist/bundle-metrics.json`
- 可视化分析产物
- 最重 10 个资产清单
- 超预算 JS 资产清单

## 执行步骤

1. 执行 `pnpm build`。
2. 执行 `pnpm metrics:bundle`。
3. 执行 `pnpm analyze`。
4. 归档 desktop / mobile 两套产物分析结果。
5. 填写“产物汇总”“重点 chunk 清单”“重型依赖盘点”。
6. 输出首轮构建风险结论。

## 验收标准

- [ ] `bundle-baseline.md` 中 desktop 产物已完成 1 次完整采集
- [ ] `bundle-baseline.md` 中 mobile 产物已完成 1 次完整采集
- [ ] 已识别最重 10 个资产
- [ ] 已识别超过阈值的 JS 资产
- [ ] 已输出首批懒加载或拆分建议

## 测试与验证

- 本地验证：`pnpm build` / `pnpm metrics:bundle` / `pnpm analyze`
- 人工验证：确认 desktop / mobile 数据未混填
- CI 验证：如有，补 workflow 链接

## 风险与依赖

- 风险：环境变量不一致导致产物不可比
- 风险：双端产物混填
- 依赖：构建脚本稳定可运行

## 灰度与回滚

- 灰度方式：无，此任务为基线采集
- 回滚方式：无代码回滚，必要时重新构建并重采
- 回滚触发条件：采集口径不一致或结果缺失

## 待补字段

- Issue 编号：待填写
- Owner：待填写
- Reviewer：待填写
- QA：待填写
- 起止时间：待填写
