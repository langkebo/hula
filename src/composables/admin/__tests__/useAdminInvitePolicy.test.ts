import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/services/matrix/admin', () => ({
  adminInvitePolicyService: {
    getBlocklist: vi.fn(),
    setBlocklist: vi.fn(),
    getAllowlist: vi.fn(),
    setAllowlist: vi.fn()
  }
}))

import { adminInvitePolicyService } from '@/services/matrix/admin'
import { useAdminInvitePolicy } from '../useAdminInvitePolicy'

describe('useAdminInvitePolicy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('读取黑名单与白名单后写入状态', async () => {
    vi.mocked(adminInvitePolicyService.getBlocklist).mockResolvedValue(['@a:example.org'])
    vi.mocked(adminInvitePolicyService.getAllowlist).mockResolvedValue(['@b:example.org'])

    const state = useAdminInvitePolicy()
    const ok = await state.loadLists('!room:example.org')

    expect(ok).toBe(true)
    expect(state.blocklist.value).toEqual(['@a:example.org'])
    expect(state.allowlist.value).toEqual(['@b:example.org'])
    expect(state.error.value).toBeNull()
  })

  it('读取失败时清空名单并记录错误', async () => {
    vi.mocked(adminInvitePolicyService.getBlocklist).mockRejectedValue(new Error('HTTP 500'))
    vi.mocked(adminInvitePolicyService.getAllowlist).mockResolvedValue(['@b:example.org'])

    const state = useAdminInvitePolicy()
    const ok = await state.loadLists('!room:example.org')

    expect(ok).toBe(false)
    expect(state.blocklist.value).toEqual([])
    expect(state.allowlist.value).toEqual([])
    expect(state.error.value).toBe('HTTP 500')
  })

  it('保存黑名单后以服务端返回为准', async () => {
    vi.mocked(adminInvitePolicyService.setBlocklist).mockResolvedValue({
      success: true,
      blocklist: ['@a:example.org']
    })

    const state = useAdminInvitePolicy()
    const ok = await state.saveBlocklist('!room:example.org', ['@a:example.org', ''])

    expect(ok).toBe(true)
    expect(adminInvitePolicyService.setBlocklist).toHaveBeenCalledWith('!room:example.org', ['@a:example.org', ''])
    expect(state.blocklist.value).toEqual(['@a:example.org'])
  })

  it('保存白名单失败时返回 false 并记录错误', async () => {
    vi.mocked(adminInvitePolicyService.setAllowlist).mockRejectedValue(new Error('HTTP 403'))

    const state = useAdminInvitePolicy()
    const ok = await state.saveAllowlist('!room:example.org', ['@b:example.org'])

    expect(ok).toBe(false)
    expect(state.error.value).toBe('HTTP 403')
  })
})
