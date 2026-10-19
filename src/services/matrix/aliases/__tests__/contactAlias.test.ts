import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getClient: vi.fn(),
  getUserId: vi.fn(() => '@me:hs'),
  // 显式声明参数：否则 mock.calls[n][k] 被推断成空元组，断言取不到实参
  sendStateEvent: vi.fn(
    async (_roomId: string, _type: string, _content: Record<string, unknown>, _stateKey: string) => ({ event_id: '$e' })
  ),
  setAccountData: vi.fn(async (_type: string, _content: Record<string, unknown>) => {}),
  accountData: { current: new Map<string, { getContent: () => unknown }>() }
}))

vi.mock('@/services/matrix/MatrixClientService', () => ({
  matrixClientService: {
    getClient: mocks.getClient,
    getUserId: mocks.getUserId
  }
}))

import { applyAliasToDmRoom, clearAliasFromDmRoom, isOneToOneRoom, resolveDmRoomId } from '../applyContactAlias'
import {
  __setAliasBookForTest,
  CONTACT_ALIAS_MAX_NAME_LENGTH,
  clearContactAliasCache,
  getContactAlias,
  parseAliasBook,
  sanitizeAliasDisplayName,
  saveContactAlias
} from '../contactAliasRegistry'

const ME = '@me:hs'
const PEER = '@peer:hs'

function makeRoom(members: string[], roomId = '!dm:hs') {
  return { roomId, getJoinedMembers: () => members.map((userId) => ({ userId })) }
}

function installClient(rooms: ReturnType<typeof makeRoom>[]) {
  const client = {
    getRoom: (id: string) => rooms.find((r) => r.roomId === id) ?? null,
    getRooms: () => rooms,
    getAccountData: (type: string) => mocks.accountData.current.get(type),
    setAccountData: mocks.setAccountData,
    sendStateEvent: mocks.sendStateEvent
  }
  mocks.getClient.mockReturnValue(client)
  return client
}

describe('contactAliasRegistry · 纯函数', () => {
  it('显示名规范化：去首尾空白、折叠连续空白', () => {
    expect(sanitizeAliasDisplayName('  老  同学  ')).toBe('老 同学')
  })

  it('空 / 全空白 → null（不允许"空名字"这种半成品状态）', () => {
    expect(sanitizeAliasDisplayName('')).toBeNull()
    expect(sanitizeAliasDisplayName('   \n\t  ')).toBeNull()
  })

  it('超长 → null（防止破坏气泡布局）', () => {
    expect(sanitizeAliasDisplayName('a'.repeat(CONTACT_ALIAS_MAX_NAME_LENGTH))).toHaveLength(
      CONTACT_ALIAS_MAX_NAME_LENGTH
    )
    expect(sanitizeAliasDisplayName('a'.repeat(CONTACT_ALIAS_MAX_NAME_LENGTH + 1))).toBeNull()
  })

  it('parseAliasBook 对垃圾数据容错（不能让坏数据锁死功能）', () => {
    expect(parseAliasBook(null).aliases).toEqual({})
    expect(parseAliasBook('oops').aliases).toEqual({})
    expect(parseAliasBook({ aliases: 42 }).aliases).toEqual({})
  })

  it('parseAliasBook 丢弃非法条目，保留合法条目', () => {
    const book = parseAliasBook({
      aliases: {
        '@ok:hs': { displayName: ' 老同学 ', avatarMxc: 'mxc://hs/a', updatedAt: 1 },
        '@empty:hs': { displayName: '   ' },
        '@bad-avatar:hs': { displayName: 'A', avatarMxc: 'https://evil/x.png' },
        'not-a-user': { displayName: 'X' }
      }
    })
    expect(Object.keys(book.aliases).sort()).toEqual(['@bad-avatar:hs', '@ok:hs'])
    expect(book.aliases['@ok:hs'].displayName).toBe('老同学')
    // 非 mxc 头像一律丢弃：别名头像必须是本服务器媒体
    expect(book.aliases['@bad-avatar:hs'].avatarMxc).toBeUndefined()
  })
})

describe('contactAliasRegistry · 持久化', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearContactAliasCache()
    mocks.accountData.current.clear()
    installClient([])
  })

  it('保存别名写入 account data com.hula.contact_alias', async () => {
    await saveContactAlias(PEER, { displayName: ' 老同学 ' })

    expect(mocks.setAccountData).toHaveBeenCalledTimes(1)
    const [type, content] = mocks.setAccountData.mock.calls[0] as [
      string,
      { aliases: Record<string, { displayName: string }> }
    ]
    expect(type).toBe('com.hula.contact_alias')
    expect(content.aliases[PEER].displayName).toBe('老同学')
    expect(getContactAlias(PEER)?.displayName).toBe('老同学')
  })

  it('非法显示名直接抛错，不写 account data', async () => {
    await expect(saveContactAlias(PEER, { displayName: '   ' })).rejects.toThrow()
    expect(mocks.setAccountData).not.toHaveBeenCalled()
  })
})

