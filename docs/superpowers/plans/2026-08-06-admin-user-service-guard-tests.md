# Admin UserService Guard 负向测试补全 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 补全 [UserService.ts](file:///Users/ljf/Desktop/hu_ts/Tjg/src/services/matrix/admin/UserService.ts) 中写操作方法的 `isValidMatrixUserId` guard 及对应负向测试。Task 4（`2026-08-06-admin-facade-dual-write-cleanup.md`）为 `overrideUserRateLimit` 添加了 guard 但未补测试，审查发现 `setAdmin` 和 `deleteRateLimit` 完全缺少 guard，`deactivateUser` 有 guard 但无负向测试——这是 pre-existing 的测试覆盖缺口。

**Architecture:** [UserService.ts](file:///Users/ljf/Desktop/hu_ts/Tjg/src/services/matrix/admin/UserService.ts) 中 `resetPassword`（L121）是 guard + 负向测试的基准模式：方法开头 `if (!isValidMatrixUserId(userId)) throw new Error(\`Invalid user ID: ${userId}\`)`，测试 `await expect(service.resetPassword('bad-id', 'secret')).rejects.toThrow('Invalid user ID')`。本计划将该模式补齐到 `deactivateUser`/`setAdmin`/`overrideUserRateLimit`/`deleteRateLimit` 四个写操作方法。`isValidMatrixUserId` 已在文件顶部 import（L8），无需新增 import。

**Tech Stack:** TypeScript, Vitest, matrix-js-sdk AdminManager

## Global Constraints

- **TDD 不强制**：本任务是补 guard + 补测试，非 Bug 修复。先补 guard，再补测试，验证通过即可。若希望严格 TDD，可对 `setAdmin`/`deleteRateLimit`（新增 guard）先写失败测试（期望 throw 但当前不 throw），再补 guard。
- **禁止扩大范围**：仅修改 `UserService.ts` 和 `UserService.test.ts`。不触碰 `AdminFacadeService.ts`（委托层）或其他子服务。
- **guard 模式一致**：所有 guard 必须与 `resetPassword`（L121）完全一致——`if (!isValidMatrixUserId(userId)) throw new Error(\`Invalid user ID: ${userId}\`)`，错误消息格式统一。
- **保留现有行为**：guard 仅在方法开头新增，不修改方法体其他逻辑。现有正向往测试必须仍通过。
- **`getRateLimit` 不补 guard**：读操作，且返回 `null` 而非 throw，风险低。本计划不处理（可选 follow-up）。
- **commit scope 用 `admin`**（commitlint scope-enum 限制）。
- **测试命令**：`npx vitest run src/services/matrix/admin/__tests__/UserService.test.ts`；`npx biome check src/services/matrix/admin/UserService.ts`。

---

## File Structure

| 文件 | 职责 | 操作 |
|------|------|------|
| `src/services/matrix/admin/UserService.ts` | 用户管理子服务 | 修改：`setAdmin`（L130）和 `deleteRateLimit`（L222）新增 `isValidMatrixUserId` guard |
| `src/services/matrix/admin/__tests__/UserService.test.ts` | UserService 测试 | 修改：新增 4 个负向测试（deactivateUser/setAdmin/overrideUserRateLimit/deleteRateLimit） |

**不修改的文件**：
- `AdminFacadeService.ts`（委托层，guard 在子服务层即可）
- `AdminTypes.ts`、`useAdminUsers.ts` 等

---

## Task 1: 为 setAdmin 和 deleteRateLimit 补 guard

**目的**：`setAdmin`（[UserService.ts:130](file:///Users/ljf/Desktop/hu_ts/Tjg/src/services/matrix/admin/UserService.ts#L130)）和 `deleteRateLimit`（[UserService.ts:222](file:///Users/ljf/Desktop/hu_ts/Tjg/src/services/matrix/admin/UserService.ts#L222)）方法开头缺少 `isValidMatrixUserId` 校验，补齐与 `resetPassword`/`deactivateUser`/`overrideUserRateLimit` 一致的 guard。

**Files:**
- Modify: `src/services/matrix/admin/UserService.ts:130, 222`

**Interfaces:**
- Produces: `setAdmin` 和 `deleteRateLimit` 对非法 userId 抛出 `Error('Invalid user ID: ...')`，与同类方法一致。

- [ ] **Step 1: 为 `setAdmin` 补 guard**

在 [UserService.ts:130](file:///Users/ljf/Desktop/hu_ts/Tjg/src/services/matrix/admin/UserService.ts#L130) `async setAdmin(userId: string, isAdmin: boolean): Promise<void> {` 之后、现有逻辑之前，新增：

```typescript
  if (!isValidMatrixUserId(userId)) throw new Error(`Invalid user ID: ${userId}`)
```

- [ ] **Step 2: 为 `deleteRateLimit` 补 guard**

在 [UserService.ts:222](file:///Users/ljf/Desktop/hu_ts/Tjg/src/services/matrix/admin/UserService.ts#L222) `async deleteRateLimit(userId: string): Promise<void> {` 之后、现有逻辑之前，新增：

```typescript
  if (!isValidMatrixUserId(userId)) throw new Error(`Invalid user ID: ${userId}`)
```

- [ ] **Step 3: Biome 验证**

```bash
npx biome check src/services/matrix/admin/UserService.ts
```

预期：clean。

---

## Task 2: 补 4 个负向测试

**目的**：为 `deactivateUser`/`setAdmin`/`overrideUserRateLimit`/`deleteRateLimit` 补 `isValidMatrixUserId` guard 的负向测试。参照 [UserService.test.ts:130](file:///Users/ljf/Desktop/hu_ts/Tjg/src/services/matrix/admin/__tests__/UserService.test.ts#L130) `resetPassword validates user id and empty password` 的模式。

**Files:**
- Modify: `src/services/matrix/admin/__tests__/UserService.test.ts`

**Interfaces:**
- Produces: 4 个新测试用例，验证非法 userId 抛出 `Invalid user ID`。

- [ ] **Step 1: 新增 `deactivateUser` 负向测试**

在 `UserService.test.ts` 中（靠近 `resetPassword validates` 测试附近）新增：

```typescript
it('deactivateUser rejects invalid user id', async () => {
  await expect(service.deactivateUser('bad-id')).rejects.toThrow('Invalid user ID')
})
```

- [ ] **Step 2: 新增 `setAdmin` 负向测试**

```typescript
it('setAdmin rejects invalid user id', async () => {
  await expect(service.setAdmin('bad-id', true)).rejects.toThrow('Invalid user ID')
})
```

- [ ] **Step 3: 新增 `overrideUserRateLimit` 负向测试**

注意：[UserService.test.ts:190](file:///Users/ljf/Desktop/hu_ts/Tjg/src/services/matrix/admin/__tests__/UserService.test.ts#L190) 已有 `overrideUserRateLimit calls admin.overrideRateLimit without limit param` 正向测试，新增负向测试放在其附近：

```typescript
it('overrideUserRateLimit rejects invalid user id', async () => {
  await expect(service.overrideUserRateLimit('bad-id')).rejects.toThrow('Invalid user ID')
})
```

- [ ] **Step 4: 新增 `deleteRateLimit` 负向测试**

```typescript
it('deleteRateLimit rejects invalid user id', async () => {
  await expect(service.deleteRateLimit('bad-id')).rejects.toThrow('Invalid user ID')
})
```

- [ ] **Step 5: 运行测试**

```bash
npx vitest run src/services/matrix/admin/__tests__/UserService.test.ts
```

预期：全部通过（含 4 个新测试 + 现有测试）。

- [ ] **Step 6: Biome 验证测试文件**

```bash
npx biome check src/services/matrix/admin/__tests__/UserService.test.ts
```

预期：clean。

---

## Task 3: 验证与提交

**目的**：确保 guard 补全后无回归。

- [ ] **Step 1: 运行 admin 全套测试**

```bash
npx vitest run src/services/matrix/admin/
```

预期：全部通过。

- [ ] **Step 2: 类型检查**

```bash
npx vue-tsc --noEmit
```

预期：0 错误。

- [ ] **Step 3: grep 确认 guard 一致性**

```bash
grep -n "isValidMatrixUserId" src/services/matrix/admin/UserService.ts
```

预期：`resetPassword`/`deactivateUser`/`setAdmin`/`overrideUserRateLimit`/`deleteRateLimit` 五处均有 guard（`getRateLimit` 无 guard，可接受）。

- [ ] **Step 4: 提交**

```bash
git add src/services/matrix/admin/UserService.ts src/services/matrix/admin/__tests__/UserService.test.ts
git commit -m "test(admin): add isValidMatrixUserId guard to setAdmin/deleteRateLimit, cover 4 negative tests"
```

---

## Risks

- **极低**：`setAdmin`/`deleteRateLimit` 补 guard 是行为收紧——对非法 userId 现在提前抛错而非传到 SDK。但生产调用方 `useAdminUsers.ts` 的 userId 来自 `selectedUser.value.userId`（服务端用户列表返回的合法 Matrix ID），不会触发新 guard。
- `isValidMatrixUserId` 已在 [UserService.ts:8](file:///Users/ljf/Desktop/hu_ts/Tjg/src/services/matrix/admin/UserService.ts#L8) import，无需新增 import。
- `getRateLimit` 不补 guard（读操作返回 null，风险低），可作为可选 follow-up。
