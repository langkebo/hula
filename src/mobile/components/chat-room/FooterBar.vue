<template>
  <div>
    <div contenteditable="true" spellcheck="false" class="sr-only"></div>

    <div class="w-full min-h-20px flex flex-col z-2 footer-bar">
      <div class="flex-1 min-h-0">
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
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { isIOS } from '@/utils/PlatformConstants'
import { invokeSilently } from '@/utils/TauriInvokeHandler'

const { t } = useI18n()
const globalStore = useGlobalStore()
const emit = defineEmits(['location'])

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

<style scoped lang="scss">
@use '@/styles/scss/mixins/liquid-glass' as *;

/* 输入坞：整块作为一块悬浮玻璃，内容滚动到下方时可透出模糊 */
.footer-bar {
  background: var(--tjg-glass-nav-bg);
  -webkit-backdrop-filter: blur(var(--tjg-glass-blur-strong)) saturate(var(--tjg-glass-saturate-strong));
  backdrop-filter: blur(var(--tjg-glass-blur-strong)) saturate(var(--tjg-glass-saturate-strong));
  border-top: var(--tjg-glass-border-soft);
  box-shadow: var(--tjg-glass-inner-highlight), var(--tjg-glass-shadow-strong);

  /* 低性能设备关闭模糊 */
  @include backdrop-blur-fallback;
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

/* 不支持 backdrop-filter 时退回实色，避免半透明面板叠字 */
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .footer-bar {
    background: var(--tjg-surface-panel);
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