describe('applyContactAlias · 单聊硬校验', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearContactAliasCache()
    mocks.accountData.current.clear()
    mocks.getUserId.mockReturnValue(ME)
  })

  it('成员数 2 且是本人+对方 → 一对一', () => {
    expect(isOneToOneRoom(makeRoom([ME, PEER]), ME, PEER)).toBe(true)
  })

  // 这条是本次功能最关键的护栏：群聊里写房间级资料会让所有成员都看到别名
  it('群聊（3 人）→ 不是一对一', () => {
    expect(isOneToOneRoom(makeRoom([ME, PEER, '@third:hs']), ME, PEER)).toBe(false)
  })

  it('两人房但不是目标联系人 → 不是一对一', () => {
    expect(isOneToOneRoom(makeRoom([ME, '@other:hs']), ME, PEER)).toBe(false)
  })

  it('单聊里应用别名：写 m.room.member，state_key = 自己', async () => {
    __setAliasBookForTest({ version: 1, aliases: { [PEER]: { displayName: '老同学', updatedAt: 1 } } })
    installClient([makeRoom([ME, PEER])])

    await expect(applyAliasToDmRoom(PEER)).resolves.toBe(true)

    expect(mocks.sendStateEvent).toHaveBeenCalledWith(
      '!dm:hs',
      'm.room.member',
      { membership: 'join', displayname: '老同学' },
      ME
    )
  })

  // 关键：群聊里绝不能写
  it('群聊里应用别名 → 拒绝写入（不调用 sendStateEvent）', async () => {
    __setAliasBookForTest({ version: 1, aliases: { [PEER]: { displayName: '老同学', updatedAt: 1 } } })
    installClient([makeRoom([ME, PEER, '@third:hs'])])

    await expect(applyAliasToDmRoom(PEER)).resolves.toBe(false)
    expect(mocks.sendStateEvent).not.toHaveBeenCalled()
  })

  it('没有别名 → 不写入', async () => {
    installClient([makeRoom([ME, PEER])])
    await expect(applyAliasToDmRoom(PEER)).resolves.toBe(false)
    expect(mocks.sendStateEvent).not.toHaveBeenCalled()
  })

  it('头像只接受 mxc，且以 avatar_url 传入', async () => {
    __setAliasBookForTest({
      version: 1,
      aliases: { [PEER]: { displayName: '老同学', avatarMxc: 'mxc://hs/a', updatedAt: 1 } }
    })
    installClient([makeRoom([ME, PEER])])

    await applyAliasToDmRoom(PEER)

    const content = mocks.sendStateEvent.mock.calls[0][2] as Record<string, unknown>
    expect(content.avatar_url).toBe('mxc://hs/a')
  })

  // 清除必须真写空串：只删本地记录对方仍看到旧别名
  it('清除别名：把 displayname / avatar_url 写成空串', async () => {
    installClient([makeRoom([ME, PEER])])

    await expect(clearAliasFromDmRoom(PEER)).resolves.toBe(true)

    expect(mocks.sendStateEvent).toHaveBeenCalledWith(
      '!dm:hs',
      'm.room.member',
      { membership: 'join', displayname: '', avatar_url: '' },
      ME
    )
  })

  it('resolveDmRoomId 优先 m.direct（房间确实存在时）', () => {
    mocks.accountData.current.set('m.direct', { getContent: () => ({ [PEER]: ['!from-direct:hs'] }) })
    installClient([makeRoom([ME, PEER], '!from-direct:hs'), makeRoom([ME, PEER], '!from-scan:hs')])

    expect(resolveDmRoomId(PEER)).toBe('!from-direct:hs')
  })

  // m.direct 是客户端账本，可能指向已被删除/未同步的房间。
  // 此时必须回落到「成员构成」事实，而不是把一个不存在的 roomId 交给上层。
  it('m.direct 指向不存在的房间 → 回落到成员构成扫描', () => {
    mocks.accountData.current.set('m.direct', { getContent: () => ({ [PEER]: ['!gone:hs'] }) })
    installClient([makeRoom([ME, PEER], '!from-scan:hs')])

    expect(resolveDmRoomId(PEER)).toBe('!from-scan:hs')
  })
})
