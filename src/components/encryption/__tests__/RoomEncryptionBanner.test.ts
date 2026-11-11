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

const warningRows = (wrapper: ReturnType<typeof mountBanner>) =>
  wrapper.findAll('[data-testid="room-encryption-banner"] > span')

describe('RoomEncryptionBanner', () => {
  it('无告警时不渲染', () => {
    expect(mountBanner([]).find('[data-testid="room-encryption-banner"]').exists()).toBe(false)
  })

  it('按告警数量与顺序渲染映射后的文案', () => {
    const wrapper = mountBanner(['backup_disabled', 'keys_local_only'])
    const rows = warningRows(wrapper)
    expect(rows).toHaveLength(2)
    expect(rows.map((row) => row.text())).toEqual(['密钥备份未开启', '安全密钥只存在本机'])
  })

  it('crypto_init_failed 使用对应静态 key 渲染', () => {
    const wrapper = mountBanner(['crypto_init_failed'])
    const rows = warningRows(wrapper)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.text()).toBe('加密模块初始化失败')
  })
})
