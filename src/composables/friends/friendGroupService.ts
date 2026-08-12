import { type Friend, type FriendGroup, matrixFriendService } from '@/services/matrix/friends/MatrixFriendService'

export type { FriendGroup }

/**
 * Friend group operations backed by `matrixFriendService`.
 *
 * Returned methods are plain async wrappers so they can be spread directly
 * into the `useFriends` return value without changing its public API.
 */
export function createFriendGroupService() {
  const getFriendGroups = async (): Promise<FriendGroup[]> => {
    return await matrixFriendService.getFriendGroups()
  }

  const createFriendGroup = async (name: string): Promise<FriendGroup> => {
    return await matrixFriendService.createFriendGroup(name)
  }

  const renameFriendGroup = async (groupId: string, name: string): Promise<void> => {
    await matrixFriendService.renameFriendGroup(groupId, name)
  }

  const deleteFriendGroup = async (groupId: string): Promise<void> => {
    await matrixFriendService.deleteFriendGroup(groupId)
  }

  const getFriendsInGroup = async (groupId: string): Promise<Friend[]> => {
    return await matrixFriendService.getFriendsInGroup(groupId)
  }

  return {
    getFriendGroups,
    createFriendGroup,
    renameFriendGroup,
    deleteFriendGroup,
    getFriendsInGroup
  }
}
