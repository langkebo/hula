# UI 优化示例代码（生产级）

> 配套文档：`UI-OPTIMIZATION-PLAN.md`
> 目标代码基线：`src/styles/css/design-tokens.css` 为唯一 token 事实源；`src/utils/userIdentity.ts` 为身份解析事实源
> 所有示例均已按仓库强约束校验：禁止硬编码颜色、图标必须 SVG（线宽 1.5）、桌面 Naive UI / 移动 Vant 分实现、`prefers-reduced-motion` 兜底

## 0. 写代码前必须知道的 8 条硬约束

| # | 约束 | 违规后果 |
|:--|:--|:--|
| 1 | 颜色只允许 `var(--tjg-*)` 或 `color-mix(in srgb, var(--tjg-*) n%, transparent)` | `pnpm check:ratchet` 失败（基线 48，只减不增） |
| 2 | 图标必须是 `<svg>`，线宽 `stroke-width="1.5"` | `.rules` UI 规范违规 |
| 3 | 组件不得 import `matrix-js-sdk` 或直接 `fetch` | `pnpm check:sdk-boundary` / `pnpm quality:no-raw-fetch` 失败 |
| 4 | 新增 `src/services/**` 导出方法必须有 JSDoc 摘要 | `pnpm check:doc-coverage` 失败 |
| 5 | 单个 `.vue` 不得超过 800 行 | `.rules` 体量红线 |
| 6 | 桌面用 Naive UI、移动用 Vant，优先补 `src/mobile/` 独立实现 | 禁止新增 `isMobile()` 内联分支 |
| 7 | 动效必须有 `prefers-reduced-motion` 兜底 | `design-tokens.css:640` 已全局兜底，组件不要再自造动画时长 |
| 8 | MXID / 域名解析必须走 `src/utils/userIdentity.ts` | 禁止散落 `split(':')` |

---

## 1. 设计 Token 定义（第 1 步，其余示例都依赖它）

文件：`src/styles/css/design-tokens.css`

### 1.1 浅色主题（`:root` 内新增）

```css
/* ==================== 大圆角体系（产品要求 16dp 以上） ====================
 * 原 token 上限为 --tjg-radius-lg: 12px，无法满足规格，
 * 因此新增 xl/2xl/3xl 三档，并提供语义别名降低误用。
 * ================================================================== */
--tjg-radius-xl: 16px;
--tjg-radius-2xl: 20px;
--tjg-radius-3xl: 24px;

/* 语义别名：业务代码优先使用语义名 */
--tjg-radius-surface: var(--tjg-radius-xl);   /* 聊天气泡、卡片 */
--tjg-radius-panel: var(--tjg-radius-2xl);    /* 面板、侧栏、弹层 */
--tjg-radius-sheet: var(--tjg-radius-3xl);    /* 移动端底部抽屉 */

/* ==================== 液态玻璃 ====================
 * 性能约束（_liquid-glass.scss 既有约定）：
 * backdrop-filter 仅用于面板级（≤3 元素/视图），列表项与消息行禁止使用。
 * ================================================================== */
--tjg-glass-blur: 20px;
--tjg-glass-saturate: 180%;
--tjg-glass-panel-opacity: 72%;
--tjg-glass-nav-opacity: 85%;
--tjg-glass-bubble-opacity: 88%;
--tjg-glass-border: color-mix(in srgb, var(--tjg-border-layout-divider) 50%, transparent);
--tjg-glass-shadow: var(--tjg-shadow-sm);

/* ==================== 联邦身份 ==================== */
--tjg-federation-local-accent: var(--tjg-color-primary-500);
--tjg-federation-remote-accent: var(--tjg-color-info-500);
--tjg-federation-remote-bg: color-mix(in srgb, var(--tjg-color-info-500) 12%, transparent);
--tjg-federation-remote-border: color-mix(in srgb, var(--tjg-color-info-500) 28%, transparent);
--tjg-identity-mxid-color: var(--tjg-text-muted);

/* ==================== 加密信任（三色锁） ==================== */
--tjg-status-encryption-verified: var(--tjg-color-success-500);
--tjg-status-encryption-unverified: var(--tjg-text-muted);
--tjg-status-encryption-risk: var(--tjg-color-danger-500);
/* 红锁额外描边环：避免仅靠颜色传达风险 */
--tjg-status-encryption-risk-ring: color-mix(in srgb, var(--tjg-color-danger-500) 35%, transparent);

/* ==================== 同步状态 ==================== */
--tjg-sync-track-bg: var(--tjg-surface-input);
--tjg-sync-fill-bg: var(--tjg-color-primary-500);
--tjg-sync-indeterminate-bg: color-mix(in srgb, var(--tjg-color-primary-500) 45%, transparent);
--tjg-sync-offline-bg: var(--tjg-color-warning-100);
--tjg-sync-offline-text: var(--tjg-color-warning-600);
```

### 1.2 深色主题（`html[data-theme='dark']` 内新增）

```css
/* 深色下增强通透感：降低面板不透明度 */
--tjg-glass-panel-opacity: 55%;
--tjg-glass-nav-opacity: 70%;
--tjg-glass-bubble-opacity: 78%;

--tjg-federation-remote-bg: color-mix(in srgb, var(--tjg-color-info-500) 18%, transparent);
--tjg-federation-remote-border: color-mix(in srgb, var(--tjg-color-info-500) 34%, transparent);

--tjg-sync-offline-bg: var(--tjg-color-warning-100);
--tjg-sync-offline-text: var(--tjg-color-warning-500);
```

### 1.3 布局/断点 token（媒体查询内不可用 var，见 §1.4）

```css
:root {
  --breakpoint-sm: 640px;
  --breakpoint-md: 768px;
  --breakpoint-lg: 1024px;
  --breakpoint-xl: 1280px;
  --breakpoint-2xl: 1536px;
}
```

### 1.4 断点使用注意（易踩坑）

```scss
/* 错误：媒体查询条件中 var() 在部分浏览器不生效 */
@media (min-width: var(--breakpoint-md)) { /* ... */ }

/* 正确：媒体查询写字面值；token 只用于 JS 侧 matchMedia */
.my-component {
  padding: var(--tjg-space-4);

  @media (min-width: 768px) {
    padding: var(--tjg-space-6);
  }
}
```

