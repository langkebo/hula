/**
 * e2e spec 的「路由集归属」**单一事实源**。
 *
 * 为什么需要它：路由集是**构建期装配**的（`src/router/entries/platformRoutes.ts`），
 * 5210 的 dev server 只有 `/mobile/*`，5211 只有桌面路由（`/message`、`/settings`…）。
 * 一个 spec 跑错 server 就必然假红（历史上 mobile 项目有 6 条常红、桌面项目整片空窗）。
 *
 * 维护约定（三处必须一致，`tests/lint/e2e-route-sets.test.ts` 会校验）：
 * 1. spec 文件**顶部注释**声明 `路由集: desktop | mobile | both`；
 * 2. 本文件的 `MOBILE_ONLY_SPECS` / `DESKTOP_ONLY_SPECS` 名单（= 生成 `testIgnore` 的依据）；
 * 3. `playwright.config.ts` 只消费本文件，不再自己写正则。
 *
 * 忘了登记会**直接报错**（缺声明 / 声明与名单不符 / 名单里有不存在的文件），不会再退化成假红。
 */
export type E2eRouteSet = 'desktop' | 'mobile' | 'both'

/** 只在移动路由集（5210）有意义：断言 `/mobile/*` 页面与 vant 组件。 */
export const MOBILE_ONLY_SPECS: readonly string[] = [
  'mobile-entry-smoke',
  'mobile-friends-card',
  'mobile-input-bar',
  'mobile-session-list',
  'mobile-sso-login',
  'mobile-touch-targets',
  'my-hub-live',
  'my-hub-metrics',
  'space-tree-live',
  'tabbar-audit',
  'web-session-restore'
]

/**
 * 只在桌面路由集（5211）有意义：断言 `.login-box`、`/settings`、`/message` 等桌面 DOM。
 *
 * `a11y-baseline` 不在此名单：它已改为 `both`，桌面用例（`/`、`/home/friend`）与
 * 移动用例（`/mobile/login`）在同一 spec 内按 `test.info().project.name` 互斥跳过
 * （移动登录壳基线见报告 §3.2-A11Y-M）。
 */
export const DESKTOP_ONLY_SPECS: readonly string[] = [
  'debug-phase3',
  'desktop-key-flows',
  'friend-operations',
  'login-flow',
  'matrix-live',
  'messaging-workspace',
  'multi-device.android',
  'multi-device.chat',
  'notification-unread-live',
  'room-key-request-live',
  'room-operations',
  'room-settings-e2e',
  'scenario-05-logout',
  'scenario-23-settings-persist',
  'scenario-30-capability-fallback',
  'space-operations'
]

/**
 * spec 顶部必须出现的声明行，例如：
 *
 * ```
 * 路由集: desktop
 * ```
 *
 * 兼容全角冒号与中英文冒号两侧空格。
 */
export const ROUTE_SET_DECLARATION_RE = /路由集\s*[:：]\s*(desktop|mobile|both)\b/

/** 把 spec 文件名（可带目录）归一成不带 `.spec.ts` 的 stem。 */
export const specStem = (fileName: string): string => (fileName.split('/').pop() ?? fileName).replace(/\.spec\.ts$/, '')

/** 由名单推导某 spec 应有的路由集；两张名单都没登记 ⇒ `both`。 */
export const routeSetForSpec = (fileName: string): E2eRouteSet => {
  const stem = specStem(fileName)
  if (MOBILE_ONLY_SPECS.includes(stem)) return 'mobile'
  if (DESKTOP_ONLY_SPECS.includes(stem)) return 'desktop'
  return 'both'
}

/** 把 stem 名单编成 Playwright `testIgnore` 用的正则（转义 `.` 等元字符）。 */
export const specIgnorePattern = (stems: readonly string[]): RegExp => {
  const escaped = stems.map((stem) => stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  return new RegExp(`/(${escaped.join('|')})\\.spec\\.ts$`)
}
