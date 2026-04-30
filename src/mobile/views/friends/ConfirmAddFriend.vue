<template>
  <div class="flex flex-col overflow-auto h-full">
    <AutoFixHeightPage :show-footer="false">
      <template #header>
        <HeaderBar
          :isOfficial="false"
          :hidden-right="true"
          :enable-default-background="false"
          :enable-shadow="false"
          room-name="添加好友" />
      </template>

      <template #container>
        <div class="flex flex-col gap-1 overflow-auto h-full">
          <div class="w-full h-full box-border flex flex-col">
            <div class="flex flex-col gap-20px justify-center p-[55px_20px] m-20px rounded-15px bg-white">
              <div class="flex items-center justify-center gap-20px">
                <img
                  class="size-48px rounded-full object-cover"
                  :src="avatarSrc"
                  @error="($event.target as HTMLImageElement).src = '/logo.png'" />

                <div class="flex flex-col gap-10px">
                  <p class="text-[--hula-text-primary]">{{ userInfo.name }}</p>
                  <p class="text-(12px [--hula-text-primary])">账号: {{ userInfo.account }}</p>
                </div>
              </div>

              <van-field
                v-model="requestMsg"
                type="textarea"
                rows="3"
                autosize
                maxlength="60"
                show-word-limit
                :formatter="filterNoSideSpace"
                format-trigger="onChange"
                :placeholder="'输入几句话，对TA说些什么吧'"
                class="rounded-8px" />

              <van-button block class="mt-30px gradient-button" @click="addFriend">添加好友</van-button>
            </div>
          </div>
        </div>
      </template>
    </AutoFixHeightPage>
  </div>
</template>

<script setup lang="ts">
import { useFriends } from '@/composables/useFriends'
import router from '@/router'
import { useUserStore } from '@/stores/domains/user/user'
import { createLogger } from '@/utils/Logger'
import { useTimerManager } from '@/utils/TimerManager'

const logger = createLogger('ConfirmAddFriend')
const timerManager = useTimerManager()

const userStore = useUserStore()
const { userInfo, avatarSrc, requestMsg, syncDefaultMessage, submitRequest } = useFriends({
  defaultRequestMessage: computed(() => `我是${userStore.userInfo!.name}`)
})

const filterNoSideSpace = (value: string) => value.replace(/^\s+|\s+$/g, '')

const addFriend = async () => {
  const submitted = await submitRequest()
  if (!submitted) return
  window.$message.success('已发送好友申请')
  timerManager.setTimeout(() => {
    router.push('/mobile/message')
  }, 2000)
}

onMounted(async () => {
  logger.debug('userInfo:', String(userInfo.value))
  syncDefaultMessage()
})
</script>

<style scoped lang="scss">
:deep(.van-cell.van-field) {
  padding: 10px 12px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.85);
}

:deep(.van-cell.van-field::after) {
  display: none;
}
</style>