---

## 2. 身份与联邦（阶段 2.1）

### 2.1 身份工具函数扩展

文件：`src/utils/userIdentity.ts`（在既有文件末尾追加，保持单一事实源）

```ts
/**
 * 判断两个 MXID 是否属于同一 homeserver。
 *
 * 联邦判定的唯一入口，避免各组件自行 `split(':')` 造成口径分裂。
 *
 * - 任一参数为空 → false（无法判定，按"非同一服务器"保守处理）
 * - `@a:matrix.test` 与 `@b:matrix.test` → true
 * - `@a:matrix.test` 与 `@b:other.test`  → false
 *
 * @param a 任意 MXID（用户 `@u:server` 或房间 `!id:server`）
 * @param b 任意 MXID
 */
export function sameHomeserver(a?: string | null, b?: string | null): boolean {
  const serverA = toServerName(a)
  const serverB = toServerName(b)
  return Boolean(serverA) && Boolean(serverB) && serverA === serverB
}

/**
 * 解析联邦对端信息，供 UI 展示 homeserver 标识。
 *
 * @param mxid 任意 MXID
 * @param localUserId 当前登录用户的 MXID（用于判定本地/远端）
 * @returns `remote` 为对端域名；`isFederated` 为 true 表示跨服务器
 */
export function resolveFederationPeer(
  mxid?: string | null,
  localUserId?: string | null
): { remote: string; isFederated: boolean } {
  const remote = toServerName(mxid)
  return {
    remote,
    isFederated: Boolean(remote) && !sameHomeserver(mxid, localUserId)
  }
}
```

**单测要点**（`src/utils/__tests__/userIdentity.test.ts`）：

```ts
it('同一服务器视为非联邦', () => {
  expect(sameHomeserver('@a:matrix.test', '@b:matrix.test')).toBe(true)
  expect(resolveFederationPeer('@a:matrix.test', '@me:matrix.test').isFederated).toBe(false)
})

it('跨服务器判定为联邦', () => {
  expect(resolveFederationPeer('@a:other.test', '@me:matrix.test')).toEqual({
    remote: 'other.test',
    isFederated: true
  })
})

it('空值保守处理', () => {
  expect(sameHomeserver('', '@me:matrix.test')).toBe(false)
  expect(resolveFederationPeer(null, '@me:matrix.test')).toEqual({ remote: '', isFederated: false })
})
```

### 2.2 `MxidText` —— 原子展示单元

文件：`src/components/atomic/MxidText.vue`

```vue
<template>
  <span class="mxid-text" :class="`mxid-text--${size}`" :title="mxid" dir="ltr">
    {{ display }}
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { toLocalpart } from '@/utils/userIdentity'

const props = withDefaults(
  defineProps<{
    /** 完整 MXID，例如 @alice:matrix.test；为空时回退占位符 */
    mxid?: string | null
    /** 占位文案（i18n 传入，组件不做国际化） */
    placeholder?: string
    /** 视觉规格 */
    size?: 'sm' | 'md'
  }>(),
  { mxid: '', placeholder: '--', size: 'sm' }
)

/** 展示值与 title 分离：展示截断由 CSS 负责，title 始终给全量值 */
const display = computed(() => {
  const raw = props.mxid?.trim()
  if (!raw) return props.placeholder
  return raw.startsWith('@') ? raw : `@${toLocalpart(raw)}`
})
</script>

<style scoped lang="scss">
.mxid-text {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--tjg-identity-mxid-color);
  font-family: var(--tjg-font-family-mono);
  font-variant-numeric: tabular-nums;

  &--sm {
    font-size: var(--tjg-font-size-2xs);
    line-height: var(--tjg-line-height-tight);
  }

  &--md {
    font-size: var(--tjg-font-size-sm);
    line-height: var(--tjg-line-height-normal);
  }
}
</style>
```

### 2.3 `FederationBadge` —— 远端服务器标识

文件：`src/components/atomic/FederationBadge.vue`

```vue
<template>
  <span
    v-if="isFederated"
    class="federation-badge"
    :aria-label="t('federation.badge.aria', { server: remote })"
    :title="t('federation.badge.tooltip', { server: remote })">
    <!-- 地球图标：表示跨 homeserver，线宽 1.5 符合规范 -->
    <svg
      class="federation-badge__icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a14 14 0 0 1 0 18" />
      <path d="M12 3a14 14 0 0 0 0 18" />
    </svg>
    <span class="federation-badge__server">{{ remote }}</span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { resolveFederationPeer } from '@/utils/userIdentity'

const props = defineProps<{
  /** 待判定的 MXID（用户或房间） */
  mxid?: string | null
  /** 当前登录用户 MXID，用于本地/远端对比 */
  localUserId?: string | null
}>()

const { t } = useI18n()
const peer = computed(() => resolveFederationPeer(props.mxid, props.localUserId))
const remote = computed(() => peer.value.remote)
const isFederated = computed(() => peer.value.isFederated)
</script>

<style scoped lang="scss">
.federation-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--tjg-space-1);
  max-width: 14ch;
  padding: 0 var(--tjg-space-2);
  border-radius: var(--tjg-radius-full);
  border: 1px solid var(--tjg-federation-remote-border);
  background: var(--tjg-federation-remote-bg);
  color: var(--tjg-federation-remote-accent);
  font-size: var(--tjg-font-size-2xs);
  line-height: var(--tjg-line-height-tight);
  white-space: nowrap;
}

.federation-badge__icon {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
}

.federation-badge__server {
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
```

> 说明：`FederationBadge` 只负责远端标识；本地用户不渲染任何徽标，避免列表每行都出现"本地"噪声。

### 2.4 组合示例：会话列表项身份区

文件：`src/components/common/UserIdentity.vue`（业务组合单元）

