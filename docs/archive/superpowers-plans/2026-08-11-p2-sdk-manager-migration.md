# P2 SDK Manager 迁移实施方案

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将审计文档 `2026-08-11-sdk-frontend-integration-audit.md` 中 7 个 P2 迁移单元（A8/A9/A10/A11/B8/B11/B12）从 `client.http.authedRequest` / `client.sendEvent` / 裸 fetch 直连迁移到 `client.getXxxManager()` 调用模式，B10（MatrixLocationService）单独评估不在本方案。

**Architecture:** 按"死代码优先清理 → 低风险直接替换 → 高复杂度最后"顺序迁移。每单元采用 TDD：先写失败测试验证 Manager 调用路径，再替换实现，最后清理死常量。VoiceManager 无 `getRtcTransports` 方法保留直连；CaptchaManager 未默认注册需在 MatrixClientService 初始化时手动 `extendMatrixClient()`；B8 burn 部分生产代码已用 `MatrixBurnAfterReadService`，仅删除 SynapsePrivacyExtensionService 中的死代码 burn 方法。

**Tech Stack:** TypeScript 6.0.3, Vue 3 服务层, matrix-js-sdk Manager (BaseManager + withRetry), Vitest + MSW 合同测试, Biome lint。

## Global Constraints

- TypeScript 6.0.3（`vue-tsc` 兼容约束），禁止升级。
- 服务层禁止直接 import `matrix-js-sdk` 内部模块（`matrix-js-sdk/src/*`）；必须通过 `client.getXxxManager()` 访问器。`matrix-js-sdk/captcha` 等公开入口除外。
- 所有方法对外签名（参数/返回类型）保持不变，调用方零改动。
- 验收命令（必须 0 错误）：`pnpm vue-tsc --noEmit`、`pnpm test:run`、`pnpm check:ratchet`、`pnpm check:sdk-boundary`、`pnpm quality:no-raw-fetch`、`pnpm check`。
- CaptchaManager 未在 `manager-extensions/index.ts` 默认注册（`includeCaptcha` 字段缺失），需在 `MatrixClientService` 初始化时手动调用 `extendMatrixClient()` 或在 manager-extensions 配置中开启。
- VoiceManager 无 `getRtcTransports` 方法（该方法走 MSC4143 unstable 端点），保留为 `client.http.authedRequest` 直连。
- SearchManager 方法名是 `searchMessageText`（非 `searchMessages`）；无 `publicRooms` 等价方法，保留 `client.publicRooms`。
- InviteBlocklistManager 方法名是 `getBlocklist`/`setBlocklist`/`getAllowlist`/`setAllowlist`（非 `getInviteBlocklist` 等）；失败时返回缓存值不抛错。
- BurnAfterReadManager 已在 `MatrixBurnAfterReadService` 集成，本方案仅清理 `SynapsePrivacyExtensionService` 中的死代码 burn 方法。
- `MATRIX_PATHS.*` 常量清理必须通过 `pnpm check:ratchet` 守护。

---

## File Structure

| 文件 | 角色 | 操作 |
|---|---|---|
| `src/services/matrix/extensions/SynapsePrivacyExtensionService.ts` | 隐私扩展（burn/防截屏/私密聊天） | 修改：删除 3 个 burn 方法（死代码） |
| `src/services/matrix/extensions/SynapseCaptchaService.ts` | 验证码服务 | 修改：迁移到 `client.getCaptchaManager()` |
| `src/services/matrix/MatrixClientService.ts` | 客户端初始化 | 修改：注册 CaptchaManager 扩展 |
| `src/services/matrix/extensions/SynapseInviteListService.ts` | 邀请名单服务（死代码） | 删除 |
| `src/services/matrix/room/RoomOperations.ts` | 房间操作 | 修改：invite blocklist 4 方法迁移到 `client.getInviteBlocklistManager()` |
| `src/services/matrix/admin/ReportService.ts` | 举报服务 | 修改：`reportEvent` 迁移到 `client.getReportingManager()` |
| `src/services/matrix/media/MatrixVoiceService.ts` | 语音服务 | 修改：迁移到 `client.getVoiceManager()`（保留 `getRtcTransports`） |
| `src/services/matrix/MatrixSearchService.ts` | 搜索服务 | 修改：消息/用户搜索迁移到 `client.getSearchManager()` |
| `src/services/matrix/room/AccountDataService.ts` | 账户数据服务 | 修改：迁移到 `client.getAccountDataManager()` |
| `src/services/matrix/paths/voice.ts` | VOICE 路径常量 | 修改：删除已迁移方法对应的常量 |
| `src/services/matrix/paths/room.ts` | ROOM 路径常量 | 修改：删除 INVITE_BLOCKLIST/INVITE_ALLOWLIST |
| `src/services/matrix/paths/__tests__/dead-constants.test.ts` | 死常量契约测试 | 修改：新增 VOICE/ROOM 死常量守护 |
| 对应 `__tests__/*.test.ts` | 单元/合同测试 | 修改：mock 从 `client.http.authedRequest` 改为 `client.getXxxManager().*` |

---

## Task 1: B8 — 删除 SynapsePrivacyExtensionService 中的死代码 burn 方法

