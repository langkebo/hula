import { computed, ref } from 'vue'

/**
 * Circuit breaker per plan §19.3.
 *
 * States:
 *   closed    — calls pass through; errors counted in a rolling window.
 *   open      — calls fail fast with `CircuitOpenError` until `openMs` elapses.
 *   half-open — one probe call is allowed; success closes the circuit,
 *               failure re-opens it for `reopenMs`.
 *
 * Defaults match the plan: 5 errors / 10 s → open, 30 s open window,
 * 60 s reopen on probe failure.
 */

type CircuitState = 'closed' | 'open' | 'half-open'

interface CircuitBreakerOptions {
  failureThreshold?: number
  failureWindowMs?: number
  openMs?: number
  reopenMs?: number
  now?: () => number
  onStateChange?: (name: string, state: CircuitState) => void
}

export class CircuitOpenError extends Error {
  readonly code = 'CIRCUIT_OPEN'
  constructor(serviceName: string) {
    super(`circuit open: ${serviceName}`)
    this.name = 'CircuitOpenError'
  }
}

const DEFAULTS: Required<Omit<CircuitBreakerOptions, 'onStateChange' | 'now'>> = {
  failureThreshold: 5,
  failureWindowMs: 10_000,
  openMs: 30_000,
  reopenMs: 60_000
}

const registry = new Map<string, ReturnType<typeof createCircuitBreaker>>()

function createCircuitBreaker(name: string, options: CircuitBreakerOptions = {}) {
  const cfg = { ...DEFAULTS, ...options }
  const now = options.now ?? (() => Date.now())
  const failures: number[] = []
  const state = ref<CircuitState>('closed')
  const openedAt = ref<number | null>(null)

  const transition = (next: CircuitState) => {
    if (state.value === next) return
    state.value = next
    options.onStateChange?.(name, next)
  }

  const pruneWindow = (t: number) => {
    const cutoff = t - cfg.failureWindowMs
    while (failures.length && failures[0] < cutoff) failures.shift()
  }

  const maybeClose = (t: number) => {
    if (state.value === 'open' && openedAt.value !== null && t - openedAt.value >= cfg.openMs) {
      transition('half-open')
    }
  }

  const recordFailure = () => {
    const t = now()
    failures.push(t)
    pruneWindow(t)
    if (state.value === 'half-open') {
      openedAt.value = t
      transition('open')
      // failed probe extends the open window
      openedAt.value = t - (cfg.openMs - cfg.reopenMs)
      return
    }
    if (state.value === 'closed' && failures.length >= cfg.failureThreshold) {
      openedAt.value = t
      transition('open')
    }
  }

  const recordSuccess = () => {
    failures.length = 0
    openedAt.value = null
    if (state.value !== 'closed') transition('closed')
  }

  const canPass = (): boolean => {
    const t = now()
    maybeClose(t)
    return state.value !== 'open'
  }

  const execute = async <T>(task: () => Promise<T> | T): Promise<T> => {
    if (!canPass()) {
      throw new CircuitOpenError(name)
    }
    try {
      const result = await task()
      recordSuccess()
      return result
    } catch (err) {
      recordFailure()
      throw err
    }
  }

  return {
    name,
    state: computed(() => state.value),
    isOpen: computed(() => state.value === 'open'),
    canPass,
    execute,
    recordFailure,
    recordSuccess,
    reset() {
      failures.length = 0
      openedAt.value = null
      transition('closed')
    }
  }
}

type CircuitBreaker = ReturnType<typeof createCircuitBreaker>

/**
 * Returns the shared breaker for a service name (singleton per name).
 * Use this from composables and services to share state across call sites.
 */
export function useCircuitBreaker(serviceName: string, options?: CircuitBreakerOptions): CircuitBreaker {
  let breaker = registry.get(serviceName)
  if (!breaker) {
    breaker = createCircuitBreaker(serviceName, options)
    registry.set(serviceName, breaker)
  }
  return breaker
}

export function __resetCircuitBreakersForTest(): void {
  registry.clear()
}
