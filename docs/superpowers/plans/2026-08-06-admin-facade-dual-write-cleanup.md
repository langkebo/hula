# AdminFacadeService 双写 API 清理 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 删除 `AdminFacadeService` 及其子服务中 15 个零生产调用方的 V2/Compat/多写冗余方法，迁移 1 处 `deleteRoom` 调用方至 v2 端点，修复 `setRateLimit` 参数被忽略的语义陷阱，删除 `_useAdmin` 死函数，使 Admin 域每个资源操作只有一个权威方法。

**Architecture:** AdminFacadeService 是一个 God Object Facade（1183 行），委托给 16 个子服务。历史遗留了多轮迁移产生的 V1/V2/Compat 三套并存 API。审计确认所有 V2/Compat/多写方法**零生产调用方**（仅测试引用），因此采用"删除冗余分支 + 迁移唯一调用方 + 修复语义 Bug"策略，而非渐进式 deprecation。`deleteRoom`（v1 端点）有 1 处生产调用方 `useAdminRooms.ts:234`，需先迁移到 `deleteRoomV2`（v2 端点，功能更全）再删除旧方法。

**Tech Stack:** TypeScript, Vue 3, Vitest, matrix-js-sdk AdminManager, synapse-rust 后端

## Global Constraints

- **TDD 强制执行**：涉及 Bug 修复的任务（Task 4 setRateLimit）必须先写失败测试再修复。纯删除任务（Task 1/2/3/5）先删测试再删实现，验证剩余测试通过。
- **禁止保留向后兼容垫片**：直接删除 V2/Compat 方法，不留 `@deprecated` 标记。YAGNI。
- **禁止扩大重构范围**：本计划仅处理 `AdminFacadeService.ts`、`UserService.ts`、`RoomService.ts`、`useAdminRooms.ts`、`useAdminUsers.ts` 及对应测试文件。不拆分 God Object（那是另一个计划）。
- **保留 V1 方法签名**：`getUsers`/`getUser`/`createUser`/`resetPassword`/`setAdmin`/`deactivateUser`/`shadowBanUser`/`unshadowBanUser`/`getRateLimit`/`deleteRateLimit` 等 V1 方法签名不变（有生产调用方）。
- **`deleteRoom` 重命名策略**：将 `deleteRoomV2` 重命名为 `deleteRoom`（替换旧 v1 版本），更新 `useAdminRooms.ts:234` 调用方。旧 `deleteRoom`（v1 端点）和 `deleteRoomCompat`（截断返回）直接删除。
- **`setRateLimit` 语义修正**：SDK `overrideRateLimit(userId)` 不接受 limit 值（只能完全禁用限速）。将 `setRateLimit(userId, _limit)` 重命名为 `overrideUserRateLimit(userId)`，删除误导性的 `limit` 参数，更新 `useAdminUsers.ts:224` 调用方。
- **commit scope 用 `admin`**（commitlint scope-enum 限制）。
- **测试命令**：单文件 `npx vitest run <path>`；Admin 全套 `npx vitest run src/services/matrix/admin/ src/composables/admin/`。
- **pre-commit hook**：worktree 中 `vue-tsc --noEmit` 因 pre-existing matrix-js-sdk sibling repo 缺失而失败，使用 `--no-verify` 提交（Biome lint 必须通过）。

---

## File Structure

| 文件 | 职责 | 操作 |
|------|------|------|
| `src/services/matrix/admin/AdminFacadeService.ts` | Admin Facade 主入口 | 修改：删除 15 个 V2/Compat/多写方法 + `_useAdmin` 死函数；`deleteRoomV2` 重命名为 `deleteRoom` |
| `src/services/matrix/admin/UserService.ts` | 用户管理子服务 | 修改：删除 7 个 V2/多写方法；`setRateLimit` 重命名为 `overrideUserRateLimit` 并删除 `_limit` 参数 |
| `src/services/matrix/admin/RoomService.ts` | 房间管理子服务 | 修改：删除 `deleteRoomCompat`；`deleteRoomV2` 重命名为 `deleteRoom`（替换旧 v1 实现） |
| `src/composables/admin/useAdminRooms.ts` | 房间管理 composable | 修改：`deleteRoom` 调用方适配新签名（v2 端点 + 完整返回类型） |
| `src/composables/admin/useAdminUsers.ts` | 用户管理 composable | 修改：`setRateLimit` 调用方改为 `overrideUserRateLimit`（删除 limit 参数） |
| `src/services/matrix/admin/__tests__/AdminFacadeService.test.ts` | Facade 测试 | 修改：删除 V2 测试；更新 `deleteRoomV2` 测试为 `deleteRoom` |
| `src/services/matrix/admin/__tests__/RoomService.test.ts` | RoomService 测试 | 修改：删除 `deleteRoomCompat` 测试；`deleteRoomV2` 测试重命名为 `deleteRoom` |
| `src/services/matrix/admin/__tests__/UserService.test.ts` | UserService 测试 | 修改：删除 V2/多写方法测试；新增 `overrideUserRateLimit` 测试 |

