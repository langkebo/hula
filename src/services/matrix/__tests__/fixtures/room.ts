import type { Room } from '@/services/matrix/sdk'

/**
 * SDK `Room` 的测试替身。
 *
 * `Room` 是重量级类（构造依赖 client / state store），测试只提供被测代码
 * 实际读取的成员，因此以 `Partial<Room>` 表达真实的子集。
 */
export type RoomStub = Partial<Room>

export function makeRoomStub(overrides: RoomStub = {}): RoomStub {
  return {
    roomId: '!room:matrix.test',
    name: 'Room',
    getMxcAvatarUrl: () => null,
    ...overrides
  }
}
