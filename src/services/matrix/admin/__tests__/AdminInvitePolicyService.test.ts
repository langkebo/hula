import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminInvitePolicyService } from '../AdminInvitePolicyService'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

const getBlocklist = vi.fn()
const setBlocklist = vi.fn()
const getAllowlist = vi.fn()
const setAllowlist = vi.fn()

const makeDeps = () => {
  const client = {
    getInviteBlocklistManager: () => ({ getBlocklist, setBlocklist, getAllowlist, setAllowlist })
  }
  return {
    getClient: () => client as never,
    waitForClientReady: async () => client as never
  }
}

describe('AdminInvitePolicyService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getBlocklist 透传房间 ID', async () => {
    getBlocklist.mockResolvedValueOnce(['@a:example.org'])

    const result = await new AdminInvitePolicyService(makeDeps()).getBlocklist('!room:example.org')

    expect(getBlocklist).toHaveBeenCalledWith('!room:example.org')
    expect(result).toEqual(['@a:example.org'])
  })

  it('setBlocklist 整体替换黑名单', async () => {
    const response = { success: true, blocklist: ['@a:example.org', '@b:example.org'] }
    setBlocklist.mockResolvedValueOnce(response)

    const result = await new AdminInvitePolicyService(makeDeps()).setBlocklist('!room:example.org', [
      '@a:example.org',
      '@b:example.org'
    ])

    expect(setBlocklist).toHaveBeenCalledWith('!room:example.org', ['@a:example.org', '@b:example.org'])
    expect(result).toEqual(response)
  })

  it('getAllowlist 透传房间 ID', async () => {
    getAllowlist.mockResolvedValueOnce(['@c:example.org'])

    const result = await new AdminInvitePolicyService(makeDeps()).getAllowlist('!room:example.org')

    expect(getAllowlist).toHaveBeenCalledWith('!room:example.org')
    expect(result).toEqual(['@c:example.org'])
  })

  it('setAllowlist 整体替换白名单', async () => {
    const response = { success: true, allowlist: ['@c:example.org'] }
    setAllowlist.mockResolvedValueOnce(response)

    const result = await new AdminInvitePolicyService(makeDeps()).setAllowlist('!room:example.org', ['@c:example.org'])

    expect(setAllowlist).toHaveBeenCalledWith('!room:example.org', ['@c:example.org'])
    expect(result).toEqual(response)
  })

  it('后端失败时记录日志并重新抛出', async () => {
    setBlocklist.mockRejectedValueOnce(new Error('HTTP 403'))

    await expect(
      new AdminInvitePolicyService(makeDeps()).setBlocklist('!room:example.org', ['@a:example.org'])
    ).rejects.toThrow('HTTP 403')
  })
})
