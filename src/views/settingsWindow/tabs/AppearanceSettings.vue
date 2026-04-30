<template>
  <div class="appearance-settings">
    <div class="settings-section">
      <h3 class="section-title">{{ t('setting.appearance.theme_section') }}</h3>
      <div class="theme-options">
        <div
          v-for="theme in themeOptions"
          :key="theme.value"
          class="theme-option"
          :class="{ 'theme-option-active': currentTheme === theme.value }"
          @click="handleThemeChange(theme.value)">
          <div class="theme-preview" :class="theme.previewClass">
            <div class="preview-sidebar" />
            <div class="preview-content" />
          </div>
          <span class="theme-label">{{ theme.label }}</span>
        </div>
      </div>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">{{ t('setting.appearance.font_section') }}</h3>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.appearance.font_label') }}</span>
          <span class="setting-desc">{{ t('setting.appearance.font_desc') }}</span>
        </div>
        <n-select
          v-model:value="fontFamily"
          :options="fontOptions"
          style="width: 150px"
          @update:value="handleFontChange" />
      </div>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.appearance.font_size_label') }}</span>
          <span class="setting-desc">{{ t('setting.appearance.font_size_desc') }}</span>
        </div>
        <div class="font-size-control">
          <n-slider
            v-model:value="fontSize"
            :min="12"
            :max="20"
            :step="1"
            style="width: 120px"
            @update:value="handleFontSizeChange" />
          <span class="font-value">{{ fontSize }}px</span>
        </div>
      </div>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">{{ t('setting.appearance.effects_section') }}</h3>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.appearance.window_shadow_label') }}</span>
          <span class="setting-desc">{{ t('setting.appearance.window_shadow_desc') }}</span>
        </div>
        <n-switch v-model:value="windowShadow" @update:value="handleShadowChange" />
      </div>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.appearance.blur_label') }}</span>
          <span class="setting-desc">{{ t('setting.appearance.blur_desc') }}</span>
        </div>
        <n-switch v-model:value="blurEffect" @update:value="handleBlurChange" />
      </div>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">{{ t('setting.appearance.bubble_section') }}</h3>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.appearance.bubble_style_label') }}</span>
          <span class="setting-desc">{{ t('setting.appearance.bubble_style_desc') }}</span>
        </div>
        <n-switch v-model:value="bubbleStyle" @update:value="handleBubbleStyleChange">
          <template #checked>{{ t('setting.appearance.bubble_rounded') }}</template>
          <template #unchecked>{{ t('setting.appearance.bubble_square') }}</template>
        </n-switch>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { NDivider, NSelect, NSlider, NSwitch, useMessage } from 'naive-ui'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSettingStore } from '@/stores/domains/settings/setting'

defineOptions({
  name: 'AppearanceSettings'
})

const message = useMessage()
const { t } = useI18n()
const settingStore = useSettingStore()

const themeOptions = computed(() => [
  { value: 'light', label: t('setting.appearance.theme_light'), previewClass: 'preview-light' },
  { value: 'dark', label: t('setting.appearance.theme_dark'), previewClass: 'preview-dark' },
  { value: 'os', label: t('setting.appearance.theme_auto'), previewClass: 'preview-auto' }
])

const fontOptions = computed(() => [
  { label: t('setting.appearance.font_default'), value: 'PingFang' },
  { label: t('setting.appearance.font_microsoft_yahei'), value: 'Microsoft YaHei' },
  { label: t('setting.appearance.font_pingfang_sc'), value: 'PingFang SC' },
  { label: t('setting.appearance.font_source_han_sans'), value: 'Source Han Sans' }
])

const currentTheme = computed(() => {
  return settingStore.themePattern === 'os' ? 'os' : settingStore.themeContent
})

const fontFamily = ref(settingStore.pageFontFamily)
const fontSize = ref(14)
const windowShadow = ref(settingStore.pageShadowEnabled)
const blurEffect = ref(settingStore.pageBlurEnabled)
const bubbleStyle = ref(true)

onMounted(() => {
  const savedFontSize = localStorage.getItem('hula-font-size')
  if (savedFontSize) {
    fontSize.value = parseInt(savedFontSize, 10)
    applyFontSize(fontSize.value)
  }

  const savedBubbleStyle = localStorage.getItem('hula-bubble-style')
  if (savedBubbleStyle !== null) {
    bubbleStyle.value = savedBubbleStyle === 'true'
  }
})

