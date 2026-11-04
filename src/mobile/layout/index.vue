<template>
  <MobileLayout :safeAreaTop="shouldShowTopSafeArea" :safe-area-bottom="false">
    <div class="h-full" :class="showSidebar ? 'flex flex-row' : 'flex flex-col'">
      <!-- 横屏或展开态：TabBar 作为左侧垂直导航栏 -->
      <div v-if="showSidebar" class="flex-shrink-0 h-full">
        <TabBar ref="tabBarElement" vertical />
      </div>

      <div class="flex-1 overflow-hidden min-w-0">
        <RouterView v-slot="{ Component }">
          <keep-alive :max="10">
            <component :is="Component" :key="route.name" />
          </keep-alive>
        </RouterView>
      </div>

      <!-- 竖屏：TabBar 在底部 -->
      <div v-if="!showSidebar" class="flex-shrink-0">
        <TabBar ref="tabBarElement" />
      </div>
    </div>
  </MobileLayout>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useMobileBreakpoint } from '#/composables/useMobileBreakpoint'
import TabBar from '#/layout/tabBar/index.vue'
import { useLandscape } from '@/composables/useLandscape'

const route = useRoute()

// 横屏或展开态（>1024）时切换为带侧边导航的双栏布局
const { isLandscape } = useLandscape()
const { isExpanded } = useMobileBreakpoint()
const showSidebar = computed(() => isLandscape.value || isExpanded.value)

// 根据路由动态控制顶部安全区域
// 当在动态页面时，关闭顶部安全区域
const shouldShowTopSafeArea = computed(() => {
  return route.path !== '/mobile/dynamic'
})
</script>

<style lang="scss"></style>
