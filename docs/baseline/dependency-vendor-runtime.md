# Vendored-SDK 运行期依赖绑定基线

> 文档版本：v1.0.0
> 维护人：前端负责人
> 最后更新：2026-10-12
> 关联守卫：`scripts/check-vendor-runtime-deps.mjs`（`pnpm check:vendor-runtime-deps`）
> 关联事故：2026-08-09 登录页白屏（`does not provide an export named 'EventEmitter'`）

---

## 1. 文档目的

固化 6 个**看似无直接引用、实为运行期必需**的依赖与 `optimizeDeps.include` 之间的绑定关系，
防止后续依赖清理（depcheck / knip / 人工「零引用即删除」）误删后再次触发登录页白屏。

依赖审查报告 DP-01 曾把这 6 包判为「零直接引用 → 疑似可删」，运行期证据表明结论相反：
它们是 vendored `matrix-js-sdk`（tarball 模式）源码的**值导入**目标，必须保留。

---

## 2. 为什么必须保留

`matrix-js-sdk` 以本地 tarball（`vendor/matrix-js-sdk.tgz`）形式 vendored，SDK 源码位于
`node_modules` 内。Vite 对其走 alias 直编译（`optimizeDeps.exclude` 中列了 `matrix-js-sdk`），
但 SDK 源码会**值导入**下列 CJS 小包：

| 包 | 导入方（SDK 内部） | 性质 |
|---|---|---|
| `events` | `typed-event-emitter.ts`：`import { EventEmitter }` | Node builtin 的 polyfill |
| `loglevel` | SDK 日志模块 | CJS |
| `content-type` | SDK HTTP 层 | CJS |
| `matrix-events-sdk` | 事件类型常量 | CJS |
| `matrix-widget-api` | Widget 通信 | CJS |
| `sdp-transform` | VoIP SDP 处理 | CJS |

tarball 模式下 SDK 位于 `node_modules` 内，Vite **不会**对 excluded 包的 CJS 依赖做运行时
发现优化。若不预打包，这些包会以裸 CJS 直发浏览器，报
`does not provide an export named 'EventEmitter'`，导致登录页白屏（2026-08-09 事故）。

因此每包必须同时存在于**两处**：

1. `package.json` `dependencies` —— 保证从项目根可解析；
2. `build/config/vite.config.base.ts` `optimizeDeps.include` —— 保证 Vite 预打包成 ESM。

**任缺其一即复现白屏**，故守卫对「两处」都做校验。

---

## 3. 冻结清单

| 包 | package.json 版本 | 在 `optimizeDeps.include` |
|---|---|---|
| `content-type` | `^1.0.5` | 是 |
| `events` | `^3.3.0` | 是 |
| `loglevel` | `^1.9.2` | 是 |
| `matrix-events-sdk` | `0.0.1` | 是 |
| `matrix-widget-api` | `^1.19.0` | 是 |
| `sdp-transform` | `^3.0.0` | 是 |

> 版本以 `package.json` 实际值为准；本表仅为基线快照，守卫校验的是「存在性」而非版本号。

---

## 4. 守卫与门禁

```bash
pnpm check:vendor-runtime-deps          # 只读守卫，exit 0/1/2
node scripts/check-vendor-runtime-deps.mjs --json   # 机器可读报告
```

守卫判定：

- 6 包任一不在 `package.json` `dependencies` → 失败（`missingFromDependencies`）；
- 6 包任一不在 `optimizeDeps.include` → 失败（`missingFromOptimizeDeps`）。

该守卫已并入 `pnpm check:release` 聚合链，`knip.config.ts` 的 `ignoreDependencies`
注释亦指向本文件。

---

## 5. 维护规则

- **禁止**直接删除这 6 包中的任何一项，除非同时完成：升级/替换 SDK 源码导入方式、
  跑通登录页 + VoIP + Widget 全链路回归、并在本文件记录变更依据。
- 若新增 SDK 值导入的 CJS 依赖，需同步加入 `check-vendor-runtime-deps.mjs` 的
  `VENDOR_RUNTIME_DEPS`、`optimizeDeps.include` 与本文档清单。
- `knip` 报这 6 包为 unused 属预期，已通过 `ignoreDependencies` 白名单化，非真实死依赖。

---

## 6. 关联

- 事故注释：`build/config/vite.config.base.ts`（`optimizeDeps.include` 上方）
- 忽略基线：`knip.config.ts`（`ignoreDependencies`）
- 守卫单测：`tests/lint/check-vendor-runtime-deps.test.ts`
