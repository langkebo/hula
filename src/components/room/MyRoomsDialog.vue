<template>
  <BaseRightDrawer
    :show="show"
    :title="t('room.my_rooms.title')"
    width="420px"
    @update:show="emit('update:show', $event)">
    <template #header-extra>
      <button
        type="button"
        class="my-rooms__refresh"
        :aria-label="t('room.my_rooms.refresh')"
        :title="t('room.my_rooms.refresh')"
        :disabled="loading"
        data-test="my-rooms-refresh"
        @click="load">
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
          :class="{ 'my-rooms__refresh-icon--spinning': loading }">
          <path d="M21 12a9 9 0 1 1-2.64-6.36" />
          <path d="M21 3v6h-6" />
        </svg>
      </button>
    </template>

    <div class="my-rooms">
      <input
        v-model="keyword"
        type="search"
        class="my-rooms__search"
        :placeholder="t('room.my_rooms.search_placeholder')"
        :aria-label="t('room.my_rooms.search_placeholder')"
        data-test="my-rooms-search" />

      <div v-if="loading" class="my-rooms__state" role="status" data-test="my-rooms-loading">
        <span class="my-rooms__spinner" aria-hidden="true" />
        <p class="my-rooms__state-text">{{ t('room.my_rooms.loading') }}</p>
      </div>

      <div v-else-if="error" class="my-rooms__state" role="alert" data-test="my-rooms-error">
        <p class="my-rooms__state-text">{{ t('room.my_rooms.error') }}</p>
        <button type="button" class="my-rooms__action" data-test="my-rooms-retry" @click="load">
          {{ t('room.my_rooms.retry') }}
        </button>
      </div>

      <EmptyState
        v-else-if="groups.length === 0"
        compact
        data-test="my-rooms-empty"
        :description="t('room.my_rooms.empty')" />

      <div v-else class="my-rooms__groups">
        <section
          v-for="group in groups"
          :key="group.key"
          class="my-rooms__group"
          :data-test="`my-rooms-group-${group.key}`">
          <h3 class="my-rooms__group-title">
            {{ group.label }}
            <span class="my-rooms__count">{{ group.items.length }}</span>
          </h3>
          <ul class="my-rooms__list">
            <li v-for="room in group.items" :key="room.roomId">
              <button
                type="button"
                class="my-rooms__item"
                data-test="my-rooms-item"
                @click="emit('open-room', room.roomId)">
                <span class="my-rooms__name">{{ room.name || t('room.my_rooms.unnamed') }}</span>
                <span class="my-rooms__id">{{ room.roomId }}</span>
              </button>
            </li>
          </ul>
        </section>
      </div>
    </div>
  </BaseRightDrawer>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseRightDrawer from '@/components/common/BaseRightDrawer.vue'
import { type MyRoomEntry, matrixAccountService } from '@/services/matrix/user/MatrixAccountService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('MyRoomsDialog')

type MyRoomsGroupKey = 'join' | 'invite' | 'leave'

interface MyRoomsGroup {
  key: MyRoomsGroupKey
  label: string
  items: MyRoomEntry[]
}

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  'open-room': [roomId: string]
}>()

const { t } = useI18n()

const rooms = ref<MyRoomEntry[]>([])
const keyword = ref('')
const loading = ref(false)
const error = ref(false)

const normalizedMembership = (membership: MyRoomEntry['membership']): MyRoomsGroupKey => {
  if (membership === 'invite' || membership === 'leave') {
    return membership
  }
  return 'join'
}

const filteredRooms = computed(() => {
  const query = keyword.value.trim().toLowerCase()
  if (!query) {
    return rooms.value
  }
  return rooms.value.filter((room) => {
    return room.name?.toLowerCase().includes(query) || room.roomId.toLowerCase().includes(query)
  })
})

const groups = computed<MyRoomsGroup[]>(() => {
  const buckets: Record<MyRoomsGroupKey, MyRoomEntry[]> = { join: [], invite: [], leave: [] }
  for (const room of filteredRooms.value) {
    buckets[normalizedMembership(room.membership)].push(room)
  }

  const labels: Record<MyRoomsGroupKey, string> = {
    join: t('room.my_rooms.group_join'),
    invite: t('room.my_rooms.group_invite'),
    leave: t('room.my_rooms.group_leave')
  }

  return (['join', 'invite', 'leave'] as const)
    .filter((key) => buckets[key].length > 0)
    .map((key) => ({ key, label: labels[key], items: buckets[key] }))
})

const load = async () => {
  loading.value = true
  error.value = false
  try {
    rooms.value = await matrixAccountService.getMyRooms()
  } catch (err) {
    error.value = true
    logger.error(`[MyRoomsDialog] failed to load my rooms: ${err}`)
  } finally {
    loading.value = false
  }
}

