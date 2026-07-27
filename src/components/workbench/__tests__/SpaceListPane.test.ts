import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, type PropType } from 'vue'
import type { SpaceListItem } from '../SpaceListPane.vue'
import SpaceListPane from '../SpaceListPane.vue'

// === Mocks ===
const { routerPushMock, triggerGlobalSearchMock } = vi.hoisted(() => ({
  routerPushMock: vi.fn(),
  triggerGlobalSearchMock: vi.fn()
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: routerPushMock })
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) => (params ? `${key}:${JSON.stringify(params)}` : key)
  })
}))

vi.mock('@vueuse/core', () => ({
  useDebounceFn: (fn: (value: string) => void) => (value: string) => fn(value)
}))

vi.mock('@/composables/search/useSearchShortcut', () => ({
  triggerGlobalSearch: triggerGlobalSearchMock
}))

vi.mock('vue-virtual-scroller', () => ({
  RecycleScroller: defineComponent({
    name: 'RecycleScroller',
    props: { items: Array, itemSize: Number, keyField: String },
    setup(props, { slots }) {
      return () =>
        h(
          'div',
          { class: 'recycle-scroller-stub' },
          ((props.items as SpaceListItem[]) || []).map((item) => slots.default?.({ item }))
        )
    }
  })
}))

vi.mock('naive-ui', () => {
  const stub = (name: string) =>
    defineComponent({
      name,
      setup(_, { slots }) {
        return () => h('div', { class: `n-${name.toLowerCase()}` }, [slots.default?.()])
      }
    })
  return {
    NInput: defineComponent({
      name: 'NInput',
      props: { value: { type: String, default: '' }, placeholder: String, clearable: Boolean },
      emits: ['update:value', 'keydown'],
      setup(props, { slots, emit }) {
        return () =>
          h('div', { class: 'n-input' }, [
            slots.prefix?.(),
            h('input', {
              class: 'n-input__input-el',
              value: props.value,
              onInput: (e: Event) => emit('update:value', (e.target as HTMLInputElement).value),
              onKeydown: (e: KeyboardEvent) => emit('keydown', e)
            }),
            slots.suffix?.()
          ])
      }
    }),
    NScrollbar: stub('Scrollbar'),
    NSkeleton: defineComponent({
      name: 'NSkeleton',
      props: { circle: Boolean, width: [String, Number], height: [String, Number], sharp: Boolean },
      setup() {
        return () => h('div', { class: 'n-skeleton' })
      }
    }),
    NFlex: stub('Flex'),
    NEmpty: defineComponent({
      name: 'NEmpty',
      props: { description: String, size: String },
      setup(props, { slots }) {
        return () => h('div', { class: 'n-empty' }, [slots.icon?.(), h('span', props.description), slots.extra?.()])
      }
    }),
    NButton: defineComponent({
      name: 'NButton',
      props: { size: String, type: String, block: Boolean, secondary: Boolean },
      emits: ['click'],
      setup(props, { slots, emit }) {
        return () =>
          h(
            'button',
            {
              class: ['n-button', `n-button--${props.type || 'default'}`],
              onClick: (e: MouseEvent) => emit('click', e)
            },
            [slots.icon?.(), slots.default?.()]
          )
      }
    }),
    NBadge: defineComponent({
      name: 'NBadge',
      props: { dot: Boolean, color: String },
      setup(_, { slots }) {
        return () => h('span', { class: 'n-badge' }, [slots.default?.()])
      }
    })
  }
})

// Stub SpaceListItemCard so we can test event bubbling without its internals
vi.mock('../SpaceListItemCard.vue', () => ({
  default: defineComponent({
    name: 'SpaceListItemCard',
    props: { space: { type: Object as PropType<SpaceListItem>, required: true }, active: Boolean },
    emits: ['click', 'pin', 'settings', 'leave', 'delete', 'contextmenu'],
    setup(props, { emit }) {
      return () =>
        h(
          'div',
          {
            class: ['space-card-stub', { 'space-card-stub--active': props.active }],
            'data-test': 'space-card',
            'data-space-id': props.space.spaceId,
            onClick: () => emit('click'),
            onContextmenu: (e: Event) => emit('contextmenu', { space: props.space, event: e })
          },
          [
            h('span', { class: 'space-card-stub__name' }, props.space.name),
            h(
              'button',
              {
                class: 'stub-pin',
                onClick: (e: Event) => {
                  e.stopPropagation()
                  emit('pin', props.space.spaceId)
                }
              },
              'pin'
            ),
            h(
              'button',
              {
                class: 'stub-settings',
                onClick: (e: Event) => {
                  e.stopPropagation()
                  emit('settings', props.space.spaceId)
                }
              },
              'settings'
            ),
            h(
              'button',
              {
                class: 'stub-leave',
                onClick: (e: Event) => {
                  e.stopPropagation()
                  emit('leave', props.space.spaceId)
                }
              },
              'leave'
            ),
            h(
              'button',
              {
                class: 'stub-delete',
                onClick: (e: Event) => {
                  e.stopPropagation()
                  emit('delete', props.space.spaceId)
                }
              },
              'delete'
            )
          ]
        )
    }
  })
}))

