import { describe, expect, it, vi } from 'vitest'
import { useInvitePermissionFilter } from '@/composables/app/useInvitePermissionFilter'

const ACCOUNT_DATA_TYPE = 'im.hula.invite_blocklist'

function createClientMock(storedConfig: Record<string, unknown> | null) {
  return {
    getAccountData: vi.fn((type: string) => {
      if (type === ACCOUNT_DATA_TYPE && storedConfig) {
        return { getContent: () => storedConfig }
      }
      return undefined
    }),
    setAccountData: vi.fn().mockResolvedValue(undefined)
  }
}

describe('useInvitePermissionFilter — 邀请权限过滤 (§8.3)', () => {
  it('allow_all 模式下不拒绝任何邀请', async () => {
    const client = createClientMock({ mode: 'allow_all', blocklist: [], allowlist: [] })
    const filter = useInvitePermissionFilter(client as never)

    await filter.loadConfig()
    expect(filter.shouldRejectInvite('@spammer:server')).toBe(false)
    expect(filter.shouldRejectInvite('@anyone:server')).toBe(false)
  })

  it('blocklist 模式下拒绝黑名单用户的邀请', async () => {
    const client = createClientMock({
      mode: 'blocklist',
      blocklist: ['@spammer:server', '@bad:evil.org'],
      allowlist: []
    })
    const filter = useInvitePermissionFilter(client as never)

    await filter.loadConfig()
    expect(filter.shouldRejectInvite('@spammer:server')).toBe(true)
    expect(filter.shouldRejectInvite('@bad:evil.org')).toBe(true)
    expect(filter.shouldRejectInvite('@friend:server')).toBe(false)
  })

  it('allowlist 模式下拒绝非白名单用户的邀请', async () => {
    const client = createClientMock({
      mode: 'allowlist',
      blocklist: [],
      allowlist: ['@friend:server', '@colleague:server']
    })
    const filter = useInvitePermissionFilter(client as never)

    await filter.loadConfig()
    expect(filter.shouldRejectInvite('@friend:server')).toBe(false)
    expect(filter.shouldRejectInvite('@colleague:server')).toBe(false)
    expect(filter.shouldRejectInvite('@stranger:server')).toBe(true)
  })

  it('未加载配置时默认不拒绝（allow_all 行为）', async () => {
    const client = createClientMock(null)
    const filter = useInvitePermissionFilter(client as never)

    // 未调用 loadConfig，使用默认值
    expect(filter.shouldRejectInvite('@anyone:server')).toBe(false)
  })

  it('更新配置后持久化到 account data', async () => {
    const client = createClientMock(null)
    const filter = useInvitePermissionFilter(client as never)

    await filter.loadConfig()
    await filter.updateConfig({ mode: 'blocklist', blocklist: ['@new:bad'], allowlist: [] })

    expect(client.setAccountData).toHaveBeenCalledWith(ACCOUNT_DATA_TYPE, {
      mode: 'blocklist',
      blocklist: ['@new:bad'],
      allowlist: []
    })
    expect(filter.shouldRejectInvite('@new:bad')).toBe(true)
  })

  it('addToBlocklist 将用户加入黑名单并切换为 blocklist 模式', async () => {
    const client = createClientMock({ mode: 'allow_all', blocklist: [], allowlist: [] })
    const filter = useInvitePermissionFilter(client as never)

    await filter.loadConfig()
    await filter.addToBlocklist('@spammer:server')

    expect(client.setAccountData).toHaveBeenCalledWith(ACCOUNT_DATA_TYPE, {
      mode: 'blocklist',
      blocklist: ['@spammer:server'],
      allowlist: []
    })
    expect(filter.shouldRejectInvite('@spammer:server')).toBe(true)
  })

  it('removeFromBlocklist 将用户从黑名单移除', async () => {
    const client = createClientMock({
      mode: 'blocklist',
      blocklist: ['@a:server', '@b:server'],
      allowlist: []
    })
    const filter = useInvitePermissionFilter(client as never)

    await filter.loadConfig()
    await filter.removeFromBlocklist('@a:server')

    expect(client.setAccountData).toHaveBeenCalledWith(ACCOUNT_DATA_TYPE, {
      mode: 'blocklist',
      blocklist: ['@b:server'],
      allowlist: []
    })
    expect(filter.shouldRejectInvite('@a:server')).toBe(false)
  })
})
