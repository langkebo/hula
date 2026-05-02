# [P1][性能] 梳理主线程重计算路径

## 背景

初步性能监控显示，在消息同步和富文本处理期间，主线程存在频繁的 Long Task。由于 `hula` 目前大部分逻辑运行在主线程，复杂的正则解析、Markdown 渲染、AI 内容预览可能导致 UI 卡顿。

## 现状

- 当前行为：所有解析逻辑同步执行。
- 已知风险：用户输入文字时可能因为后台同步解析导致字符上屏延迟。
- 影响范围：交互响应速度（INP 指标）。

## 目标

- 目标 1：识别耗时超过 50ms 的同步计算函数。
- 目标 2：评估将富文本解析、代码高亮、AI 渲染搬移至 Web Worker 的可行性。
- 目标 3：优化 Reactivity 依赖链，减少不必要的 Vue 响应式触发。

## 范围

### 包含

- Markdown / HTML 解析链路。
- 消息搜索（本地）匹配逻辑。
- 复杂列表 Item 的 `computed` 属性审计。

### 不包含

- Rust 侧的同步逻辑（已有 FFI 边界处理）。

## 交付物

- 文档：主线程热点函数清单。
- 文档：Web Worker 迁移方案设计稿。
- 代码：针对 INP 优化的关键路径重构。

## 执行步骤

1. 使用 Chrome DevTools 的 `Bottom-Up` 和 `Call Tree` 视图查找热点。
2. 重点排查 `v-html` 关联的清洗逻辑 `DOMPurify` 耗时。
3. 对比迁移到 Worker 前后的 TBT（Total Blocking Time）变化。

## 验收标准

- [ ] 主线程 Long Task 数量在标准操作流程下减少 50%。
- [ ] INP（Interaction to Next Paint）指标维持在 200ms 以内。
- [ ] 产出可落地的 Web Worker 引入规范。

## 风险与依赖

- 风险：Worker 通信开销（Structured Clone）可能抵消部分优化效果。
- 依赖：`P0-PERF-01` 建立首轮性能基线。

## 灰度与回滚

- 灰度方式：先对“搜索匹配”或“代码块高亮”启用 Worker，验证后扩展。
- 回滚方式：保留同步实现的开关，通过配置切换。

## 附件

- 关联文档：[`performance-baseline.md`](file:///Users/ljf/Desktop/hu_ts/hula/docs/baseline/performance-baseline.md)
