import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

type EmojiPack = {
  id: string
  name: string
  iconUrl?: string
  items: Array<{ id: string; name: string; url: string }>
}

type ManagerMock = {
  packs: { value: EmojiPack[] }
  loading: { value: boolean }
  creating: { value: boolean }
  load: ReturnType<typeof vi.fn>
  createPack: ReturnType<typeof vi.fn>
  deletePack: ReturnType<typeof vi.fn>
  renamePack: ReturnType<typeof vi.fn>
  addEmoji: ReturnType<typeof vi.fn>
  removeEmoji: ReturnType<typeof vi.fn>
}

const holder = vi.hoisted(() => ({
  manager: null as unknown as ManagerMock,
  confirmDialogMock: vi.fn()
}))

vi.mock('@/composables/emoji/useEmojiPackManager', async () => {
  const { ref } = await import('vue')
  holder.manager = {
    packs: ref<EmojiPack[]>([]),
    loading: ref(false),
    creating: ref(false),
    load: vi.fn(),
    createPack: vi.fn(),
    deletePack: vi.fn(),
    renamePack: vi.fn(),
    addEmoji: vi.fn(),
    removeEmoji: vi.fn()
  }
  return { useEmojiPackManager: () => holder.manager }
})

vi.mock('vant', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, showConfirmDialog: holder.confirmDialogMock }
})

vi.mock('@iconify/vue', () => ({
  Icon: { template: '<span class="icon-stub" />' }
}))

import MobileEmojiManager from '../MobileEmojiManager.vue'

const stubs = {
  AutoFixHeightPage: { template: '<div><slot name="header" /><slot name="container" /></div>' },
  HeaderBar: { template: '<div class="header-stub" />' },
  'van-loading': { template: '<span class="van-loading-stub" />' },
  'van-empty': { template: '<div class="van-empty-stub" />' },
  'van-cell-group': { template: '<div><slot /></div>' },
  'van-swipe-cell': { template: '<div class="van-swipe-cell-stub"><slot /><slot name="right" /></div>' },
  'van-cell': {
    template:
      '<div class="van-cell-stub" @click="$emit(\'click\')"><slot name="icon" /><slot name="title" /><slot name="value" /></div>',
    emits: ['click']
  },
  'van-button': {
    template:
      '<button class="van-button-stub" :disabled="disabled" @click="$emit(\'click\')">{{ text }}<slot /></button>',
    props: ['text', 'disabled', 'loading', 'type', 'block', 'square', 'plain'],
    emits: ['click']
  },
  'van-popup': { template: '<div class="van-popup-stub" v-show="show"><slot /></div>', props: ['show'] },
  'van-field': {
    template:
      '<input class="van-field-stub" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
    props: ['modelValue'],
    emits: ['update:modelValue']
  },
  'van-uploader': { template: '<div class="van-uploader-stub"><slot /></div>' }
}

const packAlpha: EmojiPack = {
  id: 'pack-1',
  name: '柴犬全家桶',
  items: [{ id: 'e1', name: 'wow', url: 'mxc://hs/e1' }]
}

const mountPage = () => mount(MobileEmojiManager, { global: { stubs } })

describe('MobileEmojiManager', () => {
  beforeEach(() => {
    const m = holder.manager
    m.packs.value = []
    m.loading.value = false
    m.creating.value = false
    m.load.mockReset()
    m.createPack.mockReset()
    m.deletePack.mockReset()
    m.renamePack.mockReset()
    m.removeEmoji.mockReset()
    holder.confirmDialogMock.mockReset()
  })

  it('挂载时加载表情包列表', () => {
    mountPage()
    expect(holder.manager.load).toHaveBeenCalledTimes(1)
  })

  it('空列表时展示空态', () => {
    const wrapper = mountPage()
    expect(wrapper.find('.van-empty-stub').exists()).toBe(true)
  })

  it('渲染表情包名称与数量', () => {
    holder.manager.packs.value = [packAlpha]
    const wrapper = mountPage()

    expect(wrapper.text()).toContain('柴犬全家桶')
    expect(wrapper.find('.van-cell-stub').exists()).toBe(true)
  })

  it('创建表情包：填写名称提交后调用 createPack', async () => {
    const wrapper = mountPage()

    const buttons = wrapper.findAll('.van-button-stub')
    await buttons.at(-1)?.trigger('click')

    await wrapper.find('.van-field-stub').setValue('新表情包')
    const confirmButton = wrapper.findAll('.van-button-stub').find((b) => b.text().includes('common.confirm'))
    await confirmButton?.trigger('click')

    expect(holder.manager.createPack).toHaveBeenCalledWith('新表情包')
  })

  it('名称为空时确认按钮禁用，不会提交', async () => {
    const wrapper = mountPage()
    await wrapper.findAll('.van-button-stub').at(-1)?.trigger('click')

    const confirmButton = wrapper.findAll('.van-button-stub').find((b) => b.text().includes('common.confirm'))

    expect(confirmButton?.attributes('disabled')).toBeDefined()
  })

  it('删除表情包需二次确认：确认后调用 deletePack', async () => {
    holder.manager.packs.value = [packAlpha]
    holder.confirmDialogMock.mockResolvedValueOnce('confirm')
    const wrapper = mountPage()

    const deleteButton = wrapper.findAll('.van-button-stub').find((b) => b.text().includes('emoticon.packs.uninstall'))
    await deleteButton?.trigger('click')
    await Promise.resolve()
    await Promise.resolve()

    expect(holder.manager.deletePack).toHaveBeenCalledWith('pack-1')
  })

  it('取消二次确认时不删除', async () => {
    holder.manager.packs.value = [packAlpha]
    holder.confirmDialogMock.mockRejectedValueOnce('cancel')
    const wrapper = mountPage()

    const deleteButton = wrapper.findAll('.van-button-stub').find((b) => b.text().includes('emoticon.packs.uninstall'))
    await deleteButton?.trigger('click')
    await Promise.resolve()
    await Promise.resolve()

    expect(holder.manager.deletePack).not.toHaveBeenCalled()
  })

  it('重命名表情包：预填原名并调用 renamePack', async () => {
    holder.manager.packs.value = [packAlpha]
    const wrapper = mountPage()

    const renameButton = wrapper.findAll('.van-button-stub').find((b) => b.text().includes('emoticon.packs.rename'))
    await renameButton?.trigger('click')

    const field = wrapper.find('.van-field-stub')
    expect((field.element as HTMLInputElement).value).toBe('柴犬全家桶')

    await field.setValue('柴犬2.0')
    const confirmButton = wrapper.findAll('.van-button-stub').find((b) => b.text().includes('common.confirm'))
    await confirmButton?.trigger('click')

    expect(holder.manager.renamePack).toHaveBeenCalledWith('pack-1', '柴犬2.0')
  })
})
