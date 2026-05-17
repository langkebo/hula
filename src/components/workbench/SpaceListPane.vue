<template>
  <nav
    class="space-list-pane border-r border-[--hula-border-default]"
    :aria-label="t('space.title')"
    :class="{
      'space-list-pane--compact': compact,
      'space-list-pane--narrow': narrow,
      'space-list-pane--rail': narrow
    }">
    <div class="space-list-pane__header px-12px py-10px" :class="{ 'space-list-pane__header--rail': narrow }">
      <n-input
        v-model:value="searchQuery"
        size="small"
        :placeholder="t('space.search_placeholder')"
        clearable
        round
        class="space-list-pane__search"
        :input-props="narrow ? { 'aria-label': t('space.search_placeholder') } : undefined">
        <template #prefix>
          <svg class="size-14px"><use href="#search" /></svg>
        </template>
      </n-input>
    </div>

    <n-spin :show="loading" class="flex-1 min-h-0">
      <n-scrollbar class="h-full">
        <div class="space-list-pane__body p-8px" role="list" :aria-label="t('space.title')">
          <button
            type="button"
            class="space-item"
            :class="{ 'space-item--active': !selectedSpaceId && !highlightedSpaceId, 'space-item--rail': narrow }"
            :title="t('space.all_sessions')"
            :aria-pressed="!selectedSpaceId && !highlightedSpaceId"
            @click="emit('selectSpace', '')">
            <div class="space-item__icon space-item__icon--global">
              <svg class="size-16px"><use href="#grid" /></svg>
            </div>
            <div class="space-item__content">
              <span class="space-item__name">{{ t('space.all_sessions') }}</span>
              <span v-if="!narrow" class="space-item__meta">{{ totalCount }} {{ t('space.sessions') }}</span>
            </div>
          </button>

          <div v-if="pinnedSpaces.length" class="space-section">
            <button
              :id="getSectionButtonId('pinned')"
              type="button"
              class="space-section__header"
              :title="t('space.pinned')"
              :aria-controls="getSectionPanelId('pinned')"
              :aria-expanded="expandedSections.pinned"
              @click="toggleSection('pinned')">
              <svg
                class="size-12px space-section__chevron"
                :class="{ 'space-section__chevron--collapsed': !expandedSections.pinned }"
                viewBox="0 0 12 12"
                fill="none"
                xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M3 4.5L6 7.5L9 4.5"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round" />
              </svg>
              <span class="space-section__title">{{ t('space.pinned') }}</span>
              <span v-if="!narrow" class="space-section__count">{{ pinnedSpaces.length }}</span>
            </button>
            <div
              v-show="expandedSections.pinned"
              :id="getSectionPanelId('pinned')"
              class="space-section__items"
              role="group"
              :aria-labelledby="getSectionButtonId('pinned')">
              <SpaceCard
                v-for="space in pinnedSpaces"
                :key="space.spaceId"
                :space="space"
                :active="selectedSpaceId === space.spaceId || highlightedSpaceId === space.spaceId"
                :compact="compact || narrow"
                @click="emit('selectSpace', space.spaceId)"
                @pin="emit('pinSpace', $event)"
                @settings="emit('spaceSettings', $event)" />
            </div>
          </div>

          <div v-if="joinedSpaces.length" class="space-section">
            <button
              :id="getSectionButtonId('joined')"
              type="button"
              class="space-section__header"
              :title="t('space.joined')"
              :aria-controls="getSectionPanelId('joined')"
              :aria-expanded="expandedSections.joined"
              @click="toggleSection('joined')">
              <svg
                class="size-12px space-section__chevron"
                :class="{ 'space-section__chevron--collapsed': !expandedSections.joined }"
                viewBox="0 0 12 12"
                fill="none"
                xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M3 4.5L6 7.5L9 4.5"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round" />
              </svg>
              <span class="space-section__title">{{ t('space.joined') }}</span>
              <span v-if="!narrow" class="space-section__count">{{ joinedSpaces.length }}</span>
            </button>
            <div
              v-show="expandedSections.joined"
              :id="getSectionPanelId('joined')"
              class="space-section__items"
              role="group"
              :aria-labelledby="getSectionButtonId('joined')">
              <SpaceCard
                v-for="space in joinedSpaces"
                :key="space.spaceId"
                :space="space"
                :active="selectedSpaceId === space.spaceId || highlightedSpaceId === space.spaceId"
                :compact="compact || narrow"
                @click="emit('selectSpace', space.spaceId)"
                @pin="emit('pinSpace', $event)"
                @settings="emit('spaceSettings', $event)" />
            </div>
          </div>

          <div v-if="lowPrioritySpaces.length" class="space-section">
            <button
              :id="getSectionButtonId('lowPriority')"
              type="button"
              class="space-section__header"
              :title="t('space.low_priority')"
              :aria-controls="getSectionPanelId('lowPriority')"
              :aria-expanded="expandedSections.lowPriority"
              @click="toggleSection('lowPriority')">
              <svg
                class="size-12px space-section__chevron"
                :class="{ 'space-section__chevron--collapsed': !expandedSections.lowPriority }"
                viewBox="0 0 12 12"
                fill="none"
                xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M3 4.5L6 7.5L9 4.5"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round" />
              </svg>
              <span class="space-section__title">{{ t('space.low_priority') }}</span>
              <span v-if="!narrow" class="space-section__count">{{ lowPrioritySpaces.length }}</span>
            </button>
            <div
              v-show="expandedSections.lowPriority"
              :id="getSectionPanelId('lowPriority')"
              class="space-section__items"
              role="group"
              :aria-labelledby="getSectionButtonId('lowPriority')">
              <SpaceCard
                v-for="space in lowPrioritySpaces"
                :key="space.spaceId"
                :space="space"
                :active="selectedSpaceId === space.spaceId || highlightedSpaceId === space.spaceId"
                :compact="compact || narrow"
                @click="emit('selectSpace', space.spaceId)"
                @pin="emit('pinSpace', $event)"
                @settings="emit('spaceSettings', $event)" />
            </div>
          </div>

          <div v-if="!loading && filteredSpaces.length === 0 && searchQuery" class="space-list-pane__empty">
            <span class="text-12px color-[--hula-text-tertiary]">{{ t('space.no_results') }}</span>
          </div>
        </div>
      </n-scrollbar>
    </n-spin>
  </nav>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import SpaceCard from './SpaceListItemCard.vue'

