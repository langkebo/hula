import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MjolnirSettings from '../MjolnirSettings.vue'

const showToastMock = vi.fn()
const showDialogMock = vi.fn().mockResolvedValue(undefined)

vi.mock('vant', () => ({
  showToast: (...args: any[]) => showToastMock(...args),
  showDialog: (...args: any[]) => showDialogMock(...args)
}))

vi.mock('@iconify/vue', () => ({
  Icon: { name: 'Icon', template: '<i />', props: ['icon', 'width', 'color'] }
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

vi.mock('@/mobile/components/chat-room/AutoFixHeightPage.vue', () => ({
  default: {
    name: 'AutoFixHeightPage',
    template: '<div class="auto-fix"><slot name="header" /><slot name="container" /></div>',
    props: ['showFooter']
  }
}))

vi.mock('@/mobile/components/chat-room/HeaderBar.vue', () => ({
  default: {
    name: 'HeaderBar',
    template: '<div class="header-bar" />',
    props: ['border', 'isOfficial', 'hiddenRight', 'roomName']
  }
}))

describe('MjolnirSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('renders correctly', () => {
    const wrapper = mount(MjolnirSettings)
    expect(wrapper.html()).toBeTruthy()
  })

  it('has empty ban lists by default', () => {
    const wrapper = mount(MjolnirSettings)
    expect((wrapper.vm as any).roomBans).toHaveLength(0)
    expect((wrapper.vm as any).userBans).toHaveLength(0)
    expect((wrapper.vm as any).serverBans).toHaveLength(0)
  })

  it('loads ban lists from localStorage', () => {
    localStorage.setItem(
      'hula-mjolnir-ban-lists',
      JSON.stringify({
        room: [{ entity: '#room:test.com', reason: 'spam' }],
        user: [{ entity: '@user:test.com', reason: 'abuse' }],
        server: [{ entity: 'bad.server', reason: '' }]
      })
    )
    const wrapper = mount(MjolnirSettings)
    expect((wrapper.vm as any).roomBans).toHaveLength(1)
    expect((wrapper.vm as any).userBans).toHaveLength(1)
    expect((wrapper.vm as any).serverBans).toHaveLength(1)
  })

  it('adds room ban', () => {
    const wrapper = mount(MjolnirSettings)
    ;(wrapper.vm as any).newRoomBan.entity = '#bad:test.com'
    ;(wrapper.vm as any).newRoomBan.reason = 'spam'
    ;(wrapper.vm as any).addBan('room')
    expect((wrapper.vm as any).roomBans).toHaveLength(1)
    expect((wrapper.vm as any).roomBans[0].entity).toBe('#bad:test.com')
    expect((wrapper.vm as any).roomBans[0].reason).toBe('spam')
    const saved = JSON.parse(localStorage.getItem('hula-mjolnir-ban-lists')!)
    expect(saved.room).toHaveLength(1)
  })

  it('rejects empty entity when adding ban', () => {
    const wrapper = mount(MjolnirSettings)
    ;(wrapper.vm as any).newRoomBan.entity = '  '
    ;(wrapper.vm as any).addBan('room')
    expect((wrapper.vm as any).roomBans).toHaveLength(0)
    expect(showToastMock).toHaveBeenCalledWith(expect.any(String))
  })

  it('adds user ban', () => {
    const wrapper = mount(MjolnirSettings)
    ;(wrapper.vm as any).newUserBan.entity = '@bad:test.com'
    ;(wrapper.vm as any).newUserBan.reason = ''
    ;(wrapper.vm as any).addBan('user')
    expect((wrapper.vm as any).userBans).toHaveLength(1)
  })

  it('adds server ban', () => {
    const wrapper = mount(MjolnirSettings)
    ;(wrapper.vm as any).newServerBan.entity = 'evil.server'
    ;(wrapper.vm as any).newServerBan.reason = 'malicious'
    ;(wrapper.vm as any).addBan('server')
    expect((wrapper.vm as any).serverBans).toHaveLength(1)
  })

  it('removes ban with confirmation', async () => {
    localStorage.setItem(
      'hula-mjolnir-ban-lists',
      JSON.stringify({
        room: [
          { entity: '#r1:test.com', reason: '' },
          { entity: '#r2:test.com', reason: '' }
        ],
        user: [],
        server: []
      })
    )
    const wrapper = mount(MjolnirSettings)
    await (wrapper.vm as any).removeBan('room', 0)
    expect((wrapper.vm as any).roomBans).toHaveLength(1)
    expect((wrapper.vm as any).roomBans[0].entity).toBe('#r2:test.com')
  })

  it('clears form after adding ban', () => {
    const wrapper = mount(MjolnirSettings)
    ;(wrapper.vm as any).newRoomBan.entity = '#test:test.com'
    ;(wrapper.vm as any).newRoomBan.reason = 'test'
    ;(wrapper.vm as any).addBan('room')
    expect((wrapper.vm as any).newRoomBan.entity).toBe('')
    expect((wrapper.vm as any).newRoomBan.reason).toBe('')
  })

  it('closes popup after adding ban', () => {
    const wrapper = mount(MjolnirSettings)
    ;(wrapper.vm as any).showAddRoomBan = true
    ;(wrapper.vm as any).newRoomBan.entity = '#test:test.com'
    ;(wrapper.vm as any).addBan('room')
    expect((wrapper.vm as any).showAddRoomBan).toBe(false)
  })
})