```vue
<template>
  <div class="user-identity">
    <TjgAvatar :src="avatar" :name="primaryName" :size="36" />
    <div class="user-identity__meta">
      <div class="user-identity__row">
        <span class="user-identity__name" :title="primaryName">{{ primaryName }}</span>
        <FederationBadge :mxid="mxid" :local-user-id="localUserId" />
      </div>
      <MxidText :mxid="mxid" size="sm" :placeholder="t('federation.mxid.unknown')" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import TjgAvatar from '@/components/atomic/TjgAvatar.vue'
import FederationBadge from '@/components/atomic/FederationBadge.vue'
import MxidText from '@/components/atomic/MxidText.vue'
import { toLocalpart } from '@/utils/userIdentity'

const props = defineProps<{
  mxid: string
  displayName?: string | null
  avatar?: string | null
  localUserId?: string | null
}>()

const { t } = useI18n()

/** 主标识回退顺序：displayname → localpart → 原始 MXID */
const primaryName = computed(() => props.displayName?.trim() || toLocalpart(props.mxid) || props.mxid)
</script>

<style scoped lang="scss">
.user-identity {
  display: flex;
  align-items: center;
  gap: var(--tjg-space-3);
  min-width: 0;
}

.user-identity__meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.user-identity__row {
  display: flex;
  align-items: center;
  gap: var(--tjg-space-2);
  min-width: 0;
}

.user-identity__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--tjg-text-primary);
  font-size: var(--tjg-font-size-base);
  font-weight: var(--tjg-font-weight-medium);
}

/* 窄容器下隐藏域名 chip，避免挤压主标识（容器查询，不依赖 JS 断点） */
.user-identity {
  container-type: inline-size;
}

@container (max-width: 220px) {
  .federation-badge {
    display: none;
  }
}
</style>
```

### 2.5 i18n 片段

文件：`locales/zh-CN/federation.json`（新建）

```json
{
  "badge": {
    "aria": "来自 {server} 服务器",
    "tooltip": "该帐号位于 {server}，与你的服务器不属于同一 homeserver"
  },
  "mxid": {
    "unknown": "MXID 未知"
  },
  "room": {
    "homeserver_label": "服务器 {server}",
    "federated_hint": "跨服务器房间：消息需经联邦链路送达"
  }
}
```

文件：`locales/en/federation.json`（新建）

```json
{
  "badge": {
    "aria": "From server {server}",
    "tooltip": "This account is hosted on {server}, a different homeserver than yours"
  },
  "mxid": {
    "unknown": "Unknown MXID"
  },
  "room": {
    "homeserver_label": "Server {server}",
    "federated_hint": "Federated room: messages travel across server links"
  }
}
```

---

## 3. 液态玻璃（阶段 2.2）

### 3.1 mixin 改造

文件：`src/styles/scss/mixins/_liquid-glass.scss`（替换原实现，保持 API 兼容）

```scss
/// 液态玻璃 mixin（token 化 + low-perf 降级）
///
/// @param {Number} $blur 覆盖模糊半径；缺省时读取 --tjg-glass-blur
/// @param {Number} $opacity 覆盖不透明度；缺省时读取 --tjg-glass-panel-opacity
/// @param {Number} $saturate 覆盖饱和度；缺省时读取 --tjg-glass-saturate
@mixin liquid-glass($blur: null, $opacity: null, $saturate: null) {
  $blur-value: if($blur, #{$blur}, var(--tjg-glass-blur));
  $opacity-value: if($opacity, #{$opacity * 100%}, var(--tjg-glass-panel-opacity));
  $saturate-value: if($saturate, #{$saturate * 100%}, var(--tjg-glass-saturate));

  background: color-mix(in srgb, var(--tjg-surface-panel) #{$opacity-value}, transparent);
  // sass 1.102+ 把 saturate() 解析为颜色函数，此处用插值规避
  backdrop-filter: blur(#{$blur-value}) #{'saturate(' + $saturate-value + ')'};
  -webkit-backdrop-filter: blur(#{$blur-value}) #{'saturate(' + $saturate-value + ')'};
  border: 1px solid var(--tjg-glass-border);
  box-shadow: var(--tjg-glass-shadow);
}

/// 气泡/列表项的"轻玻璃"：无 backdrop-filter，避免每条消息一层模糊
@mixin liquid-glass-subtle($opacity: null) {
  $opacity-value: if($opacity, #{$opacity * 100%}, var(--tjg-glass-bubble-opacity));
  background: color-mix(in srgb, var(--tjg-surface-panel) #{$opacity-value}, transparent);
  border: 1px solid var(--tjg-glass-border);
  box-shadow: var(--tjg-glass-shadow);
}

/// 性能降级：由 src/utils/performanceTier.ts 在启动时给 <html> 打 .low-perf
@mixin liquid-glass-fallback {
  :global(html.low-perf) & {
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
    background: var(--tjg-surface-panel);
    box-shadow: none;
  }
}
```

### 3.2 性能分级（补齐 `html.low-perf` 从未被写入的缺口）

文件：`src/utils/performanceTier.ts`（新建）

```ts
/**
 * 视觉性能分级
 *
 * 目的：为液态玻璃（backdrop-filter）提供可预测的降级开关。
 * 原有 _liquid-glass.scss 已引用 `html.low-perf`，但全仓无任何代码写入该类，
 * 本模块负责补齐这一环，并作为 GPU 重特效的唯一判定入口。
 */

export type PerformanceTier = 'low' | 'high'

/** 低于该核心数视为低性能设备 */
const LOW_CORE_THRESHOLD = 4

/** 触屏设备默认低性能：移动端 GPU 模糊代价高 */
function isCoarsePointer(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches
}

/** 用户显式要求减少透明度（部分系统提供该偏好） */
function prefersReducedTransparency(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-transparency: reduce)').matches
  )
}

/**
 * 计算当前设备视觉性能分级。纯函数，便于单测注入。
 *
 * @param input 可注入的探测结果，缺省时读取真实环境
 */
export function resolvePerformanceTier(input?: {
  hardwareConcurrency?: number
  deviceMemory?: number
  coarsePointer?: boolean
  reducedTransparency?: boolean
}): PerformanceTier {
  const cores = input?.hardwareConcurrency ?? navigator.hardwareConcurrency ?? 8
  const memory = input?.deviceMemory ?? (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8
  const coarse = input?.coarsePointer ?? isCoarsePointer()
  const reduced = input?.reducedTransparency ?? prefersReducedTransparency()

  if (reduced) return 'low'
  if (cores < LOW_CORE_THRESHOLD) return 'low'
  if (memory < LOW_CORE_THRESHOLD) return 'low'
  if (coarse) return 'low'
  return 'high'
}

/**
 * 将分级结果写入 <html> class，供 CSS 消费。
 *
 * @param tier 目标分级；缺省时自动探测
 */
export function applyPerformanceTier(tier: PerformanceTier = resolvePerformanceTier()): PerformanceTier {
  document.documentElement.classList.toggle('low-perf', tier === 'low')
  return tier
}
```

