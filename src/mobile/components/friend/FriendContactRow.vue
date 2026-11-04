<template>
  <img
    class="size-44px rounded-full object-cover grayscale border-(1px solid var(--avatar-border-color))"
    :class="{ 'grayscale-0': isOnline || isBot }"
    :src="AvatarUtils.getAvatarUrl(avatar || '', 96)"
    :alt="t('mobile_contact.avatar.user')"
    @error="($event.target as HTMLImageElement).src = '/logo.png'" />
  <div class="flex flex-col justify-between h-fit flex-1 truncate">
    <span class="text-[length:var(--tjg-font-size-base)] leading-tight flex-1 truncate">{{ name }}</span>
    <div class="text leading-tight text-[length:var(--tjg-font-size-sm)] flex-y-center gap-4px flex-1 truncate">
      [
      <template v-if="isBot">{{ t('mobile_contact.bot_tag') }}</template>
      <template v-else-if="state">
        <img class="size-12px rounded-50%" :src="state.url" :alt="stateTitle" />
        {{ stateTitle }}
      </template>
      <template v-else>
        <span
          class="inline-block size-8px rounded-full"
          :style="{ backgroundColor: isOnline ? 'var(--tjg-status-online)' : 'var(--tjg-status-offline)' }"></span>
        {{ isOnline ? t('mobile_contact.status.online') : t('mobile_contact.status.offline') }}
      </template>
      ]
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { OnlineEnum } from '@/enums'
import { useGroupStore } from '@/stores/domains/chat/group'
import { AvatarUtils } from '@/utils/AvatarUtils'

/**
 * 好友列表的一行内容（头像 + 名称 + 状态）。
 *
 * 「特殊关心」与「普通好友」两个分组此前各自抄了一份完全相同的 36 行
 * （头像灰阶、bot 标签、自定义状态、在线圆点四态），改一处要改两遍。
 * 这里只保留展示，点击/滑动/删除仍由外层负责 —— 两个分组的交互并不相同
 * （普通分组有 swipe-cell，特殊关心没有）。
 */
const props = defineProps<{
  /** 好友 MXID，用于取群组 store 里的资料 */
  userId: string
  /** 在线状态：决定头像灰阶与状态文案 */
  activeStatus?: number
  /** 机器人账号：显示 bot 标签而非在线状态 */
  isBot?: boolean
  /** 自定义状态：优先于在线状态展示 */
  state?: { url?: string; title?: string } | null
}>()

const { t } = useI18n()
const groupStore = useGroupStore()

const userInfo = computed(() => groupStore.getUserInfo(props.userId))
const name = computed(() => userInfo.value?.name ?? '')
const avatar = computed(() => userInfo.value?.avatar ?? '')
const isOnline = computed(() => props.activeStatus === OnlineEnum.ONLINE)

/** 状态标题走 i18n；未登记的状态名原样展示（与好友页原实现一致）。 */
const stateTitle = computed(() => {
  const title = props.state?.title
  if (!title) return ''
  const key = `auth.onlineStatus.states.${title}`
  const translated = t(key)
  return translated === key ? title : translated
})
</script>
