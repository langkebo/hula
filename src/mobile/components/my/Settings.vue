<template>
  <div
    class="grid grid-cols-[32px_32px_32px_32px] px-16px gap-12px z-1 h-32px items-center justify-end mt-10px dark:invert">
    <button
      type="button"
      :aria-label="t('mobile_my.actions.messages')"
      class="relative h-32px w-32px flex items-center justify-center bg-transparent border-0 p-0 after:absolute after:-inset-8px after:content-['']"
      @click="toMyMessages">
      <van-badge :content="unreadApplyCount || ''" :max="99">
        <svg class="iconpark-icon h-24px w-24px block"><use href="#remind"></use></svg>
      </van-badge>
    </button>

    <button
      type="button"
      :aria-label="t('mobile_my.actions.share')"
      class="relative h-32px w-32px flex items-center justify-center bg-transparent border-0 p-0 after:absolute after:-inset-8px after:content-['']"
      @click="activate">
      <svg class="iconpark-icon h-24px w-24px block"><use href="#share"></use></svg>
    </button>

    <button
      type="button"
      :aria-label="t('mobile_my.actions.scan')"
      class="relative h-32px w-32px flex items-center justify-center bg-transparent border-0 p-0 after:absolute after:-inset-8px after:content-['']"
      @click="toScanQRCode">
      <svg class="iconpark-icon h-30px w-30px block"><use href="#saoma"></use></svg>
    </button>

    <button
      type="button"
      :aria-label="t('mobile_my.actions.settings')"
      class="relative h-32px w-32px flex items-center justify-center bg-transparent border-0 p-0 after:absolute after:-inset-8px after:content-['']"
      @click="toSettings">
      <svg class="iconpark-icon h-30px w-30px block"><use href="#wode-shezhi"></use></svg>
    </button>

    <van-popup v-model:show="active" position="bottom" round class="my-share-sheet" :style="{ height: '30%' }">
      <div class="text-center py-20px text-16px text-[--tjg-text-primary]">{{ t('mobile_my.share_to') }}</div>
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import router from '@/router'
import { useGlobalStore } from '@/stores/domains/widget/global'

const { t } = useI18n()
const active = ref(false)
const globalStore = useGlobalStore()

const unreadApplyCount = computed(() => {
  return globalStore.contactUnreadCount
})

const activate = () => {}

const toScanQRCode = () => {
  router.push('/mobile/mobileMy/scanQRCode')
}

const toSettings = () => {
  router.push('/mobile/mobileMy/settings')
}

const toMyMessages = () => {
  router.push('/mobile/mobileMy/myMessages')
}
</script>

<style scoped>
/* 分享弹层：底部玻璃抽屉 */
:global(.my-share-sheet) {
  background: var(--tjg-glass-sheet-bg);
  border-top: var(--tjg-glass-border-soft);
  box-shadow: var(--tjg-glass-inner-highlight), var(--tjg-glass-shadow-strong);
  -webkit-backdrop-filter: blur(var(--tjg-glass-blur-strong)) saturate(var(--tjg-glass-saturate-soft));
  backdrop-filter: blur(var(--tjg-glass-blur-strong)) saturate(var(--tjg-glass-saturate-soft));
}

@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  :global(.my-share-sheet) {
    background: var(--tjg-surface-panel);
    -webkit-backdrop-filter: none;
    backdrop-filter: none;
  }
}
</style>
