import { type Ref, ref } from 'vue'

export interface ActionState<T = unknown> {
  loading: Ref<boolean>
  error: Ref<string | null>
  execute: (...args: unknown[]) => Promise<T | undefined>
}

export interface UseActionOptions {
  /** Error message to show on failure (default: generic error). */
  errorMessage?: string
  /** Callback on success. Receives the return value of the action. */
  onSuccess?: (result: unknown) => void
  /** Callback on error. Receives the caught error. */
  onError?: (err: unknown) => void
}

/**
 * Shared action wrapper — a consistent loading/error boundary for
 * composables that orchestrate service calls.
 *
 * **Pattern rule (Candidate #5):**
 * - Stores own **state + invariants** (pure mutations, no service imports).
 * - Composables own **orchestration + error handling** — they call services
 *   and write results into stores.
 * - `useAction` is the single loading/error boundary reused by all composables.
 */
export function useAction<T>(fn: (...args: unknown[]) => Promise<T>, options: UseActionOptions = {}): ActionState<T> {
  const loading = ref(false)
  const error = ref<string | null>(null)

  const execute = async (...args: unknown[]): Promise<T | undefined> => {
    loading.value = true
    error.value = null
    try {
      const result = await fn(...args)
      options.onSuccess?.(result)
      return result
    } catch (err: unknown) {
      const msg = options.errorMessage ?? (err instanceof Error ? err.message : String(err))
      error.value = msg
      options.onError?.(err)
      return undefined
    } finally {
      loading.value = false
    }
  }

  return { loading, error, execute }
}
