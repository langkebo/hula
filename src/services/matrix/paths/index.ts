import { matrixExtensionEndpoints } from '@/services/backend/endpoints'
import { AUTH } from './auth'
import { CLIENT_CONFIG } from './clientConfig'
import { FRIENDS } from './friends'
import { NOTIFICATION } from './notification'
import { ROOM } from './room'
import { SYNC } from './sync'
import { VOICE } from './voice'
import { WELL_KNOWN } from './wellKnown'

export { PREFIX_V3 } from './prefixes'
// 从 SDK re-export 路由表常量与校验工具，使 SDK 路由成为前后端 API 路径的单一事实源。
// 详见 `./sdk-paths.ts`。
export * from './sdk-paths'

/**
 * 前端结构化路径视图（ergonomic API）。
 *
 * 注意：`MATRIX_PATHS` 是对 SDK route-table（`SDK_PATHS`）的 ergonomic 封装，
 * 提供具名键与函数式路径构建器，SDK 的路由数组无法直接表达。
 * 各模块路径常量必须与 `SDK_PATHS` 保持一致；模块级逐路径对齐由
 * `__tests__/friends.contract.test.ts` 等契约测试强制校验，
 * 跨模块校验可使用 `validateTjgPath()`。后端路径变更时契约测试会失败，
 * 强制开发者同步前端路径常量。
 */
export const MATRIX_PATHS = {
  AUTH,
  ROOM,
  FRIENDS,
  SYNC,
  NOTIFICATION,
  VOICE,
  WELL_KNOWN,
  CLIENT_CONFIG,
  EXTENSIONS: matrixExtensionEndpoints
} as const
