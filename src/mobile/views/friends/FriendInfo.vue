<template>
  <AutoFixHeightPage :show-footer="false">
    <template #header>
      <HeaderBar
        :isOfficial="false"
        :hidden-right="true"
        :enable-default-background="false"
        :enable-shadow="false"
        room-name="用户资料" />
    </template>

    <template #container>
      <div class="flex flex-col overflow-auto h-full">
        <PersonalInfo :is-my-page="isMyPage" :is-show="isShow"></PersonalInfo>

        <div class="top-0 flex-1 flex w-full border-#13987F border-1">
          <div ref="measureRef" class="h-full w-full absolute top-0 z-0"></div>

          <div
            :ref="(el) => (scrollContainer = el as HTMLElement)"
            :style="{ height: tabHeight + 'px' }"
            class="w-full z-1 overflow-y-auto absolute z-3">
            <div class="custom-rounded flex px-24px flex-col gap-4 z-1 p-10px mt-4 shadow">
              <div :style="{ height: tabHeight - 10 + 'px' }" class="flex flex-col">
                <van-tabs v-model:active="activeTab" animated>
                  <van-tab title="基本信息">
                    <div class="py-20px">
                      <div class="rounded-8px overflow-hidden border border-gray-200">
                        <div class="flex items-center px-16px py-12px border-b border-gray-200">
                          <span class="text-14px text-#666 w-80px">用户ID</span>
                          <span class="text-14px">{{ uid }}</span>
                        </div>
                        <div class="flex items-center px-16px py-12px">
                          <span class="text-14px text-#666 w-80px">用户名</span>
                          <span class="text-14px">{{ userInfo?.name || '未知' }}</span>
                        </div>
                      </div>
                    </div>
                  </van-tab>
                  <van-tab title="动态">
                    <div class="py-20px text-center">
                      <van-empty description="暂无动态内容">
                        <template #description>
                          <span class="text-12px text-#999">Matrix 协议暂不支持朋友圈功能</span>
                        </template>
                      </van-empty>
                    </div>
                  </van-tab>
                </van-tabs>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import PersonalInfo from '#/components/my/PersonalInfo.vue'
import { useUserStore } from '@/stores/domains/user/user'

const userStore = useUserStore()

const route = useRoute()
const uid = route.params.uid as string
const isMyPage = ref(false)
const userInfo = computed(() => userStore.userInfo)
const activeTab = ref(0)

const isShow = ref(true)
const measureRef = ref<HTMLDivElement>()
const scrollContainer = ref<HTMLElement | null>(null)
const tabHeight = ref(300)

const contentRectObserver = new ResizeObserver((event) => {
  tabHeight.value = event[0].contentRect.height
})

onMounted(() => {
  if (measureRef.value) {
    contentRectObserver.observe(measureRef.value)
  }
})

onUnmounted(() => {
  contentRectObserver.disconnect()
})
</script>

<style lang="scss" scoped>
.custom-rounded {
  border-top-left-radius: 20px;
  border-top-right-radius: 20px;
  overflow: hidden;
}
</style>
