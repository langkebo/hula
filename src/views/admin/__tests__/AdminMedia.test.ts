import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref, type VNodeChild } from 'vue'
import AdminMedia from '../AdminMedia.vue'

const {
  loadLibraryMock,
  loadMoreLibraryMock,
  openMediaDetailMock,
  closeMediaDetailMock,
  loadQuarantineChangesMock,
  loadMoreQuarantineChangesMock,
  loadMediaQuarantineHistoryMock,
  loadRoomMediaMock,
  loadMoreRoomMediaMock,
  loadUserMediaMock,
  quarantineMock,
  unquarantineMock,
  protectMock,
  unprotectMock,
  deleteOneMock,
  deleteRoomOneMock,
  deleteUserAllMock,
  quarantineRoomMock,
  unquarantineRoomMock,
  quarantineUserMock,
  deleteByPolicyMock,
  showFeedbackMock,
  state
} = vi.hoisted(() => {
  type LibraryRow = {
    mediaId: string
    mediaType: string
    contentUri: string
    createdAt: number
    uploadName: string
    mediaLength: number
    quarantined?: boolean
  }
  return {
    loadLibraryMock: vi.fn(),
    loadMoreLibraryMock: vi.fn(),
    openMediaDetailMock: vi.fn(),
    closeMediaDetailMock: vi.fn(),
    loadQuarantineChangesMock: vi.fn(),
    loadMoreQuarantineChangesMock: vi.fn(),
    loadMediaQuarantineHistoryMock: vi.fn(),
    loadRoomMediaMock: vi.fn(),
    loadMoreRoomMediaMock: vi.fn(),
    loadUserMediaMock: vi.fn(),
    quarantineMock: vi.fn(),
    unquarantineMock: vi.fn(),
    protectMock: vi.fn(),
    unprotectMock: vi.fn(),
    deleteOneMock: vi.fn(),
    deleteRoomOneMock: vi.fn(),
    deleteUserAllMock: vi.fn(),
    quarantineRoomMock: vi.fn(),
    unquarantineRoomMock: vi.fn(),
    quarantineUserMock: vi.fn(),
    deleteByPolicyMock: vi.fn(),
    showFeedbackMock: vi.fn(),
    state: {
      library: [] as LibraryRow[],
      libraryNextBatch: null as string | null,
      libraryLoading: false,
      selectedMedia: null as Record<string, unknown> | null,
      detailLoading: false,
      quarantineChanges: [] as Array<Record<string, unknown>>,
      quarantineNextBatch: 0,
      quarantineLoading: false,
      roomMedia: [] as Array<Record<string, unknown>>,
      roomMediaNextBatch: null as string | null,
      roomMediaLoading: false,
      roomMediaRoomId: null as string | null,
      userMedia: [] as Array<Record<string, unknown>>,
      userMediaLoading: false,
      userMediaUserId: null as string | null,
      mutating: false
    }
  }
})

vi.mock('@/composables/admin', () => ({
  useAdminMedia: () => ({
    library: ref(state.library),
    libraryNextBatch: ref(state.libraryNextBatch),
    libraryLoading: ref(state.libraryLoading),
    selectedMedia: ref(state.selectedMedia),
    detailLoading: ref(state.detailLoading),
    quarantineChanges: ref(state.quarantineChanges),
    quarantineNextBatch: ref(state.quarantineNextBatch),
    quarantineLoading: ref(state.quarantineLoading),
    roomMedia: ref(state.roomMedia),
    roomMediaNextBatch: ref(state.roomMediaNextBatch),
    roomMediaLoading: ref(state.roomMediaLoading),
    roomMediaRoomId: ref(state.roomMediaRoomId),
    userMedia: ref(state.userMedia),
    userMediaLoading: ref(state.userMediaLoading),
    userMediaUserId: ref(state.userMediaUserId),
    mutating: ref(state.mutating),
    loadLibrary: loadLibraryMock,
    loadMoreLibrary: loadMoreLibraryMock,
    openMediaDetail: openMediaDetailMock,
    closeMediaDetail: closeMediaDetailMock,
    loadQuarantineChanges: loadQuarantineChangesMock,
    loadMoreQuarantineChanges: loadMoreQuarantineChangesMock,
    loadMediaQuarantineHistory: loadMediaQuarantineHistoryMock,
    loadRoomMedia: loadRoomMediaMock,
    loadMoreRoomMedia: loadMoreRoomMediaMock,
    loadUserMedia: loadUserMediaMock,
    quarantine: quarantineMock,
    unquarantine: unquarantineMock,
    protect: protectMock,
    unprotect: unprotectMock,
    deleteOne: deleteOneMock,
    deleteRoomOne: deleteRoomOneMock,
    deleteUserAll: deleteUserAllMock,
    quarantineRoom: quarantineRoomMock,
    unquarantineRoom: unquarantineRoomMock,
    quarantineUser: quarantineUserMock,
    deleteByPolicy: deleteByPolicyMock
  })
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({
    showFeedback: showFeedbackMock
  })
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  })
}))

