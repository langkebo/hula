# Space Phase 2: 空间设置页设计

> **日期**: 2026-08-24
> **范围**: 空间 UI 缺失功能补齐 — Phase 2（空间设置页）
> **执行范式**: brainstorming → writing-plans → implementation → verification

---

## 1. 背景与目标

Phase 1 已补齐空间内「创建房间 / 邀请成员 / 建议标记」三个核心交互。Phase 2 聚焦**空间设置页**，让空间创建者能够管理空间的元数据与可见性。

**范围收敛依据**：后端深挖发现 synapse-rust 的"空间"是**自定义非 Matrix 扩展**，空间只有单一 `creator` + 扁平 `membership`（invite/join/leave），**没有 power_levels、kick/ban 能力**。因此 Phase 2 排除「成员角色/权限管理」和「成员移除/踢出」，只做后端已支持的功能。

**目标**：实现一个完整的空间设置页，覆盖名称/描述/头像/可见性/加入规则/统计信息 6 项能力。

---

## 2. 后端能力确认（已深挖）

后端 `PUT /spaces/{space_id}` 的 `UpdateSpaceBody` 支持恰好 6 个字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| `name` | `Option<String>` | 空间名称 |
| `topic` | `Option<String>` | 空间描述/公告 |
| `avatar_url` | `Option<String>` | 空间头像 |
| `join_rule` | `Option<String>` | 加入规则（"public" / "invite"） |
| `visibility` | `Option<String>` | 可见性（"public" / "private"） |
| `is_public` | `Option<bool>` | 是否公开（与 visibility 联动） |

**不支持**：`history_visibility`（任何层都无此字段）、`power_levels`、成员移除。

SDK `UpdateSpaceOptions`（`matrix-js-sdk/src/space/types.ts:106-113`）已完整支持这 6 个字段，无需改 SDK。

**前端缺口**：`MatrixSpaceService.updateSpace` 当前只透传 `name`/`topic`/`avatar_url`，**未传 `join_rule`/`visibility`/`is_public`**，且 `SpaceOptions` 的 `visibility` 字段在 update 路径未被消费。

---

## 3. 功能设计

### 3.1 入口

`SpaceChildrenPane.vue` 的 `SpaceHeader` 已有 `@settings` 事件 → `handleSpaceSettings`（当前仅切回 overview 子视图）。改为打开设置页 `SpaceSettingsPane.vue`。

### 3.2 设置页字段（6 项全选）

| 字段 | 组件 | 必填 | 说明 |
|------|------|------|------|
| 空间名称 | `n-input` | 是 | 最长 255 字符 |
| 描述/公告 | `n-input[textarea]` | 否 | 最长 4096 字符 |
| 头像 | `n-upload` | 否 | 上传后回填 avatar_url |
| 可见性 | `n-radio-group` | 是 | "public" / "private" |
| 加入规则 | `n-radio-group` | 是 | "public" / "invite" |
| 统计信息 | 只读文本 | - | memberCount / childCount |

### 3.3 字段联动规则

- **可见性 `public` ↔ `is_public=true`**，`private` ↔ `is_public=false`，两者同步提交
- **可见性与加入规则的关系**（遵循后端语义）：
  - `visibility=public` 时，`join_rule` 允许 `public` 或 `invite`
  - `visibility=private` 时，`join_rule` 仅允许 `invite`（后端预设逻辑中 private 强制 invite）
- 提交时若用户改了可见性但未显式改 join_rule，按上述规则兜底：private 强制 invite

### 3.4 保存流程

```
用户编辑字段 → 点击"保存"
  ↓
matrixSpaceService.updateSpace(spaceId, {
  name, topic, avatarUrl, visibility, joinRule, isPublic
})
  ↓
成功：showFeedback 成功 toast + 刷新空间详情
  ↓
失败：showFeedback 错误 toast，保留表单
```

### 3.5 权限

- 仅空间创建者（`canManageSelectedSpace`）可打开设置页
- 非创建者隐藏设置入口（现有 `canManage` 已实现）

---

## 4. 关键文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/components/space/SpaceSettingsPane.vue` | **Create** | 空间设置页 |
| `src/services/matrix/room/MatrixSpaceService.ts` | Modify | 扩展 `SpaceOptions` 增 `joinRule`/`isPublic`；`updateSpace` 补传这 3 个字段 |
| `src/composables/space/useSpace.ts` | Modify | `update` 透传 joinRule/isPublic |
| `src/components/space/SpaceChildrenPane.vue` | Modify | `handleSpaceSettings` 改为打开设置页 |
| 各 `__tests__/*.test.ts` | Create/Modify | 单元测试 |

---

## 5. 关键设计决策

1. **统计信息用 `getSpace` 的 `memberCount`/`childCount`**，不接入有坑的 `/spaces/statistics` 端点（SDK `SpaceStatistics` 类型与后端返回的列表不匹配，属已知 bug，Phase 2 不修）。
2. **不改 SDK**：`UpdateSpaceOptions` 已完整，仅前端透传。
3. **`is_public` 与 `visibility` 联动**：前端用单一 `visibility` 状态推导 `is_public`，提交时一并写入，避免两个状态不一致。

---

## 6. 共享设计约束

（同 Phase 1，从略——见 `2026-08-22-space-phase1-core-interactions-design.md` §5）
- `<script setup lang="ts">` + Composition API
- `--tjg-*` token，禁硬编码颜色；SVG 图标 1.5px 线宽
- `prefers-reduced-motion`
- i18n `t('space.xxx', '中文兜底')`
- try-catch + `showFeedback` + `createLogger`
- 组件 ≤ 800 行
- 守门：`vue-tsc --noEmit` / `test:run` / `check` / `check:doc-coverage`

---

## 7. 实施顺序

```
1. MatrixSpaceService 扩展 SpaceOptions + updateSpace 补传
2. useSpace.update 透传
3. SpaceSettingsPane.vue（新建）
4. SpaceChildrenPane 接线
5. 单元测试
6. 质量守门
```

---

## 8. 不做的事（YAGNI）

- ❌ 成员角色/权限管理（后端无 power_levels）
- ❌ 成员移除/踢出（后端仅自我 leave）
- ❌ 历史可见性设置（后端无 history_visibility）
- ❌ 修复 SDK getSpaceStatistics 类型不匹配
- ❌ 空间归档/转让/标签/模板
