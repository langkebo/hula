import { describe, expect, it } from 'vitest'
import {
  buildRoomCardModels,
  filterRoomCards,
  formatRoomActiveTime,
  formatUnreadCount,
  type RoomListSource,
  resolveAvailableRoomFilters
} from '../roomListModel'

const makeRoom = (overrides: Partial<RoomListSource> = {}): RoomListSource => ({
  roomId: '!room:matrix.test',
  name: '产品讨论组',
  avatarUrl: '',
  memberCount: 8,
  joinRule: 'invite',
  isEncrypted: false,
  creatorId: '@alice:matrix.test',
  memberNames: ['Alice', 'Bob'],
  ...overrides
})

const NOW = new Date(2026, 10, 13, 12, 0, 0).getTime()
const at = (year: number, month: number, day: number, hour = 9, minute = 5): number =>
  new Date(year, month - 1, day, hour, minute).getTime()

describe('buildRoomCardModels', () => {
  it('用会话数据补齐未读数、最后消息摘要与活跃时间', () => {
    const [card] = buildRoomCardModels(
      [makeRoom()],
      {
        '!room:matrix.test': { unreadCount: 12, activeTime: NOW, text: '  今晚  8 点\n评审  ' }
      },
      (userId) => userId === '@alice:matrix.test'
    )

    expect(card).toMatchObject({
      unreadCount: 12,
      summary: '今晚 8 点 评审',
      activeTime: NOW,
      isPublic: false,
      isOwned: true
    })
  })

  it('会话缺失时给出中性默认值，不伪造摘要', () => {
    const [card] = buildRoomCardModels([makeRoom({ creatorId: null })], {})

    expect(card?.unreadCount).toBe(0)
    expect(card?.summary).toBe('')
    expect(card?.activeTime).toBe(0)
    expect(card?.isOwned).toBe(false)
  })

  it('joinRule 为 public 时标记为公开房间', () => {
    const [card] = buildRoomCardModels([makeRoom({ joinRule: 'public' })], {})

    expect(card?.isPublic).toBe(true)
  })
})

describe('formatUnreadCount', () => {
  it('0 不渲染角标，1-99 原样展示', () => {
    expect(formatUnreadCount(0)).toBe('')
    expect(formatUnreadCount(-3)).toBe('')
    expect(formatUnreadCount(5)).toBe('5')
    expect(formatUnreadCount(99)).toBe('99')
  })

  it('超过 99 显示 99+', () => {
    expect(formatUnreadCount(100)).toBe('99+')
    expect(formatUnreadCount(1234)).toBe('99+')
  })
})

describe('formatRoomActiveTime', () => {
  it('今天显示 HH:mm', () => {
    expect(formatRoomActiveTime(at(2026, 11, 13, 8, 7), '昨天', NOW)).toBe('08:07')
  })

  it('昨天显示注入的本地化文案', () => {
    expect(formatRoomActiveTime(at(2026, 11, 12, 23, 59), '昨天', NOW)).toBe('昨天')
  })

  it('更早的同年日期显示 MM-DD，跨年显示 YYYY-MM-DD', () => {
    expect(formatRoomActiveTime(at(2026, 11, 1), '昨天', NOW)).toBe('11-01')
    expect(formatRoomActiveTime(at(2025, 12, 31), '昨天', NOW)).toBe('2025-12-31')
  })

  it('无有效时间戳时不显示', () => {
    expect(formatRoomActiveTime(0, '昨天', NOW)).toBe('')
    expect(formatRoomActiveTime(Number.NaN, '昨天', NOW)).toBe('')
  })
})

describe('filterRoomCards', () => {
  const cards = buildRoomCardModels(
    [
      makeRoom({
        roomId: '!a:matrix.test',
        name: '产品讨论组',
        joinRule: 'public',
        creatorId: '@me:matrix.test',
        memberNames: ['Dave', 'Eve']
      }),
      makeRoom({ roomId: '!b:matrix.test', name: '内部项目', joinRule: 'invite', creatorId: '@alice:matrix.test' }),
      makeRoom({
        roomId: '!c:matrix.test',
        name: '设计协作',
        joinRule: 'invite',
        creatorId: null,
        memberNames: ['Alice', 'Carol']
      })
    ],
    {},
    (userId) => userId === '@me:matrix.test'
  )

  it('按房间名搜索并忽略首尾空格', () => {
    expect(filterRoomCards(cards, ' 产品 ', 'all').map((card) => card.roomId)).toEqual(['!a:matrix.test'])
    expect(filterRoomCards(cards, '不存在', 'all')).toEqual([])
  })

  it('按成员名搜索，忽略大小写', () => {
    expect(filterRoomCards(cards, 'carol', 'all').map((card) => card.roomId)).toEqual(['!c:matrix.test'])
    expect(filterRoomCards(cards, 'ALICE', 'all').map((card) => card.roomId)).toEqual([
      '!b:matrix.test',
      '!c:matrix.test'
    ])
  })

  it('公开 / 私有 / 我创建的筛选可切换', () => {
    expect(filterRoomCards(cards, '', 'public').map((card) => card.roomId)).toEqual(['!a:matrix.test'])
    expect(filterRoomCards(cards, '', 'private').map((card) => card.roomId)).toEqual([
      '!b:matrix.test',
      '!c:matrix.test'
    ])
    expect(filterRoomCards(cards, '', 'owned').map((card) => card.roomId)).toEqual(['!a:matrix.test'])
    expect(filterRoomCards(cards, '', 'all')).toHaveLength(3)
  })

  it('搜索与筛选叠加生效', () => {
    expect(filterRoomCards(cards, '产品', 'public').map((card) => card.roomId)).toEqual(['!a:matrix.test'])
    expect(filterRoomCards(cards, '产品', 'private')).toEqual([])
  })
})

describe('resolveAvailableRoomFilters', () => {
  it('无创建者信息时不出现「我创建的」', () => {
    const cards = buildRoomCardModels([makeRoom({ creatorId: null })], {})

    expect(resolveAvailableRoomFilters(cards)).toEqual(['all', 'public', 'private'])
  })

  it('存在创建者信息时补上「我创建的」', () => {
    const cards = buildRoomCardModels([makeRoom()], {})

    expect(resolveAvailableRoomFilters(cards)).toEqual(['all', 'public', 'private', 'owned'])
  })
})
