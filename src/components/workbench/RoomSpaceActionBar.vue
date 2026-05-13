<template>
  <div
    class="room-space-action-bar border-b border-[--hula-border-default] px-12px py-10px"
    :class="{ 'room-space-action-bar--compact': compact }">
    <n-flex align="center" justify="space-between" :size="12" wrap>
      <n-flex vertical :size="4" class="min-w-0">
        <n-flex align="center" :size="6">
          <span class="truncate text-14px font-500">{{ spaceName }}</span>
          <n-tag v-if="isPublicSpace" size="tiny" :bordered="false" class="action-bar-visibility-tag">
            {{ t('space.public') }}
          </n-tag>
          <n-tag
            v-else
            size="tiny"
            :bordered="false"
            class="action-bar-visibility-tag action-bar-visibility-tag--private">
            {{ t('space.private') }}
          </n-tag>
        </n-flex>
        <n-flex align="center" :size="6" class="text-12px color-[--hula-text-tertiary]">
          <span>{{ roomCount }} {{ t('space.rooms') }}</span>
          <span>·</span>
          <span>{{ t('space.sessions_count', { count: sessionCount }) }}</span>
          <template v-if="memberCount">
            <span>·</span>
            <span>{{ memberCount }} {{ t('space.members') }}</span>
          </template>
          <template v-if="(unreadCount ?? 0) > 0">
            <span>·</span>
            <span class="color-[--hula-color-danger-500]">{{ unreadCount }} {{ t('space.unread') }}</span>
          </template>
        </n-flex>
      </n-flex>

      <n-flex align="center" :size="6" wrap>
        <n-tooltip trigger="hover">
          <template #trigger>
            <n-button size="small" secondary @click="emit('discover')">
              <template #icon>
                <svg class="size-14px"><use href="#search" /></svg>
              </template>
            </n-button>
          </template>
          {{ t('space.discover') }}
        </n-tooltip>

        <n-tooltip trigger="hover">
          <template #trigger>
            <n-button size="small" secondary :disabled="!canManageSpace" @click="emit('invite')">
              <template #icon>
                <svg class="size-14px"><use href="#add-user" /></svg>
              </template>
            </n-button>
          </template>
          {{ t('space.invite') }}
        </n-tooltip>

        <n-tooltip trigger="hover">
          <template #trigger>
            <n-button size="small" secondary :disabled="!canManageSpace" @click="emit('addRoom')">
              <template #icon>
                <svg class="size-14px"><use href="#add" /></svg>
              </template>
            </n-button>
          </template>
          {{ t('space.add_room') }}
        </n-tooltip>

        <n-tooltip trigger="hover">
          <template #trigger>
            <n-button size="small" secondary :disabled="!canManageSpace" @click="emit('members')">
              <template #icon>
                <svg class="size-14px"><use href="#team" /></svg>
              </template>
            </n-button>
          </template>
          {{ t('space.members') }}
        </n-tooltip>

        <n-tooltip trigger="hover">
          <template #trigger>
            <n-button size="small" secondary :disabled="!canManageSpace" @click="emit('settings')">
              <template #icon>
                <svg class="size-14px"><use href="#setting" /></svg>
              </template>
            </n-button>
          </template>
          {{ t('space.settings') }}
        </n-tooltip>
      </n-flex>
    </n-flex>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineProps<{
  spaceName: string
  roomCount: number
  sessionCount: number
  memberCount?: number
  unreadCount?: number
  isPublicSpace?: boolean
  canManageSpace: boolean
  compact?: boolean
}>()

const emit = defineEmits<{
  discover: []
  invite: []
  addRoom: []
  members: []
  settings: []
}>()

const { t } = useI18n()
</script>

<style scoped lang="scss">
.room-space-action-bar {
  background: var(--hula-surface-panel);
}

.room-space-action-bar--compact {
  padding: 10px;
}

.action-bar-visibility-tag {
  background: var(--hula-color-primary-100) !important;
  color: var(--hula-color-primary-600) !important;
  font-size: 10px;
  border-radius: 4px;
  flex-shrink: 0;

  &--private {
    background: var(--hula-surface-panel-muted) !important;
    color: var(--hula-text-tertiary) !important;
  }
}
</style>
