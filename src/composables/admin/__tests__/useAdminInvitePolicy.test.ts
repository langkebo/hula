import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/services/matrix/admin', () => ({
  adminInvitePolicyService: {
    getBlocklist: vi.fn(),
    setBlocklist: vi.fn(),
    getAllowlist: vi.fn(),
    setAllowlist: vi.fn(),
    getGlobalLists: vi.fn(),
    addGlobalUser: vi.fn(),
    removeGlobalUser: vi.fn(),
    setGlobalList: vi.fn()
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

  it('loadGlobalLists 写入全局白/黑名单', async () => {
    vi.mocked(adminInvitePolicyService.getGlobalLists).mockResolvedValue({
      allowlist: ['@a:example.org'],
      blocklist: ['@b:example.org']
    })

    const state = useAdminInvitePolicy()
    const ok = await state.loadGlobalLists()

    expect(ok).toBe(true)
    expect(state.globalAllowlist.value).toEqual(['@a:example.org'])
    expect(state.globalBlocklist.value).toEqual(['@b:example.org'])
  })

  it('addGlobalUser 去除空白并回读最新名单', async () => {
    vi.mocked(adminInvitePolicyService.addGlobalUser).mockResolvedValue(undefined)
    vi.mocked(adminInvitePolicyService.getGlobalLists).mockResolvedValue({
      allowlist: ['@a:example.org'],
      blocklist: []
    })

    const state = useAdminInvitePolicy()
    const ok = await state.addGlobalUser('allowlist', '  @a:example.org  ')

    expect(ok).toBe(true)
    expect(adminInvitePolicyService.addGlobalUser).toHaveBeenCalledWith('allowlist', '@a:example.org')
    expect(state.globalAllowlist.value).toEqual(['@a:example.org'])
  })

  it('removeGlobalUser 失败时返回 false 并记录错误', async () => {
    vi.mocked(adminInvitePolicyService.removeGlobalUser).mockRejectedValue(new Error('HTTP 500'))

    const state = useAdminInvitePolicy()
    const ok = await state.removeGlobalUser('blocklist', '@b:example.org')

    expect(ok).toBe(false)
    expect(state.error.value).toBe('HTTP 500')
  })

  it('replaceGlobalUsers 去重后整体替换并回读两侧名单', async () => {
    vi.mocked(adminInvitePolicyService.setGlobalList).mockResolvedValue({
      status: 'ok',
      action: 'set_global_invite_allowlist'
    })
    vi.mocked(adminInvitePolicyService.getGlobalLists).mockResolvedValue({
      allowlist: ['@a:example.org'],
      blocklist: ['@b:example.org']
    })

    const state = useAdminInvitePolicy()
    const ok = await state.replaceGlobalUsers('allowlist', [' @a:example.org ', '@a:example.org', '', '@c:example.org'])

    expect(ok).toBe(true)
    expect(adminInvitePolicyService.setGlobalList).toHaveBeenCalledWith('allowlist', [
      '@a:example.org',
      '@c:example.org'
    ])
    expect(state.globalAllowlist.value).toEqual(['@a:example.org'])
    expect(state.globalBlocklist.value).toEqual(['@b:example.org'])
  })

  it('replaceGlobalUsers 允许空数组清空名单', async () => {
    vi.mocked(adminInvitePolicyService.setGlobalList).mockResolvedValue({
      status: 'ok',
      action: 'set_global_invite_blocklist'
    })
    vi.mocked(adminInvitePolicyService.getGlobalLists).mockResolvedValue({ allowlist: [], blocklist: [] })

    const state = useAdminInvitePolicy()
    const ok = await state.replaceGlobalUsers('blocklist', ['', '  '])

    expect(ok).toBe(true)
    expect(adminInvitePolicyService.setGlobalList).toHaveBeenCalledWith('blocklist', [])
  })

  it('replaceGlobalUsers 失败时返回 false 并记录错误', async () => {
    vi.mocked(adminInvitePolicyService.setGlobalList).mockRejectedValue(new Error('HTTP 400'))

    const state = useAdminInvitePolicy()
    const ok = await state.replaceGlobalUsers('blocklist', ['@b:example.org'])

    expect(ok).toBe(false)
    expect(state.error.value).toBe('HTTP 400')
  })

  it('importGlobalUsers 去重过滤空行并统计成功/失败', async () => {
    vi.mocked(adminInvitePolicyService.addGlobalUser)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('invalid user'))
    vi.mocked(adminInvitePolicyService.getGlobalLists).mockResolvedValue({
      allowlist: ['@a:example.org'],
      blocklist: []
    })

    const state = useAdminInvitePolicy()
    const result = await state.importGlobalUsers('allowlist', [
      '@a:example.org',
      ' @a:example.org ',
      '',
      '@c:example.org'
    ])

    expect(result).toEqual({ success: 1, failed: 1 })
    expect(adminInvitePolicyService.addGlobalUser).toHaveBeenCalledTimes(2)
  })

  it('importGlobalUsers 输入为空时不调用服务', async () => {
    const state = useAdminInvitePolicy()
    const result = await state.importGlobalUsers('blocklist', ['', '   '])

    expect(result).toEqual({ success: 0, failed: 0 })
    expect(adminInvitePolicyService.addGlobalUser).not.toHaveBeenCalled()
  })
})
