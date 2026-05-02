# hula Bundle 基线报告

> 文档版本：v1.1.0  
> 应用版本：v3.0.9  
> 维护人：前端负责人 / DevOps  
> 最后更新：2026-04-30  
> 关联文档：[`hula优化实施方案.md`](file:///Users/ljf/Desktop/hu_ts/hula/docs/hula优化实施方案.md)

---

## 5. Bundle 预算 (Bundle Budget)

| 检查项 | 预算阈值 (Gzip) | 现状 (Batch 1) | 状态 | 备注 |
|---|---|---|---|---|
| 总 JS 体积 | < 3 MB | ~6.4 MB | ❌ | **严重超标** |
| 单个 Chunk | < 500 KB | 1.48 MB | ❌ | shiki-core 导致 |
| CSS 体积 | < 500 KB | 待采集 | ⚪ | |
| 图片/资产 | < 1 MB | 待采集 | ⚪ | |

> 注意：PR 合入时若导致体积增长超过 50KB，必须通过 Security/Perf Review。

## 1. 文档目的

用于记录当前构建产物体积、chunk 分布、重型依赖占比和预算阈值，作为构建治理与首屏优化的统一基线。

本文件当前为“第一版初始内容模板”，已预填以下已确认事实：

- 当前应用版本为 `3.0.9`
- 当前构建主链路为 `Vite 7`
- 项目存在 `pnpm analyze` 与 `pnpm metrics:bundle` 两类产物分析脚本
- `scripts/report-bundle-metrics.mjs` 已固定 `500KB` 的 JS chunk 预警阈值
- 当前根配置 [`vite.config.ts`](file:///Users/ljf/Desktop/hu_ts/hula/vite.config.ts) 已切换为“桌面 / 移动配置分流 + mergeConfig 注入”

本文件不伪造真实产物数据，所有体积数据位统一保留为 `待采集`。

---

## 2. 采集命令

```bash
pnpm build
pnpm analyze
pnpm metrics:bundle
```

### 2.1 桌面端 (Desktop) JS 资产概览

| Chunk 名 | 文件大小 (Minified) | Gzip 大小 | 备注 |
|---|---|---|---|
| `shiki-core` | 8.17 MB | 1.48 MB | **极高**，代码高亮核心 |
| `vue-office-pdf` | 2.79 MB | 739 KB | **高**，PDF 预览 |
| `vue-office-excel` | 1.69 MB | 502 KB | **高**，Excel 预览 |
| `vue-office-pptx` | 1.34 MB | 428 KB | PPTX 预览 |
| `shiki-themes` | 1.31 MB | 163 KB | 代码高亮主题 |
| `mermaid-deps` | 1.27 MB | 360 KB | Mermaid 依赖 |
| `msg-input` | 1.24 MB | 302 KB | **核心**，消息输入框组件 |
| `mermaid` | 1.06 MB | 285 KB | Mermaid 核心 |
| `vendor` | 944 KB | 291 KB | 基础依赖库 |
| `naive-ui` | 930 KB | 242 KB | UI 组件库 |
| `three` | 788 KB | 204 KB | 3D 引擎 |
| `hula-emojis` | 640 KB | 159 KB | 表情包资产 |
| `markdown-vendor`| 398 KB | 134 KB | Markdown 渲染 |

### 2.2 预警名单 (Heavy Hitters)

根据 2026-04-30 采集的真实构建数据，以下重型依赖已被确认为“体积大户”：

| 依赖名 | 现状大小 | 建议动作 |
|---|---|---|
| `shiki` | ~9.5 MB (Core+Themes) | **优先级：极高**。需确认为何全量打包，应转为 CDN 加载或 Web Worker 异步加载。 |
| `vue-office` | ~7.1 MB (Total) | **优先级：高**。虽已异步，但各格式包体积巨大，需评估是否仅保留常用格式。 |
| `msg-input` | 1.24 MB | **优先级：高**。核心组件体积过大，需审计内部引用的重型库（如编辑器、表情包）。 |
| `mermaid` | ~2.3 MB (Core+Deps) | **优先级：中**。需确认是否仅在预览时加载。 |
| `three` | 788 KB | **优先级：中**。已重构为动态导入。 |

---

---

## 3. 构建环境

| 项目 | 值 |
|---|---|
| 分支 | 当前工作分支 |
| Commit SHA | `5eefb7de` |
| Node 版本 | `v22.22.2` |
| PNPM 版本 | `10.33.0` |
| 构建模式 | `production` |
| 平台 | `desktop` |

### 3.1 建议首轮采集批次

| 批次 | 目标 | 状态 |
|---|---|---|
| Batch 1 | 当前桌面构建产物基线 | 已执行 |
| Batch 2 | 当前移动构建产物基线 | 待执行 |
| Batch 3 | 首轮优化后对比复测 | 待执行 |

### 3.2 记录规范

- 所有采集结果必须带 `日期 + 平台 + commit SHA`
- 桌面与移动端产物不得混填
- 如果产物受环境变量影响，必须在本节补充完整构建参数

---

## 4. 产物汇总

| 指标 | 当前值 | 目标值 |
|---|---|---|
| 总 JS gzip | 待采集 | `< 3MB` |
| 首屏主包 gzip | 待采集 | `< 500KB` |
| 最大单 chunk gzip | 待采集 | `< 300KB` |
| CSS 总体积 gzip | 待采集 | 持续下降 |
| 静态资源总量 | 待采集 | 持续下降 |

### 4.1 首轮记录表

| 平台 | 总 JS gzip | 最大单 chunk | CSS gzip | 资源总量 | 备注 |
|---|---|---|---|---|---|
| desktop | ~6.4 MB | 1.48 MB (shiki-core) | 待采集 | 待采集 | 基于 2026-04-30 pnpm build 数据初步测算 |
| mobile | 待采集 | 待采集 | 待采集 | 待采集 | 待填写 |
| web-dev | 待采集 | 待采集 | 待采集 | 待采集 | 可选 |

### 4.2 本轮自动化汇总

基于 `pnpm metrics:bundle`：

- 产物文件数：`714`
- JS 文件数：`400`
- CSS 文件数：`152`
- 总包体积：`54.29MB`
- 超过 `500KB` 的 JS 文件数：`12`
- 指标文件：[bundle-metrics.json](file:///Users/ljf/Desktop/hu_ts/hula/dist/bundle-metrics.json)

---

## 5. 重点 chunk 清单

| Chunk 名称 | 原始大小 | gzip 大小 | 主要内容 | 是否首屏必需 | 处理建议 |
|---|---|---|---|---|---|
| 待采集 | 待采集 | 待采集 | 待采集 | 是 / 否 | 保留 / 懒加载 / 拆分 |

### 5.1 建议至少关注的 chunk 类型

- 首屏入口 chunk
- Matrix 相关核心 chunk
- UI 库 chunk
- 富媒体 / 文档预览 chunk
- AI / 插件相关 chunk
- 管理后台相关 chunk

### 5.2 资源分布策略

- **分包机制**: 采用 `build/config/chunks.ts` 中的 `manualChunkConfig` 进行显式分包。
- **分流逻辑**: `vite.config.ts` 根据 `TAURI_ENV_PLATFORM` 自动切换桌面版（Naive UI）或移动版（Vant）配置。
- **公共 Chunk**: `vue-core` (vue, pinia, router), `tauri-sdk`, `matrix-sdk` 等被强制隔离为独立 JS。
- **重型资产**: `mermaid`、`three`、`vue-office` 均已配置为独立 chunk，但需核实是否在入口处被静态 import 导致首屏同步下载。

---

## 6. 重型依赖盘点

| 依赖 | 体积影响 | 当前加载方式 | 建议 |
|---|---|---|---|
| `matrix-js-sdk` | 待采集 | 待采集 | 优化导入边界 |
| `mermaid` | 待采集 | 待采集 | 懒加载 |
| `three` | 待采集 | 待采集 | 路由级隔离 |
| `@vue-office/*` | 待采集 | 待采集 | 按需加载 |
| `naive-ui` | 待采集 | 待采集 | 检查按需策略 |
| `vant` | 待采集 | 待采集 | 与移动构建解耦 |

### 6.1 当前已知重型风险点

基于实施方案和依赖结构，首轮采集前已知需要重点观察：

1. `matrix-js-sdk` 相关 chunk 是否过大
2. `mermaid`、`three`、`@vue-office/*` 是否进入了首屏或高频路径
3. 桌面端与移动端是否因为共用配置而引入额外体积
4. UI 双库并存是否带来不必要的共同打包成本

---

## 7. 预算阈值

### 7.1 当前预算

| 指标 | 阈值 |
|---|---|
| 首屏关键 JS gzip | `< 500KB` |
| 单 chunk gzip | `< 300KB` |
| 全量 JS gzip | `< 3MB` |
| 新依赖引入主包增量 | `< 50KB` |

### 7.2 已确认的脚本阈值

`scripts/report-bundle-metrics.mjs` 当前内置阈值：

| 指标 | 当前脚本阈值 |
|---|---|
| JS chunk 预警阈值 | `500KB` |
| 超大 JS 文件额外预警 | `1MB` |

### 7.3 超预算处理策略

- 首次超预算：CI 告警
- 连续超预算：进入阻塞门禁
- 紧急业务放行：需记录原因、责任人和回补时间

---

## 8. 当前已知风险点

1. 当前根配置虽已分流到桌面/移动，但仍需实测确认产物是否真正解耦
2. 项目同时存在 `Naive UI` 与 `Vant`，需确认双端是否出现交叉打包
3. 富媒体和文档预览类依赖可能在非必要路径上被提前加载
4. 现有 `bundle-metrics` 输出的是产物体积摘要，不直接提供 gzip 细粒度首屏入口拆解，需要结合 `analyze` 结果一起看

---

## 9. 首轮优化建议

1. 先跑出 desktop / mobile 两套真实基线，确认最重 chunk 和双端共享成本
2. 优先处理重型依赖的懒加载边界，而不是先做细碎拆包
3. 对超过脚本阈值 `500KB` 的 JS 文件单独建卡追踪

### 9.1 首轮行动项

- [ ] 生成 `dist/bundle-metrics.json`
- [ ] 归档 `analyze` 可视化结果
- [ ] 填写“重点 chunk 清单”
- [ ] 输出首轮最重 10 个资产列表
- [ ] 确认首批需要懒加载的依赖

---

## 10. 附件

- `stats.html`：待采集
- `metrics:bundle` 输出：待采集
- `dist/bundle-metrics.json`：待采集
- 构建日志：待采集
- commit SHA：待采集
- 基线执行人：待填写

### 10.1 建议命名规范

- `bundle-metrics-<platform>-<date>-<sha>.json`
- `bundle-analyze-<platform>-<date>-<sha>.html`
- `bundle-log-<platform>-<date>-<sha>.txt`

### 10.2 首轮完成定义

满足以下条件即可视为“第一版 bundle 基线已建立”：

- [ ] desktop 产物已完成 1 次完整采集
- [ ] mobile 产物已完成 1 次完整采集
- [ ] 已识别最重 10 个资产
- [ ] 已识别超过阈值的 JS 资产
- [ ] 已输出首批懒加载或拆分建议
