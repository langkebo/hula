# HuLa Room/Space UI/UX Optimization Plan

> Version: v1.0.0
> Date: 2026-05-10
> Scope: `/Users/ljf/Desktop/hu_ts/hula`
> Reference baseline: `element-desktop` product shell constraints, `hula` current desktop three-pane workbench, existing Design Token system, Storybook and test assets
> Companion ledger: `docs/ROOM_SPACE_UI_UX_COMPONENT_LEDGER.md`

---

## 1. Goal

This document defines a focused UI/UX optimization plan for HuLa's room list and space list under the following fixed constraints:

- Keep HuLa's current visual language consistent:
  - color tokens
  - typography
  - icon style
  - spacing rhythm
  - three-pane desktop structure
- Use `element-desktop` as an engineering and interaction reference, not as a direct visual clone
- Prioritize room management and space management workflows
- Replace modal-heavy flows with inline, sidebar, and drawer-based interactions where possible
- Preserve accessibility, responsiveness, and performance as first-class constraints

This is a design and implementation guide, not a request to rewrite the product shell.

---

## 2. Reference Principles

### 2.1 What to learn from `element-desktop`

The value of `element-desktop` for this task is not a component-level copy. The useful reference is its product shell discipline:

- clear separation between shell concerns and content concerns
- performance-first rendering for long-lived desktop sessions
- progressive disclosure instead of stacking disruptive dialogs
- predictable layout regions for navigation, content, and context
- typed boundaries between UI, platform features, and service logic

For HuLa, that translates into:

- keep desktop workbench concerns inside the workbench shell
- keep Matrix and backend calls in services/composables, not in presentation components
- prefer persistent side regions over modal interruptions
- optimize room/space navigation for long-running use, high density, and fast scanning

### 2.2 What to keep from `hula`

HuLa already has the right foundations and should build on them:

- desktop three-pane workbench
- Design Token based theme variables in `src/styles/scss/global/variable.scss`
- a unified room-space workbench shell in `src/components/workbench/RoomSpaceWorkbench.vue`
- room list virtualization in `src/components/workbench/RoomSessionList.vue`
- inline detail and management pane in `src/components/workbench/WorkbenchDetailPane.vue`
- Storybook coverage for the workbench in `src/components/workbench/RoomSpaceWorkbench.stories.ts`

The optimization target is therefore refinement, not redesign from zero.

---

## 3. Current-State Audit

### 3.1 Existing structural baseline

Current implementation already provides a strong starting point:

- `src/components/workbench/RoomSpaceWorkbench.vue`
  - hosts toolbar, space pane, room list, detail pane
- `src/views/homeWindow/SpaceList.vue`
  - wires space management into the unified workbench
- `src/views/homeWindow/RoomList.vue`
  - provides room-only list mode with shared shell patterns
- `src/components/workbench/HulaRoomListItem.vue`
  - already implements a dense room card with avatar, preview, unread, invite CTA, tags, and presence
- `src/components/workbench/SpaceListPane.vue`
  - renders the current space list as a simple vertical button list
- `src/components/workbench/WorkbenchDetailPane.vue`
  - already replaces part of the old modal workflow with an inline right-side management surface

### 3.2 Existing strengths

- room cards already carry rich state
- room list already uses `RecycleScroller`
- filter/search/sort controls are already colocated at the top of the workbench
- right-side context pane already supports:
  - space invite
  - add room to space
  - edit space settings
  - member preview
  - group insights
- the token system is mature enough to support a layout refresh without introducing a second style system

### 3.3 Current gaps

The current room/space workbench still has several UX issues:

1. Space list hierarchy is too weak.
   - `SpaceListPane.vue` renders all spaces as plain buttons with a count.
   - It lacks:
     - visual grouping
     - quick actions
     - status indicators
     - topic/member context
     - favorites/recently active patterns

2. Room card information density is high but not fully prioritized.
   - `HulaRoomListItem.vue` shows many states, but the layout still competes for attention.
   - Scanning unread, mentions, invite state, pinned state, and special tags can feel visually busy.