vi.mock('@/services/matrix/MatrixClientService', () => ({
  matrixClientService: {
    getClient: () => ({ getDomain: () => 'a.example' })
  }
}))

vi.mock('naive-ui', async () => {
  const { defineComponent, h } = await import('vue')

  const passthrough = (name: string, tag = 'div') =>
    defineComponent({
      name,
      props: [
        'show',
        'title',
        'subtitle',
        'label',
        'description',
        'size',
        'type',
        'name',
        'tab',
        'cols',
        'xGap',
        'yGap',
        'responsive',
        'itemResponsive',
        'span',
        'bordered',
        'column',
        'placement',
        'width',
        'closable',
        'value',
        'animated',
        'loading',
        'align',
        'justify'
      ],
      setup(props, { slots }) {
        return () =>
          h(tag, { 'data-test': name }, [
            props.title ? h('span', { 'data-test': `${name}-title` }, String(props.title)) : null,
            props.description ? h('span', { 'data-test': `${name}-description` }, String(props.description)) : null,
            slots.default?.(),
            slots.extra?.(),
            slots.footer?.(),
            slots.action?.()
          ])
      }
    })

  return {
    NButton: defineComponent({
      name: 'NButton',
      props: ['loading', 'type', 'size', 'disabled', 'text', 'quaternary'],
      emits: ['click'],
      setup(props, { slots, emit }) {
        return () =>
          h(
            'button',
            { type: 'button', disabled: props.disabled ? true : undefined, onClick: () => emit('click') },
            slots.default?.()
          )
      }
    }),
    NCard: passthrough('NCard'),
    NDataTable: defineComponent({
      name: 'NDataTable',
      props: ['data', 'columns', 'loading', 'pagination', 'rowKey', 'bordered', 'size', 'striped'],
      setup(props) {
        return () => {
          const rows = (props.data ?? []) as Array<Record<string, unknown>>
          const columns = (props.columns ?? []) as Array<{
            key?: string
            render?: (row: Record<string, unknown>) => VNodeChild
          }>
          return h(
            'div',
            { 'data-test': 'NDataTable' },
            rows.map((row, rowIndex) =>
              h(
                'div',
                { 'data-test': 'NDataTable-row', key: rowIndex },
                columns.map((column, columnIndex) => {
                  const rendered: VNodeChild = column.render ? column.render(row) : String(row[column.key ?? ''] ?? '')
                  return h('div', { 'data-test': `NDataTable-cell-${column.key ?? columnIndex}`, key: columnIndex }, [
                    rendered
                  ])
                })
              )
            )
          )
        }
      }
    }),
    NDatePicker: defineComponent({
      name: 'NDatePicker',
      props: ['value', 'type', 'clearable', 'placeholder'],
      emits: ['update:value'],
      setup(props, { emit }) {
        return () =>
          h('input', {
            'data-test': 'NDatePicker',
            type: 'text',
            value: props.value ?? '',
            onInput: (event: Event) => emit('update:value', Number((event.target as HTMLInputElement).value))
          })
      }
    }),
    NDescriptions: passthrough('NDescriptions'),
    NDescriptionsItem: defineComponent({
      name: 'NDescriptionsItem',
      props: ['label'],
      setup(props, { slots }) {
        return () =>
          h('div', { 'data-test': 'NDescriptionsItem' }, [
            props.label ? h('span', { 'data-test': 'NDescriptionsItem-label' }, String(props.label)) : null,
            slots.default?.()
          ])
      }
    }),
    NDrawer: defineComponent({
      name: 'NDrawer',
      props: ['show', 'width', 'placement'],
      setup(props, { slots }) {
        return () =>
          h('div', { 'data-test': 'NDrawer', 'data-show': String(props.show) }, props.show ? slots.default?.() : [])
      }
    }),
    NDrawerContent: passthrough('NDrawerContent'),
    NEmpty: passthrough('NEmpty'),
    NInput: defineComponent({
      name: 'NInput',
      props: ['value', 'placeholder', 'disabled', 'clearable'],
      emits: ['update:value'],
      setup(props, { emit }) {
        return () =>
          h('input', {
            'data-test': 'NInput',
            value: props.value ?? '',
            onInput: (event: Event) => emit('update:value', (event.target as HTMLInputElement).value)
          })
      }
    }),
    NInputNumber: defineComponent({
      name: 'NInputNumber',
      props: ['value', 'placeholder', 'min', 'max'],
      emits: ['update:value'],
      setup(props, { emit }) {
        return () =>
          h('input', {
            'data-test': 'NInputNumber',
            type: 'number',
            value: props.value ?? '',
            onInput: (event: Event) => emit('update:value', Number((event.target as HTMLInputElement).value))
          })
      }
    }),
    NModal: defineComponent({
      name: 'NModal',
      props: ['show', 'title', 'preset'],
      setup(props, { slots }) {
        return () =>
          h(
            'div',
            { 'data-test': 'NModal', 'data-show': String(props.show) },
            props.show
              ? [
                  props.title ? h('span', { 'data-test': 'NModal-title' }, String(props.title)) : null,
                  slots.default?.(),
                  slots.footer?.()
                ]
              : []
          )
      }
    }),
    NPageHeader: passthrough('NPageHeader'),
    NPopconfirm: defineComponent({
      name: 'NPopconfirm',
      props: ['positiveText', 'negativeText'],
      emits: ['positive-click'],
      setup(_, { slots, emit }) {
        return () =>
          h('span', { 'data-test': 'NPopconfirm' }, [
            slots.trigger?.(),
            slots.default?.(),
            h(
              'button',
              { type: 'button', 'data-test': 'NPopconfirm-positive', onClick: () => emit('positive-click') },
              'ok'
            )
          ])
      }
    }),
    NSpace: passthrough('NSpace'),
    NTabPane: passthrough('NTabPane'),
    NTabs: passthrough('NTabs'),
    NTag: defineComponent({
      name: 'NTag',
      props: ['size', 'type'],
      setup(_, { slots }) {
        return () => h('span', { 'data-test': 'NTag' }, slots.default?.())
      }
    })
  }
})

