<template>
  <div
    class="space-item"
    :class="{ active: isActive }"
    @click="$emit('click', space)"
    @contextmenu="$emit('context-menu', $event, space)">
    <n-avatar
      round
      :size="44"
      :src="avatarUrl"
      style="background-color: #722ed1">
      <template #fallback>
        <Icon icon="mdi:folder-multiple" :width="24" />
      </template>
    </n-avatar>

    <div class="space-info">
      <div class="space-header">
        <span class="space-name">{{ space.name || space.roomId }}</span>
      </div>
      <div class="space-meta">
        <span class="member-count">{{ space.memberCount || 0 }} {{ t('space.members') }}</span>
        <span class="separator">·</span>
        <span class="room-count">{{ space.childCount || 0 }} {{ t('space.rooms') }}</span>
      </div>
    </div>

    <div class="space-actions">
      <n-button text size="small" @click.stop="handleOpenSpace">
        <template #icon>
          <Icon icon="mdi:folder-open" :width="18" />
        </template>
      </n-button>
      <n-button text size="small" @click.stop="handleSettings">
        <template #icon>
          <Icon icon="mdi:cog" :width="18" />
        </template>
      </n-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, toRef } from 'vue'
import { NAvatar, NButton } from 'naive-ui'
import { Icon } from '@iconify/vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useSpaceStore, type Space } from '@/stores/space'
import { useRoomAvatar } from '@/composables/useAvatarUrl'

const props = defineProps<{
  space: Space
}>()

const emit = defineEmits<{
  (e: 'click', space: Space): void
  (e: 'context-menu', event: MouseEvent, space: Space): void
}>()

const { t } = useI18n()
const router = useRouter()
const spaceStore = useSpaceStore()

const isActive = computed(() => spaceStore.activeSpaceId === props.space.roomId)

const avatarUrl = useRoomAvatar(toRef(props, 'space'))

function handleOpenSpace() {
  router.push({ name: 'spaceDetail', params: { roomId: props.space.roomId } })
}

function handleSettings() {
  router.push({ name: 'spaceDetail', params: { roomId: props.space.roomId }, query: { edit: 'true' } })
}
</script>

<style scoped lang="scss">
.space-item {
  display: flex;
  align-items: center;
  padding: 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: var(--bg-color-hover);

    .space-actions {
      opacity: 1;
    }
  }

  &.active {
    background: var(--primary-color-light);
  }
}

.space-info {
  flex: 1;
  min-width: 0;
  margin-left: 12px;
}

.space-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.space-name {
  font-size: 14px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.space-meta {
  display: flex;
  align-items: center;
  margin-top: 4px;
  font-size: 13px;
  color: #999;
}

.separator {
  margin: 0 8px;
}

.space-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s;
}
</style>
