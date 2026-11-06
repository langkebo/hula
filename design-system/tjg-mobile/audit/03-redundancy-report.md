# TJG 冗余清理报告

> 交付物 3 / 3。配套：[问题清单](./01-issue-inventory.md) · [优化执行计划](./02-optimization-plan.md)
>
> 本报告所有数字均来自实测（`stat` / `wc -l` / `shasum -a 256` / 引用检索），**未执行任何删除操作**。
> 清理动作需按本报告的分类与顺序执行。

- 版本：1.0
- 分类：**A 可安全删除** / **B 需确认** / **C 合并或压缩**
- 判定基准：零引用 + 非构建输入 + 非运行时动态寻址

---

## 1. 总览

| 分类 | 条目 | 文件数 | 体积 | 代码行 | 处置 |
| :--- | ---: | ---: | ---: | ---: | :--- |
| A 可安全删除 | 8 | 13 | 80.8 KB | 1,166 | 直接删除 |
| B 需确认 | 4 | 4 | 2,091.4 KB | 21 | 确认后删除或改造 |
| C 合并或压缩 | 12 | — | 预计释放 5.9 MB+ | 预计 1,500+ | 重构/压缩/去重 |
| **合计可释放** | **24** | **17** | **约 8.0 MB** | **约 2,700** | — |

> 说明：先前估算的「84 个文件 / 3.17 MB」包含构建产物与缓存目录，非仓库内可删内容。本报告已按实测收敛为表中数字。

---

## 2. A 类：可安全删除

删除条件：全仓库零引用、不在构建输入路径、不代表运行时动态寻址。

### A-01 备份残留文件（3 个 / 36,396 B / 1,033 行）

