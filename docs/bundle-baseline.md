# Bundle Baseline

最后更新: `2026-04-30`

## 执行命令

```bash
pnpm build
pnpm metrics:bundle
```

## 当前基线

- 构建产物目录: `dist/`
- 统计文件: `dist/stats.html`
- 基线 JSON: `dist/bundle-metrics.json`
- chunk 告警阈值: `500KB`
- 总产物数: `703`
- JS 文件数: `395`
- CSS 文件数: `146`
- 其他静态资源数: `162`
- 总包体积: `53.78MB`
- JS 总体积: `25.04MB`
- CSS 总体积: `1.98MB`
- 超过 `500KB` 的 JS chunk 数: `12`
- 超过 `1MB` 的 JS chunk 数: `9`

## Top 10 产物

| 文件 | 类型 | 体积 |
| --- | --- | --- |
| `dist/static/js/shiki-core-BXyY9Kom.js` | js | `7.79MB` |
| `dist/static/wasm/matrix_sdk_crypto_wasm_bg-DDJzNWwu.wasm` | other | `5.32MB` |
| `dist/stats.html` | other | `3.75MB` |
| `dist/static/woff2/AlimamaFangYuanTiVF-Thin-X60-vObe.woff2` | other | `2.78MB` |
| `dist/static/js/vue-office-pdf-3kjt0-LH.js` | js | `2.67MB` |
| `dist/static/woff2/PingFang-Medium-CKZ1cDZQ.woff2` | other | `2.53MB` |
| `dist/static/js/vue-office-excel-zncmsiig.js` | js | `1.62MB` |
| `dist/static/js/vendor-CodwuR9i.js` | js | `1.35MB` |
| `dist/static/js/router-TiJrEaas.js` | js | `1.30MB` |
| `dist/static/js/vue-office-pptx-DFBpdi9k.js` | js | `1.28MB` |

## 超阈值 JS Chunk

| 文件 | 体积 |
| --- | --- |
| `dist/static/js/shiki-core-BXyY9Kom.js` | `7.79MB` |
| `dist/static/js/vue-office-pdf-3kjt0-LH.js` | `2.67MB` |
| `dist/static/js/vue-office-excel-zncmsiig.js` | `1.62MB` |
| `dist/static/js/vendor-CodwuR9i.js` | `1.35MB` |
| `dist/static/js/router-TiJrEaas.js` | `1.30MB` |
| `dist/static/js/vue-office-pptx-DFBpdi9k.js` | `1.28MB` |
| `dist/static/js/shiki-themes-D1Sd9QxQ.js` | `1.26MB` |
| `dist/static/js/mermaid-deps-6ysL2g-z.js` | `1.21MB` |
| `dist/static/js/mermaid-CmNOO15l.js` | `1.01MB` |
| `dist/static/js/naive-ui-BvNYvi3b.js` | `0.89MB` |
| `dist/static/js/hula-emojis-BxqH7FLn.js` | `0.61MB` |
| `dist/static/js/three--BpkA5ep.js` | `0.60MB` |

## 当前观察

- `shiki`、`vue-office-*`、`mermaid` 仍是最主要的大体积来源。
- `naive-ui` 与 `vendor` 主 chunk 仍偏大，后续可继续细化 `manualChunks`。
- `stats.html` 已保留用于可视化分析，`bundle-metrics.json` 可直接作为 CI artifact。

## 后续优化建议

- 优先拆分 `shiki` 与 `vue-office-*` 的按需加载路径。
- 评估 `mermaid` 及其依赖是否可以仅在需要的页面懒加载。
- 继续压缩路由聚合 chunk，避免 `router` 和 `vendor` 继续增长。