// === Fixtures ===
const createSpaces = (): SpaceListItem[] => [
  { spaceId: '!space-1:server', name: 'Design Team', childCount: 5, memberCount: 12, isPublic: false },
  { spaceId: '!space-2:server', name: 'Engineering', childCount: 8, memberCount: 30, isPublic: true },
  { spaceId: '!space-3:server', name: 'Marketing Hub', childCount: 3, memberCount: 8, isPublic: false }
]

const mountPane = (props: Partial<InstanceType<typeof SpaceListPane>['$props']> = {}) =>
  mount(SpaceListPane, {
    props: {
      spaces: createSpaces(),
      selectedSpaceId: '',
      loading: false,
      ...props
    }
  })

describe('SpaceListPane', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // (a) 渲染
  it('renders the space list pane with all spaces', () => {
    const wrapper = mountPane()
    expect(wrapper.find('[data-test="space-list-pane"]').exists()).toBe(true)
    const cards = wrapper.findAll('[data-test="space-card"]')
    expect(cards).toHaveLength(3)
    expect(wrapper.text()).toContain('Design Team')
    expect(wrapper.text()).toContain('Engineering')
    expect(wrapper.text()).toContain('Marketing Hub')
  })

  // (f) 骨架屏显示
  it('renders skeleton loading state when loading is true', () => {
    const wrapper = mountPane({ loading: true })
    const cards = wrapper.findAll('[data-test="space-card"]')
    expect(cards).toHaveLength(0)
    expect(wrapper.findAll('.n-skeleton').length).toBeGreaterThan(0)
  })

  // (b) 搜索过滤
  it('filters spaces by search keyword', async () => {
    const wrapper = mountPane()
    const input = wrapper.find('.n-input__input-el')
    await input.setValue('design')
    // 防抖被 mock 为同步执行
    await wrapper.vm.$nextTick()

    const cards = wrapper.findAll('[data-test="space-card"]')
    expect(cards).toHaveLength(1)
    expect(cards[0].text()).toContain('Design Team')
  })

  it('shows empty state when search yields no matches', async () => {
    const wrapper = mountPane()
    const input = wrapper.find('.n-input__input-el')
    await input.setValue('zzz-not-found')
    await wrapper.vm.$nextTick()

    expect(wrapper.findAll('[data-test="space-card"]')).toHaveLength(0)
    expect(wrapper.find('.n-empty').exists()).toBe(true)
  })

  // (c) 选中空间 emit
  it('emits selectSpace when clicking a space card', async () => {
    const wrapper = mountPane()
    const cards = wrapper.findAll('[data-test="space-card"]')
    await cards[0].trigger('click')

    expect(wrapper.emitted('selectSpace')).toBeTruthy()
    expect(wrapper.emitted('selectSpace')![0]).toEqual(['!space-1:server'])
  })

  // (d) 置顶/离开/删除 emit
  it('emits pinSpace when clicking pin action', async () => {
    const wrapper = mountPane()
    const pinBtn = wrapper.findAll('[data-test="space-card"]')[0].find('.stub-pin')
    await pinBtn.trigger('click')

    expect(wrapper.emitted('pinSpace')).toBeTruthy()
    expect(wrapper.emitted('pinSpace')![0]).toEqual(['!space-1:server'])
  })

  it('emits spaceSettings when clicking settings action', async () => {
    const wrapper = mountPane()
    const settingsBtn = wrapper.findAll('[data-test="space-card"]')[0].find('.stub-settings')
    await settingsBtn.trigger('click')

    expect(wrapper.emitted('spaceSettings')).toBeTruthy()
    expect(wrapper.emitted('spaceSettings')![0]).toEqual(['!space-1:server'])
  })

  it('emits leaveSpace when clicking leave action', async () => {
    const wrapper = mountPane()
    const leaveBtn = wrapper.findAll('[data-test="space-card"]')[0].find('.stub-leave')
    await leaveBtn.trigger('click')

    expect(wrapper.emitted('leaveSpace')).toBeTruthy()
    expect(wrapper.emitted('leaveSpace')![0]).toEqual(['!space-1:server'])
  })

  it('emits deleteSpace when clicking delete action', async () => {
    const wrapper = mountPane()
    const deleteBtn = wrapper.findAll('[data-test="space-card"]')[0].find('.stub-delete')
    await deleteBtn.trigger('click')

    expect(wrapper.emitted('deleteSpace')).toBeTruthy()
    expect(wrapper.emitted('deleteSpace')![0]).toEqual(['!space-1:server'])
  })

  // (e) 创建空间 emit
  it('emits createSpace when clicking the create button', async () => {
    const wrapper = mountPane()
    // 底部有两个按钮，第一个是"创建空间"
    const footerButtons = wrapper.findAll('.space-list-pane__footer-btn')
    expect(footerButtons.length).toBeGreaterThanOrEqual(1)
    await footerButtons[0].trigger('click')

    expect(wrapper.emitted('createSpace')).toBeTruthy()
  })

  it('navigates to /search?type=space when clicking discover button', async () => {
    const wrapper = mountPane()
    const footerButtons = wrapper.findAll('.space-list-pane__footer-btn')
    // 第二个按钮是"发现空间"
    await footerButtons[1].trigger('click')

    expect(routerPushMock).toHaveBeenCalledWith('/search?type=space')
  })

  // 过滤标签
  it('filters to my spaces only when activeFilter is my', async () => {
    const wrapper = mountPane()
    const filterTabs = wrapper.findAll('.space-list-pane__filter-tab')
    // 三个 tab：all / my / public
    expect(filterTabs).toHaveLength(3)
    await filterTabs[1].trigger('click') // my
    await wrapper.vm.$nextTick()

    const cards = wrapper.findAll('[data-test="space-card"]')
    // isPublic: false 的空间有 2 个 (Design Team, Marketing Hub)
    expect(cards).toHaveLength(2)
    expect(wrapper.text()).toContain('Design Team')
    expect(wrapper.text()).toContain('Marketing Hub')
    expect(wrapper.text()).not.toContain('Engineering')
  })

  it('filters to public spaces only when activeFilter is public', async () => {
    const wrapper = mountPane()
    const filterTabs = wrapper.findAll('.space-list-pane__filter-tab')
    await filterTabs[2].trigger('click') // public
    await wrapper.vm.$nextTick()

    const cards = wrapper.findAll('[data-test="space-card"]')
    expect(cards).toHaveLength(1)
    expect(wrapper.text()).toContain('Engineering')
  })

  // Esc 清空搜索
  it('clears search on Esc key', async () => {
    const wrapper = mountPane()
    const input = wrapper.find('.n-input__input-el')
    await input.setValue('design')
    await wrapper.vm.$nextTick()
    expect(wrapper.findAll('[data-test="space-card"]')).toHaveLength(1)

    await input.trigger('keydown.esc')
    await wrapper.vm.$nextTick()

    expect(wrapper.findAll('[data-test="space-card"]')).toHaveLength(3)
  })

  // 全局搜索按钮
  it('triggers global search when clicking the expand button', async () => {
    const wrapper = mountPane()
    const globalBtn = wrapper.find('.space-list-pane__search-global')
    await globalBtn.trigger('click')

    expect(triggerGlobalSearchMock).toHaveBeenCalled()
  })

  it('marks the active space card with active class', () => {
    // 非虚拟路径分为"我的空间"组(isPublic:false) + "公开空间"组(isPublic:true)
    // 渲染顺序：[!space-1(Design), !space-3(Marketing), !space-2(Engineering)]
    const wrapper = mountPane({ selectedSpaceId: '!space-2:server' })
    const cards = wrapper.findAll('[data-test="space-card"]')
    expect(cards[0].classes()).not.toContain('space-card-stub--active')
    expect(cards[2].classes()).toContain('space-card-stub--active')
  })
})
