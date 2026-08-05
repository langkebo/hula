// Minimal EventEmitter for browser environment.
// 避免导入 node:events（Vite 在浏览器环境会 externalize Node 内建模块），
// 也避免循环依赖（曾将 node:events 别名指向本文件导致 Cannot access before initialization）。
// 仅覆盖项目实际使用的 API：on/off/once/emit/removeAllListeners/listenerCount + 静态 once。

type Listener = (...args: unknown[]) => void

class EventEmitter {
  private _events: Record<string, Listener[] | undefined> = {}

  on(event: string, listener: Listener): this {
    const list = this._events[event] ?? []
    list.push(listener)
    this._events[event] = list
    return this
  }

  addListener(event: string, listener: Listener): this {
    return this.on(event, listener)
  }

  off(event: string, listener: Listener): this {
    const list = this._events[event]
    if (list) {
      const idx = list.indexOf(listener)
      if (idx >= 0) list.splice(idx, 1)
      if (list.length === 0) delete this._events[event]
    }
    return this
  }

  removeListener(event: string, listener: Listener): this {
    return this.off(event, listener)
  }

  once(event: string, listener: Listener): this {
    const wrapper: Listener = (...args: unknown[]) => {
      this.off(event, wrapper)
      listener(...args)
    }
    return this.on(event, wrapper)
  }

  emit(event: string, ...args: unknown[]): boolean {
    const list = this._events[event]
    if (!list || list.length === 0) return false
    for (const listener of [...list]) {
      listener(...args)
    }
    return true
  }

  removeAllListeners(event?: string): this {
    if (event) delete this._events[event]
    else this._events = {}
    return this
  }

  listenerCount(event: string): number {
    return this._events[event]?.length ?? 0
  }

  setMaxListeners(_n: number): this {
    return this
  }

  static once(emitter: EventEmitter, event: string): Promise<unknown[]> {
    return new Promise((resolve) => {
      const listener: Listener = (...args: unknown[]) => resolve(args)
      emitter.once(event, listener)
    })
  }
}

const once = EventEmitter.once.bind(EventEmitter)

export { EventEmitter, once }
export default EventEmitter
