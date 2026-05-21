export const DEHYDRATED_DEVICE = {
  BASE: '/_matrix/client/v1/dehydrated_device',
  BY_ID: (deviceId: string) => `/_matrix/client/v1/dehydrated_device/${encodeURIComponent(deviceId)}`,
  CLAIM: (deviceId: string) => `/_matrix/client/v1/dehydrated_device/${encodeURIComponent(deviceId)}/claim`,
  INITIAL_DEVICE: (deviceId: string) =>
    `/_matrix/client/v1/dehydrated_device/${encodeURIComponent(deviceId)}/initial_device`
} as const
