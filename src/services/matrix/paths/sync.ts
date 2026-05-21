export const SYNC = {
  SYNC: '/_matrix/client/v3/sync',
  FILTER: (userId: string) => `/_matrix/client/v3/user/${encodeURIComponent(userId)}/filter`,
  FILTER_BY_ID: (userId: string, filterId: string) =>
    `/_matrix/client/v3/user/${encodeURIComponent(userId)}/filter/${encodeURIComponent(filterId)}`,
  SLIDING_SYNC: '/_matrix/client/unstable/org.matrix.msc3575/sync'
} as const
