# HuLa Ecosystem Overview

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         hula (Frontend)                          │
│                    Vue 3 + Tauri + Pinia                         │
│              Desktop (Naive UI) / Mobile (Vant)                  │
└───────────────────────────┬─────────────────────────────────────┘
                            │ Matrix Client-Server API
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    matrix-js-sdk (SDK)                           │
│                  TypeScript + Node.js                            │
│         Matrix Protocol Implementation + Managers                │
└───────────────────────────┬─────────────────────────────────────┘
                            │ Matrix Client-Server API
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                   synapse-rust (Backend)                         │
│                 Rust + Axum + SQLx + Redis                       │
│                    Matrix Homeserver                             │
└─────────────────────────────────────────────────────────────────┘
```

## Project Stacks

### synapse-rust (Backend)

| Technology | Version | Purpose |
|------------|---------|---------|
| Rust | 2021 Edition | Backend language |
| Axum | ^0.8 | Web framework |
| SQLx | ^0.8 | Database ORM (PostgreSQL) |
| Tokio | ^1.49 | Async runtime |
| Redis | ^0.27 | Cache layer |
| Argon2 | ^0.5 | Password hashing |
| AES-GCM / ChaCha20Poly1305 | ^0.10 | End-to-end encryption |

### matrix-js-sdk (SDK)

| Technology | Version | Purpose |
|------------|---------|---------|
| TypeScript | ^5.0 | SDK language |
| Node.js | >=22.0.0 | Runtime |
| Vitest | - | Unit testing |
| Babel | - | Transpilation |

### hula (Frontend)

| Technology | Version | Purpose |
|------------|---------|---------|
| Vue | ^3.5.0 | Frontend framework |
| TypeScript | ^5.8.0 | Type system |
| Vite | ^7.0.0 | Build tool |
| Tauri | ^2.9.0 | Cross-platform container |
| Pinia | ^3.0.0 | State management |
| matrix-js-sdk | ^37.0.0 | Matrix protocol SDK |
| Naive UI | - | Desktop components |
| Vant | - | Mobile components |
| UnoCSS | - | Atomic CSS |

## Directory Layout

### synapse-rust

```
synapse-rust/
├── src/
│   ├── auth/           # Authentication module
│   ├── cache/          # Cache layer (Redis)
│   ├── common/         # Common utilities
│   ├── e2ee/           # End-to-end encryption
│   │   ├── crypto/     # Cryptographic primitives
│   │   ├── olm/        # Olm protocol
│   │   ├── megolm/     # Megolm protocol
│   │   ├── cross_signing/  # Cross-signing
│   │   ├── backup/     # Key backup
│   │   └── ssss/       # Secret storage
│   ├── federation/     # Federation protocol
│   │   └── friend/     # Friend federation
│   ├── services/       # Business services
│   ├── storage/        # Database layer
│   ├── web/            # HTTP routes
│   │   └── routes/     # Route handlers
│   ├── worker/         # Worker management
│   └── tasks/          # Background tasks
└── Cargo.toml
```

### matrix-js-sdk

```
matrix-js-sdk/
├── src/
│   ├── common/
│   │   └── BaseManager.ts      # Base class for managers
│   ├── friend/                 # Friend system
│   ├── room/                   # Room management
│   ├── account/                # Account management
│   ├── auth/                   # Authentication
│   ├── crypto/                 # Encryption
│   ├── rust-crypto/            # Rust crypto backend
│   ├── webrtc/                 # VoIP/WebRTC
│   ├── matrixrtc/              # Matrix RTC
│   ├── media/                  # Media handling
│   ├── messaging/              # Messaging
│   ├── push/                   # Push notifications
│   ├── search/                 # Search
│   ├── space/                  # Spaces
│   ├── thread/                 # Threads
│   ├── timeline/               # Timeline
│   ├── user/                   # User management
│   ├── voice/                  # Voice messages
│   ├── moderation/             # Moderation
│   ├── notification/           # Notifications
│   ├── presence/               # Presence
│   ├── profile/                # Profile
│   ├── receipt/                # Read receipts
│   ├── retention/              # Retention
│   ├── quota/                  # Quota management
│   ├── dm/                     # Direct messages
│   ├── federation/             # Federation blacklist
│   ├── models/                 # Data models
│   ├── http-api/               # HTTP API layer
│   └── store/                  # Storage
└── package.json
```

### hula

```
hula/
├── src/                        # Frontend source
│   ├── views/                  # Desktop views
│   ├── mobile/views/           # Mobile views
│   ├── components/             # Shared components
│   ├── mobile/components/      # Mobile components
│   ├── layout/                 # Desktop layouts
│   ├── mobile/layout/          # Mobile layouts
│   ├── services/
│   │   ├── matrix/             # Matrix SDK wrappers
│   │   ├── offline/            # Offline support
│   │   └── openclaw/           # OpenClaw integration
│   ├── stores/                 # Pinia stores
│   ├── hooks/                  # Composables
│   ├── router/                 # Vue Router
│   ├── utils/                  # Utilities
│   ├── types/                  # TypeScript types
│   └── enums/                  # Enums
├── src-tauri/                  # Tauri backend (if used)
├── locales/                    # i18n translations
└── package.json
```

## Aliases (hula)

- `@/` → `src/`
- `#/` → `src/mobile/`
- `~/` → repo root

## Conventions

### General

- Use 2-space indent and LF line endings.
- Prefer TypeScript/Rust strict mode.
- Document public APIs with JSDoc/doc comments.
- Do not add secrets to tracked files; use `.env.local`.

### Frontend (hula)

- Use `<script setup>` and Composition API.
- Prefer UnoCSS utilities; use SCSS variables for tokens.
- Use `storeToRefs` when destructuring Pinia state.
- Follow project_rules.md for naming conventions.

### SDK (matrix-js-sdk)

- Extend `BaseManager` for new managers.
- Use TypedEventEmitter for events.
- Follow existing manager patterns.

### Backend (synapse-rust)

- Use `ServiceContainer` for dependency injection.
- Follow module structure: `storage` → `service` → `routes`.
- Use `#[derive(Clone)]` for shared state.

## Common Files

### hula

| File | Purpose |
|------|---------|
| `src/router/index.ts` | Route definitions |
| `src/services/matrix/index.ts` | Matrix service exports |
| `src/stores/matrix.ts` | Matrix state store |
| `src/enums/index.ts` | Enums including `TauriCommand` |

### matrix-js-sdk

| File | Purpose |
|------|---------|
| `src/client.ts` | Main MatrixClient class |
| `src/common/BaseManager.ts` | Manager base class |
| `src/index.ts` | Public exports |

### synapse-rust

| File | Purpose |
|------|---------|
| `src/lib.rs` | Module exports |
| `src/services/mod.rs` | ServiceContainer definition |
| `src/web/routes/mod.rs` | Route registration |
