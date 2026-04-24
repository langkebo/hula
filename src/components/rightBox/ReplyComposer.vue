<template>
  <div v-if="replyTo" class="reply-composer">
    <div class="reply-preview">
      <div class="reply-line"></div>
      <div class="reply-content">
        <div class="reply-header">
          <n-avatar round :size="20" :src="getAvatarUrl(replyTo.senderAvatar)" :fallback-src="defaultAvatar" />
          <span class="reply-sender">{{ replyTo.senderName }}</span>
          <n-button text size="tiny" @click="handleCancel">
            <template #icon>
              <svg class="size-14px">
                <use href="#close"></use>
              </svg>
            </template>
          </n-button>
        </div>
        <div class="reply-body">
          <template v-if="replyTo.msgType === MsgEnum.TEXT">
            <span class="reply-text">{{ replyTo.contentPreview }}</span>
          </template>
          <template v-else-if="replyTo.msgType === MsgEnum.IMAGE">
            <div class="reply-image-preview">
              <img :src="replyTo.thumbnailUrl || replyTo.contentPreview" alt="" />
              <span class="reply-type-label">{{ t('message.image') }}</span>
            </div>
          </template>
          <template v-else-if="replyTo.msgType === MsgEnum.VIDEO">
            <div class="reply-video-preview">
              <svg class="size-16px">
                <use href="#video"></use>
              </svg>
              <span class="reply-type-label">{{ t('message.video') }}</span>
            </div>
          </template>
          <template v-else-if="replyTo.msgType === MsgEnum.FILE">
            <div class="reply-file-preview">
              <svg class="size-16px">
                <use href="#file2"></use>
              </svg>
              <span class="reply-type-label">{{ replyTo.contentPreview }}</span>
            </div>
          </template>
          <template v-else>
            <span class="reply-text">{{ replyTo.contentPreview }}</span>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { MsgEnum } from '@/enums'
import { AvatarUtils } from '@/utils/AvatarUtils'

export interface ReplyToInfo {
  eventId: string
  senderId: string
  senderName: string
  senderAvatar?: string
  msgType: MsgEnum
  contentPreview: string
  thumbnailUrl?: string
}

defineProps<{
  replyTo: ReplyToInfo | null
}>()

const emit = defineEmits<(e: 'cancel') => void>()

const { t } = useI18n()
const defaultAvatar = computed(() => '/logoD.png')

const getAvatarUrl = (avatar?: string) => {
  return AvatarUtils.getAvatarUrl(avatar || '')
}

const handleCancel = () => {
  emit('cancel')
}
</script>

<style scoped lang="scss">
.reply-composer {
  @apply flex items-start p-8px bg-[--right-chat-reply-color] rounded-8px mb-8px;
}

.reply-preview {
  @apply flex items-start gap-8px w-full;
}

.reply-line {
  @apply w-3px h-full min-h-40px rounded-2px bg-[--color-primary];
}

.reply-content {
  @apply flex flex-col gap-4px flex-1 min-w-0;
}

.reply-header {
  @apply flex items-center gap-6px;
}

.reply-sender {
  @apply text-12px color-[--color-primary] font-medium flex-1 truncate;
}

.reply-body {
  @apply text-12px color-[--color-text-tertiary] truncate;
}

.reply-text {
  @apply truncate;
}

.reply-image-preview {
  @apply flex items-center gap-6px;

  img {
    @apply w-40px h-40px object-cover rounded-4px;
  }
}

.reply-video-preview,
.reply-file-preview {
  @apply flex items-center gap-6px;
}

.reply-type-label {
  @apply text-12px color-[--color-text-tertiary];
}
</style>
