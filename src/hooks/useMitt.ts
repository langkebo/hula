import type { Emitter, Handler } from 'mitt'
import mitt from 'mitt'
import type { MittEnum } from '@/enums'

const mittInstance: Emitter<Record<string, unknown>> = mitt()

export const useMitt = {
  on: <T = unknown>(event: MittEnum | string, handler: Handler<T>) => {
    mittInstance.on(event, handler as Handler<unknown>)
    if (getCurrentScope()) {
      onUnmounted(() => {
        mittInstance.off(event, handler as Handler<unknown>)
      })
    }
  },
  emit: <T = unknown>(event: MittEnum | string, data?: T) => {
    mittInstance.emit(event, data)
  },
  off: <T = unknown>(event: MittEnum | string, handler: Handler<T>) => {
    mittInstance.off(event, handler as Handler<unknown>)
  }
}