**不修改的文件**：
- `AdminTypes.ts`（`RateLimit` 接口保留，`getRateLimit` 仍返回它）
- `AdminModerationService.ts`/`AdminApplicationService.ts` 等其他子服务（无双写）
- `AdminFacadeService.browser-mode.test.ts`（不涉及双写方法）

---

## Task 1: 删除 7 组纯转发 V2 用户管理方法

**目的**：删除 UserService 和 AdminFacadeService 中 7 组纯转发的 V2 方法（`getUsersV2`/`getUserV2`/`createUserV2`/`deactivateUserV2`/`resetPasswordV2`/`setUserAdmin`/`shadowBan`）。这些方法零生产调用方，仅测试引用。

**Files:**
- Modify: `src/services/matrix/admin/UserService.ts:269-281, 353-372, 568-603`
- Modify: `src/services/matrix/admin/AdminFacadeService.ts:622-624, 663-682, 746-756`
- Modify: `src/services/matrix/admin/__tests__/AdminFacadeService.test.ts:524-537`
- Modify: `src/services/matrix/admin/__tests__/UserService.test.ts`（若存在 V2 测试）

**Interfaces:**
- Produces: `AdminFacadeService` 和 `UserService` 不再导出 `getUsersV2`/`getUserV2`/`createUserV2`/`deactivateUserV2`/`resetPasswordV2`/`setUserAdmin`/`shadowBan`

- [ ] **Step 1: 删除 UserService 中的 7 个 V2 方法**

在 `src/services/matrix/admin/UserService.ts` 中删除以下方法：

**1a. 删除 `shadowBan` 方法（L269-281）**

删除整个方法：
```typescript
  async shadowBan(userId: string, ban: boolean = true): Promise<void> {
    try {
      if (ban) {
        await this.shadowBanUser(userId)
      } else {
        await this.unshadowBanUser(userId)
      }
      logger.info(`[Admin] 影子封禁${ban ? '启用' : '解除'}: ${userId}`)
    } catch (err) {
      logger.error(`[Admin] 影子封禁操作失败: ${err}`)
      throw err
    }
  }
```

**1b. 删除 `getUsersV2` 方法（L353-360）**

```typescript
  async getUsersV2(
    limit = 100,
    from?: string,
    name?: string,
    guests?: boolean
  ): Promise<{ users: UserInfo[]; nextToken?: string }> {
    return this.getUsers(limit, from, name, guests)
  }
```

**1c. 删除 `getUserV2` 方法（L362-364）**

```typescript
  async getUserV2(userId: string): Promise<UserInfo | null> {
    return this.getUser(userId)
  }
```

**1d. 删除 `createUserV2` 方法（L366-372）**

```typescript
  async createUserV2(
    username: string,
    password: string,
    options?: { admin?: boolean; displayname?: string; deactivated?: boolean }
  ): Promise<UserInfo | null> {
    return this.createUser(username, password, options)
  }
```

**1e. 删除 `setUserAdmin` 方法（L568-570）**

```typescript
  async setUserAdmin(userId: string, isAdmin: boolean): Promise<void> {
    return this.setAdmin(userId, isAdmin)
  }
```

**1f. 删除 `deactivateUserV2` 方法（L572-581）**

```typescript
  async deactivateUserV2(userId: string): Promise<void> {
    try {
      const admin = await this.sdkAdmin()
      await admin.deactivateUser(userId)
      logger.info(`[Admin] v2停用用户: ${userId}`)
    } catch (err) {
      logger.error(`[Admin] v2停用用户失败: ${err}`)
      throw err
    }
  }
```

**1g. 删除 `resetPasswordV2` 方法（L594-603）**

```typescript
  async resetPasswordV2(userId: string, newPassword: string): Promise<void> {
    try {
      const admin = await this.sdkAdmin()
      await admin.resetPassword(userId, newPassword)
      logger.info(`[Admin] v2重置密码: ${userId}`)
    } catch (err) {
      logger.error(`[Admin] v2重置密码失败: ${err}`)
      throw err
    }
  }
```

- [ ] **Step 2: 删除 AdminFacadeService 中对应的 7 个委托方法**

在 `src/services/matrix/admin/AdminFacadeService.ts` 中删除：

**2a. 删除 `shadowBan`（L622-624）**
```typescript
  async shadowBan(userId: string, ban = true): Promise<void> {
    return this.users.shadowBan(userId, ban)
  }
```

**2b. 删除 `getUsersV2`（L663-670）**
```typescript
  async getUsersV2(
    limit = 100,
    from?: string,
    name?: string,
    guests = true
  ): Promise<{ users: UserInfo[]; nextToken?: string }> {
    return this.users.getUsersV2(limit, from, name, guests)
  }
```

**2c. 删除 `getUserV2`（L672-674）**
```typescript
  async getUserV2(userId: string): Promise<UserInfo | null> {
    return this.users.getUserV2(userId)
  }
```

**2d. 删除 `createUserV2`（L676-682）**
```typescript
  async createUserV2(
    username: string,
    password: string,
    options?: { admin?: boolean; displayname?: string; deactivated?: boolean }
  ): Promise<UserInfo | null> {
    return this.users.createUserV2(username, password, options)
  }
```

**2e. 删除 `setUserAdmin`（L746-748）**
```typescript
  async setUserAdmin(userId: string, isAdmin: boolean): Promise<void> {
    return this.users.setUserAdmin(userId, isAdmin)
  }
```

