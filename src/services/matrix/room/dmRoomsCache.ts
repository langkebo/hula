import type { DmRoomInfo } from '@/services/matrix/sdk'

/**
 * 私聊房间缓存（按 partner userId 分组）。
 *
 * 从 `MatrixDirectMessageService` 抽出：该文件是新建文件、有 400 行硬限，
 * 而这段缓存只是三个读方法 + 一个 Map，与 SDK manager 生命周期无关。
 *
 * 语义要点：
 * - `clear()` 必须由服务在**客户端实例变更**与 `stop()` 时调用，
 *   否则换账号后仍能读到上一个账号的私聊列表（串号）。
 * - `getByRoomId` 是线性扫描：私聊数量级很小（几十），不值得再维护反向索引。
 */
export class DmRoomsCache {
  private readonly cache = new Map<string, DmRoomInfo[]>()

  /** 写入某人的私聊房间列表（覆盖旧值）。 */
  set(partnerId: string, roomInfos: DmRoomInfo[]): void {
    this.cache.set(partnerId, roomInfos)
  }

  /** 读取某人的私聊房间列表（未缓存时返回 undefined）。 */
  get(partnerId: string): DmRoomInfo[] | undefined {
    return this.cache.get(partnerId)
  }

  /** 清空全部缓存（客户端实例变更 / 服务停止时调用）。 */
  clear(): void {
    this.cache.clear()
  }

  /** 某人的私聊房间（无缓存时返回空数组，不返回 undefined） */
  getByUser(userId: string): DmRoomInfo[] {
    return this.cache.get(userId) ?? []
  }

  /** 按 roomId 反查属于哪个 partner 的缓存款 */
  getByRoomId(roomId: string): DmRoomInfo | null {
    for (const roomInfos of this.cache.values()) {
      const roomInfo = roomInfos.find((item) => item.roomId === roomId)
      if (roomInfo) return roomInfo
    }
    return null
  }

  /** 全量快照（返回副本，调用方修改不会污染缓存） */
  snapshot(): Map<string, DmRoomInfo[]> {
    return new Map(this.cache)
  }
}
