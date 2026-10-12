# overrides 跨版本覆盖项回归清单

> 文档版本：v1.0.0
> 维护人：前端负责人
> 最后更新：2026-10-12
> 事实源：`pnpm-workspace.yaml`（`overrides` 段，pnpm 12 唯一读取位置）
> 关联任务：DP-02 / P2.5-3

---

## 1. 文档目的

`pnpm-workspace.yaml` 的 `overrides` 把若干传递依赖钉到修复后的版本，其中部分为**跨大版本**覆盖
（如 `uuid` `13.x → 14.x`）。跨大版本覆盖有引入 API 破坏的风险，故登记每条覆盖的来源、
原因与回归点，形成可复查的「回归清单」。

本文件为**只读记录**，不修改 `overrides`。

---

## 2. 覆盖项总表（6 条）

| 覆盖项 | 版本规则 | 解析版本（取证） | 传递来源 | 覆盖原因 | 风险 | 类型 |
|---|---|---|---|---|---|---|
| `uuid@<14.0.0` | `>=14.0.0` | `14.0.1` | `@langkebo/matrix-js-sdk` | 大版本安全/兼容修复 | **跨大版本** | 运行期 |
| `nanoid@<3.3.17` | `^3.3.17` | `3.3.18` | `postcss` → `@vue/compiler-sfc` 链 | 安全修复 | 同大版本，低 | 构建期 |
| `brace-expansion@>=4.0.0 <5.0.9` | `^5.0.9` | `5.0.9` | `minimatch@10` → `ts-morph` / `js-beautify` | 安全修复 | 跨大版本，低（dev 链） | dev |
| `js-yaml@>=4.0.0 <4.3.1` | `^4.3.1` | `4.3.1` | `cosmiconfig`（commitlint 链） | 安全修复 | 同大版本，低 | dev |
| `conventional-commits-parser@<7.1.3` | `^7.1.3` | `7.1.3` | `@commitlint/parse` 等 | 满足 `@conventional-changelog/git-client` peer `^7.1.3` | dev | dev |
| `conventional-changelog-conventionalcommits` | `8.0.0` | `8.0.0` | `@commitlint/config-conventional`、`@release-it/conventional-changelog` | 固定发布链路格式器 | dev | dev |

> 解析版本取 2026-10-12 `pnpm why <pkg>` 实测值；`brace-expansion@1.1.18`（`minimatch@3` 链）
> 不在覆盖范围（规则仅命中 `>=4.0.0 <5.0.9`），属预期未覆盖。

---

## 3. 逐条取证与回归点

### 3.1 `uuid`（跨大版本，唯一运行期风险项）

**来源**：`pnpm why uuid` → 仅 `@langkebo/matrix-js-sdk`（经 `tjg` 直接依赖）消费，解析到 `uuid@14.0.1`。

```
uuid@14.0.1
└─┬ @langkebo/matrix-js-sdk@40.2.0-langkebo.6
  └── tjg@3.0.10 (dependencies)
```

**消费方排查**：本项目源码**无**直接 `import { v4 } from 'uuid' / import ... 'uuid'`（全仓
`['"]uuid['"]` 搜索 0 命中）。UUID 生成统一走自研兼容层 `src/utils/webCompat.ts` 的
`safeRandomUUID()`（优先原生 `crypto.randomUUID`，否则 `crypto.getRandomValues` 手搓 RFC 4122 v4），
不依赖 `uuid` 包。故 v14 的导出形态变化对业务代码无直接影响，风险集中在 SDK 内部。

**回归点**：
- 登录令牌 / 会话 ID 生成路径（SDK 内部 `uuid` 调用）；
- 消息 ID（`$...`）/ 事务 ID 生成；
- 关键用例：登录 → 发消息 → 重连后 room 列表恢复。

**回归命令**：`pnpm why uuid` + `pnpm test:run`（auth/messaging 相关套件）。

### 3.2 `nanoid`

