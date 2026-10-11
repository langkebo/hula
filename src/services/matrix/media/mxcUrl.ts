import { createLogger } from '@/utils/Logger'

/**
 * mxc:// → HTTP(S) URL 解析的**单一事实源**。
 *
 * 背景（2026-10-11 审计）：本 fork（matrix-js-sdk@40.2.0-langkebo.6）把 `mxcUrlToHttp`
 * 放在 **ProfileManager** 上，`MatrixClient` 本体并没有这个方法：
 *
 *   - 定义：`lib/profile/index.d.ts:188`（`ProfileManager.mxcUrlToHttp(...)`）
 *   - SDK 自身用法：`lib/models/MSC3089Branch.js:137` → `client.getProfileManager().mxcUrlToHttp(file.url)`
 *
 * 前端曾长期直接调用 `client.mxcUrlToHttp(...)`（幻影方法），并在调用处用
 * `typeof client?.mxcUrlToHttp !== 'function'` 兜底成「返回原始 mxc://」——结果是
 * **媒体与头像 URL 静默不可用**（webview 无法加载 mxc://）。
 * 现在统一走本模块，兜底只处理「SDK 未初始化 / manager 扩展未装载」这一真实情形，
 * 且不再返回原始 mxc://（那是调用方各自决定的降级，不是解析器的职责）。
 */

const logger = createLogger('MxcUrl')

/** 只需要 `getProfileManager` 的结构化类型，避免与完整 MatrixClient 类型耦合 */
export interface MxcResolverClient {
  getProfileManager?: () => unknown
}

interface ProfileManagerLike {
  mxcUrlToHttp?: (
    mxcUrl: string,
    width?: number,
    height?: number,
    resizeMethod?: string,
    allowDirectLinks?: boolean,
    allowRedirects?: boolean,
    useAuthentication?: boolean
  ) => string | null
}

/**
 * 把 mxc:// 媒体 URI 解析为可直接请求的 HTTP(S) URL。
 *
 * @param client 已初始化的 MatrixClient（或任何暴露 getProfileManager 的对象）
 * @param mxcUrl mxc:// 形式的媒体 URI；非 mxc:// 输入一律返回 null
 * @param width  可选；与 height 同时给出时按 `scale` 方式请求缩略图
 * @param height 可选；与 width 同时给出时按 `scale` 方式请求缩略图
 * @returns 解析后的 URL；无法解析（非 mxc:// / 无 client / SDK 未初始化 / 抛错）时返回 null
 */
export function resolveMxcToHttp(
  client: MxcResolverClient | null | undefined,
  mxcUrl: string,
  width?: number,
  height?: number
): string | null {
  if (!mxcUrl?.startsWith('mxc://')) return null
  if (!client) return null

  let manager: ProfileManagerLike | undefined
  try {
    manager = client.getProfileManager?.() as ProfileManagerLike | undefined
  } catch (err) {
    // manager 扩展未装载（SDK 未初始化）时访问器会抛错
    logger.warn(`[MxcUrl] getProfileManager 不可用: ${(err as Error)?.message ?? err}`)
    return null
  }

  const resolve = manager?.mxcUrlToHttp
  if (typeof resolve !== 'function') {
    logger.warn('[MxcUrl] ProfileManager.mxcUrlToHttp 不可用，无法解析 mxc 链接')
    return null
  }

  try {
    if (width && height) return resolve.call(manager, mxcUrl, width, height, 'scale') ?? null
    return resolve.call(manager, mxcUrl) ?? null
  } catch (err) {
    logger.warn(`[MxcUrl] mxcUrlToHttp 调用失败: ${(err as Error)?.message ?? err}`)
    return null
  }
}
