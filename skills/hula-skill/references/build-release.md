# Build and Release Guide

## hula (Frontend)

### Common Commands

```bash
pnpm install          # Install dependencies
pnpm tauri:dev        # Desktop development
pnpm tauri:build      # Desktop build
pnpm check            # Lint/format check
pnpm check:write      # Auto-fix lint issues
pnpm format:vue       # Format Vue files
pnpm format:all       # Format all files
pnpm test:run         # Run tests
pnpm commit           # Commit helper
```

### Build Output

- Desktop: `src-tauri/target/release/`
- Mobile: `dist/`

## matrix-js-sdk (SDK)

### Common Commands

```bash
npm install           # Install dependencies
npm run build         # Build SDK
npm run test          # Run tests
npm run lint          # Lint check
npm run docs          # Generate docs
```

### Build Output

- `lib/` - Compiled JavaScript
- `lib/*.d.ts` - Type definitions

## synapse-rust (Backend)

### Common Commands

```bash
cargo build           # Debug build
cargo build --release # Release build
cargo test            # Run tests
cargo clippy          # Lint check
cargo fmt             # Format code
cargo run             # Run server
```

### Build Output

- `target/debug/synapse-rust` - Debug binary
- `target/release/synapse-rust` - Release binary

### Docker Build

```bash
docker build -t synapse-rust .
docker run -p 8008:28008 synapse-rust
```

## Release Checklist

### Pre-Release

- [ ] All tests pass
- [ ] No lint errors
- [ ] Version bumped
- [ ] Changelog updated
- [ ] Documentation updated

### hula Release

- [ ] `pnpm check` passes
- [ ] `pnpm test:run` passes
- [ ] `pnpm tauri:build` succeeds
- [ ] Test on target platforms

### matrix-js-sdk Release

- [ ] `npm run test` passes
- [ ] `npm run lint` passes
- [ ] `npm run build` succeeds
- [ ] Publish to npm

### synapse-rust Release

- [ ] `cargo test` passes
- [ ] `cargo clippy` passes
- [ ] `cargo build --release` succeeds
- [ ] Docker image builds
- [ ] Deploy to server

## Environment Variables

### hula

```env
VITE_HOMESERVER_URL=https://matrix.example.org
VITE_IDENTITY_SERVER_URL=https://vector.im
```

### synapse-rust

```env
DATABASE_URL=postgres://user:pass@localhost:5432/synapse
REDIS_URL=redis://localhost:6379
SERVER_NAME=example.org
```

## Notes

- Use the registry configured in `.npmrc`. Override locally only if needed.
- Avoid committing secrets; use `.env.local` for personal tokens.
- Run database migrations before deploying backend changes.
