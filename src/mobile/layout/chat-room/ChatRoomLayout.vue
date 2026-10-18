<template>
  <MobileLayout :safeAreaTop="true" :safeAreaBottom="true" :bottomSafeAreaClass="computedBottomSafeAreaClass">
    <div class="h-full flex flex-col">
      <!-- 页面全部内容 -->
      <div class="flex flex-col flex-1 min-h-0">
        <router-view v-slot="{ Component }">
          <keep-alive :include="['mobileChatMain', 'mobileGroupChatMember']">
            <component :is="Component" />
          </keep-alive>
        </router-view>
      </div>
    </div>
  </MobileLayout>
</template>

<script setup lang="ts">
import { useMobilePrivateRoomGate } from '@/composables/secretChat/useMobilePrivateRoomGate'

const route = useRoute()
const computedBottomSafeAreaClass = computed(() => {
  if (route.name === 'mobileChatMain') {
    return 'bg-[--tjg-surface-panel-muted]'
  }
  return ''
})

/**
 * 私密房门禁（移动端）。
 *
 * 放在布局层而不是 `beforeEach`：移动端房间路由的参数是**对端 uid**，
 * `secretChatGuard.extractRoomId` 只认 `message` / `windowChat` 的 `:roomId`，
 * 因此移动端这条路径原本整个绕过门禁（通知点击可直达私密房）。
 * 布局层能同时拿到当前会话与路由参数，故在挂载与切房两个时机各判一次。
 */
const { assertAccess } = useMobilePrivateRoomGate()

const guardCurrentRoom = () => {
  if (route.name !== 'mobileChatMain') return
  const uid = route.params.uid
  void assertAccess(typeof uid === 'string' ? uid : undefined)
}

watch(() => [route.name, route.params.uid] as const, guardCurrentRoom, { immediate: true })
</script>

<style lang="scss" scoped></style>