| 文件 | 体积 | 行数 | 证据 |
| :--- | ---: | ---: | :--- |
| [ChatSetting.vue.bak](file:///Users/ljf/Desktop/hu_ts/Tjg/src/mobile/views/chat-room/ChatSetting.vue.bak) | 27,535 B | 732 | 扩展名 `.bak`，Vite 不解析；`grep` 仅命中 `docs/baseline/mobile-duplication-inventory.md` 的清单记录 |
| [index.vue.bak](file:///Users/ljf/Desktop/hu_ts/Tjg/src/mobile/views/message/index.vue.bak) | 6,708 B | 188 | 同上 |
| [typography.scss.bak](file:///Users/ljf/Desktop/hu_ts/Tjg/src/styles/scss/global/typography.scss.bak) | 2,153 B | 113 | 同上；且 `typography.scss` 自身已在 S-P1-01 中判定为待改造 |

**风险**：无。三者均为手工备份，源文件仍在。
**动作**：`git rm` 三个文件，并在 `docs/baseline/mobile-duplication-inventory.md` 中标注已清理。

### A-02 损坏资源占位文件（1 个 / 5,520 B）

| 文件 | 证据 |
| :--- | :--- |
| [login_bg.png.broken](file:///Users/ljf/Desktop/hu_ts/Tjg/public/login_bg.png.broken) | 实为 WebP 数据但扩展名为 `.png`，当时为避免误引用而改名；`.broken` 不在任何资源解析规则内；全仓库零引用（仅历史文档提及） |

**风险**：无。若要恢复视觉，应从设计稿导出**正确格式**的新图，而不是复用该文件。

### A-03 空目录下的孤图（1 个 / 312 B）

| 文件 | 证据 |
| :--- | :--- |
| [scanner.webp](file:///Users/ljf/Desktop/hu_ts/Tjg/src/assets/mobile/community/scanner.webp) | 所在目录 `src/assets/mobile/community/` 仅此一个文件，全仓库零引用；312 B 为占位图 |

**动作**：删除文件后若目录为空，一并删除目录。

### A-04 根目录临时脚本（2 个 / 4,598 B / 133 行）

| 文件 | 体积 | 行数 | 证据 |
| :--- | ---: | ---: | :--- |
| [clean_unused.py](file:///Users/ljf/Desktop/hu_ts/Tjg/clean_unused.py) | 3,663 B | 102 | 一次性清理脚本，无 `package.json` script 引用，无 CI 引用 |
| [parse_biome.py](file:///Users/ljf/Desktop/hu_ts/Tjg/parse_biome.py) | 935 B | 31 | 同上 |

**风险**：无。若仍需保留能力，应迁入 `scripts/` 并接入 `package.json`，而不是散落在根目录。

### A-05 系统垃圾文件（5 个 / 35,940 B）

| 路径 | 体积 |
| :--- | ---: |
| `./.DS_Store` | 16,388 B |
| `./src/services/matrix/.DS_Store` | 6,148 B |
| `./src/services/matrix/admin/.DS_Store` | 6,148 B |
| `./src/services/matrix/crypto/.DS_Store` | 6,148 B |
| `./tauri-plugin-hula/target/debug/.DS_Store` | 6,148 B |

**动作**：删除并确认 `.gitignore` 已包含 `.DS_Store`（若已跟踪则 `git rm --cached`）。

---

## 3. B 类：需确认后删除或改造

### B-01 `src/views/mailWindow/`（1 个 / 710 B / 21 行）

| 项 | 内容 |
| :--- | :--- |
| 文件 | [mailWindow/index.vue](file:///Users/ljf/Desktop/hu_ts/Tjg/src/views/mailWindow/index.vue) |
| 证据 | 页面只渲染 `common.feature_in_development`；路由 `desktop.ts:68` 与侧栏 `left/config.tsx:30` 仍指向它 |
| 结论 | **删除**，但必须与 OP-04 同步：先移除侧栏入口与路由，再删文件 |
| 风险 | 若单独删文件而不删入口，会得到白屏 |

### B-02 `public/file/docx.svg`（955 B）

| 项 | 内容 |
| :--- | :--- |
| 证据 | 与 `public/file/doc.svg` SHA-256 完全相同；但 [File.vue:35](file:///Users/ljf/Desktop/hu_ts/Tjg/src/components/rightBox/renderMessage/File.vue#L35) 用 `/file/${后缀}.svg` 动态拼接，`.docx` 文件会命中它 |
| 结论 | **保留**。动态寻址下不可删除；如需去重，应在代码层把 `docx` 映射到 `doc`，再删文件 |
| 收益 | 955 B，收益极小，优先级最低 |

### B-03 `public/logo.png` / `logoL.png` / `logoD.png`（3 个 / 3,133,503 B）

| 项 | 内容 |
| :--- | :--- |
| 证据 | 三者 SHA-256 完全相同，均为 1024×1024 RGB PNG，单文件 1,044,501 B |
| 引用 | `logo.png` 作头像兜底（8 处）；`logoD.png` 作亮色默认头像（`AvatarUtils` 等）；`logoL.png` 仅在 `themeContent === DARK` 时使用 |
| 问题 | `logoL`（暗色）与 `logoD`（亮色）**内容一致**，说明主题区分是无效的；同时 1 MB 的 1024px PNG 被用于 48px 头像位 |
| 结论 | **改造后合并**：①导出真正的暗色版；②两者都转 WebP（256px @2x，预计 ≤ 15 KB）；③代码层统一走 `AvatarUtils` 常量 |
| 收益 | 3,133,503 B → 约 30 KB，释放 **≈ 2.97 MB** |
| 风险 | 需视觉确认暗色版设计，属产品决策 |

### B-04 `docs/baseline/mobile-duplication-inventory.md`

| 项 | 内容 |
| :--- | :--- |
| 证据 | 文档仍记录「纯重复 2 个」且未覆盖本报告新增条目 |
| 结论 | **更新而非删除**：追加本次清理结果，避免下轮重复审计 |

---

## 4. C 类：合并、压缩与去重

### C-01 表情动作图（12 个 / 7.1 MB）

| 项 | 内容 |
| :--- | :--- |
| 路径 | `public/msgAction/` |
| 实测 | 12 个文件共 7.1 MB；单个 256×256 资源 0.5–1.1 MB；最大 `enraged-face.png` 1,144,658 B |
| 附带问题 | `like.png` 实际是 **GIF 数据**（`GIF89a, 256x256`），扩展名错误，与 A-02 同类 |
| 建议 | 静态帧转 WebP（目标 ≤ 40 KB/个），动图转 APNG/WebP 动图（目标 ≤ 150 KB/个）；修正 `like.png` 扩展名或转码 |
| 预期收益 | 7.1 MB → 约 1.2 MB，释放 **≈ 5.9 MB**（占 `public/` 总体积 42%） |
| 风险 | 低。需逐图核对透明通道与帧数 |

### C-02 `.tjg-glass--row`（零引用且违反架构约束）

| 项 | 内容 |
| :--- | :--- |
| 位置 | [mobile.scss:128-L133](file:///Users/ljf/Desktop/hu_ts/Tjg/src/styles/scss/global/mobile.scss#L128-L133) |
| 证据 | 全仓库引用数 **0**；块内含 `backdrop-filter`，与 `MASTER.md` §2「L3 内容面禁止模糊」冲突 |
| 动作 | 整块删除。这既是冗余清理，也是性能风险消除（对应 S-P1-10 / M-P2-01） |

### C-03 设计 token 冗余

| 项 | 内容 |
| :--- | :--- |
| 位置 | [design-tokens.css](file:///Users/ljf/Desktop/hu_ts/Tjg/src/styles/css/design-tokens.css) |
| 实测 | 307 个 token 中 **34 个零引用**；98 个仅 1–2 次引用 |
| 重复定义 | 同一 token 在文件内二次定义并覆盖：`224` 与 `829`；`220` / `525` / `813`；`226` / `833` |
| 空行残留 | `355-L376`、`638-L643` |
| 动作 | 先删重复定义（保留权威值），再删 34 个零引用，最后清空行；1–2 次引用逐个判定 |
| 风险 | 中。删除前需 `grep -- '--tjg-xxx'` 二次确认，并同时检查 `.scss` / `.ts` / `.vue` 三类引用 |

### C-04 `typography.scss` 第二套字号标度

| 项 | 内容 |
| :--- | :--- |
| 位置 | [typography.scss:3-L28](file:///Users/ljf/Desktop/hu_ts/Tjg/src/styles/scss/global/typography.scss#L3-L28) |
| 证据 | 定义 `--text-xs..4xl` 与 `--leading-*`、`--font-*`，与 `--tjg-font-size-*` 并存；`body` 取 `--text-base` = 16px，与 `--tjg-font-size-base: 14px` 冲突 |
| 动作 | 改为对 `--tjg-*` 的别名，或整体删除并替换引用点（对应 OP-15） |
| 收益 | 消除一套重复标度，约 30 行 |

### C-05 `responsive.scss` 空壳断点体系

| 项 | 内容 |
| :--- | :--- |
| 位置 | [responsive.scss](file:///Users/ljf/Desktop/hu_ts/Tjg/src/styles/scss/global/responsive.scss)（79 行） |
| 证据 | 定义 5 档断点，但全仓库**实际媒体查询 0 处**；`.responsive-container` 引用数 0 |
| 动作 | 不整体删除，改写为 `@mixin up/down` 供组件消费（对应 OP-17）；删除 `.responsive-container` |
| 收益 | 从「79 行死代码」转为可用基础设施 |

### C-06 `variable.scss` 重复注入

| 项 | 内容 |
| :--- | :--- |
| 位置 | [variable.scss](file:///Users/ljf/Desktop/hu_ts/Tjg/src/styles/scss/global/variable.scss) |
| 证据 | 被 6 处 `@use`，每次引入重复输出同一批 `:root` 变量；含 `* { ... !important }`；3 处 `:deep()` 在全局上下文失效 |
| 动作 | 拆为纯变量 `_variables.scss` + 输出规则 `global.scss`；移除通配 `!important`；删除失效 `:deep()`（对应 OP-16 / S-P1-06） |
| 收益 | 产物内 `--tjg-*` 定义从 6 份降为 1 份；`!important` 下降 ≥ 30 处 |

### C-07 双套输入工具栏

| 项 | 内容 |
| :--- | :--- |
| 位置 | [FooterBar.vue](file:///Users/ljf/Desktop/hu_ts/Tjg/src/mobile/components/chat-room/FooterBar.vue) 与 [MsgInputMobileControls.vue](file:///Users/ljf/Desktop/hu_ts/Tjg/src/components/rightBox/MsgInputMobileControls.vue) |
| 证据 | 两者职责重叠，移动端可同时被挂载 |
| 动作 | 保留 FooterBar 为移动端唯一实现后，删除 `MsgInputMobileControls.vue`（对应 OP-11） |
| 风险 | 中。需先确认桌面端无引用 |

### C-08 「我的」页分享死弹层

| 项 | 内容 |
| :--- | :--- |
| 位置 | [Settings.vue:14-L20](file:///Users/ljf/Desktop/hu_ts/Tjg/src/mobile/components/my/Settings.vue#L14-L20) · [:38-L40](file:///Users/ljf/Desktop/hu_ts/Tjg/src/mobile/components/my/Settings.vue#L38-L40) · [:57](file:///Users/ljf/Desktop/hu_ts/Tjg/src/mobile/components/my/Settings.vue#L57) |
| 证据 | `activate = () => {}` 空函数；`active` 从未置 `true` |
| 动作 | 按 OP-02 方案 A 删除；同步清理 `mobile_my.share_to` 文案键（若停用） |

### C-09 未使用导出（knip）

| 项 | 内容 |
| :--- | :--- |
| 实测 | 43 个未使用值导出 + 156 个未使用导出类型 |
| 动作 | 先删 43 个值导出（无运行时风险）；156 个类型导出分批评估，保留 SDK augmentation 相关 |
| 验证 | `knip` 复跑；`pnpm vue-tsc --noEmit` 必须 0 错误 |

### C-10 依赖归类错误

| 项 | 内容 |
| :--- | :--- |
| 证据 | [package.json:182](file:///Users/ljf/Desktop/hu_ts/Tjg/package.json#L182) 的 `@iconify/vue`、[:209](file:///Users/ljf/Desktop/hu_ts/Tjg/package.json#L209) 的 `@vueuse/core` 位于 `devDependencies`，但被 51 / 100 个生产文件引用 |
| 动作 | 移入 `dependencies`（不是删除） |
| 风险 | 生产裁剪安装时会缺失，属潜在故障而非纯冗余 |

### C-11 魔法值与重复字面量

| 项 | 内容 |
| :--- | :--- |
| 位置 | [friends/index.vue:169/202/240/279](file:///Users/ljf/Desktop/hu_ts/Tjg/src/mobile/views/friends/index.vue#L169)（`340px` ×4）、`:177/209/248/282`（`h-75px` ×4） |
| 动作 | 提取为具名 token 或 SCSS 变量，消除 8 处重复字面量（对应 OP-26） |

### C-12 守卫测试硬编码清单

| 项 | 内容 |
| :--- | :--- |
| 位置 | [mobileCssGuards.test.ts](file:///Users/ljf/Desktop/hu_ts/Tjg/src/mobile/layout/__tests__/mobileCssGuards.test.ts) |
| 证据 | `blurSurfaces` 硬编码 4 个文件路径 |
| 动作 | 改为 `glob` 扫描（对应 OP-29），避免新增模糊面漏检 |

---

## 5. 执行顺序（与优化计划对齐）

| 步骤 | 内容 | 依赖 | 守门 |
| :--- | :--- | :--- | :--- |
| 1 | 删除 A 类全部 13 个文件 | 无 | `pnpm vue-tsc --noEmit`、`pnpm build` |
| 2 | 按 OP-04 移除 mail 入口 + 路由 + 页面（B-01） | 步骤 1 | `pnpm test:run` |
| 3 | C-02 删除 `.tjg-glass--row` | 无 | `pnpm check:mobile-css` |
| 4 | C-07 工具栏去重、C-08 分享弹层删除 | OP-11、OP-02 | 手动回归输入区 |
| 5 | C-03 token 去重与零引用清理 | OP-24 | `pnpm check:ratchet` |
| 6 | C-04 / C-05 / C-06 样式体系收口 | OP-15、OP-16、OP-17 | 双主题截图对比 |
| 7 | C-01 / B-03 资源压缩 | 视觉确认 | 构建产物体积对比 |
| 8 | C-09 未使用导出清理 | 步骤 1–7 | `knip`、`vue-tsc` |
| 9 | C-10 依赖归类、C-11 魔法值、C-12 守卫改造 | 无 | `pnpm install --prod` 后构建 |

---

## 6. 清理后收益估算

| 指标 | 清理前 | 预期 |
| :--- | ---: | ---: |
| 仓库内可删文件 | 17 | 0 |
| `public/` 体积 | 14 MB | ≈ 5.1 MB |
| 其中 `msgAction` | 7.1 MB | ≈ 1.2 MB |
| 其中 logo 三件套 | 3.0 MB | ≈ 0.03 MB |
| 死代码行数 | 1,166（A 类）+ 约 110（C-02/05/08） | 0 |
| `.tjg-glass--row` 违规模糊面 | 1 | 0 |
| 未使用 token | 34 | 0 |
| 未使用导出 | 43 | ≤ 10 |
| `!important` | 113 | ≤ 40 |
| 双套字号标度 | 2 | 1 |
| 双套输入工具栏 | 2 | 1 |

---

## 7. 明确不做（避免误删）

| 对象 | 原因 |
| :--- | :--- |
| `public/file/*.svg`（含 `docx.svg`） | 运行时按扩展名动态拼接路径，删除即造成图标缺失 |
| `public/emoji/*.webp` | 表情面板按名称动态寻址 |
| `src/assets/fonts/AlimamaFangYuanTiVF-Thin.woff2` | 登录网络页独占使用，有守卫测试保护 |
| `src/types/matrix-js-sdk-augmentations.d.ts` 内类型 | module augmentation 必须同文件，且支撑 `check:sdk-types` |
| `vendor/matrix-js-sdk.tgz` | SDK pin，受 `verify:sdk-pin` 保护 |
| `build/config/components.ts` 自动注册配置 | 组件扫描入口，非冗余 |