**Files:**
- Modify: `src/services/matrix/extensions/SynapsePrivacyExtensionService.ts:7-66`（删除 `BurnStats` 接口 + 3 个 burn 方法）
- Modify: `src/services/matrix/__tests__/synapseRust.rooms.contract.test.ts:170-200`（删除 burn 测试用例，或改测 `matrixBurnAfterReadService`）

**Interfaces:**
- Consumes: `MatrixBurnAfterReadService`（已集成 `getBurnAfterReadManager()`，生产代码已用此服务）
- Produces: `SynapsePrivacyExtensionService` 仅保留 `enableAntiScreenshot`/`isAntiScreenshotEnabled`/`createPrivateChat`

**Context:** Grep 确认 `synapsePrivacyExtensionService.getBurnStats/enableBurnAfterRead/isBurnAfterReadEnabled` 仅被 `synapseRust.rooms.contract.test.ts` 调用，生产代码 0 命中。`SynapsePrivacyExtensionService.createPrivateChat` 内部调用 `this.enableBurnAfterRead`，需改为调用已集成的 `matrixBurnAfterReadService`。

- [ ] **Step 1: 写失败测试——验证 SynapsePrivacyExtensionService 不再有 burn 方法**

在 `src/services/matrix/extensions/__tests__/SynapsePrivacyExtensionService.test.ts`（新建或追加）中：

```typescript
import { synapsePrivacyExtensionService } from '../SynapsePrivacyExtensionService'

describe('SynapsePrivacyExtensionService burn 死代码已移除', () => {
  it('实例上不再有 getBurnStats 方法', () => {
    expect((synapsePrivacyExtensionService as unknown as { getBurnStats?: unknown }).getBurnStats).toBeUndefined()
  })

  it('实例上不再有 enableBurnAfterRead 方法', () => {
    expect((synapsePrivacyExtensionService as unknown as { enableBurnAfterRead?: unknown }).enableBurnAfterRead).toBeUndefined()
  })

  it('实例上不再有 isBurnAfterReadEnabled 方法', () => {
    expect((synapsePrivacyExtensionService as unknown as { isBurnAfterReadEnabled?: unknown }).isBurnAfterReadEnabled).toBeUndefined()
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest run src/services/matrix/extensions/__tests__/SynapsePrivacyExtensionService.test.ts`
Expected: FAIL（方法仍存在）

- [ ] **Step 3: 删除 burn 方法**

在 `SynapsePrivacyExtensionService.ts` 中：
1. 删除 `BurnStats` 接口（L7-11）
2. 删除 `getBurnStats` 方法（L18-30）
3. 删除 `enableBurnAfterRead` 方法（L32-48）
4. 删除 `isBurnAfterReadEnabled` 方法（L50-66）
5. 在 `createPrivateChat` 方法中，将 `await this.enableBurnAfterRead(roomId, true)` 改为 `await matrixBurnAfterReadService.enableBurnAfterRead(roomId, undefined)`（导入 `matrixBurnAfterReadService`）

```typescript
import { matrixBurnAfterReadService } from '../messaging/MatrixBurnAfterReadService'
// ...
// 在 createPrivateChat 内：
await matrixBurnAfterReadService.enableBurnAfterRead(roomId, undefined)
```

- [ ] **Step 4: 更新合同测试**

在 `synapseRust.rooms.contract.test.ts` 中删除 L170-200 的 3 个 burn 测试用例（这些端点已由 `MatrixBurnAfterReadService` 的合同测试覆盖）。

- [ ] **Step 5: 运行测试确认通过**

Run: `pnpm vitest run src/services/matrix/extensions/__tests__/SynapsePrivacyExtensionService.test.ts src/services/matrix/__tests__/synapseRust.rooms.contract.test.ts`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add src/services/matrix/extensions/SynapsePrivacyExtensionService.ts src/services/matrix/extensions/__tests__/SynapsePrivacyExtensionService.test.ts src/services/matrix/__tests__/synapseRust.rooms.contract.test.ts
git commit -m "refactor(service): remove dead burn methods from SynapsePrivacyExtensionService

