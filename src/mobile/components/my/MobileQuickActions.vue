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
  padding: 12px 16px;
  background: var(--tjg-surface-panel);
  border-bottom: 8px solid var(--tjg-border-layout-divider);
}

.m-quick-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  width: 20%;
  cursor: pointer;
  padding: 6px 0;

  &:active {
    opacity: 0.6;
  }
}

.m-quick-icon {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--tjg-color-primary-50, var(--tjg-color-primary-100));
  color: var(--tjg-color-primary-500);
}
</style>
