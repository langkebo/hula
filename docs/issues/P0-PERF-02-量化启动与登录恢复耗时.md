# [P0][性能] 量化启动与登录恢复耗时

## 背景

在 `hula` 的桌面端和移动端，从点击图标启动到用户看到主工作区并能进行交互（可交互时间 TTI），涉及 Tauri 容器启动、前端资源挂载、SDK 状态恢复及消息增量同步。目前缺乏细分阶段的耗时统计，无法定位启动慢的瓶颈点。

## 现状

- 当前行为：仅有粗略的加载进度条，无阶段性埋点。
- 已知风险：若登录恢复时间过长，用户可能认为程序挂死，导致流失。
- 影响范围：全端（Desktop / Mobile）。

## 目标

- 目标 1：在启动链路增加关键分段埋点。
- 目标 2：量化容器启动、前端挂载、登录恢复、主工作区渲染四个阶段的耗时。
- 目标 3：输出首份启动性能分析报告，识别长耗时节点。

## 范围

### 包含

- `main.rs` 中的 Tauri 准备耗时。
- `App.vue` / `main.ts` 中的前端挂载耗时。
- `matrix-js-sdk` 登录恢复（Stored Session）耗时。
- 首个房间列表渲染完成耗时。

### 不包含

- 完整消息同步（Sync）的持续耗时。
- VoIP/媒体资源的预加载耗时。

## 交付物

- 文档：启动性能链路分段说明（纳入 `performance-baseline.md`）。
- 代码：启动链路埋点 PR（Vue 侧与 Rust 侧）。
- 附件：DevTools Performance 面板 trace 文件（包含 User Timing 标记）。

## 执行步骤

1. 在 `main.ts` 头部插入 `performance.mark('hula-app-init')`。
2. 在 Tauri 插件加载点和窗口显示点注入埋点。
3. 在 `useAuthStore` 登录恢复逻辑前后记录耗时。
4. 使用 `pnpm build` 后运行程序，通过日志或性能看板采集 10 次启动数据取平均值。

## 验收标准

- [ ] `performance-baseline.md` 中“启动性能”章节已填充真实数据。
- [ ] 埋点代码已合入主分支，且不影响生产环境稳定性。
- [ ] 识别出耗时占比超过 30% 的具体阶段。

## 风险与依赖

- 风险：埋点本身若同步执行过多，可能微弱拖慢启动速度。
- 依赖：`P0-PERF-01` 建立首轮性能基线。

## 灰度与回滚

- 灰度方式：先在桌面端 dev 版本启用，验证后推至移动端。
- 回滚方式：通过 Feature Flag 禁用性能埋点，或回滚代码。

## 附件

- 参考文档：[Web Vitals User Timings API](https://web.dev/user-timings/)
- 关联文档：[`performance-baseline.md`](file:///Users/ljf/Desktop/hu_ts/hula/docs/baseline/performance-baseline.md)
