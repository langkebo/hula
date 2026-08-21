# Space Phase 1: 核心交互功能设计

> **日期**: 2026-08-22
> **范围**: 空间 UI 缺失功能补齐 — Phase 1（3 个功能）
> **执行范式**: brainstorming → writing-plans → implementation → verification

---

## 1. 背景与目标

Space 功能的 Service 层已覆盖后端 90%+ 能力，但 3 个核心交互 UI 缺失，导致用户体验断裂：

| 功能 | 描述 | Service 层状态 |
|------|------|---------------|
| 空间内创建房间 | 在当前空间内直接创建子房间 | `createRoom()` + `addChildToSpace()` 已实现 |
| 成员邀请 | 在成员列表中搜索并邀请用户 | `inviteToSpace()` 已实现 |
| 子房间建议标记 | 标记/取消标记建议房间 + 视觉区分 | `addChildToSpace({ suggested })` 已实现 |

**目标**：补齐这 3 个 UI，让用户在空间视图内完成"创建 → 邀请 → 组织"的核心工作流，无需跳出空间。

---

## 2. 功能 1：空间内创建房间

### 2.1 入口

空间头部工具栏 `SpaceViewHeader.vue` 的操作区域增加 `+` 按钮（下拉菜单），包含：
- **创建房间** — 打开空间内创建房间表单
- **添加已有房间** — 将已有房间挂载到当前空间（后续 Phase 实现，Phase 1 仅创建）

### 2.2 表单设计

弹出 `n-modal` 内嵌轻量表单（`SpaceCreateRoomPane.vue`）：

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| 房间名称 | `n-input` | 是 | - | 最大 255 字符 |
| 房间描述 | `n-input[textarea]` | 否 | - | 最大 4096 字符 |
| 标记为建议房间 | `n-switch` | 否 | `false` | 是否作为建议子房间展示 |

**不包含的字段**（遵循简化原则）：
- 加入规则：继承空间的 join_rule（public 空间 → public room，private 空间 → invite room）
- 预设/加密：不做为默认选项，用户可在全局创建房间中设置
- 邀请成员：创建后再邀请

### 2.3 创建流程

```
用户点击 + → 选择"创建房间" → 填写表单 → 点击"创建"
  ↓
Step 1: client.createRoom({
  name: formData.name,
  topic: formData.topic,
  visibility: spaceJoinRule === 'public' ? 'public' : 'private',
  room_types: undefined  // 普通房间，非 space
})
  ↓
Step 2: matrixSpaceService.addChildToSpace(currentSpaceId, roomId, {
  suggested: formData.suggested
})
  ↓
Step 3: 刷新空间子房间列表
  ↓
Step 4: 跳转到新房间（openMsgSessionByRoomId）
```

### 2.4 关键文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/components/space/SpaceCreateRoomPane.vue` | **新建** | 创建房间表单 |
| `src/components/space/SpaceViewHeader.vue` | **修改** | 增加 + 按钮和下拉菜单 |
| `src/composables/space/useSpaceRooms.ts` | **修改** | 增加 createRoomInSpace 方法 |
| `src/services/matrix/room/MatrixSpaceService.ts` | 无需修改 | 已有 createRoom + addChildToSpace |

### 2.5 边界情况

- **同名房间**：后端返回 409 M_ROOM_IN_USE 时，提示用户修改名称（不做 ignoreDuplicateName 逃生阀，因为空间内房间名重复不合理）
- **创建失败**：显示错误 toast，保留表单数据不重置
- **SpaceManager 注册失败**：非致命错误，房间已创建成功

---

## 3. 功能 2：成员邀请

### 3.1 入口

在 `SpaceMembersPane.vue` 成员列表下方增加一个内嵌搜索框组件。

### 3.2 交互设计

```
[SpaceMembersPane]
  ├─ 成员列表（已有）
  ├─ ──── 分隔线 ────
  └─ SpaceInviteBar（新增）
       ├─ 搜索输入框（placeholder: "输入 Matrix ID 邀请成员..."）
       ├─ 搜索结果下拉列表（输入后 debounce 300ms 搜索）
       │   ├─ 用户头像 + displayName + userId
       │   ├─ 已邀请标记（灰色 "已邀请"）
       │   └─ 已是成员标记（灰色 "已是成员"）
       └─ 点击未标记用户 → 调用 inviteToSpace()
```

### 3.3 搜索逻辑

使用 `MatrixUserDirectoryService.searchUserDirectory(query)` 搜索用户目录（后端已实现）。搜索结果需要过滤：
- 排除当前已邀请的用户（membership = "invite"）
- 排除当前已加入的用户（membership = "join"）
- 排除自己

### 3.4 邀请状态

在成员列表中区分展示：
- **已加入成员**：正常显示，无额外标记
- **已邀请用户**：在名字旁显示灰色 "已邀请" 标签
- 邀请成功后刷新成员列表

### 3.5 关键文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/components/space/SpaceInviteBar.vue` | **新建** | 内嵌搜索邀请组件 |
| `src/components/workbench/SpaceMembersPane.vue` | **修改** | 底部引入 SpaceInviteBar |
| `src/composables/space/useSpaceMembers.ts` | **修改** | 增加 invite 方法 + 已邀请状态 |
| `src/services/matrix/user/MatrixUserDirectoryService.ts` | 无需修改 | 已有 searchUserDirectory |

