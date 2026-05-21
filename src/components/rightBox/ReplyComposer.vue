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
          <template v-if="isTextReply(replyTo)">
            <span class="reply-text">{{ replyTo.contentPreview }}</span>
          </template>
          <template v-else-if="isImageReply(replyTo)">
            <div class="reply-image-preview">
              <img :src="replyTo.thumbnailUrl || replyTo.contentPreview" alt="回复预览图" />
              <span class="reply-type-label">{{ t('editor.image') }}</span>
            </div>
          </template>
          <template v-else-if="isVideoReply(replyTo)">
            <div class="reply-video-preview">
              <svg class="size-16px">
                <use href="#video"></use>
              </svg>
              <span class="reply-type-label">{{ t('message.video.unknown_video') }}</span>
            </div>
          </template>
          <template v-else-if="isFileReply(replyTo)">
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
import type { MsgEnum } from '@/enums'
import { MsgEnum as MsgEnumValue } from '@/enums'
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

const isTextReply = (replyTo: ReplyToInfo) => replyTo.msgType === MsgEnumValue.TEXT
const isImageReply = (replyTo: ReplyToInfo) => replyTo.msgType === MsgEnumValue.IMAGE
const isVideoReply = (replyTo: ReplyToInfo) => replyTo.msgType === MsgEnumValue.VIDEO
const isFileReply = (replyTo: ReplyToInfo) => replyTo.msgType === MsgEnumValue.FILE

const handleCancel = () => {
  emit('cancel')
}
</script>

<style scoped lang="scss">
.reply-composer {
  @apply flex items-start p-8px bg-[--hula-surface-subtle] rounded-8px mb-8px;
}

.reply-preview {
  @apply flex items-start gap-8px w-full;
}

.reply-line {
  @apply w-3px h-full min-h-40px rounded-2px bg-[--hula-color-primary-500];
}

.reply-content {
  @apply flex flex-col gap-4px flex-1 min-w-0;
}

.reply-header {
  @apply flex items-center gap-6px;
}

.reply-sender {
  @apply text-12px color-[--hula-color-primary-500] font-medium flex-1 truncate;
}

.reply-body {
  @apply text-12px color-[--hula-text-tertiary] truncate;
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
  @apply text-12px color-[--hula-text-tertiary];
}
</style>
