# Design Spec: HuLa 前端全链路优化 —— matrix-js-sdk ↔ synapse-rust 无缝对接

- 日期:2026-07-17
- 分支:master
- 状态:APPROVED
- 决策来源:/office-hours session(D1-D8)+ /grilling session(G1-G5),均已逐项确认
- 上游设计文档:`~/.gstack/projects/langkebo-hula/ljf-master-design-20260716-223852.md`

## 1. 背景

HuLa 前端与 synapse-rust 后端的对接链路存在两个已知正确性 bug:

1. **URL 前缀重复**:调用方硬编码 `/_matrix` 全路径(src 内 348 处,基线已锁定)撞上 SDK `authedRequest` 自动加前缀,产生双前缀请求。`ClientPrefix` 枚举使用 0 次,两种路径约定混用是根因土壤。其中约半数硬编码已集中在 `src/services/matrix/paths/` 常量目录。
2. **token refresh 失效**:token 过期后未正确静默刷新,用户掉线。属认证安全问题。

同时移动端/桌面端存在 UI 功能缺失(P0 已清零,P1/P2 待推进,以 `docs/superpowers/plans/2026-07-15-ui-ux-optimization.md` 的 T1-T11 任务清单为准)。

两个 bug 均带着 3871 个绿色测试逃逸到线上,机制已定位:379 个测试文件中 285 个使用 `vi.mock`,其中 22 个整体 mock 掉 `MatrixClientService`——URL 拼接与 token refresh 逻辑在测试中根本不执行(「假绿」)。

