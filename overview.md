# 架构优化执行 — 2026-08-13

## 完成项

### P1-4: SDK 别名配置抽取为独立模块 + 自动校验脚本 ✅
- 新建 `build/config/sdk-aliases.ts`：34 条别名抽取为数据驱动的 `sdkAliasEntries` 数组 + `createSdkAliases()` 函数
- 新建 `scripts/verify-sdk-aliases.mjs`：CI 校验脚本，逐条检查别名目标路径是否存在
- **校验脚本发现并清理 5 条死别名**（notification/models barrel/credentials/message/qr-login — SDK 重构后已不存在且项目代码未引用）
- 清理后 29 条别名全部校验通过
- `package.json` 添加 `check:sdk-aliases` script
- `quality-gate.yml` 在 Boundary Checks 中添加 `pnpm check:sdk-aliases`

### P1-5: Worker 消息处理器模块化拆分 ✅
- `matrixSdk.worker.ts` 从 851 行 → 110 行薄分发层（-87%）
- 新建 4 个 handler 模块：
  - `workerState.ts`（54 行）— 共享可变状态 + initSDK + sendResponse
  - `workerSearchHandlers.ts`（392 行）— 搜索索引引擎
  - `workerClientHandlers.ts`（162 行）— 客户端生命周期
  - `workerProbeHandlers.ts`（168 行）— 服务器探测
- 删除死代码：`_pendingRequests` Map 和 `_generateId` 函数

### P2-1: enums/index.ts 按域拆分 ✅（此前已完成）
### P2-3: CI 添加 knip 死代码检测 ✅（此前已完成）

## 守门验证结果

| 命令 | 结果 |
|:---|:---|
| `vue-tsc --noEmit` | 0 errors ✅ |
| `biome check`（新文件） | clean ✅ |
| `check:file-size` | 1173 文件全部在约束内 ✅ |
| `check:ratchet` | 74/75 baseline（改善 1）✅ |
| `check:sdk-boundary` | 253 < 266 baseline ✅ |
| `check:sdk-aliases` | 29/29 通过 ✅ |

## 变更文件

| 文件 | 操作 |
|:---|:---|
| `build/config/sdk-aliases.ts` | 新建 |
| `scripts/verify-sdk-aliases.mjs` | 新建 |
| `build/config/vite.config.base.ts` | 修改（引用新模块） |
| `src/workers/workerState.ts` | 新建 |
| `src/workers/workerSearchHandlers.ts` | 新建 |
| `src/workers/workerClientHandlers.ts` | 新建 |
| `src/workers/workerProbeHandlers.ts` | 新建 |
| `src/workers/matrixSdk.worker.ts` | 重写（薄分发层） |
| `package.json` | 修改（添加 check:sdk-aliases） |
| `.github/workflows/quality-gate.yml` | 修改（添加 sdk-aliases 检查） |
| `docs/architecture-review-report.md` | 修改（更新 P1-4/P1-5/P2-1/P2-3 状态） |

## 剩余待处理项

- P1-3: 补齐 289 个无测试源文件中核心 Service 层的单元测试（10-20 人日）
- P2-2: services/ 根目录杂项服务归类（1-2 人日）
- P2-4: Storybook 覆盖率提升至核心组件 20%+（3-5 人日）
- P2-5: 评估 three.js / shiki 按需加载优化（2-3 人日）
- P2-6: 桌面/移动共享逻辑提取评估（3-5 人日）