文件：`src/main.ts`（在 `initializePlatform()` 之后尽早调用）

```ts
import { applyPerformanceTier } from '@/utils/performanceTier'

// 视觉降级必须在首帧前完成，避免先渲染模糊再降级的闪烁
applyPerformanceTier()
```

**单测要点**（`src/utils/__tests__/performanceTier.test.ts`）：

```ts
it('核心数不足时降级', () => {
  expect(resolvePerformanceTier({ hardwareConcurrency: 2, deviceMemory: 8, coarsePointer: false })).toBe('low')
})

it('触屏设备降级', () => {
  expect(resolvePerformanceTier({ hardwareConcurrency: 8, deviceMemory: 8, coarsePointer: true })).toBe('low')
})

it('用户要求减少透明度时降级', () => {
  expect(resolvePerformanceTier({ reducedTransparency: true })).toBe('low')
})

it('高性能桌面保持模糊', () => {
  expect(resolvePerformanceTier({ hardwareConcurrency: 8, deviceMemory: 16, coarsePointer: false })).toBe('high')
})
```

### 3.3 导航栏接入

文件：`src/mobile/layout/tabBar/index.vue`（把硬编码 `blur(12px)` 换成 token 化 mixin）

```scss
@use '@/styles/scss/mixins/liquid-glass' as *;

.tab-bar {
  // 原实现：backdrop-filter: blur(12px);（硬编码，无降级）
  @include liquid-glass;
  @include liquid-glass-fallback;

  border-radius: var(--tjg-radius-panel) var(--tjg-radius-panel) 0 0;
  border-left: none;
  border-right: none;
  border-bottom: none;
}
```

### 3.4 聊天气泡「轻玻璃」取舍（必须与产品确认）

```scss
@use '@/styles/scss/mixins/liquid-glass' as *;

.message-bubble--received {
  // 不使用 backdrop-filter：
  // 时间线可同时存在数千条消息，每条一层 GPU 模糊会造成滚动掉帧，
  // 且与仓库既有约定（列表项/消息行禁止 backdrop-filter）冲突。
  // 改用半透明 + 微描边 + 微阴影达到一致的"玻璃观感"。
  @include liquid-glass-subtle;
  border-radius: var(--tjg-radius-surface);
}

.message-bubble--sent {
  border-radius: var(--tjg-radius-surface);
  background: var(--tjg-bubble-sent-bg);
  box-shadow: var(--tjg-shadow-sm);
}
```

**决策记录（写入 PR 描述或 ADR）：** 若产品坚持气泡真模糊，需限定「仅最后 20 条 + 仅 `perf-high`」，并单独做帧率基准测试后再合入。

---

## 4. 加密信任可视化（阶段 3.1）

### 4.1 信任级别 → 锁态映射（唯一入口）

文件：`src/services/matrix/crypto/cryptoTrustAdapter.ts`（新建，加 JSDoc 以满足 doc-coverage）

```ts
import type { TrustLevel } from '@/types/matrix-extensions'

/** 消息级锁态：green / gray / red 三态 */
export type MessageLockState = 'verified' | 'unverified' | 'risk'

/**
 * 将后端 `TrustLevel` 映射为消息锁态。
 *
 * 单一事实源：组件不得自行判断锁态颜色，避免三处实现漂移。
 *
 * - `verified`  → 已验证（安全）
 * - `unverified`→ 加密但未完全验证
 * - `blocked`   → 存在安全风险
 *
 * @param level 后端返回的设备信任级别
 * @returns 消息级锁态
 */
export function mapTrustLevelToLockState(level: TrustLevel): MessageLockState {
  if (level === 'verified') return 'verified'
  if (level === 'blocked') return 'risk'
  return 'unverified'
}

/**
 * 解密失败（本机无法解读该事件）统一按风险呈现。
 *
 * @returns 固定返回 `risk`，用于表达式统一
 */
export function decryptionFailureToLockState(): MessageLockState {
  return 'risk'
}
```

### 4.2 `useMessageTrust` —— 批量 + 缓存，禁止逐消息请求

文件：`src/composables/encryption/useMessageTrust.ts`（新建）

