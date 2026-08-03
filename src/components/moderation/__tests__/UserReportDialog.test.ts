import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import UserReportDialog from '../UserReportDialog.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

vi.mock('@iconify/vue', () => ({
  Icon: { name: 'Icon', template: '<span class="icon-stub" />' }
}))

const reportUserMock = vi.fn()
vi.mock('@/services/matrix/SynapseRustExtensionsService', () => ({
  synapseRustExtensionsService: {
    reportUser: (...args: unknown[]) => reportUserMock(...args)
  }
}))

const showFeedbackMock = vi.fn()
vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback: (...args: unknown[]) => showFeedbackMock(...args) })
}))

// Naive UI 组件注册名不带 N 前缀（NModal.name === 'Modal'），stub key 按注册名匹配
const naiveStubs = {
  Modal: {
    template: '<div class="n-modal-stub" v-if="show"><slot /><slot name="footer" /></div>',
    props: ['show']
  },
  Divider: { template: '<hr class="n-divider-stub" />' },
  Form: { template: '<form class="n-form-stub"><slot /></form>' },
  FormItem: { template: '<div class="n-form-item-stub"><slot /></div>', props: ['label'] },
  Select: {
    template:
      '<select class="n-select-stub" :disabled="disabled" :value="value" @change="$emit(\'update:value\', $event.target.value)"><option value="" disabled></option><option v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</option></select>',
    props: ['value', 'options', 'disabled', 'placeholder'],
    emits: ['update:value']
  },
  Input: {
    template: '<textarea class="n-input-stub" :value="value" @input="$emit(\'update:value\', $event.target.value)" />',
    props: ['value', 'rows', 'placeholder'],
    emits: ['update:value']
  },
  Button: {
    template:
      '<button class="n-button-stub" :disabled="disabled" @click="$emit(\'click\')"><slot /><slot name="icon" /></button>',
    props: ['disabled', 'loading', 'type'],
    emits: ['click']
  }
}

describe('UserReportDialog — 举报用户弹窗 (P0-2 MSC4260)', () => {
  beforeEach(() => {
    reportUserMock.mockReset()
    showFeedbackMock.mockReset()
  })

  const mountDialog = (props: Record<string, unknown> = {}) =>
    mount(UserReportDialog, {
      props: { show: true, userId: '@bad:hs', userDisplayName: 'Bad User', ...props },
      global: { stubs: naiveStubs }
    })

  it('show=true 时渲染弹窗', () => {
    const wrapper = mountDialog()
    expect(wrapper.find('.user-report-dialog').exists()).toBe(true)
  })

  it('显示被举报用户预览', () => {
    const wrapper = mountDialog({ userDisplayName: 'Bad User' })
    const preview = wrapper.find('.preview-content')
    expect(preview.text()).toContain('Bad User')
    expect(preview.text()).toContain('@bad:hs')
  })

  it('未选择 reason 时提交按钮禁用', () => {
    const wrapper = mountDialog()
    const submitBtn = wrapper.find('[data-testid="user-report-submit"]')
    expect(submitBtn.attributes('disabled')).toBeDefined()
  })

  it('选择 reason 后提交按钮启用', async () => {
    const wrapper = mountDialog()
    await wrapper.find('[data-testid="user-report-reason"]').setValue('spam')
    const submitBtn = wrapper.find('[data-testid="user-report-submit"]')
    expect(submitBtn.attributes('disabled')).toBeUndefined()
  })

  it('提交时调用 synapseRustExtensionsService.reportUser 并 emit reported', async () => {
    reportUserMock.mockResolvedValueOnce(undefined)
    const wrapper = mountDialog()
    await wrapper.find('[data-testid="user-report-reason"]').setValue('abuse')
    await wrapper.find('[data-testid="user-report-submit"]').trigger('click')
    await Promise.resolve()
    await wrapper.vm.$nextTick()

    expect(reportUserMock).toHaveBeenCalledTimes(1)
    expect(reportUserMock).toHaveBeenCalledWith('@bad:hs', 'abuse')
    expect(showFeedbackMock).toHaveBeenCalledWith('moderation.report_user.success', 'success')
    expect(wrapper.emitted('update:show')?.[0]).toEqual([false])
    expect(wrapper.emitted('reported')).toBeTruthy()
  })

  it('举报失败时显示错误反馈且不关闭弹窗', async () => {
    reportUserMock.mockRejectedValueOnce(new Error('network'))
    const wrapper = mountDialog()
    await wrapper.find('[data-testid="user-report-reason"]').setValue('spam')
    await wrapper.find('[data-testid="user-report-submit"]').trigger('click')
    await Promise.resolve()
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    expect(reportUserMock).toHaveBeenCalledWith('@bad:hs', 'spam')
    expect(showFeedbackMock).toHaveBeenCalledWith('moderation.report_user.failed', 'error')
    expect(wrapper.emitted('update:show')).toBeUndefined()
    expect(wrapper.emitted('reported')).toBeUndefined()
  })

  it('点击取消按钮关闭弹窗', async () => {
    const wrapper = mountDialog()
    await wrapper.find('[data-testid="user-report-cancel"]').trigger('click')
    expect(wrapper.emitted('update:show')?.[0]).toEqual([false])
  })

  it('show 切换为 true 时重置表单', async () => {
    const wrapper = mountDialog({ show: false })
    await wrapper.setProps({ show: true })
    const select = wrapper.find('[data-testid="user-report-reason"]')
    expect((select.element as HTMLSelectElement).value).toBe('')
  })
})
