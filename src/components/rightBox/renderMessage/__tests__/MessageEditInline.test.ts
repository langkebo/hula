import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import MessageEditInline from '../MessageEditInline.vue'

const { editMessageMock, showFeedbackMock, loggerErrorMock } = vi.hoisted(() => ({
  editMessageMock: vi.fn(),
  showFeedbackMock: vi.fn(),
  loggerErrorMock: vi.fn()
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

const mountInline = (overrides: Partial<{ visible: boolean; originalContent: string }> = {}) =>
  mount(MessageEditInline, {
    props: {
      visible: true,
      roomId: '!room:example.com',
      eventId: '$event',
      originalContent: 'original text',
      ...overrides
    }
  })

describe('MessageEditInline', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    editMessageMock.mockResolvedValue('$edited')
  })

  it('does not render when visible=false', () => {
    const wrapper = mountInline({ visible: false })
    expect(wrapper.find('[data-test="edit-inline"]').exists()).toBe(false)
  })

  it('renders textarea and action buttons when visible=true', () => {
    const wrapper = mountInline()
    expect(wrapper.find('[data-test="edit-inline"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="edit-inline-textarea"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="edit-inline-save"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="edit-inline-cancel"]').exists()).toBe(true)
  })

  it('initializes textarea with originalContent', () => {
    const wrapper = mountInline({ originalContent: 'hello world' })
    const textarea = wrapper.find('[data-test="edit-inline-textarea"]').element as HTMLTextAreaElement
    expect(textarea.value).toBe('hello world')
  })

  it('emits update:visible=false and cancel when clicking cancel', async () => {
    const wrapper = mountInline()
    await wrapper.find('[data-test="edit-inline-cancel"]').trigger('click')
    expect(wrapper.emitted('update:visible')![0]).toEqual([false])
    expect(wrapper.emitted('cancel')).toBeTruthy()
  })

  it('Esc key triggers cancel', async () => {
    const wrapper = mountInline()
    await wrapper.find('[data-test="edit-inline-textarea"]').trigger('keydown.esc')
    expect(wrapper.emitted('update:visible')![0]).toEqual([false])
    expect(wrapper.emitted('cancel')).toBeTruthy()
  })

  it('Enter key submits (without shift)', async () => {
    const wrapper = mountInline()
    const vm = wrapper.vm as unknown as { editContent: string }
    vm.editContent = 'updated'
    await nextTick()
    await wrapper.find('[data-test="edit-inline-textarea"]').trigger('keydown.enter', { shiftKey: false })
    await flushPromises()
    expect(editMessageMock).toHaveBeenCalledWith('!room:example.com', '$event', { body: 'updated' })
  })

  it('Shift+Enter inserts newline (does not submit)', async () => {
    const wrapper = mountInline()
    const vm = wrapper.vm as unknown as { editContent: string }
    vm.editContent = 'updated'
    await nextTick()
    await wrapper.find('[data-test="edit-inline-textarea"]').trigger('keydown.enter', { shiftKey: true })
    expect(editMessageMock).not.toHaveBeenCalled()
  })

  it('Save button calls editMessage and emits saved', async () => {
    const wrapper = mountInline()
    const vm = wrapper.vm as unknown as { editContent: string }
    vm.editContent = 'updated content'
    await nextTick()
    await wrapper.find('[data-test="edit-inline-save"]').trigger('click')
    await flushPromises()
    expect(editMessageMock).toHaveBeenCalledWith('!room:example.com', '$event', { body: 'updated content' })
    expect(showFeedbackMock).toHaveBeenCalledWith('message.edit_success', 'success')
    expect(wrapper.emitted('saved')).toEqual([['$edited']])
    expect(wrapper.emitted('update:visible')![0]).toEqual([false])
  })

  it('shows error feedback when edit fails', async () => {
    editMessageMock.mockRejectedValueOnce(new Error('edit failed'))
    const wrapper = mountInline()
    const vm = wrapper.vm as unknown as { editContent: string }
    vm.editContent = 'updated'
    await nextTick()
    await wrapper.find('[data-test="edit-inline-save"]').trigger('click')
    await flushPromises()
    expect(loggerErrorMock).toHaveBeenCalled()
    expect(showFeedbackMock).toHaveBeenCalledWith('message.edit_failed', 'error')
    // dialog stays open on failure
    expect(wrapper.emitted('update:visible')).toBeFalsy()
  })

  it('does not submit when content is empty or unchanged', async () => {
    const wrapper = mountInline({ originalContent: 'same' })
    const vm = wrapper.vm as unknown as { editContent: string; handleSubmit: () => Promise<void> }
    // unchanged
    vm.editContent = 'same'
    await nextTick()
    await vm.handleSubmit()
    expect(editMessageMock).not.toHaveBeenCalled()
    expect(wrapper.emitted('update:visible')![0]).toEqual([false])
  })
})
