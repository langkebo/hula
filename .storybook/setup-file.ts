import { vi } from 'vitest'

vi.mock('debug', () => {
  const debugFn = (..._args: unknown[]) => {}
  return {
    default: Object.assign(debugFn, {
      enabled: false,
      namespace: '',
      log: (..._args: unknown[]) => {}
    })
  }
})
