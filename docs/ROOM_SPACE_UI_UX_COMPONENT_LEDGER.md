# Room/Space UI/UX Component Ledger

> Version: v1.0.0
> Date: 2026-05-10
> Related plan: `docs/ROOM_SPACE_UI_UX_OPTIMIZATION_PLAN.md`
> Scope: room list, space list, three-pane workbench, room/space management overlays

---

## 1. Purpose

This ledger translates the room/space UI optimization plan into an implementation-facing checklist.

It answers five practical questions:

1. Which current components are in scope
2. What problem each component currently has
3. What target interaction it should evolve into
4. Whether the current modal or drawer should remain
5. What tests and stories must be updated together

This document is intended for design review, engineering decomposition, and phased delivery planning.

---

## 2. Scope Baseline

The current implementation already has a strong workbench foundation:

- `src/components/workbench/RoomSpaceWorkbench.vue`
- `src/components/workbench/RoomSessionList.vue`
- `src/components/workbench/HulaRoomListItem.vue`
- `src/components/workbench/SpaceListPane.vue`
- `src/components/workbench/RoomSpaceToolbar.vue`
- `src/components/workbench/RoomSpaceActionBar.vue`
- `src/components/workbench/WorkbenchDetailPane.vue`
- `src/views/homeWindow/RoomList.vue`
- `src/views/homeWindow/SpaceList.vue`

These components should stay the center of gravity for room/space optimization.

---

## 3. Component Ledger

| Component | Current role | Current issue | Target state | Action | Priority |
|---|---|---|---|---|---|
| `RoomSpaceWorkbench.vue` | Three-pane container | Container is correct, but lacks explicit mode orchestration and batch-mode coordination | Canonical room/space workbench shell with pane-level state machine | Refactor | P0 |
| `RoomSessionList.vue` | Virtualized room/session list | Already virtualized, but interaction layer is still single-item oriented | Primary work queue with batch mode, inline action states, unified loading/error states | Refactor | P0 |
| `HulaRoomListItem.vue` | Room card renderer | Information hierarchy is dense but visually competitive | High-scan room card with clearer primary/secondary state grouping | Refactor | P0 |
| `SpaceListPane.vue` | Space scope list | Too menu-like; weak context, no grouping, no virtualization threshold | Grouped space navigation surface with richer cards and quick actions | Refactor heavily | P0 |
| `RoomSpaceToolbar.vue` | Search/filter/sort toolbar | Functional but lacks active-filter summary, presets, batch affordances | Operational toolbar with summaries, presets, clear-all, quick filters | Refactor | P0 |
| `RoomSpaceActionBar.vue` | Active-space action row | Good start, but not enough quick operations or contextual summaries | Compact active-scope action bar with quick operations and state indicators | Refactor | P1 |
| `WorkbenchDetailPane.vue` | Right-side summary and inline manage pane | Carries too many responsibilities in one vertical stack | Mode-based right pane: summary, manage, members, activity | Refactor heavily | P0 |
| `ListWorkbenchShell.vue` | Generic room list shell | Minimal and valid, but no explicit responsive behavior hooks | Shared shell primitive for room-only and space-aware lists | Keep, extend lightly | P2 |
| `RoomList.vue` | Room-only page wiring | Uses shared patterns but not yet aligned with future batch mode and summary patterns | Room-only work queue page using upgraded shared workbench primitives | Refactor | P1 |
| `SpaceList.vue` | Space-aware page wiring | Already closest to target architecture | Primary entry for room/space workbench behaviors | Keep, extend | P0 |

---

## 4. Overlay Audit

### 4.1 In-scope overlays reviewed

The following overlay components are directly related to room/space workflows or nearby list management flows:

- `src/components/room/CreateRoomDialog.vue`
- `src/components/space/CreateSpaceDialog.vue`
- `src/components/space/AddToSpaceDialog.vue`
- `src/components/rightBox/ForwardDialog.vue`
- `src/components/chat/ChatHistoryDrawer.vue`
- `src/components/chat/MultiMsgDrawer.vue`
- `src/components/search/SpotlightDialog.vue`
- `src/components/friend/FriendDetailDrawer.vue`

