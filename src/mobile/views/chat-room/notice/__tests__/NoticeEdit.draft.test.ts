import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import NoticeEdit from '../NoticeEdit.vue'
import { buildNoticeDraftKey, readNoticeDraft, saveNoticeDraft } from '../noticeDraft'

const { backMock, pushMock, showFeedbackMock, editAnnouncementMock, pushAnnouncementMock, getAnnouncementByIdMock } =
  vi.hoisted(() => ({
    backMock: vi.fn(),
    pushMock: vi.fn(),
    showFeedbackMock: vi.fn(),
    editAnnouncementMock: vi.fn(),
    pushAnnouncementMock: vi.fn(),
    getAnnouncementByIdMock: vi.fn()
  }))

const route = {
  params: { id: 'notice-1' } as Record<string, string>,
  query: { roomId: '!room:hs' } as Record<string, string>
}

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return {
    ...actual,
    useRoute: () => route,
    useRouter: () => ({ back: backMock, push: pushMock })
  }
})

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback: showFeedbackMock })
}))

vi.mock('@/services/matrix/room/MatrixAnnouncementService', () => ({
  matrixAnnouncementService: {
    getAnnouncementById: (...args: unknown[]) => getAnnouncementByIdMock(...args),
    editAnnouncement: (...args: unknown[]) => editAnnouncementMock(...args),
    pushAnnouncement: (...args: unknown[]) => pushAnnouncementMock(...args)
  }
}))

vi.mock('@/stores/domains/widget/global', () => ({
  useGlobalStore: () => ({ currentSessionRoomId: '!room:hs' })
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn()
  })
}))

const stubs = {
  AutoFixHeightPage: {
    template: '<div><slot name="header" /><slot name="container" /></div>',
    props: ['showFooter']
  },
  HeaderBar: { template: '<div />', props: ['isOfficial', 'border', 'hiddenRight', 'roomName'] },
  VanField: {
    name: 'VanField',
    props: ['modelValue', 'placeholder', 'type', 'autosize', 'rows', 'maxlength', 'showWordLimit', 'spellcheck'],
    emits: ['update:modelValue'],
    template: '<textarea :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />'
  },
  VanSwitch: {
    name: 'VanSwitch',
    props: ['modelValue'],
    emits: ['update:modelValue'],
    template: '<div class="van-switch" />'
  },
  VanButton: { template: '<button type="button" @click="$emit(\'click\')"><slot /></button>' }
}

const mountNoticeEdit = () =>
  mount(NoticeEdit, {
    global: { stubs }
  })

describe('noticeDraft 本地草稿', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('按 roomId + noticeId 生成独立 key', () => {
    expect(buildNoticeDraftKey('!room:hs', 'notice-1')).not.toBe(buildNoticeDraftKey('!room:hs', 'notice-2'))
    expect(buildNoticeDraftKey('!room:hs')).toContain(':new')
  })

  it('写入后可读回，清除后为空', () => {
    const key = buildNoticeDraftKey('!room:hs', 'notice-1')

    saveNoticeDraft(key, { content: '草稿内容', top: true })
    expect(readNoticeDraft(key)).toEqual({ content: '草稿内容', top: true })

    sessionStorage.removeItem(key)
    expect(readNoticeDraft(key)).toBeNull()
  })

  it('遇到损坏数据返回 null', () => {
    const key = buildNoticeDraftKey('!room:hs', 'notice-1')
    sessionStorage.setItem(key, 'not-json')

    expect(readNoticeDraft(key)).toBeNull()
  })
})

describe('NoticeEdit 草稿回填与清理', () => {
  const draftKey = buildNoticeDraftKey('!room:hs', 'notice-1')

  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    route.params = { id: 'notice-1' }
    getAnnouncementByIdMock.mockResolvedValue({ content: '服务端内容', isPinned: false })
  })

  it('存在草稿时优先回填草稿', async () => {
    saveNoticeDraft(draftKey, { content: '本地草稿', top: true })

    const wrapper = mountNoticeEdit()
    await flushPromises()

    expect((wrapper.find('textarea').element as HTMLTextAreaElement).value).toBe('本地草稿')
    expect(wrapper.findComponent({ name: 'VanSwitch' }).props('modelValue')).toBe(true)
    wrapper.unmount()
  })

  it('保存成功后清除草稿', async () => {
    saveNoticeDraft(draftKey, { content: '旧草稿', top: false })
    editAnnouncementMock.mockResolvedValue(undefined)

    const wrapper = mountNoticeEdit()
    await flushPromises()

    await wrapper.find('textarea').setValue('新内容')
    await wrapper.findAll('button').at(-1)!.trigger('click')
    await flushPromises()

    expect(editAnnouncementMock).toHaveBeenCalledWith('!room:hs', {
      id: 'notice-1',
      content: '新内容',
      isPinned: false
    })
    expect(readNoticeDraft(draftKey)).toBeNull()
    expect(pushMock).toHaveBeenCalled()
    wrapper.unmount()
  })

  it('保存失败后保留表单内容并写入草稿', async () => {
    editAnnouncementMock.mockRejectedValue(new Error('save failed'))

    const wrapper = mountNoticeEdit()
    await flushPromises()

    await wrapper.find('textarea').setValue('失败内容')
    await wrapper.findAll('button').at(-1)!.trigger('click')
    await flushPromises()

    expect(readNoticeDraft(draftKey)).toEqual({ content: '失败内容', top: false })
    expect((wrapper.find('textarea').element as HTMLTextAreaElement).value).toBe('失败内容')
    expect(showFeedbackMock).toHaveBeenCalledWith('mobile_chat.notice.save_failed', 'error')
    expect(pushMock).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('编辑态详情读取失败时进入错误态，不渲染空表单', async () => {
    getAnnouncementByIdMock.mockRejectedValue(new Error('network down'))

    const wrapper = mountNoticeEdit()
    await flushPromises()

    expect(wrapper.find('[data-testid="notice-detail-error"]').exists()).toBe(true)
    // 失败时不能展示一张空表单让用户误以为公告没有内容
    expect(wrapper.find('textarea').exists()).toBe(false)
    expect(showFeedbackMock).toHaveBeenCalledWith('mobile_chat.notice.fetch_failed', 'error')
    wrapper.unmount()
  })

  it('错误态重试成功后渲染表单并回填详情', async () => {
    let attempt = 0
    getAnnouncementByIdMock.mockReset()
    getAnnouncementByIdMock.mockImplementation(() => {
      attempt += 1
      return attempt === 1
        ? Promise.reject(new Error('network down'))
        : Promise.resolve({ content: '重试后的内容', isPinned: true })
    })

    const wrapper = mountNoticeEdit()
    await flushPromises()
    expect(wrapper.find('[data-testid="notice-detail-error"]').exists()).toBe(true)

    await wrapper.find('[data-test="async-state-retry"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="notice-detail-error"]').exists()).toBe(false)
    expect((wrapper.find('textarea').element as HTMLTextAreaElement).value).toBe('重试后的内容')
    wrapper.unmount()
  })

  it('新增模式不请求详情，仍直接回填本地草稿', async () => {
    route.params = {}
    const newDraftKey = buildNoticeDraftKey('!room:hs', undefined)
    saveNoticeDraft(newDraftKey, { content: '新增草稿', top: true })

    const wrapper = mountNoticeEdit()
    await flushPromises()

    expect(getAnnouncementByIdMock).not.toHaveBeenCalled()
    expect((wrapper.find('textarea').element as HTMLTextAreaElement).value).toBe('新增草稿')
    wrapper.unmount()
  })
})
