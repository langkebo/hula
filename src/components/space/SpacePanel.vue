<template>
  <div class="space-panel">
    <div class="space-header">
      <span class="space-title">{{ t('space.title') }}</span>
      <n-button text @click="showCreateDialog">
        <template #icon>
          <svg class="size-18px">
            <use href="#add"></use>
          </svg>
        </template>
      </n-button>
    </div>

    <div class="space-list">
      <n-scrollbar>
        <div
          v-for="space in spaces"
          :key="space.spaceId"
          class="space-item"
          :class="{ active: activeSpaceId === space.spaceId }"
          @click="handleSpaceClick(space)">
          <n-avatar round :size="40" :src="space.avatarUrl" />
          <div class="space-info">
            <span class="space-name">{{ space.name }}</span>
            <span class="space-meta">{{ space.memberCount }} {{ t('space.members') }}</span>
          </div>
        </div>
      </n-scrollbar>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useMatrixStore } from '@/stores/domains/chat/matrix'
import { useSpaceStore } from '@/stores/domains/widget/space'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('SpacePanel')
const { t } = useI18n()
const router = useRouter()
const matrixStore = useMatrixStore()
const spaceStore = useSpaceStore()

const spaces = computed(() => spaceStore.spaces)
const activeSpaceId = computed(() => spaceStore.activeSpaceId)

const handleSpaceClick = (space: any) => {
  spaceStore.setActiveSpace(space.roomId)
  router.push({ name: 'space', params: { roomId: space.roomId } })
}

const showCreateDialog = () => {
  router.push({ name: 'create-space' })
}
</script>

<style scoped lang="scss">
.space-panel {
  padding: 16px;
}

.space-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.space-title {
  font-size: 16px;
  font-weight: 600;
}

.space-list {
  max-height: 400px;
  overflow-y: auto;
}

.space-item {
  display: flex;
  align-items: center;
  padding: 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: var(--bg-color-hover);
  }

  &.active {
    background: var(--bg-color-active);
  }
}

.space-info {
  display: flex;
  flex-direction: column;
  margin-left: 12px;
}

.space-name {
  font-size: 14px;
  font-weight: 500;
}

.space-meta {
  font-size: 12px;
  color: var(--text-color-secondary);
  margin-top: 4px;
}
</style>
