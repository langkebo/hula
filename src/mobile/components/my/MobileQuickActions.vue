<template>
  <div class="m-quick-actions">
    <div v-clickable v-for="item in actions" :key="item.key" class="m-quick-item" @click="handleClick(item)">
      <div class="m-quick-icon">
        <Icon :icon="item.icon" :width="22" :height="22" />
      </div>
      <span>{{ t(item.labelKey) }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

const { t } = useI18n()
const router = useRouter()

interface QuickAction {
  key: string
  labelKey: string
  icon: string
  /** 必须是真实可达的路由；首屏不允许出现「点击只弹开发中」的空入口 */
  route: string
}

// 5 个入口全部接入真实页面。原 wallet / favorite / shake 没有对应能力（点击只弹
// 「功能开发中」），已下线——上面写着「文件开发中」而 /mobile/mobileMy/files 早已
// 可用，这类谎报入口比缺入口更伤信任。
const actions: QuickAction[] = [
  {
    key: 'scan',
    labelKey: 'mobile_quick_actions.scan',
    icon: 'mdi:qrcode-scan',
    route: '/mobile/mobileMy/scanQRCode'
  },
  {
    key: 'file',
    labelKey: 'mobile_quick_actions.file',
    icon: 'mdi:file-document-outline',
    route: '/mobile/mobileMy/files'
  },
  {
    key: 'album',
    labelKey: 'mobile_photo.title',
    icon: 'mdi:image-multiple-outline',
    route: '/mobile/mobileMy/myAlbum'
  },
  {
    key: 'qr',
    labelKey: 'mobile_personal_info.qr_code',
    icon: 'mdi:qrcode',
    route: '/mobile/myQRCode'
  },
  {
    // 私密房会被普通会话列表整体过滤，没有独立入口就等于进不去
    key: 'secret',
    labelKey: 'home.secret_chat.title',
    icon: 'mdi:shield-lock-outline',
    route: '/mobile/secretChat'
  }
]

function handleClick(item: QuickAction) {
  router.push(item.route)
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