watch(
  () => props.show,
  (visible) => {
    if (!visible) {
      return
    }
    keyword.value = ''
    void load()
  },
  { immediate: true }
)
</script>

<style scoped lang="scss">
.my-rooms {
  display: flex;
  flex-direction: column;
  gap: var(--tjg-space-3);
  min-height: 100%;
}

.my-rooms__refresh {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: var(--tjg-radius-sm);
  background: transparent;
  color: var(--tjg-text-secondary);
  cursor: pointer;
  transition: background-color var(--tjg-motion-duration-fast) var(--tjg-motion-ease-standard);

  &:hover:not(:disabled) {
    background: var(--tjg-surface-list-hover);
    color: var(--tjg-text-primary);
  }

  &:disabled {
    color: var(--tjg-text-disabled);
    cursor: default;
  }

  &:focus-visible {
    outline: 2px solid var(--tjg-color-primary-500);
    outline-offset: 1px;
  }
}

.my-rooms__refresh-icon--spinning {
  animation: my-rooms-spin var(--tjg-motion-duration-xslow) linear infinite;
}

.my-rooms__search {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--tjg-border-default);
  border-radius: var(--tjg-radius-md);
  background: var(--tjg-surface-input);
  color: var(--tjg-text-primary);
  font-size: var(--tjg-font-size-sm);
  outline: none;
  transition: border-color var(--tjg-motion-duration-fast) var(--tjg-motion-ease-standard);

  &::placeholder {
    color: var(--tjg-text-tertiary);
  }

  &:focus-visible {
    border-color: var(--tjg-color-primary-500);
  }
}

.my-rooms__state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--tjg-space-3);
  padding: var(--tjg-space-8) var(--tjg-space-4);
  color: var(--tjg-text-secondary);
  text-align: center;
}

.my-rooms__state-text {
  margin: 0;
  font-size: var(--tjg-font-size-sm);
}

.my-rooms__spinner {
  width: 24px;
  height: 24px;
  border: 2px solid var(--tjg-border-muted);
  border-top-color: var(--tjg-color-primary-500);
  border-radius: var(--tjg-radius-full);
  animation: my-rooms-spin var(--tjg-motion-duration-slow) linear infinite;
}

.my-rooms__action {
  padding: 6px 16px;
  border: 1px solid var(--tjg-border-default);
  border-radius: var(--tjg-radius-md);
  background: var(--tjg-surface-panel-muted);
  color: var(--tjg-text-primary);
  font-size: var(--tjg-font-size-sm);
  cursor: pointer;
  transition: background-color var(--tjg-motion-duration-fast) var(--tjg-motion-ease-standard);

  &:hover {
    background: var(--tjg-surface-list-hover);
  }

  &:focus-visible {
    outline: 2px solid var(--tjg-color-primary-500);
    outline-offset: 1px;
  }
}

.my-rooms__groups {
  display: flex;
  flex-direction: column;
  gap: var(--tjg-space-4);
}

.my-rooms__group-title {
  display: flex;
  align-items: center;
  gap: var(--tjg-space-2);
  margin: 0 0 var(--tjg-space-2);
  color: var(--tjg-text-secondary);
  font-size: var(--tjg-font-size-xs);
  font-weight: var(--tjg-font-weight-medium);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.my-rooms__count {
  padding: 0 6px;
  border-radius: var(--tjg-radius-full);
  background: var(--tjg-surface-panel-muted);
  color: var(--tjg-text-tertiary);
  font-size: var(--tjg-font-size-2xs);
}

.my-rooms__list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.my-rooms__item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
  padding: 8px 10px;
  border: none;
  border-radius: var(--tjg-radius-sm);
  background: transparent;
  color: var(--tjg-text-primary);
  text-align: left;
  cursor: pointer;
  transition: background-color var(--tjg-motion-duration-fast) var(--tjg-motion-ease-standard);

  &:hover {
    background: var(--tjg-surface-list-hover);
  }

  &:focus-visible {
    outline: 2px solid var(--tjg-color-primary-500);
    outline-offset: -2px;
  }
}

.my-rooms__name {
  font-size: var(--tjg-font-size-sm);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.my-rooms__id {
  color: var(--tjg-text-tertiary);
  font-family: var(--tjg-font-family-mono);
  font-size: var(--tjg-font-size-2xs);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@keyframes my-rooms-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .my-rooms__spinner,
  .my-rooms__refresh-icon--spinning {
    animation: none;
  }

  .my-rooms__refresh,
  .my-rooms__search,
  .my-rooms__action,
  .my-rooms__item {
    transition: none;
  }
}
</style>
