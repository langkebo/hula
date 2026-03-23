# HuLa Frontend Refactor - Kanban Board Template

This document provides a template that can be directly imported into GitHub Projects or Jira to manage the refactoring process.

## 📌 Columns / Statuses

1. **Backlog** - Tasks planned for future phases.
2. **To Do (Current Phase)** - Tasks prioritized for the active sprint.
3. **In Progress** - Tasks currently being worked on.
4. **In Review** - PR submitted, waiting for Code Review.
5. **Testing** - QA/Automated testing phase.
6. **Done** - Merged and verified.

---

## 🎫 Epics & Tasks

### Epic 1: Phase 1 - Preparation & Tech Debt Cleanup
- **Task 1.1:** Resolve 7 remaining TS errors in `contacts.ts`, `TrendRadarService.ts`, and `sdk-check.ts`. [Priority: High]
- **Task 1.2:** Clean up `ImRequestUtils.ts` (Remove 140+ dead functions). [Priority: High]
- **Task 1.3:** Align `VoiceMessageManager` API signatures with `matrix-js-sdk`. [Priority: High]
- **Task 1.4:** Introduce unified `Result<T, E>` error handling wrapper. [Priority: Medium]

### Epic 2: Phase 2 - Architecture Upgrade
- **Task 2.1:** Implement `MatrixSlidingSyncService.ts` and initialize Sliding Sync. [Priority: High]
- **Task 2.2:** Refactor Room List and Chat Timeline to use Sliding Sync states. [Priority: High]
- **Task 2.3:** Implement OIDC SSO full-loop login flow via `matrix-js-sdk`. [Priority: Medium]
- **Task 2.4:** Standardize AI Provider Interface (`OpenClaw`, `TrendRadar`, `HuLa`). [Priority: Medium]
- **Task 2.5:** Break down `chat.ts` Pinia store into smaller modules (`messages`, `timeline`). [Priority: Low]

### Epic 3: Phase 3 - Component Governance
- **Task 3.1:** Setup Storybook configuration for Vue 3 + Tailwind/Naive UI. [Priority: Medium]
- **Task 3.2:** Migrate Atomic Components (Button, Avatar, Input) to Storybook. [Priority: Medium]
- **Task 3.3:** Migrate Business Components (MessageBubble, FriendCard) to Storybook. [Priority: Low]
- **Task 3.4:** Implement `MatrixWidgetService` for in-room iframe mini-apps. [Priority: Low]

### Epic 4: Phase 4 - Performance & Quality
- **Task 4.1:** Implement Virtual Scrolling (`vue-virtual-scroller`) for the Room List. [Priority: High]
- **Task 4.2:** Implement Virtual Scrolling for the Chat Timeline. [Priority: High]
- **Task 4.3:** Add global rate limit interceptor (`M_LIMIT_EXCEEDED` retry logic). [Priority: Medium]
- **Task 4.4:** Write Vitest unit tests for `MatrixClientService` and `MatrixRoomService` (Target: 80%). [Priority: High]
- **Task 4.5:** Write Playwright E2E test for the Login -> Chat -> Logout flow. [Priority: Medium]

### Epic 5: Phase 5 - Go-live & Wrap-up
- **Task 5.1:** Integrate OpenTelemetry/Sentry for frontend error tracking. [Priority: Medium]
- **Task 5.2:** Finalize Developer Onboarding docs (`ARCHITECTURE.md`, `API_GUIDE.md`). [Priority: Low]
- **Task 5.3:** Run Lighthouse / Performance audit to ensure FCP <= 1.8s. [Priority: High]
- **Task 5.4:** Remove Feature Flags and `@deprecated` legacy modules. [Priority: Medium]

---

## 📝 GitHub Pull Request Template

You can place this in `.github/pull_request_template.md`:

```markdown
## Description
<!-- Describe your changes in detail -->

## Related Issue
<!-- Link to the Kanban ticket (e.g., Fixes #123) -->

## Refactor Checklist
- [ ] TypeScript strict mode passes (`pnpm tsc --noEmit`)
- [ ] No `any` types used without explicit `@ts-expect-error` and justification
- [ ] Unit tests added/updated (Coverage >= 80% for modified files)
- [ ] UI changes include Storybook stories
- [ ] Performance tested (No bundle size regression)

## Screenshots (if applicable)
```
