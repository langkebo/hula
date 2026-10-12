# 前沿版本升级观察机制（DP-08）

> 文档版本：v1.0.0
> 维护人：前端负责人
> 最后更新：2026-10-12
> 关联任务：P3-8 DP-08（`docs/TJG-保守项后续优化方案-2026-10-12.md`）
> 性质：**建立观察机制，不实际升级**

---

## 1. 目的

仓库有 6 个包处于**重大/前沿版本**（下一代主版本或新生态），生态兼容性需持续观察。本文档：

1. 登记这 6 个包的**当前版本 / 是否重大 / 上游 breaking 信号 / 本项目受影响点**；
2. 在 `renovate.json` 为这些包的**重大版本**置 `dependencyDashboardApproval`——**必须先人工审批**，不自动开 PR、不自动合并；
3. 明确**升级前必跑门禁**与联动约束。

本任务**不修改任何依赖版本**。

---

## 2. 观察清单

| 包 | 当前版本 | 是否重大 | 上游 breaking 信号（以官方 release notes 为准） | 本项目受影响点 |
| :--- | :--- | :---: | :--- | :--- |
| `typescript` | `6.0.3` | ✅ 重大（6.x） | JS 版最后一个大版本（后续 7.x 迁移至 Go 编译器）；6.x 收紧若干类型检查、移除/弃用部分旧语法与编译选项 | 全仓类型检查 `vue-tsc --noEmit`；`src/types/matrix-js-sdk-augmentations.d.ts` |
| `vue-router` | `^5.3.1` | ✅ 重大（5.x） | 主版本升级，路由 API / 类型签名可能调整 | `src/router/**` 路由定义与守卫；`useRouter` / `useRoute` 用法 |
| `vite` | `^8.2.2` | ✅ 重大（8.x） | 主版本升级，插件 API / 默认行为（HMR、构建目标、`build.target`）可能调整 | `vite.config.ts`；`@vitejs/plugin-vue`、UnoCSS、`unplugin-auto-import`、`unplugin-vue-components`；`build/`（`components.ts` / `chunks.ts` / `console.ts`） |
| `vitest` | `4.1.10` | ✅ 重大（4.x） | 主版本升级，reporters / 配置 schema / mock 行为可能调整（例：`--reporter=basic` 已在 4.x 移除） | `vitest.config`；`src/**/__tests__`；`scripts/run-vitest.js`；CI 测试作业 |
| `storybook` | `^10.6.0` | ✅ 重大（10.x） | 主版本升级，配置（`main.ts` / `preview.ts`）与 addon 生态大版本对齐 | `.storybook/**`；`src/stories/**`；`STORYBOOK_TEST=1` 组件交互测试（P2.5-6 落地） |
| `vue-tsc` | `3.3.11` | ✅ 重大（3.x） | 与 TypeScript 主版本**强联动**（vue-tsc 需匹配 TS 主版本）；类型推导行为随上游变化 | `pnpm run typecheck`；`.vue` 类型检查；与 `typescript` 升级**必须同批** |

> **口径**：上表「breaking 信号」为**类别级**描述，**具体条目以升级时对应官方 release notes / migration guide 为准**；本文档不臆造逐条变更。

### 2.1 联动约束（升级时须成组处理）

- `typescript` ↔ `vue-tsc`：**必须同批升级**，版本需互相兼容（否则 `typecheck` 直接红）。
- `vite` ↔ `vitest`：常需同步升级（共享打包/转换管线的兼容基线）。
- `storybook` ↔ `@storybook/*` addon：同一大版本线，须一并升级。
- `vite` ↔ `@vitejs/plugin-vue` / UnoCSS / `unplugin-*`：升级 `vite` 前先确认插件已支持该主版本。

---

## 3. Renovate 策略

`renovate.json` 已全局 `"automerge": false`、`"dependencyDashboard": true`。本次追加规则（`packageRules[0]`）：

```json
{
  "description": "Frontier packages: major upgrades require manual Dependency Dashboard approval (see docs/baseline/upstream-version-watch.md)",
  "matchPackageNames": ["typescript", "vue-router", "vite", "vitest", "storybook", "vue-tsc"],
  "matchUpdateTypes": ["major"],
  "dependencyDashboardApproval": true
}
```

效果：

- **重大版本**：不出 PR，仅在 Dependency Dashboard 打勾待批，**人工审批后才创建 PR**；
- **minor / patch**：沿用既有 `non-major dependencies` 分组，仍走常规流程（不自动合并）。

CI 侧已有只读依赖审计闸门（P2.5-5 SC-09：`scripts/check-dependency-audit.mjs`），与 Renovate 人工审批形成**双闸**。

---

## 4. 升级前必跑门禁

任一前沿包升级前，须在分支上跑：

| 命令 | 用途 |
| :--- | :--- |
| `pnpm check:release` | 17 判据聚合链，须 ✅ exit 0 |
| `pnpm run typecheck` | 全量类型检查，须 0 错误 |
| `pnpm test:run` | 单元测试，除既有失败外无新增失败 |
| `STORYBOOK_TEST=1 pnpm test:run` | 组件交互测试（涉及 `storybook` 时） |
| `pnpm tauri:build`（或真机 smoke） | 运行期冒烟：登录 / 收发消息 / 媒体 / 上传 |

---

## 5. 观察与升级流程

1. Renovate 在 Dependency Dashboard 列出这 6 包的重大版本 → **保持未审批**，除非已排期。
2. 升级时**按 §2.1 成组**提分支，先查对应官方 migration guide。
3. 跑 §4 全部门禁 + 真机 smoke；任一红则**回退该包**，不强行合并。
4. 升级完成后**更新本表**（当前版本列）并在提交信息注明关联门禁结果。

---

## 6. 验收对照

| 验收判据（方案原文） | 结果 |
| :--- | :--- |
| 观察文档落盘，覆盖 6 包 | ✅ §2 覆盖 `typescript` / `vue-router` / `vite` / `vitest` / `storybook` / `vue-tsc` |
| renovate 对重大版本已置人工审批 | ✅ §3 `dependencyDashboardApproval: true`（`matchUpdateTypes: ["major"]`） |
| 不实际升级版本 | ✅ 仅新增规则 + 文档；未改动 `package.json` 任何版本 |
