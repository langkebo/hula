<template>
  <div class="flex flex-col overflow-auto h-full">
    <AutoFixHeightPage :show-footer="false">
      <template #header>
        <HeaderBar
          :isOfficial="false"
          :hidden-right="true"
          :enable-default-background="false"
          :enable-shadow="false"
          room-name="加入群聊" />
      </template>

      <template #container>
        <div class="flex flex-col gap-1 overflow-auto h-full">
          <div class="w-full h-full box-border flex flex-col">
            <div class="flex flex-col gap-20px justify-center p-[55px_20px] bg-white m-20px rounded-15px">
              <div class="flex items-center justify-center gap-20px">
                <img
                  class="size-48px rounded-full object-cover"
                  :src="userInfo.avatar"
                  @error="($event.target as HTMLImageElement).src = '/logo.png'" />

                <div class="flex flex-col gap-10px">
                  <p class="text-[--text-color]">{{ userInfo.name }}</p>
                  <p class="text-(12px [--text-color])">群号: {{ userInfo.account }}</p>
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
                :placeholder="'输入验证消息'"
                class="rounded-8px" />

              <van-button block class="mt-120px gradient-button" @click="addFriend">申请加入</van-button>
            </div>
          </div>
        </div>
      </template>
    </AutoFixHeightPage>
  </div>
</template>

<script setup lang="ts">
import { createLogger } from '@/utils/Logger'
import router from '@/router'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { useUserStore } from '@/stores/domains/user/user'
import { matrixGroupService } from '@/services/matrix'
import { useTimerManager } from '@/utils/TimerManager'

const logger = createLogger('ConfirmAddGroup')
const timerManager = useTimerManager()

const globalStore = useGlobalStore()
const userStore = useUserStore()
const userInfo = ref(globalStore.addGroupModalInfo)
const requestMsg = ref()

const filterNoSideSpace = (value: string) => value.replace(/^\s+|\s+$/g, '')

watch(
  () => globalStore.addGroupModalInfo,
  (newUid) => {
    userInfo.value = { ...newUid }
  }
)

const addFriend = async () => {
  await matrixGroupService.applyGroup(String(globalStore.addGroupModalInfo.account))
  window.$message.success('已发送群聊申请')
  timerManager.setTimeout(() => {
    router.push('/mobile/message')
  }, 2000)
}

onMounted(async () => {
  logger.debug('userInfo:', userInfo.value)
  requestMsg.value = `我是${userStore.userInfo!.name}`
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
