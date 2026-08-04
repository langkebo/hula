<template>
  <div class="h-full w-full bg-[--tjg-surface-panel] select-none cursor-default">
    <!-- 窗口头部 -->
    <ActionBar
      class="absolute right-0 w-full z-999"
      :shrink="false"
      :max-w="false"
      :current-label="currentWindowLabel" />

    <!-- 标题 -->
    <p
      class="absolute-x-center h-fit pt-6px text-(13px [--tjg-text-primary]) select-none cursor-default"
      data-tauri-drag-region>
      {{ t('message.group_verify.title') }}
    </p>

    <!-- 内容区域 -->
    <div class="bg-[--bg-edit] w-380px h-full box-border flex flex-col">
      <n-flex vertical justify="center" :size="20" class="p-[55px_20px]" data-tauri-drag-region>
        <n-flex align="center" justify="center" :size="20" data-tauri-drag-region>
          <n-avatar round size="large" :src="userInfo.avatar" />

          <n-flex vertical :size="10">
            <p class="text-[--tjg-text-primary]">{{ userInfo.name }}</p>
            <p class="text-(12px [--tjg-text-primary])">
              {{ t('message.group_verify.account', { account: userInfo.account }) }}
            </p>
          </n-flex>
        </n-flex>

        <n-input
          v-model:value="requestMsg"
          :allow-input="(value: string) => !value.startsWith(' ') && !value.endsWith(' ')"
          :autosize="requestMsgAutosize"
          :maxlength="60"
          :count-graphemes="countGraphemes"
          show-count
          spellCheck="false"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          type="textarea"
          :placeholder="t('message.group_verify.placeholder')" />

        <n-button class="mt-120px" color="var(--tjg-color-primary-500)" @click="addFriend">
          {{ t('message.group_verify.send_btn') }}
        </n-button>
      </n-flex>
    </div>
  </div>
</template>
<script setup lang="ts">
import { getCurrentWebviewWindow, WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { countGraphemes } from '@/composables/common/useCommon'
import { useGroupRequestConfirm } from '@/composables/useGroupRequestConfirm'
import { useUserStore } from '@/stores/domains/user/user'
import { hasTauriRuntime } from '@/utils/AppHarness'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('AddGroupVerify')

const currentWindowLabel = computed(() => (hasTauriRuntime() ? WebviewWindow.getCurrent().label : ''))

const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const userStore = useUserStore()
const requestMsgAutosize = { minRows: 3, maxRows: 3 }
const { userInfo, requestMsg, syncDefaultMessage, submitRequest } = useGroupRequestConfirm(
  computed(() => t('message.group_verify.default_msg', { name: userStore.userInfo?.name ?? '' }))
)

const addFriend = async () => {
  const submitted = await submitRequest()
  if (!submitted) return
  showFeedback(t('message.group_verify.toast_success'), 'success')
  setTimeout(async () => {
    if (hasTauriRuntime()) {
      await getCurrentWebviewWindow().close()
    }
  }, 2000)
}

onMounted(async () => {
  logger.debug('userInfo', userInfo.value)

  if (hasTauriRuntime()) {
    await getCurrentWebviewWindow().show()
  }
  syncDefaultMessage()
})
</script>

<style scoped lang="scss"></style>
