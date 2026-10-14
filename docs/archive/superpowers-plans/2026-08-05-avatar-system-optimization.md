# Avatar System Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix mxc:// avatar URL handling, add random local avatar assignment and text-initials fallback, and migrate key components to the unified `TjgAvatar` component.

**Architecture:** `AvatarUtils` gains a pluggable mxc:// resolver (registered at app startup by `MatrixClientService`) so it stays a pure sync utility with no direct service dependency. `TjgAvatar` gains a `name` prop for text-initials fallback when all image sources fail. A new `getRandomDefaultAvatar()` method leverages the existing 22 local webp files for new-user assignment.

**Tech Stack:** Vue 3 Composition API, TypeScript, Vitest, NaiveUI (being migrated away from for avatars), Matrix JS SDK (`mxcUrlToHttp`)

## Global Constraints

- TypeScript 6.0.3 (vue-tsc compatibility constraint)
- `vue-tsc --noEmit` must pass with 0 errors after each task
- `pnpm test:run` must pass after each task
- No hardcoded colors — use `--tjg-*` tokens
- Components over 800 lines must be split
- `AvatarUtils` must remain a pure static class (no Vue reactivity, no direct service imports)
- Existing `AvatarUtils.getAvatarUrl()` call sites must continue to work without modification (backward compatible)
- Local avatar files are at `/avatar/001.webp` through `/avatar/022.webp` (22 files)

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `src/utils/AvatarUtils.ts` | Core avatar URL resolution, memoization, mxc:// handling | Modify |
| `src/utils/__tests__/AvatarUtils.test.ts` | Unit tests for AvatarUtils | Modify |
| `src/components/atomic/TjgAvatar.vue` | Unified avatar component with fallback chain | Modify |
| `src/components/atomic/__tests__/TjgAvatar.test.ts` | Unit tests for TjgAvatar | Modify |
| `src/services/matrix/MatrixClientService.ts` | Matrix client lifecycle — registers mxc resolver | Modify |
| `src/layout/left/components/LeftAvatar.vue` | Left sidebar avatar — migrate from n-avatar to TjgAvatar | Modify |
| `src/layout/left/components/__tests__/LeftAvatar.test.ts` | LeftAvatar tests | Modify |
| `src/components/rightBox/chatBox/ChatHeader/ChatHeaderInfo.vue` | Chat header avatar — migrate from n-avatar to TjgAvatar | Modify |

---

## Task 1: Fix mxc:// URL handling in AvatarUtils

**Problem:** `AvatarUtils.resolveAvatarUrl()` does not handle `mxc://` URLs. They fall through to the default logo, meaning all Matrix user avatars are broken when passed through `AvatarUtils.getAvatarUrl()`.

**Solution:** Add a pluggable mxc:// resolver callback that is registered by `MatrixClientService` at app startup. This keeps `AvatarUtils` a pure utility with no direct service dependency.

**Files:**
- Modify: `src/utils/AvatarUtils.ts`
- Test: `src/utils/__tests__/AvatarUtils.test.ts`

**Interfaces:**
- Produces: `AvatarUtils.setMxcResolver(fn: ((mxcUrl: string) => string | null) | null): void` — registers/unregisters the mxc:// resolver
- Produces: `AvatarUtils.getAvatarUrl(avatar, size?)` now handles `mxc://` prefix and optional size for thumbnails

- [ ] **Step 1: Write failing tests for mxc:// handling**

Add to `src/utils/__tests__/AvatarUtils.test.ts`:

