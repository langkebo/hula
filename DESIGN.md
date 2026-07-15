# HuLa Design System

## Design Principles

1. **Dark & Light as Equal Citizens** — Every component must render correctly in both themes. The default follows the OS preference (`prefers-color-scheme`).
2. **Tokens, Not Hardcoded Values** — All colors, spacing, radii, and shadows reference `--hula-*` CSS custom properties defined in `src/styles/css/design-tokens.css`.
3. **Naive UI (Desktop) + Vant (Mobile)** — These are the foundational UI libraries. Custom components supplement, not replace, them.
4. **Empty States Are Features** — Every list, panel, and view has a designed empty state with icon, title, description, and CTA.
5. **Accessibility by Default** — Keyboard navigation, ARIA landmarks, `prefers-reduced-motion`, and minimum 44px touch targets on mobile.

## Token Architecture

Tokens follow a three-tier architecture defined in `src/styles/css/design-tokens.css`:

```
Tier 1: Raw Values  (--hula-brand, --hula-color-success-500, etc.)
Tier 2: Backward-Compatible Aliases  (--color-primary → --hula-color-primary-500)
Tier 3: Semantic Application Tokens  (--app-bg-color, --chat-left-bg, etc.)
```

### Prototype → `--hula-*` Token Mapping

The high-fidelity prototype at `docs/hula-prototype.html` uses short token names for prototyping speed. This table maps them to production tokens for reference during development:

| Prototype Token | Production Token | Dark Value | Light Value |
|---|---|---|---|
| `--accent` | `--hula-brand` | `#13987f` | `#13987f` |
| `--accent-dim` | `--hula-color-primary-600` | `#0f7a66` | `#0f7a66` |
| `--accent-soft` | `--hula-color-primary-100` | `rgba(19,152,127,0.15)` | `rgba(19,152,127,0.1)` |
| `--bg-deepest` | `--hula-surface-app` | `#161616` | `#fafafa` |
| `--bg-deep` | `--hula-surface-panel` | `#1b1b1b` | `#ffffff` |
| `--bg-mid` | `--hula-surface-panel-muted` | `#262626` | `#f5f5f5` |
| `--bg-light` | `--hula-surface-subtle` | `#303030` | `#f1f1f1` |
| `--bg-hover` | `--hula-surface-list-hover` | `color-mix(...)` | `color-mix(...)` |
| `--bg-popover` | `--hula-surface-elevated` | `#303030` | `#fdfdfd` |
| `--bg-search` | `--hula-surface-search` | `#282828` | `#eaeaea` |
| `--text-primary` | `--hula-text-primary` | `#ffffff` | `#18181c` |
| `--text-secondary` | `--hula-text-secondary` | `#909090` | `#505050` |
| `--text-muted` | `--hula-text-tertiary` | `#707070` | `#909090` |
| `--icon-color` | `--icon-color` | `#909090` | `#18181c` |
| `--error` | `--hula-color-danger-500` | `#ff7875` | `#ff4d4f` |
| `--warn` | `--hula-color-warning-500` | `#ffa940` | `#faad14` |
| `--info` | `--hula-color-info-500` | `#40a9ff` | `#1890ff` |
| `--success` | `--hula-color-success-500` | `#73d13d` | `#52c41a` |
| `--line-color` | `--hula-border-default` | `#404040` | `#e3e3e3` |
| `--r-lg` | `--hula-radius-lg` | `12px` | `12px` |
| `--r-md` | `--hula-radius-sm` | `8px` | `8px` |
| `--r-sm` | `--hula-radius-xs` | `4px` | `4px` |
| `--r-xs` | `--hula-radius-xs` | `4px` | `4px` |

**Rule:** Never add prototype tokens to production code. Always reference the `--hula-*` token. Use this mapping table when translating prototype designs to Vue components.

## Color System

### Brand

| Token | Value | Usage |
|---|---|---|
| `--hula-brand` | `#13987f` | Primary buttons, links, active states, badges |
| `--hula-brand-sidebar` | `#64a29c` | Left sidebar background |
| `--hula-color-primary-400` | `#1ab292` | Hover states |
| `--hula-color-primary-600` | `#0f7a66` | Pressed states |

### Functional Colors