3. The toolbar is functional but not yet optimized for operational efficiency.
   - Search, filter, and sort are present.
   - Missing:
     - saved views
     - quick filter presets
     - batch mode
     - clearer active-filter summary

4. List performance strategy is inconsistent across panes.
   - Room list is virtualized.
   - Space list is not virtualized.
   - Scroll container composition is mixed and can be simplified.

5. Modal fragmentation still exists across adjacent workflows.
   - The workbench already moved some operations inline.
   - But multiple dialogs and drawers still exist around rooms, DMs, friends, invites, encryption, and forward flows.

6. The right pane is informative but not yet role-aware enough.
   - It mixes summary, management, member browsing, and announcement preview in one vertical stack.
   - It needs clearer section priority and mode switching.

---

## 4. Optimization Objectives

### 4.1 Experience objectives

- improve first-pass scan efficiency for room and space navigation
- reduce user interruption caused by popups and modal dialogs
- improve list readability without lowering information density too much
- make room and space management feel native to the three-pane layout
- keep the interface responsive across laptop, desktop, and smaller desktop widths

### 4.2 Product objectives

- reduce average interaction steps for:
  - locate a room
  - switch spaces
  - mute/pin/archive/manage a room
  - invite members to a space
  - inspect room/space status
- make the room-space workbench the canonical management surface
- reduce context loss from modal entry/exit

### 4.3 Technical objectives

- reuse the current service/composable/store layering
- extend the current Storybook workbench stories instead of introducing a parallel demo surface
- keep the theme system fully based on existing `--hula-*` tokens
- improve scroll consistency and measurable rendering performance

---

## 5. Target Information Architecture

### 5.1 Desktop three-pane model

The existing three-pane structure remains unchanged:

1. Left pane: space navigation and saved scopes
2. Center pane: room/session list and bulk operations
3. Right pane: context detail, inline management, and secondary actions

### 5.2 Responsibility by pane

#### Left pane: scope selection

The left pane should answer only one question:

"What scope am I browsing right now?"

It should contain:

- global scope entry
- favorite spaces
- joined spaces
- archived or low-priority spaces
- space search
- quick create and quick join actions

It should not contain heavy management forms by default.

#### Center pane: primary work queue

The center pane should answer:

"Which room should I act on next?"

It should contain:

- search
- active filter summary
- quick filter chips
- sort presets
- room cards
- bulk selection bar when needed
- inline empty/loading/error states

#### Right pane: context and inline management

The right pane should answer:

"What do I need to know or change about the selected item?"

It should contain:

- selected room summary
- selected space summary
- context actions
- inline management forms
- preview information
- member directory and space-room directory

It should replace most workflow popups related to the current selection.

---

## 6. Room Card Redesign

### 6.1 Design direction

The room card should keep HuLa's current density, but redistribute emphasis.

Target structure:

```text
+--------------------------------------------------------------+
| Avatar | Name + state chips            | Time                |
|        | Preview / invite CTA / topic  | unread / mention    |
|        | secondary meta row            | mute / pin / status |
+--------------------------------------------------------------+
```

### 6.2 New card zones

#### Zone A: identity

- avatar
- online presence for direct chats
- room name
- optional room type icon:
  - DM
  - group
  - encrypted
  - invite

#### Zone B: priority state

Use at most two high-priority chips in the first row:

- mention
- invite
- pinned/favorite
- tombstoned/migrated

Low-priority labels should move to the secondary row or overflow tooltip.

#### Zone C: preview line

Preview line rules:

- one clear primary preview
- invite rooms show CTA in place, not mixed with normal preview text
- mention prefix remains visually strong
- muted state should be icon-led, not text-led, unless no preview is available

#### Zone D: secondary meta row

Optional secondary metadata:

- encryption badge
- room member count for groups
- draft indicator
- failed send indicator
- burn-after-read active state

This row should be collapsible in compact widths.

### 6.3 Room card density modes

Support three internal density modes while keeping one visual family:

- `comfortable`
  - default desktop width
- `compact`
  - smaller laptops
- `focus`
  - active-selection mode with stronger contrast and fewer secondary chips

### 6.4 Visual rules

