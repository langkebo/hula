import { useCircuitBreaker } from '@/composables/useCircuitBreaker'
import { matrixCapabilityService } from '@/services/matrix/MatrixCapabilityService'
import { getSemaphore } from '@/utils/Semaphore'

/**
 * §19.6 + §19.3 + §16.5.3 — every admin SDK call passes through:
 *   1. `requireCapability('admin-api')` — layer 3 service gate. Fails fast with
 *      `CapabilityUnavailableError` before any HTTP when the server has not
 *      advertised the admin extension.
 *   2. `adminBatch` semaphore (cap 4) — bursts of admin pagination/loop calls
 *      don't saturate the homeserver.
 *   3. `admin` circuit breaker — sustained failures fail fast for 30 s (open)
 *      instead of hammering the server (5 errors / 10 s window opens).
 *
 * Use this helper to wrap any `await admin.<call>()` so all admin domain
 * services share one capability gate / one breaker / one semaphore.
 */
export function runAdminCall<T>(fn: () => Promise<T>): Promise<T> {
  matrixCapabilityService.requireCapability('admin-api')
  const semaphore = getSemaphore('adminBatch')
  const breaker = useCircuitBreaker('admin')
  return semaphore.run(() => breaker.execute(fn))
}