| Role | Light | Dark | Token |
|---|---|---|---|
| Success | `#52c41a` | `#73d13d` | `--hula-color-success-500` |
| Warning | `#faad14` | `#ffa940` | `--hula-color-warning-500` |
| Danger | `#ff4d4f` | `#ff7875` | `--hula-color-danger-500` |
| Info | `#1890ff` | `#40a9ff` | `--hula-color-info-500` |

### Neutral Surfaces (Semantic)

| Layer | Light | Dark | Token |
|---|---|---|---|
| App background | `#fafafa` | `#161616` | `--app-bg-color` |
| Panel/Session list | `#ffffff` | `#1b1b1b` | `--center-bg-color` |
| Chat content | `#f1f1f1` | `#1b1b1b` | `--right-bg-color` |
| Sidebar | `#64a29c` | `rgba(62,101,100,0.8)` | `--left-bg-color` |
| Message bubble (mine) | `#f1f1f1` | `#303030` | `--chat-right-bg` |
| Message bubble (theirs) | `color-mix(...)` | `#13987f` | `--chat-left-bg` |

## Typography

| Scale | Size | Usage |
|---|---|---|
| `xs` | 10px | Badges, timestamps |
| `sm` | 12px | Captions, metadata |
| `base` | 14px | Body text, messages |
| `lg` | 16px | Subtitles, input text |
| `xl` | 18px | Section headers |
| `2xl` | 20px | Panel titles |
| `3xl` | 24px | Page titles |

Font family: `PingFang, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`

Font weight tokens: `--hula-font-weight-normal` (400), `--hula-font-weight-medium` (500), `--hula-font-weight-semibold` (600), `--hula-font-weight-bold` (700).

## Spacing

4px base scale: `4, 8, 12, 16, 20, 24, 32, 40` mapped to `--hula-space-1` through `--hula-space-10`.

## Border Radius

| Token | Value | Usage |
|---|---|---|
| `--hula-radius-xs` | 4px | Inputs, small buttons |
| `--hula-radius-sm` | 8px | Cards, message bubbles |
| `--hula-radius-md` | 10px | Panels |
| `--hula-radius-lg` | 12px | Modals, drawers |
| `--hula-radius-xl` | 16px | Large cards |
| `--hula-radius-2xl` | 20px | Hero sections |
| `--hula-radius-full` | 9999px | Avatars, pills |

## Shadows

Shadows are gated by the `--shadow-enabled` flag (1 = visible, 0 = hidden, controlled by user preference). Dark theme shadows use higher opacity values.

## Motion

| Duration | Token | Usage |
|---|---|---|
| 120ms | `--hula-motion-duration-fast` | Micro-interactions |
| 180ms | `--hula-motion-duration-normal` | Hover transitions |
| 240ms | `--hula-motion-duration-slow` | Panel transitions |
| 280ms | `--hula-motion-duration-overlay` | Modals, overlays |

Easing: `cubic-bezier(0.2, 0, 0, 1)` for standard, `cubic-bezier(0, 0, 0, 1)` for enter, `cubic-bezier(0.4, 0, 1, 1)` for exit.

Respect `prefers-reduced-motion: reduce` — disable all non-essential animations.

## Theme Switching

Themes are managed by `useSettingStore` (`src/stores/domains/settings/setting.ts`):

- **Pattern** (`themePattern`): User preference — `'light'`, `'dark'`, or `'os'` (default).
- **Content** (`themeContent`): Resolved theme — always `'light'` or `'dark'`.
- **Toggle:** `document.documentElement.dataset.theme = 'light' | 'dark'`.
- **Naive UI:** `<n-config-provider :theme="globalTheme">` in `NaiveProvider.vue`.
- **Vant:** `<van-config-provider :theme="...">` in `MobileLayout.vue`.
- **UnoCSS:** Dark variant gated on `[data-theme="dark"]` selector.

### Adding Dark Support to a New Component

```vue
<template>
  <div class="my-component bg-[--app-bg-color] text-[--text-color]">
    <!-- Or use UnoCSS dark: variant -->
    <div class="bg-white dark:bg-[#1b1b1b] text-gray-900 dark:text-white">
  </div>
</template>
```

