<template>
  <div class="flex flex-col overflow-auto h-full">
    <Settings />
    <PersonalInfo :is-show="isShow"></PersonalInfo>

    <!-- 显示名称编辑 -->
    <div class="px-16px mt-16px z-1">
      <div class="text-14px font-500 text-[--hula-text-secondary] mb-8px">
        {{ t('mobile_my.edit_display_name') }}
      </div>
      <div class="flex items-center gap-10px">
        <van-field
          v-model="editDisplayName"
          class="flex-1 rounded-8px"
          :placeholder="t('mobile_my.display_name_placeholder')"
          maxlength="50"
          clearable />
        <van-button
          size="small"
          type="primary"
          :loading="savingDisplayName"
          :disabled="!editDisplayName.trim() || editDisplayName === originalDisplayName"
          @click="handleSaveDisplayName">
          {{ t('common.save') }}
        </van-button>
      </div>
    </div>

    <!-- 退出登录按钮 -->
    <div class="px-16px mt-24px z-1 pb-24px">
      <van-button type="danger" block :loading="isLoggingOut" @click="handleLogout">
        {{ t('mobile_setting.button.logout') }}
      </van-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { showConfirmDialog, showFailToast, showToast } from 'vant'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import PersonalInfo from '#/components/my/PersonalInfo.vue'
import Settings from '#/components/my/Settings.vue'
import { matrixClientService, profileService } from '@/services/matrix'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { useUserStore } from '@/stores/domains/user/user'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('MobileMy')
const { t } = useI18n()
const router = useRouter()
const userStore = useUserStore()
const settingStore = useSettingStore()

const isShow = ref(true)

// Display name editing
const editDisplayName = ref('')
const originalDisplayName = ref('')
const savingDisplayName = ref(false)

// Initialize display name from user store
watch(
  () => userStore.userInfo?.name,
  (name) => {
    if (name) {
      editDisplayName.value = name
      originalDisplayName.value = name
    }
  },
  { immediate: true }
)

async function handleSaveDisplayName() {
  const newName = editDisplayName.value.trim()
  if (!newName || newName === originalDisplayName.value) return

  savingDisplayName.value = true
  try {
    showToast({ type: 'loading', message: t('mobile_my.saving'), forbidClick: true })
    await profileService.setDisplayName(newName)
    showToast({ type: 'success', message: t('mobile_my.save_display_name_success') })
    originalDisplayName.value = newName
    // Update local store
    if (userStore.userInfo) {
      userStore.userInfo.name = newName
    }
  } catch (e) {
    logger.error('Failed to save display name:', e)
    showFailToast(e instanceof Error ? e.message : String(e) || t('mobile_my.save_display_name_failed'))
  } finally {
    savingDisplayName.value = false
  }
}

// Logout
const isLoggingOut = ref(false)

async function handleLogout() {
  try {
    await showConfirmDialog({
      title: t('mobile_setting.logout_confirm.title'),
      message: t('mobile_setting.logout_confirm.message')
    })
  } catch {
    return // User cancelled
  }

  isLoggingOut.value = true
  try {
    showToast({ type: 'loading', message: t('mobile_setting.logout_confirm.message'), forbidClick: true })
    await matrixClientService.logout()
    settingStore.toggleLogin(false, false)
    showToast({ type: 'success', message: t('mobile_setting.logout_success') })
    await router.push('/mobile/login')
  } catch (e) {
    logger.error('Logout failed:', e)
    showFailToast(e instanceof Error ? e.message : String(e) || t('mobile_setting.logout_failed'))
  } finally {
    isLoggingOut.value = false
  }
}
</script>

<style lang="scss" scoped></style>
