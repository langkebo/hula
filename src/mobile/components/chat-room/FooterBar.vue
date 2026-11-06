<template>
  <div>
    <div contenteditable="true" spellcheck="false" class="sr-only"></div>

    <div class="w-full min-h-20px flex flex-col z-2 footer-bar">
      <div v-if="showVoicePanel" class="voice-panel-container">
        <VoicePanel @cancel="showVoicePanel = false" @send="handleVoiceSend" />
      </div>
      <div v-else class="flex-1 min-h-0">
        <chat-footer :detail-id="globalStore.currentSession?.detailId"></chat-footer>
      </div>
      <div class="footer-toolbar flex items-center justify-center">
        <button
          class="footer-bar-action"
          data-testid="location-btn"
          :aria-label="t('location_share.title')"
          @click="emit('location')">
          <svg class="w-22px h-22px iconpark-icon">
            <use href="#location"></use>
          </svg>
        </button>
        <van-button
          size="small"
          class="footer-chip"
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
const emit = defineEmits(['location'])

const showVoicePanel = ref(false)

const handleVoiceSend = async () => {
  showVoicePanel.value = false
}

onMounted(() => {
  if (isIOS()) {
    invokeSilently('set_webview_keyboard_adjustment', { enabled: true })
  }
})

onUnmounted(() => {
  if (isIOS()) {
    invokeSilently('set_webview_keyboard_adjustment', { enabled: false })
  }
})
</script>

<style lang="scss" scoped>
.active-icon {
  position: relative;

  svg {
    color: var(--tjg-color-primary-500);
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
    background-color: var(--tjg-color-primary-500);
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

/* 输入坞：整块作为一块悬浮玻璃，内容滚动到下方时可透出模糊 */
.footer-bar {
  background: var(--tjg-glass-nav-bg);
  -webkit-backdrop-filter: blur(var(--tjg-glass-blur-strong)) saturate(var(--tjg-glass-saturate-strong));
  backdrop-filter: blur(var(--tjg-glass-blur-strong)) saturate(var(--tjg-glass-saturate-strong));
  border-top: var(--tjg-glass-border-soft);
  box-shadow: var(--tjg-glass-inner-highlight), var(--tjg-glass-shadow-strong);
}

.footer-toolbar {
  padding: 4px 12px;
  gap: 8px;
  background: transparent;
}

.footer-bar-action {
  min-width: 48px;
  min-height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  border-radius: var(--tjg-radius-full);
  background: transparent;
  cursor: pointer;
  color: inherit;
  -webkit-tap-highlight-color: transparent;
  transition: background-color var(--tjg-motion-duration-fast) var(--tjg-motion-ease-standard);
}

.footer-bar-action:active {
  background-color: var(--tjg-glass-row-bg-pressed);
}

/* 语音/键盘切换胶囊：44px 触控高度 + 玻璃内描边 */
.footer-chip.van-button {
  min-height: 44px;
  padding: 0 18px;
  border-radius: var(--tjg-radius-full);
  background: var(--tjg-glass-tint-soft);
  border: var(--tjg-glass-border-soft);
  color: var(--tjg-text-primary);
  font-size: var(--tjg-font-size-md);
  -webkit-backdrop-filter: blur(var(--tjg-glass-blur-soft));
  backdrop-filter: blur(var(--tjg-glass-blur-soft));
  box-shadow: var(--tjg-glass-inner-highlight);
}

.voice-panel-container {
  min-height: 120px;
}

/* 不支持 backdrop-filter 时退回实色，避免半透明面板叠字 */
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .footer-bar {
    background: var(--tjg-surface-panel);
    -webkit-backdrop-filter: none;
    backdrop-filter: none;
  }

  .footer-chip.van-button {
    background: var(--tjg-surface-elevated);
    -webkit-backdrop-filter: none;
    backdrop-filter: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .footer-bar-action {
    transition: none;
  }
}
</style>
