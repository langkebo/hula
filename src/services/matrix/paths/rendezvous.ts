import { PREFIX_V1 } from './prefixes'

export const RENDEZVOUS = {
  /** @deprecated Unused - will be removed in a future version */
  BASE: PREFIX_V1 + '/rendezvous',
  /** @deprecated Unused - will be removed in a future version */
  SESSION: (id: string) => `${PREFIX_V1}/rendezvous/${id}`,
  /** @deprecated Unused - will be removed in a future version */
  MESSAGES: (id: string) => `${PREFIX_V1}/rendezvous/${id}/messages`
} as const
