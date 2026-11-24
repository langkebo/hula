import { type MaybeRefOrGetter, onScopeDispose, toValue, watch } from 'vue'

/** 最小窗口契约：只依赖这里真正用到的两个方法，便于单测注入替身。 */
export interface SettingsCloseGuardWindow {
  onCloseRequested: (handler: (event: { preventDefault: () => void }) => void) => Promise<() => void>
  destroy: () => Promise<void>
}

export interface SettingsNativeCloseGuardOptions {
  /** 仅在独立设置窗口启用；嵌入式设置页由 `onBeforeRouteLeave` 负责。 */
  enabled: MaybeRefOrGetter<boolean>
  /** 是否还有未保存的更改（同步读取，不能 await）。 */
  hasDirty: () => boolean
  /** 弹确认框，返回 true 表示允许关闭。 */
  confirm: () => Promise<boolean>
  /** 确认关闭后清理脏状态，避免下次打开残留。 */
  onConfirmed?: () => void
  /** 注入窗口实现；默认由调用方传入当前 Tauri 窗口，浏览器环境传 null 即可。 */
  resolveWindow: () => SettingsCloseGuardWindow | null
}

/**
 * 独立设置窗口的原生关闭守卫。
 *
 * 为什么不能用 `window.beforeunload`：在 Tauri v2 里点窗口红灯 / Cmd+W 走的是
 * Rust 侧的 `WindowEvent::CloseRequested`，WebView 的 `beforeunload` 只能拦浏览器导航，
 * 拦不住原生关窗——这会让"未保存更改"确认在真实关窗路径上被完全绕过。
 *
 * 两个必须踩准的时序点：
 * 1. `event.preventDefault()` 必须在**任何 await 之前**同步调用。handler 是异步的，
 *    一旦先 await，Tauri 已经放行关闭，再 preventDefault 也来不及。
 * 2. 用户确认关闭后走 `destroy()` 而不是 `close()`。`close()` 会再次触发
 *    CloseRequested，把守卫重入一次（表现为"点了两次才关掉"或死循环）。
 */
export function useSettingsNativeCloseGuard(options: SettingsNativeCloseGuardOptions): void {
  let unlisten: (() => void) | undefined
  let registering = false
  let disposed = false

  function register() {
    if (registering || unlisten) return
    const appWindow = options.resolveWindow()
    if (!appWindow) return

    registering = true

    void appWindow
      .onCloseRequested((event) => {
        if (!options.hasDirty()) return

        event.preventDefault()

        void (async () => {
          const canClose = await options.confirm()
          if (!canClose) return
          options.onConfirmed?.()
          await appWindow.destroy()
        })()
      })
      .then((off) => {
        registering = false
        // 注册是异步的：期间组件可能已卸载或已切到禁用，此时立刻注销，避免监听泄漏。
        if (disposed || !toValue(options.enabled)) {
          off()
          return
        }
        unlisten = off
      })
  }

  function unregister() {
    unlisten?.()
    unlisten = undefined
  }

  // 必须 watch 而不是 setup 时读一次：`standalone` 由窗口层在 onMounted 里判定
  // （WebviewWindow.getCurrent().label），子组件的 setup 早于父组件的 onMounted，
  // 首次读到的一定是 false。只读一次 = 守卫永不注册，且没有任何报错。
  watch(
    () => Boolean(toValue(options.enabled)),
    (enabled) => {
      if (enabled) register()
      else unregister()
    },
    { immediate: true }
  )

  onScopeDispose(() => {
    disposed = true
    unregister()
  })
}
