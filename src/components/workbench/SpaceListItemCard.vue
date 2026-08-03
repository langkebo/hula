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
    @contextmenu="emit('contextmenu', { space, event: $event })">
    <n-badge :dot="space.isPinned" color="var(--color-warning)" :offset="[-4, 4]">
      <div class="space-card__avatar">
        <n-avatar
          v-if="space.avatarUrl"
          :size="compact ? 36 : 40"
          :src="space.avatarUrl"
          round
          class="space-card__img" />
        <div v-else class="space-card__initials" :style="{ background: avatarColor }">
          {{ initials }}
        </div>
        <div v-if="space.unreadCount" class="space-card__unread-badge">
          {{ space.unreadCount > 99 ? '99+' : space.unreadCount }}
        </div>
      </div>
    </n-badge>
    <div class="space-card__content">
      <!-- 上行：空间名称 + 快速操作按钮 -->
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
          <n-tooltip trigger="hover">
            <template #trigger>
              <button type="button" class="space-card__action-btn" @click.stop="emit('leave', space.spaceId)">
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
                @click.stop="emit('delete', space.spaceId)">
                <svg class="size-12px">
                  <use href="#delete" />
                </svg>
              </button>
            </template>
            {{ t('space.delete_space') }}
          </n-tooltip>
        </n-flex>
        <span v-else-if="!compact && space.memberCount" class="space-card__member-count">
          {{ space.memberCount }} {{ t('space.members') }}
        </span>
      </div>
      <!-- 下行：主题/状态 + 元信息 -->
      <div class="space-card__desc-row">
        <n-flex align="center" :gap="4" class="min-w-0 flex-1">
          <!-- TJG: 公开/私有状态标签 -->
          <span
            v-if="space.statusText"
            class="space-card__status-pill"
            :class="[
              space.statusTone ? `space-card__status-pill--${space.statusTone}` : 'space-card__status-pill--neutral'
            ]">
            <svg v-if="space.isPublic" class="space-card__status-icon"><use href="#i-public" /></svg>
            <svg v-else class="space-card__status-icon"><use href="#i-lock" /></svg>
            {{ space.statusText }}
          </span>
          <!-- TJG: 成员数 -->
          <span v-if="!compact && space.memberCount" class="space-card__meta">
            <svg class="space-card__meta-icon"><use href="#i-friends" /></svg>
            {{ space.memberCount }}
          </span>
          <!-- TJG: 子房间数 -->
          <span v-if="!compact && space.childCount" class="space-card__meta">
            <svg class="space-card__meta-icon"><use href="#i-chat" /></svg>
            {{ space.childCount }}
          </span>
          <span v-if="!compact && space.topic" class="space-card__topic">{{ space.topic }}</span>
          <span
            v-else-if="!space.statusText && !space.memberCount && !space.childCount"
            class="space-card__placeholder">
            --
          </span>
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
  space: SpaceListItem
  active: boolean
  compact?: boolean
}>()

const emit = defineEmits<{
  click: []
  pin: [spaceId: string]
  settings: [spaceId: string]
  leave: [spaceId: string]
  delete: [spaceId: string]
  contextmenu: [payload: { space: SpaceListItem; event: MouseEvent }]
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
  gap: 12px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  padding: 12px;
  text-align: left;
  color: var(--hula-text-primary);
  cursor: pointer;
  min-height: 68px;
  transition:
    background-color 0.2s ease,
    box-shadow 0.2s ease;

  &:hover {
    background: var(--hula-surface-list-hover);
  }

  &:focus-visible {
    outline: 2px solid var(--hula-color-primary-500);
    outline-offset: 2px;
  }

  &--active {
    background: var(--hula-surface-session-active);
    box-shadow: var(--hula-surface-session-active-shadow);
    color: var(--hula-text-inverse);

    .space-card__topic,
    .space-card__meta,
    .space-card__member-count,
    .space-card__visibility,
    .space-card__placeholder {
      color: color-mix(in srgb, var(--hula-text-inverse) 72%, transparent);
    }

    .space-card__unread-badge {
      border-color: var(--hula-color-primary-500);
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
  color: var(--hula-text-inverse);
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
  background: var(--hula-color-danger-500);
  border: 2px solid var(--hula-surface-panel);
  color: var(--hula-text-inverse);
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
  color: var(--hula-text-primary);
}

.space-card--active .space-card__name {
  font-weight: 600;
}

.space-card__member-count {
  font-size: 12px;
  color: var(--hula-text-tertiary);
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
  background: var(--hula-surface-search);
  color: var(--hula-text-tertiary);
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    background: var(--hula-color-primary-100);
    color: var(--hula-color-primary-500);
  }

  &--danger:hover {
    background: var(--hula-color-danger-100);
    color: var(--hula-color-danger-500);
  }
}

.space-card--active .space-card__action-btn {
  background: color-mix(in srgb, var(--hula-text-inverse) 15%, transparent);
  color: color-mix(in srgb, var(--hula-text-inverse) 80%, transparent);

  &:hover {
    background: color-mix(in srgb, var(--hula-text-inverse) 25%, transparent);
    color: var(--hula-text-inverse);
  }

  &--danger:hover {
    background: color-mix(in srgb, var(--hula-color-danger-500) 30%, transparent);
    color: var(--hula-text-inverse);
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
  color: var(--hula-text-secondary);
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
  background: var(--hula-surface-search);
  color: var(--hula-text-tertiary);
}

.space-card__status-pill--info {
  background: var(--hula-color-primary-100);
  color: var(--hula-color-primary-500);
}

.space-card__status-pill--warning {
  background: color-mix(in srgb, var(--hula-color-warning-500) 16%, transparent);
  color: var(--hula-color-warning-500);
}

.space-card__visibility {
  font-size: 12px;
  color: var(--hula-text-tertiary);
  white-space: nowrap;
  line-height: 18px;
}

.space-card__meta {
  font-size: 12px;
  color: var(--hula-text-tertiary);
  line-height: 18px;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.space-card__meta-icon {
  width: 12px;
  height: 12px;
  color: currentColor;
}

.space-card__status-icon {
  width: 10px;
  height: 10px;
  color: currentColor;
}

.space-card__placeholder {
  font-size: 12px;
  color: var(--hula-text-quaternary);
  line-height: 18px;
}
</style>
