import type { MatrixClient } from 'matrix-js-sdk'
import { vi } from 'vitest'
import type { MatrixClientProvider } from '@/services/matrix/MatrixClientProvider'

export function createStubMatrixClientProvider(client?: MatrixClient | null): MatrixClientProvider {
  const mockClient = client ?? ({} as unknown as MatrixClient)
  return {
    getClient: vi.fn().mockReturnValue(mockClient),
    waitForClientReady: vi.fn().mockResolvedValue(mockClient)
  }
}