- keep the current rounded card silhouette
- keep token-driven hover and active surfaces
- reduce simultaneous badge/chip competition
- preserve unread badge as the strongest quantitative cue
- make time metadata quieter than name and preview

---

## 7. Space Card and Space List Redesign

### 7.1 Current limitation

`SpaceListPane.vue` currently behaves more like a plain scope menu than a management surface.

### 7.2 Target list structure

The left pane should be segmented:

```text
[Search spaces]
[All sessions]

Pinned
- Design
- Engineering

Joined spaces
- Product
- Marketing
- Community

Low priority
- Archive
```

### 7.3 Space card structure

Each space item should include:

- avatar or generated space mark
- space name
- optional short topic
- room count
- unread aggregate dot or count
- optional management marker
- hover quick actions

Prototype:

```text
+-----------------------------------------------+
| [Icon]  Design Collaboration            12    |
|        Weekly reviews and design ops          |
|        45 members   6 rooms   updated 1h ago  |
+-----------------------------------------------+
```

### 7.4 Space list behaviors

- support virtual scroll once the list is larger than the threshold
- support incremental loading for public/discoverable spaces
- support keyboard navigation with roving focus
- support hover-revealed quick actions:
  - open
  - manage
  - favorite
  - mute aggregate notifications

### 7.5 Global scope entry

`All sessions` should be visually distinct from user-created spaces:

- fixed at the top
- use a neutral but stronger background
- show total sessions
- optionally show unread aggregate

---

## 8. Toolbar and Interaction Efficiency

### 8.1 Keep the current strengths

`RoomSpaceToolbar.vue` already has:

- inline search
- type filters
- engagement filters
- sort chips

These should stay inline.

### 8.2 Additions

Add the following capabilities without creating a modal:

- active filter summary pill row
- one-click "clear all filters"
- saved filter presets
- quick toggles:
  - unread
  - mentions
  - invites
  - encrypted
  - favorites
- search result count with scope label

### 8.3 Batch mode

Add an optional batch-selection mode for room management:

- select multiple rooms
- mute
- mark as read
- move to space
- pin/unpin
- archive or lower priority

Batch mode should appear as:

- a compact inline action bar above the room list
- not as a modal

### 8.4 Search behavior

Search should support:

- fuzzy local matching on currently loaded sessions
- optional server search handoff
- recent searches
- keyboard-first access
- inline empty state when no results match

---

## 9. Modal Cleanup and Non-Modal Replacement

### 9.1 Principle

If the action is contextual to the currently selected room or space, it should not open a blocking modal by default.

### 9.2 Replacement matrix

| Current interaction type | Proposed replacement | Placement |
|---|---|---|
| Create or manage space dialog | Inline manage mode | Right pane |
| Add room to space dialog | Inline form | Right pane |
| Invite to space dialog | Inline form | Right pane |
| Room quick settings popup | Embedded settings section | Right pane |
| Friend detail modal | Detail card | Right pane |
| Chat history drawer | Secondary contextual drawer | Bottom drawer or right pane tab |
| Multi-message actions drawer | Batch action bar + bottom tray | Center pane |
| Search spotlight dialog for room management | Inline global search surface | Toolbar expansion |

### 9.3 Dialogs that may remain

Some dialogs can remain because they are cross-context or security-sensitive:

- encryption verification
- key backup and recovery
- destructive confirmation with irreversible consequences
- external homeserver or login setup

Even for those, the design should prefer:

- fewer nested dialogs
- clearer origin context
- resumable flows

---

## 10. Right Pane Redesign

### 10.1 Target modes

The right pane should operate in explicit modes:

- `summary`
- `manage-space`
- `manage-room`
- `members`
- `activity`

Instead of stacking everything vertically at all times, the pane should prioritize mode switching.

### 10.2 Summary mode

Default summary mode should show:

- selected room title and avatar
- room type and encryption state
- unread and notification summary
- space membership
- members and announcement preview
- quick actions

### 10.3 Manage mode

Manage mode should reuse the current inline form pattern from `WorkbenchDetailPane.vue`, but organize fields by task and show one task at a time.

