<template>
  <ul v-if="spaces.length > 0" class="space-tree" role="tree" :aria-label="t('space.title')">
    <li
      v-for="node in spaces"
      :key="node.spaceId"
      class="space-tree__node-wrapper"
      role="none">
      <!-- 节点行 -->
      <div
        :data-testid="`space-tree-node-${node.spaceId}`"
        class="space-tree__node"
        :class="{ 'space-tree__node--selected': isSelected(node) }"
        role="treeitem"
        :aria-selected="isSelected(node) ? 'true' : 'false'"
        :aria-expanded="hasChildren(node) ? (isCollapsed(node) ? 'false' : 'true') : undefined"
        :aria-level="level + 1"
        tabindex="0"
        @click="handleSelect(node)"
        @keydown="handleKeydown($event, node)">
        <!-- 折叠箭头（仅有子项时显示） -->
        <button
          v-if="hasChildren(node)"
          :data-testid="`space-tree-toggle-${node.spaceId}`"
          type="button"
          class="space-tree__toggle"
          :aria-expanded="isCollapsed(node) ? 'false' : 'true'"
          :aria-label="isCollapsed(node) ? t('space.expand') : t('space.collapse')"
          tabindex="-1"
          @click.stop="handleToggle(node)">
          <svg
            viewBox="0 0 24 24"
            width="14"
            height="14"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
            :class="['space-tree__toggle-icon', { 'space-tree__toggle-icon--collapsed': isCollapsed(node) }]">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </button>
        <span v-else class="space-tree__toggle-placeholder" aria-hidden="true" />

        <!-- 头像 -->
        <span class="space-tree__avatar" :aria-label="node.name">
          <img
            v-if="node.avatarUrl"
            :data-testid="`space-tree-avatar-img-${node.spaceId}`"
            :src="node.avatarUrl"
            :alt="''"
            class="space-tree__avatar-img" />
          <span
            v-else
            :data-testid="`space-tree-avatar-placeholder-${node.spaceId}`"
            class="space-tree__avatar-placeholder">
            {{ avatarInitial(node) }}
          </span>
        </span>

        <!-- 名称 -->
        <span class="space-tree__name" :title="node.name">{{ node.name }}</span>

        <!-- 子项计数 -->
        <span
          v-if="childTotal(node) > 0"
          :data-testid="`space-tree-count-${node.spaceId}`"
          class="space-tree__count"
          :aria-label="t('space.room_count_value', { count: childTotal(node) })">
          {{ childTotal(node) }}
        </span>
      </div>

      <!-- 递归子节点 + 子房间 -->
      <div v-if="hasChildren(node) && !isCollapsed(node)" class="space-tree__children" role="group">
        <!-- 子房间（叶子项） -->
        <div
          v-for="room in node.rooms ?? []"
          :key="room.roomId"
          :data-testid="`space-tree-room-${room.roomId}`"
          class="space-tree__room"
          role="treeitem"
          :aria-level="level + 2"
          tabindex="0"
          @click="emit('select', node.spaceId)">
          <span class="space-tree__toggle-placeholder" aria-hidden="true" />
          <span class="space-tree__room-icon" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              width="12"
              height="12"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </span>
          <span class="space-tree__room-name" :title="room.name">{{ room.name }}</span>
        </div>
        <!-- 递归子空间 -->
        <SpaceTree
          v-if="node.children && node.children.length > 0"
          :spaces="node.children"
          :selected-space-id="selectedSpaceId"
          :collapsed-ids="collapsedIds"
          :level="level + 1"
          @select="emit('select', $event)"
          @toggle="emit('toggle', $event)" />
      </div>
    </li>
  </ul>
  <div v-else class="space-tree__empty" data-testid="space-tree-empty" role="status">
    {{ t('space.no_spaces_yet') }}
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineOptions({ name: 'SpaceTree' })

export interface SpaceTreeNode {
  spaceId: string
  name: string
  avatarUrl?: string
  topic?: string
  memberCount?: number
  childCount?: number
  children?: SpaceTreeNode[]
  rooms?: { roomId: string; name: string; avatarUrl?: string }[]
}

