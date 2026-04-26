<template>
  <AutoFixHeightPage :show-footer="false">
    <template #header>
      <HeaderBar border :isOfficial="false" :hidden-right="true" :room-name="t('mobile_setting.title')" />
    </template>

    <template #container>
      <div class="flex flex-col overflow-auto h-full">
        <div class="flex flex-col p-16px gap-12px">
          <div class="text-14px text-gray-500 mb-8px">{{ t('mobile_setting.account_section') }}</div>

          <van-cell-group inset>
            <van-cell :title="t('mobile_setting.status')" is-link @click="router.push('/mobile/mobileMy/status')">
              <template #icon>
                <div class="w-40px h-40px rounded-full bg-green-50 mr-12px flex items-center justify-center">
                  <Icon :icon="statusIcon" :width="20" :style="{ color: statusColor }" />
                </div>
              </template>
              <template #value>
                <span class="text-14px">{{ statusLabel }}</span>
              </template>
            </van-cell>

            <van-cell
              :title="t('mobile_setting.edit_profile')"
              is-link
              @click="router.push('/mobile/mobileMy/editProfile')">
              <template #icon>
                <div class="w-40px h-40px rounded-full bg-blue-50 mr-12px flex items-center justify-center">
                  <Icon icon="mdi:account-edit" :width="20" color="#1989fa" />
                </div>
              </template>
            </van-cell>

            <van-cell
              :title="t('mobile_setting.security')"
              is-link
              @click="router.push(MOBILE_SETTINGS_SECURITY_PRIVACY_PATH)">
              <template #icon>
                <div class="w-40px h-40px rounded-full bg-red-50 mr-12px flex items-center justify-center">
                  <Icon icon="mdi:shield-lock" :width="20" color="#ff4d4f" />
                </div>
              </template>
            </van-cell>
          </van-cell-group>

          <div class="text-14px text-gray-500 mt-16px mb-8px">{{ t('mobile_setting.notification_section') }}</div>

          <van-cell-group inset>
            <van-cell
              :title="t('mobile_setting.notifications')"
              is-link
              @click="router.push('/mobile/mobileMy/notifications')">
              <template #icon>
                <div class="w-40px h-40px rounded-full bg-orange-50 mr-12px flex items-center justify-center">
                  <Icon icon="mdi:bell" :width="20" color="#fa8c16" />
                </div>
              </template>
            </van-cell>
          </van-cell-group>

          <div class="text-14px text-gray-500 mt-16px mb-8px">{{ t('mobile_setting.appearance_section') }}</div>

          <van-cell-group inset>
            <van-cell :title="t('mobile_setting.theme')">
              <template #icon>
                <div class="w-40px h-40px rounded-full bg-purple-50 mr-12px flex items-center justify-center">
                  <Icon icon="mdi:palette" :width="20" color="#722ed1" />
                </div>
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
                <div class="w-40px h-40px rounded-full bg-cyan-50 mr-12px flex items-center justify-center">
                  <Icon icon="mdi:translate" :width="20" color="#13c2c2" />
                </div>
              </template>
              <template #right-icon>
                <van-radio-group v-model="languageValue" direction="horizontal">
                  <van-radio name="zh-CN">中文</van-radio>
                  <van-radio name="en">EN</van-radio>
                </van-radio-group>
              </template>
            </van-cell>
          </van-cell-group>

          <div class="text-14px text-gray-500 mt-16px mb-8px">{{ t('mobile_setting.privacy_section') }}</div>

          <van-cell-group inset>
            <van-cell
              :title="t('mobile_setting.preferences')"
              is-link
              @click="router.push('/mobile/mobileMy/preferences')">
              <template #icon>
                <div class="w-40px h-40px rounded-full bg-cyan-50 mr-12px flex items-center justify-center">
                  <Icon icon="mdi:tune" :width="20" color="#13c2c2" />
                </div>
              </template>
            </van-cell>

            <van-cell
              :title="t('mobile_setting.burn_after_read')"
              is-link
              @click="router.push('/mobile/mobileMy/burnAfterRead')">
              <template #icon>
                <div class="w-40px h-40px rounded-full bg-orange-50 mr-12px flex items-center justify-center">
                  <Icon icon="mdi:timer-outline" :width="20" color="#fa8c16" />
                </div>
              </template>
            </van-cell>

            <van-cell :title="t('mobile_setting.mjolnir')" is-link @click="router.push('/mobile/mobileMy/mjolnir')">
              <template #icon>
                <div class="w-40px h-40px rounded-full bg-red-50 mr-12px flex items-center justify-center">
                  <Icon icon="mdi:block-helper" :width="20" color="#ff4d4f" />
                </div>
              </template>
            </van-cell>
          </van-cell-group>

          <div class="text-14px text-gray-500 mt-16px mb-8px">{{ t('mobile_setting.help_section') }}</div>

          <van-cell-group inset>
            <van-cell
              :title="t('mobile_setting.help_feedback')"
              is-link
              @click="router.push(MOBILE_SETTINGS_HELP_ABOUT_PATH)">
              <template #icon>
                <div class="w-40px h-40px rounded-full bg-indigo-50 mr-12px flex items-center justify-center">
                  <Icon icon="mdi:help-circle" :width="20" color="#597ef7" />
                </div>
              </template>
            </van-cell>
          </van-cell-group>

          <div class="text-14px text-gray-500 mt-16px mb-8px">{{ t('mobile_setting.advanced_section') }}</div>

          <van-cell-group inset>
            <van-cell
              v-for="item in advancedSettingsItems"
              :key="item.path"
              :title="t(item.titleKey)"
              is-link
              @click="router.push(item.path)">
              <template #icon>
                <div
                  class="w-40px h-40px rounded-full mr-12px flex items-center justify-center"
                  :style="{ backgroundColor: item.iconBackgroundColor }">
                  <Icon :icon="item.icon" :width="20" :color="item.iconColor" />
                </div>
              </template>
            </van-cell>
          </van-cell-group>

          <div class="mt-16px">
            <van-button type="danger" block @click="handleLogout" :disabled="isLoggingOut" :loading="isLoggingOut">
              {{ t('mobile_setting.button.logout') }}
            </van-button>
          </div>

          <div class="text-center text-12px text-gray-400 mt-16px">{{ t('mobile_setting.version') }}: v1.0.0</div>
        </div>
      </div>
    </template>
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import { createLogger } from '@/utils/Logger'
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { showDialog, showToast } from 'vant'
import { Icon } from '@iconify/vue'
import { info } from '@tauri-apps/plugin-log'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { useUserStatusStore } from '@/stores/domains/user/userStatus'
import { useLoginFlow } from '@/hooks/useLoginFlow'
import { useI18n } from 'vue-i18n'
import { MOBILE_ADVANCED_SETTINGS_ITEMS } from './mobileSettingsConfig'
import { MOBILE_SETTINGS_HELP_ABOUT_PATH, MOBILE_SETTINGS_SECURITY_PRIVACY_PATH } from './settingsRoutes'

