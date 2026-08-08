<template>
  <n-popover
    v-model:show="infoShow"
    :placement="shrinkStatus ? 'bottom-start' : 'right-start'"
    :show-arrow="false"
    style="padding: 0; background: var(--tjg-surface-panel)"
    trigger="click">
    <template #trigger>
      <!-- 头像 -->
      <div class="relative size-34px rounded-50% cursor-pointer" @contextmenu="handleAvatarContextMenu">
        <TjgAvatar :src="userStore.userInfo?.avatar" :size="34" :name="userStore.userInfo?.name" round />

        <div
          v-if="isOnline"
          class="rounded-50% size-10px absolute bottom--2px right--2px border-(2px solid [--left-bg-color]) bg-[--tjg-status-online]"
          :title="statusTitle"
          @click.stop="openContent(t('home.profile_card.online_status'), 'onlineStatus', 320, 480)" />
      </div>
    </template>

    <!-- 用户个人信息框：复用已增强的资料卡（扩展资料 / 四态在线 / 复制反馈 / a11y） -->
    <n-flex vertical :size="0" class="min-w-[284px]">
      <!-- 资料卡撑满容器宽度，使顶部绿色横幅与下方退出登录按钮等宽 -->
      <InfoPopover v-if="userStore.userInfo?.uid" :uid="userStore.userInfo.uid" class="!w-full" />

      <!-- 账号操作层：仅保留「退出登录」（设置 / 锁屏 / 关于已由导航栏底部入口覆盖） -->
      <div class="mt-8px pt-10px border-t-(1px solid [--tjg-surface-subtle]) px-10px pb-8px">
        <button
          type="button"
          class="flex items-center justify-center gap-8px w-full px-8px py-9px rounded-8px text-(13px [--tjg-text-secondary]) font-medium cursor-pointer outline-none transition-colors duration-150 hover:bg-[--tjg-color-danger-50] hover:text-[--tjg-color-danger-500] focus-visible:bg-[--tjg-color-danger-50] focus-visible:text-[--tjg-color-danger-500] active:bg-[--tjg-color-danger-100]"
          :aria-label="t('menu.sign_out')"
          @click="handleLogout">
          <svg class="size-16px shrink-0" aria-hidden="true"><use href="#power" /></svg>
          <span>{{ t('menu.sign_out') }}</span>
        </button>
      </div>
    </n-flex>
  </n-popover>

  <!-- 右键菜单 -->
  <UserMenuDropdown
    v-if="isMenuOpen"
    :position="menuPosition"
    :is-context-menu="true"
    @close="closeMenu"
    @item-click="handleMenuItemClick" />
</template>
<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import TjgAvatar from '@/components/atomic/TjgAvatar.vue'
import InfoPopover from '@/components/common/InfoPopover.vue'
import UserMenuDropdown from '@/components/userMenu/UserMenuDropdown.vue'
import { useUserMenu } from '@/components/userMenu/useUserMenu'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useOnlineStatus } from '@/composables/common/useOnlineStatus'
import { useLoginFlow } from '@/composables/user/useLoginFlow'
import { useUserStore } from '@/stores/domains/user/user'
import { createLogger } from '@/utils/Logger'
import { leftHook } from '../hook.ts'

const logger = createLogger('LeftAvatar')

const userStore = useUserStore()
const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const { logout } = useLoginFlow()
const { shrinkStatus, infoShow, openContent } = leftHook()
const { isOnline, statusTitle } = useOnlineStatus()

const { isOpen: isMenuOpen, position: menuPosition, openMenu, closeMenu, handleMenuItemClick } = useUserMenu()

/** 关闭本人资料卡 */
const close = () => {
  infoShow.value = false
}

const handleLogout = async () => {
  try {
    await logout()
  } catch (error) {
    logger.error('[LeftAvatar] 退出登录失败:', error)
    showFeedback(t('menu.sign_out_failed'), 'error')
  }
}

function handleAvatarContextMenu(event: MouseEvent) {
  event.preventDefault()
  openMenu({ x: event.clientX, y: event.clientY }, 'right')
}
</script>
<style lang="scss" scoped>
@use '../style';
</style>
