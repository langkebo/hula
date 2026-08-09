<template>
  <div class="room-card-grid h-full" data-testid="room-card-grid">
    <n-scrollbar class="h-full">
      <div
        v-if="loading"
        class="room-card-grid__loading flex-center py-[--tjg-space-8]"
        data-testid="room-card-grid-loading">
        <n-spin size="medium" />
      </div>

      <div
        v-else-if="rooms.length === 0"
        class="room-card-grid__empty h-full flex-center flex-col gap-[--tjg-space-3] py-[--tjg-space-10]"
        data-testid="room-card-grid-empty"
        role="status">
        <n-empty :description="resolvedEmptyDescription" size="large">
          <template #icon>
            <svg class="size-48px opacity-50 color-[--tjg-text-quaternary]" aria-hidden="true">
              <use href="#view-grid-card"></use>
            </svg>
          </template>
        </n-empty>
      </div>

      <div
        v-else
        class="room-card-grid__body grid gap-[--tjg-space-3] p-[--tjg-space-3]"
        style="grid-template-columns: repeat(auto-fill, minmax(220px, 1fr))">
        <RoomCardItem
          v-for="room in rooms"
          :key="room.roomId"
          :room="room"
          @preview="onPreview"
          @message="onMessage"
          @info="onInfo"
          @settings="onSettings"
          @pin="onPin" />
      </div>
    </n-scrollbar>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import RoomCardItem, { type RoomCardViewModel } from './RoomCardItem.vue'

const props = defineProps<{
  rooms: RoomCardViewModel[]
  loading?: boolean
  emptyDescription?: string
}>()

const emit = defineEmits<{
  preview: [roomId: string]
  message: [roomId: string]
  info: [roomId: string]
  settings: [roomId: string]
  pin: [roomId: string]
}>()

const { t } = useI18n()

const resolvedEmptyDescription = computed(() => props.emptyDescription || t('space.empty_sessions'))

const onPreview = (roomId: string) => emit('preview', roomId)
const onMessage = (roomId: string) => emit('message', roomId)
const onInfo = (roomId: string) => emit('info', roomId)
const onSettings = (roomId: string) => emit('settings', roomId)
const onPin = (roomId: string) => emit('pin', roomId)
</script>

<style scoped lang="scss">
.room-card-grid {
  background: var(--tjg-surface-panel);
}

.room-card-grid__body {
  align-content: start;
}
</style>