const logger = createLogger('MobileSettings')

const { t, locale } = useI18n()
const router = useRouter()
const globalStore = useGlobalStore()
const { isTrayMenuShow } = storeToRefs(globalStore)
const settingStore = useSettingStore()
const userStatusStore = useUserStatusStore()
const advancedSettingsItems = MOBILE_ADVANCED_SETTINGS_ITEMS

const themeValue = computed({
  get: () => settingStore.themes.content,
  set: (val) => settingStore.toggleTheme(val)
})

const languageValue = computed({
  get: () => settingStore.page.lang,
  set: (v) => {
    settingStore.page.lang = v
    locale.value = v === 'zh-CN' ? 'zh-CN' : 'en'
  }
})

const currentStatusId = computed(() => userStatusStore.stateId || 'online')

const statusOptions = [
  { id: 'online', label: t('mobile_setting.status_online'), icon: 'mdi:circle', color: '#52c41a' },
  { id: 'away', label: t('mobile_setting.status_away'), icon: 'mdi:circle', color: '#faad14' },
  { id: 'busy', label: t('mobile_setting.status_busy'), icon: 'mdi:circle', color: '#ff4d4f' },
  { id: 'offline', label: t('mobile_setting.status_offline'), icon: 'mdi:circle-outline', color: '#999' }
]

const currentStatus = computed(() => {
  return statusOptions.find((s) => s.id === currentStatusId.value) || statusOptions[0]
})

const statusLabel = computed(() => currentStatus.value.label)
const statusIcon = computed(() => currentStatus.value.icon)
const statusColor = computed(() => currentStatus.value.color)

const { logout } = useLoginFlow()

const isLoggingOut = ref(false)

async function handleLogout() {
  if (isLoggingOut.value) return
  isLoggingOut.value = true

  showDialog({
    title: t('mobile_setting.logout_confirm.title'),
    message: t('mobile_setting.logout_confirm.message'),
    showCancelButton: true,
    confirmButtonText: t('mobile_setting.logout_confirm.confirm'),
    cancelButtonText: t('mobile_setting.logout_confirm.cancel')
  })
    .then(async () => {
      try {
        await logout()

        settingStore.toggleLogin(false, false)
        info('登出账号')
        isTrayMenuShow.value = false

        showToast({
          type: 'success',
          message: t('mobile_setting.logout_success')
        })
        await router.push('/mobile/login')
      } catch (localError) {
        logger.error('本地登出清理失败：', localError)
        showToast({
          type: 'fail',
          message: t('mobile_setting.logout_failed')
        })
      }
    })
    .catch(() => {
      info('用户点击取消')
    })
    .finally(() => {
      isLoggingOut.value = false
    })
}
</script>

<style scoped></style>
