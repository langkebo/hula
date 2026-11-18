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

const getInviteAllowlist = vi.fn()
const getInviteBlocklist = vi.fn()
const setInviteAllowlist = vi.fn()
const setInviteBlocklist = vi.fn()
const addToInviteAllowlist = vi.fn()
const removeFromInviteAllowlist = vi.fn()
const addToInviteBlocklist = vi.fn()
const removeFromInviteBlocklist = vi.fn()

const makeDeps = () => {
  const client = {
    getInviteBlocklistManager: () => ({ getBlocklist, setBlocklist, getAllowlist, setAllowlist }),
    getAdminManager: () => ({
      config: {
        getInviteAllowlist,
        getInviteBlocklist,
        setInviteAllowlist,
        setInviteBlocklist,
        addToInviteAllowlist,
        removeFromInviteAllowlist,
        addToInviteBlocklist,
        removeFromInviteBlocklist
      }
    })
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

  it('getGlobalLists 并行读取全局白/黑名单', async () => {
    getInviteAllowlist.mockResolvedValueOnce({ allowlist: ['@a:example.org'], limit: 100, offset: 0, total_count: 1 })
    getInviteBlocklist.mockResolvedValueOnce({ blocklist: ['@b:example.org'], limit: 100, offset: 0, total_count: 1 })

    const result = await new AdminInvitePolicyService(makeDeps()).getGlobalLists()

    expect(getInviteAllowlist).toHaveBeenCalledTimes(1)
    expect(getInviteBlocklist).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ allowlist: ['@a:example.org'], blocklist: ['@b:example.org'] })
  })

  it('getGlobalLists 缺字段时降级为空数组', async () => {
    getInviteAllowlist.mockResolvedValueOnce({} as never)
    getInviteBlocklist.mockResolvedValueOnce({} as never)

    const result = await new AdminInvitePolicyService(makeDeps()).getGlobalLists()

    expect(result).toEqual({ allowlist: [], blocklist: [] })
  })

  it.each([
    ['allowlist', setInviteAllowlist],
    ['blocklist', setInviteBlocklist]
  ] as const)('setGlobalList 按 kind=%s 整体替换全局名单', async (kind, fn) => {
    const response = { status: 'ok', action: 'replace' }
    fn.mockResolvedValueOnce(response)

    const result = await new AdminInvitePolicyService(makeDeps()).setGlobalList(kind, [
      '@a:example.org',
      '@b:example.org'
    ])

    expect(fn).toHaveBeenCalledWith(['@a:example.org', '@b:example.org'])
    expect(result).toEqual(response)
  })

  it('setGlobalList 失败时记录日志并重新抛出', async () => {
    setInviteBlocklist.mockRejectedValueOnce(new Error('HTTP 400'))

    await expect(
      new AdminInvitePolicyService(makeDeps()).setGlobalList('blocklist', ['@a:example.org'])
    ).rejects.toThrow('HTTP 400')
  })

  it.each([
    ['allowlist', addToInviteAllowlist],
    ['blocklist', addToInviteBlocklist]
  ] as const)('addGlobalUser 按 kind=%s 分派增量接口', async (kind, fn) => {
    fn.mockResolvedValueOnce({ status: 'ok', action: 'add', user_id: '@a:example.org', already_present: false })

    await new AdminInvitePolicyService(makeDeps()).addGlobalUser(kind, '@a:example.org')

    expect(fn).toHaveBeenCalledWith('@a:example.org')
  })

  it.each([
    ['allowlist', removeFromInviteAllowlist],
    ['blocklist', removeFromInviteBlocklist]
  ] as const)('removeGlobalUser 按 kind=%s 分派增量接口', async (kind, fn) => {
    fn.mockResolvedValueOnce({ status: 'ok', action: 'remove', user_id: '@a:example.org', already_absent: false })

    await new AdminInvitePolicyService(makeDeps()).removeGlobalUser(kind, '@a:example.org')

    expect(fn).toHaveBeenCalledWith('@a:example.org')
  })

  it('全局名单接口失败时记录日志并重新抛出', async () => {
    getInviteBlocklist.mockRejectedValueOnce(new Error('HTTP 500'))

    await expect(new AdminInvitePolicyService(makeDeps()).getGlobalLists()).rejects.toThrow('HTTP 500')
  })
})
