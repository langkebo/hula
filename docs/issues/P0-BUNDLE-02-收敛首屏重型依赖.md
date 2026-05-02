# [P0][构建] 收敛首屏重型依赖

## 背景

初步审计发现 `hula` 首屏加载了大量非即时需要的依赖（如 `mermaid` 绘图、`three.js` 3D 渲染、`@vue-office` 办公文档预览等），导致 JS 资产超过 `1MB`。这直接拖慢了 FCP 和 LCP。

## 现状

- 当前行为：
    - `three.js` 在 `HuLaAssistant.vue` 中被静态导入，即便 Assistant 模块未被激活也会加载。
    - `mermaid` 在 `package.json` 中存在，且有独立 chunk，需确认具体调用路径。
    - `vue-office` 已实现异步加载，可作为模板参考。
- 已知风险：低端设备或弱网环境下，首屏白屏时间可能超过 3 秒。
- 影响范围：全端 Web 端加载路径。

## 目标

- 目标 1：将 `mermaid`、`three`、`@vue-office/*` 等重型依赖剥离首屏。
- 目标 2：确保 JS 初始包（Initial Bundle）体积降至 `500KB` 以下。
- 目标 3：建立基于动态导入（Dynamic Import）的按需加载机制。

## 范围

### 包含

- `matrix-js-sdk` 的分包策略。
- 媒体预览相关库的延迟加载。
- UI 组件库（Naive UI / Vant）的按需引入核查。

### 不包含

- 对业务逻辑的重构。
- 对图片/字体等媒体资产的压缩（另有任务处理）。

## 交付物

- 代码：优化后的 Vite 分包配置（`vite.config.ts`）。
- 代码：组件内异步组件（`defineAsyncComponent`）替换。
- 文档：更新 `bundle-baseline.md` 中的“重型依赖清单”。

## 执行步骤

1. 运行 `pnpm build` 并检查 `dist` 产物。
2. 使用 `rollup-plugin-visualizer` 确认首屏包含的大文件。
3. 将非首屏必须的 `import` 替换为 `await import()`。
4. 在对应的 UI 入口处添加 `Loading` 占位符。

## 验收标准

- [ ] `Initial JS Bundle` 体积在 Gzip 后小于 `500KB`。
- [ ] `mermaid` 等库仅在打开特定消息类型时才触发下载。
- [ ] 所有异步加载点均有优雅的加载状态提示。

## 风险与依赖

- 风险：动态导入可能导致首次点击功能时有微小延迟。
- 依赖：`P0-BUNDLE-01` 建立首轮 bundle 基线。

## 灰度与回滚

- 灰度方式：先优化桌面端，验证功能正常后推至移动端。
- 回滚方式：恢复 `vite.config.ts` 原始分包配置。

## 附件

- 关联文档：[`bundle-baseline.md`](file:///Users/ljf/Desktop/hu_ts/hula/docs/baseline/bundle-baseline.md)
