/**
 * Matrix SDK Vite 别名配置（独立模块）
 *
 * 将 matrix-js-sdk 的子路径别名从 vite.config.base.ts 抽取为独立模块，
 * 便于统一维护和自动校验。
 *
 * 背景：matrix-js-sdk 以 tarball（file:vendor/matrix-js-sdk.tgz）安装进 node_modules，
 * 以下 alias 将 fork 自定义子路径指向已安装包内的 TS 源码（tarball 的 files 包含 src/），
 * 保持"从源码编译 SDK"的既有运行时行为不变（lib 产物中 logger 访问 process.env
 * 在浏览器/Worker 下会失败）。
 *
 * 注意：不能用 require.resolve('matrix-js-sdk/package.json')——SDK 的 exports 未导出
 * './package.json' 子路径；顶级依赖的 node_modules/matrix-js-sdk 软链由 pnpm 保证存在。
 */

import path from 'node:path'

/**
 * SDK 别名条目定义
 *
 * 每条别名将 `matrix-js-sdk/<subpath>` 映射到 SDK src 目录下的实际文件。
 * `segments` 是相对于 `node_modules/matrix-js-sdk/src/` 的路径片段。
 */
export interface SdkAliasEntry {
  /** Vite alias key，导入时使用的路径 */
  alias: string
  /** 相对于 SDK src 目录的路径片段 */
  segments: string[]
}

/**
 * SDK 子路径别名清单
 *
 * 维护规则：
 * 1. 新增别名时必须确认目标文件存在于 SDK src 目录
 * 2. SDK 升级后运行 `pnpm check:sdk-aliases` 验证路径有效性
 * 3. 删除别名时检查是否有代码引用该子路径
 */
export const sdkAliasEntries: SdkAliasEntry[] = [
  { alias: 'matrix-js-sdk/src', segments: [] },
  { alias: 'matrix-js-sdk/friend', segments: ['friend', 'index.ts'] },
  { alias: 'matrix-js-sdk/crypto', segments: ['crypto-api', 'index.ts'] },
  { alias: 'matrix-js-sdk/dm', segments: ['dm', 'index.ts'] },
  { alias: 'matrix-js-sdk/voice', segments: ['voice', 'index.ts'] },
  { alias: 'matrix-js-sdk/push', segments: ['push', 'index.ts'] },
  { alias: 'matrix-js-sdk/space', segments: ['space', 'index.ts'] },
  { alias: 'matrix-js-sdk/admin', segments: ['admin', 'index.ts'] },
  { alias: 'matrix-js-sdk/beacon', segments: ['beacon', 'index.ts'] },
  { alias: 'matrix-js-sdk/client', segments: ['client.ts'] },
  { alias: 'matrix-js-sdk/sync', segments: ['sync.ts'] },
  { alias: 'matrix-js-sdk/models/room', segments: ['models', 'room.ts'] },
  { alias: 'matrix-js-sdk/models/room-state', segments: ['models', 'room-state.ts'] },
  { alias: 'matrix-js-sdk/http-api', segments: ['http-api', 'index.ts'] },
  { alias: 'matrix-js-sdk/manager-extensions', segments: ['manager-extensions', 'index.ts'] },
  { alias: 'matrix-js-sdk/store/worker', segments: ['store', 'indexeddb-store-worker.ts'] },
  { alias: 'matrix-js-sdk/account', segments: ['account', 'index.ts'] },
  { alias: 'matrix-js-sdk/auth', segments: ['auth', 'index.ts'] },
  { alias: 'matrix-js-sdk/capabilities', segments: ['capabilities', 'index.ts'] },
  { alias: 'matrix-js-sdk/room', segments: ['room', 'index.ts'] },
  { alias: 'matrix-js-sdk/media', segments: ['media', 'index.ts'] },
  { alias: 'matrix-js-sdk/profile', segments: ['profile', 'index.ts'] },
  { alias: 'matrix-js-sdk/presence', segments: ['presence', 'index.ts'] },
  { alias: 'matrix-js-sdk/sending', segments: ['sending', 'index.ts'] },
  { alias: 'matrix-js-sdk/crypto-keys', segments: ['crypto-keys', 'index.ts'] },
  { alias: 'matrix-js-sdk/device', segments: ['device', 'index.ts'] },
  { alias: 'matrix-js-sdk/telemetry', segments: ['telemetry', 'index.ts'] },
  { alias: 'matrix-js-sdk/rendezvous', segments: ['rendezvous', 'index.ts'] },
  { alias: 'matrix-js-sdk', segments: ['index.ts'] }
]

/**
 * 构建 SDK 别名的 Vite resolve.alias 对象
 *
 * @param sdkPackageRoot - node_modules/matrix-js-sdk 的绝对路径
 * @returns Vite alias 键值对
 */
export function createSdkAliases(sdkPackageRoot: string): Record<string, string> {
  const sdkSrc = (...segments: string[]) => path.join(sdkPackageRoot, 'src', ...segments)

  const aliases: Record<string, string> = {}

  for (const entry of sdkAliasEntries) {
    aliases[entry.alias] = sdkSrc(...entry.segments)
  }

  return aliases
}
