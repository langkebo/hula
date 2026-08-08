<template>
  <div data-test="appearance-preview" class="appearance-preview">
    <div class="appearance-preview__header">
      <svg
        class="appearance-preview__header-icon"
        viewBox="0 0 24 24"
        width="16"
        height="16"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true">
        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
      <span class="appearance-preview__title">{{ t('setting.appearance.preview.title') }}</span>
      <span data-test="preview-current-theme" class="appearance-preview__current">
        {{ t('setting.appearance.preview.current_theme') }}：{{ themeLabel }}
      </span>
    </div>

    <div data-test="preview-card" class="appearance-preview__card">
      <div class="appearance-preview__card-sidebar">
        <span class="appearance-preview__nav-item" />
        <span class="appearance-preview__nav-item" />
        <span class="appearance-preview__nav-item appearance-preview__nav-item--active" />
        <span class="appearance-preview__nav-item" />
      </div>

      <div class="appearance-preview__card-content">
        <p class="appearance-preview__sample-text">{{ t('setting.appearance.preview.sample_text') }}</p>

        <div class="appearance-preview__controls">
          <button data-test="preview-button" type="button" class="appearance-preview__button" tabindex="-1">
            {{ t('setting.appearance.preview.button') }}
          </button>
          <input
            data-test="preview-input"
            type="text"
            class="appearance-preview__input"
            :placeholder="t('setting.appearance.preview.input_placeholder')"
            tabindex="-1" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ThemeEnum } from '@/enums'

defineOptions({
  name: 'AppearancePreview'
})

const { t } = useI18n()

// 监听 document.documentElement 的 data-theme 属性变化，实时反映当前主题
const activeTheme = ref<string>(readDocumentTheme())

let observer: MutationObserver | null = null

function readDocumentTheme(): string {
  if (typeof document === 'undefined') return ThemeEnum.LIGHT
  return document.documentElement.dataset.theme || ThemeEnum.LIGHT
}

function handleThemeMutation(mutations: MutationRecord[]) {
  for (const mutation of mutations) {
    if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
      activeTheme.value = readDocumentTheme()
      return
    }
  }
}

onMounted(() => {
  if (typeof MutationObserver === 'undefined') return
  activeTheme.value = readDocumentTheme()
  observer = new MutationObserver(handleThemeMutation)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
})

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
})

const themeLabel = computed(() => {
  if (activeTheme.value === ThemeEnum.DARK) return t('setting.appearance.theme_dark')
  return t('setting.appearance.theme_light')
})
</script>

<style scoped>
.appearance-preview {
  display: flex;
  flex-direction: column;
  gap: var(--tjg-space-3);
}

.appearance-preview__header {
  display: flex;
  align-items: center;
  gap: var(--tjg-space-2);
}

.appearance-preview__header-icon {
  color: var(--tjg-text-tertiary);
  flex-shrink: 0;
}

.appearance-preview__title {
  font-size: var(--tjg-font-size-sm);
  font-weight: var(--tjg-font-weight-medium);
  color: var(--tjg-text-secondary);
}

.appearance-preview__current {
  margin-left: auto;
  font-size: var(--tjg-font-size-xs);
  color: var(--tjg-text-tertiary);
}

.appearance-preview__card {
  display: flex;
  border-radius: var(--tjg-radius-lg);
  overflow: hidden;
  border: 1px solid var(--tjg-border-default);
  background-color: var(--tjg-surface-app);
  transition:
    background-color var(--tjg-motion-duration-slow) var(--tjg-motion-ease-standard),
    border-color var(--tjg-motion-duration-slow) var(--tjg-motion-ease-standard);
}

.appearance-preview__card-sidebar {
  display: flex;
  flex-direction: column;
  gap: var(--tjg-space-2);
  padding: var(--tjg-space-3);
  width: 56px;
  background-color: var(--tjg-surface-sidebar);
}

.appearance-preview__nav-item {
  height: 8px;
  border-radius: var(--tjg-radius-xs);
  background-color: var(--tjg-surface-sidebar-hover);
}

.appearance-preview__nav-item--active {
  background-color: var(--tjg-color-primary-200);
}

.appearance-preview__card-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--tjg-space-3);
  padding: var(--tjg-space-4);
  background-color: var(--tjg-surface-panel);
}

.appearance-preview__sample-text {
  margin: 0;
  font-size: var(--tjg-font-size-sm);
  line-height: var(--tjg-line-height-normal);
  color: var(--tjg-text-primary);
}

.appearance-preview__controls {
  display: flex;
  gap: var(--tjg-space-2);
  align-items: center;
}

.appearance-preview__button {
  padding: var(--tjg-space-1) var(--tjg-space-3);
  border: none;
  border-radius: var(--tjg-radius-sm);
  background-color: var(--tjg-color-primary-500);
  color: var(--tjg-text-inverse);
  font-size: var(--tjg-font-size-sm);
  cursor: default;
}

.appearance-preview__input {
  flex: 1;
  padding: var(--tjg-space-1) var(--tjg-space-2);
  border: 1px solid var(--tjg-border-default);
  border-radius: var(--tjg-radius-sm);
  background-color: var(--tjg-surface-input);
  color: var(--tjg-text-primary);
  font-size: var(--tjg-font-size-sm);
}

.appearance-preview__input::placeholder {
  color: var(--tjg-text-quaternary);
}

@media (prefers-reduced-motion: reduce) {
  .appearance-preview__card {
    transition: none;
  }
}
</style>
