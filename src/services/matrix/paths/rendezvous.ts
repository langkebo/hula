export const RENDEZVOUS = {
  /** @deprecated Unused - will be removed in a future version */
  BASE: '/_matrix/client/v1/rendezvous',
  /** @deprecated Unused - will be removed in a future version */
  SESSION: (id: string) => `/_matrix/client/v1/rendezvous/${id}`,
  /** @deprecated Unused - will be removed in a future version */
  MESSAGES: (id: string) => `/_matrix/client/v1/rendezvous/${id}/messages`
} as const
