<template>
  <n-config-provider :theme="naiveTheme" class="remote-login-modal size-full select-none">
    <div class="w-350px h-310px border-rd-8px select-none cursor-default">
      <div class="bg-[--hula-surface-elevated] size-full p-6px box-border flex flex-col">
        <svg
          v-if="!isMac()"
          @click="handleConfirm"
          class="w-12px h-12px ml-a cursor-pointer select-none text-[--hula-text-primary]">
          <use href="#close"></use>
        </svg>
        <div class="flex flex-col gap-10px p-10px select-none">
          <n-flex vertical align="center" :size="30">
            <span class="text-(14px [--hula-text-primary])">{{ t('login.remote_login.notice_title') }}</span>
            <div class="relative">
              <img class="rounded-full size-72px" :src="AvatarUtils.getAvatarUrl(userStore.userInfo?.avatar ?? '')" />
              <div
                class="absolute inset-0 bg-[--avatar-hover-bg] backdrop-blur-[2px] rounded-full flex items-center justify-center">
                <svg class="size-34px text-white animate-pulse">
                  <use href="#cloudError"></use>
                </svg>
              </div>
            </div>
            <div class="text-(13px centent [--hula-text-primary]) px-12px leading-loose mb-20px">
              {{ t('login.remote_login.description', { ip }) }}
            </div>
          </n-flex>
          <n-button
            style="color: var(--hula-text-inverse)"
            class="w-full"
            color="var(--color-primary)"
            @click="handleConfirm">
            {{ t('login.remote_login.confirm') }}
          </n-button>
        </div>
      </div>
    </div>
  </n-config-provider>
</template>

<script setup lang="ts">
import { getCurrentWebviewWindow, WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { darkTheme, lightTheme } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useWindow } from '@/hooks/useWindow.ts'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { useUserStore } from '@/stores/domains/user/user'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { createLogger } from '@/utils/Logger'
import { isMac } from '@/utils/PlatformConstants'

const logger = createLogger('RemoteLoginModal')
const { t } = useI18n()

const ip = ref(t('login.remote_login.unknown_ip'))
const showModal = ref(true)
const settingStore = useSettingStore()
const naiveTheme = computed(() => (settingStore.themeContent === 'dark' ? darkTheme : lightTheme))
let currentWindow: WebviewWindow | null = null
let parentWindow: WebviewWindow | null = null
let unlistenClose: (() => void) | undefined
const { getWindowPayload } = useWindow()
const userStore = useUserStore()

const assignIpFromPayload = async () => {
  try {
    const payload = await getWindowPayload<{ ip?: string }>('modal-remoteLogin')
    if (payload?.ip) {
      ip.value = payload.ip
    }
  } catch (error) {
    logger.error('获取异地登录信息失败:', error)
  }
}

const handleConfirm = async () => {
  showModal.value = false
  await parentWindow?.setEnabled(true)
  await currentWindow?.close()
}

onMounted(async () => {
  showModal.value = true
  currentWindow = await getCurrentWebviewWindow()
  parentWindow = await WebviewWindow.getByLabel('login')
  await assignIpFromPayload()
  await currentWindow.show()
  if (currentWindow) {
    unlistenClose = await currentWindow.onCloseRequested(async () => {
      showModal.value = false
      await parentWindow?.setEnabled(true)
    })
  }
})

onUnmounted(async () => {
  showModal.value = false
  if (unlistenClose) {
    await unlistenClose()
    unlistenClose = undefined
  }
  await parentWindow?.setEnabled(true)
  currentWindow = null
  parentWindow = null
})
</script>

<style scoped>
.remote-login-modal {
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
}
</style>
