import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { EncryptionWarningKey } from '@/composables/encryption/useRoomEncryptionStatus'
import RoomEncryptionBanner from '../RoomEncryptionBanner.vue'

const messages: Record<string, string> = {
  'chat.encryption_banner.backup_disabled': '密钥备份未开启',
  'chat.encryption_banner.keys_local_only': '安全密钥只存在本机',
  'chat.encryption_banner.crypto_init_failed': '加密模块初始化失败'
}

const mountBanner = (warnings: EncryptionWarningKey[]) =>
  mount(RoomEncryptionBanner, {
    props: { warnings },
    global: { mocks: { $t: (key: string) => messages[key] ?? key } }
  })

describe('RoomEncryptionBanner', () => {
  it('无告警时不渲染', () => {
    expect(mountBanner([]).find('[data-test="room-encryption-banner"]').exists()).toBe(false)
  })

  it('逐条渲染告警文案', () => {
    const wrapper = mountBanner(['backup_disabled', 'keys_local_only'])
    expect(wrapper.text()).toContain('密钥备份未开启')
    expect(wrapper.text()).toContain('安全密钥只存在本机')
  })
})
