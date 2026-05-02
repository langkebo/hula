# hula 主线程优化与 Web Worker 迁移建议 (P1-PERF-02)

> 日期: 2026-04-30  
> 状态: **分析完成 / 待实施**

## 1. 现状分析

通过对项目源码及 Bundle 审计，发现以下逻辑目前同步执行在主线程，存在阻塞 UI 的风险：

### 1.1 重型计算项
- **Markdown 解析与渲染**: 使用 `markstream-vue` 和 `shiki` 进行实时解析和语法高亮。
- **富文本清洗**: `DOMPurify.sanitize` 在消息渲染时同步执行。
- **消息片段拆分**: `Text.vue` 中的 `fragments` 计算属性，包含复杂的正则匹配和字符串截取。

### 1.2 性能风险点
- **INP (交互延迟)**: 在接收大量消息或滚动长列表时，主线程被解析逻辑占据，导致输入响应迟钝。
- **TBT (总阻塞时间)**: 首屏加载时，重型库的初始化（如 `shiki` 加载 WASM 和语言包）会导致长达数秒的 Long Task。

## 2. 优化方案：Web Worker 迁移

建议建立一个 **Render Worker**，将非 UI 相关的计算逻辑全量下放。

### 2.1 迁移优先级
| 优先级 | 任务 | 说明 |
|---|---|---|
| **P0** | `shiki` 异步化 | 将 `shiki` 的核心引擎和语言包加载移出主加载路径，仅在 Worker 中使用。 |
| **P1** | `DOMPurify` 异步化 | 已经存在 `computeTasks.ts` 中的 `sanitize-html` 任务，应全面接入。 |
| **P2** | Markdown 预解析 | 将 `markstream-vue` 的解析阶段移至 Worker，主线程仅负责渲染最终的 VNode 或 HTML。 |

### 2.2 架构设计
1. **Worker Registry**: 扩展现有的 `src/workers/workerRegistry.ts`。
2. **Offload Component**: 创建一个 `OffloadRenderer.vue` 包装组件，自动处理与 Worker 的通信。
3. **Serialization**: 使用 `SharedArrayBuffer` (需开启跨域隔离) 或 `Transferable Objects` 优化大数据传输。

## 3. 预期收益
- **INP 优化**: 交互响应时间预计降低 40% 以上。
- **主线程 Long Task**: 减少 60% 的 50ms+ 长任务。
- **首屏 LCP**: 通过延迟加载重型渲染库，LCP 指标可提前 500ms+。

## 4. 后续动作
- [ ] 在 `src/workers/computeTasks.ts` 中新增 `highlight-code` 任务。
- [ ] 调研 `shiki` 在 Worker 中的最佳实践（参考 `@shikijs/monaco` 的实现）。
- [ ] 压力测试：模拟 100 条代码块消息同时渲染时的卡顿情况。
