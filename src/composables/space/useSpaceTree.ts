import { computed } from 'vue'
import type { SpaceTreeNode } from '@/components/space/SpaceTree.vue'

export interface SpaceTreeProps {
  spaces: SpaceTreeNode[]
  selectedSpaceId?: string
  collapsedIds?: string[]
  /** 内部递归用：当前层级（从 0 开始） */
  level?: number
}

/** 与组件 defineEmits 声明一致的冒泡函数（三个事件的参数均为单个字符串 ID） */
export interface SpaceTreeEmit {
  (event: 'select', id: string): void
  (event: 'select-room', id: string): void
  (event: 'toggle', id: string): void
}

/**
 * SpaceTree 的展示与交互逻辑：层级判定、折叠 / 选中状态、子项计数、
 * 头像占位字符，以及节点行 / 房间行的键盘交互。
 *
 * 仅从组件内平移，行为与原实现一致；组件保留 props / emits 声明与模板。
 */
export const useSpaceTree = (props: SpaceTreeProps, emit: SpaceTreeEmit) => {
  const isRoot = computed(() => props.level === 0)

  const hasChildren = (node: SpaceTreeNode): boolean => {
    const hasSpaces = (node.children?.length ?? 0) > 0
    const hasRooms = (node.rooms?.length ?? 0) > 0
    return hasSpaces || hasRooms
  }

  const isCollapsed = (node: SpaceTreeNode): boolean => (props.collapsedIds ?? []).includes(node.spaceId)

  const isSelected = (node: SpaceTreeNode): boolean => props.selectedSpaceId === node.spaceId

  const childTotal = (node: SpaceTreeNode): number => (node.children?.length ?? 0) + (node.rooms?.length ?? 0)

  const avatarInitial = (node: SpaceTreeNode): string => node.name?.charAt(0)?.toUpperCase() || '?'

  const handleSelect = (node: SpaceTreeNode) => {
    emit('select', node.spaceId)
  }

  const handleToggle = (node: SpaceTreeNode) => {
    emit('toggle', node.spaceId)
  }

  const handleKeydown = (event: KeyboardEvent, node: SpaceTreeNode) => {
    switch (event.key) {
      case 'Enter':
        event.preventDefault()
        emit('select', node.spaceId)
        break
      case 'ArrowRight':
        // 折叠态：展开
        if (hasChildren(node) && isCollapsed(node)) {
          event.preventDefault()
          emit('toggle', node.spaceId)
        }
        break
      case 'ArrowLeft':
        // 展开态：折叠
        if (hasChildren(node) && !isCollapsed(node)) {
          event.preventDefault()
          emit('toggle', node.spaceId)
        }
        break
      default:
        break
    }
  }

  const handleRoomKeydown = (event: KeyboardEvent, room: { roomId: string }) => {
    switch (event.key) {
      case 'Enter':
      case ' ':
        event.preventDefault()
        emit('select-room', room.roomId)
        break
      default:
        break
    }
  }

  return {
    isRoot,
    hasChildren,
    isCollapsed,
    isSelected,
    childTotal,
    avatarInitial,
    handleSelect,
    handleToggle,
    handleKeydown,
    handleRoomKeydown
  }
}

export type SpaceTreeState = ReturnType<typeof useSpaceTree>
