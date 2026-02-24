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
                <n-tabs type="line" animated>
                  <n-tab-pane name="info" tab="基本信息">
                    <div class="py-20px">
                      <n-descriptions label-placement="left" :column="1" bordered>
                        <n-descriptions-item label="用户ID">
                          {{ uid }}
                        </n-descriptions-item>
                        <n-descriptions-item label="用户名">
                          {{ userInfo?.name || '未知' }}
                        </n-descriptions-item>
                      </n-descriptions>
                    </div>
                  </n-tab-pane>
                  <n-tab-pane name="activity" tab="动态">
                    <div class="py-20px text-center">
                      <n-empty description="暂无动态内容">
                        <template #extra>
                          <n-text depth="3" class="text-12px">
                            Matrix 协议暂不支持朋友圈功能
                          </n-text>
                        </template>
                      </n-empty>
                    </div>
                  </n-tab-pane>
                </n-tabs>
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
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()

const route = useRoute()
const uid = route.params.uid as string
const isMyPage = ref(false)
const userInfo = computed(() => userStore.userInfo)

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