```ts
import { type Ref, ref } from 'vue'
import { mapTrustLevelToLockState, type MessageLockState } from '@/services/matrix/crypto/cryptoTrustAdapter'
import { cryptoSDKAdapter } from '@/services/matrix/crypto/CryptoSDKAdapter'
import { matrixClientService } from '@/services/matrix/MatrixClientService'
import type { TrustLevel } from '@/types/matrix-extensions'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('useMessageTrust')

/** 房间加密状态缓存：房间级查询只需一次 */
const roomEncryptedCache = new Map<string, boolean>()

/** (userId|deviceId) → TrustLevel 缓存，避免时间线逐条查询 */
const deviceTrustCache = new Map<string, TrustLevel>()

/** 缓存键：user 与 device 组合 */
function cacheKey(userId: string, deviceId: string): string {
  return `${userId}|${deviceId}`
}

/**
 * 信任级别取数实现（可注入，便于接入 useDeviceTrust 或单测替换）。
 *
 * 默认实现退回 `cryptoSDKAdapter.getDeviceVerificationStatus`：
 * 只有 `verified && crossSigningVerified` 才算已验证，`tofu`（首次见到）视为未验证。
 */
let trustLevelResolver: (userId: string, deviceId: string) => Promise<TrustLevel> = async (userId, deviceId) => {
  const status = await cryptoSDKAdapter.getDeviceVerificationStatus(userId, deviceId)
  if (status.verified && status.crossSigningVerified) return 'verified'
  return 'unverified'
}

/**
 * 覆盖信任级别取数实现（供 `useDeviceTrust` 接入或单测注入）。
 *
 * @param resolver 返回后端 `TrustLevel` 的取数函数
 */
export function setTrustLevelResolver(resolver: (userId: string, deviceId: string) => Promise<TrustLevel>): void {
  trustLevelResolver = resolver
}

export interface UseMessageTrustResult {
  /** 房间是否加密（异步解析，未就绪时为 null） */
  roomEncrypted: Ref<boolean | null>
  /** 解析指定发送者的锁态 */
  resolveLockState: (userId: string, deviceId?: string | null) => Promise<MessageLockState>
  /** 清空缓存（登出或密钥变更时调用） */
  clearCache: () => void
}

/**
 * 消息级加密信任查询。
 *
 * 性能约定：
 * - 房间加密状态按 roomId 缓存
 * - 设备信任级别按 (userId, deviceId) 缓存
 * - 组件必须在挂载时解析一次并把结果写入本地 ref，禁止在渲染函数中 await
 */
export function useMessageTrust(roomId: Ref<string | null>): UseMessageTrustResult {
  const roomEncrypted = ref<boolean | null>(null)

  async function ensureRoomEncrypted(): Promise<boolean> {
    const id = roomId.value
    if (!id) return false
    const cached = roomEncryptedCache.get(id)
    if (cached !== undefined) {
      roomEncrypted.value = cached
      return cached
    }
    try {
      const encrypted = await cryptoSDKAdapter.isRoomEncrypted(id)
      roomEncryptedCache.set(id, encrypted)
      roomEncrypted.value = encrypted
      return encrypted
    } catch (error) {
      logger.warn('读取房间加密状态失败:', error)
      roomEncrypted.value = false
      return false
    }
  }

  async function resolveLockState(userId: string, deviceId?: string | null): Promise<MessageLockState> {
    if (!(await ensureRoomEncrypted())) {
      // 明文房间不展示锁，调用方应按 roomEncrypted 决定是否渲染
      return 'unverified'
    }
    if (!deviceId) return 'unverified'

    const key = cacheKey(userId, deviceId)
    const cached = deviceTrustCache.get(key)
    if (cached) return mapTrustLevelToLockState(cached)

    try {
      // 唯一取数入口：返回后端 TrustLevel（verified / unverified / blocked）
      const level = await trustLevelResolver(userId, deviceId)
      deviceTrustCache.set(key, level)
      return mapTrustLevelToLockState(level)
    } catch (error) {
      logger.warn('读取设备信任级别失败:', error)
      return 'unverified'
    }
  }

  function clearCache(): void {
    roomEncryptedCache.clear()
    deviceTrustCache.clear()
    roomEncrypted.value = null
  }

  return { roomEncrypted, resolveLockState, clearCache }
}
```

> 实现提示：默认 `trustLevelResolver` 已内置 `getDeviceVerificationStatus` 回退（`verified && crossSigningVerified` 才算已验证，`tofu` 视为未验证）。若项目已接入后端 `trust_level`，在应用启动时调用 `setTrustLevelResolver(useDeviceTrust().getDeviceTrustLevel)` 覆盖即可，缓存与锁态映射无需改动。

### 4.3 `MessageLockBadge` —— 纯展示

文件：`src/components/atomic/MessageLockBadge.vue`（新建）

```vue
<template>
  <button
    type="button"
    class="message-lock"
    :class="`message-lock--${state}`"
    :aria-label="ariaLabel"
    :title="ariaLabel"
    @click.stop="$emit('verify')">
    <!-- verified: 闭合锁 -->
    <svg
      v-if="state === 'verified'"
      class="message-lock__icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true">
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      <path d="M9.5 16.5l1.8 1.8 3.2-3.6" />
    </svg>

    <!-- unverified: 开口锁（形状区分，非仅颜色） -->
    <svg
      v-else-if="state === 'unverified'"
      class="message-lock__icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true">
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 9.9-1" />
    </svg>

    <!-- risk: 锁 + 感叹号 + 外环 -->
    <svg
      v-else
      class="message-lock__icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true">
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      <path d="M12 14v3" />
      <path d="M12 19.5h.01" />
    </svg>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { MessageLockState } from '@/services/matrix/crypto/cryptoTrustAdapter'

const props = defineProps<{ state: MessageLockState }>()
defineEmits<{ verify: [] }>()

const { t } = useI18n()

/** 无障碍：三态必须有可读文案，不能只靠颜色 */
const ariaLabel = computed(() => t(`encryption.message_lock.${props.state}`))
</script>

<style scoped lang="scss">
.message-lock {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: var(--tjg-radius-xs);
  transition: color var(--tjg-motion-duration-fast) var(--tjg-motion-ease-standard);

  &__icon {
    width: 14px;
    height: 14px;
  }

  &--verified {
    color: var(--tjg-status-encryption-verified);
  }

  &--unverified {
    color: var(--tjg-status-encryption-unverified);
  }

  &--risk {
    color: var(--tjg-status-encryption-risk);
    // 外环强化"风险"语义，避免仅靠颜色
    box-shadow: 0 0 0 2px var(--tjg-status-encryption-risk-ring);
  }

  &:focus-visible {
    outline: 2px solid var(--tjg-color-primary-500);
    outline-offset: 1px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .message-lock {
    transition: none;
  }
}
</style>
```

### 4.4 接进消息头部

```vue
<!-- src/components/rightBox/renderMessage/... 消息头部 -->
<MessageLockBadge
  v-if="roomEncrypted"
  :state="lockState"
  @verify="onVerifySender" />
```

```vue
<!-- 挂在消息视图根节点；锁图标点击后打开既有验证弹窗 -->
<DeviceVerifyDialog
  v-model:show="verifyVisible"
  :device-id="verifyTarget.deviceId"
  :device-name="verifyTarget.deviceName"
  @success="onVerifySuccess" />
```

