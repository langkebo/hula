<template>
  <n-scrollbar class="space-list-pane__list flex-1 min-h-0">
    <div class="space-list-pane__list-area p-8px" role="group" :aria-label="t('space.title')">
      <Transition name="space-fade" mode="out-in">
        <!-- 1. loading 骨架屏 -->
        <n-flex v-if="loading" vertical :size="8" class="space-list-pane__skeleton" key="skeleton">
          <div v-for="i in 4" :key="i" class="space-list-pane__skeleton-item">
            <n-skeleton circle :width="36" :height="36" :sharp="false" />
            <n-flex vertical :size="4" class="flex-1 min-w-0">
              <n-skeleton height="13px" width="70%" :sharp="false" class="rounded-4px" />
              <n-skeleton height="11px" width="40%" :sharp="false" class="rounded-4px" />
            </n-flex>
          </div>
        </n-flex>

        <!-- 2. 列表状态 -->
        <div v-else-if="hasVisibleSpaces" class="space-list-pane__sections" key="list">
          <!-- 性能优化：空间列表超过 100 项时启用虚拟滚动（需求文档 16.1） -->
          <template v-if="allFilteredSpaces.length > LIST_VIRTUALIZATION_THRESHOLD">
            <RecycleScroller
              class="space-list-pane__virtual-scroller"
              :items="allFilteredSpaces"
              :item-size="64"
              key-field="spaceId"
              v-slot="{ item }">
              <SpaceListItemCard
                :item="item"
                :active="selectedSpaceId === item.spaceId"
                @click="emit('selectSpace', item.spaceId)"
                @pin="emit('pinSpace', $event)"
                @settings="emit('spaceSettings', $event)"
                @leave="emit('leaveSpace', $event)"
                @delete="emit('deleteSpace', $event)" />
            </RecycleScroller>
          </template>
          <!-- 列表项 ≤ 100 时使用普通 v-for，保留分组结构 -->
          <template v-else>
            <!-- 我的空间分组 -->
            <div v-if="mySpaces.length" class="space-section">
              <div class="space-section__header">
                <span class="space-section__title">{{ t('space.section_my_spaces') }}</span>
                <span class="space-section__count">{{ mySpaces.length }}</span>
              </div>
              <div class="space-section__items" role="group">
                <TransitionGroup name="space-item-enter">
                  <SpaceListItemCard
                    v-for="space in mySpaces"
                    :key="space.spaceId"
                    :item="space"
                    :active="selectedSpaceId === space.spaceId"
                    @click="emit('selectSpace', space.spaceId)"
                    @pin="emit('pinSpace', $event)"
                    @settings="emit('spaceSettings', $event)"
                    @leave="emit('leaveSpace', $event)"
                    @delete="emit('deleteSpace', $event)" />
                </TransitionGroup>
              </div>
            </div>

            <!-- 公开空间分组 -->
            <div v-if="publicSpaces.length" class="space-section">
              <div class="space-section__header">
                <span class="space-section__title">{{ t('space.section_public_spaces') }}</span>
                <span class="space-section__count">{{ publicSpaces.length }}</span>
              </div>
              <div class="space-section__items" role="group">
                <TransitionGroup name="space-item-enter">
                  <SpaceListItemCard
                    v-for="space in publicSpaces"
                    :key="space.spaceId"
                    :item="space"
                    :active="selectedSpaceId === space.spaceId"
                    @click="emit('selectSpace', space.spaceId)"
                    @pin="emit('pinSpace', $event)"
                    @settings="emit('spaceSettings', $event)"
                    @leave="emit('leaveSpace', $event)"
                    @delete="emit('deleteSpace', $event)" />
                </TransitionGroup>
              </div>
            </div>
          </template>
        </div>

        <!-- 3. 空状态 / 搜索无结果 -->
        <div v-else class="space-list-pane__empty" key="empty">
          <EmptyState
            :illustration="isSearching ? 'no-results' : 'no-spaces'"
            :title="emptyDescription"
            :action-text="isSearching ? '' : t('space.create_space_action')"
            @action="emit('createSpace')" />
        </div>
      </Transition>
    </div>
  </n-scrollbar>
</template>

<script setup lang="ts">
import { NFlex, NScrollbar, NSkeleton } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { RecycleScroller } from 'vue-virtual-scroller'
import EmptyState from '@/components/common/EmptyState.vue'
import { LIST_VIRTUALIZATION_THRESHOLD } from '@/utils/listVirtualization'
import SpaceListItemCard from './SpaceListItemCard.vue'
import type { SpaceListItem } from './SpaceListPane.vue'

defineOptions({
  name: 'SpaceListBody'
})

defineProps<{
  loading: boolean
  mySpaces: SpaceListItem[]
  publicSpaces: SpaceListItem[]
  allFilteredSpaces: SpaceListItem[]
  hasVisibleSpaces: boolean
  selectedSpaceId: string
  emptyDescription: string
  isSearching: boolean
}>()

const emit = defineEmits<{
  selectSpace: [spaceId: string]
  pinSpace: [spaceId: string]
  spaceSettings: [spaceId: string]
  leaveSpace: [spaceId: string]
  deleteSpace: [spaceId: string]
  createSpace: []
}>()

const { t } = useI18n()
</script>

<style scoped lang="scss">
/* 列表区 */
.space-list-pane__list {
  min-height: 0;
}

.space-list-pane__list-area {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.space-list-pane__sections {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.space-list-pane__virtual-scroller {
  height: 100%;
  min-height: 200px;
}

/* 分组 */
.space-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.space-section__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 8px 4px;
}

.space-section__title {
  font-size: 11px;
  font-weight: 600;
  color: var(--tjg-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.space-section__count {
  font-size: 11px;
  color: var(--tjg-text-quaternary);
}

.space-section__items {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

/* 骨架屏 */
.space-list-pane__skeleton {
  padding: 8px;
}

.space-list-pane__skeleton-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px;
}

/* 空状态 */
.space-list-pane__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 16px;
}

/* 过渡动画 */
.space-fade-enter-active,
.space-fade-leave-active {
  transition: opacity var(--tjg-motion-duration-normal) ease;
}

.space-fade-enter-from,
.space-fade-leave-to {
  opacity: 0;
}

.space-item-enter-enter-active {
  transition:
    color var(--tjg-motion-duration-slow) ease,
    background-color var(--tjg-motion-duration-slow) ease,
    border-color var(--tjg-motion-duration-slow) ease,
    box-shadow var(--tjg-motion-duration-slow) ease,
    opacity var(--tjg-motion-duration-slow) ease,
    transform var(--tjg-motion-duration-slow) ease;
}

.space-item-enter-enter-from {
  opacity: 0;
  transform: translateY(6px);
}

.space-item-enter-leave-active {
  transition:
    color var(--tjg-motion-duration-normal) ease,
    background-color var(--tjg-motion-duration-normal) ease,
    border-color var(--tjg-motion-duration-normal) ease,
    box-shadow var(--tjg-motion-duration-normal) ease,
    opacity var(--tjg-motion-duration-normal) ease,
    transform var(--tjg-motion-duration-normal) ease;
}

.space-item-enter-leave-to {
  opacity: 0;
  transform: translateX(-8px);
}
</style>