### 10.4 Member mode

Member directory should be:

- searchable
- filterable by online/admin/invite state
- lazy-loaded
- collapsible

### 10.5 Activity mode

Activity mode can absorb several former popup use cases:

- recent file activity
- pinned items
- draft state
- room-level alerts

---

## 11. Performance Plan

### 11.1 Current baseline

Room list already uses `RecycleScroller` in `RoomSessionList.vue`.

### 11.2 Required improvements

1. Align scrolling strategy between room list and space list.
   - room list stays virtualized
   - space list adopts virtualization when item count crosses threshold

2. Simplify scroll container ownership.
   - avoid nested scrolling where not needed
   - make the virtualized list the primary owner of scrolling behavior

3. Add pagination/incremental loading where full virtualization is not appropriate.
   - public spaces
   - archived spaces
   - room search results

4. Add measurable list metrics.
   - first paint of workbench list
   - scroll FPS
   - filter apply latency
   - search latency
   - selection-to-detail latency

### 11.3 Recommended thresholds

- room list first interactive render: `< 200ms`
- search/filter update latency: `< 100ms`
- space switch to updated room list: `< 150ms`
- long-list scroll FPS: `> 55`

---

## 12. Accessibility and WCAG 2.1

### 12.1 Required baseline

The redesigned workbench must satisfy WCAG 2.1 AA expectations for core navigation flows.

### 12.2 Requirements

- keyboard access to all room and space items
- visible focus state using existing focus token behavior
- semantic list roles where appropriate
- labelled search, filter, and sort controls
- sufficient color contrast for:
  - unread badges
  - active selection
  - hover states
  - muted states
- non-color indicators for:
  - mentions
  - muted rooms
  - selected state
  - invite state

### 12.3 Motion and feedback

- respect reduced-motion preference
- avoid animated reflow that interrupts keyboard focus
- keep hover-only actions reachable by keyboard

---

## 13. Responsive Strategy

### 13.1 Desktop ranges

Use the existing desktop workbench and refine behavior by width:

- `>= 1440px`
  - full three-pane layout
- `1200px - 1439px`
  - compact left and right panes
- `960px - 1199px`
  - right pane collapses to switchable drawer/tabbed side panel
- `< 960px`
  - use the mobile or narrow layout path rather than forcing dense desktop layout

### 13.2 Adaptation rules

- reduce chip count before reducing text readability
- collapse secondary metadata before shrinking primary identity
- move batch action bar to bottom dock on smaller widths
- turn right pane into contextual slide-over only after exhausting compact layout options

---

## 14. Component Library Update Plan

### 14.1 Existing components to evolve

- `src/components/workbench/HulaRoomListItem.vue`
- `src/components/workbench/SpaceListPane.vue`
- `src/components/workbench/RoomSpaceToolbar.vue`
- `src/components/workbench/RoomSpaceActionBar.vue`
- `src/components/workbench/WorkbenchDetailPane.vue`
- `src/components/workbench/RoomSessionList.vue`

### 14.2 New components to add

- `RoomScopeSummaryBar`
  - active filters and saved views
- `RoomBatchActionBar`
  - multi-select actions
- `SpaceListSection`
  - grouped space regions
- `SpaceListItemCard`
  - richer space card
- `RoomStateIndicatorCluster`
  - compact badge/icon cluster
- `WorkbenchEmptyState`
  - standardized empty/search-empty/error-empty surface

### 14.3 Storybook requirements

Extend Storybook stories for:

- default room list
- high-density unread scenario
- invite-heavy scenario
- empty states
- compact width
- large-space-list virtualization
- right-pane manage mode
- batch mode

---

## 15. Interaction Prototypes

### 15.1 Workbench default state

```text
+----------------+----------------------------------+----------------------+
| Search spaces  | Search rooms                     | Details              |
| All sessions   | Filters: All Unread Mention     | Selected room        |
|                | Sort: Recent                     | Status / members     |
| Pinned         |                                  | Quick actions        |
|  Design        | [Room card]                      |                      |
|  Engineering   | [Room card]                      | Space summary        |
|                | [Room card]                      | Recent activity      |
| Joined         | [Room card]                      |                      |
|  Product       | [Room card]                      |                      |
|  Community     |                                  |                      |
+----------------+----------------------------------+----------------------+
```