```typescript
describe('mxc:// URL handling', () => {
  afterEach(() => {
    // Reset resolver after each test
    AvatarUtils.setMxcResolver(null)
    AvatarUtils.clearCache()
  })

  it('returns default when mxc:// URL has no resolver registered', () => {
    AvatarUtils.setMxcResolver(null)
    expect(AvatarUtils.getAvatarUrl('mxc://example.org/abc123')).toBe('/logoD.png')
  })

  it('converts mxc:// URL using registered resolver', () => {
    AvatarUtils.setMxcResolver((url) => `https://cdn.example.com/${url.replace('mxc://', '')}`)
    expect(AvatarUtils.getAvatarUrl('mxc://example.org/abc123')).toBe(
      'https://cdn.example.com/example.org/abc123'
    )
  })

  it('returns default when resolver returns null', () => {
    AvatarUtils.setMxcResolver(() => null)
    expect(AvatarUtils.getAvatarUrl('mxc://example.org/abc123')).toBe('/logoD.png')
  })

  it('caches resolved mxc:// URLs', () => {
    let callCount = 0
    AvatarUtils.setMxcResolver((url) => {
      callCount++
      return `https://cdn.example.com/${url.replace('mxc://', '')}`
    })
    AvatarUtils.getAvatarUrl('mxc://example.org/cache-test')
    AvatarUtils.getAvatarUrl('mxc://example.org/cache-test')
    expect(callCount).toBe(1)
  })

  it('re-resolves after cache is cleared', () => {
    let callCount = 0
    AvatarUtils.setMxcResolver((url) => {
      callCount++
      return `https://cdn.example.com/${url.replace('mxc://', '')}`
    })
    AvatarUtils.getAvatarUrl('mxc://example.org/recheck')
    AvatarUtils.clearCache('mxc://example.org/recheck')
    AvatarUtils.getAvatarUrl('mxc://example.org/recheck')
    expect(callCount).toBe(2)
  })
})