describe('AdminMedia', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.library = [
      {
        mediaId: 'm1',
        mediaType: 'image/png',
        contentUri: 'mxc://a.example/m1',
        createdAt: 1700000000000,
        uploadName: 'media_id_value',
        mediaLength: 2048
      }
    ]
    state.libraryNextBatch = null
    state.libraryLoading = false
    state.selectedMedia = null
    state.detailLoading = false
    state.quarantineChanges = []
    state.quarantineNextBatch = 0
    state.quarantineLoading = false
    state.roomMedia = []
    state.roomMediaNextBatch = null
    state.roomMediaLoading = false
    state.userMedia = []
    state.userMediaLoading = false
    state.mutating = false

    loadLibraryMock.mockResolvedValue(undefined)
    loadMoreLibraryMock.mockResolvedValue(undefined)
    openMediaDetailMock.mockResolvedValue(undefined)
    loadQuarantineChangesMock.mockResolvedValue(undefined)
    loadMediaQuarantineHistoryMock.mockResolvedValue([])
    loadRoomMediaMock.mockResolvedValue(undefined)
    loadUserMediaMock.mockResolvedValue(undefined)
    quarantineMock.mockResolvedValue(undefined)
    unquarantineMock.mockResolvedValue(undefined)
    protectMock.mockResolvedValue(undefined)
    unprotectMock.mockResolvedValue(undefined)
    deleteOneMock.mockResolvedValue(undefined)
    deleteRoomOneMock.mockResolvedValue(undefined)
    quarantineRoomMock.mockResolvedValue(undefined)
    unquarantineRoomMock.mockResolvedValue(undefined)
    quarantineUserMock.mockResolvedValue(undefined)
    deleteByPolicyMock.mockResolvedValue(0)
  })

  const mountComponent = () => mount(AdminMedia)

  const findButton = (wrapper: ReturnType<typeof mountComponent>, text: string) =>
    wrapper.findAll('button').find((button) => button.text().includes(text))

  it('默认渲染媒体库页签并加载列表', async () => {
    const wrapper = mountComponent()
    await flushPromises()

    expect(loadLibraryMock).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('media_id_value')
  })

  it('点击隔离按钮调用 quarantine 并提示成功', async () => {
    const wrapper = mountComponent()
    await flushPromises()

    const button = findButton(wrapper, 'admin.media.action.quarantine')
    expect(button).toBeDefined()
    await button!.trigger('click')
    await flushPromises()

    expect(quarantineMock).toHaveBeenCalledWith('a.example', 'm1')
    expect(showFeedbackMock).toHaveBeenCalledWith('admin.media.feedback.quarantine_success', 'success')
  })

  it('隔离失败时展示失败反馈', async () => {
    quarantineMock.mockRejectedValue(new Error('quarantine failed'))
    const wrapper = mountComponent()
    await flushPromises()

    const button = findButton(wrapper, 'admin.media.action.quarantine')
    await button!.trigger('click')
    await flushPromises()

    expect(showFeedbackMock).toHaveBeenCalledWith('admin.media.feedback.failed', 'error')
  })

  it('媒体库为空时展示空态', async () => {
    state.library = []
    const wrapper = mountComponent()
    await flushPromises()

    expect(wrapper.text()).toContain('admin.media.empty.library')
  })

  it('存在下一页游标时展示加载更多并触发翻页', async () => {
    state.libraryNextBatch = 'next-batch'
    const wrapper = mountComponent()
    await flushPromises()

    const button = findButton(wrapper, 'admin.media.action.loadMore')
    expect(button).toBeDefined()
    await button!.trigger('click')
    await flushPromises()

    expect(loadMoreLibraryMock).toHaveBeenCalledTimes(1)
  })

  it('全局隔离变更流为空时展示空态', async () => {
    const wrapper = mountComponent()
    await flushPromises()

    expect(loadQuarantineChangesMock).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('admin.media.empty.changes')
  })

  it('隔离变更流加载后展示记录并支持加载更多', async () => {
    state.quarantineChanges = [{ origin: 'b.example', media_id: 'q1', quarantined: true }]
    const wrapper = mountComponent()
    await flushPromises()

    expect(loadQuarantineChangesMock).toHaveBeenCalledTimes(1)
    const panel = wrapper.find('.media-quarantine-changes-panel')
    expect(panel.text()).toContain('q1')
    expect(panel.text()).toContain('admin.media.column.quarantined')

    const loadMore = panel.findAll('button').find((button) => button.text().includes('admin.media.action.loadMore'))
    expect(loadMore).toBeDefined()
    await loadMore!.trigger('click')
    expect(loadMoreQuarantineChangesMock).toHaveBeenCalledTimes(1)
  })

  it('媒体库展示隔离状态列', async () => {
    state.library = [
      {
        mediaId: 'm1',
        mediaType: 'image/png',
        contentUri: 'mxc://a.example/m1',
        createdAt: 1700000000000,
        uploadName: 'media_id_value',
        mediaLength: 2048,
        quarantined: true
      }
    ]
    const wrapper = mountComponent()
    await flushPromises()

    const quarantinedCell = wrapper.find('[data-test="NDataTable-cell-quarantined"]')
    expect(quarantinedCell.text()).toContain('admin.media.column.quarantined')
  })

  it('点击详情打开抽屉并加载隔离历史', async () => {
    state.selectedMedia = {
      media_id: 'm1',
      media_type: 'image/png',
      upload_name: 'media_id_value',
      media_length: 2048,
      created_ts: 1700000000000,
      quarantined: true
    }
    const wrapper = mountComponent()
    await flushPromises()

    const drawer = wrapper.find('[data-test="NDrawer"]')
    expect(drawer.attributes('data-show')).toBe('false')

    const button = findButton(wrapper, 'admin.media.action.detail')
    await button!.trigger('click')
    await flushPromises()

    expect(openMediaDetailMock).toHaveBeenCalledWith('m1')
    expect(loadMediaQuarantineHistoryMock).toHaveBeenCalledWith('m1')
    expect(wrapper.find('[data-test="NDrawer"]').attributes('data-show')).toBe('true')
    expect(wrapper.find('[data-test="NDrawer"]').text()).toContain('m1')
  })

  it('删除成功后重新加载媒体库', async () => {
    const wrapper = mountComponent()
    await flushPromises()
    expect(loadLibraryMock).toHaveBeenCalledTimes(1)

    await wrapper.find('[data-test="NPopconfirm-positive"]').trigger('click')
    await flushPromises()

    expect(deleteOneMock).toHaveBeenCalledWith('a.example', 'm1')
    expect(loadLibraryMock).toHaveBeenCalledTimes(2)
  })

  it('策略删除两个条件为空时禁用确认并提示风险', async () => {
    const wrapper = mountComponent()
    await flushPromises()

    await findButton(wrapper, 'admin.media.action.policyDelete')!.trigger('click')
    const modal = wrapper.find('[data-test="NModal"]')
    expect(modal.attributes('data-show')).toBe('true')
    expect(modal.text()).toContain('admin.media.field.policyHint')

    const confirm = modal.findAll('button').find((button) => button.text().includes('admin.common.confirm'))
    expect(confirm!.attributes('disabled')).toBeDefined()

    await modal.find('input[data-test="NDatePicker"]').setValue('1700000000000')
    expect(confirm!.attributes('disabled')).toBeUndefined()
    expect(modal.text()).not.toContain('admin.media.field.policyHint')
  })

  it('策略删除成功时按条件调用并提示数量', async () => {
    deleteByPolicyMock.mockResolvedValue(3)
    const wrapper = mountComponent()
    await flushPromises()

    await findButton(wrapper, 'admin.media.action.policyDelete')!.trigger('click')
    const modal = wrapper.find('[data-test="NModal"]')
    await modal.find('input[data-test="NInputNumber"]').setValue('4096')
    const confirm = modal.findAll('button').find((button) => button.text().includes('admin.common.confirm'))
    await confirm!.trigger('click')
    await flushPromises()

    expect(deleteByPolicyMock).toHaveBeenCalledWith({ maxSize: 4096 })
    expect(showFeedbackMock).toHaveBeenCalledWith('admin.media.feedback.policy_deleted', 'success')
    expect(loadLibraryMock).toHaveBeenCalledTimes(2)
  })

  it('策略删除失败时展示失败反馈而非成功', async () => {
    deleteByPolicyMock.mockRejectedValue(new Error('policy delete failed'))
    const wrapper = mountComponent()
    await flushPromises()

    await findButton(wrapper, 'admin.media.action.policyDelete')!.trigger('click')
    const modal = wrapper.find('[data-test="NModal"]')
    await modal.find('input[data-test="NInputNumber"]').setValue('4096')
    const confirm = modal.findAll('button').find((button) => button.text().includes('admin.common.confirm'))
    await confirm!.trigger('click')
    await flushPromises()

    expect(showFeedbackMock).toHaveBeenCalledWith('admin.media.feedback.failed', 'error')
    expect(showFeedbackMock).not.toHaveBeenCalledWith('admin.media.feedback.policy_deleted', 'success')
  })

  it('房间媒体按房间 ID 查询并支持加载更多', async () => {
    state.roomMedia = [
      {
        media_id: 'r1',
        upload_name: 'room.png',
        media_type: 'image/png',
        media_length: 10,
        created_ts: 1700000000000
      }
    ]
    state.roomMediaNextBatch = 'room-next'
    const wrapper = mountComponent()
    await flushPromises()

    const roomCard = wrapper.findAll('[data-test="NCard"]')[0]
    await roomCard.find('input[data-test="NInput"]').setValue('!room:a.example')
    const refresh = roomCard.findAll('button').find((button) => button.text().includes('admin.common.refresh'))
    await refresh!.trigger('click')
    await flushPromises()

    expect(loadRoomMediaMock).toHaveBeenCalledWith('!room:a.example')
    expect(roomCard.text()).toContain('room.png')

    const loadMore = roomCard.findAll('button').find((button) => button.text().includes('admin.media.action.loadMore'))
    expect(loadMore).toBeDefined()
    await loadMore!.trigger('click')
    expect(loadMoreRoomMediaMock).toHaveBeenCalledTimes(1)
  })

  it('用户媒体按用户 ID 查询', async () => {
    state.userMedia = [
      {
        media_id: 'u1m',
        upload_name: 'user.png',
        media_type: 'image/png',
        media_length: 20,
        created_ts: 1700000000000
      }
    ]
    const wrapper = mountComponent()
    await flushPromises()

    const userCard = wrapper.findAll('[data-test="NCard"]')[1]
    await userCard.find('input[data-test="NInput"]').setValue('@u1:a.example')
    const refresh = userCard.findAll('button').find((button) => button.text().includes('admin.common.refresh'))
    await refresh!.trigger('click')
    await flushPromises()

    expect(loadUserMediaMock).toHaveBeenCalledWith('@u1:a.example')
    expect(userCard.text()).toContain('user.png')
  })

  it('mutating 时禁用行操作与隔离按钮', async () => {
    state.mutating = true
    const wrapper = mountComponent()
    await flushPromises()

    const quarantine = findButton(wrapper, 'admin.media.action.quarantine')
    expect(quarantine!.attributes('disabled')).toBeDefined()

    const roomCard = wrapper.findAll('[data-test="NCard"]')[0]
    const quarantineRoom = roomCard
      .findAll('button')
      .find((button) => button.text().includes('admin.media.action.quarantineRoom'))
    expect(quarantineRoom!.attributes('disabled')).toBeDefined()
  })

  it('房间媒体删除使用列表加载时的房间 ID 而非输入框当前值', async () => {
    state.roomMedia = [
      {
        media_id: 'r1',
        upload_name: 'room.png',
        media_type: 'image/png',
        media_length: 10,
        created_ts: 1700000000000
      }
    ]
    state.roomMediaRoomId = '!loaded:a.example'
    const wrapper = mountComponent()
    await flushPromises()

    const roomCard = wrapper.findAll('[data-test="NCard"]')[0]
    await roomCard.find('input[data-test="NInput"]').setValue('!other:b.example')
    await roomCard.find('[data-test="NPopconfirm-positive"]').trigger('click')
    await flushPromises()

    expect(deleteRoomOneMock).toHaveBeenCalledWith('!loaded:a.example', 'r1')
    expect(loadRoomMediaMock).toHaveBeenCalledWith('!loaded:a.example')
  })

  it('用户媒体隔离使用列表加载时的用户 ID 而非输入框当前值', async () => {
    state.userMedia = [
      {
        media_id: 'u1m',
        upload_name: 'user.png',
        media_type: 'image/png',
        media_length: 20,
        created_ts: 1700000000000
      }
    ]
    state.userMediaUserId = '@loaded:a.example'
    const wrapper = mountComponent()
    await flushPromises()

    const userCard = wrapper.findAll('[data-test="NCard"]')[1]
    await userCard.find('input[data-test="NInput"]').setValue('@other:b.example')
    const quarantine = userCard
      .findAll('button')
      .find((button) => button.text().includes('admin.media.action.quarantineUser'))
    await quarantine!.trigger('click')
    await flushPromises()

    expect(quarantineUserMock).toHaveBeenCalledWith('@loaded:a.example')
    expect(loadUserMediaMock).toHaveBeenCalledWith('@loaded:a.example')
  })
})
