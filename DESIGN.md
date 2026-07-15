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