**来源**：`postcss` → `@vue/compiler-sfc` → Vue 编译链，解析 `3.3.18`（同大版本 3.x）。
**回归点**：Vue SFC 编译、样式生成路径（构建期）。
**回归命令**：`pnpm why nanoid` + `pnpm build`（或 `pnpm metrics:bundle` 触发构建）。

### 3.3 `brace-expansion`

**来源**：`minimatch@10` → `ts-morph` / `js-beautify`（dev 链），解析 `5.0.9`。
**回归点**：dev 工具链 glob 匹配（storybook docgen、commitizen）。
**回归命令**：`pnpm why brace-expansion`。

### 3.4 `js-yaml`

**来源**：`cosmiconfig@9`（`@commitlint/load`）链，解析 `4.3.1`；另 `@release-it/bumper` 自带
`js-yaml@5.4.3`（不受覆盖影响，规则仅命中 `>=4.0.0 <4.3.1`）。
**回归点**：commitlint / release-it 配置解析。
**回归命令**：`pnpm why js-yaml`。

### 3.5 `conventional-commits-parser`

**来源**：`@commitlint/parse`、`@commitlint/types` 等，解析 `7.1.3`。
**覆盖原因**：`@conventional-changelog/git-client@3.2.0`（release-it 变更日志插件传递依赖）
peer 要求 `^7.1.3`，而锁文件停留 7.1.2；提升后同时满足 `@commitlint/parse` 的 `^7.0.0`，消除 peer 告警。
**回归点**：`pnpm commit` 提交信息校验、`pnpm release` 变更日志生成。
**回归命令**：`pnpm why conventional-commits-parser`。

### 3.6 `conventional-changelog-conventionalcommits`

**来源**：`@commitlint/config-conventional`、`@release-it/conventional-changelog`，固定 `8.0.0`。
**回归点**：release 变更日志格式（无功能性风险，纯固定）。
**回归命令**：`pnpm why conventional-changelog-conventionalcommits`。

---

## 4. 覆盖项回归清单（CI 冒烟建议）

CI 每次 `pnpm install` 后可跑下列只读冒烟，确认覆盖仍生效、且未引入未预期版本：

| 包名 | 覆盖规则 | 回归命令 | 触发条件 |
|---|---|---|---|
| `uuid` | `@<14.0.0 → >=14.0.0` | `pnpm why uuid` | SDK 升级 / lockfile 重算 |
| `nanoid` | `@<3.3.17 → ^3.3.17` | `pnpm why nanoid` | Vue 编译链升级 |
| `brace-expansion` | `@>=4.0.0 <5.0.9 → ^5.0.9` | `pnpm why brace-expansion` | dev 工具链升级 |
| `js-yaml` | `@>=4.0.0 <4.3.1 → ^4.3.1` | `pnpm why js-yaml` | commitlint / release-it 升级 |
| `conventional-commits-parser` | `@<7.1.3 → ^7.1.3` | `pnpm why conventional-commits-parser` | release-it 变更日志插件升级 |
| `conventional-changelog-conventionalcommits` | `8.0.0` | `pnpm why conventional-changelog-conventionalcommits` | 发布链路升级 |

**关键用例回归**：登录令牌生成、消息 ID 生成（对应 §3.1）。覆盖项变动时须补跑
`pnpm test:run` 的 auth / messaging 套件。

---

## 5. 维护规则

- 修改任一条 `overrides` 前，先在本表登记「来源 / 原因 / 回归点」并跑对应回归命令。
- 跨大版本覆盖（当前仅 `uuid`）在升级时必须人工确认消费方 API 用法未破坏。
- `pnpm install` 后若 `pnpm why <pkg>` 出现**新的、未登记的版本**，视为漂移，需排查。
- 不将本清单的回归命令写入阻塞式提交钩子（网络/耗时），仅作 CI 冒烟与人工复查。

---

## 6. 关联

- 事实源：`pnpm-workspace.yaml`（`overrides` 段）
- 依赖审计：`scripts/check-dependency-audit.mjs`（`pnpm check:dependency-audit`）
- Vendored-SDK 运行期依赖：`docs/baseline/dependency-vendor-runtime.md`