getBurnStats/enableBurnAfterRead/isBurnAfterReadEnabled were only called
by tests, never by production code. Production already uses
MatrixBurnAfterReadService (which integrates getBurnAfterReadManager()).
createPrivateChat now delegates to matrixBurnAfterReadService."
```

---

## Task 2: A10/B7 — 迁移 SynapseCaptchaService 到 CaptchaManager

**Files:**
- Modify: `src/services/matrix/MatrixClientService.ts`（注册 CaptchaManager 扩展）
- Modify: `src/services/matrix/extensions/SynapseCaptchaService.ts`（迁移 3 个方法）
- Modify: `src/services/matrix/__tests__/synapseRust.rooms.contract.test.ts:370-400`（更新 captcha 测试）

**Interfaces:**
- Consumes: `client.getCaptchaManager()` → `sendCaptcha(captchaType, target, templateName?, version?)` / `verifyCaptcha(captchaId, code, version?)` / `getCaptchaStatus(captchaId, version?)`
- Produces: `SynapseCaptchaService` 对外签名不变（`sendCaptcha(mobile, captchaType)` / `verifyCaptcha(captchaId, code)` / `getCaptchaStatus(captchaId)`）

**Context:** CaptchaManager 未默认注册。需在 MatrixClientService 初始化时手动调用 `extendMatrixClient()`。CaptchaManager 的 `sendCaptcha` 参数顺序是 `(captchaType, target, templateName?, version?)`，与前端 `(mobile, captchaType)` 相反，需适配。

- [ ] **Step 1: 注册 CaptchaManager 扩展**

在 `MatrixClientService.ts` 中找到 manager extensions 初始化代码（搜索 `extendMatrixClientWithManagers` 或 `initializeManagerExtensions`），添加：

```typescript
import { extendMatrixClient as extendCaptcha } from 'matrix-js-sdk/captcha'
// 在其他 extendMatrixClient 调用后：
extendCaptcha()
```

如果 `matrix-js-sdk/captcha` 入口不可用，则从 `matrix-js-sdk/src/captcha` 导入（需验证 package.json exports）。

- [ ] **Step 2: 写失败测试——验证 captcha 走 CaptchaManager**

在 `synapseRust.rooms.contract.test.ts` 的 captcha 测试块中，更新断言：

```typescript
it('sendCaptcha 走 CaptchaManager.sendCaptcha', async () => {
  // MSW handler 已命中 /register/captcha/send，验证响应
  const result = await synapseCaptchaService.sendCaptcha('+8613800138000', 'sms')
  expect(result.success).toBe(true)
  expect(result.captchaId).toBeTruthy()
})
```

- [ ] **Step 3: 运行测试确认失败**

Run: `pnpm vitest run src/services/matrix/__tests__/synapseRust.rooms.contract.test.ts -t "captcha"`
Expected: FAIL（当前走 runtime fetch，未走 CaptchaManager）

- [ ] **Step 4: 迁移 SynapseCaptchaService**

替换 `SynapseCaptchaService.ts` 三个方法体：

```typescript
import { matrixClientService } from '../MatrixClientService'
import type { CaptchaManager } from 'matrix-js-sdk/captcha'

class SynapseCaptchaService {
  private getCaptcha(): CaptchaManager {
    const client = matrixClientService.getClient()
    if (!client) throw new Error('客户端未初始化')
    const fn = (client as unknown as { getCaptchaManager?: () => CaptchaManager }).getCaptchaManager
    if (typeof fn !== 'function') {
      throw new Error('MatrixClient.getCaptchaManager is not available; SDK 未初始化')
    }
    return fn.call(client)
  }

  async sendCaptcha(mobile: string, captchaType: string): Promise<{ success: boolean; captchaId?: string }> {
    try {
      const response = await this.getCaptcha().sendCaptcha(captchaType, mobile)
      logger.info(`[SynapseRust] 发送验证码成功: ${mobile}`)
      return {
        success: !!response.captcha_id,
        captchaId: response.captcha_id
      }
    } catch (err) {
      logger.error(`[SynapseRust] 发送验证码失败: ${err}`)
      throw err
    }
  }

  async verifyCaptcha(captchaId: string, code: string): Promise<boolean> {
    try {
      const response = await this.getCaptcha().verifyCaptcha(captchaId, code)
      logger.info(`[SynapseRust] 验证码校验成功: ${captchaId}`)
      return response.verified ?? false
    } catch (err) {
      logger.error(`[SynapseRust] 验证码校验失败: ${err}`)
      return false
    }
  }

  async getCaptchaStatus(captchaId: string): Promise<Record<string, unknown>> {
    try {
      const response = await this.getCaptcha().getCaptchaStatus(captchaId)
      logger.info(`[SynapseRust] 获取验证码状态成功: ${captchaId}`)
      return response as unknown as Record<string, unknown>
    } catch (err) {
      logger.error(`[SynapseRust] 获取验证码状态失败: ${err}`)
      return {}
    }
  }
}
```

删除 `extends SynapseExtensionHttpBase`（不再需要 runtime fetch）。

- [ ] **Step 5: 运行测试确认通过**

Run: `pnpm vitest run src/services/matrix/__tests__/synapseRust.rooms.contract.test.ts -t "captcha"`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add src/services/matrix/MatrixClientService.ts src/services/matrix/extensions/SynapseCaptchaService.ts src/services/matrix/__tests__/synapseRust.rooms.contract.test.ts
git commit -m "refactor(service): migrate SynapseCaptchaService to CaptchaManager

sendCaptcha/verifyCaptcha/getCaptchaStatus now go through
client.getCaptchaManager() instead of runtime fetch. Registers
CaptchaManager extension in MatrixClientService init (not default-registered).
Parameter order adapted: SDK (captchaType, target) vs frontend (mobile, captchaType)."
```

---

## Task 3: A11/B9 — 迁移 RoomOperations invite blocklist 到 InviteBlocklistManager，删除 SynapseInviteListService

**Files:**
- Modify: `src/services/matrix/room/RoomOperations.ts:225-263`（4 个 invite blocklist 方法）
- Delete: `src/services/matrix/extensions/SynapseInviteListService.ts`
- Modify: `src/services/matrix/__tests__/synapseRust.rooms.contract.test.ts:220-260`（更新 invite list 测试）
- Modify: `src/services/matrix/room/__tests__/RoomOperations.test.ts:580-620`（更新 mock）

**Interfaces:**
- Consumes: `client.getInviteBlocklistManager()` → `getBlocklist(roomId): Promise<string[]>` / `setBlocklist(roomId, userIds): Promise<IBlocklistResult>` / `getAllowlist(roomId): Promise<string[]>` / `setAllowlist(roomId, userIds): Promise<IAllowlistResult>`
- Produces: `RoomOperations` 对外签名不变

