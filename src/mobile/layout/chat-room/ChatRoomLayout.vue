<template>
  <MobileLayout :safeAreaTop="true" :safeAreaBottom="true" :bottomSafeAreaClass="computedBottomSafeAreaClass">
    <div class="h-full flex flex-col">
      <!-- 页面全部内容 -->
      <div class="flex flex-col flex-1 min-h-0">
        <router-view v-slot="{ Component }">
          <keep-alive :include="['mobileChatRoomDefault', 'mobileGroupChatMember']">
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
 * 放在布局层而不是 `beforeEach`：`secretChatGuard.extractRoomId` 只认
 * `message` / `windowChat` 的 `:roomId`，移动端这条路径原本整个绕过门禁
 * （通知点击可直达私密房）。布局层能同时拿到当前会话与路由参数，故在挂载与切房两个时机各判一次。
 *
 * 路由参数已从「对端 uid」改为「房间号」，判据直接就是 roomId；
 * 旧深链若仍是 uid，门禁层会先反查一次（见 `useMobilePrivateRoomGate`）。
 */
const { assertAccess } = useMobilePrivateRoomGate()

const guardCurrentRoom = () => {
  if (route.name !== 'mobileChatMain') return
  const roomId = route.params.roomId
  void assertAccess(typeof roomId === 'string' ? roomId : undefined)
}

watch(() => [route.name, route.params.roomId] as const, guardCurrentRoom, { immediate: true })
</script>

<style lang="scss" scoped></style>
