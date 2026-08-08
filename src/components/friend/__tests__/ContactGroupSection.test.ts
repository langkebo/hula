import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { OnlineEnum } from '@/enums'
import type { MatrixContact } from '@/stores/domains/chat/contacts'
import ContactGroupSection from '../ContactGroupSection.vue'

const safeHtmlDirective = {
  mounted(el: HTMLElement, binding: { value?: string }) {
    el.innerHTML = binding.value ?? ''
  },
  updated(el: HTMLElement, binding: { value?: string }) {
    el.innerHTML = binding.value ?? ''
  }
}

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

vi.mock('@/stores/domains/settings/setting', () => ({
  useSettingStore: () => ({
    themeContent: 'light'
  })
}))

vi.mock('@/utils/AvatarUtils', () => ({
  AvatarUtils: {
    getAvatarUrl: (url?: string) => url ?? ''
  }
}))

vi.mock('naive-ui', () => {
  const passthrough = (name: string) =>
    defineComponent({
      name,
      setup(_, { slots }) {
        return () => h('div', { 'data-test': name }, slots.default?.())
      }
    })

  return {
    NBadge: passthrough('NBadge'),
    NAvatar: passthrough('NAvatar'),
    NTag: passthrough('NTag'),
    NButton: defineComponent({
      name: 'NButton',
      emits: ['click'],
      setup(_, { emit, slots }) {
        return () =>
          h(
            'button',
            {
              type: 'button',
              'data-test': 'NButton',
              onClick: (event: Event) => emit('click', event)
            },
            [...(slots.icon?.() ?? []), ...(slots.default?.() ?? [])]
          )
      }
    })
  }
})

const makeContact = (overrides: Partial<MatrixContact> = {}): MatrixContact => ({
  userId: '@user:example.com',
  displayName: 'User',
  avatarUrl: null,
  uid: '@user:example.com',
  name: 'user',
  account: 'user',
  avatar: '',
  activeStatus: OnlineEnum.OFFLINE,
  remark: '',
  lastOptTime: 0,
  hideMyPosts: false,
  hideTheirPosts: false,
  ...overrides
})

describe('ContactGroupSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const mountSection = (props: {
    groupName: string
    friends: MatrixContact[]
    collapsed: boolean
    selectedUserId?: string
    query?: string
  }) =>
    mount(ContactGroupSection, {
      props,
      global: {
        directives: {
          'safe-html': safeHtmlDirective
        }
      }
    })

  it('renders group name and member count in the header', () => {
    const friends = [makeContact({ userId: '@a:ex.com' }), makeContact({ userId: '@b:ex.com' })]
    const wrapper = mountSection({
      groupName: 'Design Team',
      friends,
      collapsed: false
    })

    expect(wrapper.get('[data-test="group-name"]').text()).toBe('Design Team')
    expect(wrapper.get('[data-test="group-count"]').text()).toBe('2')
  })

  it('renders friend items when not collapsed', () => {
    const friends = [makeContact({ userId: '@a:ex.com' }), makeContact({ userId: '@b:ex.com' })]
    const wrapper = mountSection({
      groupName: 'Test Group',
      friends,
      collapsed: false
    })

    expect(wrapper.findAll('.friend-list-item')).toHaveLength(2)
  })

  it('hides friend items when collapsed', () => {
    const friends = [makeContact({ userId: '@a:ex.com' })]
    const wrapper = mountSection({
      groupName: 'Test Group',
      friends,
      collapsed: true
    })

    const body = wrapper.find('.contact-group-section__body')
    expect((body.element as HTMLElement).style.display).toBe('none')
  })

  it('emits toggle when header is clicked', async () => {
    const friends = [makeContact({ userId: '@a:ex.com' })]
    const wrapper = mountSection({
      groupName: 'Test Group',
      friends,
      collapsed: false
    })

    await wrapper.get('[data-test="group-header"]').trigger('click')

    expect(wrapper.emitted('toggle')).toBeTruthy()
    expect(wrapper.emitted('toggle')).toHaveLength(1)
  })

  it('emits select-friend when a friend item is clicked', async () => {
    const friend = makeContact({ userId: '@alice:ex.com' })
    const wrapper = mountSection({
      groupName: 'Test Group',
      friends: [friend],
      collapsed: false
    })

    await wrapper.get('.friend-list-item').trigger('click')

    expect(wrapper.emitted('select-friend')).toBeTruthy()
    expect(wrapper.emitted('select-friend')![0]).toEqual([friend])
  })

  it('shows aria-expanded=true when not collapsed', () => {
    const wrapper = mountSection({
      groupName: 'Test Group',
      friends: [makeContact()],
      collapsed: false
    })

    expect(wrapper.get('[data-test="group-header"]').attributes('aria-expanded')).toBe('true')
  })

  it('shows aria-expanded=false when collapsed', () => {
    const wrapper = mountSection({
      groupName: 'Test Group',
      friends: [makeContact()],
      collapsed: true
    })

    expect(wrapper.get('[data-test="group-header"]').attributes('aria-expanded')).toBe('false')
  })

  it('rotates arrow icon when collapsed', () => {
    const wrapperCollapsed = mountSection({
      groupName: 'Test',
      friends: [makeContact()],
      collapsed: true
    })
    const wrapperExpanded = mountSection({
      groupName: 'Test',
      friends: [makeContact()],
      collapsed: false
    })

    const arrowCollapsed = wrapperCollapsed.get('[data-test="group-arrow"]')
    const arrowExpanded = wrapperExpanded.get('[data-test="group-arrow"]')

    expect(arrowCollapsed.classes()).toContain('contact-group-section__arrow--collapsed')
    expect(arrowExpanded.classes()).not.toContain('contact-group-section__arrow--collapsed')
  })

  it('renders zero count when friends list is empty', () => {
    const wrapper = mountSection({
      groupName: 'Empty Group',
      friends: [],
      collapsed: false
    })

    expect(wrapper.get('[data-test="group-count"]').text()).toBe('0')
    expect(wrapper.findAll('.friend-list-item')).toHaveLength(0)
  })

  it('passes selectedUserId prop to FriendListItem', () => {
    const friends = [makeContact({ userId: '@alice:ex.com' }), makeContact({ userId: '@bob:ex.com' })]
    const wrapper = mountSection({
      groupName: 'Test Group',
      friends,
      collapsed: false,
      selectedUserId: '@alice:ex.com'
    })

    const items = wrapper.findAll('.friend-list-item')
    expect(items[0]?.classes('friend-list-item--selected')).toBe(true)
    expect(items[1]?.classes('friend-list-item--selected')).toBe(false)
  })

  it('emits send-message when FriendListItem send-message is triggered', async () => {
    const friend = makeContact({ userId: '@alice:ex.com' })
    const wrapper = mountSection({
      groupName: 'Test Group',
      friends: [friend],
      collapsed: false
    })

    const buttons = wrapper.findAll('.friend-list-item button')
    // First button is send-message
    await buttons[0]!.trigger('click')

    expect(wrapper.emitted('send-message')).toBeTruthy()
    expect(wrapper.emitted('send-message')![0]).toEqual([friend])
  })

  it('emits remove when FriendListItem remove is triggered', async () => {
    const friend = makeContact({ userId: '@alice:ex.com' })
    const wrapper = mountSection({
      groupName: 'Test Group',
      friends: [friend],
      collapsed: false
    })

    const buttons = wrapper.findAll('.friend-list-item button')
    // Second button is remove
    await buttons[1]!.trigger('click')

    expect(wrapper.emitted('remove')).toBeTruthy()
    expect(wrapper.emitted('remove')![0]).toEqual([friend])
  })
})
