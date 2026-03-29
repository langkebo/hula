<template>
  <n-flex vertical :size="40">
    <n-flex vertical class="text-(14px [--text-color])" :size="16">
      <span class="pl-10px">{{ t('setting.appearance.theme') }}</span>

      <n-flex class="item p-12px" :size="12" vertical>
        <n-flex align="center" justify="space-between">
          <n-radio-group v-model:value="themeMode" @update:value="handleThemeChange">
            <n-flex :size="16">
              <n-radio value="auto">
                <n-flex vertical :size="4">
                  <span>{{ t('setting.appearance.theme_auto') }}</span>
                </n-flex>
              </n-radio>
              <n-radio value="light">
                <n-flex vertical :size="4">
                  <span>{{ t('setting.appearance.theme_light') }}</span>
                </n-flex>
              </n-radio>
              <n-radio value="dark">
                <n-flex vertical :size="4">
                  <span>{{ t('setting.appearance.theme_dark') }}</span>
                </n-flex>
              </n-radio>
            </n-flex>
          </n-radio-group>
        </n-flex>
      </n-flex>
    </n-flex>

    <n-flex vertical class="text-(14px [--text-color])" :size="16">
      <span class="pl-10px">{{ t('setting.appearance.wallpaper') }}</span>

      <n-flex class="item p-12px" :size="12" vertical>
        <n-flex align="center" justify="space-between">
          <n-flex vertical :size="4">
            <span>{{ t('setting.appearance.wallpaper_hint') }}</span>
          </n-flex>
          <n-flex :size="12">
            <n-button size="small" secondary @click="handleSelectWallpaper">
              {{ t('setting.appearance.select_wallpaper') }}
            </n-button>
            <n-button size="small" secondary @click="handleResetWallpaper" :disabled="!hasWallpaper">
              {{ t('setting.appearance.reset_wallpaper') }}
            </n-button>
          </n-flex>
        </n-flex>

        <span v-if="hasWallpaper" class="w-full h-1px bg-[--line-color] my-12px block"></span>

        <n-flex v-if="hasWallpaper" align="center" justify="center" class="wallpaper-preview">
          <img :src="wallpaperUrl" alt="Wallpaper" class="max-w-full max-h-200px rounded-8px" />
        </n-flex>
      </n-flex>
    </n-flex>
  </n-flex>
</template>

<script setup lang="ts">
import { NButton, NRadio, NRadioGroup, NFlex, useMessage } from 'naive-ui'
import { useSettingStore } from '@/stores/setting'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const message = useMessage()
const settingStore = useSettingStore()

const themeMode = ref('auto')
const hasWallpaper = ref(false)
const wallpaperUrl = ref('')

const handleThemeChange = (value: string) => {
  settingStore.toggleTheme(value)
  message.success(t('setting.common.save_success'))
}

const handleSelectWallpaper = async () => {
  message.info(t('setting.appearance.select_wallpaper'))
}

const handleResetWallpaper = () => {
  hasWallpaper.value = false
  wallpaperUrl.value = ''
  message.success(t('setting.appearance.reset_wallpaper'))
}
</script>

<style scoped lang="scss">
.item {
  @apply bg-[--bg-setting-item] rounded-12px size-full p-12px box-border border-(solid 1px [--line-color]) custom-shadow;
}

.wallpaper-preview {
  margin-top: 12px;
  padding: 12px;
  background: rgba(0, 0, 0, 0.02);
  border-radius: 8px;

  :deep(.dark) & {
    background: rgba(255, 255, 255, 0.03);
  }
}
</style>
