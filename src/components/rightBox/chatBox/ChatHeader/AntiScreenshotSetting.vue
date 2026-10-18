<template>
  <!-- F-2：房间级防截屏水印。
       服务端把它存为 `com.hula.privacy` 状态事件，所以只有能写该 state event 的人
       （power_levels 达标）才看得到这个开关 —— 无权限时**隐藏**而不是禁用，
       否则只是给用户一个必定 403 的按钮。

       文案只说「水印」，不说「阻止截屏」：客户端能做的只有在自己窗口上叠水印，
       系统级截屏无法拦截（Rust 侧 screenshot_watch 目前仍是占位实现）。 -->
  <div v-if="canManage" class="anti-screenshot">
    <div class="setting-item">
      <span class="setting-label">{{ t('home.chat_header.anti_screenshot') }}</span>
      <n-switch :value="enabled" :loading="loading" size="small" @update:value="handleToggle" />
    </div>
    <div class="setting-hint">{{ t('home.chat_header.anti_screenshot_hint') }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed, toRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoomAntiScreenshot } from '@/composables/chat/useRoomAntiScreenshot'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { roomOperations } from '@/services/matrix/room/RoomOperations'

const props = defineProps<{
  /** 当前房间；为空时整个设置不渲染（房间级设置没有房间就没有意义） */
  roomId: string | null
}>()

const { t } = useI18n()
const { showFeedback } = useActionFeedback()

const { enabled, loading, setEnabled } = useRoomAntiScreenshot(toRef(props, 'roomId'))

const canManage = computed<boolean>(() => {
  const roomId = props.roomId
  if (!roomId) return false
  return roomOperations.canManageAntiScreenshot(roomId)
})

async function handleToggle(value: boolean): Promise<void> {
  const ok = await setEnabled(value)
  if (!ok) {
    showFeedback(t('home.chat_header.anti_screenshot_failed'), 'error', 'assertive')
  }
}
</script>

<style scoped lang="scss">
.anti-screenshot {
  .setting-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .setting-hint {
    margin: -4px 0 8px;
    font-size: 11px;
    line-height: 1.5;
    color: var(--tjg-text-tertiary);
    opacity: 0.85;
  }
}
</style>
