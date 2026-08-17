# 项目优化实施方案（基于 2026-08-17 深度排查）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复聊天分页、安全、配置一致性、代码质量与仓库卫生等五类排查发现的问题，让项目达到守门命令全绿、运行时无崩溃、配置无漂移的状态。

**Architecture:** 前端 Vue3+Pinia+TS（消息走 `MatrixEventService` → `chatStore` → `ChatMessageList` 三层），后端 Rust/Tauri（HTTP 走 reqwest）。修复集中在：消息分页服务、Tauri capability/CSP 配置、依赖清单与文档。

**Tech Stack:** Vue 3 / Pinia / TypeScript 6 / Vite 8 / Tauri 2.11 / Rust (SeaORM 1.1.19) / vue-virtual-scroller。

## Global Constraints

- 每改动必须跑守门命令：`pnpm typecheck`（0 错误）、`pnpm test:run`（全绿）、`pnpm check`（Biome 0 错误）、`pnpm check:ratchet`、`pnpm check:doc-coverage`、`pnpm check:sdk-boundary`。
- 不新增硬编码颜色（`#xxx`/`rgb()`）；图标用 SVG；`.vue` 超 800 行须拆分。
- 组件不得直接调用 matrix-js-sdk，必须走 `src/services/matrix/` 服务层。
- 提交走 `pnpm commit`（Conventional Commits）。
- 不提交 `.env`/`.env.local`；不动 `.rules` 文件（除非用户明确要求）。
- 本次已修复项（白屏、管理员 TLS、类方法 this 丢失）不再重复，仅作回归守护。

---

## 已修复项（回归守护基线，无需重做）

- 白屏：`package.json` 已提升 6 个 CJS 依赖 + `.gitignore` 加 `.pnpm-store/`。
- 管理员验证 TLS：`src-tauri/src/command/admin_command.rs`、`upload_command.rs` 已加 `danger_accept_invalid_certs(cfg!(debug_assertions))`。
- 聊天卡死：`renderMessage/index.vue`、`ChatMsgMultiChoose.vue` 已修复类方法解构丢 `this`。
- 服务器侧：`@admin:matrix.test` 已提升为 super_admin。

> 以下任务按优先级排序，每个任务独立可测、可单独提交。

---

## Phase 1：聊天分页修复（P0，核心功能）

### Task 1: 修复 getPagedRoomMessages 分页方向与历史拉取

**Files:**
- Modify: `src/services/matrix/MatrixEventService.ts:325-379`（`getPagedRoomMessages`）
- Test: `src/services/matrix/__tests__/MatrixEventService.test.ts`（若不存在则创建，参照 `src/services/matrix/**/__tests__/` 现有模式）

**Interfaces:**
- Consumes: `matrixRoomQueryService.getRoom(roomId, false)`、`room.getLiveTimeline().getEvents()`、`this.getClient()`、`isMessageEventType`、`convertEventToMessage`。
- Produces: `Promise<{ messages: MessageType[]; isLast: boolean; cursor: string }>`（签名不变，语义修正）。

**问题**（静态分析已确认）：
1. 初始加载 `slice(0, pageSize)` 取的是**最旧**一页，而非最新。
2. `loadMore` 用 `findIndex(cursor)` 后 `slice(start, start+pageSize)` 是往**新**方向翻，与「加载更早历史」相反。
3. `cursor`/`isLast` 基于**未过滤事件**（含 m.room.member/reaction 等）索引计算，与 `messages`（只含消息事件）错位；`findIndex` 返回 -1 时 `slice(-1,…)` 产生空页 → `isLast=false + cursor=''` → 死循环重载。
4. `client.scrollback` 仅在 `events.length === 0` 时触发，SlidingSync timeline 非空时永远不拉更早历史。

- [ ] **Step 1: 写失败测试（先锁定语义）**

在测试中 mock `matrixRoomQueryService.getRoom` 返回一个 `getLiveTimeline().getEvents()` 返回 50 条旧→新事件（id 递增）的 room，断言：

