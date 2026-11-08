import { computed, type Ref } from 'vue'
import type { MatrixRoomMember } from '@/stores/domains/chat/group'
import { useListWindow } from './chatBox/useListWindow'

/**
 * 成员面板的成员分组与窗口化渲染。
 *
 * 大群成员面板一次性渲染上千行会长时间占用主线程：已加入成员按「滚到底再追加」
 * 窗口化渲染（首屏仅挂载窗口大小的行）；封禁列表通常远小于成员数且仅管理员可见，
 * 保持全量渲染。
 */
export function useMemberListWindow(allMembers: Ref<MatrixRoomMember[]>, roomId: () => string) {
  const joinedMembers = computed(() => allMembers.value.filter((m) => m.membership === 'join'))
  const bannedMembers = computed(() => allMembers.value.filter((m) => m.membership === 'ban'))

  const { visibleItems, handleScroll } = useListWindow({
    items: joinedMembers,
    resetKey: roomId
  })

  return {
    joinedMembers,
    bannedMembers,
    visibleJoinedMembers: visibleItems,
    handleMemberScroll: handleScroll
  }
}