export type SpaceListItem = {
  spaceId: string
  name: string
  childCount: number
  avatarUrl?: string
  topic?: string
  memberCount?: number
  isPinned?: boolean
  isLowPriority?: boolean
  unreadCount?: number
  statusText?: string
  statusTone?: 'neutral' | 'info' | 'warning'
  visibilityText?: string
}

const props = defineProps<{
  spaces: SpaceListItem[]
  selectedSpaceId: string
  highlightedSpaceId?: string
  loading: boolean
  totalCount: number
  compact?: boolean
  narrow?: boolean
}>()

const emit = defineEmits<{
  selectSpace: [spaceId: string]
  pinSpace: [spaceId: string]
  spaceSettings: [spaceId: string]
}>()

const { t } = useI18n()
const searchQuery = ref('')
const expandedSections = reactive({
  pinned: true,
  joined: true,
  lowPriority: false
})

const toggleSection = (section: keyof typeof expandedSections) => {
  expandedSections[section] = !expandedSections[section]
}

const getSectionButtonId = (section: keyof typeof expandedSections) => `space-section-${section}-trigger`
const getSectionPanelId = (section: keyof typeof expandedSections) => `space-section-${section}-panel`

const filteredSpaces = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return props.spaces
  return props.spaces.filter(
    (s: SpaceListItem) => s.name.toLowerCase().includes(q) || s.spaceId.toLowerCase().includes(q)
  )
})