```ts
// 初始加载：应返回最新 pageSize 条，且 isLast 由是否有更早消息决定
const first = await matrixEventService.getPagedRoomMessages(roomId, 20, '')
expect(first.messages.length).toBe(20)
expect(first.messages[0].message.id).toBe('event-31') // 第 31 条（最新 20 条里最旧的）
expect(first.isLast).toBe(false) // 还有更早的 30 条

// loadMore：应返回更早的一页
const second = await matrixEventService.getPagedRoomMessages(roomId, 20, first.cursor)
expect(second.messages[0].message.id).toBe('event-11') // 更早的 20 条
expect(second.isLast).toBe(false)

// 最后一次 loadMore：到达最旧，isLast 应为 true
const last = await matrixEventService.getPagedRoomMessages(roomId, 20, second.cursor)
expect(last.messages.length).toBe(10) // 剩余 10 条
expect(last.isLast).toBe(true)
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest run src/services/matrix/__tests__/MatrixEventService.test.ts`
Expected: FAIL（当前返回最旧一页，断言不匹配）

- [ ] **Step 3: 实现修复**

将 `getPagedRoomMessages` 主体替换为（events 为旧→新有序）：

```ts
let timeline = room.getLiveTimeline()
let events = timeline.getEvents()

// 首次加载或 timeline 为空时，从服务端补历史
if (events.length === 0) {
  try {
    const client = this.getClient()
    await client.scrollback(room, Math.max(pageSize, 30))
    timeline = room.getLiveTimeline()
    events = timeline.getEvents()
  } catch (err) {
    logger.error(`scrollback 获取历史消息失败: ${roomId}`, err)
    return { messages: [], isLast: true, cursor: '' }
  }
}

// 旧→新有序。cursor 表示「已加载的最旧消息 id」。
let startIndex: number
let endIndex: number
if (!cursor) {
  // 首次：取最新一页
  startIndex = Math.max(0, events.length - pageSize)
  endIndex = events.length
} else {
  // loadMore：取 cursor 之前（更早）的一页
  const cursorIndex = events.findIndex((e) => e.getId() === cursor)
  if (cursorIndex < 0) {
    // cursor 不在当前 timeline（SlidingSync 重排）：安全终止，避免空页死循环
    logger.warn(`[getPagedRoomMessages] cursor 未命中，终止分页: ${roomId}`)
    return { messages: [], isLast: true, cursor }
  }
  startIndex = Math.max(0, cursorIndex - pageSize)
  endIndex = cursorIndex
}

const pageEvents = events.slice(startIndex, endIndex)
const messages: MessageType[] = []
for (const event of pageEvents) {
  if (isMessageEventType(event.getType())) {
    const msg = this.convertEventToMessage(event, room)
    if (msg) messages.push(msg)
  }
}

// isLast 只基于「是否已到最旧」；cursor 始终指向本页最旧一条
return {
  messages,
  isLast: startIndex <= 0,
  cursor: pageEvents[0]?.getId() || cursor
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm vitest run src/services/matrix/__tests__/MatrixEventService.test.ts`
Expected: PASS

- [ ] **Step 5: 补充「更早历史需 scrollback」逻辑**

在 `loadMore` 分支、`startIndex === 0 && !isLast` 且 timeline 仍有更早 token 时，先 `await client.scrollback(room, pageSize)` 再重取 `events`。具体以 `timeline.getPaginationToken(EventTimeline.BACKWARDS)` 是否为空判断是否还有更早历史。写一条集成测试覆盖「本地 timeline 耗尽但服务端还有更早消息」场景。

- [ ] **Step 6: 提交**

```bash
git add src/services/matrix/MatrixEventService.ts src/services/matrix/__tests__/MatrixEventService.test.ts
pnpm commit  # fix(messaging): 修正消息分页方向与 isLast/cursor 语义
```

---

## Phase 2：安全加固（P1）

### Task 2: 收窄桌面 fs 读取权限