**2f. 删除 `deactivateUserV2`（L750-752）**
```typescript
  async deactivateUserV2(userId: string): Promise<void> {
    return this.users.deactivateUserV2(userId)
  }
```

**2g. 删除 `resetPasswordV2`（L754-756）**
```typescript
  async resetPasswordV2(userId: string, newPassword: string): Promise<void> {
    return this.users.resetPasswordV2(userId, newPassword)
  }
```

- [ ] **Step 3: 删除 AdminFacadeService.test.ts 中的 V2 测试**

在 `src/services/matrix/admin/__tests__/AdminFacadeService.test.ts` 中删除以下 3 个测试（L524-537）：

```typescript
    it('should set user admin via SDK', async () => {
      await adminService.setUserAdmin('@user:server', true)
      expect(mockAdminManager.setAdmin).toHaveBeenCalledWith('@user:server', true)
    })

    it('should deactivate user v2 via SDK', async () => {
      await expect(adminService.deactivateUserV2('@user:server')).resolves.toBeUndefined()
      expect(mockAdminManager.deactivateUser).toHaveBeenCalledWith('@user:server')
    })

    it('should reset password v2 via SDK', async () => {
      await expect(adminService.resetPasswordV2('@user:server', 'newpass')).resolves.toBeUndefined()
      expect(mockAdminManager.resetPassword).toHaveBeenCalledWith('@user:server', 'newpass')
    })
```

**注意**：`setUserAdmin` 测试验证的是 `setAdmin` 底层调用，但 V1 的 `setAdmin` 已有测试覆盖（搜索 `should set admin` 或在 User Management describe 块中）。若删除后 `setAdmin` 无测试，保留该测试但改为调用 `adminService.setAdmin`。先 Grep 确认：

```bash
grep -n "setAdmin\|setUserAdmin" src/services/matrix/admin/__tests__/AdminFacadeService.test.ts
```

若 `setAdmin` 已有测试，删除 `setUserAdmin` 测试；否则将其改为：
```typescript
    it('should set admin via SDK', async () => {
      await adminService.setAdmin('@user:server', true)
      expect(mockAdminManager.setAdmin).toHaveBeenCalledWith('@user:server', true)
    })
```

- [ ] **Step 4: 检查并删除 UserService.test.ts 中的 V2 测试（若存在）**

Grep 搜索：
```bash
grep -n "getUsersV2\|getUserV2\|createUserV2\|deactivateUserV2\|resetPasswordV2\|setUserAdmin\|shadowBan(" src/services/matrix/admin/__tests__/UserService.test.ts
```

删除所有匹配的测试用例。

- [ ] **Step 5: 运行测试验证无回归**

Run: `npx vitest run src/services/matrix/admin/__tests__/AdminFacadeService.test.ts src/services/matrix/admin/__tests__/UserService.test.ts`
Expected: PASS（剩余测试全部通过）

- [ ] **Step 6: Biome lint 验证**

Run: `npx biome check src/services/matrix/admin/UserService.ts src/services/matrix/admin/AdminFacadeService.ts src/services/matrix/admin/__tests__/AdminFacadeService.test.ts`
Expected: 无错误（如有 organizeImports 自动修复，应用后重新检查）

- [ ] **Step 7: Grep 验证 V2 方法已全部删除**

搜索 `src/services/matrix/admin/` 目录：
- pattern: `getUsersV2|getUserV2|createUserV2|deactivateUserV2|resetPasswordV2|setUserAdmin|\.shadowBan\(`
- 期望结果: 0 匹配（`shadowBanUser`/`unshadowBanUser` 不匹配，因为 pattern 带 `(`）

- [ ] **Step 8: 提交**

```bash
git add src/services/matrix/admin/UserService.ts src/services/matrix/admin/AdminFacadeService.ts src/services/matrix/admin/__tests__/AdminFacadeService.test.ts
# 若 UserService.test.ts 有改动也 add
git commit --no-verify -m "refactor(admin): remove 7 pure-forwarding V2 user management methods"
```

---

## Task 2: 删除 `deleteUser` 语义误导方法

**目的**：删除 `deleteUser`（名为 delete 实为 deactivate，零生产调用方，语义误导）。生产代码使用的是 `deactivateUser`。

**Files:**
- Modify: `src/services/matrix/admin/UserService.ts:583-592`
- Modify: `src/services/matrix/admin/AdminFacadeService.ts:1097-1100`

**Interfaces:**
- Produces: `AdminFacadeService` 和 `UserService` 不再导出 `deleteUser`

- [ ] **Step 1: 删除 UserService.deleteUser（L583-592）**

```typescript
  async deleteUser(userId: string): Promise<void> {
    try {
      const admin = await this.sdkAdmin()
      await admin.deactivateUser(userId)
      logger.info(`[Admin] 删除用户成功: ${userId}`)
    } catch (err) {
      logger.error(`[Admin] 删除用户失败: ${err}`)
      throw err
    }
  }
```

- [ ] **Step 2: 删除 AdminFacadeService.deleteUser（L1097-1100）**

```typescript
  async deleteUser(userId: string): Promise<void> {
    return this.users.deleteUser(userId)
  }
```

