# Checklists

## Frontend Changes (hula)

- [ ] Confirm platform (desktop/mobile) and target window/view
- [ ] Reuse existing view/component patterns from nearby files
- [ ] Update routes in `src/router/index.ts` when adding a new view
- [ ] Add i18n keys under `locales/` when new user-facing strings appear
- [ ] Use UnoCSS utilities and shared tokens from `src/styles/scss/global/variable.scss`
- [ ] Follow naming conventions (PascalCase components, camelCase services)
- [ ] Use `storeToRefs` when destructuring Pinia state
- [ ] Wrap Matrix SDK calls through `src/services/matrix/` services
- [ ] Handle errors with user-friendly messages
- [ ] Test on both desktop and mobile platforms

### Frontend Service Changes

- [ ] Create service in `src/services/matrix/`
- [ ] Follow existing service pattern (private client, getClient() method)
- [ ] Export from `src/services/matrix/index.ts`
- [ ] Add TypeScript types for all parameters and return values
- [ ] Handle null client case with descriptive error

### Frontend Store Changes

- [ ] Use setup-style stores: `defineStore(StoresEnum.X, () => { ... })`
- [ ] Keep imperative logic inside store actions
- [ ] Enable persistence per-store with `persist: true` only when needed
- [ ] Export from `src/stores/index.ts`

## SDK Changes (matrix-js-sdk)

- [ ] Extend `BaseManager` for new managers
- [ ] Define event types and handler maps
- [ ] Implement `doStart()` and `doStop()` lifecycle methods
- [ ] Use `TypedEventEmitter` for events
- [ ] Follow existing manager patterns for HTTP requests
- [ ] Register manager in `MatrixClient` class
- [ ] Export from module index
- [ ] Write unit tests with Vitest

### SDK Manager Checklist

- [ ] Create `src/my_feature/types.ts` with interfaces and enums
- [ ] Create `src/my_feature/MyFeatureManager.ts` extending BaseManager
- [ ] Create `src/my_feature/index.ts` for exports
- [ ] Add manager to `MatrixClient` constructor
- [ ] Start/stop manager in client lifecycle
- [ ] Document public API with JSDoc

## Backend Changes (synapse-rust)

- [ ] Create storage layer in `src/storage/`
- [ ] Create service layer in `src/services/`
- [ ] Create route handler in `src/web/routes/`
- [ ] Register in `ServiceContainer` (`src/services/mod.rs`)
- [ ] Register routes in router (`src/web/routes/mod.rs`)
- [ ] Add database migration if needed
- [ ] Use `#[derive(Clone)]` for shared state
- [ ] Handle errors with `ApiError` enum
- [ ] Write tests with `#[tokio::test]`

### Backend Service Checklist

- [ ] Create storage struct with `Arc<PgPool>`
- [ ] Create service struct with storage + cache
- [ ] Implement async methods for CRUD operations
- [ ] Add to `ServiceContainer::new()`
- [ ] Export from `mod.rs`

### Backend Route Checklist

- [ ] Use `State<ServiceContainer>` for dependency injection
- [ ] Return `Result<Json<T>, ApiError>`
- [ ] Validate input parameters
- [ ] Add authentication middleware if needed

## Fullstack Changes

- [ ] Backend: Storage → Service → Routes
- [ ] SDK: Types → Manager → Client registration
- [ ] Frontend: Service wrapper → Store → UI
- [ ] Ensure type consistency across all three projects
- [ ] Test end-to-end flow
- [ ] Update API documentation

### Fullstack Feature Checklist

- [ ] Backend: Storage layer created
- [ ] Backend: Service layer created
- [ ] Backend: Routes registered
- [ ] Backend: Types exported
- [ ] SDK: Types defined
- [ ] SDK: Manager created
- [ ] SDK: Manager registered in client
- [ ] SDK: Tests written
- [ ] Frontend: Service wrapper created
- [ ] Frontend: Types aligned
- [ ] Frontend: Pinia store (if needed)
- [ ] Frontend: UI components
- [ ] Frontend: Routes added
- [ ] Frontend: i18n strings added
- [ ] Frontend: Tests written

## Build/Release Work

- [ ] Use the existing `pnpm` scripts for checks and builds
- [ ] Run `pnpm check` before committing
- [ ] Run `pnpm test:run` to verify tests pass
- [ ] Avoid touching `.rules` unless explicitly asked
- [ ] Do not commit secrets; use `.env.local`

## Code Quality

### TypeScript (hula + SDK)

- [ ] No `any` types (add comment if absolutely necessary)
- [ ] All functions have return type annotations
- [ ] All parameters have type annotations
- [ ] Use `interface` for object types
- [ ] Use `type` for unions/intersections

### Rust (synapse-rust)

- [ ] Use `Result<T, E>` for fallible operations
- [ ] Use `Option<T>` for nullable values
- [ ] Document public APIs with `///` comments
- [ ] Use `#[derive(Clone)]` for shared state
- [ ] Handle all error cases explicitly

## Security

- [ ] Never log or expose sensitive data (passwords, tokens)
- [ ] Use secure storage for tokens
- [ ] Validate all user input
- [ ] Use HTTPS/WSS for all connections
- [ ] Sanitize HTML content before rendering

## Performance

- [ ] Use `shallowRef` for large objects
- [ ] Use `computed` for derived state
- [ ] Use virtual scrolling for long lists
- [ ] Lazy load routes and heavy components
- [ ] Cache expensive computations

## Multi-Platform (hula)

- [ ] Test on desktop (Tauri)
- [ ] Test on mobile (Web)
- [ ] Use `usePlatform()` for platform detection
- [ ] Provide fallbacks for platform-specific features
- [ ] Document platform limitations