Prefer referencing existing semantic tokens over inline UnoCSS colors. Only add new tokens to `design-tokens.css` when a color is reused across 3+ components.

## Component Patterns

### Empty States

Use `<EmptyState>` component with: icon (SVG), title, description, and optional CTA button. Never show a blank list.

### Message Actions

- **Desktop:** Hover over a message bubble to reveal the action bar (emoji react, reply, forward, copy, delete). Right-click for the full context menu with submenus.
- **Mobile:** Long-press (700ms) to trigger the context menu in grid mode.

### Encryption Status

- **First visit to encrypted room:** E2EE banner (green gradient, lock icon, dismissible).
- **After dismissal:** Small lock icon in chat header, tooltip "End-to-end encrypted".
- **Unencrypted room:** No indicator.

### Space Navigation

- **Default:** Tree view (`HulaSpaceTree.vue`) with expand/collapse, keyboard navigation, pagination.
- **Alternative:** Flat list toggle for shallow hierarchies.

## Responsive Breakpoints

| Breakpoint | Layout |
|---|---|
| ≥1700px | Full 4-column (nav + session list + chat + info panel) |
| 1200-1699px | 3-column (nav + session list + chat) |
| 768-1199px | 2-column (nav + chat, session list as overlay) |
| ≤767px | Mobile layout (Vant components, single column) |

## Accessibility Checklist

- All interactive elements have `:focus-visible` outlines
- Keyboard navigation: Tab through controls, Enter/Space to activate, Escape to close panels/modals
- ARIA: `aria-label` on icon-only buttons, `aria-live="polite"` for dynamic content, `role` attributes on custom widgets
- Touch targets ≥ 44px on mobile
- `prefers-reduced-motion` respected
- Skip link for keyboard users to bypass navigation

## Naive UI Theme Overrides

`NaiveProvider.vue` provides theme overrides for 15+ Naive UI component types. Brand colors are hardcoded (not CSS variables) because Naive UI uses `seemly/rgba()` internally. When adding a new override, add it to the `commonTheme` object for shared values, and to `darkThemeOverrides`/`lightThemeOverrides` for theme-specific adjustments.

## Vant CSS Variable Overrides

Vant dark mode is activated via `<van-config-provider theme="dark">`. Brand color overrides use `--van-*` CSS variables in `design-tokens.css`:

```css
--van-dialog-confirm-button-text-color: var(--hula-color-primary-500);
```

Add more `--van-*` overrides as needed for brand consistency, but prefer Vant's built-in dark theme for standard components.

## Admin UI Design Patterns

HuLa's admin panel (`/admin`) exposes synapse-rust management features. All admin views follow these conventions:

### Layout

- **Desktop:** Left sidebar (`AdminLayout.vue`, 220px) + content area. Sidebar sections: Overview, User Management, Room Management, Federation, Messaging, Security, System.
- **Mobile:** Single-column with drawer navigation. Same route structure under `/mobile/admin`.
- **Data tables:** Naive UI `<n-data-table>` with server-side pagination (`pageSize=20` default), sortable columns, and search filters above the table.
- **Detail modals:** `<n-modal>` or `<n-drawer>` for entity details. Drawer preferred when the detail view has multiple tabs or sub-actions.

### Status Indicators

| State | Component | Token |
|---|---|---|
| Healthy/Active | `<n-tag type="success">` | `--hula-color-success-500` |
| Warning | `<n-tag type="warning">` | `--hula-color-warning-500` |
| Error/Blocked | `<n-tag type="error">` | `--hula-color-danger-500` |
| Unknown/Offline | `<n-tag type="default">` | `--hula-text-tertiary` |

### Confirmation Dialogs

Destructive actions (deactivate user, delete room, purge media, ban IP) require confirmation via `<n-popconfirm>` or a dedicated `<n-modal>` with explicit action verb in the confirm button text. Never use a generic "OK" for destructive actions.

### Empty States in Admin

Use `<EmptyState>` with `variant="subtle"` when a list returns zero results after filtering. Use `variant="welcome"` for first-use panels (e.g., "No registration tokens yet — create one to enable invite codes").

---

## Synapse-Rust Feature Coverage

This section maps synapse-rust backend APIs to their frontend UI implementations, ensuring feature parity.