**Files:**
- Modify: `src-tauri/capabilities/default.json:166-186`（`fs:read-files` 的 allow 列表）

**问题**：当前允许 `$HOME/**`、`$DESKTOP/**`、`$PICTURES/**`、`$DOCUMENTS/**`，XSS 即近全盘可读。

- [ ] **Step 1:** 删除 `$HOME/**`、`$DESKTOP/**`、`$PICTURES/**`、`$DOCUMENTS/**` 四项，仅保留 `$APPDATA/**`、`$LOCALAPPDATA/**`、`$DOWNLOAD/**`、`$RESOURCE/**`（与 `fs:write-files` 对齐）。
- [ ] **Step 2:** 全局搜 `src/` 是否依赖这四项路径读取（`grep -rn "DESKTOP\|PICTURES\|DOCUMENTS\|readTextFile" src/`），若有则改为 `$APPDATA` 或 dialog 选择路径。
- [ ] **Step 3:** 跑 `pnpm typecheck && pnpm test:run` 确认无回归，提交：`fix(security): 收窄桌面 fs 读取权限`。

### Task 3: 将 .env 移出 git 跟踪

**Files:**
- Modify: `.gitignore`（已含 `.env`，但 `.env` 已被历史提交，需 untrack）

- [ ] **Step 1:** `git rm --cached .env`（保留本地文件，仅移出版本库）。
- [ ] **Step 2:** 确认 `.env.example` 仍是唯一被跟踪的模板，且 `.env.example` 字段与 `.env.local` 对齐（当前 `.env.example` 用 `localhost:8008`、`.env.local` 用 `https://matrix.test`，需统一说明）。
- [ ] **Step 3:** 提交：`chore: 将 .env 移出 git 跟踪，统一 .env.example 字段`。

### Task 4: 收敛生产 CSP 并区分 dev/prod

**Files:**
- Modify: `src-tauri/tauri.conf.json:50`（`app.security.csp`）
- Modify: `index.html:5`（dev CSP meta）

**问题**：生产 CSP `connect-src` 用 `https: wss:` 全协议放行、含 `localhost:6130`；`index.html` 另有一套含 `repo.huaweicloud.com:*` 的 dev CSP。

- [ ] **Step 1:** 生产 CSP 收紧为：`connect-src` 只保留 `ipc:`、`https://matrix.test`（及 homeserver 实际域名，从 env 注入）、`wss:`；`script-src 'self' 'wasm-unsafe-eval'` 保留（wasm crypto 需要）；移除 `localhost:6130`。
- [ ] **Step 2:** `index.html` 的 CSP meta 改为仅在 dev 生效（通过 Vite `transformIndexHtml` 按 `mode !== 'production'` 注入，或直接删除该 meta 依赖 tauri.conf.json 统一管理），去掉 `repo.huaweicloud.com:*` 与 `localhost:*` 通配。
- [ ] **Step 3:** 验证：dev 启动能连 matrix.test，生产 `pnpm build` 后 CSP 无 localhost。提交：`fix(security): 收敛生产 CSP`。

### Task 5: updater tauriKey 外置

**Files:**
- Modify: `src-tauri/tauri.conf.json:76`、`.env.local`（不提交）

- [ ] **Step 1:** 将 `endpoints` 里的 `tauriKey=geShj8UB7zd1DyrM_YFNdg` 移到环境变量（Tauri 配置支持 `{{ env.X }}` 或构建脚本注入），本地值放 `.env.local`。
- [ ] **Step 2:** 提交：`fix(security): updater tauriKey 移出仓库`。

---

## Phase 3：配置一致性与依赖卫生（P1）

### Task 6: 统一 Node 引擎约束

**Files:**
- Modify: `package.json:7`（engines）、`.nvmrc`

**问题**：app engines 允许 node 20（`^20.19.0`），但 vendored SDK `engines.node: >=22.0.0`，且 `.npmrc engine-strict=true`，node 20 上 `pnpm install` 会失败；`.nvmrc` 已 pin 22.12.0。

