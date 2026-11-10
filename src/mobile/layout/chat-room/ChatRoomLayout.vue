<template>
  <MobileLayout :safeAreaTop="true" :safeAreaBottom="true" :bottomSafeAreaClass="computedBottomSafeAreaClass">
    <div class="h-full flex flex-col">
      <!-- 页面全部内容 -->
      <div class="relative flex flex-col flex-1 min-h-0">
        <router-view v-slot="{ Component }">
          <keep-alive :include="['mobileChatRoomDefault', 'mobileGroupChatMember']">
            <component :is="Component" />
          </keep-alive>
        </router-view>

        <!-- 门禁是异步的：遮住首帧，避免私密内容闪现（不依赖颜色传达状态，带 aria-label） -->
        <div
          v-if="gatePending"
          class="absolute inset-0 z-10 flex items-center justify-center bg-[--tjg-surface-panel]"
          data-testid="mobile-chat-room-gate-mask"
          role="status"
          :aria-label="t('home.secret_chat.checking_access')">
          <van-loading size="24px" />
        </div>
      </div>
    </div>
  </MobileLayout>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useMobilePrivateRoomGate } from '@/composables/secretChat/useMobilePrivateRoomGate'
import { createLogger } from '@/utils/Logger'

const { t } = useI18n()
const route = useRoute()
const gatePending = ref(false)
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
const logger = createLogger('ChatRoomLayout')

// 自增序号：快速连续切房时，只有最新一次运行能改 gatePending。
// 否则旧一次运行的 finally 会把新一次刚置的 true 清成 false，遮罩提前解除导致私密内容闪现。
let guardRunId = 0

const guardCurrentRoom = async () => {
  const runId = ++guardRunId
  if (route.name !== 'mobileChatMain') {
    gatePending.value = false
    return
  }
  const roomId = route.params.roomId
  // 进入任何会话先遮一帧：登记表加载完成后才知道是不是私密房
  gatePending.value = true
  try {
    await assertAccess(typeof roomId === 'string' ? roomId : undefined)
  } catch (err) {
    // assertAccess 自身已做重定向与提示，这里只记录，避免未捕获的 rejection 终止遮罩逻辑
    logger.error('Secret room gate check failed:', err)
  } finally {
    if (runId === guardRunId) {
      gatePending.value = false
    }
  }
}

watch(() => [route.name, route.params.roomId] as const, guardCurrentRoom, { immediate: true })
</script>

<style lang="scss" scoped></style>