### Admin Dashboard (`/admin/dashboard`)

**Backend:** `GET /_synapse/admin/v1/server_version`, `/statistics`, `/health`
**Frontend:** `AdminDashboard.vue`

Displays server stats (user count, room count, DAU, MAU), health indicator, and version info in a card grid. Cards use `SkeletonBase` during loading. Stats refresh on mount and on manual "Refresh" button.

### User Management (`/admin/users`)

**Backend:** `AdminUserService` — full CRUD, password reset, admin toggle, deactivation, devices, sessions, rate-limit, shadow-ban, whois, login-as-user, batch create/deactivate, account info, login failures
**Frontend:** `AdminUsers.vue`

**Currently implemented:** Search, paginated list, create user dialog, detail modal (ID, display name, status, role, timestamps), admin toggle, batch deactivate.

**Design specifications for missing sub-features:**

#### Shadow-Ban Toggle

- Placement: User detail modal, in the "Status & Role" section
- Component: `<n-switch>` with label "Shadow Ban" and helper text "User can send messages but they are invisible to others"
- Confirmation: `<n-popconfirm>` before toggling — "This user's messages will become invisible to other users. Continue?"
- Visual: Banned users get a `<n-tag type="warning">` badge in the user list

#### Login-as-User

- Placement: User detail modal footer, secondary button "Login as User"
- Behavior: Creates a temporary access token for the target user, opens a new session window
- Confirmation: `<n-modal>` warning — "You will be logged in as {displayName}. Your current session will remain active. Administrative audit log will record this action."
- Visual: Button uses `secondary` type with a shield icon to indicate privileged action

#### User Sessions (Admin View)

- Placement: New tab in user detail modal: "Sessions"
- Component: Table of active sessions (device ID, last seen IP, last active time, user agent). Each row has an "Invalidate" button.
- Bulk action: "Logout All Sessions" button at the bottom of the tab

#### User Quota

- Placement: New tab in user detail modal: "Storage"
- Display: Storage used / limit progress bar (`<n-progress>`), upload count, file count
- Edit: `<n-input-number>` for custom quota limit (MB), "Apply" button
- Visual: Progress bar color changes at 80% (warning) and 95% (danger)

### Room Management (`/admin/rooms`)

**Backend:** `AdminRoomService` — CRUD, members, state, block/unblock, delete, forward-extremities, aliases, version, event context, search, stats
**Frontend:** `AdminRooms.vue`

**Design specifications for missing sub-features:**

#### Room Aliases

- Placement: Room detail modal, new tab "Aliases"
- Display: List of alias strings with copy button
- Visual: Each alias as a `<n-tag>` with monospace font, copy icon on hover

#### Room Version

- Placement: Room detail modal header, below room ID
- Display: `<n-tag size="small">` with version number (e.g., "v10")
- Visual: Versions below current show a warning tag with "Upgrade available" tooltip

#### Room Forward Extremities

- Placement: Room detail modal, "Diagnostics" tab
- Display: Count of forward extremities, list of event IDs
- Visual: Count > 10 shown with warning color (indicates potential sync issues)

### Media Management

**Backend:** `AdminMediaService` — list, delete, purge, quarantine, cache stats
**Frontend:** Currently only purge/cleanup in `AdminMaintenance.vue`

**Design specification for missing Media Browser:**

- Route: `/admin/media` (new route)
- Layout: Two-panel — left: search + filterable media list (thumbnail, filename, uploader, size, date), right: preview panel for selected media
- Preview panel: Image/video preview, metadata table (MXC URI, upload time, uploader, size, room), action buttons (Delete, Quarantine, Download)
- Bulk operations: Select multiple via checkboxes, "Delete Selected" and "Quarantine Selected" toolbar
- Empty state: `<EmptyState icon="mdi:image-outline" title="No media found" />`
- Mobile: Single-column list, tap to open detail sheet

### Moderation Panel (`/admin/moderation`)

**Backend:** `AdminModerationService` + `AdminReportService` — event reports, user reports, room reports, resolver, content filters
**Frontend:** `ModerationPanel.vue` exists but is **not connected to any route**

**Required action:** Add route `/admin/moderation` pointing to `ModerationPanel.vue`. Add sidebar navigation entry under "Security" section.

