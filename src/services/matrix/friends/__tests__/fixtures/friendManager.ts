import type { FriendManagerCompat } from '../../friendUtils'

/**
 * SDK `FriendManager`（含 synapse-rust 兼容扩展）的测试替身。
 *
 * 类型来源：`FriendManagerCompat`（服务层对 SDK FriendManager 的契约封装）。
 */
export type FriendManagerStub = Partial<FriendManagerCompat>

export function makeFriendManagerStub(overrides: FriendManagerStub = {}): FriendManagerStub {
  return {
    getFriends: async () => [],
    getIncomingRequests: async () => [],
    getOutgoingRequests: async () => [],
    ...overrides
  }
}

/** 直接挂载 `friendManager` 的 MatrixClient 结构子集（MatrixFriendSync 的降级路径）。 */
export interface FriendManagerClientHost {
  friendManager: FriendManagerStub
}

export function makeFriendClientStub(overrides: Partial<FriendManagerClientHost> = {}): FriendManagerClientHost {
  return { friendManager: makeFriendManagerStub(), ...overrides }
}
