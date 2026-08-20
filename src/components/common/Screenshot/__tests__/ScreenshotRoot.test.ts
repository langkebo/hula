import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import ScreenshotRoot from '../ScreenshotRoot.vue'

vi.mock('@tauri-apps/api/event', () => ({ emitTo: vi.fn() }))
vi.mock('@tauri-apps/api/webviewWindow', () => ({
  WebviewWindow: {
    getCurrent: () => ({ label: 'screenshot', listen: vi.fn(), hide: vi.fn(), show: vi.fn() })
  }
}))
vi.mock('@tauri-apps/plugin-clipboard-manager', () => ({ writeImage: vi.fn() }))
vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>()
  return { ...actual, useI18n: () => ({ t: (k: string) => k }) }
})
vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback: vi.fn() })
}))
vi.mock('@/utils/AppHarness', () => ({ hasTauriRuntime: () => true }))
vi.mock('@/utils/Logger', () => ({ createLogger: () => ({ warn: vi.fn(), error: vi.fn() }) }))

vi.mock('@/components/common/Screenshot/composables/useDrawTools', () => ({
  useDrawTools: () => ({
    canUndo: ref(false),
    currentDrawTool: ref(''),
    initDrawTools: vi.fn(),
    drawImgCanvas: vi.fn(),
    handleRedo: vi.fn(),
    handleUndo: vi.fn(),
    resetDrawTools: vi.fn()
  })
}))
vi.mock('@/components/common/Screenshot/composables/useMaskSelection', () => ({
  useMaskSelection: () => ({
    redrawSelection: vi.fn(),
    handleMaskMouseDown: vi.fn(),
    handleMaskMouseMove: vi.fn(),
    handleMaskMouseUp: vi.fn(),
    clearMouseMoveThrottle: vi.fn()
  })
}))
vi.mock('@/components/common/Screenshot/composables/useScreenshotCanvas', () => ({
  useScreenshotCanvas: () => ({ initCanvas: vi.fn() })
}))
vi.mock('@/components/common/Screenshot/composables/useScreenshotExport', () => ({
  useScreenshotExport: () => ({ exportSelection: vi.fn(async () => null) })
}))
vi.mock('@/components/common/Screenshot/composables/useSelectionDragResize', () => ({
  useSelectionDragResize: () => ({
    isDragging: ref(false),
    isResizing: ref(false),
    handleSelectionDragStart: vi.fn(),
    handleResizeStart: vi.fn(),
    cleanup: vi.fn()
  })
}))

vi.mock('@/components/common/Screenshot/ScreenshotSelection.vue', () => ({
  default: defineComponent({
    name: 'ScreenshotSelection',
    setup: () => () => h('div', { 'data-test': 'screenshot-selection' })
  })
}))
vi.mock('@/components/common/Screenshot/ScreenshotMagnifier.vue', () => ({
  default: defineComponent({
    name: 'ScreenshotMagnifier',
    setup(_, { expose }) {
      expose({ handleMouseMove: vi.fn(), hideMagnifier: vi.fn(), initMagnifier: vi.fn() })
      return () => h('div', { 'data-test': 'screenshot-magnifier' })
    }
  })
}))
vi.mock('@/components/common/Screenshot/ScreenshotToolbar.vue', () => ({
  default: defineComponent({
    name: 'ScreenshotToolbar',
    setup(_, { expose }) {
      expose({ updatePosition: vi.fn() })
      return () => h('div', { 'data-test': 'screenshot-toolbar' })
    }
  })
}))

describe('ScreenshotRoot', () => {
  it('renders magnifier and toolbar as real child components (guards import-type regression)', async () => {
    const wrapper = mount(ScreenshotRoot)
    await flushPromises()

    // 放大镜与工具条必须以真实子组件形式渲染，而非因 `import type` 降级为未知 HTML 元素
    expect(wrapper.find('[data-test="screenshot-magnifier"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="screenshot-toolbar"]').exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'ScreenshotMagnifier' }).exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'ScreenshotToolbar' }).exists()).toBe(true)
  })
})