```ts
import { ref, watch } from 'vue'
import DeviceVerifyDialog from '@/components/encryption/DeviceVerifyDialog.vue'
import MessageLockBadge from '@/components/atomic/MessageLockBadge.vue'
import { useMessageTrust } from '@/composables/encryption/useMessageTrust'
import type { MessageLockState } from '@/services/matrix/crypto/cryptoTrustAdapter'

const { roomEncrypted, resolveLockState } = useMessageTrust(roomId)
const lockState = ref<MessageLockState>('unverified')

// 解析结果写入 ref，禁止在模板里 await
watch(
  () => [props.senderId, props.senderDeviceId] as const,
  async ([senderId, deviceId]) => {
    lockState.value = await resolveLockState(senderId, deviceId)
  },
  { immediate: true }
)

// 复用既有 DeviceVerifyDialog，不新增验证流程实现
const verifyVisible = ref(false)
const verifyTarget = ref<{ deviceId?: string; deviceName?: string }>({})

/**
 * 点击锁 → 打开设备验证弹窗。
 *
 * 说明：DeviceVerifyDialog 的 props 为 { show, deviceId, deviceName, inboundRequest, initialMode }，
 * 目标用户由当前会话上下文推断；不存在 `useDeviceVerifyDialog().open()` 这类公开 API。
 */
function onVerifySender(): void {
  verifyTarget.value = { deviceId: props.senderDeviceId, deviceName: props.senderName }
  verifyVisible.value = true
}

/** 验证成功后刷新该发送者的锁态（缓存已在 useMessageTrust 内维护） */
async function onVerifySuccess(): Promise<void> {
  lockState.value = await resolveLockState(props.senderId, props.senderDeviceId)
}
```

### 4.5 i18n 片段

文件：`locales/zh-CN/encryption.json`（在既有文件中新增节点）

```json
{
  "message_lock": {
    "verified": "此消息来自已验证设备，已端到端加密",
    "unverified": "此消息已加密，但发送设备尚未完成验证，点击开始验证",
    "risk": "此消息存在安全风险：发送设备被标记为不可信或无法解密，点击排查"
  },
  "trust_notice": {
    "private_key_local": "恢复密钥与私钥仅保存在你的设备上",
    "server_cannot_read": "服务器无法读取你的明文消息，也无法恢复你的私钥"
  },
  "recovery": {
    "phrase_title": "记录你的安全短语（助记词）",
    "phrase_confirm": "我已抄写并妥善保管，且知晓丢失后无法找回"
  }
}
```

### 4.6 单测要点

```ts
// src/components/atomic/__tests__/MessageLockBadge.test.ts
it('三态各有独立 aria-label，非仅颜色差异', () => {
  for (const state of ['verified', 'unverified', 'risk'] as const) {
    const wrapper = mount(MessageLockBadge, { props: { state }, global: { plugins: [i18n] } })
    expect(wrapper.get('button').attributes('aria-label')).toBeTruthy()
  }
})

it('点击触发 verify 事件', async () => {
  const wrapper = mount(MessageLockBadge, { props: { state: 'risk' }, global: { plugins: [i18n] } })
  await wrapper.get('button').trigger('click')
  expect(wrapper.emitted('verify')).toHaveLength(1)
})

// src/composables/encryption/__tests__/useMessageTrust.test.ts
it('同一设备重复查询只调用一次服务', async () => {
  const spy = vi.spyOn(cryptoSDKAdapter, 'getDeviceVerificationStatus').mockResolvedValue({ verified: true })
  const { resolveLockState } = useMessageTrust(ref('!r:server'))
  await resolveLockState('@a:server', 'DEV1')
  await resolveLockState('@a:server', 'DEV1')
  expect(spy).toHaveBeenCalledTimes(1)
})
```

---

## 5. 同步状态与离线提示（阶段 4.1）

### 5.1 状态文案映射（单一事实源）

文件：`src/components/connection/syncStatusCopy.ts`（新建）

```ts
import type { ConnectionState } from '@/services/matrix/MatrixClientService'

/** 连接状态对应的 i18n 文案键 */
export const SYNC_STATE_COPY: Record<ConnectionState, string | null> = {
  DISCONNECTED: 'connection.sync.disconnected',
  CONNECTING: 'connection.sync.connecting',
  CONNECTED: null, // 正常态不展示
  RECONNECTING: 'connection.sync.reconnecting',
  CATCHUP: 'connection.sync.catchup',
  ERROR: 'connection.sync.error'
}

/** 需要展示不确定进度动画的状态 */
export const INDETERMINATE_STATES: ReadonlySet<ConnectionState> = new Set(['CONNECTING', 'CATCHUP', 'RECONNECTING'])
```

> 说明：`ConnectionState` 的事实源为 `src/services/matrix/MatrixConnectionManager.ts:40`（`DISCONNECTED | CONNECTING | CONNECTED | RECONNECTING | CATCHUP | ERROR`）。`.rules` 中描述的 `SYNCING`/`SYNCED` 在当前代码中不存在，若需补齐属 SDK 边界变更，需单独立项。

### 5.2 `SyncStatusBar` 组件

文件：`src/components/connection/SyncStatusBar.vue`（新建）