### 4.2 Overlay decision matrix

| Overlay component | Current type | Keep as-is? | Proposed replacement | New host region | Rationale | Priority |
|---|---|---|---|---|---|---|
| `CreateRoomDialog.vue` | Modal | No | Inline create-room flow | Right pane or center-pane create state | Room creation is contextual to navigation and should not block the workbench | P1 |
| `CreateSpaceDialog.vue` | Inline dialog body / modal-driven usage | No | Inline create-space form | Right pane | Space creation belongs to the space workbench itself | P0 |
| `AddToSpaceDialog.vue` | Dialog body / modal-driven usage | No | Inline add-room form | Right pane manage mode | Already conceptually duplicated by `WorkbenchDetailPane` manage flow | P0 |
| `ForwardDialog.vue` | Modal | Partially | Bottom action tray or right-side forwarding panel | Bottom tray or right pane | Forwarding is selection-based and should not always interrupt reading context | P1 |
| `ChatHistoryDrawer.vue` | Drawer | Partially | Keep as secondary non-modal surface | Right pane tab or bottom drawer | Historical browsing is non-blocking and conceptually compatible with contextual panel behavior | P1 |
| `MultiMsgDrawer.vue` | Drawer | Partially | Fold into merged-message activity surface | Right pane activity mode or bottom drawer | Better as contextual expansion than a separate overlay pattern | P2 |
| `SpotlightDialog.vue` | Modal | No for room management flows | Expand into inline global search surface | Toolbar expansion or command shelf | Search should be keyboard-first but not room-management blocking | P1 |
| `FriendDetailDrawer.vue` | Drawer | No for workbench context | Convert to profile/detail card | Right pane | Friend detail is context information and fits summary pane patterns | P2 |

### 4.3 Overlays allowed to remain

The following interaction classes may continue to use modal patterns:

- encryption verification
- key backup and recovery
- destructive confirmation
- login or homeserver bootstrapping
- cross-context system-level actions

These are not primary targets of the room/space workbench cleanup.

---

## 5. Proposed New Components

| New component | Responsibility | Suggested host | Priority |
|---|---|---|---|
| `RoomBatchActionBar` | Batch room actions for selected sessions | Center pane | P0 |
| `RoomFilterSummaryBar` | Active filter summary, clear-all, saved views | Toolbar under-row | P0 |
| `SpaceListSection` | Render grouped space sections | Left pane | P0 |
| `SpaceListItemCard` | Rich space card | Left pane | P0 |
| `RoomStateIndicatorCluster` | Mention/mute/encryption/draft/status cluster | Room card | P1 |
| `WorkbenchPaneTabs` | Right-pane mode switcher | Right pane | P0 |
| `WorkbenchEmptyState` | Standardized empty/loading/error surface | Center and right pane | P1 |
| `WorkbenchQuickCreate` | Inline creation surface for room/space | Right pane or center pane | P1 |

---

## 6. Detailed Change Notes

### 6.1 `RoomSpaceWorkbench.vue`

Target changes:

- introduce explicit pane modes:
  - `default`
  - `batch`
  - `manage-space`
  - `manage-room`
  - `activity`
- centralize pane state transitions
- stop treating the right pane as a single long scroll stack
- provide shared orchestration points for:
  - selection
  - batch mode
  - scope switching
  - create flows

Tests to update:

- `src/components/workbench/__tests__/RoomSpaceWorkbench.test.ts`
- Storybook workbench stories

### 6.2 `SpaceListPane.vue`

Target changes:

- add sections:
  - all sessions
  - pinned spaces
  - joined spaces
  - low-priority spaces
- replace simple button rows with richer cards
- add quick actions on hover/focus
- add virtualization threshold or paginated sections for large lists
- add aggregate unread or activity indicators

Tests to add:

- grouped rendering
- keyboard navigation
- quick-action visibility rules
- virtualization threshold behavior

### 6.3 `HulaRoomListItem.vue`

Target changes:

