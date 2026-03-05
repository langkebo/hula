---
name: hula-skill
description: "HuLa project skill for Matrix ecosystem: backend (synapse-rust), SDK (matrix-js-sdk), frontend (hula). Use when user mentions hula, HuLa, synapse-rust, matrix-js-sdk, or requests changes in these repositories. Ask which scope (frontend/sdk/backend/fullstack) to enable."
---

# HuLa Skill

## Overview

Enable consistent changes across the HuLa Matrix ecosystem with repo-specific conventions and resources.

**Three-Project Architecture:**

| Project | Path | Tech Stack | Purpose |
|---------|------|------------|---------|
| **synapse-rust** | `/synapse-rust` | Rust + Axum + SQLx + Redis | Matrix Homeserver |
| **matrix-js-sdk** | `/matrix-js-sdk` | TypeScript + Node.js | Matrix Client SDK |
| **hula** | `/hula` | Vue 3 + Tauri + Pinia | Cross-platform Client |

## Activation Gate

Ask which scope to enable:
- **frontend**: hula Vue 3 + Tauri application
- **sdk**: matrix-js-sdk TypeScript SDK
- **backend**: synapse-rust Rust Homeserver
- **fullstack**: Cross-project changes

Confirm platform (desktop/mobile for frontend), target area, and constraints before editing.

## Workflow

1. Identify scope and relevant project(s).
2. Locate similar code paths and follow existing patterns.
3. Apply changes using repo conventions and available templates.
4. Update related layers when needed.
5. Run checks/tests only when requested.

## Scope Routing

### Frontend (hula)

Read `references/frontend.md` and `references/overview.md`.
Use templates in `assets/templates/`:
- `view-desktop.vue` - Desktop views
- `view-mobile.vue` - Mobile views
- `pinia-store.ts` - Pinia stores

Key directories:
- `src/views/` - Desktop views
- `src/mobile/views/` - Mobile views
- `src/services/matrix/` - Matrix SDK wrappers
- `src/stores/` - Pinia state management

### SDK (matrix-js-sdk)

Read `references/sdk.md` and `references/overview.md`.
Follow BaseManager pattern for new managers.

Key directories:
- `src/common/BaseManager.ts` - Base class for managers
- `src/friend/` - Friend system
- `src/room/` - Room management
- `src/crypto/` - Encryption
- `src/webrtc/` - VoIP

### Backend (synapse-rust)

Read `references/backend.md` and `references/overview.md`.

Key directories:
- `src/auth/` - Authentication
- `src/e2ee/` - End-to-end encryption
- `src/services/` - Business services
- `src/storage/` - Database layer
- `src/web/routes/` - HTTP routes
- `src/federation/` - Federation protocol

### Fullstack

Read `references/fullstack.md` plus relevant scope references.
Trace data flow across all three projects.

## Scripts

- `scripts/hula_summary.py` - Quick repo context
- `scripts/hula_tauri_map.py` - Tauri commands mapping

## References

| File | Purpose |
|------|---------|
| `references/overview.md` | Stack, directories, aliases, global conventions |
| `references/frontend.md` | hula Vue 3 + Tauri guide |
| `references/sdk.md` | matrix-js-sdk TypeScript guide |
| `references/backend.md` | synapse-rust Rust guide |
| `references/fullstack.md` | Cross-project integration guide |
| `references/checklists.md` | Per-scope checklists |
| `references/build-release.md` | Build and release commands |
