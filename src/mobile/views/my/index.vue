<template>
  <div class="flex flex-col overflow-auto h-full">
    <Settings />
    <PersonalInfo :is-show="isShow"></PersonalInfo>
    <div class="relative top-0 flex-1 flex">
      <div ref="measureRef" class="h-full w-full absolute top-0 z-0"></div>
      <div
        :ref="(el) => (scrollContainer = el as HTMLElement)"
        :style="{ height: tabHeight + 'px' }"
        class="z-1 overflow-hidden mt-2 absolute z-3 w-full">
        <div class="custom-rounded bg-white dark:bg-dark-card flex flex-col gap-4 z-1 p-10px mt-4 p-15px!">
          <div
            ref="scrollbarRef"
            :style="{ height: tabHeight + 'px', overflowX: 'hidden', overflowY: 'auto' }"
            class="overflow-x-hidden">
            <div class="py-12px text-center">
              <van-empty description="暂无动态内容">
                <template #description>
                  <span class="text-12px text-gray-400">Matrix 协议暂不支持朋友圈功能</span>
                </template>
              </van-empty>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import PersonalInfo from '#/components/my/PersonalInfo.vue'
import Settings from '#/components/my/Settings.vue'

const measureRef = ref<HTMLDivElement>()
const tabHeight = ref(300)

const measureElementObserver = new ResizeObserver((event) => {
  tabHeight.value = event[0].contentRect.height
})

const isShow = ref(true)

const avatarBox = ref<HTMLElement | null>(null)

watch(isShow, (show) => {
  const box = avatarBox.value
  if (!box) return

  box.style.overflow = 'hidden'
  box.style.transition = 'all 0.3s ease'

  if (show) {
    box.style.height = box.scrollHeight + 'px'
    box.style.opacity = '1'
    box.style.transform = 'scale(1) translateY(0)'

    box.addEventListener(
      'transitionend',
      () => {
        box.style.height = 'auto'
        box.style.overflow = ''
      },
      { once: true }
    )
  } else {
    box.style.height = box.scrollHeight + 'px'
    requestAnimationFrame(() => {
      box.style.height = '58px'
      box.style.transform = 'scale(1) translateY(0)'
    })
  }
})

const infoBox = ref<HTMLElement | null>(null)
watch(isShow, (show) => {
  const info = infoBox.value
  if (!info) return

  info.style.transition = 'transform 0.3s ease'

  if (show) {
    info.style.transform = 'translateX(0)'
  } else {
    info.style.transform = 'translateX(-20px)'
  }
})

const scrollContainer = ref<HTMLElement | null>(null)

onMounted(() => {
  if (measureRef.value) {
    measureElementObserver.observe(measureRef.value)
  }
})

onUnmounted(() => {
  if (measureRef.value) {
    measureElementObserver.unobserve(measureRef.value)
  }
})
</script>

<style lang="scss" scoped>
$text-font-size-base: 14px;

$font-family-system: -apple-system, BlinkMacSystemFont;
$font-family-windows: 'Segoe UI', 'Microsoft YaHei';
$font-family-chinese: 'PingFang SC', 'Hiragino Sans GB';
$font-family-sans: 'Helvetica Neue', Helvetica, Arial, sans-serif;

.text-bold-style {
  font-size: 14px;
  font-family: $font-family-system, $font-family-windows, $font-family-sans;
  color: #757775;
}

.custom-rounded {
  border-top-left-radius: 20px;
  border-top-right-radius: 20px;
  overflow: hidden;
}

.avatar-collapsible {
  transition: all 0.3s ease;
  transform-origin: top;
}
</style>
