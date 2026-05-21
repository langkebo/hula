import { onUnmounted } from 'vue'

type Target = EventTarget | Ref<EventTarget | null | undefined>

export function useEventListener<T extends Event = Event>(
  target: Target,
  event: string,
  handler: (event: T) => void,
  options?: boolean | AddEventListenerOptions
): () => void {
  const resolvedTarget = isRef(target) ? target.value : target

  const wrappedHandler = handler as EventListener

  if (resolvedTarget) {
    resolvedTarget.addEventListener(event, wrappedHandler, options)
  }

  const cleanup = () => {
    const t = isRef(target) ? target.value : resolvedTarget
    if (t) {
      t.removeEventListener(event, wrappedHandler, options)
    }
  }

  if (getCurrentScope()) {
    onUnmounted(cleanup)
  }

  return cleanup
}

function isRef<T>(val: T | Ref<T>): val is Ref<T> {
  return val !== null && typeof val === 'object' && 'value' in val
}

interface Ref<T> {
  value: T
}