```vue
<template>
  <div
    v-if="visible"
    class="sync-bar"
    :class="{ 'sync-bar--offline': isOffline, 'sync-bar--error': isError }"
    role="status"
    aria-live="polite">
    <!-- 图标：云端同步 / 离线 -->
    <svg
      class="sync-bar__icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true">
      <path d="M17.5 19a4.5 4.5 0 0 0 .5-8.97A6 6 0 0 0 6.3 9.4 4 4 0 0 0 6.5 19z" />
      <path v-if="isOffline" d="M4 4l16 16" />
    </svg>

    <span class="sync-bar__text">{{ message }}</span>

    <!-- 不确定进度：纯 CSS 动画，reduced-motion 下由全局兜底为静止 -->
    <span v-if="showProgress" class="sync-bar__track" aria-hidden="true">
      <span class="sync-bar__fill" />
    </span>

    <button v-if="isError" type="button" class="sync-bar__retry" @click="$emit('retry')">
      {{ t('connection.sync.retry') }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMatrixStore } from '@/stores/domains/chat/matrix'
import { storeToRefs } from 'pinia'
import { INDETERMINATE_STATES, SYNC_STATE_COPY } from './syncStatusCopy'

defineEmits<{ retry: [] }>()

const { t } = useI18n()
const matrixStore = useMatrixStore()
const { connectionState } = storeToRefs(matrixStore)

/** 离线判定：浏览器网络 + 连接状态双条件 */
const isOffline = computed(() => !navigator.onLine)
const isError = computed(() => connectionState.value === 'ERROR')

/** 连接正常且在线时不展示 */
const visible = computed(() => isOffline.value || connectionState.value !== 'CONNECTED')

const showProgress = computed(() => INDETERMINATE_STATES.has(connectionState.value) && !isOffline.value)

const message = computed(() => {
  if (isOffline.value) return t('connection.sync.offline_cached')
  const key = SYNC_STATE_COPY[connectionState.value]
  return key ? t(key) : ''
})
</script>

<style scoped lang="scss">
.sync-bar {
  display: flex;
  align-items: center;
  gap: var(--tjg-space-2);
  flex-shrink: 0;
  height: 28px;
  padding: 0 var(--tjg-space-3);
  background: var(--tjg-surface-panel-muted);
  border-bottom: 1px solid var(--tjg-border-muted);
  color: var(--tjg-text-secondary);
  font-size: var(--tjg-font-size-sm);

  &--offline {
    background: var(--tjg-sync-offline-bg);
    color: var(--tjg-sync-offline-text);
  }

  &--error {
    background: var(--tjg-color-danger-100);
    color: var(--tjg-color-danger-500);
  }
}

.sync-bar__icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

.sync-bar__text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sync-bar__track {
  position: relative;
  width: 96px;
  height: 3px;
  border-radius: var(--tjg-radius-full);
  background: var(--tjg-sync-track-bg);
  overflow: hidden;
}

.sync-bar__fill {
  position: absolute;
  inset-block: 0;
  width: 40%;
  border-radius: var(--tjg-radius-full);
  background: var(--tjg-sync-indeterminate-bg);
  animation: sync-slide 1.2s var(--tjg-motion-ease-standard) infinite;
}

@keyframes sync-slide {
  from {
    inset-inline-start: -40%;
  }
  to {
    inset-inline-start: 100%;
  }
}

.sync-bar__retry {
  border: none;
  background: transparent;
  color: inherit;
  font-size: var(--tjg-font-size-sm);
  text-decoration: underline;
  cursor: pointer;
}
</style>
```

> `prefers-reduced-motion` 由 `design-tokens.css:640` 的全局 `animation-duration: 0.01ms !important` 兜底，动画会退化为静止，无需重复声明。

### 5.3 离线/恢复监听

```ts
import { onMounted, onUnmounted } from 'vue'

function handleOnline() {
  // 恢复网络后由连接状态机接管重连；此处只触发未读刷新
  void refreshUnreadCounters()
}

onMounted(() => {
  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOnline)
})

onUnmounted(() => {
  window.removeEventListener('online', handleOnline)
  window.removeEventListener('offline', handleOnline)
})
```

### 5.4 i18n 片段

文件：`locales/zh-CN/connection.json`（在既有文件中新增 `sync` 节点）

```json
{
  "sync": {
    "disconnected": "连接已断开",
    "connecting": "正在连接服务器",
    "reconnecting": "连接中断，正在重连",
    "catchup": "正在同步历史消息",
    "error": "同步失败，消息可能不是最新",
    "offline_cached": "离线模式：正在显示本地缓存消息",
    "retry": "重试"
  }
}
```

**命名冲突检查（必做）：** `locales/*/connection.json` 已存在，新增前先 `grep -n '"sync"' locales/zh-CN/connection.json`，已有同名节点则合并而非覆盖。

---

## 6. 私有化部署入口（阶段 3.3）

文件：`src/views/loginWindow/ServerConfigModal.vue`（新增企业预设，逻辑抽 composable 供移动端复用）

```ts
// src/composables/login/useHomeserverPreset.ts（新建）
import { isValidHttpUrl } from '@/services/backend/config'

/** 企业预设来源：环境变量注入，禁止把内网域名硬编码进源码 */
export interface HomeserverPreset {
  key: string
  labelKey: string
  url: string
}

/**
 * 解析企业自建服务器预设列表。
 *
 * 约定：`VITE_HOMESERVER_PRESETS` 形如 `name|https://hs.corp.example,name2|https://hs2.corp.example`
 * 未配置时返回空数组，登录页仅展示默认公共服务器。
 */
export function resolveHomeserverPresets(raw = import.meta.env.VITE_HOMESERVER_PRESETS ?? ''): HomeserverPreset[] {
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [name, url] = entry.split('|').map((part) => part?.trim() ?? '')
      return { key: name, labelKey: name, url }
    })
    .filter((preset) => preset.key && isValidHttpUrl(preset.url))
}
```

**单测要点：**

```ts
it('未配置预设时返回空数组', () => {
  expect(resolveHomeserverPresets('')).toEqual([])
})

it('过滤非法 URL 预设', () => {
  expect(resolveHomeserverPresets('corp|not-a-url')).toEqual([])
  expect(resolveHomeserverPresets('corp|https://hs.corp.example')).toHaveLength(1)
})
```

---

## 7. 跨设备会话管理（阶段 3.4）

### 7.1 共享 composable（桌面/移动唯一取数入口）

文件：`src/composables/encryption/useDeviceSessionPanel.ts`（新建）

```ts
import { computed, ref } from 'vue'
import { matrixClientService } from '@/services/matrix/MatrixClientService'
import { matrixDeviceService, type Device } from '@/services/matrix/user/MatrixDeviceService'
import { matrixCryptoService } from '@/services/matrix/crypto/MatrixCryptoService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('useDeviceSessionPanel')

/** 面板行模型：桌面与移动共用同一字段集，避免两端漂移 */
export interface DeviceSessionRow {
  deviceId: string
  displayName: string
  lastSeenTs: number | null
  lastSeenIp: string | null
  isCurrent: boolean
  isVerified: boolean
  trustState: 'verified' | 'unverified' | 'risk'
}

/**
 * 跨设备会话面板数据源。
 *
 * 桌面 `DeviceTrustManager.vue` 与移动 `DeviceManagement.vue` 都必须经此取数，
 * 禁止各自调用 MatrixDeviceService。
 */
