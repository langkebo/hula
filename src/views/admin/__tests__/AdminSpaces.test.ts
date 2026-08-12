import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import AdminSpaces from '../AdminSpaces.vue'

const { loadSpacesMock, selectSpaceMock, deleteSpaceMock, showFeedbackMock, handleAdminErrorMock, state } = vi.hoisted(
  () => ({
    loadSpacesMock: vi.fn(),
    selectSpaceMock: vi.fn(),
    deleteSpaceMock: vi.fn(),
    showFeedbackMock: vi.fn(),
    handleAdminErrorMock: vi.fn(() => true),
    state: {
      spaces: [] as Array<{
        spaceId: string
        name?: string
        creator?: string
        memberCount?: number
        roomCount?: number
        createdAt?: number
      }>,
      spacesLoading: false,
      selectedSpace: null as Record<string, unknown> | null,
      selectedSpaceId: null as string | null,
      spaceUsers: [] as Array<Record<string, unknown>>,
      spaceRooms: [] as Array<Record<string, unknown>>,
      spaceStats: null as Record<string, unknown> | null,
      detailLoading: false,
      isAdmin: true
    }
  })
)

vi.mock('@/composables/admin', () => ({
  useAdminSpaces: () => ({
    spaces: ref(state.spaces),
    spacesLoading: ref(state.spacesLoading),
    selectedSpace: ref(state.selectedSpace),
    selectedSpaceId: ref(state.selectedSpaceId),
    spaceUsers: ref(state.spaceUsers),
    spaceRooms: ref(state.spaceRooms),
    spaceStats: ref(state.spaceStats),
    detailLoading: ref(state.detailLoading),
    loadSpaces: loadSpacesMock,
    selectSpace: selectSpaceMock,
    deleteSpace: deleteSpaceMock
  })
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({
    showFeedback: showFeedbackMock
  })
}))

vi.mock('@/stores/domains/admin/admin', () => ({
  useAdminStore: () => ({
    get isAdmin() {
      return state.isAdmin
    }
  })
}))

vi.mock('@/views/admin/useAdminError', () => ({
  useAdminErrorHandler: () => ({
    handleAdminError: handleAdminErrorMock
  })
}))

vi.mock('naive-ui', async () => {
  const { defineComponent, h } = await import('vue')

  const passthrough = (name: string, tag = 'div') =>
    defineComponent({
      name,
      props: [
        'show',
        'title',
        'value',
        'type',
        'animated',
        'name',
        'tab',
        'bordered',
        'column',
        'labelPlacement',
        'span',
        'size',
        'label',
        'description'
      ],
      setup(props, { slots }) {
        return () =>
          h(tag, { 'data-test': name }, [
            props.label ? h('span', { 'data-test': `${name}-label` }, String(props.label)) : null,
            props.value !== undefined ? h('span', { 'data-test': `${name}-value` }, String(props.value)) : null,
            props.description ? h('span', String(props.description)) : null,
            slots.default?.(),
            slots.prefix?.()
          ])
      }
    })

  return {
    NButton: defineComponent({
      name: 'NButton',
      props: ['loading', 'type', 'size'],
      emits: ['click'],
      setup(_, { slots, emit }) {
        return () => h('button', { type: 'button', onClick: () => emit('click') }, slots.default?.())
      }
    }),
    NDataTable: defineComponent({
      name: 'NDataTable',
      props: ['data', 'columns', 'loading', 'pagination', 'rowKey', 'striped', 'bordered', 'size'],
      setup(props) {
        return () => h('div', { 'data-test': 'NDataTable' }, JSON.stringify(props.data ?? []))
      }
    }),
    NDescriptions: passthrough('NDescriptions'),
    NDescriptionsItem: passthrough('NDescriptionsItem'),
    NEmpty: passthrough('NEmpty'),
    NInput: defineComponent({
      name: 'NInput',
      props: ['value', 'placeholder', 'clearable'],
      emits: ['update:value'],
      setup(props, { emit, slots }) {
        return () =>
          h('div', { 'data-test': 'NInput' }, [
            h('input', {
              value: props.value as string,
              onInput: (e: Event) => emit('update:value', (e.target as HTMLInputElement).value)
            }),
            slots.prefix?.()
          ])
      }
    }),
    NPopconfirm: defineComponent({
      name: 'NPopconfirm',
      emits: ['positiveClick'],
      setup(_, { slots, emit }) {
        return () =>
          h('div', { 'data-test': 'NPopconfirm' }, [
            slots.trigger?.(),
            h('button', { 'data-test': 'popconfirm-yes', onClick: () => emit('positiveClick') }, 'yes')
          ])
      }
    }),
    NSpace: passthrough('NSpace'),
    NSpin: passthrough('NSpin'),
    NStatistic: passthrough('NStatistic'),
    NTabPane: passthrough('NTabPane'),
    NTabs: passthrough('NTabs'),
    NTag: defineComponent({
      name: 'NTag',
      props: ['type', 'size'],
      setup(_, { slots }) {
        return () => h('span', { 'data-test': 'NTag' }, slots.default?.())
      }
    })
  }
})

