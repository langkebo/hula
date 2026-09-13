<template>
  <div class="m-quick-actions">
    <div v-for="item in actions" :key="item.key" class="m-quick-item" @click="handleClick(item)">
      <div class="m-quick-icon">
        <Icon :icon="item.icon" :width="22" :height="22" />
      </div>
      <span>{{ item.label }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { showToast } from 'vant'
import { useRouter } from 'vue-router'

const router = useRouter()

interface QuickAction {
  key: string
  label: string
  icon: string
  /** 已接入的路由；留空则给出开发占位提示 */
  route?: string
}

// 对齐原型《移动端我的页》快捷入口：扫一扫 / 钱包 / 收藏 / 文件 / 摇一摇
const actions: QuickAction[] = [
  { key: 'scan', label: '扫一扫', icon: 'mdi:qrcode-scan', route: '/mobile/myQRCode' },
  { key: 'wallet', label: '钱包', icon: 'mdi:wallet' },
  { key: 'favorite', label: '收藏', icon: 'mdi:star-outline' },
  { key: 'file', label: '文件', icon: 'mdi:file-document-outline' },
  { key: 'shake', label: '摇一摇', icon: 'mdi:shuffle-variant' }
]

function handleClick(item: QuickAction) {
  if (item.route) {
    router.push(item.route)
    return
  }
  showToast(`「${item.label}」功能开发中`)
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
  background: var(--tjg-color-primary-50, color-mix(in srgb, var(--tjg-color-primary-500) 10%, transparent));
  color: var(--tjg-color-primary-500);
}
</style>
