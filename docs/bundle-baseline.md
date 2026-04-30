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
- 总产物数: `771`
- JS 文件数: `459`
- CSS 文件数: `149`
- 其他静态资源数: `163`
- 总包体积: `53.78MB`
- JS 总体积: `25.05MB`
- CSS 总体积: `1.98MB`
- 超过 `500KB` 的 JS chunk 数: `12`
- 超过 `1MB` 的 JS chunk 数: `7`

## Top 10 产物

| 文件 | 类型 | 体积 |
| --- | --- | --- |
| `dist/static/js/shiki-core-C_DB_pIM.js` | js | `7.79MB` |
| `dist/static/wasm/matrix_sdk_crypto_wasm_bg-DDJzNWwu.wasm` | other | `5.32MB` |
| `dist/stats.html` | other | `3.73MB` |
| `dist/static/woff2/AlimamaFangYuanTiVF-Thin-X60-vObe.woff2` | other | `2.78MB` |
| `dist/static/js/vue-office-pdf-chfcJR4C.js` | js | `2.67MB` |
| `dist/static/woff2/PingFang-Medium-CKZ1cDZQ.woff2` | other | `2.53MB` |
| `dist/static/js/vue-office-excel-CN2csEXv.js` | js | `1.62MB` |
| `dist/static/js/vue-office-pptx-DS2ySCci.js` | js | `1.28MB` |
| `dist/static/js/shiki-themes-D1Sd9QxQ.js` | js | `1.26MB` |
| `dist/static/js/mermaid-deps-DjnKcdlx.js` | js | `1.21MB` |

## 超阈值 JS Chunk

| 文件 | 体积 |
| --- | --- |
| `dist/static/js/shiki-core-C_DB_pIM.js` | `7.79MB` |
| `dist/static/js/vue-office-pdf-chfcJR4C.js` | `2.67MB` |
| `dist/static/js/vue-office-excel-CN2csEXv.js` | `1.62MB` |
| `dist/static/js/vue-office-pptx-DS2ySCci.js` | `1.28MB` |
| `dist/static/js/shiki-themes-D1Sd9QxQ.js` | `1.26MB` |
| `dist/static/js/mermaid-deps-DjnKcdlx.js` | `1.21MB` |
| `dist/static/js/mermaid-DOeKo_Nf.js` | `1.01MB` |
| `dist/static/js/index-C1LlaQcG.js` | `0.98MB` |
| `dist/static/js/naive-ui-NGnPOq2k.js` | `0.89MB` |
| `dist/static/js/vendor-CMXiwpBo.js` | `0.84MB` |
| `dist/static/js/hula-emojis-BxqH7FLn.js` | `0.61MB` |
| `dist/static/js/three-CnGsQFrf.js` | `0.60MB` |

## 当前观察

- `shiki`、`vue-office-*`、`mermaid` 仍是最主要的大体积来源，但已全部通过 `manualChunks` 和 `defineAsyncComponent` 实现隔离与按需加载。
- 路由主 chunk 和聊天域核心逻辑已显著收敛。
- 进一步执行了“去 Barrel”优化，核心 Matrix 服务（如 `MatrixAccountService`, `MatrixMediaService`）已实现精确导入，减少了不必要的代码关联。
- `naive-ui` (0.89MB) 和 `vendor` (0.84MB) 已独立，虽然体积仍超过 500KB，但不会阻塞首屏核心逻辑。
- `three` (0.60MB) 仅在 3D 助手启用时加载。

## 后续优化建议

- 优先拆分 `shiki` 与 `vue-office-*` 的按需加载路径。
- 评估 `mermaid` 及其依赖是否可以仅在需要的页面懒加载。
- 继续压缩聊天域共享 chunk，并评估 `naive-ui`、`vendor`、`hula-emojis` 的更细粒度按需加载。