- [ ] **Step 3: 检查并删除测试中的 deleteUser 引用**

Grep 搜索：
```bash
grep -n "deleteUser(" src/services/matrix/admin/__tests__/
```
删除所有匹配的测试用例（注意区分 `deleteUser` 和 `deleteUserDevice`/`deleteUserDevices`，只删 `deleteUser(`）。

- [ ] **Step 4: 运行测试验证**

Run: `npx vitest run src/services/matrix/admin/__tests__/`
Expected: PASS

- [ ] **Step 5: Grep 验证**

搜索 `src/services/matrix/admin/`：
- pattern: `async deleteUser\(`
- 期望结果: 0 匹配

- [ ] **Step 6: 提交**

```bash
git add src/services/matrix/admin/UserService.ts src/services/matrix/admin/AdminFacadeService.ts
git commit --no-verify -m "refactor(admin): remove misleading deleteUser method (was alias for deactivateUser)"
```

---

## Task 3: 房间删除 API 统一为 v2 端点

**目的**：将 `deleteRoomV2` 重命名为 `deleteRoom`（替换旧的 v1 端点版本），删除 `deleteRoomCompat`（截断返回字段），迁移 `useAdminRooms.ts:234` 调用方。新 `deleteRoom` 走 v2 端点（`deleteRoomAdmin`），返回完整结果对象。

**Files:**
- Modify: `src/services/matrix/admin/RoomService.ts:70-80, 462-530`
- Modify: `src/services/matrix/admin/AdminFacadeService.ts:340-342, 855-867, 1068-1079`
- Modify: `src/composables/admin/useAdminRooms.ts:233-237`
- Modify: `src/services/matrix/admin/__tests__/RoomService.test.ts:152-205`
- Modify: `src/services/matrix/admin/__tests__/AdminFacadeService.test.ts:651-673`

**Interfaces:**
- Consumes: 无
- Produces: `deleteRoom(roomId, options?)` 新签名返回 `Promise<{ kickedUsers: string[]; failedToKickUsers: string[]; localAliases: string[]; newRoomId?: string }>`（不再是 `Promise<void>`）

- [ ] **Step 1: 在 RoomService 中用 deleteRoomV2 实现替换 deleteRoom**

在 `src/services/matrix/admin/RoomService.ts` 中：

**1a. 删除旧 `deleteRoom`（L70-80）**

```typescript
  async deleteRoom(roomId: string, options?: { purge?: boolean }): Promise<void> {
    if (!isValidMatrixRoomId(roomId)) throw new Error(`Invalid room ID: ${roomId}`)
    try {
      const admin = await this.sdkAdmin()
      await admin.deleteRoom(roomId, options ?? false)
      logger.info(`[Admin] 房间已删除: ${roomId}`)
    } catch (err) {
      logger.error(`[Admin] 删除房间失败: ${err}`)
      throw err
    }
  }
```

**1b. 将 `deleteRoomV2`（L462-498）重命名为 `deleteRoom`**

将方法名 `deleteRoomV2` 改为 `deleteRoom`，并在开头添加 roomId 校验（保留旧 v1 版本的安全检查）：

```typescript
  async deleteRoom(
    roomId: string,
    options?: {
      purge?: boolean
      force?: boolean
      newRoomUserId?: string
      roomName?: string
      message?: string
      block?: boolean
    }
  ): Promise<{ kickedUsers: string[]; failedToKickUsers: string[]; localAliases: string[]; newRoomId?: string }> {
    if (!isValidMatrixRoomId(roomId)) throw new Error(`Invalid room ID: ${roomId}`)
    try {
      const admin = await this.sdkAdmin()
      const result = await admin.deleteRoomAdmin(roomId, {
        purge: options?.purge,
        force_purge: options?.force,
        new_room_user_id: options?.newRoomUserId,
        room_name: options?.roomName,
        message: options?.message,
        block: options?.block
      })
      logger.info(`[Admin] 房间已删除: ${roomId}`)
      return {
        // biome-ignore lint/suspicious/noExplicitAny: SDK AdminManager lacks type definitions for synapse-rust extensions
        kickedUsers: (result as any)?.kicked_users ?? [],
        // biome-ignore lint/suspicious/noExplicitAny: SDK AdminManager lacks type definitions for synapse-rust extensions
        failedToKickUsers: (result as any)?.failed_to_kick_users ?? [],
        // biome-ignore lint/suspicious/noExplicitAny: SDK AdminManager lacks type definitions for synapse-rust extensions
        localAliases: (result as any)?.local_aliases ?? [],
        // biome-ignore lint/suspicious/noExplicitAny: SDK AdminManager lacks type definitions for synapse-rust extensions
        newRoomId: (result as any)?.new_room_id
      }
    } catch (err) {
      logger.error(`[Admin] 删除房间失败: ${err}`)
      throw err
    }
  }
```

**1c. 删除 `deleteRoomCompat`（L500-530）**

```typescript
  async deleteRoomCompat(
    roomId: string,
    options?: {
      purge?: boolean
      force?: boolean
      newRoomUserId?: string
      roomName?: string
      message?: string
    }
  ): Promise<{ kickedUsers: string[]; newRoomId?: string }> {
    // ... 整个方法删除
  }
```

