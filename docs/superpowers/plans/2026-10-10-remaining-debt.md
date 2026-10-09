# 剩余债务清理实施计划（icons / crypto / 零散小项 / i18n 类型收紧）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 清掉 `docs/mobile-feature-optimization-plan.md` §13 中用户指定顺序的剩余项：图标硬编码色 → vitest 非零退出 → 零散小项 → i18n `t()` 类型收紧。

**Architecture:** 逐项独立成任务，每项在真实路径上有 RED→GREEN 证据，独立评审后才在 ledger 记 `complete`。图标任务改 `public/icon.js` 的符号属性（`currentColor`）并在使用处补颜色上下文；crypto 任务修 `CryptoKeyBackupAdapter` 的悬空 Promise；零散项各自动最小；最后一项是跨模块迁移，独立收口。

**Tech Stack:** Tauri v2 + Vue 3 `<script setup>` + Pinia + TypeScript + Vite 7；Vitest；vue-i18n 11；Biome；自研 `scripts/check-*.mjs` 守门。

## Global Constraints

- 工作目录：`.worktrees/remaining-debt`（分支 `feat/remaining-debt`）。**禁止在主树 `/Users/ljf/Desktop/hu_ts/Tjg` 做功能改动**；主树只用于对比基线。
- **禁止 `pnpm install`**（本 worktree 的 `node_modules` 是指向主树的 symlink）。用 `npx vitest run <path>`、`npx vue-tsc --noEmit`、`node scripts/*.mjs`。
- 提交：Conventional Commits，scope 仅 `core, ui, chat, mobile, plugin, hook, service, util, i18n, config, ci, test, tauri`；无 emoji；不使用 `--no-verify`（pre-commit 约 90-140s，用长超时）。
- 不得新增硬编码颜色（`#xxx`/`rgb()`/`rgba()`）：只用 `--tjg-*` token 或现有语义类。
- 不得抬高任何 ratchet baseline；基线的数字只能持平或下降。
- 组件不得直接 import `matrix-js-sdk`（走 `@/types/matrix-js-sdk` shim）。
- `src/services/**` 导出的新符号必须有 JSDoc（`check:doc-coverage` 会把新缺失记为回归）。
- 跑完 vitest 后若 `src/typings/auto-imports.d.ts` / `components.d.ts` 有非预期改动，必须回退、不得提交其 churn。
- 每个任务的验收必须是**真实路径上的行为测试**（RED→GREEN），不接受「数数变少」或「删断言」。

---

### Task 1: 图标 sprite 硬编码色改 `currentColor`（用户选定方案）

**Files:**
- Modify: `public/icon.js`（符号 `RightArrow`/`Security`/`cloudError`/`minus`/`sliding`/`tips` 及未引用的 `build`/`docs`/`perf`）
- Modify: `src/components/rightBox/chatBox/FooterOverlays.vue`（`cloudError` 使用处补语义色）
- Modify: `src/views/loginWindow/QRCode.vue`、`src/layout/left/model.tsx`（仅在实测缺少颜色上下文时）
- Test: `scripts/audit-icon-colors.py`（既有守门，作为验收闸门）

