<template>
  <div class="h-full w-full bg-[--hula-surface-panel] select-none cursor-default">
    <!-- 窗口头部 -->
    <ActionBar
      class="absolute right-0 w-full z-999"
      :shrink="false"
      :max-w="false"
      :current-label="WebviewWindow.getCurrent().label" />

    <!-- 标题 -->
    <p class="absolute-x-center h-fit pt-6px text-(13px [--hula-text-primary]) select-none cursor-default">
      {{ t('message.friend_verify.title') }}
    </p>

    <!-- 内容区域 -->
    <div class="bg-[--bg-edit] w-380px h-full box-border flex flex-col">
      <n-flex vertical justify="center" :size="20" class="p-[55px_20px]" data-tauri-drag-region>
        <n-flex align="center" justify="center" :size="20" data-tauri-drag-region>
          <n-avatar round size="large" :src="avatarSrc" />

          <n-flex vertical :size="10">
            <p class="text-[--hula-text-primary]">{{ userInfo.name }}</p>
            <p class="text-(12px [--hula-text-primary])">
              {{ t('message.friend_verify.account', { account: userInfo.account }) }}
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
          :placeholder="t('message.friend_verify.placeholder')" />

        <n-button class="mt-30px" color="var(--color-primary)" @click="addFriend">
          {{ t('message.friend_verify.send_btn') }}
        </n-button>
      </n-flex>
    </div>
  </div>
</template>
<script setup lang="ts">
import { getCurrentWebviewWindow, WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { useI18n } from 'vue-i18n'
import { useFriends } from '@/composables/useFriends'
import { countGraphemes } from '@/hooks/useCommon.ts'
import { useUserStore } from '@/stores/domains/user/user'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('AddFriendVerify')

const { t } = useI18n()
const userStore = useUserStore()
const requestMsgAutosize = { minRows: 3, maxRows: 3 }
const { userInfo, avatarSrc, requestMsg, syncDefaultMessage, submitRequest } = useFriends({
  defaultRequestMessage: computed(() => t('message.friend_verify.default_msg', { name: userStore.userInfo!.name }))
})

const addFriend = async () => {
  const submitted = await submitRequest()
  if (!submitted) return
  window.$message.success(t('message.friend_verify.toast_success'))
  setTimeout(async () => {
    await getCurrentWebviewWindow().close()
  }, 2000)
}

onMounted(async () => {
  logger.debug('userInfo', userInfo.value)

  await getCurrentWebviewWindow().show()
  syncDefaultMessage()
})
</script>

<style scoped lang="scss"></style>