### 3.6 边界情况

- **搜索框为空**：不显示结果列表
- **搜索无结果**：显示 "未找到用户" 提示
- **邀请失败**：toast 提示错误，搜索框保留
- **重复邀请**：如果已经是邀请状态，按钮变为灰色 "已邀请"
- **用户目录不可用**：搜索框禁用，显示 "用户目录不可用" 提示

---

## 4. 功能 3：子房间建议标记

### 4.1 标记入口

**入口 A — 创建时**：SpaceCreateRoomPane 表单中的 "标记为建议房间" 开关（功能 1 已包含）

**入口 B — 子房间列表中切换**：在 SpaceChildrenPane 或 SpaceRoomGrid 的每个子房间项上增加标记操作

### 4.2 交互设计

子房间列表项操作：

```
[子房间行]
  ├─ 房间头像 + 名称
  ├─ 成员数（可选）
  └─ 操作区域
       ├─ 建议标记按钮（星标图标）
       │   ├─ 未标记：空心星标，hover 显示 "标记为建议"
       │   └─ 已标记：实心星标（主题色），hover 显示 "取消建议"
       └─ 移除按钮（已有，X 图标）
```

### 4.3 标记操作

点击星标按钮时：

```
toggleSuggested(spaceId, roomId, currentSuggested):
  if currentSuggested === false:
    // 标记为建议：通过 m.space.child 状态事件设置 suggested: true
    client.sendStateEvent(spaceId, 'm.space.child', {
      via: [...],
      suggested: true,
      order: existingOrder
    }, roomId)
  else:
    // 取消标记：设置 suggested: false
    client.sendStateEvent(spaceId, 'm.space.child', {
      via: [...],
      suggested: false,
      order: existingOrder
    }, roomId)
```

**注意**：由于后端 SpaceManager API 的 addChild 是 upsert 语义，直接用 `sendStateEvent` 修改 `suggested` 字段更精确。

### 4.4 视觉样式

建议房间在子房间列表中有特殊样式：
- 星标图标填充主题色（如 `--tjg-color-primary-500`）
- 房间名称旁显示一个小型 "建议" 标签（`n-tag` size="tiny"）
- 非建议房间无星标

### 4.5 关键文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/components/space/SpaceChildrenPane.vue` | **修改** | 子房间行增加星标按钮 |
| `src/components/space/SpaceRoomGrid.vue` | **修改** | 网格视图增加星标标记 |
| `src/composables/space/useSpaceRooms.ts` | **修改** | 增加 toggleSuggested 方法 |

### 4.6 边界情况

- **状态事件发送失败**：回滚本地状态，toast 提示
- **并发标记**：乐观更新（先改 UI，再发请求），失败时回滚
- **只读用户**：非空间创建者不显示星标按钮

---

## 5. 共享设计约束

### 5.1 组件规范

- 所有新组件使用 `<script setup lang="ts">` + Composition API
- 样式使用 UnoCSS 工具类 + SCSS scoped
- 遵循 `--tjg-*` 设计 token，禁止硬编码颜色
- 图标使用 SVG（`<svg>` / `<use>`），线宽 1.5px
- 动效尊重 `prefers-reduced-motion`
- 组件文件不超过 800 行

### 5.2 i18n

所有用户可见文本使用 `useI18n()` + `t('key')`，中文为 key，英文为 fallback。

### 5.3 错误处理

- 所有异步操作包裹 try-catch
- 错误通过 `useActionFeedback().showFeedback()` 展示 toast
- 日志通过 `createLogger('ComponentName')` 输出

### 5.4 测试

- 每个新组件配套 `__tests__/*.test.ts`
- 每个修改的 composable 配套测试
- 使用 `@vue/test-utils` mount + Vitest

### 5.5 质量守门

实施完成后必须通过：
- `pnpm vue-tsc --noEmit` — 类型检查 0 错误
- `pnpm test:run` — 单元测试全部通过
- `pnpm check` — Biome lint 无新 error
- `pnpm check:doc-coverage` — 无新增未文档化方法

---

## 6. 实施顺序

```
1. SpaceCreateRoomPane.vue（新建组件）
   ↓
2. SpaceViewHeader.vue 修改（增加 + 按钮 + 下拉菜单）
   ↓
3. useSpaceRooms.ts 修改（增加 createRoomInSpace）
   ↓
4. SpaceInviteBar.vue（新建组件）
   ↓
5. SpaceMembersPane.vue 修改（引入 SpaceInviteBar）
   ↓
6. useSpaceMembers.ts 修改（增加 invite）
   ↓
7. SpaceChildrenPane.vue 修改（星标按钮）
   ↓
8. SpaceRoomGrid.vue 修改（星标标记）
   ↓
9. useSpaceRooms.ts 修改（增加 toggleSuggested）
   ↓
10. 单元测试
   ↓
11. 质量守门验证
```

---

## 7. 不做的事（YAGNI）

- 不做"添加已有房间"（Phase 2 或后续）
- 不做拖拽排序（Phase 3）
- 不做权限管理/踢人（Phase 2）
- 不做空间设置页面（Phase 2）
- 不做空间通知设置（Phase 3）
- 不做空间邀请管理（Phase 3）
