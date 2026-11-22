<template>
  <!-- 个人信息区 -->
  <div class="flex flex-col px-16px border-b border-[--tjg-border-layout-divider] pb-16px">
    <!-- 头像基本信息 -->
    <div ref="avatarBox" class="grid grid-cols-[64px_1fr] z-1 items-start mt-6 gap-2 will-change-transform">
      <!-- 头像 -->
      <div
        class="self-center h-auto transition-transform duration-300 ease-in-out origin-top"
        :style="{ transform: props.isShow ? 'scale(1) translateY(0)' : 'scale(0.62) translateY(0px)' }">
        <div
          v-if="showSkeleton"
          class="size-64px rounded-full bg-[--tjg-surface-subtle] animate-pulse motion-reduce:animate-none"
          data-testid="personal-info-skeleton-avatar"
          aria-hidden="true" />
        <img
          v-else
          class="size-64px rounded-full object-cover"
          :src="avatarUrl"
          :alt="t('mobile_contact.avatar.user')"
          @error="($event.target as HTMLImageElement).src = '/logo.png'" />
      </div>

      <!-- 基本信息栏 -->
      <div ref="infoBox" class="pl-2 flex gap-8px flex-col transition-transform duration-300 ease-in-out">
        <!-- 名字与在线状态 -->
        <div class="flex flex-warp gap-4 items-center">
          <span
            v-if="showSkeleton"
            class="block h-18px w-96px rounded-4px bg-[--tjg-surface-subtle] animate-pulse motion-reduce:animate-none"
            data-testid="personal-info-skeleton-name"
            aria-hidden="true" />
          <span v-else class="font-semibold text-18px">{{ userDetailInfo?.name }}</span>
          <div
            v-show="hasUserOnlineState"
            class="bg-[--tjg-color-primary-100] flex flex-wrap ps-2 px-8px items-center rounded-full gap-1 h-24px">
            <span class="w-12px h-12px rounded-15px flex items-center">
              <img
                :src="friendUserState?.url ? friendUserState.url : currentState?.url"
                :alt="friendUserState?.title || currentState?.title || ''"
                class="rounded-50% size-14px" />
            </span>
            <span class="text-bold-style text-12px text-[--tjg-text-secondary]">
              {{ friendUserState?.title ? friendUserState.title : currentState?.title || '' }}
            </span>
          </div>
        </div>

        <!-- 账号 -->
        <div class="flex flex-warp gap-2 items-center">
          <span
            v-if="showSkeleton"
            class="block h-14px w-120px rounded-4px bg-[--tjg-surface-subtle] animate-pulse motion-reduce:animate-none"
            data-testid="personal-info-skeleton-account"
            aria-hidden="true" />
          <template v-else>
            <span class="text-bold-style">{{ t('mobile_personal_info.account') }}:{{ userDetailInfo?.account }}</span>
            <span v-clickable v-if="isMyPage" @click="emit('open-qr-code')" class="p-[15px] -m-[15px]">
              <svg
                role="img"
                class="w-14px h-14px text-[--tjg-text-secondary]"
                :aria-label="t('mobile_personal_info.qr_code')">
                <use href="#saoma" />
              </svg>
            </span>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { UserInfoType, UserItem } from '@/services/types'

type UserStateLike = Pick<STO.UserState, 'title' | 'url'> | null | undefined

const props = defineProps<{
  userDetailInfo?: UserItem | UserInfoType | undefined
  friendUserState?: { title: string; url: string; id?: string } | null
  currentState?: UserStateLike
  isMyPage: boolean
  showSkeleton: boolean
  hasUserOnlineState: boolean
  isShow: boolean
  avatarUrl: string
}>()

const emit = defineEmits<{ 'open-qr-code': [] }>()

const { t } = useI18n()

const avatarBox = ref<HTMLElement | null>(null)
const infoBox = ref<HTMLElement | null>(null)

defineExpose({ avatarBox, infoBox })
</script>

<style lang="scss" scoped>
$font-family-system: -apple-system, BlinkMacSystemFont;
$font-family-windows: 'Segoe UI', 'Microsoft YaHei';
$font-family-sans: 'Helvetica Neue', Helvetica, Arial, sans-serif;

.text-bold-style {
  font-size: 14px;
  font-family: $font-family-system, $font-family-windows, $font-family-sans;
  color: var(--tjg-text-tertiary);
}
</style>
