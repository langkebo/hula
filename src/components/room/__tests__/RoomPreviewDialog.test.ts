import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import type { RoomCardData } from '../RoomCard.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

const reasonHolder = vi.hoisted(() => ({
  emit: null as null | ((reason: string) => void),
  emitUpdate: null as null | ((value: string) => void)
}))

vi.mock('../JoinReasonInput.vue', () => ({
  default: {
    name: 'JoinReasonInput',
    props: {
      modelValue: { type: String, default: '' },
      disabled: { type: Boolean, default: false },
      showSubmit: { type: Boolean, default: true }
    },
    emits: ['update:modelValue', 'submit'],
    setup(_: Record<string, unknown>, { emit }: { emit: (event: string, ...args: unknown[]) => void }) {
      reasonHolder.emit = (reason: string) => emit('submit', reason)
      reasonHolder.emitUpdate = (value: string) => emit('update:modelValue', value)
      return () => null
    }
  }
}))

vi.mock('naive-ui', async () => {
  const { defineComponent, h } = await import('vue')
  const NModal = defineComponent({
    name: 'NModal',
    props: { show: { type: Boolean, default: false } },
    setup(props, { slots }) {
      return () => h('div', { class: 'nmodal', 'data-show': String(props.show) }, [slots.default?.(), slots.footer?.()])
    }
  })
  const NButton = defineComponent({
    name: 'NButton',
    props: {
      disabled: { type: Boolean, default: false },
      loading: { type: Boolean, default: false },
      type: { type: String, default: 'default' }
    },
    emits: ['click'],
    setup(props, { slots, emit }) {
      return () =>
        h('button', { type: 'button', disabled: props.disabled, onClick: () => emit('click') }, slots.default?.())
    }
  })
  const NSpin = defineComponent({
    name: 'NSpin',
    props: { show: { type: Boolean, default: false } },
    setup(_, { slots }) {
      return () => h('div', { class: 'nspin' }, slots.default?.())
    }
  })
  const NEmpty = defineComponent({
    name: 'NEmpty',
    props: { description: { type: String, default: '' } },
    setup(props) {
      return () => h('div', { class: 'nempty' }, props.description)
    }
  })
  return { NModal, NButton, NSpin, NEmpty }
})

import RoomPreviewDialog from '../RoomPreviewDialog.vue'

const sampleRoom: RoomCardData = {
  roomId: '!room1:matrix.test',
  name: 'Matrix Chat',
  topic: 'A place to discuss Matrix protocol',
  numJoinedMembers: 42,
  avatarUrl: undefined,
  isFederated: true
}

const mountDialog = (
  props: Partial<{ visible: boolean; room: RoomCardData | null; requireReason: boolean; loading: boolean }> = {}
) =>
  mount(RoomPreviewDialog, {
    props: { visible: true, room: sampleRoom, requireReason: false, loading: false, ...props }
  })

describe('RoomPreviewDialog', () => {
  it('renders room name, member count and topic when visible', () => {
    const wrapper = mountDialog()
    const text = wrapper.find('[data-testid="room-preview-dialog"]').text()
    expect(text).toContain('Matrix Chat')
    expect(text).toContain('42')
    expect(text).toContain('A place to discuss Matrix protocol')
  })

  it('emits cancel when cancel button clicked', async () => {
    const wrapper = mountDialog()
    const buttons = wrapper.findAll('button')
    const cancelBtn = buttons.find((b) => b.text().includes('cancel'))
    expect(cancelBtn).toBeDefined()
    await cancelBtn!.trigger('click')
    expect(wrapper.emitted('cancel')).toHaveLength(1)
  })

  it('emits join with roomId when requireReason is false', async () => {
    const wrapper = mountDialog({ requireReason: false })
    const buttons = wrapper.findAll('button')
    const joinBtn = buttons.find((b) => b.text().includes('preview_join'))
    expect(joinBtn).toBeDefined()
    await joinBtn!.trigger('click')
    expect(wrapper.emitted('join')).toEqual([['!room1:matrix.test', undefined]])
  })

  it('disables join button when requireReason is true and no reason provided', () => {
    const wrapper = mountDialog({ requireReason: true })
    const joinBtn = wrapper.findAll('button').find((b) => b.text().includes('preview_join'))
    expect(joinBtn?.attributes('disabled')).toBeDefined()
  })

  it('shows reason_required hint when requireReason is true and reason is empty', () => {
    const wrapper = mountDialog({ requireReason: true })
    expect(wrapper.find('[data-testid="reason-required-hint"]').exists()).toBe(true)
  })

  it('shows reason label when requireReason is true', () => {
    const wrapper = mountDialog({ requireReason: true })
    expect(wrapper.find('[data-testid="reason-label"]').exists()).toBe(true)
  })

  it('emits join with reason when requireReason and footer join clicked after typing reason', async () => {
    const wrapper = mountDialog({ requireReason: true })
    // simulate typing a reason via v-model
    reasonHolder.emitUpdate!('please let me in')
    await wrapper.vm.$nextTick()
    const joinBtn = wrapper.findAll('button').find((b) => b.text().includes('preview_join'))
    expect(joinBtn?.attributes('disabled')).toBeUndefined()
    await joinBtn!.trigger('click')
    expect(wrapper.emitted('join')).toEqual([['!room1:matrix.test', 'please let me in']])
  })

  it('hides reason_required hint when reason is provided', async () => {
    const wrapper = mountDialog({ requireReason: true })
    reasonHolder.emitUpdate!('a reason')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="reason-required-hint"]').exists()).toBe(false)
  })

  it('emits update:visible false when cancel clicked', async () => {
    const wrapper = mountDialog()
    const cancelBtn = wrapper.findAll('button').find((b) => b.text().includes('cancel'))
    await cancelBtn!.trigger('click')
    expect(wrapper.emitted('update:visible')?.at(-1)).toEqual([false])
  })

  it('does not render preview content when room is null', () => {
    const wrapper = mountDialog({ room: null })
    expect(wrapper.find('[data-testid="room-preview-dialog"]').exists()).toBe(false)
  })
})
