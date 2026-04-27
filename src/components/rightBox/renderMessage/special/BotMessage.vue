<template>
  <!-- 消息为机器人消息时 -->
  <main class="w-full flex-center">
    <div
      class="chat-message-max-width bg-[--hula-settings-warning-bg] flex-center chat-bot-message-gap px-12px py-4px rounded-8px"
      style="border: 1px solid color-mix(in srgb, var(--hula-color-warning-400) 30%, transparent)">
      <n-avatar class="select-none" round :size="22" :src="getAvatarSrc(fromUserUid)" />
      <div
        v-for="(part, index) in parseMessage(body.content ?? '')"
        :key="index"
        class="text-(12px [--hula-color-warning-400]) leading-tight select-none cursor-default">
        <p v-if="part.type === 'text'">{{ part.text }}</p>
        <p v-else-if="part.type === 'bracket'" class="text-[--hula-color-primary-500] truncate max-w-20">
          {{ part.text }}
        </p>
        <p v-else-if="part.type === 'number'" class="text-[--hula-color-warning-500]">{{ part.text }}</p>
      </div>
      <img class="size-18px" src="/emoji/party-popper.webp" alt="" />
    </div>
  </main>
</template>

<script setup lang="ts">
import { useUserStore } from '@/stores/domains/user/user'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { useGroupStore } from '@/stores/domains/chat/group'

interface Props {
  body: { content?: string; [key: string]: unknown }
  fromUserUid: string
}

defineProps<Props>()

const userStore = useUserStore()
const groupStore = useGroupStore()

const userUid = computed(() => userStore.userInfo!.uid)

// 处理机器人消息内容，高亮[]包裹的内容
const parseMessage = (content: string) => {
  if (!content) return []

  // 安全的文本解析，无HTML注入风险
  return content
    .split(/(\[.*?\]|\d+)/)
    .map((part) => {
      if (part.match(/^\[.*\]$/)) {
        return { type: 'bracket', text: part.slice(1, -1) }
      } else if (part.match(/^\d+$/)) {
        return { type: 'number', text: part }
      }
      return { type: 'text', text: part }
    })
    .filter((part) => part.text)
}

// 获取用户头像
const getAvatarSrc = (uid: string) => {
  const avatar = uid === userUid.value ? userStore.userInfo!.avatar : groupStore.getUserInfo(uid)?.avatar
  return AvatarUtils.getAvatarUrl(avatar as string)
}
</script>