**Context:** Grep 确认 `synapseInviteListService` 仅被测试调用，生产代码 0 命中。`RoomOperations.getInviteBlocklist` 等通过 Facade 暴露但也无生产消费者（SecuritySettings.vue 用 localStorage）。两套实现均为死代码，但 `RoomOperations` 是主路径，迁移它；`SynapseInviteListService` 直接删除。

- [ ] **Step 1: 写失败测试——更新 RoomOperations.test.ts mock**

在 `RoomOperations.test.ts` 中，将 invite blocklist 测试的 mock 从 `client.http.authedRequest` 改为 `client.getInviteBlocklistManager()`：

```typescript
describe('invite blocklist via InviteBlocklistManager', () => {
  it('getInviteBlocklist 走 getBlocklist', async () => {
    const getBlocklist = vi.fn().mockResolvedValue(['@bad:hs'])
    vi.mocked(matrixClientService.getClient).mockReturnValue({
      getInviteBlocklistManager: () => ({ getBlocklist, setBlocklist: vi.fn(), getAllowlist: vi.fn(), setAllowlist: vi.fn() })
    } as unknown as MatrixClient)

    const result = await roomOperations.getInviteBlocklist('!r:hs')
    expect(getBlocklist).toHaveBeenCalledWith('!r:hs')
    expect(result).toEqual(['@bad:hs'])
  })

  it('setInviteBlocklist 走 setBlocklist', async () => {
    const setBlocklist = vi.fn().mockResolvedValue({})
    vi.mocked(matrixClientService.getClient).mockReturnValue({
      getInviteBlocklistManager: () => ({ getBlocklist: vi.fn(), setBlocklist, getAllowlist: vi.fn(), setAllowlist: vi.fn() })
    } as unknown as MatrixClient)

    await roomOperations.setInviteBlocklist('!r:hs', ['@bad:hs'])
    expect(setBlocklist).toHaveBeenCalledWith('!r:hs', ['@bad:hs'])
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest run src/services/matrix/room/__tests__/RoomOperations.test.ts -t "invite blocklist"`
Expected: FAIL（当前走 `http.authedRequest`）

- [ ] **Step 3: 迁移 RoomOperations**

替换 `RoomOperations.ts:225-263` 的 4 个方法：

```typescript
  async getInviteBlocklist(roomId: string, throwOnError = false): Promise<string[]> {
    try {
      return await this.getInviteBlocklistMgr().getBlocklist(roomId)
    } catch (err) {
      logger.error(`获取 invite blocklist 失败: ${roomId} ${err}`)
      if (throwOnError) throw err
      return []
    }
  }

  async setInviteBlocklist(roomId: string, blocked: string[]): Promise<void> {
    await this.getInviteBlocklistMgr().setBlocklist(roomId, blocked)
  }

  async getInviteAllowlist(roomId: string, throwOnError = false): Promise<string[]> {
    try {
      return await this.getInviteBlocklistMgr().getAllowlist(roomId)
    } catch (err) {
      logger.error(`获取 invite allowlist 失败: ${roomId} ${err}`)
      if (throwOnError) throw err
      return []
    }
  }

  async setInviteAllowlist(roomId: string, allowed: string[]): Promise<void> {
    await this.getInviteBlocklistMgr().setAllowlist(roomId, allowed)
  }

  private getInviteBlocklistMgr(): InviteBlocklistManager {
    const client = this.getClient()
    const fn = (client as unknown as { getInviteBlocklistManager?: () => InviteBlocklistManager }).getInviteBlocklistManager
    if (typeof fn !== 'function') {
      throw new Error('MatrixClient.getInviteBlocklistManager is not available; SDK 未初始化')
    }
    return fn.call(client)
  }
```

导入 `import type { InviteBlocklistManager } from 'matrix-js-sdk/invite-blocklist'`。

- [ ] **Step 4: 删除 SynapseInviteListService**

```bash
rm src/services/matrix/extensions/SynapseInviteListService.ts
```

在 `synapseRust.rooms.contract.test.ts` 中删除 `import { synapseInviteListService }` 和 L220-260 的 4 个测试用例（已由 RoomOperations.test.ts 覆盖）。

- [ ] **Step 5: 运行测试确认通过**

Run: `pnpm vitest run src/services/matrix/room/__tests__/RoomOperations.test.ts src/services/matrix/__tests__/synapseRust.rooms.contract.test.ts`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add src/services/matrix/room/RoomOperations.ts src/services/matrix/room/__tests__/RoomOperations.test.ts src/services/matrix/__tests__/synapseRust.rooms.contract.test.ts
git rm src/services/matrix/extensions/SynapseInviteListService.ts
git commit -m "refactor(service): migrate invite blocklist to InviteBlocklistManager

