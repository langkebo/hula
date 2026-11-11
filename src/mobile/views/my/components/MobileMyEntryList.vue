<template>
  <!-- 首屏高频入口：安全处置与通知属于「出问题第一时间要找到」的项，
       放置于此可 1 跳到达（此前设备管理要走「设置 → 安全设置 → 设备管理」三层）。 -->
  <div class="mt-16px">
    <van-cell-group inset>
      <van-cell v-for="item in entries" :key="item.path" :title="t(item.titleKey)" is-link @click="go(item.path)">
        <template #icon>
          <SettingCellIcon :icon="item.icon" :color="item.color" :shell="item.shell" />
        </template>
      </van-cell>
    </van-cell-group>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import SettingCellIcon from '@/mobile/components/my/SettingCellIcon.vue'
import { MOBILE_SETTINGS_DEVICES_PATH, MOBILE_SETTINGS_SECURITY_PRIVACY_PATH } from '@/mobile/views/my/settingsRoutes'

const { t } = useI18n()
const router = useRouter()

interface MyEntry {
  titleKey: string
  path: string
  icon: string
  color: string
  shell: 'success' | 'info' | 'warning' | 'danger' | 'beta'
}

// 顺序 = 紧迫程度：设备与登录（丢失/异地）> 通知 > 安全 > 全部设置
const entries: MyEntry[] = [
  {
    titleKey: 'mobile_devices.title',
    path: MOBILE_SETTINGS_DEVICES_PATH,
    icon: 'mdi:devices',
    color: 'var(--tjg-color-danger-500)',
    shell: 'danger'
  },
  {
    titleKey: 'mobile_setting.notifications',
    path: '/mobile/mobileMy/notifications',
    icon: 'mdi:bell',
    color: 'var(--tjg-color-warning-500)',
    shell: 'warning'
  },
  {
    titleKey: 'mobile_setting.security',
    path: MOBILE_SETTINGS_SECURITY_PRIVACY_PATH,
    icon: 'mdi:shield-lock',
    color: 'var(--tjg-color-info-500)',
    shell: 'info'
  },
  {
    titleKey: 'mobile_setting.title',
    path: '/mobile/mobileMy/settings',
    icon: 'mdi:cog',
    color: 'var(--tjg-color-info-500)',
    shell: 'info'
  }
]

function go(path: string) {
  router.push(path)
}
</script>

<style scoped lang="scss">
// 与设置页保持同一行的观感：面板底 + 分隔线
:deep(.van-cell) {
  background: var(--tjg-surface-panel);
}

:deep(.van-cell::after) {
  border-bottom: 1px solid var(--tjg-border-layout-divider);
}

:deep(.van-cell:last-child::after) {
  border-bottom: none;
}
</style>
