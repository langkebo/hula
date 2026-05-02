# Matrix SDK 内存优化与泄露普查方案 (P2-PERF-02)

> 日期: 2026-04-30  
> 状态: **方案产出 / 待实施**

## 1. 现状分析

`hula` 采用了 **Matrix SDK Worker 化** 架构 ([matrixSdk.worker.ts](file:///Users/ljf/Desktop/hu_ts/hula/src/workers/matrixSdk.worker.ts))。虽然这解决了主线程阻塞问题，但带来了新的内存管理挑战：

### 1.1 潜在风险点
- **Worker 内存堆积**: Matrix SDK 会在内存中缓存大量房间状态（State Events）和时间线事件（Timeline Events）。对于加入大量房间或长会话的用户，Worker 内存可能突破 500MB。
- **闭包泄露**: 事件监听器（如 `client.on('Room.timeline', ...)`）若在房间切换或组件销毁时未正确移除，会导致旧房间对象无法被 GC 回收。
- **跨线程序列化开销**: 频繁通过 `postMessage` 传输大型同步数据（Sync Response）会产生大量临时对象，增加 GC 频率。

## 2. 普查与监控方案

### 2.1 内存基线采集
- **工具**: Chrome DevTools `Memory` 面板 -> `Allocation instrumentation on timeline`。
- **场景**: 
    1. 启动并完成首次同步。
    2. 快速切换 50 个房间。
    3. 持续接收 1000 条消息。
    4. 退出登录。
- **指标**: 观察 Worker 线程的 `Heap Used` 是否在场景 4 后回到初始水平。

### 2.2 自动化检测脚本
在 `scripts/` 下建立 `check-mem-leaks.mjs`，利用 Playwright 的 `page.evaluateHandle` 获取 JSHeapUsedSize。

## 3. 优化实施路径

### 3.1 内存上限治理 (Memory Cap)
- **事件裁剪**: 在 Worker 初始化时配置 `timelineSupport: false` (若不需要全量回溯) 或限制 `Room` 对象的 `timeline` 数组长度。
- **Lazy Loading**: 仅在用户点击房间时才从索引数据库（IndexedDB）加载该房间的历史事件，而非全部保留在 JS 堆内存中。

### 3.2 显式销毁机制
- **Worker 重启策略**: 当内存占用超过 400MB 时，触发一次平滑的 Worker 重启与状态恢复。
- **监听器审计**: 全面检查 `matrix-js-sdk` 的事件订阅点，确保每个 `on` 都有对应的 `off`。

## 4. 后续动作
- [ ] 实施 Batch 2 性能基线采集中的内存专项。
- [ ] 在 `matrixSdk.worker.ts` 中接入 `performance.memory` (Chrome 扩展) 监控。
- [ ] 建立 `RoomStore` 自动清理逻辑，LRU 回收不常用房间状态。
