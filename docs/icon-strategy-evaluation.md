# 图标策略评估：SVG Sprite vs Iconify

> 任务编号：2.6.4 · SVG sprite vs Iconify 评估文档
> 评估日期：2026-08-05
> 评估范围：`src/` 全量代码库

## 1. 现状盘点

项目当前同时存在**三套**图标方案，共存而非互斥：

| 方案 | 载体 | 使用文件数 | 图标总数 | 产物体积 | 主要分布 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **SVG Sprite** | `public/icon.js`（运行时注入 `<symbol>` 到 DOM） | 156 | 184 个 symbol | 276 KB（全量加载，未按需） | `src/layout/`、`src/mobile/`、`src/plugins/robot/` |
| **Iconify** | `@iconify/vue`（`<Icon icon="..." />`） | 70 | 按需（在线/离线集合） | 依赖运行时 API 或预打包集合 | `src/views/settingsWindow/`、`src/mobile/views/my/`、`src/views/loginWindow/` |
| **内联 SVG** | 模板内 `<svg><path d="..."/></svg>` | 21 | 分散、无统一管理 | 0（散落在各组件） | `src/views/admin/AdminLayout.vue` 等 |

### 1.1 SVG Sprite 细节

- `public/icon.js` 是一个 IIFE，在 `DOMContentLoaded` 时把一段包含 184 个 `<symbol>` 的 SVG 注入到 `document.body` 首部。
- 全量加载：即使某页面只用 2 个图标，276 KB 的脚本也会完整下载并执行。
- 引用方式：`<svg class="size-Xpx"><use href="#iconName"></use></svg>`。
- 优势：零 JS 运行时依赖（除注入脚本外）、跨组件复用、`currentColor` 主题适配成熟。
- 劣势：
  - 无按需加载，首屏体积恒定。
  - 新增图标需手工编辑 `icon.js`，符号命名无校验，存在 `RightArrow` / `arrow-right` / `left-arrow` 等不一致命名。
  - 无法 tree-shake，未使用的图标也被打包。
  - 部分图标使用硬编码颜色（如 `#13987f`、`#AFDBD2`），不随主题切换。

### 1.2 Iconify 细节

- 依赖 `@iconify/vue@^5.0.1`，通过 `<Icon icon="prefix:name" />` 引用。
- 支持按需加载：默认从 Iconify API 在线拉取，也可通过 `addCollection` 预装离线集合。
- 优势：图标库极其丰富（20 万+）、按需加载、支持 `currentColor`、可动态切换集合。
- 劣势：
  - 在线模式依赖网络，离线场景需预打包集合（增加构建配置复杂度）。
  - 运行时需加载 `@iconify/vue` core（gzip 后约 15 KB）。
  - 与现有 SVG Sprite 体系并存，存在双轨维护成本。

### 1.3 内联 SVG 细节

- 散落在 21 个组件中，路径数据硬编码在模板内。
- 典型案例：`AdminLayout.vue` 的 12 个导航图标，每个 `navGroups` 项内嵌 `d` 字符串。
- 优势：零依赖、渲染最快。
- 劣势：无复用、无统一命名、难以主题化、维护成本高（路径数据混在业务逻辑里）。

## 2. 评估维度对比

| 维度 | SVG Sprite（现状） | Iconify | 内联 SVG（现状） |
| :--- | :--- | :--- | :--- |
| **首屏体积** | 276 KB（恒定） | ~15 KB core + 按需图标 | 0 |
| **按需加载** | ✗ 全量 | ✓ 自动 | n/a |
| **图标丰富度** | 184 个（固定） | 20 万+（在线） | 分散 |
| **主题适配** | 部分（`currentColor` + 硬编码混用） | 好（`currentColor`） | 差（硬编码） |
| **Tree-shaking** | ✗ | ✓（离线集合模式） | n/a |
| **离线可用** | ✓ | 需预装集合 | ✓ |
| **类型安全** | ✗（字符串引用无校验） | ✗（字符串引用） | n/a |
| **维护成本** | 中（需手工编辑 `icon.js`） | 低（声明式引用） | 高（散落各处） |
| **新增图标成本** | 高（编辑 `icon.js` + 命名冲突风险） | 极低（直接引用集合） | 中（复制路径） |
| **SSR 友好** | 需注入脚本 | 需 hydration | ✓ |

