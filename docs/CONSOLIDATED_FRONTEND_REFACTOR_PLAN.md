# CONSOLIDATED FRONTEND REFACTOR PLAN (HuLa)

> **Version:** v1.0.0
> **Date:** 2026-03-23
> **Status:** Active / Master Roadmap
> **Scope:** HuLa Frontend (Vue 3 + Tauri) & Local Matrix SDK (`matrix-js-sdk`)

This document serves as the **Single Source of Truth (SSOT)** for the HuLa frontend refactoring initiative. It consolidates previous analysis reports, architectural goals, and technical debt cleanup plans into a unified, actionable roadmap. All future frontend iterations **MUST** adhere to this document.

---

## 1. Technical Vision & Stack Lock-in

We aim to build a high-performance, maintainable, and type-safe Matrix-based IM client.

### 1.1 Core Technology Stack
| Layer | Technology | Version | Justification |
|-------|------------|---------|---------------|
| **Core Framework** | Vue 3 (Composition API) | `^3.5.x` | Reactive performance & ecosystem |
| **Desktop Runtime** | Tauri | `^2.9.x` | Native performance, low memory footprint |
| **Build Tool** | Vite | `^5.x` / `^7.x` | Fast HMR, optimized production builds |
| **Type System** | TypeScript | `^5.9.x` | Strict type checking (`noImplicitAny`) |
| **State Management** | Pinia | `^3.x` | Modular, Vue 3 native state |
| **Styling** | Tailwind CSS / SCSS | - | Utility-first styling & component isolation |
| **UI Library** | Naive UI (Desktop) / Vant (Mobile) | `^2.43` / `^4.9` | Specialized UX for different platforms |
| **Matrix SDK** | Local `matrix-js-sdk` | `v40+` | Custom backend extensions & SSSS support |

### 1.2 Testing & CI/CD
| Tool | Purpose | Standard / Target |
|------|---------|-------------------|
| **Vitest** | Unit & Service Testing | ≥ 80% Coverage (Services, Utils, Stores) |
| **Playwright** | E2E & Integration | Core flows (Login, Chat, Voice, AI) |
| **Storybook** | UI Component Docs | All Atomic & Business Components |
| **GitHub Actions** | CI/CD Pipeline | Automated lint, test, build & release |

---

## 2. Phased Roadmap & Milestones

The refactoring is divided into 5 progressive phases to ensure stability and continuous delivery.

### Phase 1: Preparation & Technical Debt Cleanup (Week 1)
**Milestone:** Zero TypeScript Errors & Clean Compilation
- **TypeScript Strictness:** Resolve the remaining TS errors (e.g., `contacts.ts`, `TrendRadarService.ts`, `sdk-check.ts`).
- **Dead Code Elimination:** Clean up `ImRequestUtils.ts` (140+ legacy functions), deprecate unused IM backend mocks.
- **SDK API Alignment:** Align `VoiceMessageManager` and `DirectMessageManager` signatures between frontend and SDK.
- **Data Migration:** Add schema versioning for Pinia store migration (LocalStorage versioning for state schema changes).
- **Error Handling:** Introduce a unified `Result<T, E>` model for API responses to replace scattered `try-catch`.
  - `Result<T, E>` pattern: `Ok(T)` for success, `Err(E)` for errors
  - Define error types: `NetworkError`, `MatrixError`, `AuthError`, `ValidationError`
  - Implement Matrix-specific error handling (exponential backoff for `M_LIMIT_EXCEEDED`)

### Phase 2: Architecture Upgrade (Week 2-3)
**Milestone:** Core Services Migrated to Matrix Standard
- **SOLID Principles Implementation:**
  - Single Responsibility: Each service handles one domain (Matrix, AI, Auth)
  - Dependency Injection: Use DI container for service instantiation
  - Interface Segregation: Define clear interfaces for MatrixService, AIProvider, etc.
- **Sliding Sync (MSC3886):** Replace legacy `/sync` with Sliding Sync to handle large accounts. Configure room list limit and timeline limit appropriately.
- **OIDC Integration:** Implement full-loop SSO login using the backend's OIDC service, including dynamic registration.
- **AI Provider Abstraction:** Standardize the AI service interface (`OpenClaw`, `TrendRadar`, `HuLa Backend`) into a pluggable architecture.
- **Store Refactoring:** Break down massive Pinia stores (e.g., `chat.ts` 37KB) into smaller modules (`messages`, `timeline`, `reactions`).

### Phase 3: Component Governance (Week 4-5)
**Milestone:** Standardized UI & Storybook Coverage
- **Component Layering:** 
  - *Atomic:* Buttons, Avatars, Inputs.
  - *Business:* RoomList, MessageBubble, FriendCard.
  - *Templates:* ChatLayout, SettingsLayout.