**背景（已实测）：** `data-follow-*` 在本仓是**惰性元数据**（`icon.js` 运行时只有 iconfont sprite 注入，无任何读取 `data-follow-*` 的逻辑），真正渲染的是同值的 `fill=`/`stroke=`。因此必须**同时**改 `data-follow-X` 与 `X`，只改前者就是骗守门。9 个符号共 21 处：
`RightArrow`(fill#ccc×1)、`Security`(fill#13987f×2)、`cloudError`(fill+stroke#ce304f×4)、`minus`(stroke#333×1)、`sliding`(fill#666×6)、`tips`(stroke#13987f×2 + fill#AFDBD2×1 + fill#13987f×1)、`build`(fill#966957×1)、`docs`(fill#D2C5DF×1)、`perf`(fill#fff×1)。
已确认的渲染上下文：`Safety`/`Security`、`sliding`（`.drag-icon svg { color: var(--tjg-text-tertiary) }`）、`RightArrow`（`CheckUpdate.vue` 的 `color-[--tjg-text-disabled]`）**已有**颜色上下文；`cloudError` 在 `ChatBanners.vue`（容器 `text-[--tjg-color-danger-500]`）与 `Location.vue`（`color-[--tjg-text-quaternary]`）也有；**只有 `FooterOverlays.vue` 的 `cloudError` 没有**（当前靠写死红色表达「非好友」错误语义）。

- [ ] **Step 1: 写失败证据（改前现状）**

Run: `python3 scripts/audit-icon-colors.py; echo "exit=$?"`
Expected: `[FAIL] 非白名单硬编码 21 处，分布在 9 个 symbol`，`exit=1`。

- [ ] **Step 2: 逐符号改成 currentColor**

规则（脚本可用 python 精确替换 `<symbol id="X">` 块内的属性值，改完人工复核 diff）：
- 单色符号 `RightArrow`/`Security`/`cloudError`/`minus`/`sliding`/`build`/`docs`/`perf`：把块内 `data-follow-fill="#..."`→`data-follow-fill="currentColor"`、`data-follow-stroke="#..."`→`data-follow-stroke="currentColor"`，并把同值的 `fill="#..."`/`stroke="#..."`→`fill="currentColor"`/`stroke="currentColor"`。**不要动** `fill="none"`、`fill="url(#...)"`、`opacity="..."`。
- 双色调符号 `tips`：外圈路径 `fill="#AFDBD2"` → `fill="currentColor" fill-opacity="0.3"`（保留浅底、仍可跟随文本色；该符号已有 `opacity=".5"` 先例）；其余 `#13987f` 全部 → `currentColor`。
- `success` 保持在 WHITELIST，不动。

- [ ] **Step 3: 补颜色上下文（`FooterOverlays.vue`）**

`<svg class="size-24px">` → `<svg class="size-24px color-[--tjg-status-error]">`（token 名以 `src/styles/css/design-tokens.css` 里实际存在的错误色 token 为准；`check:token-refs` 会校验 token 是否被引用）。若 `chat.location`/`QRCode`/`model.tsx` 三处在 Step 4 的 grep 中显示无颜色上下文，同样补对应语义 token 类。

- [ ] **Step 4: 验证符号使用处的颜色上下文（行为验收）**

Run:
```bash
grep -rn "#RightArrow\|#Security\|#cloudError\|#sliding\|#tips\|#minus" src/ | grep -v __tests__
```
Expected: 每一处的 `<svg>` 或祖先容器上有 `color-`/`text-` 语义类（把结果逐条抄进任务报告，形成「符号 → 使用处 → 颜色上下文」表）。`#tips` 若因 `fill-opacity` 方案而无需上下文，也要在表里写明理由。

- [ ] **Step 5: 守门转绿 + 可证伪探针**

Run: `python3 scripts/audit-icon-colors.py; echo "exit=$?"` → Expected: `[OK] … 非白名单 symbol 无 data-follow-* 硬编码颜色。`，`exit=0`。
探针（证明守门仍会失败）：临时把 `minus` 的 `stroke="currentColor"` 改回 `stroke="#333"` → 复跑必须 `exit=1` 并点名 `minus`；改回后 `exit=0`。
Run: `node scripts/check-guard-patterns.mjs && node scripts/check-token-refs.mjs`

- [ ] **Step 6: 提交**

```bash
git add public/icon.js src/components/rightBox/chatBox/FooterOverlays.vue
git commit -m "fix(ui): 图标 sprite 硬编码色改走 currentColor，使用处补语义颜色上下文"
```

---

### Task 2: 修 `CryptoKeyBackupAdapter` 悬空 Promise（vitest 非零退出的根因）

**Files:**
- Modify: `src/services/matrix/crypto/CryptoKeyBackupAdapter.ts:126-140`
- Test: `src/services/matrix/crypto/__tests__/CryptoKeyBackupAdapter.test.ts`

**根因（已实测）：** `setupKeyBackupWithOptions` 用 `task.finally(...)` 清理并发锁，`.finally()` 派生出的新 Promise 无人处理；`_doSetupKeyBackup` 拒绝时派生 Promise 也拒绝 → 未处理拒绝（`CryptoApi 不可用` ×3），使 `npx vitest run` 以 exit 1 收尾。

- [ ] **Step 1: 写 RED 证据**

Run: `npx vitest run src/services/matrix/crypto/__tests__/CryptoKeyBackupAdapter.test.ts > /tmp/crypto-before.log 2>&1; echo "exit=$?"`
Expected: `exit=1`，且日志含 `Unhandled Rejection` / `CryptoApi 不可用`（用例本身 passing）。

- [ ] **Step 2: 写一个钉住「不再有未处理拒绝」的测试**

在 `CryptoKeyBackupAdapter.test.ts` 增加用例（思路：监听 `process.on('unhandledRejection')`，让 `getCrypto()` 返回 null 触发 `CryptoApi 不可用`，await 一次微任务队列后断言没有新增未处理拒绝）：

```ts
it('setup 失败时不留悬空拒绝（并发锁清理不得产生未处理拒绝）', async () => {
  const seen: unknown[] = []
  const onRejection = (reason: unknown) => seen.push(reason)
  process.on('unhandledRejection', onRejection)
  accessors.getCrypto = () => null // 触发 'CryptoApi 不可用'

  await expect(adapter.setupKeyBackupWithOptions()).rejects.toThrow('CryptoApi 不可用')
  await adapter.setupKeyBackupWithOptions().catch(() => undefined) // 走一次「锁已释放」的再入路径
  await new Promise((r) => setTimeout(r, 0))
  process.off('unhandledRejection', onRejection)

  expect(seen).toEqual([])
})
```
（具体 mock 形式按该文件既有 `accessors` 写法调整；不得删改既有断言。）

- [ ] **Step 3: 实现最小修复**

`src/services/matrix/crypto/CryptoKeyBackupAdapter.ts` 的 `setupKeyBackupWithOptions`：

```ts
    const task = this._doSetupKeyBackup(input)
    setupInFlight = task
    // 用 then(clear, clear) 而不是 finally()：finally 派生出的 Promise 在 task 拒绝时
    // 同样拒绝且无人处理，会产生 unhandled rejection（vitest 因此 exit 1）。
    const clear = () => {
      if (setupInFlight === task) setupInFlight = null
    }
    task.then(clear, clear)
    return task
```
调用方仍能拿到拒绝（`return task` 不变），`setupKeyBackup` 的 catch 行为不变。

- [ ] **Step 4: 全仓扫同类模式**

Run: `grep -rn "\.finally(" src/ --include=*.ts --include=*.vue | grep -v __tests__`
Expected: 逐条判断「`.finally()` 的上游 Promise 是否可能拒绝且无人处理」；发现同类的写成报告里的一条 finding，并**只修同文件/同风险的**（不扩大范围）。若确有多处，先在做完 Step 3 后单开一个 commit。

- [ ] **Step 5: 验证 GREEN**

Run: `npx vitest run src/services/matrix/crypto/__tests__/CryptoKeyBackupAdapter.test.ts > /tmp/crypto-after.log 2>&1; echo "exit=$?"`
Expected: `exit=0`，日志无 `Unhandled Rejection`。
再跑整包确认 Errors 归零：`npx vitest run --maxWorkers=2 > /tmp/suite-after.log 2>&1; echo "exit=$?"` → `exit=0`、`Errors 0`（若仍有别的既有 Errors，如实报告并区分归属）。

- [ ] **Step 6: 提交**

```bash
git add src/services/matrix/crypto/CryptoKeyBackupAdapter.ts src/services/matrix/crypto/__tests__/CryptoKeyBackupAdapter.test.ts
git commit -m "fix(service): 密钥备份并发锁不再用 finally 派生悬空拒绝"
```

---

### Task 3: 清 `src/typings/components.d.ts` 陈旧条目

**Files:**
- Modify: `src/typings/components.d.ts:85,149,418,482`

**已实测：** `ExternalServiceManager.vue` 与 `MobileMessageActions.vue` 在 `src/` 下均不存在，但生成物两处声明里仍各有条目。Task 6 已有同样处置先例（`GuestModeBanner`/`ThreepidManager`）。

- [ ] **Step 1: RED 证据（当前仍在）**

Run: `grep -c "ExternalServiceManager\|MobileMessageActions" src/typings/components.d.ts` → Expected: `4`；`find src -name "ExternalServiceManager.vue" -o -name "MobileMessageActions.vue"` → 空。

- [ ] **Step 2: 删除 4 行条目**

只删 `GlobalComponents` 与 `GlobalDirectives`(实际为第二处 `const`) 两个块里的这 4 行，保持文件其余结构不变。

- [ ] **Step 3: 验证**

Run: `grep -c "ExternalServiceManager\|MobileMessageActions" src/typings/components.d.ts` → Expected: `0`（退出码 1，视为通过）。
Run: `node scripts/check-component-contracts.mjs` → Expected: OK（无人监听事件 0 / 白名单 17/17）；不引入新的「陈旧生成物」告警。
Run: `npx vue-tsc --noEmit` → 0 错误（证明确实无代码引用这两个组件）。

- [ ] **Step 4: 提交**

```bash
git add src/typings/components.d.ts
git commit -m "chore(config): 清掉 components.d.ts 中已删组件的陈旧条目"
```

---

### Task 4: `check:doc-coverage` 基线去重（修生成口径）

**Files:**
- Modify: `scripts/check-doc-coverage.mjs`（`scanFile` 返回前按 `keyOf` 去重）
- Modify: `scripts/doc-coverage-baseline.json`（重新生成）
- Test: `scripts/__tests__/` 下若有 doc-coverage 测试则补一条；否则在任务报告里给探针证据

**根因（已实测）：** `scanFile` 的 `PUBLIC_FUNCTION_RE` 分支与 `PUBLIC_METHOD_RE` 分支会为同一行各 push 一次；`writeBaseline` 只 `sort` 不 `distinct` → 基线里出现 22 条重复（如 `MatrixDirectMessageService.ts::getDMRooms` ×4）。

- [ ] **Step 1: RED 证据**

Run: `python3 -c "import json;d=json.load(open('scripts/doc-coverage-baseline.json'));m=d['missing'];print('total',len(m),'unique',len(set(m)),'dupes',len(m)-len(set(m)))"`
Expected: `dupes 22`（数字以实测为准）。

- [ ] **Step 2: 在源头去重**

`scanFile` 的 `return missing` 之前改为：

```js
  // 同一行可能同时命中「具名函数」与「方法」两个正则（如 `const f = () => {}` 形式挂在
  // 对象/类上），会 push 两次；基线按 keyOf 存，重复条目只会稀释 ratchet 计数。
  const seen = new Set()
  return missing.filter((m) => {
    const k = keyOf(m)
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
```
（`keyOf` 已是 `src/scripts` 内既有函数，直接复用。）

- [ ] **Step 3: 重新生成基线并核对只降不升**

Run: `node scripts/check-doc-coverage.mjs --update && node scripts/check-doc-coverage.mjs; echo "exit=$?"`
Expected: `exit=0`；`count` 与 `missing.length` 相等且 **不高于** 改动前（只降不升）。
Run: `python3 -c "import json;d=json.load(open('scripts/doc-coverage-baseline.json'));m=d['missing'];print('count',d['count'],'len',len(m),'dupes',len(m)-len(set(m)))"` → `dupes 0`。

- [ ] **Step 4: 探针（守门仍可失败）**

临时新建 `src/utils/__probe_doc.ts` 写入一个无 JSDoc 的 `export const probeDocCoverage = () => 1`，复跑 `node scripts/check-doc-coverage.mjs` → 必须 FAIL 并点名；删除后复绿。

- [ ] **Step 5: 提交**

```bash
git add scripts/check-doc-coverage.mjs scripts/doc-coverage-baseline.json
git commit -m "fix(ci): doc-coverage 扫描按符号去重，基线清掉重复条目"
```

---

### Task 5: `AiAssistant.vue` 建议卡文案走 `t()`

**Files:**
- Modify: `src/mobile/views/my/AiAssistant.vue`（`suggestions` 定义 ~`:374-405`、模板 `:93,95`）
- Test: `src/mobile/views/my/__tests__/AiAssistant.test.ts`（若不存在则新建）

**已实测：** `suggestions` 的 `title`/`desc` 存的是裸 key（`ai_assistant.suggestions.translate` 等），模板 `{{ suggestion.title }}` 直接渲染 key；只有 `prompt` 走了 `t()`。

- [ ] **Step 1: RED 测试**

新建/扩展测试（`@vue/test-utils` + 挂载 `AiAssistant.vue`，mock 掉 heavy 依赖；断言渲染文本**不是** `ai_assistant.suggestions.` 前缀，且等于 `zh-CN` 文案）：

```ts
it('建议卡渲染中文文案而不是 i18n key', async () => {
  const wrapper = mount(AiAssistant, { global: { plugins: [pinia, i18n] } })
  await flushPromises()
  const text = wrapper.text()
  expect(text).not.toContain('ai_assistant.suggestions.')
  expect(text).toContain(i18n.global.t('ai_assistant.suggestions.translate'))
})
```
Run: `npx vitest run src/mobile/views/my/__tests__/AiAssistant.test.ts` → Expected: FAIL（含 `ai_assistant.suggestions.`）。

- [ ] **Step 2: 改为 computed + `t()`**

```ts
const suggestions = computed(() => [
  {
    id: 1,
    title: t('ai_assistant.suggestions.translate'),
    desc: t('ai_assistant.suggestions.translate_desc'),
    icon: 'mdi:translate',
    color: 'var(--tjg-color-info-500)',
    prompt: t('ai_assistant.suggestions.translate_prompt')
  },
  // …其余 3 项同样处理
])
```
模板不变（`suggestion.title` 现在是已翻译文本；`computed` 让语言切换即时生效）。

- [ ] **Step 3: GREEN + 守门**

Run: `npx vitest run src/mobile/views/my/__tests__/AiAssistant.test.ts && node scripts/check-i18n-refs.mjs && node scripts/check-i18n-dead-keys.mjs && npx vue-tsc --noEmit`
Expected: 全绿；`ai_assistant.suggestions.*` 从「注册表档存活」变成 `t()` 字面量引用。

- [ ] **Step 4: 提交**

```bash
git add src/mobile/views/my/AiAssistant.vue src/mobile/views/my/__tests__/AiAssistant.test.ts
git commit -m "fix(mobile): AI 助手建议卡文案改走 t() 并随语言切换"
```

---

### Task 6: `AppError.i18nKey` 接线（让错误提示用本地化文案）

**Files:**
- Modify: `src/common/errors.ts`（修正 267/275 行把 `translated.userMessage` 当 key 的用法）
- Modify: `src/common/errorHandler.ts`（在错误展示的单一出口优先用 `i18nKey` 翻译）
- Modify: `src/locales/errors/zh.ts`、`src/locales/errors/en.ts`（补齐缺失 key；**只补确实缺失的**）
- Test: `src/common/__tests__/errors.test.ts`、`src/common/__tests__/errorHandler.test.ts`（或既有对应测试）

**已实测：** 每个 `AppError` 变体都写 `i18nKey`（值如 `error.matrix.unknown`、`error.matrix.network`、`I18N_KEY_MAP[errcode]`），但生产代码无读取点；且 267/275 行的 `i18nKey: translated.userMessage` 存的是**已翻译文案**而不是 key（语义错位）。

- [ ] **Step 1: 核对每个 i18nKey 是否真的存在于语言包**

Run: `grep -rn "error.matrix" src/locales/errors/*.ts | head -20`
把 `errors.ts` 里出现的每个 key 与 `src/locales/errors/{zh,en}.ts` 对照，列出缺失清单（写进报告）。缺失的按既有命名风格补进两份语言包。

- [ ] **Step 2: RED 测试（UI 出口用本地化文案）**

在 `errorHandler` 的展示出口（`src/common/errorHandler.ts:98` 附近的 `handleMatrixError` / `toast` 路径）加测试：

```ts
it('展示 AppError 时优先使用 i18nKey 的本地化文案', () => {
  const appError = toAppError(Object.assign(new Error('token unknown'), { errcode: 'M_UNKNOWN_TOKEN' }))
  expect(resolveDisplayMessage(appError, (k) => `T:${k}`)).toBe(`T:${appError.i18nKey}`)
})
```
Run: `npx vitest run src/common/__tests__/errorHandler.test.ts` → Expected: FAIL（函数不存在 / 仍返回 `message`）。

- [ ] **Step 3: 最小实现**

- 新增并导出纯函数（放在 `errors.ts` 或 `errorHandler.ts`，二者取更贴近展示的一侧）：

```ts
/** 展示用文案：有 i18nKey 且能翻译出非 key 本身时用本地化文案，否则回落 message。 */
export const resolveDisplayMessage = (err: AppError, translate: (key: string) => string): string => {
  if (err.i18nKey) {
    const localized = translate(err.i18nKey)
    if (localized && localized !== err.i18nKey) return localized
  }
  return err.message
}
```
- 在真实展示出口（`handleMatrixError` 的 toast/日志分支）改用它，并修掉 267/275 行的 `i18nKey: translated.userMessage` → 改成对应的 key 常量（若确无 key，删掉该字段而不是塞文案）。

- [ ] **Step 4: GREEN + 守门**

Run: `npx vitest run src/common/__tests__/errors.test.ts src/common/__tests__/errorHandler.test.ts && node scripts/check-i18n-refs.mjs && node scripts/check-i18n-dead-keys.mjs && npx vue-tsc --noEmit`
Expected: 全绿（`i18nKey` 从「零读取」变为有生产读取点）。

- [ ] **Step 5: 提交**

```bash
git add src/common/errors.ts src/common/errorHandler.ts src/locales/errors/zh.ts src/locales/errors/en.ts src/common/__tests__/errors.test.ts
git commit -m "fix(core): AppError.i18nKey 接入展示出口，错误提示优先本地化文案"
```

---

### Task 7: 删除零消费的 3PID token 方法

**Files:**
- Modify: `src/composables/user/useAccount.ts:46-58,101-102`
- Modify: `src/services/matrix/user/MatrixAccountService.ts:307-340`
- Modify: `src/composables/user/__tests__/useAccount.test.ts`（删除对应断言/mock）
- Modify: `src/services/matrix/user/__tests__/MatrixAccountService.test.ts`（同上）

**已实测：** 两个方法只在 `useAccount` 定义/导出并被自身测试引用，生产零调用。

- [ ] **Step 1: RED 证据（零消费）**

Run: `grep -rn "requestEmailTokenFor3Pid\|requestMsisdnTokenFor3Pid" src/ | grep -v "__tests__" | grep -v "MatrixAccountService.ts\|useAccount.ts"`
Expected: 空（除定义处外无消费方）。

- [ ] **Step 2: 删除实现与导出**

删掉 `useAccount` 的两个包装与返回值里的两项、`MatrixAccountService` 的两个方法（含其 JSDoc），并同步删除两个测试文件里对它们的 `it(...)` 与 mock（**不得**只是删断言让测试变少——删的是整个「零消费 API」的测试）。

- [ ] **Step 3: 验证**

Run: `npx vue-tsc --noEmit && npx vitest run src/composables/user/__tests__/useAccount.test.ts src/services/matrix/user/__tests__/MatrixAccountService.test.ts && node scripts/check-doc-coverage.mjs`
Expected: 全绿；`check:doc-coverage` 不出现新缺失（删方法只会减少或持平）。

- [ ] **Step 4: 提交**

```bash
git add -A src/composables/user src/services/matrix/user
git commit -m "refactor(service): 删除零消费的 3PID token 请求方法"
```

---

### Task 8: `matrix_error.admin.score_range_invalid` 走翻译

**Files:**
- Modify: `src/services/matrix/admin/ReportService.ts:100-105`
- Test: `src/services/matrix/admin/__tests__/ReportService.test.ts:150-151`

**已实测：** `scoreReport` 直接 `throw new Error('matrix_error.admin.score_range_invalid')`，中文文案 `评分必须在 -100 到 0 之间`（`src/typings/i18n.d.ts:3399`）到不了 UI；同仓 `AdminFacadeService.ts:201` 用 `this.t('matrix_error...')` 是既有正确姿势。

- [ ] **Step 1: RED 测试（断言本地化文案）**

把既有断言改为：

```ts
await expect(service.scoreReport('!r:hs', '$e1', 5)).rejects.toThrow('评分必须在 -100 到 0 之间')
```
Run: `npx vitest run src/services/matrix/admin/__tests__/ReportService.test.ts` → Expected: FAIL（仍抛裸 key）。

- [ ] **Step 2: 最小实现**

`ReportService` 复用仓库既有的 i18n 取用方式（`AdminFacadeService` 的 `this.t` 来自基类；若 `ReportService` 无基类，则 `import { useI18nGlobal } from '@/services/i18n'` 并在方法内取 `t`，与 `src/utils/ComputedTime.ts` 同款）：

```ts
    if (score < -100 || score > 0) {
      throw new Error(useI18nGlobal().t('matrix_error.admin.score_range_invalid'))
    }
```

- [ ] **Step 3: GREEN + 守门**

Run: `npx vitest run src/services/matrix/admin/__tests__/ReportService.test.ts && node scripts/check-i18n-refs.mjs && node scripts/check-i18n-dead-keys.mjs && npx vue-tsc --noEmit`
Expected: 全绿；该 key 从「未被翻译」变为 `t()` 引用（判活证据升级）。

- [ ] **Step 4: 提交**

```bash
git add src/services/matrix/admin/ReportService.ts src/services/matrix/admin/__tests__/ReportService.test.ts
git commit -m "fix(service): 举报评分范围错误改抛本地化文案"
```

---

### Task 9: i18n `t()` key 参数收紧为 `I18nKeys`（Task 8 of 上一轮 DEFERRED 的具体设计）

**Files:**
- Create: `src/plugins/i18n/index.ts`（包装 `useI18n()`，收紧 `t` 的 key 类型）
- Modify: 分批迁移 `t('...')` 调用点（按目录分批，每批一个 commit）
- Test: `src/plugins/i18n/__tests__/typedT.test.ts`（类型层用 `vue-tsc` 验证 + 运行时冒烟）

**设计（已写入 §13(2)）：** `I18nKeys` 已由 `scripts/generate-i18n-types.mjs` 生成为字面量联合类型（`src/typings/i18n.d.ts`）。本轮把它接到 `useI18n()` 的 `t` 上，并给动态 key 一条显式出口。**禁止 `any`。**

- [ ] **Step 1: 先证明当前类型抓不到错误（RED 证据）**

Run:
```bash
printf 'ai_assistant.suggestions.this_key_was_deleted\n' > /tmp/probe.txt
grep -c "ai_assistant.suggestions.translate" src/typings/i18n.d.ts
```
构造真实 RED：临时在任意 `.vue` 里写 `t('this.key.does.not.exist.at.all')` → `npx vue-tsc --noEmit` 仍 **0 错误**（当前宽类型抓不到），删掉该临时改动。把该现象写进报告。

- [ ] **Step 2: 建包装并收紧类型**

```ts
// src/plugins/i18n/index.ts
import { useI18n } from 'vue-i18n'
import type { I18nKeys } from '@/typings/i18n'

export type TypedTranslate = (key: I18nKeys, params?: Record<string, unknown>) => string

/** 收紧 key 的 t()；动态 key 必须走 tDynamic() 显式出口。 */
export const useTypedI18n = (): { t: TypedTranslate; tDynamic: (key: string, params?: Record<string, unknown>) => string } => {
  const { t } = useI18n()
  return {
    t: t as unknown as TypedTranslate,
    tDynamic: (key, params) => t(key, params as never)
  }
}
```
（`I18nKeys` 的实际导出名/形态以 `src/typings/i18n.d.ts:1-20` 为准；若是 namespace 内的类型，按实际路径 import。若字面量联合过大导致 `vue-tsc` 明显变慢或爆栈，改用递归映射类型只展开到必需深度，并在报告里给出耗时对比。）

- [ ] **Step 3: 类型层可证伪探针（GREEN 证据）**

在临时文件（不提交）写 `const { t } = useTypedI18n(); t('this.key.does.not.exist')` → `npx vue-tsc --noEmit` 必须报 TS2345/TS2820 之类错误；写一个真实存在的 key → 0 错误。两者结果都记进报告。

- [ ] **Step 4: 分批迁移**

按目录分批（建议：`src/components` → `src/views` → `src/mobile` → `src/composables|hooks|utils|services`），每批：
把 `const { t } = useI18n()` 换成 `const { t } = useTypedI18n()`，把确属动态的 key 改用 `tDynamic()`（每个 `tDynamic` 都要在报告里列出理由）。每批跑 `npx vue-tsc --noEmit`，**批次之间单独提交**（`refactor(i18n): 收紧 <目录> 的 t() key 类型`）。禁止用 `as any` 绕过。

- [ ] **Step 5: 收尾验证**

Run: `npx vue-tsc --noEmit && node scripts/check-i18n-refs.mjs && node scripts/check-i18n-dead-keys.mjs && npx vitest run --maxWorkers=2`
Expected: 全绿；报告里给出「迁移目录数 / 动态 key 出口数 / vue-tsc 耗时前后」。
若某目录因规模无法在本轮完成，把剩余目录写成 §13 的 follow-up（**不允许**留下半迁移且类型不一致的状态）。

- [ ] **Step 6: 提交**

```bash
git add src/plugins/i18n src/typings/i18n.d.ts
git commit -m "feat(i18n): t() key 参数收紧为 I18nKeys，动态 key 走显式出口"
```
