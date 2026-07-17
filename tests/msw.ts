import type { RequestHandler } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll } from 'vitest'

/**
 * Opt-in msw server for contract tests: mock at the HTTP boundary instead of
 * vi.mock-ing service classes, so URL construction, /_matrix prefix handling
 * and token refresh/retry actually execute.
 *
 * Unhandled requests fail the test ('error') — a missing handler in a
 * contract test means the contract is incomplete, never silently bypassed.
 */
export function setupMswServer(...handlers: RequestHandler[]) {
  const server = setupServer(...handlers)
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
  afterEach(() => server.resetHandlers())
  afterAll(() => server.close())
  return server
}