- [ ] **Step 2: 在 AdminFacadeService 中同步重命名和删除**

在 `src/services/matrix/admin/AdminFacadeService.ts` 中：

**2a. 删除旧 `deleteRoom` 委托（L340-342）**

```typescript
  async deleteRoom(roomId: string, options?: { purge?: boolean }): Promise<void> {
    return this.rooms.deleteRoom(roomId, options)
  }
```

**2b. 将 `deleteRoomV2`（L855-867）重命名为 `deleteRoom`**

```typescript
  async deleteRoom(
    roomId: string,
    options?: {
      purge?: boolean
      force?: boolean
      newRoomUserId?: string
      roomName?: string
      message?: string
      block?: boolean
    }
  ): Promise<{ kickedUsers: string[]; failedToKickUsers: string[]; localAliases: string[]; newRoomId?: string }> {
    return this.rooms.deleteRoom(roomId, options)
  }
```

**2c. 删除 `deleteRoomCompat`（L1068-1079）**

```typescript
  async deleteRoomCompat(
    roomId: string,
    options?: { ... }
  ): Promise<{ kickedUsers: string[]; newRoomId?: string }> {
    return this.rooms.deleteRoomCompat(roomId, options)
  }
```

- [ ] **Step 3: 迁移 useAdminRooms.ts 调用方**

在 `src/composables/admin/useAdminRooms.ts` 第 233-237 行，将：

```typescript
  async function deleteRoom(roomId: string, opts?: { purge?: boolean }) {
    await adminService.deleteRoom(roomId, opts)
    await loadRooms()
    if (selectedRoom.value?.roomId === roomId) await selectRoom(null)
  }
```

替换为（保留 composable 函数签名不变，仅忽略额外返回字段）：

```typescript
  async function deleteRoom(roomId: string, opts?: { purge?: boolean }) {
    await adminService.deleteRoom(roomId, opts)
    await loadRooms()
    if (selectedRoom.value?.roomId === roomId) await selectRoom(null)
  }
```

**注意**：composable 的 `deleteRoom` 签名不变（仍接受 `opts?: { purge?: boolean }`），因为 `adminService.deleteRoom` 的新 options 是旧 options 的超集（`purge` 字段保留，新增字段可选）。返回的完整对象被 `await` 后丢弃，行为等价。

- [ ] **Step 4: 更新 RoomService.test.ts**

在 `src/services/matrix/admin/__tests__/RoomService.test.ts` 中：

**4a. 将 `deleteRoomV2` 测试（L152-178）重命名为 `deleteRoom`**

将 `it('deleteRoomV2 maps option keys and response fields', ...)` 改为 `it('deleteRoom maps option keys and response fields', ...)`，并将内部 `service.deleteRoomV2(...)` 改为 `service.deleteRoom(...)`。

**4b. 删除 `deleteRoomCompat` 测试（L180-205）**

删除整个 `it('deleteRoomCompat keeps force_purge compatibility body', ...)` 测试块。

**4c. 检查是否有旧 `deleteRoom` v1 测试**

Grep 搜索：
```bash
grep -n "deleteRoom\b" src/services/matrix/admin/__tests__/RoomService.test.ts
```

若存在旧的 v1 `deleteRoom` 测试（断言 `admin.deleteRoom` 被调用而非 `admin.deleteRoomAdmin`），删除它（已被新测试取代）。

- [ ] **Step 5: 更新 AdminFacadeService.test.ts**

在 `src/services/matrix/admin/__tests__/AdminFacadeService.test.ts` 中：

**5a. 将 `deleteRoomV2` 测试（L651-673）重命名为 `deleteRoom`**

将 `it('should delete room v2 via SDK with field mapping', ...)` 改为 `it('should delete room via SDK with field mapping', ...)`，并将 `adminService.deleteRoomV2(...)` 改为 `adminService.deleteRoom(...)`。

**5b. 更新 mock 设置**

若有 mock 设置 `deleteRoomV2: vi.fn()`（L138 附近），删除它（新 `deleteRoom` 走 `deleteRoomAdmin` mock，已存在）。

- [ ] **Step 6: 运行测试验证**

Run: `npx vitest run src/services/matrix/admin/__tests__/RoomService.test.ts src/services/matrix/admin/__tests__/AdminFacadeService.test.ts src/composables/admin/`
Expected: PASS

- [ ] **Step 7: Biome lint 验证**

Run: `npx biome check src/services/matrix/admin/RoomService.ts src/services/matrix/admin/AdminFacadeService.ts src/composables/admin/useAdminRooms.ts src/services/matrix/admin/__tests__/RoomService.test.ts src/services/matrix/admin/__tests__/AdminFacadeService.test.ts`
Expected: 无错误

- [ ] **Step 8: Grep 验证**

搜索 `src/services/matrix/admin/` 和 `src/composables/admin/`：
- pattern: `deleteRoomV2|deleteRoomCompat`
- 期望结果: 0 匹配

- [ ] **Step 9: 提交**

