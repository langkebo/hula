<template>
  <AutoFixHeightPage :show-footer="false">
    <template #header>
      <HeaderBar border :isOfficial="false" :hidden-right="true" :room-name="t('mobile_setting.title')" />
    </template>

    <template #container>
      <div class="flex flex-col overflow-auto h-full">
        <!-- 设置搜索：16 个一级项 + 20 个二级页，没有搜索只能靠滚动记忆找 -->
        <div class="settings-search sticky top-0 z-2">
          <van-search
            v-model="searchQuery"
            :placeholder="t('setting.dialog.search_placeholder')"
            :aria-label="t('setting.dialog.search_aria_label')"
            shape="round"
            clearable
            @clear="searchQuery = ''" />
        </div>

        <MobileSettingsSearch v-show="hasQuery" :query="searchQuery" @navigate="handleSearchNavigate" />

        <div v-show="!hasQuery" class="flex flex-col p-16px gap-12px">
          <div
            id="settings-group-account"
            class="text-[length:var(--tjg-font-size-base)] text-[--tjg-text-secondary] mb-8px">
            {{ t('mobile_setting.account_section') }}
          </div>

          <van-cell-group inset>
            <van-cell :title="t('mobile_devices.title')" is-link @click="router.push(MOBILE_SETTINGS_DEVICES_PATH)">
              <template #icon>
                <SettingCellIcon icon="mdi:devices" color="var(--tjg-color-danger-500)" shell="danger" />
              </template>
            </van-cell>

            <van-cell :title="t('mobile_setting.status')" is-link @click="router.push('/mobile/mobileMy/status')">
              <template #icon>
                <SettingCellIcon :icon="statusIcon" :color="statusColor" shell="success" />
              </template>
              <template #value>
                <span class="text-[length:var(--tjg-font-size-base)]">{{ statusLabel }}</span>
              </template>
            </van-cell>

            <van-cell
              :title="t('mobile_setting.edit_profile')"
              is-link
              @click="router.push('/mobile/mobileMy/editProfile')">
              <template #icon>
                <SettingCellIcon icon="mdi:account-edit" color="var(--tjg-color-info-500)" shell="info" />
              </template>
            </van-cell>

            <van-cell
              :title="t('mobile_setting.change_password')"
              is-link
              @click="router.push(MOBILE_SETTINGS_PASSWORD_PATH)">
              <template #icon>
                <SettingCellIcon icon="mdi:lock-reset" color="var(--tjg-color-warning-500)" shell="warning" />
              </template>
            </van-cell>

            <van-cell
              :title="t('mobile_setting.security')"
              is-link
              @click="router.push(MOBILE_SETTINGS_SECURITY_PRIVACY_PATH)">
              <template #icon>
                <SettingCellIcon icon="mdi:shield-lock" color="var(--tjg-color-danger-500)" shell="danger" />
              </template>
            </van-cell>
          </van-cell-group>

          <div
            id="settings-group-social"
            class="text-[length:var(--tjg-font-size-base)] text-[--tjg-text-secondary] mt-16px mb-8px">
            {{ t('mobile_setting.social_section') }}
          </div>

          <van-cell-group inset>
            <van-cell
              :title="t('mobile_setting.friend_groups')"
              is-link
              @click="router.push('/mobile/mobileFriends/groups')">
              <template #icon>
                <SettingCellIcon icon="mdi:account-group" color="var(--tjg-color-info-500)" shell="info" />
              </template>
            </van-cell>
          </van-cell-group>

          <div
            id="settings-group-notification"
            class="text-[length:var(--tjg-font-size-base)] text-[--tjg-text-secondary] mt-16px mb-8px">
            {{ t('mobile_setting.notification_section') }}
          </div>

          <van-cell-group inset>
            <van-cell
              :title="t('mobile_setting.notifications')"
              is-link
              @click="router.push('/mobile/mobileMy/notifications')">
              <template #icon>
                <SettingCellIcon icon="mdi:bell" color="var(--tjg-color-warning-500)" shell="warning" />
              </template>
            </van-cell>
          </van-cell-group>

          <div
            id="settings-group-appearance"
            class="text-[length:var(--tjg-font-size-base)] text-[--tjg-text-secondary] mt-16px mb-8px">
            {{ t('mobile_setting.appearance_section') }}
          </div>

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

          <div
            id="settings-group-privacy"
            class="text-[length:var(--tjg-font-size-base)] text-[--tjg-text-secondary] mt-16px mb-8px">
            {{ t('mobile_setting.privacy_section') }}
          </div>

          <van-cell-group inset>
            <van-cell
              :title="t('mobile_setting.preferences')"
              is-link
              @click="router.push('/mobile/mobileMy/preferences')">
              <template #icon>
                <SettingCellIcon icon="mdi:tune" color="var(--tjg-color-info-500)" shell="info" />
              </template>
            </van-cell>

            <van-cell
              :title="t('mobile_setting.burn_after_read')"
              is-link
              @click="router.push('/mobile/mobileMy/burnAfterRead')">
              <template #icon>
                <SettingCellIcon icon="mdi:timer-outline" color="var(--tjg-color-warning-500)" shell="warning" />
              </template>
            </van-cell>
          </van-cell-group>

          <div
            id="settings-group-help"
            class="text-[length:var(--tjg-font-size-base)] text-[--tjg-text-secondary] mt-16px mb-8px">
            {{ t('mobile_setting.help_section') }}
          </div>

          <van-cell-group inset>
            <van-cell
              :title="t('mobile_setting.help_feedback')"
              is-link
              @click="router.push(MOBILE_SETTINGS_HELP_ABOUT_PATH)">
              <template #icon>
                <SettingCellIcon icon="mdi:help-circle" color="var(--tjg-color-info-500)" shell="info" />
              </template>
            </van-cell>
          </van-cell-group>

          <div
            id="settings-group-advanced"
            class="text-[length:var(--tjg-font-size-base)] text-[--tjg-text-secondary] mt-16px mb-8px">
            {{ t('mobile_setting.advanced_section') }}
          </div>

          <van-cell-group inset>
            <van-cell
              v-for="item in advancedSettingsItems"
              :key="item.path"
              :title="t(item.titleKey)"
              is-link
              @click="router.push(item.path)">
              <template #icon>
                <SettingCellIcon :icon="item.icon" :color="item.iconColor" :background="item.iconBackgroundColor" />
              </template>
            </van-cell>
          </van-cell-group>

          <div class="mt-16px">
            <van-button type="danger" block @click="handleLogout" :disabled="isLoggingOut" :loading="isLoggingOut">
              {{ t('mobile_setting.button.logout') }}
            </van-button>
          </div>

          <div class="text-center text-[length:var(--tjg-font-size-sm)] text-[--tjg-text-quaternary] mt-16px">
            {{ t('mobile_setting.version') }}: v{{ APP_VERSION }}
          </div>
        </div>
      </div>
    </template>
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import { showToast } from 'vant'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useMobileLogout } from '@/composables/user/useMobileLogout'
import SettingCellIcon from '@/mobile/components/my/SettingCellIcon.vue'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { useUserStatusStore } from '@/stores/domains/user/userStatus'
import { APP_VERSION } from '@/utils/appVersion'
// biome-ignore lint/style/useImportType: FONT_SCALE_STEPS 在模板中作为值使用，同时用于类型推导
import { applyFontScale, FONT_SCALE_STEPS, loadFontScale, saveFontScale } from '@/utils/fontScale'
import MobileSettingsSearch from './components/MobileSettingsSearch.vue'
import { MOBILE_ADVANCED_SETTINGS_ITEMS } from './mobileSettingsConfig'
import type { MobileSettingsSearchEntry } from './mobileSettingsSearchIndex'
import {
  MOBILE_SETTINGS_DEVICES_PATH,
  MOBILE_SETTINGS_HELP_ABOUT_PATH,
  MOBILE_SETTINGS_PASSWORD_PATH,
  MOBILE_SETTINGS_SECURITY_PRIVACY_PATH
} from './settingsRoutes'

