/**
 * 从 matrix-js-sdk re-export 路由表常量，作为前后端 API 路径的单一事实源。
 *
 * 传递链路：后端路由清单 → SDK `__generated__/route-table` → 本文件 → 前端 `MATRIX_PATHS`。
 *
 * 前端 `MATRIX_PATHS`（见 `./index.ts`）是对 SDK 路由的 ergonomic 视图，二者必须保持一致；
 * `__tests__/friends.contract.test.ts` 等契约测试会强制校验，`validateTjgPath` 提供运行时校验能力。
 *
 * 注：此前这里用 `../../../../../matrix-js-sdk/src/...` 深度导入 SDK 源文件，有两个真实问题：
 *   1. 绕过 SDK `package.json#exports`，把前端绑死在 SDK 的**源码目录布局**上；
 *   2. 该相对路径解析到的是工作区 sibling 仓库，而运行时 `matrix-js-sdk` 解析到 vendored tarball，
 *      于是同一次构建里混入了两个 SDK 版本——契约常量与实际 HTTP 客户端可能对不上。
 * 现统一走 SDK 的聚合契约出口 `matrix-js-sdk/contract`（经本仓唯一的 SDK 咽喉点
 * `@/services/matrix/sdk` 转发，以符合 `check-sdk-boundary` 的边界约定）。
 */
import { SDK_CONTRACT_ROUTE_TABLES } from '../sdk'

const BURN_AFTER_READ_ROUTES = SDK_CONTRACT_ROUTE_TABLES['burn-after-read']
const FRIEND_ROUTES = SDK_CONTRACT_ROUTE_TABLES.friend
const ROOM_ROUTES = SDK_CONTRACT_ROUTE_TABLES.room
const WIDGET_ROUTES = SDK_CONTRACT_ROUTE_TABLES.widget

// 按模块分组导出（沿用 SDK `_ROUTES` 命名的同时提供 `_PATHS` 别名，便于按模块定向校验）
/** SDK friend 模块路由表。 */
export const FRIEND_PATHS = FRIEND_ROUTES
/** SDK room 模块路由表。 */
export const ROOM_PATHS = ROOM_ROUTES
/** SDK widget 模块路由表。 */
export const WIDGET_PATHS = WIDGET_ROUTES
/** SDK burn-after-read 模块路由表。 */
export const BURN_AFTER_READ_PATHS = BURN_AFTER_READ_ROUTES

// 同时保留 SDK 原始 `_ROUTES` 命名，便于需要时直接引用
export { BURN_AFTER_READ_ROUTES, FRIEND_ROUTES, ROOM_ROUTES, WIDGET_ROUTES }

/** SDK 路由条目形状。 */
export interface SdkRoute {
  readonly method: string
  readonly path: string
}

/**
 * 聚合的 SDK 路由表（跨模块），作为前端路径校验的权威来源。
 * 任何前端 API 路径都应能在此找到匹配（`validateTjgPath`）。
 */
export const SDK_PATHS: readonly SdkRoute[] = [
  ...BURN_AFTER_READ_ROUTES,
  ...FRIEND_ROUTES,
  ...ROOM_ROUTES,
  ...WIDGET_ROUTES
]

/** 将 SDK path 模板中的 `{param}` 占位符转为匹配任意单段的正则。 */
function buildPathMatcher(sdkPath: string): RegExp {
  // 转义正则元字符，但保留 `{` `}` 以便后续替换占位符
  const escaped = sdkPath.replace(/[.*+?^${}()|[\]\\]/g, (c) => (c === '{' || c === '}' ? c : `\\${c}`))
  return new RegExp('^' + escaped.replace(/\{[^}]+\}/g, '[^/]+') + '$')
}

const SDK_PATH_MATCHERS = SDK_PATHS.map((r) => buildPathMatcher(r.path))

/**
 * 校验前端路径字符串是否存在于 SDK route-table 中。
 * `{param}` 占位符视为通配段（匹配 `[^/]+`）。
 *
 * 用于运行时或测试时确认前端路径常量与 SDK 路由保持一致。
 *
 * @example
 * validateTjgPath('/_matrix/vendor/v1/friends') // true
 * validateTjgPath('/_matrix/client/v1/nonexistent') // false
 */
export function validateTjgPath(tjgPath: string): boolean {
  return SDK_PATH_MATCHERS.some((matcher) => matcher.test(tjgPath))
}