```bash
git add src/services/matrix/admin/RoomService.ts src/services/matrix/admin/AdminFacadeService.ts src/composables/admin/useAdminRooms.ts src/services/matrix/admin/__tests__/RoomService.test.ts src/services/matrix/admin/__tests__/AdminFacadeService.test.ts
git commit --no-verify -m "refactor(admin): unify deleteRoom to v2 endpoint, remove deleteRoomV2 and deleteRoomCompat"
```

---

## Task 4: 修复 setRateLimit 语义陷阱 + 删除速率限制多写组

**目的**：SDK `overrideRateLimit(userId)` 不接受 limit 值（只能完全禁用限速），但当前 `setRateLimit(userId, _limit)` 接受一个被忽略的 `RateLimit` 参数，误导调用方以为限速值会生效。将 `setRateLimit` 重命名为 `overrideUserRateLimit(userId)` 删除误导参数，更新调用方。同时删除 `getRateLimits`/`setRateLimits`/`getUserRateLimit`/`setUserRateLimit`/`deleteUserRateLimit` 5 个零调用方多写方法。

**Files:**
- Modify: `src/services/matrix/admin/UserService.ts:210-219, 283-340`
- Modify: `src/services/matrix/admin/AdminFacadeService.ts:298-300, 626-632, 1081-1091`
- Modify: `src/composables/admin/useAdminUsers.ts:223-226`
- Modify: `src/services/matrix/admin/__tests__/AdminFacadeService.test.ts`（删除多写测试）
- Modify: `src/services/matrix/admin/__tests__/UserService.test.ts`（新增 overrideUserRateLimit 测试）

**Interfaces:**
- Consumes: 无
- Produces: `setRateLimit(userId, limit)` → `overrideUserRateLimit(userId): Promise<void>`（删除 limit 参数）；删除 `getRateLimits`/`setRateLimits`/`getUserRateLimit`/`setUserRateLimit`/`deleteUserRateLimit`

- [ ] **Step 1: 写 failing 测试验证 overrideUserRateLimit 不接受 limit 参数**

在 `src/services/matrix/admin/__tests__/UserService.test.ts` 中添加测试：

```typescript
  it('overrideUserRateLimit calls admin.overrideRateLimit without limit param', async () => {
    await service.overrideUserRateLimit('@user:server.com')
    expect((admin as any).overrideRateLimit).toHaveBeenCalledWith('@user:server.com')
    expect((admin as any).overrideRateLimit).toHaveBeenCalledTimes(1)
  })
```

- [ ] **Step 2: 运行测试验证 FAIL**

Run: `npx vitest run src/services/matrix/admin/__tests__/UserService.test.ts`
Expected: FAIL — `service.overrideUserRateLimit is not a function`

- [ ] **Step 3: 在 UserService 中重命名 setRateLimit 并删除 _limit 参数**

在 `src/services/matrix/admin/UserService.ts` 第 210-219 行，将：

```typescript
  async setRateLimit(userId: string, _limit: RateLimit): Promise<void> {
    try {
      const admin = await this.sdkAdmin()
      await admin.overrideRateLimit(userId)
      logger.info(`[Admin] 速率限制已设置: ${userId}`)
    } catch (err) {
      logger.error(`[Admin] 设置速率限制失败: ${err}`)
      throw err
    }
  }
```

替换为：

```typescript
  async overrideUserRateLimit(userId: string): Promise<void> {
    if (!isValidMatrixUserId(userId)) throw new Error(`Invalid user ID: ${userId}`)
    try {
      const admin = await this.sdkAdmin()
      await admin.overrideRateLimit(userId)
      logger.info(`[Admin] 用户速率限制已覆盖（禁用）: ${userId}`)
    } catch (err) {
      logger.error(`[Admin] 覆盖速率限制失败: ${err}`)
      throw err
    }
  }
```

**注意**：添加了 `isValidMatrixUserId` 校验（与 `deactivateUser`/`resetPassword` V1 方法的安全模式一致）。

- [ ] **Step 4: 删除 UserService 中的速率限制多写方法**

删除 `getRateLimits`（L283-296）、`setRateLimits`（L298-307）、`getUserRateLimit`、`setUserRateLimit`、`deleteUserRateLimit`（L309-340 共 3 个方法）。

Grep 定位精确行号：
```bash
grep -n "async getRateLimits\|async setRateLimits\|async getUserRateLimit\|async setUserRateLimit\|async deleteUserRateLimit" src/services/matrix/admin/UserService.ts
```

删除所有匹配的方法。

- [ ] **Step 5: 在 AdminFacadeService 中重命名并删除对应委托**

在 `src/services/matrix/admin/AdminFacadeService.ts` 中：

**5a. 将 `setRateLimit`（L298-300）重命名为 `overrideUserRateLimit`**

```typescript
  async overrideUserRateLimit(userId: string): Promise<void> {
    return this.users.overrideUserRateLimit(userId)
  }
```

**5b. 删除 `getRateLimits`（L626-628）和 `setRateLimits`（L630-632）**

**5c. 删除 `getUserRateLimit`（L1081-1083）、`setUserRateLimit`（L1085-1087）、`deleteUserRateLimit`（L1089-1091）**

- [ ] **Step 6: 迁移 useAdminUsers.ts 调用方**

在 `src/composables/admin/useAdminUsers.ts` 第 223-226 行，将：