### 15.2 Batch mode

```text
+----------------------------------+
| 12 selected                      |
| Mark read  Move  Mute  Archive   |
+----------------------------------+
| [x] Room card                    |
| [x] Room card                    |
| [ ] Room card                    |
```

### 15.3 Inline manage mode

```text
+----------------------+
| Space settings       |
| Name                 |
| [..................] |
| Topic                |
| [..................] |
|                      |
| Cancel    Save       |
+----------------------+
```

### 15.4 Empty state

```text
+----------------------------------+
| No rooms match these filters     |
| Try clearing filters or search   |
| [Clear filters] [Create room]    |
+----------------------------------+
```

---

## 16. Development Implementation Guide

### 16.1 Phase 1: Structure and measurement

- audit all room/space related dialogs and drawers
- define the canonical non-modal replacement matrix
- add performance measurement hooks for:
  - list render
  - filter apply
  - space switch

### 16.2 Phase 2: Space pane upgrade

- refactor `SpaceListPane.vue` into grouped sections
- add richer space cards
- add virtual scroll threshold or paginated groups
- add quick actions and aggregate status indicators

### 16.3 Phase 3: Room card refinement

- simplify visual hierarchy in `HulaRoomListItem.vue`
- separate primary and secondary state
- add density mode support
- add batch-selection affordance

### 16.4 Phase 4: Right pane mode system

- split `WorkbenchDetailPane.vue` into mode-based subpanels
- keep existing inline manage flows
- add room management surface
- absorb more dialog responsibilities into contextual panes

### 16.5 Phase 5: Modal cleanup

- remove redundant room/space management dialogs
- keep only security-sensitive or cross-context dialogs
- route remaining overlay patterns through one clear overlay policy

### 16.6 Phase 6: Validation

- Storybook visual review
- keyboard navigation audit
- performance checks
- responsive checks
- targeted unit and integration tests

---

## 17. Testing and Validation

### 17.1 Unit tests

Add or update tests for:

- room card state priority rules
- space grouping logic
- filter summary and clear-all behavior
- batch mode selection logic
- right-pane mode switching

### 17.2 Integration tests

Cover:

- search and filter room list
- switch spaces and preserve context
- open inline manage mode from action bar
- update space settings without opening modal
- keyboard navigation through spaces and rooms

### 17.3 Storybook review matrix

Create visual stories for:

- light and dark themes
- compact and wide layouts
- empty, error, and loading states
- high badge density
- invite-heavy state
- selected room with right-pane summary

### 17.4 Performance checks

Track:

- list mount time
- re-filter time
- scroll smoothness
- selection-to-detail update time

---

## 18. Acceptance Criteria

The redesign is accepted when all of the following are true:

- visual language remains consistent with current HuLa tokens and component style
- room cards are easier to scan under unread, mention, invite, and favorite-heavy scenarios
- space list exposes stronger hierarchy and richer context
- room and space management flows no longer depend on unnecessary modal dialogs
- batch actions work inline in the workbench
- room list and space list remain responsive on different desktop widths
- keyboard navigation and focus visibility satisfy WCAG 2.1 AA expectations
- Storybook, tests, and implementation notes are updated together

---

## 19. Recommended Deliverables

To complete this initiative, the project should produce:

1. This optimization plan
2. Updated Storybook stories for the workbench
3. A Figma or equivalent prototype based on the wireframes in this document
4. A component change list by file
5. A modal cleanup ledger
6. A phased implementation PR plan

---

## 20. Immediate Next Steps

Recommended first execution batch:

1. Refactor `SpaceListPane.vue` into grouped, richer space cards
2. Refine `HulaRoomListItem.vue` information priority
3. Introduce `RoomBatchActionBar`
4. Convert more room/space actions into right-pane inline modes
5. Expand `RoomSpaceWorkbench.stories.ts` with compact, empty, and batch-mode stories
6. Add performance assertions around list filtering and space switching
