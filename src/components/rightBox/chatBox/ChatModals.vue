<template>
  <!-- 弹出框 -->
  <n-modal v-model:show="modalShow" class="w-350px border-rd-8px">
    <div class="bg-[--tjg-surface-panel] w-360px h-full p-6px box-border flex flex-col">
      <MacCloseButton v-if="isMac()" class="z-999 absolute left-6px" @click="modalShow = false" />

      <svg v-if="isWindows()" @click="modalShow = false" class="w-12px h-12px ml-a cursor-pointer select-none">
        <use href="#close"></use>
      </svg>
      <div class="flex flex-col gap-30px p-[22px_10px_10px_22px] select-none">
        <span class="text-[var(--text-sm)]">{{ tips }}</span>

        <n-flex justify="end">
          <n-button @click="$emit('confirm')" class="w-78px" type="primary">
            {{ t('home.chat_main.confirm') }}
          </n-button>
          <n-button @click="modalShow = false" class="w-78px" secondary>{{ t('home.chat_main.cancel') }}</n-button>
        </n-flex>
      </div>
    </div>
  </n-modal>

  <n-modal v-model:show="groupNicknameModalVisible" class="w-360px border-rd-8px" :mask-closable="false">
    <div class="bg-[--tjg-surface-panel] w-360px h-full p-6px box-border flex flex-col">
      <MacCloseButton v-if="isMac()" class="z-999 absolute left-6px" @click="groupNicknameModalVisible = false" />

      <svg
        v-if="isWindows()"
        @click="groupNicknameModalVisible = false"
        class="w-12px h-12px ml-a cursor-pointer select-none">
        <use href="#close"></use>
      </svg>
      <div class="flex flex-col gap-20px p-[22px_10px_10px_22px] select-none">
        <span class="text-[var(--text-base)] text-[--tjg-text-primary] font-500">
          {{ t('home.chat_main.group_nickname.title') }}
        </span>
        <n-input
          v-model:value="groupNicknameValue"
          :placeholder="t('home.chat_main.group_nickname.placeholder')"
          :maxlength="12"
          class="border-(1px solid color-mix(in srgb, var(--tjg-text-tertiary) 80%, transparent))"
          :disabled="groupNicknameSubmitting"
          clearable
          @keydown.enter.prevent="$emit('groupNicknameConfirm')" />
        <p v-if="groupNicknameError" class="text-[var(--text-sm)] text-[--tjg-color-danger-500]">
          {{ groupNicknameError }}
        </p>
        <n-flex justify="end" :size="12">
          <n-button @click="groupNicknameModalVisible = false" :disabled="groupNicknameSubmitting" secondary>
            {{ t('home.chat_main.cancel') }}
          </n-button>
          <n-button type="primary" :loading="groupNicknameSubmitting" @click="$emit('groupNicknameConfirm')">
            {{ t('home.chat_main.confirm') }}
          </n-button>
        </n-flex>
      </div>
    </div>
  </n-modal>

  <!-- 线程面板 -->
  <ThreadPanel
    v-model:show="threadPanelVisible"
    :original-message="threadOriginalMessage ?? undefined"
    :thread-id="activeThreadId" />

  <!-- 事件举报对话框 -->
  <EventReportDialog
    v-model:show="eventReportVisible"
    :event-id="eventReportData.eventId"
    :room-id="eventReportData.roomId"
    :event-content="eventReportData.eventContent" />

  <!-- 私密模式确认对话框 -->
  <n-modal v-model:show="showPrivateConfirm" class="w-360px border-rd-8px">
    <div class="bg-[--tjg-surface-panel] w-360px p-24px box-border flex flex-col gap-16px">
      <span class="text-[var(--text-base)] text-[--tjg-text-primary] font-500">进入私密模式</span>
      <div class="flex flex-col gap-8px" data-testid="private-confirm-features">
        <div
          v-for="feature in privateModeFeatures"
          :key="feature.title"
          class="flex items-center gap-8px text-[var(--text-sm)] text-[--tjg-text-secondary]">
          <svg class="size-16px flex-shrink-0" :class="feature.iconClass"><use :href="feature.icon"></use></svg>
          <span>{{ feature.title }}：{{ feature.description }}</span>
        </div>
      </div>
      <p class="text-[var(--text-sm)] text-[--tjg-text-tertiary]">确定要进入私密模式吗？</p>
      <n-flex justify="end" :size="12">
        <n-button @click="$emit('cancelPrivateMode')" secondary>取消</n-button>
        <n-button type="primary" @click="$emit('confirmPrivateMode')">确认</n-button>
      </n-flex>
    </div>
  </n-modal>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

// 异步加载非首屏或重型组件
const ThreadPanel = defineAsyncComponent(() => import('@/components/thread/ThreadPanel.vue'))
const EventReportDialog = defineAsyncComponent(() => import('@/components/moderation/EventReportDialog.vue'))

import MacCloseButton from '@/components/common/MacCloseButton.vue'
import { isMac, isWindows } from '@/utils/PlatformConstants'

const { t } = useI18n()

interface PrivateModeFeature {
  title: string
  description: string
  icon: string
  iconClass: string
}

interface ThreadOriginalMessage {
  id: string
  senderId: string
  senderName: string
  senderAvatar: string
  content: string
  timestamp: number
}

const modalShow = defineModel<boolean>('modalShow', { default: false })
const groupNicknameModalVisible = defineModel<boolean>('groupNicknameModalVisible', { default: false })
const groupNicknameValue = defineModel<string>('groupNicknameValue', { default: '' })
const threadPanelVisible = defineModel<boolean>('threadPanelVisible', { default: false })
const eventReportVisible = defineModel<boolean>('eventReportVisible', { default: false })
const showPrivateConfirm = defineModel<boolean>('showPrivateConfirm', { default: false })

defineProps<{
  tips: string
  groupNicknameError: string
  groupNicknameSubmitting: boolean
  threadOriginalMessage: ThreadOriginalMessage | null
  activeThreadId: string
  eventReportData: { eventId: string; roomId: string; eventContent: string }
  privateModeFeatures: PrivateModeFeature[]
}>()

defineEmits<{
  confirm: []
  groupNicknameConfirm: []
  cancelPrivateMode: []
  confirmPrivateMode: []
}>()
</script>