- [ ] **Step 1:** 将 app engines 改为 `">=22.12.0 <25"`（去掉 20 分支），与 SDK、`.nvmrc`、`.npmrc` 对齐。
- [ ] **Step 2:** 提交：`chore: 统一 Node 引擎约束为 >=22.12.0`。

### Task 7: 移除未引用依赖与死 chunk 配置

**Files:**
- Modify: `package.json`（dependencies）
- Modify: `build/config/chunks.ts:49,55`

- [ ] **Step 1:** `pnpm remove tlbs-map-vue`（`src/` 下 0 引用，且带原生依赖）。
- [ ] **Step 2:** 删除 `chunks.ts` 里 `node_modules/echarts`→`chart-vendor`、`node_modules/axios`→`axios` 两条死 chunk（二者非直接依赖且无引用）。
- [ ] **Step 3:** `pnpm install && pnpm typecheck`，提交：`chore: 移除未引用依赖与死 chunk 配置`。

### Task 8: 修正 AGENTS.md 文档漂移

**Files:**
- Modify: `.rules`（AGENTS.md 指向它）—— **注意：需用户明确同意后改**，否则跳过并仅在 plan 中记录。

- [ ] **Step 1:** 核对并更新：Vite 7 → 8.2.0、`tauri = "2.9.5"` → 2.11.1/CLI 2.11.4、插件清单补 `http / process / upload / sql / window-state / mic-recorder / safe-area-insets / single-instance`。
- [ ] **Step 2:** 提交：`docs: 同步 AGENTS.md 技术栈版本`（若用户同意改 .rules）。

---

## Phase 4：代码质量收口（P2）

### Task 9: 修复 SDK 边界违规

**Files:**
- Modify: `src/services/matrix/notifications/MatrixPushService.ts:2`
- Modify: `src/types/matrix-js-sdk-augmentations.d.ts`（如类型缺失则补）

- [ ] **Step 1:** 将 `import type { ICreatePushRuleRequest } from 'matrix-js-sdk/push'` 改为从顶层 `matrix-js-sdk` 导入（或在 augmentation 里补声明）。
- [ ] **Step 2:** 跑 `pnpm check:sdk-boundary` 确认 0 新增违规。提交：`fix(sdk-boundary): MatrixPushService 裸导入收口`。

### Task 10: 修复 Biome 8 错误

**Files:**
- Modify: `src/services/matrix/admin/FederationService.ts:14`（unused private member）
- Modify: `src/services/matrix/admin/__tests__/{FederationService,ReportService,BackgroundUpdateService}.test.ts`（unused vars + format）
- Modify: `src/services/matrix/media/__tests__/RtcTransports.test.ts:3`（unused import）
- Modify: `src/services/matrix/notifications/MatrixPushService.ts`、`src/services/matrix/room/TimelineService.ts`（import 排序）

- [ ] **Step 1:** 跑 `pnpm check:write`（Biome 自动修复 import 排序/format）。
- [ ] **Step 2:** 手动删 unused 成员/变量/导入（删除而非下划线前缀，遵循 AGENTS.md）。
- [ ] **Step 3:** `pnpm check` 确认 0 错误。提交：`style: 清理 Biome lint 错误`。

### Task 11: 补 39 个未文档化方法

**Files:**
- Modify: `src/services/matrix/admin/AdminFacadeOpsMethods.ts`（及 `check:doc-coverage` 报出的其它文件）

- [ ] **Step 1:** `pnpm check:doc-coverage` 列出全部 39 个新未文档化方法。
- [ ] **Step 2:** 为每个方法补 JSDoc（一句话说明职责 + 参数/返回，参照已有方法风格）。
- [ ] **Step 3:** `pnpm check:doc-coverage` 确认 0 新增。提交：`docs(admin): 补齐 admin 方法文档`。

### Task 12: 修复 authGuard 废弃 next() 与 Login 浏览器守卫

