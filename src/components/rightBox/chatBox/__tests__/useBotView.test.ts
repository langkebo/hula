import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, ref } from 'vue'
import { useBotView } from '../useBotView'

const { showFeedbackMock, openMock, fetchAssistantModelPresetsMock, setAssistantMock, loggerErrorMock } = vi.hoisted(
  () => ({
    showFeedbackMock: vi.fn(),
    openMock: vi.fn(),
    fetchAssistantModelPresetsMock: vi.fn(),
    setAssistantMock: vi.fn(),
    loggerErrorMock: vi.fn()
  })
)

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: openMock
}))

vi.mock('@tauri-apps/plugin-opener', () => ({
  openUrl: vi.fn()
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({
    showFeedback: showFeedbackMock
  })
}))

vi.mock('@/hooks/useAssistantModelPresets', () => ({
  useAssistantModelPresets: () => ({
    presets: ref([]),
    metaMap: ref({}),
    fetchAssistantModelPresets: fetchAssistantModelPresetsMock
  })
}))

vi.mock('@/stores/domains/user/bot', () => ({
  useBotStore: () => ({
    setAssistant: setAssistantMock,
    setWeb: vi.fn(),
    setReadme: vi.fn(),
    setMarkdown: vi.fn()
  })
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    error: loggerErrorMock,
    warn: vi.fn(),
    debug: vi.fn()
  })
}))

vi.mock('@/utils/PlatformConstants', () => ({
  isDesktop: () => true
}))

vi.mock('@/utils/TauriInvokeHandler', () => ({
  invokeWithErrorHandler: vi.fn()
}))

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: vi.fn()
}))

vi.mock('@tauri-apps/api/webview', () => ({
  Webview: {
    getByLabel: vi.fn()
  }
}))

vi.mock('@tauri-apps/api/dpi', () => ({
  LogicalPosition: class {},
  LogicalSize: class {}
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

const Harness = defineComponent({
  setup(_, { expose }) {
    const api = useBotView({
      startLoading: vi.fn(),
      finishLoading: vi.fn(),
      errorLoading: vi.fn()
    })

    expose(api)
    return () => null
  }
})

describe('useBotView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchAssistantModelPresetsMock.mockResolvedValue(undefined)
  })

  it('uses action feedback when selecting local model fails', async () => {
    openMock.mockRejectedValueOnce(new Error('dialog failed'))
    const wrapper = mount(Harness)

    await (wrapper.vm as unknown as { openLocalModel: () => Promise<void> }).openLocalModel()
    await flushPromises()

    expect(fetchAssistantModelPresetsMock).toHaveBeenCalled()
    expect(loggerErrorMock).toHaveBeenCalled()
    expect(showFeedbackMock).toHaveBeenCalledWith('ai_assistant.bot.select_model_failed', 'error')
  })
})
