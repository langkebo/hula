export class MatrixClientEventDispatcher {
  private readonly listeners = new Map<string, Set<(...args: unknown[]) => void>>()

  on(event: string, callback: (...args: unknown[]) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(callback)
  }

  off(event: string, callback: (...args: unknown[]) => void): void {
    this.listeners.get(event)?.delete(callback)
  }

  emit(event: string, ...data: unknown[]): void {
    const callbacks = this.listeners.get(event)
    if (!callbacks) {
      return
    }

    for (const callback of callbacks) {
      callback(...data)
    }
  }
}
