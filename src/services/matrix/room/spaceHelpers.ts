/**
 * Space 服务 — 纯辅助函数模块。
 *
 * 从 MatrixSpaceService 抽离，包含类型转换和路径规范化逻辑。
 */

import type { Room } from '../sdk'
import type { Space as SdkSpace } from '../sdk-compat'
import type { SpaceInfo } from './MatrixSpaceService'

/** 将 SDK 空间对象转换为空间信息
 * @param room - 可选的已加载房间对象，用于获取准确的成员和子房间计数
 */
export function sdkSpaceToSpaceInfo(space: SdkSpace, room?: Room): SpaceInfo {
  return {
    spaceId: space.space_id,
    name: space.name || '',
    topic: space.topic || undefined,
    avatarUrl: space.avatar_url || undefined,
    memberCount: room ? room.getJoinedMembers().length : 0,
    childCount: room ? getSpaceChildIds(room).length : 0
  }
}

/** 将房间对象转换为空间信息
 */
export function roomToSpaceInfo(room: Room, getSpaceChildIds: (room: Room) => string[]): SpaceInfo {
  return {
    spaceId: room.roomId,
    name: room.name || '',
    topic: room.topic || undefined,
    avatarUrl: room.getMxcAvatarUrl() || undefined,
    memberCount: room.getJoinedMembers().length,
    childCount: getSpaceChildIds(room).length
  }
}

/** 获取空间的子房间 ID 列表
 */
export function getSpaceChildIds(room: Room): string[] {
  const childEvents = room.currentState.getStateEvents('m.space.child')
  return childEvents.map((e) => e.getStateKey()).filter((key): key is string => !!key)
}

/** 规范化空间树路径项
 */
export function normalizeSpaceTreePathItems(
  items: Array<{ space_id: string; name: string }>
): Array<{ space_id: string; name: string }> {
  const dedupedItems: Array<{ space_id: string; name: string }> = []
  for (const item of items) {
    if (!item.space_id) continue
    if (dedupedItems.some((candidate) => candidate.space_id === item.space_id)) continue
    dedupedItems.push({ space_id: item.space_id, name: item.name || '' })
  }
  return dedupedItems
}
