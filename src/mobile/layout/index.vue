<template>
  <MobileLayout :safeAreaTop="shouldShowTopSafeArea" :safeAreaBottom="!isLandscape">
    <div class="h-full" :class="isLandscape ? 'flex flex-row' : 'flex flex-col'">
      <!-- 横屏：TabBar 作为左侧垂直导航栏 -->
      <div v-if="isLandscape" class="flex-shrink-0 h-full">
        <TabBar ref="tabBarElement" vertical />
      </div>

      <div class="flex-1 overflow-hidden min-w-0">
        <RouterView v-slot="{ Component }">
          <Transition name="slide" appear mode="out-in">
            <keep-alive :max="10">
              <component :is="Component" :key="route.name" />
            </keep-alive>
          </Transition>
        </RouterView>
      </div>

      <!-- 竖屏：TabBar 在底部 -->
      <div v-if="!isLandscape" class="flex-shrink-0">
        <TabBar ref="tabBarElement" />
      </div>
    </div>
  </MobileLayout>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'
import TabBar from '#/layout/tabBar/index.vue'
import { useLandscape } from '@/composables/useLandscape'

const route = useRoute()

// 横屏检测：宽度 >= 768 且宽 > 高时切换为双栏布局
const { isLandscape } = useLandscape()

// 根据路由动态控制顶部安全区域
// 当在动态页面时，关闭顶部安全区域
const shouldShowTopSafeArea = computed(() => {
  return route.path !== '/mobile/dynamic'
})
</script>

<style lang="scss"></style>
