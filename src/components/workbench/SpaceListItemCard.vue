<template>
  <button
    type="button"
    class="space-card"
    :class="{
      'space-card--active': active,
      'space-card--compact': compact
    }"
    @click="emit('click')"
    @mouseenter="hovered = true"
    @mouseleave="hovered = false">
    <div class="space-card__avatar">
      <n-avatar v-if="space.avatarUrl" :size="compact ? 28 : 32" :src="space.avatarUrl" round class="space-card__img" />
      <div v-else class="space-card__initials" :style="{ background: avatarColor }">
        {{ initials }}
      </div>
      <div v-if="space.unreadCount" class="space-card__unread-badge">
        {{ space.unreadCount > 99 ? '99+' : space.unreadCount }}
      </div>
    </div>
    <div class="space-card__content">
      <div class="space-card__title-row">
        <span class="space-card__name">{{ space.name }}</span>
        <n-flex v-if="hovered && !active" :size="2" align="center" class="space-card__quick-actions" @click.stop>
          <n-tooltip trigger="hover">
            <template #trigger>
              <button type="button" class="space-card__action-btn" @click.stop="emit('pin', space.spaceId)">
                <svg class="size-12px">
                  <use :href="space.isPinned ? '#unpin' : '#pin'" />
                </svg>
              </button>
            </template>
            {{ space.isPinned ? t('space.unpin_space') : t('space.pin_space') }}
          </n-tooltip>
          <n-tooltip trigger="hover">
            <template #trigger>
              <button type="button" class="space-card__action-btn" @click.stop="emit('settings', space.spaceId)">
                <svg class="size-12px">
                  <use href="#settings" />
                </svg>
              </button>
            </template>
            {{ t('space.settings') }}
          </n-tooltip>
        </n-flex>
      </div>
      <span v-if="!compact && space.topic" class="space-card__topic">{{ space.topic }}</span>
      <span class="space-card__meta">
        <template v-if="space.memberCount">{{ space.memberCount }} {{ t('space.members') }}</template>
        <template v-if="space.memberCount && space.childCount">·</template>
        <template v-if="space.childCount">{{ space.childCount }} {{ t('space.rooms') }}</template>
      </span>
    </div>
  </button>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { SpaceListItem } from './SpaceListPane.vue'

const props = defineProps<{
  space: SpaceListItem
  active: boolean
  compact?: boolean
}>()

const emit = defineEmits<{
  click: []
  pin: [spaceId: string]
  settings: [spaceId: string]
}>()

const { t } = useI18n()
const hovered = ref(false)

const initials = computed(() => {
  const name = props.space.name || ''
  return name.slice(0, 2).toUpperCase() || '?'
})

const avatarColor = computed(() => {
  let hash = 0
  for (let i = 0; i < props.space.spaceId.length; i++) {
    hash = props.space.spaceId.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = Math.abs(hash) % 360
  return `hsl(${hue}, 45%, 55%)`
})
</script>

<style scoped lang="scss">
.space-card {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 10px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  padding: 8px 10px;
  text-align: left;
  color: var(--hula-text-primary);
  cursor: pointer;
  transition: background-color 0.2s ease;

  &:hover {
    background: var(--hula-surface-list-hover);
  }

  &--active {
    background: var(--hula-surface-session-active);
    color: #ffffff;

    .space-card__topic,
    .space-card__meta {
      color: rgba(255, 255, 255, 0.72);
    }

    .space-card__unread-badge {
      border-color: rgba(78, 205, 196, 1);
    }
  }

  &--compact {
    padding: 6px 8px;
    gap: 8px;
  }
}

.space-card__avatar {
  position: relative;
  flex-shrink: 0;
}

.space-card__img {
  display: block;
}

.space-card__initials {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  color: #ffffff;
}

.space-card--compact .space-card__initials {
  width: 28px;
  height: 28px;
  font-size: 11px;
}

.space-card__unread-badge {
  position: absolute;
  top: -6px;
  right: -8px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 8px;
  background: #ff4d4f;
  border: 2px solid var(--hula-surface-panel);
  color: #ffffff;
  font-size: 10px;
  font-weight: 700;
  line-height: 12px;
  text-align: center;
}

.space-card__content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.space-card__title-row {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}

.space-card__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 500;
  line-height: 18px;
  flex: 1;
  min-width: 0;
}

.space-card__quick-actions {
  flex-shrink: 0;
}

.space-card__action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: 0;
  border-radius: 6px;
  background: var(--hula-surface-search);
  color: var(--hula-text-tertiary);
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    background: var(--hula-color-primary-100);
    color: var(--hula-color-primary-500);
  }
}

.space-card--active .space-card__action-btn {
  background: rgba(255, 255, 255, 0.15);
  color: rgba(255, 255, 255, 0.8);

  &:hover {
    background: rgba(255, 255, 255, 0.25);
    color: #ffffff;
  }
}

.space-card__topic {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
  color: var(--hula-text-tertiary);
  line-height: 15px;
}

.space-card__meta {
  font-size: 11px;
  color: var(--hula-text-quaternary);
  line-height: 15px;
}
</style>