**Design specification:**

- Layout: Three-tab view — "Reports", "Content Filters", "User Reputation"
- Reports tab: Table with columns (reporter, reported entity, type, reason, timestamp, status). Status column as `<n-tag>`: pending (warning), resolved (success), dismissed (default). Click row to open detail drawer with full report content and action buttons (Resolve, Dismiss, Escalate).
- Content Filters tab: List of regex/glob patterns with toggle (active/inactive), "Add Filter" button. Each filter shows pattern, type, target (rooms/users), created date.
- User Reputation tab: Search by user ID, display reputation score (0-100), recent reports count, auto-moderation actions taken
- Confirmation: Resolving/dismissing a report requires a reason field (text area, minimum 10 characters)

### Server Quota Management

**Backend:** `AdminQuotaService` — server quota, user quota, upload limits, storage usage
**Frontend:** `useQuotaStore` exists but has **no admin UI**

**Design specification:**

- Route: Add quota section to `/admin/dashboard` as a card, or add `/admin/quota` as standalone view
- Dashboard card: Server storage used / total (progress bar), user count over quota, largest consumers (top 5 table)
- Standalone view: Two tabs — "Server Quota" (total storage, upload size limit, file size limit, edit form) and "User Quotas" (searchable user list with storage used, quota limit, over-quota status)
- Visual: Over-quota users highlighted with red background tint, progress bars with color thresholds

### External Services Management

**Backend:** `/_synapse/admin/v1/external_services/` — TrendRadar, OpenClaw, webhook bridges
**Frontend:** No UI exists

**Design specification:**

- Route: `/admin/external-services` or integrate into server config
- Layout: Card grid, one card per service type (TrendRadar, OpenClaw, Webhook). Each card shows: service name, status indicator (connected/disconnected), last sync time, quick actions (Configure, Test Connection, Enable/Disable toggle)
- Configuration modal: Service-specific form fields (API keys, endpoints, webhook URLs), "Test Connection" button with loading spinner and success/error feedback
- Status check: Auto-check on page load, manual "Refresh" button

### Notification Templates

**Backend:** `/_synapse/admin/v1/server_notifications/templates`
**Frontend:** No UI exists

**Design specification:**

- Placement: Add "Templates" tab to `AdminNotices.vue`
- Display: List of template cards showing template name, subject preview, body preview
- Edit: Click card to open edit modal with subject input, body textarea (supports Markdown with preview tab), variable insertion help
- Send: "Send with Template" button that opens the send notice dialog pre-filled with template content

### Feature Flags

**Backend:** `AdminSecurityService` — feature flag CRUD
**Frontend:** `FeatureFlagManager.vue` component, used in `AdminMaintenance.vue`

**Design specification:**

- Display: Card grid, each flag as a card with name, description, status badge (enabled/disabled), "Edit" and "Delete" buttons
- Create/Edit: Modal with flag name, description, enabled toggle, target (global/room/user), value (JSON for complex flags)
- Confirmation: Deleting a flag requires confirmation — "This may affect server behavior. Continue?"
- Visual: Enabled flags have green left border accent

### User Statistics & Data Usage

**Backend:** `getUserStats()`, `getUserStatsList()`, `getRoomStats()`, `getSingleRoomStats()`
**Frontend:** No dedicated UI

**Design specification:**

- Placement: New tab in Admin Dashboard: "Analytics"
- Components: Line chart (DAU/MAU over time), bar chart (messages per day), stat cards (total users, active rooms, messages sent)
- Filter: Date range picker (7d, 30d, 90d, custom)
- Room stats: Searchable room list with message count, member count, last activity columns
- Mobile: Simplified single-column view, charts replaced with stat cards and sparklines

---

## Route Architecture

### Desktop Routes (from `src/router/routes/desktop.ts`)

