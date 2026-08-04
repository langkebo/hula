import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import RoomReportDialog from '../RoomReportDialog.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

vi.mock('@iconify/vue', () => ({
  Icon: { name: 'Icon', template: '<span class="icon-stub" />' }
}))

const reportRoomMock = vi.fn()
vi.mock('@/services/matrix/admin/AdminFacadeService', () => ({
  adminService: {
    reportRoom: (...args: unknown[]) => reportRoomMock(...args)
  }
}))

const showFeedbackMock = vi.fn()
vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback: (...args: unknown[]) => showFeedbackMock(...args) })
}))

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

describe('RoomReportDialog — 举报房间弹窗 (P0-3)', () => {
  beforeEach(() => {
    reportRoomMock.mockReset()
    showFeedbackMock.mockReset()
  })

  const mountDialog = (props: Record<string, unknown> = {}) =>
    mount(RoomReportDialog, {
      props: { show: true, roomId: '!room:hs', roomName: 'Bad Room', ...props },
      global: { stubs: naiveStubs }
    })

  it('show=true 时渲染弹窗', () => {
    const wrapper = mountDialog()
    expect(wrapper.find('.room-report-dialog').exists()).toBe(true)
  })

  it('显示被举报房间预览', () => {
    const wrapper = mountDialog({ roomName: 'Bad Room' })
    const preview = wrapper.find('.preview-content')
    expect(preview.text()).toContain('Bad Room')
    expect(preview.text()).toContain('!room:hs')
  })

  it('未选择 reason 时提交按钮禁用', () => {
    const wrapper = mountDialog()
    expect(wrapper.find('[data-testid="room-report-submit"]').attributes('disabled')).toBeDefined()
  })

  it('选择 reason 后提交按钮启用', async () => {
    const wrapper = mountDialog()
    await wrapper.find('[data-testid="room-report-reason"]').setValue('spam')
    expect(wrapper.find('[data-testid="room-report-submit"]').attributes('disabled')).toBeUndefined()
  })

  it('提交时调用 adminService.reportRoom 并 emit reported', async () => {
    reportRoomMock.mockResolvedValueOnce({ report_id: 1, room_id: '!room:hs', status: 'submitted' })
    const wrapper = mountDialog()
    await wrapper.find('[data-testid="room-report-reason"]').setValue('abuse')
    await wrapper.find('[data-testid="room-report-comment"]').setValue('extra description')
    await wrapper.find('[data-testid="room-report-submit"]').trigger('click')
    await Promise.resolve()
    await wrapper.vm.$nextTick()

    expect(reportRoomMock).toHaveBeenCalledTimes(1)
    expect(reportRoomMock).toHaveBeenCalledWith('!room:hs', 'abuse', 'extra description')
    expect(showFeedbackMock).toHaveBeenCalledWith('moderation.report_room.success', 'success')
    expect(wrapper.emitted('update:show')?.[0]).toEqual([false])
    expect(wrapper.emitted('reported')).toBeTruthy()
  })

  it('不填写补充说明时仅传 reason', async () => {
    reportRoomMock.mockResolvedValueOnce({ report_id: 1, room_id: '!room:hs', status: 'submitted' })
    const wrapper = mountDialog()
    await wrapper.find('[data-testid="room-report-reason"]').setValue('spam')
    await wrapper.find('[data-testid="room-report-submit"]').trigger('click')
    await Promise.resolve()
    await wrapper.vm.$nextTick()

    expect(reportRoomMock).toHaveBeenCalledWith('!room:hs', 'spam', undefined)
  })

  it('举报失败时显示错误反馈且不关闭弹窗', async () => {
    reportRoomMock.mockRejectedValueOnce(new Error('forbidden'))
    const wrapper = mountDialog()
    await wrapper.find('[data-testid="room-report-reason"]').setValue('spam')
    await wrapper.find('[data-testid="room-report-submit"]').trigger('click')
    await Promise.resolve()
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    expect(showFeedbackMock).toHaveBeenCalledWith('moderation.report_room.failed', 'error')
    expect(wrapper.emitted('update:show')).toBeUndefined()
    expect(wrapper.emitted('reported')).toBeUndefined()
  })

  it('点击取消按钮关闭弹窗', async () => {
    const wrapper = mountDialog()
    await wrapper.find('[data-testid="room-report-cancel"]').trigger('click')
    expect(wrapper.emitted('update:show')?.[0]).toEqual([false])
  })

  it('show 切换为 true 时重置表单', async () => {
    const wrapper = mountDialog({ show: false })
    await wrapper.setProps({ show: true })
    const select = wrapper.find('[data-testid="room-report-reason"]')
    expect((select.element as HTMLSelectElement).value).toBe('')
  })
})
