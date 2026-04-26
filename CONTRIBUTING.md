# HuLa - Contributing Guide 🌟

We're thrilled that you want to contribute to HuLa! 😄

HuLa is an open-source project, and we welcome your collaboration. Before you jump in, let's make sure you're all set to contribute effectively and have loads of fun along the way!

## Fork the Repository

🍴 Fork this repository to your GitHub account by clicking the "Fork" button at the top right. This creates a personal copy of the project you can work on.

## Clone Your Fork

📦 Clone your forked repository to your local machine using the `git clone` command:

```bash
git clone https://gitee.com/llangkebo/hula/.git
```

## Create a New Branch

🌿 Create a new branch for your contribution. This helps keep your work organized and separate from the main codebase.

```bash
git checkout -b your-branch-name
```

Choose a meaningful branch name related to your work. It makes collaboration easier!

## Code Like a Wizard

🧙‍♀️ Time to work your magic! Write your code, fix bugs, or add new features. Be sure to follow our project's coding style. You can check if your code adheres to our style using:

```bash
pnpm run lint:staged
```

This adds a bit of enchantment to your coding experience! ✨

## Committing Your Work

📝 Ready to save your progress? Commit your changes to your branch.

```bash
pnpm run commit
```

This will commit all the files to git, Please keep your commits focused and clear. And remember to be kind to your fellow contributors; keep your commits concise.

## Sync with Upstream

⚙️ Periodically, sync your forked repository with the original (upstream) repository to stay up-to-date with the latest changes.

```bash
git remote add upstream https://gitee.com/llangkebo/hula/.git
git fetch upstream
git merge upstream/master
```

This ensures you're working on the most current version of HuLa. Stay fresh! 💨

## Open a Pull Request

🚀 Time to share your contribution! Head over to the original HuLa repository and open a Pull Request (PR). Our maintainers will review your work.

## Review and Collaboration

👓 Your PR will undergo thorough review and testing. The maintainers will provide feedback, and you can collaborate to make your contribution even better. We value teamwork!

## Celebrate 🎉

Congratulations! Your contribution is now part of HuLa. 🥳

Thank you for making HuLa even more magical. We can't wait to see what you create! 🌠

Happy Coding! 🚀

---

## Development Guide 🛠️

### Prerequisites

Before you start, make sure you have:

- **Node.js** v18+ (v20+ recommended)
- **pnpm** v10+
- **Rust** (latest stable)
- **Git**

### Setup Local Development

1. **Clone the repository** (including matrix-js-sdk):
```bash
git clone https://github.com/langkebo/HuLa.git
cd HuLa
```

2. **Install dependencies**:
```bash
pnpm install
```

3. **Setup matrix-js-sdk** (if not already linked):
```bash
cd ..
git clone https://github.com/langkebo/matrix-js-sdk.git
cd matrix-js-sdk
pnpm install
pnpm build
cd ../HuLa
```

4. **Configure environment**:
```bash
cp .env.example .env
# Edit .env to set VITE_HOMESERVER_URL if needed
```

5. **Start development server**:
```bash
pnpm tauri:dev  # Desktop
# or
pnpm adev:win   # Android (Windows)
```

### Testing

Run tests before submitting your PR:

```bash
# Run all tests
pnpm test:run

# Run with coverage
pnpm coverage

# Run E2E tests
pnpm test:e2e

# Type check
pnpm exec vue-tsc --noEmit

# Code quality check
pnpm check
```

### Code Style

We use Biome for code formatting and linting:

```bash
# Check code style
pnpm check

# Auto-fix issues
pnpm check:write
```

### Commit Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `style:` Code style changes (formatting, etc.)
- `refactor:` Code refactoring
- `test:` Adding or updating tests
- `chore:` Maintenance tasks

Example:
```bash
git commit -m "feat: add user profile editing"
git commit -m "fix: resolve message sync issue"
```

### Architecture Overview

HuLa uses a three-layer architecture:

```
┌─────────────────────────────────────┐
│   Frontend (Vue 3 + Tauri)          │
│   - Desktop: Naive UI               │
│   - Mobile: Vant                    │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│   SDK Layer (matrix-js-sdk)         │
│   - Matrix Client API               │
│   - Sliding Sync                    │
│   - Event handling                  │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│   Backend (synapse-rust)            │
│   - Matrix Homeserver               │
│   - Rust implementation             │
└─────────────────────────────────────┘
```

### Key Directories

- `src/services/matrix/` - Matrix service layer
- `src/composables/` - Shared Vue composables
- `src/stores/` - Pinia state management
- `src/components/` - Vue components
- `src/mobile/` - Mobile-specific code
- `src/workers/` - Web Workers
- `src-tauri/` - Rust backend code

### Need Help?

- 📖 Read the [full documentation](docs/project_guide.md)
- 💬 Join our [Discord](https://discord.gg/WhSkvhNEeE)
- 📧 Contact: cy2439646234 (WeChat)

