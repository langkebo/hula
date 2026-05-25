const UNSTABLE_PREFIX = '/_matrix/client/unstable/org.matrix.msc3814.v1'

export const DEHYDRATED_DEVICE = {
  BASE: `${UNSTABLE_PREFIX}/dehydrated_device`,
  BY_ID: (deviceId: string) => `${UNSTABLE_PREFIX}/dehydrated_device/${encodeURIComponent(deviceId)}`,
  CLAIM: (deviceId: string) => `${UNSTABLE_PREFIX}/dehydrated_device/${encodeURIComponent(deviceId)}/claim`,
  INITIAL_DEVICE: (deviceId: string) =>
    `${UNSTABLE_PREFIX}/dehydrated_device/${encodeURIComponent(deviceId)}/initial_device`
} as const