SDK 通过 `meta/sdk-pin.json` 锁定在 2026-05-14(commit d6bebd9,mode=link),CI 在 release/* 分支强制 SDK commit / synapse-rust commit / tarball sha256 三者对齐。

**已落地的前置设施**(本 spec 生效前已完成):

- `tests/msw.ts`:opt-in msw server helper(`onUnhandledRequest: 'error'`),冒烟测试通过
- `scripts/check-ratchet.mjs` + `meta/ratchet-baseline.json`:硬编码 `/_matrix`(基线 348)与 `@ts-expect-error`(基线 0)双计数禁增,`pnpm check:ratchet` 可用

## 2. 目标

1. 修复 URL 前缀重复与 token refresh 两个正确性 bug,修在根因层。
2. 将「matrix-js-sdk ↔ synapse-rust 无缝对接」从一次性人工验证升级为**可持续验证的工程资产**(契约测试 + e2e + 禁增计数器)。
3. SDK 升级到目标 commit 并通过既定流程重锁 `meta/sdk-pin.json`。
4. 按 P0/P1 分批清偿 32 项 UI 缺失。

总体路线采用**契约先行、测试驱动**(office-hours D8/Approach C):先写契约测试把 bug 显性化为红测试,修复变绿,SDK 升级后同一套测试判定升级安全性。

## 3. In Scope / Out of Scope

### In Scope

| 项 | 说明 | 决策依据 |
|---|---|---|
| 契约测试套件 | URL 构造、token 生命周期、sliding sync、manager extensions 四个对接面;mock 边界下沉到 HTTP 层(msw) | D8, G3 |
| 两个 bug 修复 | 独立小 PR,先定位根因归属(hula 侧 vs SDK 侧)再定修复位置 | D1, P1 |
| URL 统一卡口 | 新建 `stripMatrixPrefix` 归一化卡口;存量 348 处硬编码随 UI 批次渐进迁移,禁增由 ratchet 保证 | G2 |
| SDK 升级与重锁 | `../matrix-js-sdk` 拉到目标 commit,`pnpm sdk:pin:refresh` 重锁,`pnpm verify:sdk-pin` 验证 | D2, D3 |
| e2e 修复与补充 | SDK 升级后失效用例修复;补登录 → sync → 收发消息关键路径用例 | D6 |
| 假绿定向加固 | 三面:URL 构造面(22 个 mock MatrixClientService 的测试)、token 生命周期面(auth/ 6 文件 + MatrixTokenManager.test)、SDK 升级接触面 | G3 |
| knip(报告模式) | 死代码报告,作为 SDK 升级后孤儿检测手段;不进 CI 门禁 | G4 |
| JSDoc 契约注释(定向) | 仅卡口 + 认证面,仅 `@throws`/错误码语义,约 10-15 个文件 | G5 |
| UI 缺失分批补齐 | P0(阻断核心聊天路径)先行,P1 随后;移动端(Vant)/桌面端(Naive UI)各自排期 | D1, D4 |

### Out of Scope(看起来能动但明确不动)

| 项 | 理由 | 决策依据 |
|---|---|---|
| `tsconfig` strict 放宽 | 永久红线;受阻时仅允许逐行 `@ts-expect-error` 且计数禁增(当前基线 0) | G1 |
| `meta/sdk-pin.schema.json` 与 `release-validation.yml` 本体 | 防线不是障碍,重锁只走 `sdk:pin:refresh` 既定流程 | D3 |
| `src/stories/`、`preview/` | 开发者体验设施,不改善任何用户可感指标;禁止顺手重构/升级 Storybook | D6 |
| madge / 循环依赖治理 | 架构治理议题,不在本次边界 | G4 |
| 全量 JSDoc(147 个 service 文件) | @param/@returns 与 strict 类型签名 90% 重叠,注定漂移 | G5 |
| 314+ 处硬编码一次性迁移 | 与「一个 PR 一类风险」纪律冲突;渐进迁移 + 禁增即可收敛 | G2 |
| Service 层平台分支逻辑 | 统一 Service 层纪律:`TAURI_ENV_PLATFORM` 判断严禁下沉到 `src/services/` | D4 |
| a11y 专项 | 仅新增 UI 遵守现有标准(如 48px 触控目标),不做存量改造 | D5 |

## 4. 约束

1. **strict: true 不可碰**(tsconfig.json:17),逃生通道仅逐行 `@ts-expect-error` + ratchet 计数禁增。
2. **提交纪律**:bug 修复独立小 PR;禁止把 bug 修复与 UI 大改混入同一 PR(D1)。
3. **重锁流程**:改 `meta/sdk-pin.json` 只允许经 `pnpm sdk:pin:refresh`;release/* CI 验证链(`verify:sdk-pin`)必须保持通过。
4. **架构分层**:所有 Matrix 操作经 `src/services/matrix/` 服务层;组件/store 不得直接调用 SDK;Service 层修一次两端受益。
5. **测试纪律**:新契约测试用 `tests/msw.ts` 在 HTTP 层拦截,不得整体 mock `MatrixClientService`;msw helper 为 opt-in,不影响存量测试。
6. **工具纪律**:knip 仅报告模式;ratchet(`pnpm check:ratchet`)超基线即失败,清理后用 `--update` 收紧基线。
7. **指标优先级**(D5):安全 CSP > 测试覆盖率 > 首屏 LCP > 包体积 > 可访问性。性能指标为守门项(不劣化),非冲刺目标。

## 5. 实施分批概要

> 每批独立 PR、独立验收门槛;详细步骤由后续实施计划(writing-plans)展开。

| 批次 | 内容 | 验收门槛 |
|---|---|---|
| Batch 0 | 契约测试与根因定位:URL 构造 + token 生命周期契约测试(预期红);根因归属结论(hula 侧 vs SDK 侧) | 两个 bug 显性化为红测试;根因结论落档 |
| Batch 1 | bug 修复 + 统一卡口 + CSP 基线收口 | Batch 0 红测试全绿;`pnpm check:ratchet` 通过 |
| Batch 2 | SDK 升级与重锁(若根因在 SDK 侧,与修复合并推进);knip 孤儿报告 | 契约测试全绿;`pnpm verify:sdk-pin` 通过;knip 报告无升级孤儿 |
| Batch 3 | e2e 修复与关键路径补充 | Playwright 套件全绿 |
| Batch 4+ | UI P0 → P1 分批补齐;每批顺带迁移所辖文件硬编码路径 | 每批独立 QA;ratchet 基线单调下降 |

## 6. 验收标准

**正确性:**
- [ ] URL 前缀契约测试:任意 service 发出的请求 URL 有且仅有一个 `/_matrix` 前缀(HTTP 层断言,非 mock 断言)
- [ ] token 生命周期契约测试:token 过期 → 静默刷新 → 原请求重放成功;refresh 失败 → 按错误码语义登出
- [ ] 两个 bug 的修复位于根因层,无 UI 层绕行补丁

**可持续验证资产:**
- [ ] 契约测试覆盖四个对接面(URL 构造 / token 生命周期 / sliding sync / manager extensions),全部经 msw HTTP 层拦截
- [ ] 假绿定向加固完成:URL 构造面与 token 生命周期面(auth/ 目录 6 个测试文件 + MatrixTokenManager.test)的 mock 边界已从 service 层下沉到 HTTP 层;SDK 升级接触面在 Batch 2 前完成同等下沉
- [ ] `pnpm check:ratchet` 进入常规检查流;两个计数器基线较 348/0 不增

**SDK 升级:**
- [ ] `meta/sdk-pin.json` 更新至目标 commit,`pnpm verify:sdk-pin` 通过,schema 与 CI workflow 零改动
- [ ] 升级后契约测试 + 单测 + e2e 三层全绿
- [ ] knip 报告确认无升级遗留孤儿代码

**UI 与体验:**
- [ ] P0 缺失(阻断核心聊天路径)全部补齐,移动/桌面各自验收
- [ ] LCP 与包体积较基线不劣化(`pnpm metrics:bundle`)
- [ ] 新增 UI 满足 48px 触控目标等现有 a11y 标准

**文档:**
- [ ] 卡口与认证面的 `@throws`/错误码语义 JSDoc 完成(约 10-15 文件)

## 7. 风险

| 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|
| bug 根因在 SDK 侧,msw mock 边界需返工 | 中 | Batch 0 返工一次 | 根因定位先行(Batch 0 第一项);SDK 侧修复并入升级 commit(D2 已选升级,路径兼容) |
| SDK 升级引入静默行为变化 | 中 | 线上回归 | 契约测试先于升级存在(D8);e2e 全绿为升级验收门槛;strict 类型拦截 API 签名变化 |
| 契约测试期间 bug 在线上多活数天 | 高 | 用户掉线持续 | Batch 0 时间盒:契约测试仅写两个 bug 面,其余面随 Batch 2 前补齐 |
| e2e 依赖 synapse-rust 实例不可用 | 低 | Batch 3 阻塞 | 前提 P3 已确认实例可用;若失效降级为 msw 层契约验证 + 手工冒烟 |
| unplugin-auto-import 导致 knip 误报 | 高 | 报告噪声 | 仅报告模式(G4),首次落地预留半天调参;不进 CI 门禁 |
| ratchet 的 lint 禁增被绕过(直接改基线) | 低 | 收敛失效 | 基线文件改动在 PR review 中显性可见;基线只允许单调下降 |
| UI 分批迁移路径常量时引入行为变化 | 中 | 局部回归 | 卡口 + 契约测试兜底;`paths/` 目录约占硬编码半数,可整目录切换降低散点风险 |

## 8. 遗留未决问题（全部已决议）

1. **SDK 目标升级 commit** — 已决议:升至本地 HEAD `6ca8c3be9f7c084f5e1516dc9038c2eaddc7b43f` (v40.2.0)。已通过 `pnpm sdk:pin:refresh` 重锁 `meta/sdk-pin.json`,vue-tsc 0 错误,vitest 4110/4113 绿(3 失败属预存 WIP 非回归)。Commit: 61cdb5f1。
2. **UI 缺失 P0/P1 分级** — 已决议:阻断核心聊天路径 = P0。P0 已全部清零(布局拥挤/空状态粗糙/错误反馈不闭环),P1 待推进 T3(消息操作栏)、T1(暗色令牌)、T2(DESIGN.md)、T11(A11y 审计)。以 `docs/superpowers/plans/2026-07-15-ui-ux-optimization.md` 的 T1-T11 任务列表为准。
3. **e2e synapse-rust 实例形态** — 已决议:共享环境 + e2e 专用账号(如 `e2e-test@hula.local`)。当前 `playwright.config.ts` 已通过 `MATRIX_LIVE_HOMESERVER_URL` 支持。本地 Docker 作为离线开发可选 fallback,不进 CI。
