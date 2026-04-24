<template>
  <n-config-provider :theme="naiveTheme" class="secret-chat-modal size-full select-none">
    <div class="w-350px h-360px border-rd-8px select-none cursor-default">
      <div class="bg-[--bg-popover] size-full p-6px box-border flex flex-col">
        <svg
          v-if="!isMac()"
          @click="handleCancel"
          class="w-12px h-12px ml-a cursor-pointer select-none text-[--text-color]">
          <use href="#close"></use>
        </svg>
        <div class="flex flex-col gap-10px p-10px select-none">
          <n-flex vertical align="center" :size="24">
            <svg class="size-48px text-[--primary-color]">
              <use href="#lock"></use>
            </svg>
            <span class="text-(14px [--text-color]) font-bold">私密聊天</span>
            <div class="text-(13px [--text-color-tertiary]) text-center px-8px leading-relaxed">请输入私密聊天密码</div>
          </n-flex>

          <n-form ref="formRef" :model="formValue" :rules="rules" class="w-full px-8px">
            <n-form-item path="password" :show-label="false">
              <n-input
                v-model:value="formValue.password"
                type="password"
                placeholder="请输入密码"
                size="large"
                @keyup.enter="handleConfirm"
                show-password-on="click"
                :disabled="loading"></n-input>
            </n-form-item>
          </n-form>

          <n-button
            style="color: #fff"
            class="w-full"
            color="var(--color-primary)"
            size="large"
            @click="handleConfirm"
            :loading="loading"
            :disabled="!formValue.password">
            确认
          </n-button>

          <div v-if="errorMsg" class="text-(12px #b02525) text-center">
            {{ errorMsg }}
          </div>
        </div>
      </div>
    </div>
  </n-config-provider>
</template>

<script setup lang="ts">
import { getCurrentWebviewWindow, WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { darkTheme, lightTheme } from 'naive-ui'
import { storeToRefs } from 'pinia'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { useUserStore } from '@/stores/domains/user/user'
import { isMac } from '@/utils/PlatformConstants'
import { useI18n } from '@/plugins/i18n'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('SecretChatModal')

const { t } = useI18n()
const settingStore = useSettingStore()
const { themes } = storeToRefs(settingStore)
const naiveTheme = computed(() => (themes.value.content === 'dark' ? darkTheme : lightTheme))

const formRef = ref()
const loading = ref(false)
const errorMsg = ref('')
const formValue = reactive({
  password: ''
})

const rules = {
  password: {
    required: true,
    message: '请输入密码',
    trigger: 'blur'
  }
}

let currentWindow: WebviewWindow | null = null
let parentWindow: WebviewWindow | null = null
let unlistenClose: (() => void) | undefined

const handleConfirm = async () => {
  if (!formValue.password) {
    errorMsg.value = '请输入密码'
    return
  }

  try {
    loading.value = true
    errorMsg.value = ''

    const success = await settingStore.verifySecretChatPassword(formValue.password)
    if (success) {
      await currentWindow?.close()
      parentWindow?.emit('secret-chat-unlocked')
    } else {
      errorMsg.value = '密码错误'
      formValue.password = ''
    }
  } catch (error) {
    errorMsg.value = '验证失败'
    logger.error('私密聊天密码验证失败:', error)
  } finally {
    loading.value = false
  }
}

const handleCancel = async () => {
  await currentWindow?.close()
}

onMounted(async () => {
  currentWindow = await getCurrentWebviewWindow()
  parentWindow = await WebviewWindow.getByLabel('home')
  await currentWindow.show()

  if (currentWindow) {
    unlistenClose = await currentWindow.onCloseRequested(async () => {
      await parentWindow?.setEnabled(true)
    })
  }
})

onUnmounted(async () => {
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
.secret-chat-modal {
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
}
</style>