RoomOperations.getInviteBlocklist/setInviteBlocklist/getInviteAllowlist/
setInviteAllowlist now use client.getInviteBlocklistManager() instead of
http.authedRequest. Deletes SynapseInviteListService (dead code, only
called by tests). Note: SDK method names are getBlocklist/setBlocklist
(not getInviteBlocklist)."
```

---

## Task 4: B12 — 迁移 admin/ReportService 到 ReportingManager

**Files:**
- Modify: `src/services/matrix/admin/ReportService.ts:42-52`（`reportEvent` 方法）
- Modify: `src/services/matrix/admin/__tests__/ReportService.test.ts`（更新 mock）

**Interfaces:**
- Consumes: `client.getReportingManager()` → `reportEvent(roomId, eventId, score, reason): Promise<EmptyObject>`
- Produces: `AdminReportService.reportEvent` 对外签名不变

**Context:** `reportEvent` 当前用 `client.reportEvent(roomId, eventId, reason, explanation)`（SDK 高层方法）。SDK 已将其封装在 `ReportingManager.reportEvent(roomId, eventId, score, reason)`。注意：SDK 的 `reportEvent` 多一个 `score` 参数（-100~0），前端无 score 概念，传 `-50`（中性值）。`reportRoom`/`scoreReport`/`getScannerInfo` 也可迁移但端点路径不同，保留 `prefixedAuthedRequest` 直连。`reportUser` 是前端组合方法（遍历房间找事件），不迁移。

- [ ] **Step 1: 写失败测试——验证 reportEvent 走 ReportingManager**

在 `ReportService.test.ts` 中：

```typescript
describe('reportEvent via ReportingManager', () => {
  it('调用 getReportingManager().reportEvent', async () => {
    const reportEventMock = vi.fn().mockResolvedValue({})
    vi.mocked(matrixClientService.getClient).mockReturnValue({
      getReportingManager: () => ({ reportEvent: reportEventMock })
    } as unknown as MatrixClient)

    await adminReportService.reportEvent({
      roomId: '!r:hs',
      eventId: '$e:hs',
      reason: 'spam'
    })

    expect(reportEventMock).toHaveBeenCalledWith('!r:hs', '$e:hs', -50, 'spam')
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest run src/services/matrix/admin/__tests__/ReportService.test.ts -t "ReportingManager"`
Expected: FAIL

- [ ] **Step 3: 迁移 reportEvent**

替换 `ReportService.ts:42-52`：

```typescript
  async reportEvent(request: ReportRequest): Promise<void> {
    const client = this.getClient()
    const { roomId, eventId, reason, explanation } = request
    try {
      const fullReason = explanation ? `${reason}: ${explanation}` : reason
      // score: -100~0, 前端无 score 概念, 用 -50 中性值
      await this.getReportingMgr().reportEvent(roomId, eventId, -50, fullReason)
      logger.info(`[Admin] 举报成功: ${roomId}/${eventId}`)
    } catch (err) {
      logger.error(`[Admin] 举报失败: ${err}`)
      throw err
    }
  }

  private getReportingMgr(): ReportingManager {
    const client = this.getClient()
    const fn = (client as unknown as { getReportingManager?: () => ReportingManager }).getReportingManager
    if (typeof fn !== 'function') {
      throw new Error('MatrixClient.getReportingManager is not available; SDK 未初始化')
    }
    return fn.call(client)
  }
```

导入 `import type { ReportingManager } from 'matrix-js-sdk/reporting'`。

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm vitest run src/services/matrix/admin/__tests__/ReportService.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/services/matrix/admin/ReportService.ts src/services/matrix/admin/__tests__/ReportService.test.ts
git commit -m "refactor(service): migrate reportEvent to ReportingManager

reportEvent now uses client.getReportingManager().reportEvent() instead
of client.reportEvent(). score=-50 (neutral, frontend has no score concept).
reportRoom/scoreReport/getScannerInfo keep prefixedAuthedRequest (different
endpoints). reportUser stays as composition method."
```

---

## Task 5: A8 — 迁移 MatrixVoiceService 到 VoiceManager

**Files:**
- Modify: `src/services/matrix/media/MatrixVoiceService.ts`（迁移 transcribeVoiceViaApi + 其他 voice 方法）
- Modify: `src/services/matrix/media/__tests__/MatrixVoiceService.test.ts`（更新 mock）
- Modify: `src/services/matrix/__tests__/synapseRust.rooms.contract.test.ts`（更新 voice 测试）

**Interfaces:**
- Consumes: `client.getVoiceManager()` → `transcribeVoiceMessage(mediaId, options?): Promise<IVoiceTranscribeResponse>` / `getVoiceStats(): Promise<IVoiceStats>` / `getVoiceConfig(): Promise<IVoiceConfig>` / `uploadVoiceMessage(request): Promise<IVoiceUploadResponse>` / `getVoiceMessage(id): Promise<IVoiceMessage>` / `deleteVoiceMessage(id): Promise<IVoiceDeleteResponse>` / `getRoomVoice(roomId): Promise<IVoiceRoomInfo>`
- Produces: `MatrixVoiceService` 对外签名不变

**Context:** `getRtcTransports` 不在 VoiceManager 中，保留 `client.http.authedRequest` 直连。`transcribeVoiceViaApi` 当前走 `authedRequestWithPath('POST', MATRIX_PATHS.VOICE.TRANSCRIPTION)`，SDK 的 `transcribeVoiceMessage(mediaId, options)` 对应同一端点。前端用 `message_id` 参数，SDK 用 `mediaId` 位置参数 + `options.lang`。

- [ ] **Step 1: 写失败测试——验证 transcribeVoiceViaApi 走 VoiceManager**

在 `MatrixVoiceService.test.ts` 中：

```typescript
describe('transcribeVoiceViaApi via VoiceManager', () => {
  it('调用 getVoiceManager().transcribeVoiceMessage', async () => {
    const transcribeMock = vi.fn().mockResolvedValue({
      text: 'hello',
      language: 'zh',
      confidence: 0.95
    })
    vi.mocked(matrixClientService.getClient).mockReturnValue({
      getVoiceManager: () => ({ transcribeVoiceMessage: transcribeMock })
    } as unknown as MatrixClient)

    const result = await matrixVoiceService.transcribeVoiceViaApi('msg-123', 'zh')
    expect(transcribeMock).toHaveBeenCalledWith('msg-123', { lang: 'zh' })
    expect(result?.text).toBe('hello')
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest run src/services/matrix/media/__tests__/MatrixVoiceService.test.ts -t "transcribeVoiceViaApi"`
Expected: FAIL

- [ ] **Step 3: 迁移 MatrixVoiceService**

在 `MatrixVoiceService.ts` 中：

1. 添加 `getVoice()` 私有访问器（同 ChunkUploadService 模式）：
```typescript
import type { VoiceManager } from 'matrix-js-sdk/voice'

private getVoice(): VoiceManager {
  const client = this.getClient()
  const fn = (client as unknown as { getVoiceManager?: () => VoiceManager }).getVoiceManager
  if (typeof fn !== 'function') {
    throw new Error('MatrixClient.getVoiceManager is not available; SDK 未初始化')
  }
  return fn.call(client)
}
```

2. 替换 `transcribeVoiceViaApi`（L460-496）：
```typescript
async transcribeVoiceViaApi(messageId: string, lang?: string): Promise<{ text: string; language?: string; confidence?: number } | null> {
  try {
    const result = await this.getVoice().transcribeVoiceMessage(messageId, lang ? { lang } : undefined)
    return {
      text: (result.text as string) ?? '',
      language: result.language as string | undefined,
      confidence: result.confidence as number | undefined
    }
  } catch (err) {
    logger.warn(`[MatrixVoiceService] transcribeVoiceViaApi failed: ${err}`)
    return null
  }
}
```

3. 迁移其他 voice 方法（逐个替换 `authedRequestWithPath` → `getVoice().*`），保留 `getRtcTransports` 不变。

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm vitest run src/services/matrix/media/__tests__/MatrixVoiceService.test.ts src/services/matrix/__tests__/synapseRust.rooms.contract.test.ts -t "voice"`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/services/matrix/media/MatrixVoiceService.ts src/services/matrix/media/__tests__/MatrixVoiceService.test.ts
git commit -m "refactor(service): migrate MatrixVoiceService to VoiceManager

transcribeVoiceViaApi and other voice methods now use
client.getVoiceManager() instead of authedRequestWithPath.
getRtcTransports stays as http.authedRequest (not in VoiceManager,
MSC4143 unstable endpoint)."
```

---

## Task 6: A9 — 迁移 MatrixSearchService 到 SearchManager

**Files:**
- Modify: `src/services/matrix/MatrixSearchService.ts:89-97, 278, 244`（`searchMessagesRemote` + `searchUsers`）
- Modify: `src/services/matrix/__tests__/MatrixSearchService.test.ts`（更新 mock）

**Interfaces:**
- Consumes: `client.getSearchManager()` → `searchMessageText(opts: ISearchOptions): Promise<ISearchResponse>` / `searchUserDirectory(opts: { term, limit? }): Promise<IUserDirectoryResponse>`
- Produces: `MatrixSearchService` 对外签名不变

**Context:** `client.search()` 是 SDK 高层方法，内部已调用 `SearchManager`，但绕过了 Manager 的事件发射和统计。`client.publicRooms()` / `client.searchUserDirectory()` 无 Manager 等价方法，保留。`searchMessagesRemote` 迁移到 `searchMessageText`；用户搜索迁移到 `searchUserDirectory`。

- [ ] **Step 1: 写失败测试——验证 searchMessagesRemote 走 SearchManager**

在 `MatrixSearchService.test.ts` 中：

```typescript
describe('searchMessagesRemote via SearchManager', () => {
  it('调用 getSearchManager().searchMessageText', async () => {
    const searchMock = vi.fn().mockResolvedValue({
      results: [{ result: { body: 'hello', event_id: '$e:hs' } }],
      count: 1
    })
    vi.mocked(matrixClientService.getClient).mockReturnValue({
      getSearchManager: () => ({ searchMessageText: searchMock })
    } as unknown as MatrixClient)

    const result = await matrixSearchService.searchMessagesRemote({ searchTerm: 'hello', roomId: '!r:hs' })
    expect(searchMock).toHaveBeenCalledTimes(1)
    expect(result.results).toHaveLength(1)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest run src/services/matrix/__tests__/MatrixSearchService.test.ts -t "searchMessagesRemote"`
Expected: FAIL

- [ ] **Step 3: 迁移 MatrixSearchService**

替换 `searchMessagesRemote` 方法体：

```typescript
private getSearchMgr(): SearchManager {
  const client = this.getClient()
  const fn = (client as unknown as { getSearchManager?: () => SearchManager }).getSearchManager
  if (typeof fn !== 'function') {
    throw new Error('MatrixClient.getSearchManager is not available; SDK 未初始化')
  }
  return fn.call(client)
}

async searchMessagesRemote(params: { searchTerm: string; roomId?: string; limit?: number }): Promise<{ results: any[]; count: number }> {
  const opts: ISearchOptions = {
    search_term: params.searchTerm,
    limit: params.limit ?? 20,
    filter: params.roomId ? { rooms: [params.roomId] } : undefined
  }
  const response = await this.getSearchMgr().searchMessageText(opts)
  return {
    results: response.results ?? [],
    count: response.count ?? 0
  }
}
```

同样迁移用户搜索到 `searchUserDirectory({ term, limit })`。

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm vitest run src/services/matrix/__tests__/MatrixSearchService.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/services/matrix/MatrixSearchService.ts src/services/matrix/__tests__/MatrixSearchService.test.ts
git commit -m "refactor(service): migrate MatrixSearchService to SearchManager

searchMessagesRemote now uses getSearchManager().searchMessageText()
instead of client.search(). User search uses searchUserDirectory().
publicRooms stays as client.publicRooms() (no SearchManager equivalent)."
```

---

## Task 7: B11 — 迁移 AccountDataService 到 AccountDataManager

**Files:**
- Modify: `src/services/matrix/room/AccountDataService.ts`（迁移 room account data 方法 + 其他账户数据方法）
- Modify: `src/services/matrix/room/__tests__/AccountDataService.test.ts`（更新 mock）

**Interfaces:**
- Consumes: `client.getAccountDataManager()` → `setRoomAccountData(roomId, eventType, content): Promise<void>` / `getRoomAccountDataFromServer(roomId, eventType): Promise<MatrixEvent | undefined>` / `setAccountData(eventType, content): Promise<EmptyObject>` / `getAccountDataFromServer(eventType): Promise<T | null>`
- Produces: `AccountDataService` 对外签名不变

**Context:** `AccountDataService` 是跨域服务（room account data / vault / burn / anti-screenshot / summary / AI connections / event signing / message queue / encrypted events），全部用 `client.http.authedRequest`。迁移范围：room account data CRUD（getRoomAccountData/setRoomAccountData）+ 用户级 account data CRUD（getAccountData/setAccountData）。其他自定义端点（vault/burn/anti-screenshot）保留直连，因为 SDK 无等价 Manager 方法。Burn 相关方法应委托给 `MatrixBurnAfterReadService`（已在 Task 1 部分清理）。

- [ ] **Step 1: 写失败测试——验证 getRoomAccountData/setRoomAccountData 走 AccountDataManager**

在 `AccountDataService.test.ts` 中：

```typescript
describe('room account data via AccountDataManager', () => {
  it('getRoomAccountData 走 getRoomAccountDataFromServer', async () => {
    const getRoomAccountDataFromServer = vi.fn().mockResolvedValue(undefined)
    vi.mocked(matrixClientService.getClient).mockReturnValue({
      getAccountDataManager: () => ({ getRoomAccountDataFromServer, setRoomAccountData: vi.fn() })
    } as unknown as MatrixClient)

    await accountDataService.getRoomAccountData('!r:hs', 'com.tjg.vault')
    expect(getRoomAccountDataFromServer).toHaveBeenCalledWith('!r:hs', 'com.tjg.vault')
  })

  it('setRoomAccountData 走 setRoomAccountData', async () => {
    const setRoomAccountData = vi.fn().mockResolvedValue(undefined)
    vi.mocked(matrixClientService.getClient).mockReturnValue({
      getAccountDataManager: () => ({ getRoomAccountDataFromServer: vi.fn(), setRoomAccountData })
    } as unknown as MatrixClient)

    await accountDataService.setRoomAccountData('!r:hs', 'com.tjg.vault', { key: 'value' })
    expect(setRoomAccountData).toHaveBeenCalledWith('!r:hs', 'com.tjg.vault', { key: 'value' })
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest run src/services/matrix/room/__tests__/AccountDataService.test.ts -t "AccountDataManager"`
Expected: FAIL

- [ ] **Step 3: 迁移 AccountDataService**

1. 添加 `getAccountData()` 私有访问器
2. 替换 `getRoomAccountData` / `setRoomAccountData`：
```typescript
async getRoomAccountData(roomId: string, eventType: string): Promise<Record<string, unknown> | null> {
  try {
    const event = await this.getAccountDataMgr().getRoomAccountDataFromServer(roomId, eventType)
    return event?.getContent() ?? null
  } catch (err) {
    logger.error(`获取房间账户数据失败: ${roomId} ${eventType} ${err}`)
    return null
  }
}

async setRoomAccountData(roomId: string, eventType: string, content: Record<string, unknown>): Promise<void> {
  await this.getAccountDataMgr().setRoomAccountData(roomId, eventType, content)
}
```

3. 迁移用户级 `getAccountData` / `setAccountData`（如有）
4. 保留 vault / burn / anti-screenshot / summary / AI connections 等自定义端点为 `http.authedRequest`（SDK 无等价方法）

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm vitest run src/services/matrix/room/__tests__/AccountDataService.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/services/matrix/room/AccountDataService.ts src/services/matrix/room/__tests__/AccountDataService.test.ts
git commit -m "refactor(service): migrate AccountDataService room data to AccountDataManager

getRoomAccountData/setRoomAccountData now use
client.getAccountDataManager() instead of http.authedRequest.
Custom endpoints (vault/burn/anti-screenshot/summary) stay as
http.authedRequest (no SDK Manager equivalent)."
```

---

## Task 8: 清理死路径常量

**Files:**
- Modify: `src/services/matrix/paths/voice.ts`（删除已迁移的 VOICE 常量）
- Modify: `src/services/matrix/paths/room.ts:78-80`（删除 INVITE_BLOCKLIST/INVITE_ALLOWLIST）
- Modify: `src/services/matrix/paths/__tests__/dead-constants.test.ts`（新增守护）

**Context:** Task 3/5 迁移后，`MATRIX_PATHS.VOICE.TRANSCRIPTION` 等和 `MATRIX_PATHS.ROOM.INVITE_BLOCKLIST/INVITE_ALLOWLIST` 不再被业务代码引用。需通过 ratchet 守护。

- [ ] **Step 1: 写失败测试——验证死常量已删除**

在 `dead-constants.test.ts` 中追加：

```typescript
import { VOICE } from '../voice'
import { ROOM } from '../room'

describe('VOICE 模块死常量已清理', () => {
  it('VOICE 不再包含已迁移到 VoiceManager 的死常量', () => {
    for (const dead of ['TRANSCRIPTION', 'STATS', 'CONFIG', 'UPLOAD', 'GET', 'DELETE', 'ROOM', 'USER']) {
      expect(VOICE).not.toHaveProperty(dead)
    }
  })
})

describe('ROOM 模块 invite blocklist 常量已清理', () => {
  it('ROOM 不再包含 INVITE_BLOCKLIST/INVITE_ALLOWLIST', () => {
    expect(ROOM).not.toHaveProperty('INVITE_BLOCKLIST')
    expect(ROOM).not.toHaveProperty('INVITE_ALLOWLIST')
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest run src/services/matrix/paths/__tests__/dead-constants.test.ts`
Expected: FAIL

- [ ] **Step 3: 删除死常量**

在 `paths/voice.ts` 中删除 `TRANSCRIPTION`、`STATS`、`CONFIG`、`UPLOAD`、`GET`、`DELETE`、`ROOM`、`USER` 等已迁移常量（保留 `RTC_TRANSPORTS`）。
在 `paths/room.ts` 中删除 `INVITE_BLOCKLIST` 和 `INVITE_ALLOWLIST`。

- [ ] **Step 4: 运行测试确认通过 + ratchet**

Run: `pnpm vitest run src/services/matrix/paths/__tests__/dead-constants.test.ts && node scripts/check-ratchet.mjs --update`
Expected: PASS + ratchet baseline 收紧

- [ ] **Step 5: 提交**

```bash
git add src/services/matrix/paths/voice.ts src/services/matrix/paths/room.ts src/services/matrix/paths/__tests__/dead-constants.test.ts meta/ratchet-baseline.json
git commit -m "refactor(service): cleanup dead VOICE/ROOM path constants

Removes VOICE.TRANSCRIPTION/STATS/CONFIG/UPLOAD/GET/DELETE/ROOM/USER
(migrated to VoiceManager) and ROOM.INVITE_BLOCKLIST/INVITE_ALLOWLIST
(migrated to InviteBlocklistManager). Keeps VOICE.RTC_TRANSPORTS
(no VoiceManager equivalent). Ratchet baseline tightened."
```

---

## Self-Review

### Spec coverage

| audit P2 项 | 覆盖任务 |
|---|---|
| B8 SynapsePrivacyExtensionService Burn | Task 1 |
| A10/B7 CaptchaManager | Task 2 |
| A11/B9 InviteBlocklistManager | Task 3 |
| B12 admin/ReportService | Task 4 |
| A8 VoiceManager | Task 5 |
| A9 SearchManager | Task 6 |
| B11 AccountDataService | Task 7 |
| 死常量清理 | Task 8 |
| B10 MatrixLocationService | 不在本方案（单独评估） |

### 风险点

1. **Task 2 CaptchaManager 注册**：`matrix-js-sdk/captcha` 入口可能在 package.json exports 中未导出，需回退到 `matrix-js-sdk/src/captcha`。
2. **Task 3 双实现清理**：`SynapseInviteListService` 删除后需确认无其他文件 re-export。
3. **Task 5 VoiceManager 方法映射**：前端 `authedRequestWithPath` 的 13 处调用需逐个映射到 VoiceManager 方法，可能存在参数名差异（如 `message_id` vs `mediaId`）。
4. **Task 7 AccountDataService 跨域**：burn 相关方法应委托给 `MatrixBurnAfterReadService` 而非保留直连，需确认调用方兼容。
5. **Task 2 参数顺序**：CaptchaManager.sendCaptcha 参数是 `(captchaType, target)`，前端是 `(mobile, captchaType)`，顺序相反。

### 验收命令

每个 Task 完成后运行：
```bash
pnpm vue-tsc --noEmit
pnpm vitest run <对应测试文件>
```

全部 Task 完成后运行全量验收：
```bash
pnpm vue-tsc --noEmit
pnpm test:run
pnpm check:ratchet
pnpm check:sdk-boundary
pnpm quality:no-raw-fetch
pnpm check
```