function handleThemeChange(theme: string) {
  settingStore.toggleTheme(theme)
  message.success(t('setting.appearance.feedback.theme_changed'))
}

function handleFontChange(value: string) {
  settingStore.setPageFont(value)
  document.documentElement.style.setProperty('--font-family', value)
  message.success(t('setting.appearance.feedback.font_changed'))
}

function handleFontSizeChange(value: number) {
  applyFontSize(value)
  localStorage.setItem('hula-font-size', value.toString())
  message.success(t('setting.appearance.feedback.font_size_changed', { size: String(value) }))
}

function applyFontSize(size: number) {
  document.documentElement.style.setProperty('--font-size-base', `${size}px`)
}

function handleShadowChange(value: boolean) {
  settingStore.setPageShadowEnabled(value)
  message.success(
    value
      ? t('setting.appearance.feedback.window_shadow_enabled')
      : t('setting.appearance.feedback.window_shadow_disabled')
  )
}

function handleBlurChange(value: boolean) {
  settingStore.setPageBlurEnabled(value)
  message.success(
    value ? t('setting.appearance.feedback.blur_enabled') : t('setting.appearance.feedback.blur_disabled')
  )
}

function handleBubbleStyleChange(value: boolean) {
  localStorage.setItem('hula-bubble-style', value.toString())
  message.success(
    value ? t('setting.appearance.feedback.bubble_rounded') : t('setting.appearance.feedback.bubble_square')
  )
}
</script>

<style scoped>
.appearance-settings {
  padding: 0 var(--hula-space-2);
}

.settings-section {
  margin-bottom: var(--hula-space-4);
}

.section-title {
  font-size: var(--hula-font-size-lg);
  font-weight: var(--hula-font-weight-medium);
  margin-bottom: var(--hula-space-4);
  color: var(--hula-text-primary);
}

.theme-options {
  display: flex;
  gap: var(--hula-space-4);
}

.theme-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  padding: var(--hula-space-2);
  border-radius: var(--hula-radius-sm);
  border: 2px solid transparent;
  transition: border-color var(--hula-motion-duration-normal) var(--hula-motion-ease-standard);
}

.theme-option:hover {
  border-color: color-mix(in srgb, var(--hula-color-info-500) 30%, transparent);
}

.theme-option-active {
  border-color: var(--hula-color-info-500);
}

.theme-preview {
  width: 80px;
  height: 60px;
  border-radius: var(--hula-radius-sm);
  display: flex;
  overflow: hidden;
  margin-bottom: var(--hula-space-2);
}

.preview-light {
  background-color: var(--hula-settings-preview-light-shell);
}

.preview-light .preview-sidebar {
  background-color: var(--hula-settings-preview-light-sidebar);
}

.preview-light .preview-content {
  background-color: var(--hula-settings-preview-light-content);
}

.preview-dark {
  background-color: var(--hula-settings-preview-dark-shell);
}

.preview-dark .preview-sidebar {
  background-color: var(--hula-settings-preview-dark-sidebar);
}

.preview-dark .preview-content {
  background-color: var(--hula-settings-preview-dark-content);
}

.preview-auto {
  background: linear-gradient(
    135deg,
    var(--hula-settings-preview-light-shell) 50%,
    var(--hula-settings-preview-dark-shell) 50%
  );
}

.preview-sidebar {
  width: 20px;
  height: 100%;
}

.preview-content {
  flex: 1;
  margin: var(--hula-space-1);
  border-radius: var(--hula-radius-xs);
}

.theme-label {
  font-size: var(--hula-font-size-sm);
  color: var(--hula-text-secondary);
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--hula-space-3) 0;
  border-bottom: 1px solid var(--hula-settings-divider);
}

.setting-info {
  display: flex;
  flex-direction: column;
}

.setting-label {
  font-size: var(--hula-font-size-base);
  color: var(--hula-text-primary);
}

.setting-desc {
  font-size: var(--hula-font-size-sm);
  color: var(--hula-text-quaternary);
  margin-top: var(--hula-space-1);
}

.font-size-control {
  display: flex;
  align-items: center;
  gap: var(--hula-space-3);
}

.font-value {
  font-size: var(--hula-font-size-sm);
  color: var(--hula-text-secondary);
  min-width: 36px;
}
</style>
