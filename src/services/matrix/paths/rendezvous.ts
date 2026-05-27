export const RENDEZVOUS = {
  BASE: '/_matrix/client/v1/rendezvous',
  SESSION: (id: string) => `/_matrix/client/v1/rendezvous/${id}`,
  MESSAGES: (id: string) => `/_matrix/client/v1/rendezvous/${id}/messages`
} as const
