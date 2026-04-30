import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { RoomTypeEnum } from '@/enums'
import ChatHeaderInfo from '../ChatHeaderInfo.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: { count?: number }) => {
      if (key === 'home.chat_header.member_count') {
        return `${params?.count ?? 0} members`
      }

      const messages: Record<string, string> = {
        'home.chat_header.channel': 'Channel',
        'components.encryptionStatus.encrypted': 'Encrypted',
        'components.encryptionStatus.unencrypted': 'Not encrypted',
        'components.encryptionStatus.unknown': 'Checking security',
        'components.encryptionStatus.error': 'Security issue',
        'components.encryptionStatus.encryptedTooltip': 'Encrypted tooltip',
        'components.encryptionStatus.unencryptedTooltip': 'Unencrypted tooltip',
        'components.encryptionStatus.unknownTooltip': 'Unknown tooltip',
        'components.encryptionStatus.errorTooltip': 'Error tooltip'
      }

      return messages[key] ?? key
    }
  })
}))

vi.mock('naive-ui', () => {
  const simpleStub = (name: string) =>
    defineComponent({
      name,
      setup(_, { slots, attrs }) {
        return () => h('div', attrs, slots.default?.())
      }
    })

  return {
    NAvatar: simpleStub('NAvatar'),
    NTag: simpleStub('NTag'),
    NTooltip: defineComponent({
      name: 'NTooltip',
      setup(_, { slots }) {
        return () => h('div', { 'data-test': 'tooltip' }, [slots.trigger?.(), slots.default?.()])
      }
    })
  }
})

describe('ChatHeaderInfo', () => {
  it('renders encryption status alongside group metadata', () => {
    const wrapper = mount(ChatHeaderInfo, {
      props: {
        name: 'Secure Room',
        avatar: '',
        type: RoomTypeEnum.GROUP,
        memberCount: 3,
        isOnline: false,
        statusIcon: null,
        statusTitle: '',
        isBotUser: false,
        encryptionStatus: 'encrypted'
      }
    })

    expect(wrapper.text()).toContain('3 members')
    expect(wrapper.text()).toContain('Encrypted')
  })

  it('renders direct message presence and unencrypted state together', () => {
    const wrapper = mount(ChatHeaderInfo, {
      props: {
        name: 'Alex',
        avatar: '',
        type: RoomTypeEnum.SINGLE,
        memberCount: 0,
        isOnline: true,
        statusIcon: null,
        statusTitle: 'Online',
        isBotUser: false,
        encryptionStatus: 'unencrypted'
      }
    })

    expect(wrapper.text()).toContain('Online')
    expect(wrapper.text()).toContain('Not encrypted')
  })
})
