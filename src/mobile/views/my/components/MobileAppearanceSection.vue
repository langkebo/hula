<template>
  <van-cell-group inset>
    <van-cell :title="t('mobile_setting.theme')">
      <template #icon>
        <SettingCellIcon icon="mdi:palette" color="var(--tjg-color-beta-500)" shell="beta" />
      </template>
      <template #right-icon>
        <van-radio-group v-model="themeValue" direction="horizontal">
          <van-radio name="light">{{ t('mobile_setting.themes.light') }}</van-radio>
          <van-radio name="dark">{{ t('mobile_setting.themes.dark') }}</van-radio>
        </van-radio-group>
      </template>
    </van-cell>

    <van-cell :title="t('mobile_setting.language')">
      <template #icon>
        <SettingCellIcon icon="mdi:translate" color="var(--tjg-color-info-500)" shell="info" />
      </template>
      <template #right-icon>
        <van-radio-group v-model="languageValue" direction="horizontal">
          <van-radio name="zh-CN">{{ t('setting.preferences.language_zh_cn') }}</van-radio>
          <van-radio name="en">{{ t('setting.preferences.language_en') }}</van-radio>
        </van-radio-group>
      </template>
    </van-cell>

    <van-cell :title="t('setting.appearance.bubble_style_label')" :label="t('setting.appearance.bubble_style_desc')">
      <template #icon>
        <SettingCellIcon icon="mdi:message-text-outline" color="var(--tjg-color-beta-500)" shell="beta" />
      </template>
      <template #right-icon>
        <van-radio-group v-model="bubbleStyleValue" direction="horizontal" @change="handleBubbleStyleChange">
          <van-radio name="rounded">{{ t('setting.appearance.bubble_rounded') }}</van-radio>
          <van-radio name="square">{{ t('setting.appearance.bubble_square') }}</van-radio>
        </van-radio-group>
      </template>
    </van-cell>

    <van-cell :title="t('mobile_setting.font_size')" center>
      <template #right-icon>
        <van-radio-group v-model="fontScaleValue" direction="horizontal" @change="handleFontScaleChange">
          <van-radio v-for="step in FONT_SCALE_STEPS" :key="step" :name="String(step)" icon-size="16px">
            {{ t(FONT_SCALE_LABEL_KEYS[step]) }}
          </van-radio>
        </van-radio-group>
      </template>
    </van-cell>
  </van-cell-group>
</template>

<script setup lang="ts">
import { showToast } from 'vant'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import SettingCellIcon from '@/mobile/components/my/SettingCellIcon.vue'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { applyBubbleStyle, loadBubbleStyle, saveBubbleStyle } from '@/utils/bubbleStyle'
// biome-ignore lint/style/useImportType: FONT_SCALE_STEPS 在模板中作为值使用
import { applyFontScale, FONT_SCALE_STEPS, loadFontScale, saveFontScale } from '@/utils/fontScale'

/**
 * 设置页「外观」组：主题 / 语言 / 气泡样式 / 字号。
 *
 * 抽成组件的原因：这四项都是**即时生效的内联控件**（没有独立页面），
 * 与设置页其余「点一行跳一页」的条目性质不同；`MobileSettings.vue` 抽走后
 * 才有空间继续加条目（该文件已接近 400 行硬限）。
 *
 * 与桌面共用同一批工具：`fontScale` 控制根字号、`bubbleStyle` 写
 * `data-bubble-style`（由 `render-message.scss` 消费），所以两端效果一致。
 */
const { t } = useI18n()
const settingStore = useSettingStore()

const themeValue = computed({
  get: () => settingStore.themeContent,
  set: (val) => settingStore.toggleTheme(val)
})

const languageValue = computed({
  get: () => settingStore.languagePreference,
  set: (v) => settingStore.setLanguage(v)
})

const FONT_SCALE_LABEL_KEYS: Record<(typeof FONT_SCALE_STEPS)[number], string> = {
  0.875: 'mobile_setting.font_sizes.small',
  1: 'mobile_setting.font_sizes.normal',
  1.125: 'mobile_setting.font_sizes.large',
  1.25: 'mobile_setting.font_sizes.xlarge'
}

const fontScaleValue = ref(String(loadFontScale()))

const handleFontScaleChange = (value: string | number) => {
  const scale = Number(value)
  applyFontScale(scale)
  saveFontScale(scale)
  showToast(t('mobile_setting.font_size_changed'))
}

const bubbleStyleValue = ref(loadBubbleStyle())

const handleBubbleStyleChange = (value: string | number) => {
  const style = String(value)
  applyBubbleStyle(style)
  saveBubbleStyle(style)
  showToast(
    t(style === 'square' ? 'setting.appearance.feedback.bubble_square' : 'setting.appearance.feedback.bubble_rounded')
  )
}
</script>

<style scoped lang="scss">
/* 单选的可点区域必须够 44px：vant 默认 40px，差 4px 就会在实机上点不中 */
:deep(.van-radio) {
  min-height: 44px;
  display: flex;
  align-items: center;
}
</style>
