<template>
  <MobileLayout class="bg-gray-100 px-20px" :safeAreaTop="true" :safeAreaBottom="true">
    <HeaderBar
      :isOfficial="false"
      :hidden-right="true"
      :enable-default-background="false"
      :enable-shadow="false"
      :room-name="t('login.mobile.confirm.title')" />

    <div
      class="flex flex-col rounded-15px bg-white pt-30px py-20px items-center justify-between gap-20px mt-40px h-70%">
      <div class="flex flex-col items-center gap-20px">
        <div class="flex items-center">
          <div class="text-26px">{{ t('login.mobile.confirm.heading') }}</div>
        </div>

        <van-checkbox-group
          v-model="checkedValues"
          checked-color="var(--tjg-color-primary-500)"
          class="flex flex-col gap-14px text-14px">
          <van-checkbox name="syncRecentMessages">{{ t('login.mobile.confirm.sync_recent_messages') }}</van-checkbox>
          <van-checkbox name="autoLogin">{{ t('login.mobile.confirm.auto_login') }}</van-checkbox>
        </van-checkbox-group>
      </div>
      <div class="flex w-45% gap-30px justify-center items-center flex-col">
        <van-button @click="handleConfirmLogin" color="var(--tjg-color-primary-500)" class="w-full" type="primary">
          {{ t('login.mobile.confirm.confirm_button') }}
        </van-button>
        <div v-clickable @click="handleCancelLogin" class="w-full text-center text-gray-600">
          {{ t('login.button.cancel_login') }}
        </div>
      </div>
    </div>
  </MobileLayout>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { createLogger } from '@/utils/Logger'

const { t } = useI18n()
const logger = createLogger('SyncData')

const router = useRouter()
const settingStore = useSettingStore()

// 使用数组管理选中的复选框
const checkedValues = ref(['syncRecentMessages', ''])

const shouldAutoLogin = computed(() => {
  return checkedValues.value.includes('autoLogin')
})

const handleConfirmLogin = async () => {
  try {
    // 设置自动登录状态
    settingStore.setAutoLogin(shouldAutoLogin.value)

    // 跳转到主页面
    router.push('/mobile/home')
  } catch (error) {
    logger.error('Login confirmation failed:', error)
  }
}

const handleCancelLogin = () => {
  // 取消登录时不设置自动登录
  settingStore.setAutoLogin(false)
  router.back()
}
</script>

<style lang="scss" scoped></style>
