<template>
  <n-config-provider :theme="naiveTheme" class="remote-login-modal size-full select-none">
    <div class="size-full border-rd-8px select-none cursor-default">
      <div class="bg-[--tjg-surface-elevated] size-full p-6px box-border flex flex-col">
        <svg
          v-if="!isMac()"
          @click="handleClose"
          class="w-12px h-12px ml-a cursor-pointer select-none text-[--tjg-text-primary]"
          v-clickable="t('common.close')">
          <use href="#close"></use>
        </svg>
        <div class="flex flex-col gap-16px p-10px select-none">
          <n-flex vertical align="center" :size="14">
            <svg class="size-44px color-[--tjg-color-danger-500]" aria-hidden="true">
              <use href="#warning"></use>
            </svg>
            <span class="text-(14px [--tjg-text-primary]) font-bold">{{ t('login.remote_login.title') }}</span>
            <div class="text-(13px [--tjg-text-secondary]) text-center px-8px leading-relaxed">
              {{ t('login.remote_login.description', { ip }) }}
            </div>
            <div class="w-full rounded-6px bg-[--tjg-surface-panel-muted] px-12px py-8px flex flex-col gap-4px">
              <span class="text-(12px [--tjg-text-tertiary])">{{ t('login.remote_login.ip_label') }}</span>
              <span class="text-(13px [--tjg-text-primary]) break-all">{{ ip }}</span>
            </div>
          </n-flex>

          <n-button class="w-full" :color="cssVar('--tjg-color-primary-500')" size="large" @click="handleClose">
            {{ t('login.remote_login.confirm') }}
          </n-button>
        </div>
      </div>
    </div>
  </n-config-provider>
</template>

<script setup lang="ts">
import { getCurrentWebviewWindow, type WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { darkTheme, lightTheme } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useWindow } from '@/composables/common/useWindow'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { hasTauriRuntime } from '@/utils/AppHarness'
import { cssVar } from '@/utils/CssUtils'
import { createLogger } from '@/utils/Logger'
import { isMac } from '@/utils/PlatformConstants'

const WINDOW_LABEL = 'modal-remoteLogin'

const logger = createLogger('RemoteLoginModal')
const { t } = useI18n()
const { getWindowPayload } = useWindow()

const settingStore = useSettingStore()
const naiveTheme = computed(() => (settingStore.themeContent === 'dark' ? darkTheme : lightTheme))

const ip = ref(t('login.remote_login.unknown_ip'))

let currentWindow: WebviewWindow | null = null

interface RemoteLoginPayload {
  ip?: string
}

/**
 * 载荷由父窗口在 `tauri://created` 后写入，可能晚于本组件挂载，
 * 因此做几次短重试；取不到时回退到「未知 IP」，不臆造其它字段。
 */
const loadPayload = async () => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const payload = await getWindowPayload<RemoteLoginPayload | null>(WINDOW_LABEL, false).catch((error) => {
      logger.warn('Failed to read remote login payload:', error)
      return null
    })
    if (payload?.ip) {
      ip.value = payload.ip
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
}

const handleClose = async () => {
  await currentWindow?.close()
}

onMounted(async () => {
  if (!hasTauriRuntime()) return
  currentWindow = await getCurrentWebviewWindow()
  await currentWindow.show()
  await loadPayload()
})
</script>

<style scoped>
.remote-login-modal {
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
}

.remote-login-modal .n-button {
  color: var(--tjg-text-inverse);
}
</style>
