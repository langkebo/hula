<template>
  <div class="appearance-settings">
    <div class="settings-section">
      <h3 class="section-title">{{ t('setting.appearance.theme_section') }}</h3>
      <ThemeSwitcher :model-value="currentTheme" />
      <AppearancePreview class="appearance-settings__preview" />
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
          class="font-family-select"
          @update:value="handleFontChange" />
      </div>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.appearance.font_size_label') }}</span>
          <span class="setting-desc">{{ t('setting.appearance.font_size_desc') }}</span>
        </div>
        <n-select
          v-model:value="fontScale"
          :options="fontScaleOptions"
          class="font-scale-select"
          @update:value="handleFontScaleChange" />
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
import { NDivider, NSelect, NSwitch } from 'naive-ui'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AppearancePreview from '@/components/settings/AppearancePreview.vue'
import ThemeSwitcher from '@/components/settings/ThemeSwitcher.vue'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { applyBubbleStyle, loadBubbleStyle, saveBubbleStyle } from '@/utils/bubbleStyle'
import { applyFontScale, FONT_SCALE_STEPS, loadFontScale, normalizeFontScale, saveFontScale } from '@/utils/fontScale'

defineOptions({
  name: 'AppearanceSettings'
})

const { showFeedback } = useActionFeedback()
const { t } = useI18n()
const settingStore = useSettingStore()

const fontOptions = computed(() => [
  { label: t('setting.appearance.font_default'), value: 'PingFang' },
  { label: t('setting.appearance.font_microsoft_yahei'), value: 'Microsoft YaHei' },
  { label: t('setting.appearance.font_pingfang_sc'), value: 'PingFang SC' },
  { label: t('setting.appearance.font_source_han_sans'), value: 'Source Han Sans' }
])

/** 档位与标签一一对应：选项、回显文案都从这一份来源派生 */
const FONT_SCALE_STEP_LABELS = [
  { scale: FONT_SCALE_STEPS[0], labelKey: 'setting.appearance.font_size_small' },
  { scale: FONT_SCALE_STEPS[1], labelKey: 'setting.appearance.font_size_standard' },
  { scale: FONT_SCALE_STEPS[2], labelKey: 'setting.appearance.font_size_large' },
  { scale: FONT_SCALE_STEPS[3], labelKey: 'setting.appearance.font_size_extra_large' }
] as const

const fontScaleOptions = computed(() =>
  FONT_SCALE_STEP_LABELS.map(({ scale, labelKey }) => ({ label: t(labelKey), value: scale }))
)

/** 只允许落在这四档上：落档失败说明存储或调用方坏了，钳到基准而不是显示非法值 */
function resolveStepLabel(scale: number): string {
  const step = FONT_SCALE_STEP_LABELS.find((item) => item.scale === scale) ?? FONT_SCALE_STEP_LABELS[1]
  return t(step.labelKey)
}

const currentTheme = computed(() => {
  return settingStore.themePattern === 'os' ? 'os' : settingStore.themeContent
})

const fontFamily = ref(settingStore.pageFontFamily)
const fontScale = ref(loadFontScale())
const windowShadow = ref(settingStore.pageShadowEnabled)
const blurEffect = ref(settingStore.pageBlurEnabled)
/** 开关 checked = 圆角，与既有文案一致；存储层用 rounded / square 两个值 */
const bubbleStyle = ref(loadBubbleStyle() === 'rounded')

function handleFontChange(value: string) {
  settingStore.setPageFont(value)
  document.documentElement.style.setProperty('--font-family', value)
  showFeedback(t('setting.appearance.feedback.font_changed'), 'success')
}

function handleFontScaleChange(value: number) {
  const scale = normalizeFontScale(value)
  fontScale.value = scale
  applyFontScale(scale)
  saveFontScale(scale)
  showFeedback(t('setting.appearance.feedback.font_size_changed', { size: resolveStepLabel(scale) }), 'success')
}

function handleShadowChange(value: boolean) {
  settingStore.setPageShadowEnabled(value)
  showFeedback(
    value
      ? t('setting.appearance.feedback.window_shadow_enabled')
      : t('setting.appearance.feedback.window_shadow_disabled'),
    'success'
  )
}

function handleBlurChange(value: boolean) {
  settingStore.setPageBlurEnabled(value)
  showFeedback(
    value ? t('setting.appearance.feedback.blur_enabled') : t('setting.appearance.feedback.blur_disabled'),
    'success'
  )
}

function handleBubbleStyleChange(value: boolean) {
  const style = value ? 'rounded' : 'square'
  applyBubbleStyle(style)
  saveBubbleStyle(style)
  showFeedback(
    value ? t('setting.appearance.feedback.bubble_rounded') : t('setting.appearance.feedback.bubble_square'),
    'success'
  )
}
</script>

<style scoped>
.appearance-settings {
  padding: 0 var(--tjg-space-2);
}

.appearance-settings__preview {
  margin-top: var(--tjg-space-4);
}

.settings-section {
  margin-bottom: var(--tjg-space-4);
}

.section-title {
  font-size: var(--tjg-font-size-lg);
  font-weight: var(--tjg-font-weight-medium);
  margin-bottom: var(--tjg-space-4);
  color: var(--tjg-text-primary);
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--tjg-space-3) 0;
  border-bottom: 1px solid var(--tjg-settings-divider);
}

.setting-info {
  display: flex;
  flex-direction: column;
}

.setting-label {
  font-size: var(--tjg-font-size-base);
  color: var(--tjg-text-primary);
}

.setting-desc {
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-quaternary);
  margin-top: var(--tjg-space-1);
}

.font-family-select,
.font-scale-select {
  width: 150px;
}
</style>
