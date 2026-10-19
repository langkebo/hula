import { PREFIX_VENDOR_V1 } from './prefixes'

/**
 * 一次性邀请（B-9 后端 vendor 扩展）。
 *
 * 对应 `synapse-web/src/routes/one_time_invite.rs`：
 * - `POST /_matrix/vendor/v1/invites/one-time` → 铸造 token
 * - `POST /_matrix/vendor/v1/invites/claim` → 认领（**POST-only**）
 *
 * ⚠️ claim 刻意只用 POST：GET 会被链接预览 / 抓取器触发，
 * 导致 token 在受邀请人点开之前就被烧掉。
 */
export const INVITES = {
  ONE_TIME: `${PREFIX_VENDOR_V1}/invites/one-time`,
  CLAIM: `${PREFIX_VENDOR_V1}/invites/claim`
} as const
