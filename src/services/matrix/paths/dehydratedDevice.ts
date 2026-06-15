const UNSTABLE_PREFIX = '/_matrix/client/unstable/org.matrix.msc3814.v1'

export const DEHYDRATED_DEVICE = {
  BASE: `${UNSTABLE_PREFIX}/dehydrated_device`,
  BY_ID: `${UNSTABLE_PREFIX}/dehydrated_device`,
  /** @deprecated 后端暂未实现 */
  CLAIM: (deviceId: string) => `${UNSTABLE_PREFIX}/dehydrated_device/${encodeURIComponent(deviceId)}/claim`,
  /** @deprecated 后端暂未实现 */
  INITIAL_DEVICE: (deviceId: string) =>
    `${UNSTABLE_PREFIX}/dehydrated_device/${encodeURIComponent(deviceId)}/initial_device`
} as const
