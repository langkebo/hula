<template>
  <div class="one-time-invite-entry">
    <n-button text type="primary" size="small" data-test="open-one-time-invite" @click="show = true">
      {{ t('friend.one_time_invite.title') }}
    </n-button>

    <OneTimeInviteDialog v-model:show="show" @claimed="handleClaimed" />
  </div>
</template>

<script setup lang="ts">
import { NButton } from 'naive-ui'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import OneTimeInviteDialog from '@/components/friend/OneTimeInviteDialog.vue'

/**
 * 「一次性邀请」入口（F-5）。
 *
 * 自带对话框与领取后跳转，宿主组件只需挂一行 —— 避免把 20+ 行状态与跳转逻辑
 * 塞进已经超标的 `AddFriendPane.vue`（check:file-size 对基线内文件是零容忍增长）。
 *
 * 能力边界写在对话框里：能兑现「单次 + 带外 + 时效」，
 * 不能兑现「发起者不知道对方身份」（claim 后成员表仍暴露双方 MXID）。
 */
defineOptions({ name: 'OneTimeInviteEntry' })

const { t } = useI18n()
const show = ref(false)

/**
 * 领取成功后跳转会话。claim 已由服务端建房并邀请当前用户；
 * room_id 缺失时不跳转（跳到不存在的房间只会 notFound，比停在原地更糟）。
 */
async function handleClaimed(roomId: string | null): Promise<void> {
  if (!roomId) return
  const { default: router } = await import('@/router')
  void router.push({ name: 'message', params: { roomId } })
}
</script>
