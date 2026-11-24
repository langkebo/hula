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
  /**
   * 是否还有"已发出但未完成"的写请求（同步读取）。
   *
   * 自动保存表单（如账号资料）不注册脏状态，`hasDirty()` 恒为 false。
   * 少了这个判断，用户改完输入框直接 Cmd+W 时 blur 还没触发、写请求没发出就放行关窗。
   */
  hasPending?: () => boolean
  /**
   * 把在飞写请求刷完（会**触发 blur 保存**，因此内部含一次 `activeElement.blur()`）。
   *
   * 时序不变量：必须在 `hasDirty()` 重新判定**之前**执行 —— blur 保存成功后脏状态才消失，
   * 顺序颠倒会出现"刚保存完却又弹确认框"或"该弹不弹"。
   */
  flushPending?: () => Promise<void>
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
 * 三个必须踩准的时序点：
 * 1. `event.preventDefault()` 必须在**任何 await 之前**同步调用。handler 是异步的，
 *    一旦先 await，Tauri 已经放行关闭，再 preventDefault 也来不及。
 * 2. 用户确认关闭后走 `destroy()` 而不是 `close()`。`close()` 会再次触发
 *    CloseRequested，把守卫重入一次（表现为"点了两次才关掉"或死循环）。
 * 3. `flushPending()` 必须在 `hasDirty()` 重判之前。自动保存表单的脏状态要靠 blur
 *    写成功才清掉，顺序颠倒会让"刚存完又弹确认框"（或该弹不弹）。
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
        // 快路径：既没有脏状态也没有在飞写请求 —— 真的没东西要保，直接放行。
        // 这里绝不能 preventDefault，否则每次关窗都会多绕一圈异步。
        if (!options.hasDirty() && !options.hasPending?.()) return

        event.preventDefault()

        void (async () => {
          // 先 flush：blur 保存可能让脏状态消失，因此必须排在 hasDirty() 重判之前。
          await options.flushPending?.()

          // 刷新后已经无脏值（blur 自动保存成功）→ 无需确认，直接关。
          if (!options.hasDirty()) {
            await appWindow.destroy()
            return
          }

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