describe('AdminSpaces', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.spaces = [
      {
        spaceId: '!space1:server',
        name: 'Team Alpha',
        creator: '@admin:server',
        memberCount: 12,
        roomCount: 4,
        createdAt: 1700000000000
      },
      { spaceId: '!space2:server', name: 'Public Beta', creator: '@bob:server', memberCount: 30, roomCount: 8 }
    ]
    state.spacesLoading = false
    state.selectedSpace = null
    state.selectedSpaceId = null
    state.spaceUsers = []
    state.spaceRooms = []
    state.spaceStats = null
    state.detailLoading = false
    state.isAdmin = true
    loadSpacesMock.mockResolvedValue(undefined)
    selectSpaceMock.mockResolvedValue(undefined)
    deleteSpaceMock.mockResolvedValue(undefined)
  })

  const mountComponent = () => mount(AdminSpaces)

  it('管理员挂载时加载空间列表', async () => {
    mountComponent()
    await flushPromises()

    expect(loadSpacesMock).toHaveBeenCalledTimes(1)
  })

  it('非管理员挂载时不加载空间列表', async () => {
    state.isAdmin = false
    mountComponent()
    await flushPromises()

    expect(loadSpacesMock).not.toHaveBeenCalled()
  })

  it('渲染空间数据到表格', async () => {
    const wrapper = mountComponent()
    await flushPromises()

    const table = wrapper.findComponent({ name: 'NDataTable' })
    expect(table.text()).toContain('!space1:server')
    expect(table.text()).toContain('Team Alpha')
  })

  it('搜索框按名称过滤空间', async () => {
    const wrapper = mountComponent()
    await flushPromises()

    const searchInput = wrapper.find('input')
    await searchInput.setValue('alpha')
    await flushPromises()

    const table = wrapper.findComponent({ name: 'NDataTable' })
    expect(table.text()).toContain('!space1:server')
    expect(table.text()).not.toContain('!space2:server')
  })

  it('搜索框按创建者过滤空间', async () => {
    const wrapper = mountComponent()
    await flushPromises()

    const searchInput = wrapper.find('input')
    await searchInput.setValue('@bob')
    await flushPromises()

    const table = wrapper.findComponent({ name: 'NDataTable' })
    expect(table.text()).toContain('!space2:server')
    expect(table.text()).not.toContain('!space1:server')
  })

  it('点击刷新按钮重新加载', async () => {
    const wrapper = mountComponent()
    await flushPromises()
    loadSpacesMock.mockClear()

    const refreshButton = wrapper.findAll('button').find((b) => b.text().includes('admin.common.refresh'))
    await refreshButton!.trigger('click')
    await flushPromises()

    expect(loadSpacesMock).toHaveBeenCalledTimes(1)
  })
})
