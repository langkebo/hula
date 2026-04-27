<template>
  <div class="space-list-pane border-r border-[--hula-border-default]">
    <div class="space-list-pane__header px-12px py-10px">
      <n-flex align="center" justify="space-between">
        <span class="text-13px font-500">{{ t('space.title') }}</span>
        <span class="text-12px color-[--hula-text-tertiary]">{{ spaces.length }}</span>
      </n-flex>
    </div>

    <n-spin :show="loading" class="h-full">
      <n-scrollbar class="h-full">
        <div class="space-list-pane__body p-8px">
          <button
            type="button"
            class="space-item"
            :class="{ 'space-item--active': !selectedSpaceId }"
            @click="emit('selectSpace', '')">
            <span class="space-item__name">{{ t('space.all_sessions') }}</span>
            <span class="space-item__meta">{{ totalCount }}</span>
          </button>

          <button
            v-for="space in spaces"
            :key="space.spaceId"
            type="button"
            class="space-item"
            :class="{ 'space-item--active': selectedSpaceId === space.spaceId }"
            @click="emit('selectSpace', space.spaceId)">
            <span class="space-item__name">{{ space.name }}</span>
            <span class="space-item__meta">{{ space.childCount }}</span>
          </button>
        </div>
      </n-scrollbar>
    </n-spin>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

type SpaceListItem = {
  spaceId: string
  name: string
  childCount: number
}

defineProps<{
  spaces: SpaceListItem[]
  selectedSpaceId: string
  loading: boolean
  totalCount: number
}>()

const emit = defineEmits<{
  selectSpace: [spaceId: string]
}>()

const { t } = useI18n()
</script>

<style scoped lang="scss">
.space-list-pane {
  width: 220px;
  min-width: 220px;
  height: 100%;
  background: var(--hula-surface-panel);
}

.space-list-pane__body {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.space-item {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  padding: 10px 12px;
  text-align: left;
  color: var(--hula-text-primary);
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.space-item:hover {
  background: var(--hula-surface-sidebar-hover);
}

.space-item--active {
  background: var(--hula-surface-sidebar-selected);
}

.space-item__name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
}

.space-item__meta {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--hula-text-tertiary);
}
</style>
