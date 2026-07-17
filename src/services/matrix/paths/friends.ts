import { PREFIX_V1 } from './prefixes'

export const FRIENDS = {
  LIST: PREFIX_V1 + '/friends',
  REQUEST: PREFIX_V1 + '/friends/request',
  SEARCH: PREFIX_V1 + '/friends/search',
  INCOMING_REQUESTS: PREFIX_V1 + '/friends/requests/incoming',
  OUTGOING_REQUESTS: PREFIX_V1 + '/friends/requests/outgoing',
  ACCEPT: (userId: string) => `${PREFIX_V1}/friends/request/${userId}/accept`,
  REJECT: (userId: string) => `${PREFIX_V1}/friends/request/${userId}/reject`,
  CANCEL: (userId: string) => `${PREFIX_V1}/friends/request/${userId}/cancel`,
  REMOVE: (userId: string) => `${PREFIX_V1}/friends/${userId}`,
  NOTE: (userId: string) => `${PREFIX_V1}/friends/${userId}/note`,
  CHECK: (userId: string) => `${PREFIX_V1}/friends/check/${userId}`,
  DM: (userId: string) => `${PREFIX_V1}/friends/dm/${userId}`,
  STATUS: (userId: string) => `${PREFIX_V1}/friends/${userId}/status`
} as const