## 3. 推荐策略：渐进式收敛，**不**做一刀切迁移

### 3.1 核心结论

> **不建议**将现有 156 个 SVG Sprite 引用一次性迁移到 Iconify，也不建议反向把 Iconify 全部迁回 Sprite。两套体系各有适用场景，应**按场景分工**，并消除内联 SVG 这一最差实践。

理由：
1. **迁移成本不对称**：156 个文件的 `<use href="#...">` 改写为 `<Icon icon="..." />` 涉及命名映射、颜色适配、视觉回归验证，收益主要是「按需加载省 276 KB」，而该 276 KB 经 gzip 后约 40-50 KB，且可被 HTTP 缓存复用，实际首屏收益有限。
2. **Sprite 对存量界面已稳定**：`layout/left`、`layout/right`、`mobile` 等核心界面长期使用 Sprite，视觉一致性已验证，强行迁移引入回归风险。
3. **Iconify 适合增量**：新页面、设置类界面（已大量使用 Iconify）继续用 Iconify，无需扩充 Sprite。
4. **内联 SVG 是真正的债务**：21 个文件的散落路径数据才是最该清理的，应优先收敛。

### 3.2 分层策略

| 场景 | 推荐方案 | 说明 |
| :--- | :--- | :--- |
| **存量核心界面**（`layout/`、`mobile/`） | 维持 SVG Sprite | 已稳定，不迁移；仅修复硬编码颜色 |
| **新页面 / 设置类界面** | Iconify | 按需、图标丰富、无需扩充 Sprite |
| **管理后台导航等内联 SVG** | 抽取为局部组件（见 2.6.2） | 本阶段已对 `AdminLayout.vue` 抽取 `AdminNavIcon` 组件 |
| **品牌/Logo/复杂多色图标** | 内联 SVG（保留） | 需精细控制，不适合 Sprite/Iconify |

### 3.3 短期改进项（低成本、高收益）

1. **Sprite 硬编码颜色治理**：排查 `public/icon.js` 中 `fill="#13987f"` 等硬编码，改为 `currentColor` 或保留为品牌色但提取为变量。预计影响 30+ 个 symbol。
2. **Sprite 命名规范化**：统一为 `kebab-case`，清理 `RightArrow` / `arrow-right` 等不一致命名（需同步更新引用方）。
3. **内联 SVG 收敛**：本阶段（2.6.2）已将 `AdminLayout.vue` 的 12 个导航图标抽取为 `AdminNavIcon` 组件 + `adminNavIcons.ts` 路径表，作为内联 SVG 治理的样板。剩余 20 个内联 SVG 文件可按需逐步收敛。
4. **Iconify 离线集合**：若需支持完全离线，可对高频使用的 Iconify 图标用 `@iconify-json/*` 预打包，避免运行时网络请求。

### 3.4 长期演进（可选，非本阶段目标）

- 若未来 Sprite 体积增长至 500 KB+ 或图标数突破 400，可评估迁移到 **Iconify 离线集合** + 按需加载，届时再做一次性迁移。
- 若引入设计系统重构，可统一为 **Iconify + `@iconify-json/tjg`（自定义集合）**，把现有 184 个 Sprite 图标导出为自定义集合，实现单一来源。

## 4. 本阶段已落地动作

| 动作 | 对应任务 | 状态 |
| :--- | :--- | :--- |
| `AdminLayout.vue` 导航图标抽取为 `AdminNavIcon` 组件 + `adminNavIcons.ts` 路径表 | 2.6.2 | ✅ 已完成 |
| 本评估文档 | 2.6.4 | ✅ 已完成 |

## 5. 决策摘要

- **不迁移**：156 个 SVG Sprite 引用保持现状。
- **不替换**：70 个 Iconify 引用保持现状。
- **收敛内联**：21 个内联 SVG 文件中，管理后台导航（12 图标）已抽取为组件，其余按需渐进处理。
- **治理颜色**：Sprite 硬编码颜色列入后续小任务（非本阶段）。
- **统一增量**：新界面默认用 Iconify，不再扩充 Sprite。
