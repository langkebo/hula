<template>
  <!-- 消息为机器人消息时 -->
  <main class="w-full flex-center">
    <div
      class="chat-message-max-width bg-[--tjg-settings-warning-bg] flex-center chat-bot-message-gap px-12px py-4px rounded-8px bot-message-border">
      <n-avatar class="select-none" round :size="22" :src="resolveAvatarUrl(fromUserUid)" />
      <div
        v-for="(part, index) in parseMessage(body.content ?? '')"
        :key="`part-${index}-${part.type}`"
        class="text-(12px [--tjg-color-warning-400]) leading-tight select-none cursor-default">
        <p v-if="part.type === 'text'">{{ part.text }}</p>
        <p v-else-if="part.type === 'bracket'" class="text-[--tjg-color-primary-500] truncate max-w-20">
          {{ part.text }}
        </p>
        <p v-else-if="part.type === 'number'" class="text-[--tjg-color-warning-500]">{{ part.text }}</p>
      </div>
      <img class="size-18px" src="/emoji/party-popper.webp" :alt="t('common.celebration')" />
    </div>
  </main>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useUserAvatar } from '@/composables/user/useUserAvatar'

interface Props {
  body: { content?: string; [key: string]: unknown }
  fromUserUid: string
}

defineProps<Props>()

const { t } = useI18n()
const { resolveAvatarUrl } = useUserAvatar()

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
</script>

<style scoped lang="scss">
/* 机器人消息气泡描边（原先为内联 style，迁移后需在此保留等价规则） */
.bot-message-border {
  border: 1px solid color-mix(in srgb, var(--tjg-color-warning-400) 30%, transparent);
}
</style>