**Files:**
- Modify: `src/router/authGuard.ts:44-82`（7 处 `next()`）
- Modify: `src/views/loginWindow/Login.vue:123-129`（`getCurrentWindow()` 守卫）

- [ ] **Step 1:** 将 `return next()` → `return true`、`return next(path)` → `return path`、`return next(false)` → `return false`，移除 `NavigationGuardNext` 参数。
- [ ] **Step 2:** Login.vue 的 `getCurrentWindow().setSize()` 外层改用 `hasTauriRuntime()` 判断（`import { hasTauriRuntime } from '@/utils/AppHarness'`），无 runtime 时跳过。
- [ ] **Step 3:** `pnpm typecheck && pnpm test:run`，确认无 `VUE_ROUTER_R0025` 警告。提交：`refactor: authGuard 改用返回值导航 + Login 浏览器守卫`。

---

## Phase 5：运行时与仓库卫生（P2）

### Task 13: 排查 FriendManager 时序矛盾

**Files:**
- 排查：`src/services/matrix/MatrixClientService.ts`（扩展注册时序）、`src/services/matrix/friends/MatrixFriendSync*`

**问题**：启动日志「扩展健康断言 FriendManager 扩展已注册」之后又「FriendManager 未在客户端上找到，已降级到好友 REST 接口」。

- [ ] **Step 1:** 定位 FriendManager 的 `extendMatrixClient` 调用时机 vs `getFriendManager` 首次访问时机，确认是否是 client 重建后扩展未重新注册。
- [ ] **Step 2:** 修复时序（client 重建后重新注册 manager，或在访问前懒注册）。提交：`fix(friends): 修复 client 重建后 FriendManager 未注册`。

### Task 14: 清理仓库游离文件

**Files:**
- 删除：根目录 3 个 `_tmp_*.md`（0 字节）、`vendor/matrix-js-sdk.tgz.bak.1786949673`
- Modify: `.gitignore`（补 `_tmp_*` 与 `vendor/*.tgz.bak.*` 规则）
- 提交：`src/typings/components.d.ts`（已改动的自动生成 dts，随组件提交）

- [ ] **Step 1:** 删除游离文件；`.gitignore` 加 `_tmp_*`、`*.tgz.bak.*`。
- [ ] **Step 2:** `git status` 确认干净；提交：`chore: 清理游离文件与 gitignore`。

### Task 15: OpenClaw 版本探测与 presence 心跳（可选优化）

**Files:**
- 排查：`src-tauri/src/command/ai_command.rs`（version=None）、`src/services/matrix/user/MatrixPresenceService.ts`（心跳）

- [ ] **Step 1:** OpenClaw `version=None`：确认 `openclaw --version` 输出格式与解析正则是否匹配，修复解析。
- [ ] **Step 2:** presence 心跳改为固定定时（如 45s），避免在房间切换/sync 触发点重复发送。
- [ ] **Step 3:** 提交：`fix: 修复 OpenClaw 版本探测与 presence 心跳`。

---

## 自检清单

- **覆盖度**：五类问题（分页、安全、配置、代码质量、运行时/卫生）均有对应任务；已修复项列入回归基线。
- **类型一致**：Task 1 的 `getPagedRoomMessages` 返回签名 `{messages,isLast,cursor}` 保持不变，调用方 `messageLoading.ts` 无需改动；cursor 语义从「页末最新」改为「页首最旧」，需在 Step 5 同步确认 `messageLoading.ts` 的 `loadMore` 用 `currentMessageOptions.cursor` 传入（已是）。
- **无占位符**：各任务含具体文件、代码片段、验证命令与提交信息。

## 建议执行顺序

1. Task 1（分页，影响核心使用）→ Task 2-5（安全，独立低风险）→ Task 6-8（配置/文档）→ Task 9-12（代码质量）→ Task 13-15（运行时/卫生）。
2. 每完成一个 Phase 跑一次完整守门：`pnpm typecheck && pnpm test:run && pnpm check && pnpm check:ratchet && pnpm check:doc-coverage && pnpm check:sdk-boundary`。
