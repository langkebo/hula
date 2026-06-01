export const SYNC = {
  /** @deprecated Use MatrixSyncService methods instead */
  SYNC: '/_matrix/client/v3/sync',
  /** @deprecated Use MatrixSyncService filter methods instead */
  FILTER: (userId: string) => `/_matrix/client/v3/user/${encodeURIComponent(userId)}/filter`,
  /** @deprecated Use MatrixSyncService filter methods instead */
  FILTER_BY_ID: (userId: string, filterId: string) =>
    `/_matrix/client/v3/user/${encodeURIComponent(userId)}/filter/${encodeURIComponent(filterId)}`,
  /** @deprecated Use MatrixSlidingSyncService methods instead */
  SLIDING_SYNC: '/_matrix/client/v1/sync',
  /** @deprecated Use MatrixSlidingSyncService methods instead */
  SLIDING_SYNC_UNSTABLE: '/_matrix/client/unstable/org.matrix.msc3575/sync',
  /** @deprecated Use MatrixSlidingSyncService methods instead */
  SLIDING_SYNC_SIMPLIFIED_UNSTABLE: '/_matrix/client/unstable/org.matrix.simplified_msc3575/sync',
  /** @deprecated Use MatrixSlidingSyncService methods instead */
  SLIDING_SYNC_CANDIDATES: [
    '/_matrix/client/v1/sync',
    '/_matrix/client/unstable/org.matrix.msc3575/sync',
    '/_matrix/client/unstable/org.matrix.simplified_msc3575/sync'
  ]
} as const