const pinnedSpaces = computed(() => filteredSpaces.value.filter((s: SpaceListItem) => s.isPinned))
const joinedSpaces = computed(() => filteredSpaces.value.filter((s: SpaceListItem) => !s.isPinned && !s.isLowPriority))
const lowPrioritySpaces = computed(() => filteredSpaces.value.filter((s: SpaceListItem) => s.isLowPriority))
</script>

<style scoped lang="scss">
.space-list-pane {
  width: 220px;
  min-width: 220px;
  height: 100%;
  background: var(--hula-surface-panel);
  display: flex;
  flex-direction: column;
}

.space-list-pane--compact {
  width: 188px;
  min-width: 188px;
}

.space-list-pane--narrow {
  width: 132px;
  min-width: 132px;
}

.space-list-pane__search {
  :deep(.n-input) {
    --n-height: 30px;
    --n-font-size: 12px;
    --n-border-radius: 8px;
    background: var(--hula-surface-search);
  }
}

.space-list-pane__body {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.space-item {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 10px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  padding: 10px 12px;
  text-align: left;
  color: var(--hula-text-primary);
  cursor: pointer;
  transition: background-color 0.2s ease;

  &:hover {
    background: var(--hula-surface-list-hover);
  }

  &--active {
    background: var(--hula-surface-session-active);
    box-shadow: var(--hula-surface-session-active-shadow);
    color: var(--hula-text-inverse);

    .space-item__meta {
      color: color-mix(in srgb, var(--hula-text-inverse) 72%, transparent);
    }
  }
}

.space-item__icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: var(--hula-surface-search);
  color: var(--hula-text-tertiary);

  &--global {
    background: var(--hula-color-primary-100);
    color: var(--hula-color-primary-500);
  }
}

.space-item__content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.space-item__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 500;
}

.space-item__meta {
  font-size: 11px;
  color: var(--hula-text-tertiary);
}

.space-section {
  margin-top: 8px;
}

.space-section__header {
  display: flex;
  align-items: center;
  width: 100%;
  gap: 4px;
  border: 0;
  background: transparent;
  padding: 6px 12px;
  cursor: pointer;
  user-select: none;
  border-radius: 6px;
  text-align: left;
  transition: background-color 0.15s ease;

  &:hover {
    background: var(--hula-surface-list-hover);
  }
}

.space-section__chevron {
  transition: transform 0.2s ease;

  &--collapsed {
    transform: rotate(-90deg);
  }
}

.space-section__title {
  flex: 1;
  font-size: 11px;
  font-weight: 600;
  color: var(--hula-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.space-section__count {
  font-size: 11px;
  color: var(--hula-text-quaternary);
}

.space-section__items {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-left: 4px;
}

.space-list-pane__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 12px;
}

.space-list-pane--compact .space-list-pane__header {
  padding: 10px;
}

.space-list-pane--compact .space-list-pane__body {
  gap: 4px;
  padding: 6px;
}

.space-list-pane--compact .space-item {
  padding: 9px 10px;
}

.space-list-pane--narrow .space-item {
  padding: 8px 10px;
}

.space-list-pane--rail .space-list-pane__header {
  padding: 8px;
}

.space-list-pane--rail .space-list-pane__search {
  :deep(.n-input__input-el) {
    display: none;
  }

  :deep(.n-input__placeholder) {
    display: none;
  }
}

.space-list-pane--rail .space-item__content,
.space-list-pane--rail .space-section__count {
  display: none;
}

.space-list-pane--rail .space-item,
.space-list-pane--rail .space-section__header {
  justify-content: center;
}

.space-list-pane--rail .space-item--rail {
  padding-inline: 8px;
}

.space-list-pane--rail .space-section__title {
  font-size: 10px;
  text-align: center;
}

.space-list-pane--rail .space-section__items {
  padding-left: 0;
}

.space-list-pane--narrow .space-item__name {
  font-size: 12px;
}

.space-list-pane--narrow .space-item__icon {
  width: 28px;
  height: 28px;
}
</style>