const props = withDefaults(
  defineProps<{
    spaces: SpaceTreeNode[]
    selectedSpaceId?: string
    collapsedIds?: string[]
    /** 内部递归用：当前层级（从 0 开始） */
    level?: number
  }>(),
  {
    selectedSpaceId: '',
    collapsedIds: () => [],
    level: 0
  }
)

const emit = defineEmits<{
  select: [spaceId: string]
  toggle: [spaceId: string]
}>()

const { t } = useI18n()

const hasChildren = (node: SpaceTreeNode): boolean => {
  const hasSpaces = (node.children?.length ?? 0) > 0
  const hasRooms = (node.rooms?.length ?? 0) > 0
  return hasSpaces || hasRooms
}

const isCollapsed = (node: SpaceTreeNode): boolean => props.collapsedIds.includes(node.spaceId)

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
</script>

<style scoped lang="scss">
.space-tree {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.space-tree__node-wrapper {
  list-style: none;
}

.space-tree__node {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: var(--tjg-radius-sm);
  cursor: pointer;
  color: var(--tjg-text-primary);
  outline: none;
  transition:
    background-color var(--tjg-motion-duration-fast) var(--tjg-motion-ease-standard),
    color var(--tjg-motion-duration-fast) var(--tjg-motion-ease-standard);

  &:hover {
    background: var(--tjg-surface-list-hover);
  }

  &:focus-visible {
    box-shadow: 0 0 0 2px var(--tjg-color-primary-200);
  }

  &--selected {
    background: var(--tjg-surface-list-selected);
    color: var(--tjg-color-primary-500);
    font-weight: var(--tjg-font-weight-semibold);
  }
}

.space-tree__toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  border: 0;
  border-radius: var(--tjg-radius-xs);
  background: transparent;
  color: var(--tjg-text-tertiary);
  cursor: pointer;
  padding: 0;
  transition: transform var(--tjg-motion-duration-fast) var(--tjg-motion-ease-standard);

  &:hover {
    color: var(--tjg-text-primary);
    background: var(--tjg-surface-list-hover);
  }
}

.space-tree__toggle-icon {
  transition: transform var(--tjg-motion-duration-fast) var(--tjg-motion-ease-standard);

  &--collapsed {
    transform: rotate(0deg);
  }

  &:not(.space-tree__toggle-icon--collapsed) {
    transform: rotate(90deg);
  }
}

.space-tree__toggle-placeholder {
  display: inline-block;
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.space-tree__avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  border-radius: var(--tjg-radius-full);
  overflow: hidden;
  background: var(--tjg-surface-subtle);
}

.space-tree__avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.space-tree__avatar-placeholder {
  font-size: var(--tjg-font-size-sm);
  font-weight: var(--tjg-font-weight-medium);
  color: var(--tjg-text-secondary);
}

.space-tree__name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--tjg-font-size-base);
}

.space-tree__count {
  flex-shrink: 0;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: var(--tjg-radius-full);
  background: var(--tjg-surface-search);
  color: var(--tjg-text-tertiary);
  font-size: var(--tjg-font-size-2xs);
  font-weight: var(--tjg-font-weight-medium);
  line-height: 18px;
  text-align: center;
}

.space-tree__children {
  padding-left: 20px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.space-tree__room {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  border-radius: var(--tjg-radius-sm);
  cursor: pointer;
  color: var(--tjg-text-secondary);
  outline: none;
  transition: background-color var(--tjg-motion-duration-fast) var(--tjg-motion-ease-standard);

  &:hover {
    background: var(--tjg-surface-list-hover);
  }

  &:focus-visible {
    box-shadow: 0 0 0 2px var(--tjg-color-primary-200);
  }
}

.space-tree__room-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--tjg-text-tertiary);
  flex-shrink: 0;
}

.space-tree__room-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--tjg-font-size-sm);
}

.space-tree__empty {
  padding: 24px 16px;
  text-align: center;
  color: var(--tjg-text-tertiary);
  font-size: var(--tjg-font-size-sm);
}

@media (prefers-reduced-motion: reduce) {
  .space-tree__node,
  .space-tree__toggle,
  .space-tree__toggle-icon,
  .space-tree__room {
    transition: none;
  }
}
</style>
