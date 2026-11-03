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
      userMedia: [] as Array<Record<string, unknown>>,
      userMediaLoading: false,
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
    userMedia: ref(state.userMedia),
    userMediaLoading: ref(state.userMediaLoading),
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
      setup(_, { slots, emit }) {
        return () => h('button', { type: 'button', onClick: () => emit('click') }, slots.default?.())
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
    NDrawer: passthrough('NDrawer'),
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
    NModal: passthrough('NModal'),
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
    expect(button).toBeTruthy()
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
    expect(button).toBeTruthy()
    await button!.trigger('click')
    await flushPromises()

    expect(loadMoreLibraryMock).toHaveBeenCalledTimes(1)
  })

  it('全局隔离变更流为空时展示空态', async () => {
    const wrapper = mountComponent()
    await flushPromises()

    expect(wrapper.text()).toContain('admin.media.empty.changes')
  })
})