const { t } = useI18n()
const router = useRouter()
const settingStore = useSettingStore()
const userStatusStore = useUserStatusStore()
const advancedSettingsItems = MOBILE_ADVANCED_SETTINGS_ITEMS

// ── 设置搜索 ────────────────────────────────────────────────
const searchQuery = ref('')
const hasQuery = computed(() => searchQuery.value.trim().length > 0)

/**
 * 搜索结果点击：
 * - 有独立页面 → 直接跳转；
 * - 内联控件（主题 / 语言 / 字号）→ 先清空搜索再滚到对应分组，
 *   否则「点了没反应」比搜不到更让人困惑。
 */
async function handleSearchNavigate(entry: MobileSettingsSearchEntry) {
  if (entry.path) {
    await router.push(entry.path)
    return
  }
  searchQuery.value = ''
  await nextTick()
  if (entry.anchor) {
    document.getElementById(entry.anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

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

const currentStatusId = computed(() => userStatusStore.stateId || 'online')

const statusOptions = [
  {
    id: 'online',
    label: t('mobile_setting.status_online'),
    icon: 'mdi:circle',
    color: 'var(--tjg-color-success-500)'
  },
  {
    id: 'away',
    label: t('mobile_setting.status_away'),
    icon: 'mdi:circle',
    color: 'var(--tjg-color-warning-500)'
  },
  {
    id: 'busy',
    label: t('mobile_setting.status_busy'),
    icon: 'mdi:circle',
    color: 'var(--tjg-color-danger-500)'
  },
  {
    id: 'offline',
    label: t('mobile_setting.status_offline'),
    icon: 'mdi:circle-outline',
    color: 'var(--tjg-text-quaternary)'
  }
]

const currentStatus = computed(() => {
  return statusOptions.find((s) => s.id === currentStatusId.value) || statusOptions[0]
})

const statusLabel = computed(() => currentStatus.value.label)
const statusIcon = computed(() => currentStatus.value.icon)
const statusColor = computed(() => currentStatus.value.color)

// 登出只有一个实现（见 useMobileLogout）：走 SessionOrchestrator 的显式清理
const { isLoggingOut, handleLogout } = useMobileLogout()
</script>

<style scoped lang="scss">
/* 搜索框吸顶：设置页可滚动很长，滚动中仍要能改关键词 */
.settings-search {
  background: var(--tjg-surface-panel);
  border-bottom: 1px solid var(--tjg-border-layout-divider);
}

:deep(.van-cell-group--inset) {
  margin: 0 12px;
  border-radius: 12px;
  overflow: hidden;
}

:deep(.van-cell) {
  background: var(--tjg-surface-panel);
}

:deep(.van-cell::after) {
  border-bottom: 1px solid var(--tjg-border-layout-divider);
}

:deep(.van-cell:last-child::after) {
  border-bottom: none;
}
</style>
