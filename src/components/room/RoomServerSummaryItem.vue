<template>
  <li class="rss-item rss-item--block">
    <button
      type="button"
      class="rss-toggle"
      :aria-expanded="expanded"
      :aria-label="t(expanded ? 'room.server_summary.collapse' : 'room.server_summary.expand')"
      @click="emit('toggle')">
      <span class="rss-item-main">
        <span class="rss-name">{{ name }}</span>
        <span v-if="meta !== undefined" class="rss-meta">{{ meta || '-' }}</span>
      </span>
      <svg
        class="rss-chevron"
        :class="{ 'is-open': expanded }"
        viewBox="0 0 24 24"
        width="14"
        height="14"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true">
        <path d="m6 9 6 6 6-6" />
      </svg>
    </button>
    <pre v-if="expanded" class="rss-json">{{ formatJson(payload) }}</pre>
  </li>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineProps<{
  name: string
  meta?: string
  payload: unknown
  expanded: boolean
}>()

const emit = defineEmits<{ toggle: [] }>()

const { t } = useI18n()

const formatJson = (value: unknown): string => {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}
</script>

<style scoped lang="scss">
.rss-item--block {
  flex-direction: column;
  align-items: stretch;
}

.rss-item-main {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.rss-name {
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rss-meta {
  font-size: var(--tjg-font-size-2xs);
  color: var(--tjg-text-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rss-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--tjg-space-2);
  width: 100%;
  border: none;
  background: transparent;
  padding: 0;
  cursor: pointer;
  text-align: left;
  color: inherit;
}

.rss-chevron {
  flex-shrink: 0;
  color: var(--tjg-text-tertiary);
  transition: transform 0.15s ease;

  &.is-open {
    transform: rotate(180deg);
  }
}

.rss-json {
  margin: var(--tjg-space-1) 0 0;
  padding: var(--tjg-space-2);
  border-radius: var(--tjg-radius-xs);
  border: 1px solid var(--tjg-border-muted);
  background-color: var(--tjg-surface-subtle);
  font-size: var(--tjg-font-size-2xs);
  color: var(--tjg-text-secondary);
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 200px;
  overflow: auto;
}

@media (prefers-reduced-motion: reduce) {
  .rss-chevron {
    transition: none;
  }
}
</style>
