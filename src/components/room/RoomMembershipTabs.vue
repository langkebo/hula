<template>
  <div
    class="room-membership-tabs inline-flex items-center gap-2px p-2px rounded-[--tjg-radius-md] bg-[--tjg-surface-subtle]"
    data-testid="membership-tabs"
    role="tablist"
    :aria-label="t('room.tab.label')">
    <button
      v-for="tab in tabs"
      :key="tab.value"
      type="button"
      class="room-membership-tabs__tab inline-flex items-center gap-4px px-10px py-4px rounded-[--tjg-radius-sm] text-[length:var(--tjg-font-size-sm)] transition-colors cursor-pointer border-none outline-none"
      :class="
        modelValue === tab.value
          ? 'bg-[--tjg-surface-raised] color-[--tjg-color-primary-500] font-[--tjg-font-weight-medium] shadow-[--tjg-shadow-card]'
          : 'bg-transparent color-[--tjg-text-secondary] hover:color-[--tjg-text-primary]'
      "
      data-testid="membership-tab"
      role="tab"
      :aria-selected="modelValue === tab.value"
      :aria-controls="`membership-panel-${tab.value}`"
      @click="handleClick(tab.value)">
      <span>{{ t(tab.label) }}</span>
      <span
        v-if="tab.count !== undefined && tab.count > 0"
        class="inline-flex items-center justify-center min-w-[16px] h-[16px] px-3px rounded-full text-[length:var(--tjg-font-size-2xs)]"
        :class="
          modelValue === tab.value
            ? 'bg-[--tjg-color-primary-100] color-[--tjg-color-primary-600]'
            : 'bg-[--tjg-surface-list-hover] color-[--tjg-text-tertiary]'
        "
        data-testid="membership-tab-count">
        {{ tab.count }}
      </span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { RoomMembershipFilter } from '@/composables/room/useRoomMembershipFilter'

const props = defineProps<{
  modelValue: RoomMembershipFilter
  joinedCount?: number
  createdCount?: number
}>()

const emit = defineEmits<{
  'update:modelValue': [value: RoomMembershipFilter]
}>()

const { t } = useI18n()

const tabs = computed(() => [
  { value: 'all' as const, label: 'room.tab.all', count: undefined },
  { value: 'joined' as const, label: 'room.tab.joined', count: props.joinedCount },
  { value: 'created' as const, label: 'room.tab.created', count: props.createdCount }
])

const handleClick = (value: RoomMembershipFilter) => {
  if (value === props.modelValue) return
  emit('update:modelValue', value)
}
</script>