- keep avatar and primary identity stable
- separate primary state from secondary metadata
- cap first-row chips to the two most important states
- introduce secondary metadata row for:
  - encryption
  - burn-after-read
  - member count
  - failed send or draft
- support batch-selection affordance

Tests to add:

- mention state priority
- invite state rendering
- muted/unread interaction priority
- compact mode rendering

### 6.4 `WorkbenchDetailPane.vue`

Target changes:

- split into explicit modes
- collapse the current all-in-one vertical stacking
- reuse existing manage forms but host only one task at a time
- absorb more contextual actions from dialogs and drawers
- introduce stable right-pane headers and tab-like mode switching

Tests to add:

- mode switching
- right-pane persistence across selection change
- inline form submit/cancel transitions

---

## 7. Batch Delivery Plan

### Batch A: Navigation and list structure

Scope:

- `SpaceListPane.vue`
- `RoomSpaceToolbar.vue`
- new `RoomFilterSummaryBar`
- Storybook updates for left/center pane

Output:

- grouped spaces
- active-filter summary
- clearer scope and count signals

### Batch B: Room card and work queue

Scope:

- `HulaRoomListItem.vue`
- `RoomSessionList.vue`
- new `RoomBatchActionBar`

Output:

- improved room card hierarchy
- batch selection mode
- standardized empty/loading/error states

### Batch C: Right pane conversion

Scope:

- `WorkbenchDetailPane.vue`
- `RoomSpaceActionBar.vue`
- `CreateSpaceDialog.vue`
- `AddToSpaceDialog.vue`

Output:

- stronger inline management
- fewer modal dependencies
- clearer right-pane responsibilities

### Batch D: Overlay cleanup and advanced workflows

Scope:

- `CreateRoomDialog.vue`
- `ForwardDialog.vue`
- `SpotlightDialog.vue`
- `ChatHistoryDrawer.vue`
- `MultiMsgDrawer.vue`

Output:

- overlay policy cleanup
- contextual non-modal replacements
- room-management flows consolidated into the workbench

---

## 8. Testing Ledger

| Area | Existing test anchor | Required update |
|---|---|---|
| Workbench container | `src/components/workbench/__tests__/RoomSpaceWorkbench.test.ts` | Add mode switching, batch mode, grouped space expectations |
| Room-only page | `src/views/homeWindow/__tests__/RoomList.test.ts` | Add filter summary and batch state tests |
| Storybook | `src/components/workbench/RoomSpaceWorkbench.stories.ts` | Add compact, empty, batch, error, and high-density stories |
| Space composables | `src/composables/workbench/__tests__/useRoomSpaceWorkbench.test.ts` | Add grouped scopes and filter synchronization expectations |
| Space-specific composables | `src/composables/space/__tests__/useSpace.test.ts` | Add richer space metadata behavior if grouping is data-driven |

Recommended new tests:

- `SpaceListPane.test.ts`
- `HulaRoomListItem.test.ts`
- `WorkbenchDetailPane.test.ts`
- `RoomBatchActionBar.test.ts`

---

## 9. Storybook Expansion Checklist

Add stories for:

- default workbench
- compact workbench
- narrow workbench
- unread-heavy room list
- invite-heavy room list
- grouped space list
- batch mode active
- right-pane manage-space mode
- right-pane members mode
- empty search result state
- list error state

These stories should become the visual review contract for implementation batches.

---

## 10. Exit Criteria

The component transformation work is complete only when:

- `SpaceListPane` is no longer a plain button list
- `HulaRoomListItem` has a clear primary/secondary information hierarchy
- the right pane supports explicit modes instead of one long mixed stack
- room/space contextual management no longer depends on unnecessary dialogs
- batch actions are available inline
- Storybook and tests reflect the new workbench states

---

## 11. Recommended Immediate Tasks

1. Create `SpaceListPane` redesign issue
2. Create `HulaRoomListItem` hierarchy issue
3. Create `WorkbenchDetailPane` mode-system issue
4. Add workbench batch-mode story and tests
5. Mark `CreateSpaceDialog` and `AddToSpaceDialog` as migration targets into inline right-pane flows
