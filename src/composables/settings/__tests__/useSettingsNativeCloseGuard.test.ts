import { describe, expect, it, vi } from 'vitest'
import { effectScope, ref } from 'vue'
import { type SettingsCloseGuardWindow, useSettingsNativeCloseGuard } from '../useSettingsNativeCloseGuard'

interface Harness {
  win: SettingsCloseGuardWindow
  off: ReturnType<typeof vi.fn>
  fire: (event: { preventDefault: () => void }) => void
}

function createHarness(): Harness {
  let handler: ((event: { preventDefault: () => void }) => void) | undefined
  const off = vi.fn()
  const win: SettingsCloseGuardWindow = {
    onCloseRequested: vi.fn(async (h: (event: { preventDefault: () => void }) => void) => {
      handler = h
      return off
    }),
    destroy: vi.fn(async () => undefined)
  }
  return {
    win,
    off,
    fire: (event) => handler?.(event)
  }
}

/** 排空微任务队列，让异步注册与 handler 内部的 async IIFE 跑完。 */
async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

describe('useSettingsNativeCloseGuard', () => {
  it('无脏值时完全放行原生关闭（不 preventDefault、不 destroy）', async () => {
    const { win, fire } = createHarness()
    const scope = effectScope()
    scope.run(() =>
      useSettingsNativeCloseGuard({
        enabled: true,
        hasDirty: () => false,
        confirm: vi.fn(async () => true),
        resolveWindow: () => win
      })
    )
    await flush()

    const preventDefault = vi.fn()
    fire({ preventDefault })
    await flush()

    expect(preventDefault).not.toHaveBeenCalled()
    expect(win.destroy).not.toHaveBeenCalled()
    scope.stop()
  })

  it('有脏值时先同步 preventDefault，确认通过后 destroy', async () => {
    const order: string[] = []
    const { win, fire } = createHarness()
    win.destroy = vi.fn(async () => {
      order.push('destroy')
    })

    const scope = effectScope()
    scope.run(() =>
      useSettingsNativeCloseGuard({
        enabled: true,
        hasDirty: () => true,
        confirm: async () => {
          order.push('confirm')
          return true
        },
        onConfirmed: () => order.push('onConfirmed'),
        resolveWindow: () => win
      })
    )
    await flush()

    fire({ preventDefault: () => order.push('preventDefault') })
    await flush()

    // 顺序是关键断言：preventDefault 必须先于任何 await 发生，
    // 否则 Tauri 已经放行关闭，再拦也来不及。
    expect(order).toEqual(['preventDefault', 'confirm', 'onConfirmed', 'destroy'])
    scope.stop()
  })

  it('用户取消确认时不 destroy，窗口保持打开', async () => {
    const { win, fire } = createHarness()
    const onConfirmed = vi.fn()
    const scope = effectScope()
    scope.run(() =>
      useSettingsNativeCloseGuard({
        enabled: true,
        hasDirty: () => true,
        confirm: async () => false,
        onConfirmed,
        resolveWindow: () => win
      })
    )
    await flush()

    const preventDefault = vi.fn()
    fire({ preventDefault })
    await flush()

    expect(preventDefault).toHaveBeenCalledTimes(1)
    expect(onConfirmed).not.toHaveBeenCalled()
    expect(win.destroy).not.toHaveBeenCalled()
    scope.stop()
  })

  it('enabled 为 false（嵌入式设置页）时不注册监听', async () => {
    const { win } = createHarness()
    const scope = effectScope()
    scope.run(() =>
      useSettingsNativeCloseGuard({
        enabled: false,
        hasDirty: () => true,
        confirm: vi.fn(async () => true),
        resolveWindow: () => win
      })
    )
    await flush()

    expect(win.onCloseRequested).not.toHaveBeenCalled()
    scope.stop()
  })

  it('resolveWindow 返回 null（浏览器环境）时不注册、不抛错', async () => {
    const scope = effectScope()
    expect(() =>
      scope.run(() =>
        useSettingsNativeCloseGuard({
          enabled: true,
          hasDirty: () => true,
          confirm: vi.fn(async () => true),
          resolveWindow: () => null
        })
      )
    ).not.toThrow()
    await flush()
    scope.stop()
  })

  it('enabled 由 false 翻成 true 时补注册（standalone 判定晚于子组件 setup）', async () => {
    // 这是真机上会出现的情形：设置窗口壳层在 onMounted 里才判定 standalone，
    // 子组件 setup 早于它，首次读到必为 false。只读一次 = 守卫永不注册且不报错。
    const { win } = createHarness()
    const enabled = ref(false)
    const scope = effectScope()
    scope.run(() =>
      useSettingsNativeCloseGuard({
        enabled,
        hasDirty: () => true,
        confirm: async () => true,
        resolveWindow: () => win
      })
    )
    await flush()
    expect(win.onCloseRequested).not.toHaveBeenCalled()

    enabled.value = true
    await flush()
    expect(win.onCloseRequested).toHaveBeenCalledTimes(1)
    scope.stop()
  })

  it('enabled 翻回 false 时注销监听', async () => {
    const { win, off } = createHarness()
    const enabled = ref(true)
    const scope = effectScope()
    scope.run(() =>
      useSettingsNativeCloseGuard({
        enabled,
        hasDirty: () => true,
        confirm: async () => true,
        resolveWindow: () => win
      })
    )
    await flush()

    enabled.value = false
    await flush()

    expect(off).toHaveBeenCalled()
    scope.stop()
  })

  it('作用域销毁时注销监听（异步注册晚到也不泄漏）', async () => {
    const { win, off } = createHarness()
    const scope = effectScope()
    scope.run(() =>
      useSettingsNativeCloseGuard({
        enabled: true,
        hasDirty: () => true,
        confirm: vi.fn(async () => true),
        resolveWindow: () => win
      })
    )
    scope.stop()
    await flush()

    expect(off).toHaveBeenCalledTimes(1)
  })

  describe('自动保存表单的在飞写请求（hasPending / flushPending）', () => {
    it('无脏值但有 pending → 仍 preventDefault，flush 后无脏值直接 destroy（不弹确认框）', async () => {
      const order: string[] = []
      const { win, fire } = createHarness()
      win.destroy = vi.fn(async () => {
        order.push('destroy')
      })
      const confirm = vi.fn(async () => {
        order.push('confirm')
        return true
      })

      const scope = effectScope()
      scope.run(() =>
        useSettingsNativeCloseGuard({
          enabled: true,
          hasDirty: () => false,
          hasPending: () => true,
          flushPending: async () => {
            order.push('flush')
          },
          confirm,
          resolveWindow: () => win
        })
      )
      await flush()

      fire({ preventDefault: () => order.push('preventDefault') })
      await flush()

      // flush 必须发生，且自动保存成功后不应再烦用户
      expect(order).toEqual(['preventDefault', 'flush', 'destroy'])
      expect(confirm).not.toHaveBeenCalled()
      scope.stop()
    })

    it('无脏值且无 pending → 快路径不 preventDefault（守卫不能给所有关窗加成本）', async () => {
      const { win, fire } = createHarness()
      const flushPending = vi.fn(async () => undefined)

      const scope = effectScope()
      scope.run(() =>
        useSettingsNativeCloseGuard({
          enabled: true,
          hasDirty: () => false,
          hasPending: () => false,
          flushPending,
          confirm: vi.fn(async () => true),
          resolveWindow: () => win
        })
      )
      await flush()

      const preventDefault = vi.fn()
      fire({ preventDefault })
      await flush()

      expect(preventDefault).not.toHaveBeenCalled()
      expect(flushPending).not.toHaveBeenCalled()
      expect(win.destroy).not.toHaveBeenCalled()
      scope.stop()
    })

    it('flushPending 必须先于 hasDirty 重判：flush 期间才变脏时走 confirm 分支', async () => {
      // 锁住时序不变量。若把 flushPending 挪到 hasDirty() 之后，
      // 这里的 hasDirty() 会先读到 false → 直接 destroy，order 里不会出现 'confirm'。
      const order: string[] = []
      let dirty = false
      const { win, fire } = createHarness()
      win.destroy = vi.fn(async () => {
        order.push('destroy')
      })

      const scope = effectScope()
      scope.run(() =>
        useSettingsNativeCloseGuard({
          enabled: true,
          hasDirty: () => dirty,
          hasPending: () => true,
          flushPending: async () => {
            order.push('flush')
            // 模拟"非自动保存字段在 flush 期间被标记为脏"
            dirty = true
          },
          confirm: async () => {
            order.push('confirm')
            return true
          },
          onConfirmed: () => order.push('onConfirmed'),
          resolveWindow: () => win
        })
      )
      await flush()

      fire({ preventDefault: () => order.push('preventDefault') })
      await flush()

      expect(order).toEqual(['preventDefault', 'flush', 'confirm', 'onConfirmed', 'destroy'])
      scope.stop()
    })
  })
})
