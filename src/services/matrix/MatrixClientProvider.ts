import type { MatrixClient } from 'matrix-js-sdk'

export interface MatrixClientProvider {
  getClient(): MatrixClient | null
  waitForClientReady(opts?: { timeoutMs?: number; intervalMs?: number }): Promise<MatrixClient>
}
