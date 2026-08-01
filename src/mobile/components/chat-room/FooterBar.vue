<template>
  <div ref="root">
    <div
      ref="messageInputDom"
      contenteditable="true"
      spellcheck="false"
      style="position: absolute; left: -9999px; width: 1px; height: 1px; overflow: hidden; white-space: pre-wrap"></div>

    <div class="w-full min-h-20px flex flex-col z-2 footer-bar-shadow">
      <div v-if="showVoicePanel" class="voice-panel-container">
        <VoicePanel @cancel="showVoicePanel = false" @send="handleVoiceSend" />
      </div>
      <div v-else class="flex-1 min-h-0">
        <chat-footer :detail-id="globalStore.currentSession?.detailId"></chat-footer>
      </div>
      <div
        class="flex items-center justify-center py-4px border-t border-[--hula-border-default] bg-[--hula-surface-panel]">
        <button class="footer-bar-action" data-testid="location-btn" @click="emit('location')">
          <svg class="w-22px h-22px iconpark-icon">
            <use href="#location"></use>
          </svg>
        </button>
        <van-button
          size="small"
          :type="showVoicePanel ? 'primary' : 'default'"
          plain
          round
          @click="showVoicePanel = !showVoicePanel">
          <template #icon>
            <Icon :icon="showVoicePanel ? 'mdi:keyboard' : 'mdi:microphone'" :width="16" />
          </template>
          {{ showVoicePanel ? t('mobile_chat.keyboard') : t('mobile_chat.voice') }}
        </van-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import 'vant/es/dialog/style'
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { isIOS } from '@/utils/PlatformConstants'
import { invokeSilently } from '@/utils/TauriInvokeHandler'
import VoicePanel from './panel/VoicePanel.vue'

const { t } = useI18n()
const globalStore = useGlobalStore()
const emit = defineEmits(['focus', 'blur', 'updateHeight', 'location'])

const showVoicePanel = ref(false)

const handleVoiceSend = async (_voiceData: unknown) => {
  showVoicePanel.value = false
}

const root = ref()

onMounted(() => {
  if (root.value) {
    const resizeObserver = new ResizeObserver((entries) => {
      const height = entries[0].contentRect.height
      emit('updateHeight', height)
    })
    resizeObserver.observe(root.value)

    onUnmounted(() => {
      resizeObserver.disconnect()
    })
  }

  if (isIOS()) {
    invokeSilently('set_webview_keyboard_adjustment', { enabled: true })
  }
})

onUnmounted(() => {
  if (isIOS()) {
    invokeSilently('set_webview_keyboard_adjustment', { enabled: false })
  }
})

defineExpose({ root })
</script>

<style lang="scss" scoped>
.active-icon {
  position: relative;

  svg {
    color: var(--hula-color-primary-500);
    transition: color 0.3s ease;
  }

  &::after {
    content: '';
    position: absolute;
    bottom: -5px;
    left: 50%;
    transform: translateX(-50%);
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background-color: var(--hula-color-primary-500);
    animation: pulse 1.5s infinite;
  }
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
    transform: translateX(-50%) scale(1);
  }

  50% {
    opacity: 0.5;
    transform: translateX(-50%) scale(1.2);
  }
}

.footer-bar-shadow {
  box-shadow: var(--hula-shadow-top-bar);
}

.footer-bar-action {
  min-width: 48px;
  min-height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  color: inherit;
}

.voice-panel-container {
  min-height: 120px;
}
</style>