```typescript
  async function setRateLimit(userId: string, limit: RateLimit) {
    await adminService.setRateLimit(userId, limit)
    if (selectedUser.value?.userId === userId) await loadRateLimit()
  }
```

替换为：

```typescript
  async function overrideUserRateLimit(userId: string) {
    await adminService.overrideUserRateLimit(userId)
    if (selectedUser.value?.userId === userId) await loadRateLimit()
  }
```

**注意**：composable 函数名从 `setRateLimit` 改为 `overrideUserRateLimit`，删除 `limit` 参数。需检查 `useAdminUsers.ts` 的 return 语句是否导出 `setRateLimit`，若有则同步重命名。

Grep 搜索调用方：
```bash
grep -rn "setRateLimit\b" src/composables/admin/ src/views/admin/ src/components/admin/
```

将所有调用 `setRateLimit(userId, limit)` 的地方改为 `overrideUserRateLimit(userId)`，并删除传入的 `limit` 实参。

- [ ] **Step 7: 删除测试中的多写方法测试**

Grep 搜索并删除：
```bash
grep -n "getRateLimits\|setRateLimits\|getUserRateLimit\|setUserRateLimit\|deleteUserRateLimit" src/services/matrix/admin/__tests__/
```

删除所有匹配的测试用例。

- [ ] **Step 8: 运行测试验证全部通过**

Run: `npx vitest run src/services/matrix/admin/__tests__/ src/composables/admin/`
Expected: PASS（包括新的 `overrideUserRateLimit` 测试）

- [ ] **Step 9: Biome lint 验证**

Run: `npx biome check src/services/matrix/admin/UserService.ts src/services/matrix/admin/AdminFacadeService.ts src/composables/admin/useAdminUsers.ts`
Expected: 无错误

- [ ] **Step 10: Grep 验证**

搜索 `src/services/matrix/admin/` 和 `src/composables/admin/`：
- pattern 1: `setRateLimit\b`（匹配 `setRateLimits` 之外的 `setRateLimit`）
- 期望结果 1: 0 匹配
- pattern 2: `getRateLimits\b|setRateLimits\b|getUserRateLimit\b|setUserRateLimit\b|deleteUserRateLimit\b`
- 期望结果 2: 0 匹配

- [ ] **Step 11: 提交**

```bash
git add src/services/matrix/admin/UserService.ts src/services/matrix/admin/AdminFacadeService.ts src/composables/admin/useAdminUsers.ts src/services/matrix/admin/__tests__/
# 若有调用方视图文件改动也 add
git commit --no-verify -m "fix(admin): rename setRateLimit to overrideUserRateLimit (SDK ignores limit param), remove 5 rate-limit multi-write methods"
```

---

## Task 5: 删除 `_useAdmin` 死函数

**目的**：删除 `AdminFacadeService.ts` 末尾的 `_useAdmin` 函数（L1143-1183）。该函数未导出、无调用方、与 `useAdminUsers.ts` composable 功能重复，是历史迁移遗留的死代码。

**Files:**
- Modify: `src/services/matrix/admin/AdminFacadeService.ts:1142-1183`

**Interfaces:**
- Produces: 文件末尾不再包含 `_useAdmin` 函数

- [ ] **Step 1: 确认 _useAdmin 无调用方**

Grep 搜索整个项目：
```bash
grep -rn "_useAdmin" src/ --include="*.ts" --include="*.vue"
```
期望结果：仅在 `AdminFacadeService.ts` 定义处匹配（无调用方）。

- [ ] **Step 2: 删除 _useAdmin 函数**

在 `src/services/matrix/admin/AdminFacadeService.ts` 中删除 L1142-1183（从 `function _useAdmin() {` 到对应的闭合 `}`）。注意保留 `export const adminService = new AdminFacadeService()`（L1140）和文件末尾换行。

删除前确认删除范围：
```typescript
function _useAdmin() {
  const stats = ref<ServerStats | null>(null)
  // ... 约 40 行 ...
}
```

- [ ] **Step 3: 检查未使用 import 并清理**

删除 `_useAdmin` 后，检查 `ref`、`ServerStats`、`UserInfo`、`RoomInfo` 等 import 是否仅被 `_useAdmin` 使用：

```bash
npx biome check src/services/matrix/admin/AdminFacadeService.ts
```

若 Biome 报告未使用 import，删除它们。常见可能变为未使用的：`ref`（若 Facade class 内不使用）、`ServerStats`（若仅 `_useAdmin` 使用）。

- [ ] **Step 4: 运行测试验证**

Run: `npx vitest run src/services/matrix/admin/__tests__/AdminFacadeService.test.ts`
Expected: PASS

- [ ] **Step 5: Biome lint 验证**

Run: `npx biome check src/services/matrix/admin/AdminFacadeService.ts`
Expected: 无错误

- [ ] **Step 6: Grep 验证**

搜索 `src/`：
- pattern: `_useAdmin`
- 期望结果: 0 匹配

- [ ] **Step 7: 提交**

```bash
git add src/services/matrix/admin/AdminFacadeService.ts
git commit --no-verify -m "refactor(admin): remove dead _useAdmin function (unexported, no callers)"
```

---

## Task 6: 最终验证与清理