- **Storybook Integration:** Document all shared components. Ensure isolation from Pinia state via prop passing.
- **Widget API:** Implement `MatrixWidgetService` for iframe-based in-room mini-apps.

### Phase 4: Performance & Quality (Week 6)
**Milestone:** Meet Performance Baselines
- **Virtual Scrolling:** Implement virtual lists for Room List and Timeline to handle 10,000+ items without DOM lag.
- **Rate Limiting:** Implement backoff & retry mechanisms for `M_LIMIT_EXCEEDED` backend responses.
- **Lazy Loading:** Implement route-level code splitting and image lazy loading (`v-lazy`).
- **Performance Testing:**
  - Memory leak detection (monitor Vue component lifecycle, clear event listeners)
  - Stress testing (simulate 10k+ rooms, large timeline pagination)
  - Timeline scroll FPS monitoring (target: 60 FPS)
  - Sync latency benchmarking (initial sync < 1s with Sliding Sync)

### Phase 5: Go-live & Wrap-up (Week 7)
**Milestone:** Production Ready & Monitored
- **Canary Release:** Enable feature flags for new modules.
- **Telemetry:** Integrate OpenTelemetry/Sentry for frontend error tracking and Matrix sync latency monitoring.
- **Security Audit:**
  - Implement Content Security Policy (CSP) for Widget API to prevent XSS
  - Add security checklist: input sanitization, token storage encryption
  - Code review checklist for security-sensitive components (auth, OIDC)
- **Documentation:** Finalize `ARCHITECTURE.md`, `API_GUIDE.md`, and Developer Onboarding guides.

---

## 3. Standardized Conventions

### 3.1 Directory Structure
```text
src/
├── assets/         # Static files (images, fonts)
├── components/     # UI Components
│   ├── atomic/     # Dumb components (pure UI)
│   └── business/   # Smart components (connected to services)
├── hooks/          # Vue Composition API hooks (useXxx)
├── layouts/        # Page layouts (Desktop/Mobile)
├── router/         # Vue Router config
├── services/       # Core Business Logic (Framework agnostic)
│   ├── matrix/     # Matrix SDK wrappers (MatrixClientService, etc.)
│   └── ai/         # AI Providers
├── stores/         # Pinia state management (Segmented)
├── types/          # Global TypeScript definitions
├── utils/          # Pure utility functions
└── views/          # Route page components
```

### 3.2 Git Branching & Code Review
- **Strategy:** Trunk-based development with short-lived feature branches.
- **Branch Naming:** `feat/ticket-id-desc`, `fix/ticket-id-desc`, `refactor/target-module`.
- **Code Review:** 
  - Required 1 approval from a core maintainer.
  - PR must pass all CI checks (Type Check, Lint, Unit Tests).
  - UI changes must include screenshots or Storybook links.

---

## 4. Performance Baselines & Metrics

| Metric | Target | Monitoring Method |
|--------|--------|-------------------|
| **FCP (First Contentful Paint)** | ≤ 1.8 s | Lighthouse / Performance API |
| **LCP (Largest Contentful Paint)** | ≤ 2.5 s | Lighthouse / Performance API |
| **App Startup Time** | ≤ 2.0 s | Tauri lifecycle events |
| **Timeline Scroll FPS** | 60 FPS | Chrome DevTools |
| **Bundle Size** | Core < 1.2MB (with SDK ~400-600KB) | Rollup Plugin Visualizer |
| **Tree-shaking Rate** | ≥ 90% | Bundle analyzer |

---

## 5. Progressive Migration & Risk Mitigation

### 5.1 Migration Strategy
- **Dual-Track Parallel:** Retain legacy `ImRequestUtils` temporarily under a `@deprecated` flag while migrating components to `MatrixService` layer.
- **Feature Flags:** Wrap major architectural changes (e.g., Sliding Sync, OIDC) in runtime toggles.

### 5.2 Roles & Responsibilities Matrix
| Domain | Owner | Reviewer | Backup |
|--------|-------|----------|--------|
| **Matrix SDK & Sync** | Matrix Expert | Architect | Core Dev |
| **Vue Components** | UI/UX Dev | UI Lead | Core Dev |
| **State & Services** | Core Dev | Architect | Matrix Expert |
| **CI/CD & Tauri** | DevOps | Architect | Core Dev |

### 5.3 Rollback Plan
- Store compatibility versioning in LocalStorage. If a new state schema fails, fallback to the previous schema or wipe the local indexedDB cache and force an initial sync.
- Use Tauri's built-in updater for safe binary rollbacks if critical native crashes occur.

---

## 6. Development Tools & Scaffolding

To enforce these standards, use the refactoring CLI tool to generate new modules, components, and services:

```bash
pnpm create @hula/refactor
```

*This tool automatically generates the correct directory structure, Vue 3 `script setup` boilerplate, Vitest spec files, and Storybook stories.*
