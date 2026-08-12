import type { Emitter, Handler } from 'mitt'
import mitt from 'mitt'
import type { MittEnum } from '@/enums'

const mittInstance: Emitter<Record<string, unknown>> = mitt()

export const useMitt = {
  /**
   * Register a mitt event handler.
   *
   * When called during a component setup (synchronous), the handler is
   * automatically removed on unmount. When called outside setup (e.g. after
   * `await` in onMounted, or in a plain .ts file) the caller MUST use the
   * returned cleanup function to avoid leaks.
   *
   * Note: `getCurrentInstance()` (not `getCurrentScope()`) is used because
   * the effect scope persists after `await` in onMounted, but the component
   * instance does not — `onUnmounted` would silently no-op and leak.
   *
   * @returns cleanup function that removes the handler
   */
  on: <T = unknown>(event: MittEnum | string, handler: Handler<T>): (() => void) => {
    mittInstance.on(event, handler as Handler<unknown>)
    const cleanup = () => mittInstance.off(event, handler as Handler<unknown>)
    if (getCurrentInstance()) {
      onUnmounted(cleanup)
    }
    return cleanup
  },
  emit: <T = unknown>(event: MittEnum | string, data?: T) => {
    mittInstance.emit(event, data)
  },
  off: <T = unknown>(event: MittEnum | string, handler: Handler<T>) => {
    mittInstance.off(event, handler as Handler<unknown>)
  }
}
