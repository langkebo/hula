import { PREFIX_UNSTABLE } from './prefixes'

/**
 * Sliding Sync 候选端点列表（用于连通性诊断）。
 *
 * 仅保留非废弃的常量。原 SYNC_FILTER / SYNC_TIMEOUT / SLIDING_SYNC / SLIDING_SYNC_LIST /
 * SLIDING_SYNC_WINDOW 等已废弃，请使用 MatrixSyncService / MatrixSlidingSyncService 的方法。
 */
export const SYNC = {
  /** Sliding Sync 候选端点（用于 /utils/MatrixDiagnostics 连通性检查） */
  SLIDING_SYNC_CANDIDATES: [`${PREFIX_UNSTABLE}/org.matrix.simplified_msc3575/sync`, `/_matrix/client/v4/sync`]
} as const