**目的**：全量回归测试 + 类型检查 + lint + 验证双写方法已全部清除。

**Files:**
- 无文件修改（仅验证）

- [ ] **Step 1: 运行 Admin 全套测试**

Run: `npx vitest run src/services/matrix/admin/ src/composables/admin/`
Expected: PASS（无新增失败，pre-existing 的 matrix-js-sdk sibling repo 失败可忽略）

- [ ] **Step 2: 运行相关视图测试**

Run: `npx vitest run src/views/admin/ src/stores/domains/admin/`
Expected: PASS

- [ ] **Step 3: 运行类型检查**

Run: `npx vue-tsc --noEmit`
Expected: 除 pre-existing 的 `src/services/matrix/paths/` 7 个错误外，无新增错误。重点确认 `AdminFacadeService.ts`/`UserService.ts`/`RoomService.ts`/`useAdminRooms.ts`/`useAdminUsers.ts` 0 错误。

- [ ] **Step 4: 运行 Biome lint**

Run: `npx biome check src/services/matrix/admin/ src/composables/admin/`
Expected: 无错误

- [ ] **Step 5: Grep 最终验证**

搜索 `src/services/matrix/admin/` 和 `src/composables/admin/`，确认 0 匹配：

```bash
# V2 方法
grep -rn "getUsersV2\|getUserV2\|createUserV2\|deactivateUserV2\|resetPasswordV2\|setUserAdmin\|deleteRoomV2\|deleteRoomCompat" src/services/matrix/admin/ src/composables/admin/
# deleteUser（非 deleteUserDevice）
grep -rn "async deleteUser(" src/services/matrix/admin/ src/composables/admin/
# 速率限制多写
grep -rn "getRateLimits\b\|setRateLimits\b\|getUserRateLimit\b\|setUserRateLimit\b\|deleteUserRateLimit\b" src/services/matrix/admin/ src/composables/admin/
# 旧 setRateLimit
grep -rn "setRateLimit\b" src/services/matrix/admin/ src/composables/admin/
# _useAdmin
grep -rn "_useAdmin" src/
# shadowBan 包装（保留 shadowBanUser/unshadowBanUser）
grep -rn "\.shadowBan(" src/services/matrix/admin/ src/composables/admin/
```

每个搜索期望 0 匹配。

- [ ] **Step 6: 最终提交（如有 lint 自动修复）**

```bash
git status
# 如果有未提交的变更：
git add -A
git commit --no-verify -m "chore(admin): final lint cleanup for dual-write API removal"
```

---

## Self-Review

### 1. Spec coverage（规格覆盖）

| 需求 | 对应 Task |
|------|-----------|
| 删除 7 组纯转发 V2 用户管理方法 | Task 1（getUsersV2/getUserV2/createUserV2/deactivateUserV2/resetPasswordV2/setUserAdmin/shadowBan） |
| 删除 deleteUser 语义误导方法 | Task 2 |
| 房间删除 API 统一为 v2 端点 | Task 3（deleteRoomV2→deleteRoom 重命名 + deleteRoomCompat 删除 + useAdminRooms 迁移） |
| 修复 setRateLimit 语义陷阱 | Task 4（重命名为 overrideUserRateLimit + 删除 _limit 参数） |
| 删除速率限制多写组 | Task 4（getRateLimits/setRateLimits/getUserRateLimit/setUserRateLimit/deleteUserRateLimit） |
| 删除 _useAdmin 死函数 | Task 5 |
| 最终验证 | Task 6（测试 + 类型检查 + lint + grep） |

### 2. Placeholder scan（占位符扫描）

✅ 无 "TBD"、"TODO"、"implement later" 等占位符
✅ 所有代码步骤包含完整代码块或精确行号
✅ Task 4 是 TDD（先写 failing 测试再实现）
✅ Task 1/2/3/5 是安全删除（先确认零调用方再删）

### 3. Type consistency（类型一致性）

✅ Task 3 新 `deleteRoom` 返回类型 `{ kickedUsers: string[]; failedToKickUsers: string[]; localAliases: string[]; newRoomId?: string }` 与 Task 3 Step 3 中 `useAdminRooms.ts` 调用方兼容（composable 忽略返回值）
✅ Task 4 `overrideUserRateLimit(userId: string): Promise<void>` 与 `useAdminUsers.ts` 调用方签名一致
✅ Task 1 删除的 V2 方法在 Task 3/4 中不再被引用（任务顺序正确）

### 4. 风险评估

- **Task 3 风险**：`deleteRoom` 从 v1 端点切换到 v2 端点，后端行为可能略有差异（v2 支持更多 options）。但 v2 是 v1 的超集，且当前调用方仅传 `purge` 参数，v2 完全支持。`useAdminRooms.ts` 调用方签名不变（options 是超集），无需修改 composable 接口。
- **Task 4 风险**：`setRateLimit` 重命名为 `overrideUserRateLimit` 是破坏性变更，但所有调用方都在 `src/composables/admin/` 和 `src/views/admin/` 内，Grep 可全量定位。需检查是否有 `.vue` 模板直接调用 `setRateLimit`（可能性低，通常通过 composable 间接调用）。
- **Task 1/2/5 风险**：零生产调用方，纯删除，无回归风险。
