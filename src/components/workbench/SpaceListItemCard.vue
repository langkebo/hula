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
    @mouseleave="hovered = false"
    @contextmenu="emit('contextmenu', { item, event: $event })">
    <n-badge :dot="item.isPinned" color="var(--tjg-color-warning-500)" :offset="[-4, 4]">
      <div class="space-card__avatar">
        <n-avatar
          v-if="item.avatarUrl"
          :size="compact ? 36 : 40"
          :src="item.avatarUrl"
          round
          class="space-card__img" />
        <div v-else class="space-card__initials" :style="{ background: avatarColor }">
          {{ initials }}
        </div>
        <div v-if="item.unreadCount" class="space-card__unread-badge">
          {{ item.unreadCount > 99 ? '99+' : item.unreadCount }}
        </div>
      </div>
    </n-badge>
    <div class="space-card__content">
      <!-- 上行：空间名称 + 快速操作按钮 -->
      <div class="space-card__title-row">
        <span class="space-card__name">{{ item.name }}</span>
        <n-flex v-if="hovered && !active" :size="2" align="center" class="space-card__quick-actions" @click.stop>
          <n-tooltip trigger="hover">
            <template #trigger>
              <button type="button" class="space-card__action-btn" @click.stop="emit('pin', item.spaceId)">
                <svg class="size-12px">
                  <use :href="item.isPinned ? '#unpin' : '#pin'" />
                </svg>
              </button>
            </template>
            {{ item.isPinned ? t('space.unpin_space') : t('space.pin_space') }}
          </n-tooltip>
          <n-tooltip trigger="hover">
            <template #trigger>
              <button type="button" class="space-card__action-btn" @click.stop="emit('settings', item.spaceId)">
                <svg class="size-12px">
                  <use href="#settings" />
                </svg>
              </button>
            </template>
            {{ t('space.settings') }}
          </n-tooltip>
          <n-tooltip trigger="hover">
            <template #trigger>
              <button type="button" class="space-card__action-btn" @click.stop="emit('leave', item.spaceId)">
                <svg class="size-12px">
                  <use href="#logout" />
                </svg>
              </button>
            </template>
            {{ t('space.leave_space') }}
          </n-tooltip>
          <n-tooltip trigger="hover">
            <template #trigger>
              <button
                type="button"
                class="space-card__action-btn space-card__action-btn--danger"
                @click.stop="emit('delete', item.spaceId)">
                <svg class="size-12px">
                  <use href="#delete" />
                </svg>
              </button>
            </template>
            {{ t('space.delete_space') }}
          </n-tooltip>
        </n-flex>
        <span v-else-if="!compact && item.memberCount" class="space-card__member-count">
          {{ item.memberCount }} {{ t('space.members') }}
        </span>
      </div>
      <!-- 下行：主题/状态 + 元信息 -->
      <div class="space-card__desc-row">
        <n-flex align="center" :gap="4" class="min-w-0 flex-1">
          <span
            v-if="item.statusText"
            class="space-card__status-pill"
            :class="[
              item.statusTone ? `space-card__status-pill--${item.statusTone}` : 'space-card__status-pill--neutral'
            ]">
            {{ item.statusText }}
          </span>
          <span v-if="!compact && item.topic" class="space-card__topic">{{ item.topic }}</span>
          <span v-else-if="item.visibilityText" class="space-card__visibility">{{ item.visibilityText }}</span>
          <span v-else-if="!compact && item.childCount" class="space-card__meta">
            {{ item.childCount }} {{ t('space.rooms') }}
          </span>
          <span v-else class="space-card__placeholder">--</span>
        </n-flex>
      </div>
    </div>
  </button>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { SpaceListItem } from './SpaceListPane.vue'

const props = defineProps<{
  item: SpaceListItem
  active: boolean
  compact?: boolean
}>()

const emit = defineEmits<{
  click: []
  pin: [spaceId: string]
  settings: [spaceId: string]
  leave: [spaceId: string]
  delete: [spaceId: string]
  contextmenu: [payload: { item: SpaceListItem; event: MouseEvent }]
}>()

const { t } = useI18n()
const hovered = ref(false)

const initials = computed(() => {
  const name = props.item.name || ''
  return name.slice(0, 2).toUpperCase() || '?'
})

