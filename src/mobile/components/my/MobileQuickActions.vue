<template>
  <div class="m-quick-actions">
    <div v-for="item in actions" :key="item.key" class="m-quick-item" @click="handleClick(item)">
      <div class="m-quick-icon">
        <Icon :icon="item.icon" :width="22" :height="22" />
      </div>
      <span>{{ t(item.labelKey) }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { showToast } from 'vant'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

const { t } = useI18n()
const router = useRouter()

interface QuickAction {
  key: string
  labelKey: string
  icon: string
  /** 已接入的路由；留空则给出开发占位提示 */
  route?: string
}

// 对齐原型《移动端我的页》快捷入口：扫一扫 / 钱包 / 收藏 / 文件 / 摇一摇
const actions: QuickAction[] = [
  { key: 'scan', labelKey: 'mobile_quick_actions.scan', icon: 'mdi:qrcode-scan', route: '/mobile/myQRCode' },
  { key: 'wallet', labelKey: 'mobile_quick_actions.wallet', icon: 'mdi:wallet' },
  { key: 'favorite', labelKey: 'mobile_quick_actions.favorite', icon: 'mdi:star-outline' },
  { key: 'file', labelKey: 'mobile_quick_actions.file', icon: 'mdi:file-document-outline' },
  { key: 'shake', labelKey: 'mobile_quick_actions.shake', icon: 'mdi:shuffle-variant' }
]

function handleClick(item: QuickAction) {
  if (item.route) {
    router.push(item.route)
    return
  }
  showToast(t('mobile_quick_actions.developing', { name: t(item.labelKey) }))
}
</script>

<style lang="scss" scoped>
.m-quick-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-around;
  gap: 8px 0;
  margin: 12px 16px 0;
  padding: 14px 8px;
  border-radius: var(--tjg-radius-xl);
  background: var(--tjg-glass-row-bg);
  border: var(--tjg-glass-border-soft);
  box-shadow: var(--tjg-glass-inner-highlight);
}

.m-quick-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  width: 20%;
  min-height: 44px;
  cursor: pointer;
  padding: 6px 0;
  border-radius: var(--tjg-radius-lg);
  -webkit-tap-highlight-color: transparent;
  transition:
    background-color var(--tjg-motion-duration-fast) var(--tjg-motion-ease-standard),
    transform var(--tjg-motion-duration-fast) var(--tjg-motion-ease-standard);

  &:active {
    background: var(--tjg-glass-row-bg-pressed);
    transform: scale(var(--tjg-glass-press-scale));
  }
}

.m-quick-icon {
  width: 44px;
  height: 44px;
  border-radius: var(--tjg-radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--tjg-glass-tint-soft);
  color: var(--tjg-color-primary-500);
  box-shadow: var(--tjg-glass-inner-highlight);
}

@media (prefers-reduced-motion: reduce) {
  .m-quick-item {
    transition: none;
  }

  .m-quick-item:active {
    transform: none;
  }
}
</style>