export function useDeviceSessionPanel() {
  const loading = ref(false)
  const error = ref<string | null>(null)
  const rows = ref<DeviceSessionRow[]>([])

  /** 当前设备永远置顶，风险设备紧随其后，其余按最后活跃倒序 */
  const sortedRows = computed(() =>
    [...rows.value].sort((a, b) => {
      if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1
      const riskRank = (row: DeviceSessionRow) => (row.trustState === 'risk' ? 0 : row.trustState === 'unverified' ? 1 : 2)
      if (riskRank(a) !== riskRank(b)) return riskRank(a) - riskRank(b)
      return (b.lastSeenTs ?? 0) - (a.lastSeenTs ?? 0)
    })
  )

  async function load(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const myUserId = matrixClientService.getUserId()
      const devices: Device[] = await matrixDeviceService.getDevices()
      const currentDeviceId = matrixDeviceService.getCurrentDeviceId()

      const mapped = await Promise.all(
        devices.map(async (device) => {
          let isVerified = device.verified ?? false
          try {
            const status = await matrixCryptoService.getDeviceVerificationStatus(myUserId ?? '', device.device_id)
            isVerified = status.verified
          } catch (err) {
            logger.warn('读取设备验证状态失败:', err)
          }
          return {
            deviceId: device.device_id,
            displayName: device.display_name ?? device.device_id,
            lastSeenTs: device.last_seen_ts ?? null,
            lastSeenIp: device.last_seen_ip ?? null,
            isCurrent: device.device_id === currentDeviceId,
            isVerified,
            trustState: isVerified ? 'verified' : 'unverified'
          } satisfies DeviceSessionRow
        })
      )

      rows.value = mapped
    } catch (err) {
      logger.error('加载设备列表失败:', err)
      error.value = err instanceof Error ? err.message : String(err)
    } finally {
      loading.value = false
    }
  }

  /**
   * 注销设备。
   *
   * @param deviceId 目标设备
   * @param auth UIA 认证参数（来自弹窗二次确认流程）
   */
  async function logoutDevice(deviceId: string, auth?: Record<string, unknown>): Promise<void> {
    await matrixDeviceService.deleteDevice(deviceId, auth)
    await load()
  }

  return { loading, error, rows, sortedRows, load, logoutDevice }
}
```

### 7.2 导出交叉签名信息（只出公钥）

```ts
/**
 * 导出本账号交叉签名公钥信息。
 *
 * 安全约定：仅包含公钥与设备标识，绝不含私钥或恢复密钥。
 *
 * @param rows 当前设备列表（来自 useDeviceSessionPanel）
 * @returns 可下载的 JSON 字符串
 */
export function buildCrossSigningExport(
  rows: DeviceSessionRow[],
  crossSigning: { masterPublicKey?: string; selfSigningPublicKey?: string; userSigningPublicKey?: string },
  myUserId: string
): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      userId: myUserId,
      crossSigning: {
        masterPublicKey: crossSigning.masterPublicKey ?? null,
        selfSigningPublicKey: crossSigning.selfSigningPublicKey ?? null,
        userSigningPublicKey: crossSigning.userSigningPublicKey ?? null
      },
      devices: rows.map((row) => ({
        deviceId: row.deviceId,
        displayName: row.displayName,
        isCurrent: row.isCurrent,
        isVerified: row.isVerified
      }))
    },
    null,
    2
  )
}
```

**单测要点：**

```ts
it('导出内容不含私钥类字段', () => {
  const json = buildCrossSigningExport(rows, { masterPublicKey: 'pub' }, '@me:server')
  expect(json).not.toMatch(/private|recovery|seed|passphrase/i)
})
```

---

## 8. 无障碍与检查清单

### 8.1 图标按钮标准写法

```vue
<button type="button" class="icon-btn" :aria-label="t('layout.left.collapse')" :title="t('layout.left.collapse')">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
    <path d="M15 6l-6 6 6 6" />
  </svg>
</button>
```

### 8.2 焦点管理

```vue
<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref } from 'vue'

const modalVisible = ref(false)
const panelRef = ref<HTMLElement | null>(null)
const triggerRef = ref<HTMLElement | null>(null)

function openModal(): void {
  modalVisible.value = true
  void nextTick(() => panelRef.value?.focus())
}

function closeModal(): void {
  modalVisible.value = false
  triggerRef.value?.focus()
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && modalVisible.value) closeModal()
}

onMounted(() => window.addEventListener('keydown', handleKeydown))
onUnmounted(() => window.removeEventListener('keydown', handleKeydown))
</script>
```

### 8.3 PR / 代码审查检查清单

```markdown
## UI 变更检查清单

- [ ] 颜色全部使用 `--tjg-*` token，无 `#xxx` / `rgb()` 新增值（`pnpm check:ratchet`）
- [ ] 新增 service 方法带 JSDoc 摘要（`pnpm check:doc-coverage`）
- [ ] 图标为 SVG，线宽 1.5，装饰性图标 `aria-hidden="true"`
- [ ] 状态类信息（联邦/加密/同步）不只靠颜色传达，具备文本或形状差异
- [ ] 无内联 `style` 属性
- [ ] 新 `!important` 均带原因注释
- [ ] 圆角使用语义 token（surface / panel / sheet），未写字面量
- [ ] 玻璃效果未用于列表项或消息行；低性能设备下已降级
- [ ] 暗色主题与 `prefers-reduced-motion` 均已验证
- [ ] 移动端为独立实现（未新增 `isMobile()` 内联分支）
- [ ] 组件行数 < 800
- [ ] `pnpm vue-tsc --noEmit` / `pnpm test:run` 全通过
```

---

## 9. 提交前必跑命令

```bash
pnpm vue-tsc --noEmit        # 类型检查，必须 0 错误
pnpm test:run                # 单元测试全通过
pnpm check:ratchet           # 硬编码颜色计数不增长（当前基线 48）
pnpm check:doc-coverage      # 新增 service 方法必须有 JSDoc
pnpm check:sdk-boundary      # 组件未越层调用 SDK
pnpm quality:no-raw-fetch    # 无直连 fetch
pnpm check                   # Biome lint + i18n 检查
```

---

*配套文档：`UI-OPTIMIZATION-PLAN.md`*
*生成时间：2026-09-19*
*所有组件路径、service 方法名、token 名均取自当前仓库源码；示例中标注「新建」的文件尚未存在*
