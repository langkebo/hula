import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineAsyncComponent, defineComponent, h, KeepAlive, ref } from 'vue'

// N-2 反馈回路：验证 <keep-alive> + <AsyncComponent v-if> 模式不会抛出
// "parentComponent.ctx.deactivate is not a function" 错误。
//
// 根因：layout/index.vue 中 <keep-alive><AsyncRight v-if="!shrinkStatus" /></keep-alive>
// 当 shrinkStatus 从 false 变为 true 时，v-if 移除组件，Vue 试图调用 deactivate
// 但 defineAsyncComponent 包装器的上下文中缺少 deactivate 函数。
//
// 错误以 unhandledrejection 形式出现，需监听该事件捕获。

describe('N-2: <keep-alive> + <AsyncComponent v-if> 模式', () => {
  /**
   * 收集 unhandledrejection 和 console.error 中的 deactivate 错误
   */
  function collectDeactivateErrors(): () => string[] {
    const errors: string[] = []

    const onRejection = (event: PromiseRejectionEvent) => {
      const msg = String(event.reason?.message ?? event.reason ?? '')
      if (msg.includes('deactivate') || msg.includes('is not a function')) {
        errors.push(msg)
      }
    }
    window.addEventListener('unhandledrejection', onRejection)

    // biome-ignore lint/suspicious/noConsole: 测试需捕获 console.error 验证 deactivate 错误
    const originalError = console.error
    console.error = (...args: unknown[]) => {
      const msg = String(args[0] ?? '')
      if (msg.includes('deactivate') || msg.includes('is not a function')) {
        errors.push(msg)
      }
    }

    return () => {
      window.removeEventListener('unhandledrejection', onRejection)
      console.error = originalError
      return errors
    }
  }

  it('复现：keep-alive + async v-if toggle 多次后应无 deactivate 错误', async () => {
    const stopCollecting = collectDeactivateErrors()

    const ChildComponent = defineComponent({
      name: 'TestChild',
      setup() {
        return () => h('div', { class: 'test-child' }, 'Child Content')
      }
    })

    // 模拟 layout/index.vue 中的 defineAsyncComponent
    const AsyncChild = defineAsyncComponent({
      loader: async () => {
        // 模拟异步加载延迟
        await new Promise((resolve) => setTimeout(resolve, 10))
        return ChildComponent
      }
    })

    // 复现 layout/index.vue 中的问题模式：<keep-alive><AsyncComp v-if /></keep-alive>
    const Parent = defineComponent({
      components: { AsyncChild },
      setup() {
        const show = ref(true)
        const toggle = () => {
          show.value = !show.value
        }
        return { show, toggle }
      },
      render() {
        return h('div', [
          h('button', { onClick: this.toggle, class: 'toggle-btn' }, 'Toggle'),
          h(KeepAlive, () => (this.show ? h(AsyncChild) : null))
        ])
      }
    })

    const wrapper = mount(Parent)

    // 等待异步组件加载完成
    await new Promise((resolve) => setTimeout(resolve, 200))
    await wrapper.vm.$nextTick()

    // 确认子组件已渲染
    expect(wrapper.find('.test-child').exists()).toBe(true)

    // 快速多次切换 v-if — 触发 activate/deactivate 循环
    for (let i = 0; i < 5; i++) {
      await wrapper.find('.toggle-btn').trigger('click')
      await wrapper.vm.$nextTick()
      await new Promise((resolve) => setTimeout(resolve, 50))
      await wrapper.find('.toggle-btn').trigger('click')
      await wrapper.vm.$nextTick()
      await new Promise((resolve) => setTimeout(resolve, 50))
    }

    // 等待所有微任务/Promise 完成
    await new Promise((resolve) => setTimeout(resolve, 200))

    const errors = stopCollecting()
    expect(errors).toEqual([])
  })

  it('修复验证：不使用 keep-alive 的 AsyncComponent v-if 模式应正常工作', async () => {
    const stopCollecting = collectDeactivateErrors()

    const ChildComponent = defineComponent({
      name: 'TestChildFixed',
      setup() {
        return () => h('div', { class: 'test-child-fixed' }, 'Child Content Fixed')
      }
    })

    const AsyncChild = defineAsyncComponent({
      loader: async () => {
        await new Promise((resolve) => setTimeout(resolve, 10))
        return ChildComponent
      }
    })

    // 修复后的模式：移除 <keep-alive>，直接使用 v-if
    const Parent = defineComponent({
      components: { AsyncChild },
      setup() {
        const show = ref(true)
        const toggle = () => {
          show.value = !show.value
        }
        return { show, toggle }
      },
      render() {
        return h('div', [
          h('button', { onClick: this.toggle, class: 'toggle-btn-fixed' }, 'Toggle'),
          this.show ? h(AsyncChild) : null
        ])
      }
    })

    const wrapper = mount(Parent)

    await new Promise((resolve) => setTimeout(resolve, 200))
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.test-child-fixed').exists()).toBe(true)

    for (let i = 0; i < 5; i++) {
      await wrapper.find('.toggle-btn-fixed').trigger('click')
      await wrapper.vm.$nextTick()
      await new Promise((resolve) => setTimeout(resolve, 50))
      await wrapper.find('.toggle-btn-fixed').trigger('click')
      await wrapper.vm.$nextTick()
      await new Promise((resolve) => setTimeout(resolve, 50))
    }

    await new Promise((resolve) => setTimeout(resolve, 200))

    const errors = stopCollecting()
    expect(errors).toEqual([])
  })
})