```
/admin                   → AdminLayout.vue (requiresAdmin meta)
  /dashboard             → AdminDashboard.vue
  /users                 → AdminUsers.vue
  /rooms                 → AdminRooms.vue
  /federation            → AdminFederation.vue
  /federation-monitor    → AdminFederationMonitor.vue
  /notices               → AdminNotices.vue
  /notifications         → AdminNotifications.vue
  /registration-tokens   → AdminRegistrationTokens.vue
  /security              → AdminSecurity.vue
  /audit                 → AdminAudit.vue
  /retention             → AdminRetention.vue
  /server-logs           → AdminServerLogs.vue
  /server-config         → AdminServerConfig.vue
  /guests                → AdminGuests.vue
  /spaces                → AdminSpaces.vue
  /app-services          → AdminAppServices.vue
  /saml                  → AdminSaml.vue
  /maintenance           → AdminMaintenance.vue
  /moderation            → ModerationPanel.vue (ROUTE MISSING — file exists, needs wiring)
  /media                 → TBD (needs creation)
  /quota                 → TBD (needs creation)
  /external-services     → TBD (needs creation)
```

### Admin Sidebar Navigation

The sidebar (`AdminLayout.vue`) must include all connected routes. Currently missing navigation entries for: audit, retention, server-logs, federation-monitor, SAML, security, maintenance, and the unwired moderation/media/quota/external-services routes.

**Design rule:** Every admin route must have a corresponding sidebar entry. Group entries semantically:

1. **Overview:** Dashboard
2. **User Management:** Users, Registration Tokens, Guests
3. **Room Management:** Rooms, Spaces
4. **Federation:** Federation, Federation Monitor
5. **Messaging:** Notices, Notifications
6. **Security:** Audit, Security, Moderation
7. **System:** Server Config, Server Logs, Maintenance, Retention, SAML, App Services, Media, Quota, External Services

---

## Component Patterns (Extended)

### Admin Data Table

```vue
<n-data-table
  :columns="columns"
  :data="items"
  :loading="loading"
  :pagination="pagination"
  :row-key="rowKey"
  remote
  @update:page="handlePageChange"
  @update:sorter="handleSort" />
```

- Always use `remote` for server-side pagination
- Set `row-key` to the entity's unique ID
- Show `<SkeletonList>` during initial load, `<n-empty>` when filtered results are empty
- Column widths: ID columns 180px, name columns flex, status columns 100px, actions columns 120px
- Actions column: Icon buttons with `<n-tooltip>`, max 4 visible actions, overflow into `<n-dropdown>`

### Detail Drawer

```vue
<n-drawer v-model:show="visible" :width="480" placement="right">
  <n-drawer-content :title="entityName" closable>
    <n-tabs type="line" animated>
      <n-tab-pane name="details" tab="Details">...</n-tab-pane>
      <n-tab-pane name="sub-entity" tab="Sub-Entities">...</n-tab-pane>
    </n-tabs>
  </n-drawer-content>
</n-drawer>
```

- Use tabs when entity details exceed one scroll height
- First tab: core properties and quick actions
- Subsequent tabs: related entities (members, messages, sessions, etc.)
- Drawer footer: primary action button + secondary buttons

### Stat Card Grid

```vue
<n-grid :cols="4" :x-gap="16" :y-gap="16" responsive="screen">
  <n-grid-item v-for="stat in stats" :key="stat.label">
    <n-card :bordered="false" size="small">
      <n-statistic :label="stat.label" :value="stat.value">
        <template #prefix>
          <n-icon :component="stat.icon" />
        </template>
      </n-statistic>
    </n-card>
  </n-grid-item>
</n-grid>
```

- 4 columns on desktop (≥1200px), 2 on tablet (768-1199px), 1 on mobile
- Each card: icon + value + label + optional trend indicator
- Loading: Replace values with `<SkeletonBase variant="text" width="60%" />`

### Confirmation Modal (Destructive Actions)

```vue
<n-modal v-model:show="confirmVisible" preset="dialog"
  title="Confirm Action"
  :positive-text="actionVerb"
  :negative-text="'Cancel'"
  @positive-click="executeAction">
  <p>{{ confirmationMessage }}</p>
  <n-input v-if="requiresReason"
    v-model:value="reason"
    type="textarea"
    :placeholder="'Reason for this action...'"
    :minlength="10" />
</n-modal>
```

- `actionVerb` must be explicit: "Deactivate User", "Delete Room", "Purge Media"
- Destructive actions always require either a reason field or a secondary confirmation checkbox
- Success feedback: `<n-message type="success">` with the complete action description
