<template>
  <div class="message-session-toolbar">
    <n-flex vertical :size="12" class="message-session-toolbar__content">
      <n-flex align="center" justify="space-between">
        <n-flex align="center" :size="8">
          <span class="message-session-toolbar__title">{{ resolvedTitle }}</span>
          <span v-if="showSummaryBadge" class="message-session-toolbar__summary">
            {{ filteredCount }}/{{ totalCount }}
          </span>
        </n-flex>
        <n-flex :size="8">
          <n-button v-if="showJoinAction" quaternary circle size="small" @click="emit('joinRoom')">
            <template #icon>
              <n-icon>
                <svg><use href="#add-user" /></svg>
              </n-icon>
            </template>
          </n-button>
          <n-button v-if="showCreateAction" quaternary circle size="small" @click="emit('createRoom')">
            <template #icon>
              <n-icon>
                <svg><use href="#plus" /></svg>
              </n-icon>
            </template>
          </n-button>
        </n-flex>
      </n-flex>

      <n-input
        :value="searchKeyword"
        clearable
        size="small"
        class="toolbar-search flex-1 min-w-0 bg-[--hula-surface-search] border-none"
        :placeholder="t('space.search_sessions_placeholder')"
        :aria-label="t('space.search_sessions_placeholder')"
        @update:value="emit('update:searchKeyword', $event)">
        <template #prefix>
          <svg class="size-14px color-[--hula-text-tertiary]">
            <use href="#search"></use>
          </svg>
        </template>
      </n-input>

      <n-flex :size="4" wrap>
        <n-button
          v-for="filter in filterOptions"
          :key="filter.value"
          :type="sessionEngagementFilter === filter.value ? 'primary' : 'default'"
          :aria-pressed="sessionEngagementFilter === filter.value"
          size="tiny"
          quaternary
          class="message-session-toolbar__filter"
          @click="emit('update:sessionEngagementFilter', filter.value)">
          {{ filter.label }}
        </n-button>
      </n-flex>
    </n-flex>
    <n-divider style="margin: 0" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  WORKBENCH_SESSION_ENGAGEMENT_FILTERS,
  type WorkbenchSessionEngagementFilter,
  type WorkbenchSessionSort,
  type WorkbenchSessionTypeFilter
} from '@/router/spaceNavigation'

const { t } = useI18n()

const props = withDefaults(
  defineProps<{
    searchKeyword: string
    sessionTypeFilter: WorkbenchSessionTypeFilter
    sessionEngagementFilter?: WorkbenchSessionEngagementFilter
    sessionSort: WorkbenchSessionSort
    filteredCount: number
    totalCount: number
    title?: string
    showCreateAction?: boolean
    showJoinAction?: boolean
    createButtonText?: string
  }>(),
  {
    sessionEngagementFilter: WORKBENCH_SESSION_ENGAGEMENT_FILTERS.all,
    title: '',
    showCreateAction: false,
    showJoinAction: false
  }
)

const emit = defineEmits<{
  'update:searchKeyword': [value: string]
  'update:sessionTypeFilter': [value: WorkbenchSessionTypeFilter]
  'update:sessionEngagementFilter': [value: WorkbenchSessionEngagementFilter]
  'update:sessionSort': [value: WorkbenchSessionSort]
  createRoom: []
  joinRoom: []
}>()

const filterOptions = computed(() => [
  { value: WORKBENCH_SESSION_ENGAGEMENT_FILTERS.all, label: t('space.engagement_all') },
  { value: WORKBENCH_SESSION_ENGAGEMENT_FILTERS.unread, label: t('space.engagement_unread') },
  { value: WORKBENCH_SESSION_ENGAGEMENT_FILTERS.mention, label: t('space.engagement_mention') }
])

const resolvedTitle = computed(() => props.title || t('home.action.message_short_title', '消息'))

const showSummaryBadge = computed(() => {
  return props.totalCount > 0 && props.filteredCount !== props.totalCount
})
</script>

<style scoped lang="scss">
.message-session-toolbar {
  background: var(--hula-surface-panel);
}

.message-session-toolbar__content {
  padding: 12px;
}

.message-session-toolbar__title {
  font-size: 14px;
  font-weight: 600;
  color: var(--hula-text-primary);
}

.message-session-toolbar__summary {
  font-size: 12px;
  color: var(--hula-text-tertiary);
}

.toolbar-search {
  border-radius: 12px;
}

.message-session-toolbar__filter {
  border-radius: 999px;
}
</style>
