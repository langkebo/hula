export const FRIENDS = {
  LIST: '/_matrix/client/v1/friends',
  REQUEST: '/_matrix/client/v1/friends/request',
  SEARCH: '/_matrix/client/v1/friends/search',
  INCOMING_REQUESTS: '/_matrix/client/v1/friends/requests/incoming',
  OUTGOING_REQUESTS: '/_matrix/client/v1/friends/requests/outgoing',
  ACCEPT: (userId: string) => `/_matrix/client/v1/friends/request/${userId}/accept`,
  REJECT: (userId: string) => `/_matrix/client/v1/friends/request/${userId}/reject`,
  CANCEL: (userId: string) => `/_matrix/client/v1/friends/request/${userId}/cancel`,
  REMOVE: (userId: string) => `/_matrix/client/v1/friends/${userId}`,
  NOTE: (userId: string) => `/_matrix/client/v1/friends/${userId}/note`,
  CHECK: (userId: string) => `/_matrix/client/v1/friends/check/${userId}`,
  DM: (userId: string) => `/_matrix/client/v1/friends/dm/${userId}`,
  STATUS: (userId: string) => `/_matrix/client/v1/friends/${userId}/status`
} as const
