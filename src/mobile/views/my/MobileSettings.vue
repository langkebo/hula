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

          <MobileAppearanceSection />

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
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useMobileLogout } from '@/composables/user/useMobileLogout'
import SettingCellIcon from '@/mobile/components/my/SettingCellIcon.vue'
import { useUserStatusStore } from '@/stores/domains/user/userStatus'
import { APP_VERSION } from '@/utils/appVersion'
import MobileAppearanceSection from './components/MobileAppearanceSection.vue'
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
  /* 触控下限 44px：vant 默认内容高度约 34px，与 iOS HIG / Material 的下限差 10px */
  min-height: 44px;
}

:deep(.van-cell::after) {
  border-bottom: 1px solid var(--tjg-border-layout-divider);
}

:deep(.van-cell:last-child::after) {
  border-bottom: none;
}
</style>
