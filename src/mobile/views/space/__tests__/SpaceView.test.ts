import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, ref } from 'vue'
import SpaceView from '../SpaceView.vue'

/**
 * 移动端空间列表四态。
 *
 * 回归背景：读取失败曾被渲染成「暂无空间」，用户会误以为空间全部丢失。
 */

const { loadSpacesMock } = vi.hoisted(() => ({ loadSpacesMock: vi.fn(async () => undefined) }))

const spacesRef = ref<Array<Record<string, unknown>>>([])
const loadingRef = ref(false)
const errorRef = ref<string | null>(null)

vi.mock('vant', () => ({ showToast: vi.fn() }))
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('@/composables/space', () => ({
  useSpaces: () => ({
    spaces: computed(() => spacesRef.value),
    loading: computed(() => loadingRef.value),
    error: computed(() => errorRef.value),
    load: loadSpacesMock
  }),
  useSpace: () => ({
    mutating: ref(false),
    update: vi.fn(),
    getTreePath: vi.fn(async () => [])
  }),
  useSpaceMembers: () => ({ mutating: ref(false), invite: vi.fn() }),
  useSpaceRooms: () => ({ mutating: ref(false), addRoom: vi.fn() })
}))
vi.mock('@/composables/user/useAvatarUpload', () => ({
  useAvatarUpload: () => ({
    localImageUrl: ref(''),
    showCropper: ref(false),
    cropperRef: ref(null),
    fileInput: ref(null),
    openAvatarCropper: vi.fn(),
    handleFileChange: vi.fn(),
    handleCrop: vi.fn()
  })
}))
vi.mock('@/services/matrix/room/MatrixSpaceService', () => ({
  matrixSpaceService: { leaveSpace: vi.fn(), deleteSpace: vi.fn(), updateSpace: vi.fn() }
}))

const PassThrough = defineComponent({
  name: 'PassThrough',
  template: '<div><slot name="header" /><slot name="container" /><slot /></div>'
})

const MobileAsyncStateStub = defineComponent({
  name: 'MobileAsyncState',
  props: ['state', 'errorText', 'emptyText', 'testId', 'minHeight'],
  emits: ['retry'],
  template: '<div :data-testid="testId + \'-\' + state" />'
})

const mountView = () =>
  mount(SpaceView, {
    global: {
      stubs: {
        AutoFixHeightPage: PassThrough,
        HeaderBar: true,
        SpaceCard: true,
        SpaceCreateSheet: true,
        SpaceMemberList: true,
        SpaceChildrenList: true,
        MobileAsyncState: MobileAsyncStateStub
      }
    }
  })

describe('MobileSpaceView 四态', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    spacesRef.value = []
    loadingRef.value = false
    errorRef.value = null
  })

  it('加载中展示 loading 态', async () => {
    loadingRef.value = true
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.find('[data-testid="space-list-loading"]').exists()).toBe(true)
  })

  it('加载失败展示 error 态与重试，而不是「暂无空间」', async () => {
    errorRef.value = 'network down'
    const wrapper = mountView()
    await flushPromises()

    const errorState = wrapper.find('[data-testid="space-list-error"]')
    expect(errorState.exists()).toBe(true)
    expect(wrapper.find('[data-testid="space-list-empty"]').exists()).toBe(false)
  })

  it('重试时重新调用 load', async () => {
    errorRef.value = 'network down'
    const wrapper = mountView()
    await flushPromises()

    await wrapper.findComponent(MobileAsyncStateStub).vm.$emit('retry')
    expect(loadSpacesMock).toHaveBeenCalled()
  })

  it('真正的空列表才展示 empty 态', async () => {
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.find('[data-testid="space-list-empty"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="space-list-error"]').exists()).toBe(false)
  })

  it('有数据时展示空间卡片', async () => {
    spacesRef.value = [{ spaceId: '!a:server', name: 'A', childCount: 0, memberCount: 1 }]
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.find('.space-grid').exists()).toBe(true)
    expect(wrapper.find('[data-testid="space-list-empty"]').exists()).toBe(false)
  })
})
