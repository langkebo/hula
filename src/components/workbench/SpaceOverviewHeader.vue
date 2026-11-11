<template>
  <section class="space-details-pane__overview" data-test="space-overview">
    <div class="space-details-pane__avatar-area">
      <n-avatar v-if="space.avatarUrl" :size="96" :src="space.avatarUrl" round class="space-details-pane__avatar" />
      <div v-else class="space-details-pane__avatar-fallback" :style="{ background: avatarColor }">
        {{ initials }}
      </div>
    </div>

    <!-- 空间名称：内联编辑（canManage 时可编辑） -->
    <InlineEdit
      v-if="canManage"
      class="space-details-pane__name-edit"
      :label="t('space.name_label')"
      :value="space.name || ''"
      :placeholder="t('space.name_placeholder')"
      :loading="savingSpaceName"
      :edit-aria-label="t('space.edit_name')"
      :maxlength="100"
      @submit="emit('saveSpaceName', $event)" />
    <h2 v-else class="space-details-pane__name">{{ space.name }}</h2>

    <!-- 空间简介：内联编辑（canManage 时可编辑） -->
    <InlineEdit
      v-if="canManage"
      class="space-details-pane__topic-edit"
      :label="t('space.topic_label')"
      :value="space.topic || ''"
      :placeholder="t('space.topic_placeholder')"
      :loading="savingSpaceTopic"
      :edit-aria-label="t('space.edit_topic')"
      :maxlength="500"
      multiline
      :rows="3"
      @submit="emit('saveSpaceTopic', $event)" />
    <template v-else>
      <p v-if="space.topic" class="space-details-pane__topic">{{ space.topic }}</p>
      <p v-else class="space-details-pane__topic space-details-pane__topic--empty">
        {{ t('space.detail_space_topic_empty') }}
      </p>
    </template>

    <div class="space-details-pane__stats">
      <span class="space-details-pane__stat">
        <svg class="size-14px"><use href="#user" /></svg>
        <span>{{ t('space.member_count_value', { count: space.memberCount ?? 0 }) }}</span>
      </span>
      <span class="space-details-pane__stat">
        <svg class="size-14px"><use href="#grid" /></svg>
        <span>{{ t('space.room_count_value', { count: space.childCount ?? 0 }) }}</span>
      </span>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import InlineEdit from '@/components/atomic/InlineEdit.vue'
import type { SpaceListItem } from './SpaceListPane.vue'

const props = defineProps<{
  space: SpaceListItem
  canManage?: boolean
  savingSpaceName?: boolean
  savingSpaceTopic?: boolean
}>()

const emit = defineEmits<{
  saveSpaceName: [value: string]
  saveSpaceTopic: [value: string]
}>()

const { t } = useI18n()

const initials = computed(() => {
  const name = props.space.name || ''
  return name.slice(0, 2).toUpperCase() || '?'
})

const avatarColor = computed(() => {
  const id = props.space.spaceId || ''
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = Math.abs(hash) % 360
  return `hsl(${hue}, 45%, 55%)`
})
</script>

<style scoped lang="scss">
.space-details-pane__overview {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 16px 0 8px;
}

.space-details-pane__avatar-area {
  display: flex;
  justify-content: center;
}

.space-details-pane__avatar {
  display: block;
}

.space-details-pane__avatar-fallback {
  width: 96px;
  height: 96px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  font-weight: 600;
  color: var(--tjg-text-inverse);
}

.space-details-pane__name {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--tjg-text-primary);
  text-align: center;
}

.space-details-pane__topic {
  margin: 0;
  font-size: 13px;
  color: var(--tjg-text-secondary);
  text-align: center;
  max-width: 480px;
  line-height: 1.5;

  &--empty {
    color: var(--tjg-text-quaternary);
    font-style: italic;
  }
}

.space-details-pane__stats {
  display: flex;
  gap: 20px;
  padding: 8px 0;
}

.space-details-pane__stat {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--tjg-text-tertiary);

  svg {
    color: var(--tjg-text-quaternary);
  }
}
</style>
