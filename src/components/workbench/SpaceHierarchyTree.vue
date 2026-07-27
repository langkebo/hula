<template>
  <div class="space-hierarchy-tree">
    <!-- 面板头：返回按钮 + 标题 -->
    <header class="space-hierarchy-tree__header" data-test="space-hierarchy-header">
      <button
        type="button"
        class="space-hierarchy-tree__back"
        data-test="space-hierarchy-back"
        :aria-label="t('common.back')"
        @click="emit('back')">
        <svg class="size-16px"><use href="#arrow-left" /></svg>
      </button>
      <span class="space-hierarchy-tree__title">{{ t('space.hierarchy_title') }}</span>
    </header>

    <!-- 树形主体：复用 HulaSpaceTree -->
    <div class="space-hierarchy-tree__body">
      <HulaSpaceTree :space-id="spaceId" @select="handleSelect" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { SpaceInfo } from '@/composables/space'
import HulaSpaceTree from './HulaSpaceTree.vue'

const props = defineProps<{
  spaceId: string
}>()

const emit = defineEmits<{
  back: []
  select: [space: SpaceInfo]
}>()

const { t } = useI18n()

const handleSelect = (space: SpaceInfo) => {
  emit('select', space)
}
</script>

<style scoped lang="scss">
.space-hierarchy-tree {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--hula-surface-panel);
}

.space-hierarchy-tree__header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--hula-border-layout-divider);
  flex-shrink: 0;
}

.space-hierarchy-tree__back {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--hula-text-secondary);
  cursor: pointer;
  transition: background-color 0.15s ease;

  &:hover {
    background: var(--hula-surface-list-hover);
  }
}

.space-hierarchy-tree__title {
  flex: 1;
  font-size: 15px;
  font-weight: 600;
  color: var(--hula-text-primary);
}

.space-hierarchy-tree__body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 8px;
}
</style>