const avatarColor = computed(() => {
  let hash = 0
  for (let i = 0; i < props.item.spaceId.length; i++) {
    hash = props.item.spaceId.charCodeAt(i) + ((hash << 5) - hash)
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
  gap: 12px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  padding: 12px;
  text-align: left;
  color: var(--tjg-text-primary);
  cursor: pointer;
  min-height: 68px;
  transition:
    background-color 0.2s ease,
    box-shadow 0.2s ease;

  &:hover {
    background: var(--tjg-surface-list-hover);
  }

  &:focus-visible {
    outline: 2px solid var(--tjg-color-primary-500);
    outline-offset: 2px;
  }

  &--active {
    background: var(--tjg-surface-session-active);
    box-shadow: var(--tjg-surface-session-active-shadow);
    color: var(--tjg-text-inverse);

    .space-card__topic,
    .space-card__meta,
    .space-card__member-count,
    .space-card__visibility,
    .space-card__placeholder {
      color: color-mix(in srgb, var(--tjg-text-inverse) 72%, transparent);
    }

    .space-card__unread-badge {
      border-color: var(--tjg-color-primary-500);
    }
  }

  &--compact {
    padding: 10px;
    gap: 10px;
    min-height: 60px;
    border-radius: 10px;
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
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
  color: var(--tjg-text-inverse);
}

.space-card--compact .space-card__initials {
  width: 36px;
  height: 36px;
  font-size: 12px;
  border-radius: 8px;
}

.space-card__unread-badge {
  position: absolute;
  top: -6px;
  right: -8px;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: var(--tjg-color-danger-500);
  border: 2px solid var(--tjg-surface-panel);
  color: var(--tjg-text-inverse);
  font-size: 11px;
  font-weight: 700;
  line-height: 14px;
  text-align: center;
}

.space-card__content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.space-card__title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
}

.space-card__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  flex: 1;
  min-width: 0;
  color: var(--tjg-text-primary);
}

.space-card--active .space-card__name {
  font-weight: 600;
}

.space-card__member-count {
  font-size: 12px;
  color: var(--tjg-text-tertiary);
  line-height: 18px;
  white-space: nowrap;
  flex-shrink: 0;
}

.space-card__quick-actions {
  flex-shrink: 0;
}

.space-card__action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: 0;
  border-radius: 6px;
  background: var(--tjg-surface-search);
  color: var(--tjg-text-tertiary);
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    background: var(--tjg-color-primary-100);
    color: var(--tjg-color-primary-500);
  }

  &--danger:hover {
    background: var(--tjg-color-danger-100);
    color: var(--tjg-color-danger-500);
  }
}

.space-card--active .space-card__action-btn {
  background: color-mix(in srgb, var(--tjg-text-inverse) 15%, transparent);
  color: color-mix(in srgb, var(--tjg-text-inverse) 80%, transparent);

  &:hover {
    background: color-mix(in srgb, var(--tjg-text-inverse) 25%, transparent);
    color: var(--tjg-text-inverse);
  }

  &--danger:hover {
    background: color-mix(in srgb, var(--tjg-color-danger-500) 30%, transparent);
    color: var(--tjg-text-inverse);
  }
}

.space-card__desc-row {
  display: flex;
  align-items: center;
  min-width: 0;
}

.space-card__topic {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: var(--tjg-text-secondary);
  line-height: 18px;
}

.space-card__status-pill {
  display: inline-flex;
  align-items: center;
  padding: 0 6px;
  min-height: 18px;
  border-radius: 999px;
  font-size: 10px;
  line-height: 1.2;
  white-space: nowrap;
  flex-shrink: 0;
}

.space-card__status-pill--neutral {
  background: var(--tjg-surface-search);
  color: var(--tjg-text-tertiary);
}

.space-card__status-pill--info {
  background: var(--tjg-color-primary-100);
  color: var(--tjg-color-primary-500);
}

.space-card__status-pill--warning {
  background: color-mix(in srgb, var(--tjg-color-warning-500) 16%, transparent);
  color: var(--tjg-color-warning-500);
}

.space-card__visibility {
  font-size: 12px;
  color: var(--tjg-text-tertiary);
  white-space: nowrap;
  line-height: 18px;
}

.space-card__meta {
  font-size: 12px;
  color: var(--tjg-text-tertiary);
  line-height: 18px;
  white-space: nowrap;
}

.space-card__placeholder {
  font-size: 12px;
  color: var(--tjg-text-quaternary);
  line-height: 18px;
}
</style>
