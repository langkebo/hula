import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { createI18nMock } from '~/tests/i18n-messages'
import FileUploadModal from '../FileUploadModal.vue'

vi.mock('vue-i18n', () => createI18nMock())

const files = [
  { kind: 'path' as const, path: '/tmp/a/report.pdf', name: 'report.pdf', size: 1024, type: 'application/pdf' },
  { kind: 'path' as const, path: '/tmp/b/report.pdf', name: 'report.pdf', size: 2048, type: 'application/pdf' }
]

const mountComponent = (overrides: Record<string, unknown> = {}) =>
  mount(FileUploadModal, {
    props: {
      show: true,
      files,
      ...overrides
    },
    global: {
      stubs: {
        Modal: { template: '<div><slot /></div>' },
        Button: {
          name: 'Button',
          props: ['disabled', 'loading'],
          emits: ['click'],
          template: '<button type="button" :disabled="disabled" @click="$emit(\'click\')"><slot /></button>'
        }
      }
    }
  })

describe('FileUploadModal', () => {
  it('渲染同名但路径不同的文件时保持两条列表项', () => {
    const wrapper = mountComponent()

    expect(wrapper.findAll('.flex-y-center')).toHaveLength(2)
    expect(wrapper.text()).toContain('1 KB')
    expect(wrapper.text()).toContain('2 KB')
  })

  it('确认后立即透传文件并进入发送锁，重复点击不重复触发', async () => {
    const wrapper = mountComponent()
    const buttons = wrapper.findAllComponents({ name: 'Button' })
    const sendButton = buttons[buttons.length - 1]

    await sendButton.trigger('click')
    await sendButton.trigger('click')

    expect(wrapper.emitted('confirm')).toHaveLength(1)
    expect(wrapper.emitted('confirm')?.[0]).toEqual([files])
    expect(wrapper.emitted('update:show')?.[0]).toEqual([false])
  })
})
