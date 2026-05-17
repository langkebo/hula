import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import MessageEditor from '../MessageEditor.vue'

const { editMessageMock, showFeedbackMock, loggerErrorMock } = vi.hoisted(() => ({
  editMessageMock: vi.fn(),
  showFeedbackMock: vi.fn(),
  loggerErrorMock: vi.fn()
}))

vi.mock('@vueuse/core', () => ({
  useDebounceFn: (fn: (...args: unknown[]) => unknown) => fn
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({
    showFeedback: showFeedbackMock
  })
}))

vi.mock('@/services/matrix/messaging/MatrixMessageRelationService', () => ({
  matrixMessageRelationService: {
    editMessage: editMessageMock
  }
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    error: loggerErrorMock
  })
}))

vi.mock('naive-ui', async () => {
  const { defineComponent, h } = await import('vue')

  return {
    NButton: defineComponent({
      name: 'NButton',
      emits: ['click'],
      setup(_, { slots, emit }) {
        return () =>
          h(
            'button',
            {
              type: 'button',
              onClick: () => emit('click')
            },
            slots.default?.()
          )
      }
    }),
    NInput: defineComponent({
      name: 'NInput',
      props: {
        value: {
          type: String,
          default: ''
        }
      },
      emits: ['update:value', 'keydown.enter', 'keydown.esc'],
      setup(props, { emit }) {
        return () =>
          h('textarea', {
            value: props.value,
            onInput: (event: Event) => emit('update:value', (event.target as HTMLTextAreaElement).value)
          })
      }
    })
  }
})

const mountEditor = () =>
  mount(MessageEditor, {
    props: {
      visible: true,
      roomId: '!room:example.com',
      eventId: '$event',
      originalContent: 'original'
    }
  })

describe('MessageEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    editMessageMock.mockResolvedValue('$edited')
  })

  it('uses action feedback for edit success', async () => {
    const wrapper = mountEditor()

    ;(wrapper.vm as unknown as { editContent: string }).editContent = 'updated content'
    await nextTick()
    await (wrapper.vm as unknown as { handleSave: () => Promise<void> }).handleSave()
    await flushPromises()

    expect(editMessageMock).toHaveBeenCalledWith('!room:example.com', '$event', {
      body: 'updated content'
    })
    expect(showFeedbackMock).toHaveBeenCalledWith('message.edit_success', 'success')
    expect(wrapper.emitted('saved')).toEqual([['$edited']])
    expect(wrapper.emitted('update:visible')).toEqual([[false]])
  })

  it('uses action feedback for edit failure', async () => {
    editMessageMock.mockRejectedValueOnce(new Error('edit failed'))
    const wrapper = mountEditor()

    ;(wrapper.vm as unknown as { editContent: string }).editContent = 'updated content'
    await nextTick()
    await (wrapper.vm as unknown as { handleSave: () => Promise<void> }).handleSave()
    await flushPromises()

    expect(loggerErrorMock).toHaveBeenCalled()
    expect(showFeedbackMock).toHaveBeenCalledWith('message.edit_failed', 'error')
  })
})
