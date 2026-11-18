<template>
  <div class="room-parent-spaces">
    <div class="parent-spaces-label">
      <Icon icon="mdi:folder-outline" class="size-14px" />
      <span>{{ t('room.detail.parent_spaces') }}</span>
    </div>

    <n-spin v-if="loading" size="small" class="parent-spaces-spin" />

    <div v-else-if="parentSpaces.length > 0" class="parent-spaces-tags">
      <n-tag
        v-for="space in parentSpaces"
        :key="space.spaceId"
        size="small"
        round
        :bordered="false"
        type="info"
        class="parent-space-tag"
        @click="handleSpaceClick(space)">
        <Icon icon="mdi:folder-star-outline" class="size-12px mr-4px" />
        {{ space.name || space.spaceId }}
      </n-tag>
    </div>

    <span v-else-if="loadError" class="parent-spaces-error">
      {{ t('room.detail.parent_spaces_load_failed') }}
      <button type="button" class="parent-spaces-retry" data-testid="parent-spaces-retry" @click="loadParentSpaces">
        {{ t('common.retry') }}
      </button>
    </span>

    <span v-else class="parent-spaces-empty">{{ t('room.detail.no_parent_spaces') }}</span>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import type { SpaceInfo } from '@/services/matrix/room/MatrixSpaceService'
import { matrixSpaceService } from '@/services/matrix/room/MatrixSpaceService'

const props = defineProps<{
  roomId: string
}>()

const { t } = useI18n()
const router = useRouter()

const loading = ref(false)
const loadError = ref(false)
const parentSpaces = ref<SpaceInfo[]>([])

const loadParentSpaces = async () => {
  if (!props.roomId) return
  loading.value = true
  loadError.value = false
  try {
    parentSpaces.value = await matrixSpaceService.getRoomParentSpaces(props.roomId)
  } catch {
    // 失败不能当成「无所属空间」：两者语义相反
    parentSpaces.value = []
    loadError.value = true
  } finally {
    loading.value = false
  }
}

const handleSpaceClick = (space: SpaceInfo) => {
  router.push({ name: 'space-detail', params: { spaceId: space.spaceId } }).catch(() => {
    // Navigation may fail if route doesn't exist; ignore
  })
}

watch(() => props.roomId, loadParentSpaces, { immediate: true })
</script>

<style scoped lang="scss">
.room-parent-spaces {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.parent-spaces-label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--tjg-text-tertiary);
}

.parent-spaces-spin {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px 0;
}

.parent-spaces-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.parent-space-tag {
  cursor: pointer;
  transition: opacity var(--tjg-motion-duration-fast);

  &:hover {
    opacity: 0.8;
  }
}

.parent-spaces-empty {
  font-size: 12px;
  color: var(--tjg-text-tertiary);
  font-style: italic;
}

.parent-spaces-error {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--tjg-text-secondary);
}

.parent-spaces-retry {
  padding: 0;
  border: 0;
  background: none;
  font-size: 12px;
  color: var(--tjg-color-primary-500);
  cursor: pointer;
}
</style>