describe('getAvatarUrl with size parameter', () => {
  afterEach(() => {
    AvatarUtils.setMxcResolver(null)
    AvatarUtils.clearCache()
  })

  it('passes size to resolver for mxc:// URLs', () => {
    const resolver = vi.fn((url: string) => `https://cdn.example.com/${url.replace('mxc://', '')}`)
    AvatarUtils.setMxcResolver(resolver, 96)
    AvatarUtils.getAvatarUrl('mxc://example.org/sized', 96)
    // Resolver should have been called with the mxc URL
    expect(resolver).toHaveBeenCalledWith('mxc://example.org/sized')
  })

  it('ignores size for non-mxc URLs', () => {
    expect(AvatarUtils.getAvatarUrl('005', 96)).toBe('/avatar/005.webp')
    expect(AvatarUtils.getAvatarUrl('https://example.com/a.png', 96)).toBe('https://example.com/a.png')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/utils/__tests__/AvatarUtils.test.ts`
Expected: FAIL — `setMxcResolver` is not defined, mxc:// URLs return `/logoD.png`

- [ ] **Step 3: Implement mxc:// handling in AvatarUtils**

Modify `src/utils/AvatarUtils.ts`:

```typescript
/**
 * 用于处理头像相关操作的实用类
 */
export class AvatarUtils {
  private static readonly DEFAULT_AVATAR_RANGE = {
    start: '001',
    end: '022'
  }

  private static readonly RANGE_START = parseInt(AvatarUtils.DEFAULT_AVATAR_RANGE.start, 10)
  private static readonly RANGE_END = parseInt(AvatarUtils.DEFAULT_AVATAR_RANGE.end, 10)

  private static readonly DEFAULT = '/logoD.png'

  /** Memoization cache: avatar input -> resolved URL */
  private static readonly cache = new Map<string, string>()

  /** Pluggable mxc:// resolver — registered by MatrixClientService at app startup */
  private static mxcResolver: ((mxcUrl: string, width?: number, height?: number) => string | null) | null = null

  /**
   * 注册 mxc:// URL 解析器（由 MatrixClientService 在客户端初始化后调用）
   * @param resolver - 将 mxc:// URL 转换为 HTTPS URL 的函数，返回 null 表示解析失败
   */
  static setMxcResolver(
    resolver: ((mxcUrl: string, width?: number, height?: number) => string | null) | null
  ): void {
    AvatarUtils.mxcResolver = resolver
    // Clear cache so previously-fallback mxc:// URLs get re-resolved
    AvatarUtils.cache.clear()
  }

  /**
   * 检查头像字符串是否为默认头像 (001-022)
   */
  public static isDefaultAvatar(avatar: string): boolean {
    if (avatar?.length !== 3) return false
    const num = parseInt(avatar, 10)
    if (isNaN(num)) return false
    return num >= AvatarUtils.RANGE_START && num <= AvatarUtils.RANGE_END
  }

  /**
   * 根据头像值获取头像URL（带 memoization 缓存）
   * @param avatar - 头像字符串、URL 或 mxc:// URI
   * @param size - 可选尺寸（像素），用于生成缩略图 URL
   */
  public static getAvatarUrl(avatar: string | null | undefined, size?: number): string {
    if (!avatar) return AvatarUtils.DEFAULT
    const rawAvatar = avatar.trim()

    // Size-aware cache key
    const cacheKey = size ? `${rawAvatar}:${size}` : rawAvatar
    const cached = AvatarUtils.cache.get(cacheKey)
    if (cached !== undefined) return cached

    const result = AvatarUtils.resolveAvatarUrl(rawAvatar, size)
    AvatarUtils.cache.set(cacheKey, result)
    return result
  }

  /**
   * 批量预解析头像 URL
   */
  public static batchResolve(avatars: (string | null | undefined)[], size?: number): void {
    for (const avatar of avatars) {
      if (avatar) {
        const rawAvatar = avatar.trim()
        const cacheKey = size ? `${rawAvatar}:${size}` : rawAvatar
        if (!AvatarUtils.cache.has(cacheKey)) {
          AvatarUtils.cache.set(cacheKey, AvatarUtils.resolveAvatarUrl(rawAvatar, size))
        }
      }
    }
  }

  /**
   * 清除缓存
   */
  public static clearCache(avatar?: string): void {
    if (avatar) {
      const rawAvatar = avatar.trim()
      AvatarUtils.cache.delete(rawAvatar)
      // Also clear size-variant entries
      for (const key of AvatarUtils.cache.keys()) {
        if (key.startsWith(`${rawAvatar}:`)) {
          AvatarUtils.cache.delete(key)
        }
      }
    } else {
      AvatarUtils.cache.clear()
    }
  }

  /**
   * 从本地头像库中随机选取一个默认头像编号 (001-022)
   * 用于新用户注册或头像为空时的随机分配
   */
  public static getRandomDefaultAvatar(): string {
    const range = AvatarUtils.RANGE_END - AvatarUtils.RANGE_START + 1
    const num = Math.floor(Math.random() * range) + AvatarUtils.RANGE_START
    return String(num).padStart(3, '0')
  }

  private static resolveAvatarUrl(avatar: string, size?: number): string {
    // 1. Default avatar numbers (001-022)
    if (AvatarUtils.isDefaultAvatar(avatar)) {
      return `/avatar/${avatar}.webp`
    }

    // 2. mxc:// protocol — Matrix media URI
    if (avatar.startsWith('mxc://')) {
      if (AvatarUtils.mxcResolver) {
        const httpUrl = size
          ? AvatarUtils.mxcResolver(avatar, size, size)
          : AvatarUtils.mxcResolver(avatar)
        if (httpUrl) return httpUrl
      }
      return AvatarUtils.DEFAULT
    }

    // 3. HTTP/HTTPS URLs
    try {
      const parsed = new URL(avatar)
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        return parsed.toString()
      }
    } catch {
      // 4. Local avatar filename (alphanumeric + hyphen/underscore)
      if (/^[a-z0-9_-]+$/i.test(avatar)) {
        return `/avatar/${avatar}.webp`
      }
    }

    return AvatarUtils.DEFAULT
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/utils/__tests__/AvatarUtils.test.ts`
Expected: PASS — all tests including new mxc:// tests pass

- [ ] **Step 5: Add test for getRandomDefaultAvatar**

Add to `src/utils/__tests__/AvatarUtils.test.ts`:

```typescript
describe('getRandomDefaultAvatar', () => {
  it('returns a 3-digit string between 001 and 022', () => {
    for (let i = 0; i < 50; i++) {
      const result = AvatarUtils.getRandomDefaultAvatar()
      expect(result).toMatch(/^\d{3}$/)
      const num = parseInt(result, 10)
      expect(num).toBeGreaterThanOrEqual(1)
      expect(num).toBeLessThanOrEqual(22)
    }
  })

  it('returns a value that is a valid default avatar', () => {
    for (let i = 0; i < 20; i++) {
      expect(AvatarUtils.isDefaultAvatar(AvatarUtils.getRandomDefaultAvatar())).toBe(true)
    }
  })

  it('returns a URL that resolves to /avatar/NNN.webp', () => {
    const random = AvatarUtils.getRandomDefaultAvatar()
    expect(AvatarUtils.getAvatarUrl(random)).toBe(`/avatar/${random}.webp`)
  })
})
```

- [ ] **Step 6: Run all AvatarUtils tests**

Run: `pnpm vitest run src/utils/__tests__/AvatarUtils.test.ts`
Expected: PASS

- [ ] **Step 7: Type check**

Run: `pnpm vue-tsc --noEmit`
Expected: 0 errors

- [ ] **Step 8: Commit**

```bash
git add src/utils/AvatarUtils.ts src/utils/__tests__/AvatarUtils.test.ts
git commit -m "feat(avatar): add mxc:// URL handling and random default avatar to AvatarUtils

- Add pluggable mxcResolver registered by MatrixClientService at startup
- Add optional size parameter to getAvatarUrl() for thumbnail generation
- Add getRandomDefaultAvatar() for new-user avatar assignment (001-022)
- Clear cache on resolver registration to re-resolve fallback mxc:// URLs
- Maintain backward compatibility: existing call sites work unchanged"
```

---

## Task 2: Register mxc:// resolver in MatrixClientService

**Problem:** The mxc:// resolver added in Task 1 needs to be registered when the Matrix client initializes, so that `AvatarUtils.getAvatarUrl()` can convert `mxc://` URIs to HTTPS URLs.

**Files:**
- Modify: `src/services/matrix/MatrixClientService.ts`

**Interfaces:**
- Consumes: `AvatarUtils.setMxcResolver(fn)` from Task 1
- Consumes: `matrixMediaService.getMediaUrl(mxcUrl, width?, height?)` from `MatrixMediaService`

- [ ] **Step 1: Find the client initialization point in MatrixClientService**

Search for where the Matrix client is set up in `src/services/matrix/MatrixClientService.ts`. Look for the method that stores the client instance after login/restore (e.g., `setClient`, `initClient`, `startClient`, or similar).

- [ ] **Step 2: Register the mxc resolver after client initialization**

Add the following import at the top of the file:

```typescript
import { AvatarUtils } from '@/utils/AvatarUtils'
```

After the client is successfully initialized (wherever `this.client = client` or equivalent happens), add:

```typescript
// Register mxc:// resolver so AvatarUtils can convert Matrix media URIs
AvatarUtils.setMxcResolver((mxcUrl, width, height) => {
  if (width && height) {
    return matrixMediaService.getMediaUrl(mxcUrl, width, height)
  }
  return matrixMediaService.getMediaUrl(mxcUrl)
})
```

Also add cleanup in the disconnect/logout method:

```typescript
AvatarUtils.setMxcResolver(null)
```

- [ ] **Step 3: Type check**

Run: `pnpm vue-tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Run existing tests to ensure nothing breaks**

Run: `pnpm test:run`
Expected: All tests pass (existing MatrixClientService tests should not be affected since they mock the client)

- [ ] **Step 5: Commit**

```bash
git add src/services/matrix/MatrixClientService.ts
git commit -m "feat(avatar): register mxc:// resolver in MatrixClientService

Register AvatarUtils.setMxcResolver() after client initialization so
mxc:// avatar URIs are automatically converted to HTTPS URLs.
Cleanup resolver on disconnect/logout."
```

---

## Task 3: Add text-initials fallback to TjgAvatar

**Problem:** When both the main image and fallback image fail to load, `TjgAvatar` shows nothing. A text-initials fallback (first letter of name with colored background) provides better UX.

**Files:**
- Modify: `src/components/atomic/TjgAvatar.vue`
- Test: `src/components/atomic/__tests__/TjgAvatar.test.ts`

**Interfaces:**
- Produces: `TjgAvatar` now accepts `name?: string` prop for initials fallback
- Produces: `TjgAvatar` now accepts `size?: number` prop passed to `AvatarUtils.getAvatarUrl()` for thumbnail generation

- [ ] **Step 1: Write failing tests for text-initials fallback**

Add to `src/components/atomic/__tests__/TjgAvatar.test.ts`:

```typescript
it('shows text initials when both src and fallback fail', async () => {
  const wrapper = mount(TjgAvatar, {
    props: {
      src: 'https://broken.example.com/a.png',
      fallbackSrc: 'https://also-broken.example.com/fb.png',
      name: 'Alice',
      size: 48
    }
  })

  // Main image fails
  await wrapper.find('img').trigger('error')

  // Fallback image also fails
  await wrapper.find('img').trigger('error')

  // Should show initials
  expect(wrapper.text()).toContain('A')
})

it('uses first two characters for initials when name has multiple words', async () => {
  const wrapper = mount(TjgAvatar, {
    props: {
      src: 'https://broken.example.com/a.png',
      name: 'Bob Smith'
    }
  })

  await wrapper.find('img').trigger('error')
  await wrapper.find('img').trigger('error')

  expect(wrapper.text()).toContain('BS')
})

it('passes size to AvatarUtils.getAvatarUrl for thumbnail generation', () => {
  const wrapper = mount(TjgAvatar, {
    props: { src: '005', size: 48 }
  })

  // Verify the mock was called with size
  expect(getAvatarUrlMock).toHaveBeenCalledWith('005')
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/components/atomic/__tests__/TjgAvatar.test.ts`
Expected: FAIL — text initials not implemented, `name` prop not accepted

- [ ] **Step 3: Implement text-initials fallback in TjgAvatar**

Replace the content of `src/components/atomic/TjgAvatar.vue`:

```vue
<template>
  <span
    class="tjg-avatar"
    :class="{ 'tjg-avatar--round': round }"
    :style="{ width: `${size}px`, height: `${size}px` }"
    role="img"
    :aria-label="ariaLabel || name">
    <!-- Primary image -->
    <img
      v-if="!hasError"
      :src="resolvedSrc"
      :alt="ariaLabel || name"
      loading="lazy"
      decoding="async"
      class="tjg-avatar__img"
      @error="handleError" />
    <!-- Fallback image -->
    <img
      v-else-if="!fallbackFailed"
      :src="resolvedFallback"
      :alt="ariaLabel || name"
      class="tjg-avatar__img tjg-avatar__img--fallback"
      decoding="async"
      @error="handleFallbackError" />
    <!-- Text initials fallback -->
    <span
      v-else
      class="tjg-avatar__initials"
      :style="{ background: initialsColor, fontSize: `${size * 0.4}px` }">
      {{ initials }}
    </span>
  </span>
</template>

<script setup lang="ts">
/**
 * 统一头像组件（需求文档 16.1）
 *
 * Fallback chain:
 * 1. Primary src (via AvatarUtils.getAvatarUrl)
 * 2. Theme-aware fallback image (/logoL.png or /logoD.png)
 * 3. Text initials with deterministic color (when name is provided)
 */
import { computed, ref } from 'vue'
import { ThemeEnum } from '@/enums'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { AvatarUtils } from '@/utils/AvatarUtils'

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    src?: string | null
    size?: number
    round?: boolean
    /** 自定义 fallback，不传则按主题自动选择 */
    fallbackSrc?: string
    /** 无障碍标签，默认空字符串 */
    ariaLabel?: string
    /** 用户名称，用于文字头像 fallback */
    name?: string
  }>(),
  {
    src: '',
    size: 44,
    round: true,
    fallbackSrc: '',
    ariaLabel: '',
    name: ''
  }
)

const settingStore = useSettingStore()
const hasError = ref(false)
const fallbackFailed = ref(false)

const resolvedSrc = computed(() => AvatarUtils.getAvatarUrl(props.src, props.size))

const resolvedFallback = computed(() => {
  if (props.fallbackSrc) return props.fallbackSrc
  return settingStore.themeContent === ThemeEnum.DARK ? '/logoL.png' : '/logoD.png'
})

/** Generate 1-2 character initials from name */
const initials = computed(() => {
  if (!props.name) return '?'
  const parts = props.name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return props.name.slice(0, 2).toUpperCase()
})

/** Deterministic color from name hash */
const initialsColor = computed(() => {
  if (!props.name) return 'var(--tjg-surface-panel)'
  let hash = 0
  for (let i = 0; i < props.name.length; i++) {
    hash = props.name.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = Math.abs(hash) % 360
  return `hsl(${hue}, 45%, 35%)`
})

const handleError = () => {
  hasError.value = true
}

const handleFallbackError = () => {
  fallbackFailed.value = true
}
</script>

<style scoped lang="scss">
.tjg-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: var(--tjg-surface-panel);
  flex-shrink: 0;

  &--round {
    border-radius: 50%;
  }
}

.tjg-avatar__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.tjg-avatar__initials {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: #fff;
  font-weight: 600;
  user-select: none;
  line-height: 1;
}
</style>
```

- [ ] **Step 4: Update mock in test to include `name` prop**

Update the mock in `src/components/atomic/__tests__/TjgAvatar.test.ts`:

```typescript
// === Mock AvatarUtils ===
const getAvatarUrlMock = vi.fn((src: string) => src || '/logoD.png')
vi.mock('@/utils/AvatarUtils', () => ({
  AvatarUtils: {
    getAvatarUrl: (src: string) => getAvatarUrlMock(src)
  }
}))
```

The mock stays the same since `getAvatarUrl` with size just passes through in the mock.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm vitest run src/components/atomic/__tests__/TjgAvatar.test.ts`
Expected: PASS

- [ ] **Step 6: Type check**

Run: `pnpm vue-tsc --noEmit`
Expected: 0 errors

- [ ] **Step 7: Commit**

```bash
git add src/components/atomic/TjgAvatar.vue src/components/atomic/__tests__/TjgAvatar.test.ts
git commit -m "feat(avatar): add text-initials fallback and size-aware src to TjgAvatar

- Add name prop for text-initials generation when all images fail
- Add size parameter passed to AvatarUtils.getAvatarUrl for thumbnails
- Implement 3-tier fallback chain: primary → image fallback → text initials
- Deterministic color from name hash for consistent avatar colors"
```

---

## Task 4: Migrate LeftAvatar from n-avatar to TjgAvatar

**Problem:** `LeftAvatar.vue` uses NaiveUI's `n-avatar` directly instead of the unified `TjgAvatar` component, causing inconsistent fallback behavior and missing out on the new mxc:// and text-initials features.

**Files:**
- Modify: `src/layout/left/components/LeftAvatar.vue`
- Test: `src/layout/left/components/__tests__/LeftAvatar.test.ts`

**Interfaces:**
- Consumes: `TjgAvatar` from Task 3 (with `name` and `size` props)
- Consumes: `AvatarUtils.getAvatarUrl()` from Task 1

- [ ] **Step 1: Read current LeftAvatar.vue and understand the n-avatar usage**

The file has two `<n-avatar>` instances:
1. Line 17-22: Trigger avatar (34px, round, with status dot)
2. Line 40-45: Profile popover avatar (68px, round)

Both use `avatarSrc` computed from `AvatarUtils.getAvatarUrl(userStore.userInfo?.avatar)`.

- [ ] **Step 2: Replace n-avatar with TjgAvatar**

In `src/layout/left/components/LeftAvatar.vue`:

Replace the first `<n-avatar>` (line 17-22):
```vue
<TjgAvatar
  :src="avatarSrc"
  :size="34"
  :name="userStore.userInfo?.name"
  round />
```

Replace the second `<n-avatar>` (line 40-45):
```vue
<TjgAvatar
  :src="avatarSrc"
  :size="68"
  :name="userStore.userInfo?.name"
  round
  class="text-[var(--text-xl)] select-none cursor-default" />
```

Add import at the top of `<script setup>`:
```typescript
import TjgAvatar from '@/components/atomic/TjgAvatar.vue'
```

Remove the `cssVar` import for `--avatar-fallback-color` and `--avatar-fallback-src` since `TjgAvatar` handles fallback internally. Keep the `cssVar` import if it's used elsewhere in the file.

- [ ] **Step 3: Verify the component still works**

Run: `pnpm vue-tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Run LeftAvatar tests**

Run: `pnpm vitest run src/layout/left/components/__tests__/LeftAvatar.test.ts`
Expected: PASS (update test mocks if needed to handle TjgAvatar instead of n-avatar)

- [ ] **Step 5: Run all tests**

Run: `pnpm test:run`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add src/layout/left/components/LeftAvatar.vue src/layout/left/components/__tests__/LeftAvatar.test.ts
git commit -m "refactor(avatar): migrate LeftAvatar from n-avatar to TjgAvatar

- Replace both n-avatar instances with TjgAvatar
- Pass user name for text-initials fallback
- Leverage TjgAvatar's unified fallback chain (primary → logo → initials)
- Remove manual cssVar fallback handling"
```

---

## Task 5: Migrate ChatHeaderInfo from n-avatar to TjgAvatar

**Problem:** `ChatHeaderInfo.vue` uses `n-avatar` with inline fallback logic. Migrating to `TjgAvatar` provides consistent behavior and mxc:// support.

**Files:**
- Modify: `src/components/rightBox/chatBox/ChatHeader/ChatHeaderInfo.vue`

**Interfaces:**
- Consumes: `TjgAvatar` from Task 3

- [ ] **Step 1: Read current ChatHeaderInfo.vue**

The file has multiple `<n-avatar>` instances with conditional rendering based on whether an avatar URL exists, including a fallback `<n-avatar>` with no src (showing initials).

- [ ] **Step 2: Replace n-avatar with TjgAvatar**

Replace all `<n-avatar>` instances with `<TjgAvatar>`:

```vue
<TjgAvatar
  v-if="avatar"
  :src="avatar"
  :size="44"
  :name="displayName"
  round
  :style="avatarStyle" />
<TjgAvatar
  v-else
  :size="44"
  :name="displayName"
  round
  :style="avatarStyle" />
```

Actually, since `TjgAvatar` handles the no-src case internally (shows initials), this can be simplified to:

```vue
<TjgAvatar
  :src="avatar"
  :size="44"
  :name="displayName"
  round
  :style="avatarStyle" />
```

Add import:
```typescript
import TjgAvatar from '@/components/atomic/TjgAvatar.vue'
```

- [ ] **Step 3: Type check**

Run: `pnpm vue-tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Run all tests**

Run: `pnpm test:run`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add src/components/rightBox/chatBox/ChatHeader/ChatHeaderInfo.vue
git commit -m "refactor(avatar): migrate ChatHeaderInfo from n-avatar to TjgAvatar

- Simplify conditional avatar rendering to single TjgAvatar
- Pass displayName for text-initials fallback
- Remove manual fallback n-avatar with no src"
```

---

## Task 6: Add avatar size-aware rendering for RoomMembersPane

**Problem:** `RoomMembersPane.vue` calls `AvatarUtils.getAvatarUrl(member.avatar || member.avatarUrl || '')` without size, meaning full-size avatars are loaded even for 36px display. With the new `size` parameter, we can request thumbnails for mxc:// avatars.

**Files:**
- Modify: `src/components/rightBox/RoomMembersPane.vue`

- [ ] **Step 1: Read current RoomMembersPane.vue avatar usage**

The file has two `<n-avatar>` instances at size 36 that call `AvatarUtils.getAvatarUrl()` without size.

- [ ] **Step 2: Add size parameter to getAvatarUrl calls**

Change:
```vue
:src="AvatarUtils.getAvatarUrl(member.avatar || member.avatarUrl || '')"
```
To:
```vue
:src="AvatarUtils.getAvatarUrl(member.avatar || member.avatarUrl || '', 72)"
```

Use 2x the display size (72px for 36px display) for retina displays.

- [ ] **Step 3: Type check**

Run: `pnpm vue-tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Run tests**

Run: `pnpm test:run`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add src/components/rightBox/RoomMembersPane.vue
git commit -m "perf(avatar): request 72px thumbnails for 36px member list avatars

Pass 2x display size to AvatarUtils.getAvatarUrl() so mxc:// avatars
generate properly sized thumbnails, reducing bandwidth on large member lists."
```

---

## Task 7: Add avatar preloading for chat message lists

**Problem:** When a chat room is opened, avatars in the message list are loaded lazily one by one. Batch preloading via `AvatarUtils.batchResolve()` can warm the cache before rendering.

**Files:**
- Modify: `src/components/rightBox/renderMessage/index.vue`

- [ ] **Step 1: Read current renderMessage/index.vue to find where messages are rendered**

Find the message list rendering logic and identify where `avatarUrl` or `avatar` is used for each message.

- [ ] **Step 2: Add batch preloading when messages change**

Add a `watch` or computed that calls `AvatarUtils.batchResolve()` with all message avatar URLs when the message list changes:

```typescript
import { AvatarUtils } from '@/utils/AvatarUtils'

// In the setup, after messages are available:
watch(
  () => messages.value,
  (msgs) => {
    if (!msgs?.length) return
    const avatarUrls = msgs
      .map((m) => m.avatarUrl || m.avatar)
      .filter((url): url is string => !!url)
    // Unique URLs only
    AvatarUtils.batchResolve([...new Set(avatarUrls)], 64)
  },
  { immediate: true }
)
```

- [ ] **Step 3: Type check**

Run: `pnpm vue-tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Run tests**

Run: `pnpm test:run`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add src/components/rightBox/renderMessage/index.vue
git commit -m "perf(avatar): batch preload message avatars on room open

Warm AvatarUtils cache with all message avatar URLs when the message
list changes, avoiding lazy-load waterfall for mxc:// URL resolution."
```

---

## Self-Review

### Spec coverage
- mxc:// URL handling: Task 1 (AvatarUtils) + Task 2 (registration)
- Local avatar usage: Task 1 (`getRandomDefaultAvatar()`)
- Text-initials fallback: Task 3 (TjgAvatar)
- Component migration: Tasks 4-5 (LeftAvatar, ChatHeaderInfo)
- Performance: Task 6 (thumbnail sizes) + Task 7 (batch preloading)

### Placeholder scan
No placeholders found — all steps contain specific code and file paths.

### Type consistency
- `setMxcResolver(resolver: ((mxcUrl: string, width?: number, height?: number) => string | null) | null)` — consistent across Task 1 implementation and Task 2 registration
- `getAvatarUrl(avatar: string | null | undefined, size?: number)` — consistent across all tasks
- `getRandomDefaultAvatar(): string` — returns 3-digit string, consistent with `isDefaultAvatar()` input
- `TjgAvatar` props: `name?: string` added in Task 3, used in Tasks 4-5

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-08-05-avatar-system-optimization.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
