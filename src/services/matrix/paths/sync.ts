import { PREFIX_V1 } from './prefixes'

export const SYNC = {
  /** @deprecated Use MatrixSyncService methods instead */
  SYNC: '/sync',
  /** @deprecated Use MatrixSyncService filter methods instead */
  FILTER: (userId: string) => `/user/${encodeURIComponent(userId)}/filter`,
  /** @deprecated Use MatrixSyncService filter methods instead */
  FILTER_BY_ID: (userId: string, filterId: string) =>
    `/user/${encodeURIComponent(userId)}/filter/${encodeURIComponent(filterId)}`,
  /** @deprecated Use MatrixSlidingSyncService methods instead */
  SLIDING_SYNC: PREFIX_V1 + '/sync',
  /** @deprecated Use MatrixSlidingSyncService methods instead */
  SLIDING_SYNC_UNSTABLE: '/_matrix/client/unstable/org.matrix.msc3575/sync',
  /** @deprecated Use MatrixSlidingSyncService methods instead */
  SLIDING_SYNC_SIMPLIFIED_UNSTABLE: '/_matrix/client/unstable/org.matrix.simplified_msc3575/sync',
  /** @deprecated Use MatrixSlidingSyncService methods instead */
  SLIDING_SYNC_CANDIDATES: [
    PREFIX_V1 + '/sync',
    '/_matrix/client/unstable/org.matrix.msc3575/sync',
    '/_matrix/client/unstable/org.matrix.simplified_msc3575/sync'
  ]
} as const
