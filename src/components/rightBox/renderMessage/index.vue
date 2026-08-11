<template>
  <component
    v-memo="[
      message.message.id,
      message.message.status,
      message.message.body?.translatedText?.text || '',
      uploadProgress,
      searchKeyword,
      historyMode
    ]"
    v-if="historyMode || !hasBubble(message.message.type)"
    :is="componentMap[message.message.type]"
    :body="message.message.body"
    :message-status="message.message.status"
    :upload-progress="uploadProgress"
    :from-user-uid="fromUser?.uid"
    :message="message.message"
    :data-message-id="message.message.id"
    :is-group="isGroup"
    :on-image-click="onImageClick"
    :onVideoClick="onVideoClick"
    :search-keyword="searchKeyword"
    :history-mode="historyMode" />

  <!-- 好友或者群聊的信息 -->
  <div
    v-else
    class="flex flex-col w-full msg-row"
    :class="{ 'justify-end': isMe }"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false">
    <div class="flex justify-center items-center">
      <n-checkbox
        v-model:checked="message.isCheck"
        v-if="chatStore.isMsgMultiChoose && chatStore.msgMultiChooseMode !== 'forward' && !isMultiSelectDisabled"
        class="mr-3 select-none"
        :focusable="false"
        @click.stop />
      <div class="flex items-start flex-1" :class="isMe ? 'flex-row-reverse' : ''">
        <!-- 回复消息提示的箭头 -->
        <svg
          v-if="activeReply === message.message.id"
          class="size-16px pt-4px color-[--tjg-text-tertiary]"
          :class="isMe ? 'ml-8px' : 'mr-8px'">
          <use :href="isMe ? `#corner-down-left` : `#corner-down-right`"></use>
        </svg>
        <!-- 头像 -->
        <n-popover
          :ref="(el: unknown) => setInfoPopoverRef(message.message.id, el)"
          @update:show="handlePopoverUpdate(message.message.id, $event)"
          trigger="click"
          :placement="isMe ? 'left' : 'right'"
          :show-arrow="false"
          style="padding: 0; background: var(--tjg-surface-panel)">
          <template #trigger>
            <ContextMenu
              @select="$event.click(message, 'Main')"
              :content="message"
              :menu="isGroup ? optionsList : void 0"
              :special-menu="report">
              <!-- 存在头像时候显示 -->
              <n-avatar
                round
                :size="34"
                @click="handleAvatarClick(senderUid, message.message.id)"
                @keydown.enter.prevent="handleAvatarClick(senderUid, message.message.id)"
                @keydown.space.prevent="handleAvatarClick(senderUid, message.message.id)"
                class="select-none"
                color="var(--tjg-surface-panel)"
                role="button"
                tabindex="0"
                aria-haspopup="dialog"
                :aria-label="senderDisplayName"
                :fallback-src="settingStore.themeContent === ThemeEnum.DARK ? '/logoL.png' : '/logoD.png'"
                :src="getAvatarSrc(senderUid)"
                :class="isMe ? '' : 'mr-10px'" />
            </ContextMenu>
          </template>
          <!-- 用户个人信息框 -->
          <InfoPopover v-if="selectKey === message.message.id && senderUid" :uid="senderUid" />
        </n-popover>

        <n-flex vertical :size="6" class="color-[--tjg-text-primary] flex-1" :class="isMe ? 'items-end mr-10px' : ''">
          <n-flex :size="6" align="center" :style="isMe ? 'flex-direction: row-reverse' : ''">
            <ContextMenu
              @select="$event.click(message, 'Main')"
              :content="message"
              :menu="isGroup ? optionsList : void 0"
              :special-menu="report">
              <n-flex
                :size="6"
                class="select-none cursor-default"
                align="center"
                v-if="isGroup"
                :style="isMe ? 'flex-direction: row-reverse' : ''">
                <!-- 用户名 -->
                <span
                  :class="[
                    'text-[length:var(--tjg-font-size-sm)] select-none color-[--tjg-text-tertiary] inline-block align-top',
                    !isMe ? 'cursor-pointer hover:color-[--tjg-color-primary-500] transition-colors' : ''
                  ]"
                  @click.stop="handleMentionUser">
                  {{ senderDisplayName }}
                </span>
              </n-flex>
            </ContextMenu>
            <!-- 群主 -->
            <div
              v-if="senderUid && groupStore.isCurrentLord(senderUid)"
              class="flex px-4px py-3px rounded-4px bg-[--tjg-color-danger-500]30 size-fit select-none">
              <span class="text-(9px [--tjg-color-danger-500])">{{ t('home.chat_sidebar.roles.owner') }}</span>
            </div>
            <!-- 管理员 -->
            <div
              v-if="senderUid && groupStore.isAdmin(senderUid)"
              class="flex px-4px py-3px rounded-4px bg-[--tjg-color-primary-100] size-fit select-none">
              <span class="text-(9px [--tjg-color-primary-500])">{{ t('home.chat_sidebar.roles.admin') }}</span>
            </div>
          </n-flex>
          <!--  气泡样式  -->
          <ContextMenu
            v-on-long-press="[(e) => handleLongPress(e, handleItemType(message.message.type)), longPressOption]"
            :content="message"
            @mousedown.right="recordSelectionBeforeContext"
            @contextmenu="handleContextMenuSelection"
            class="relative flex flex-col chat-message-max-width"
            :data-key="isMe ? `U${message.message.id}` : `Q${message.message.id}`"
            :class="[isMe ? 'items-end' : 'items-start', isMobileRef ? 'w-full max-w-full' : '']"
            :style="{ '--bubble-max-width': bubbleMaxWidth }"
            @select="$event.click(message, 'Main')"
            :menu="handleItemType(message.message.type)"
            :emoji="emojiList"
            :special-menu="specialMenuList(message.message.type)"
            @reply-emoji="handleEmojiSelect($event, message)"
            @click="handleMsgClick(message)">
            <BurnMessage
              v-if="message.message.burnAfterRead"
              :msg-id="message.message.id"
              :burn-after-read="message.message.burnAfterRead"
              :burn-duration="message.message.burnRemainingSeconds || 60"
              :remaining-seconds="message.message.burnRemainingSeconds"
              :is-burning="message.message.isBurning"
              :is-burned="message.message.isBurned"
              :room-id="message.message.roomId"
              :event-id="message.message.id"
              :sender-id="message.fromUser?.uid">
              <component
                v-memo="[
                  message.message.id,
                  message.message.status,
                  message.message.body?.translatedText?.text || '',
                  uploadProgress,
                  searchKeyword,
                  historyMode
                ]"
                :class="[
                  message.message.type === MsgEnum.VOICE ? 'select-none cursor-pointer' : 'select-text cursor-text',
                  !isSpecialMsgType(message.message.type) ? (isMe ? 'bubble-oneself' : 'bubble') : '',
                  {
                    active:
                      activeBubble === message.message.id &&
                      !isSpecialMsgType(message.message.type) &&
                      message.message.type !== MsgEnum.VOICE &&
                      !isMobileRef
                  }
                ]"
                :is="componentMap[message.message.type]"
                :body="message.message.body"
                :message-status="message.message.status"
                :upload-progress="uploadProgress"
                :from-user-uid="senderUid"
                :message="message.message"
                :data-message-id="message.message.id"
                :is-group="isGroup"
                :on-image-click="onImageClick"
                :onVideoClick="onVideoClick"
                :search-keyword="searchKeyword"
                :history-mode="historyMode" />
            </BurnMessage>
            <component
              v-else
              v-memo="[
                message.message.id,
                message.message.status,
                message.message.body?.translatedText?.text || '',
                uploadProgress,
                searchKeyword,
                historyMode
              ]"
              :class="[
                message.message.type === MsgEnum.VOICE ? 'select-none cursor-pointer' : 'select-text cursor-text',
                !isSpecialMsgType(message.message.type) ? (isMe ? 'bubble-oneself' : 'bubble') : '',
                {
                  active:
                    activeBubble === message.message.id &&
                    !isSpecialMsgType(message.message.type) &&
                    message.message.type !== MsgEnum.VOICE &&
                    !isMobileRef
                }
              ]"
              :is="componentMap[message.message.type]"
              :body="message.message.body"
              :message-status="message.message.status"
              :upload-progress="uploadProgress"
              :from-user-uid="senderUid"
              :message="message.message"
              :data-message-id="message.message.id"
              :is-group="isGroup"
              :on-image-click="onImageClick"
              :onVideoClick="onVideoClick"
              :search-keyword="searchKeyword"
              :history-mode="historyMode" />

            <MessageActionBar
              :visible="isHovered && !chatStore.isMsgMultiChoose"
              :is-me="isMe"
              :message-type="message.message.type"
              @react="showReactionPickerId = message.message.id"
              @reply="useMitt.emit(MittEnum.REPLY_MEG, message)"
              @forward="handleForwardAction(message)"
              @copy="handleCopyAction(message)"
              @delete="handleDeleteAction(message)" />

            <ReactionPicker
              v-if="showReactionPickerId === message.message.id"
              :room-id="message.message.roomId"
              :event-id="message.message.id"
              @reaction-added="showReactionPickerId = ''"
              @reaction-removed="showReactionPickerId = ''" />

            <!-- 显示翻译文本 -->
            <Transition name="fade-translate" appear mode="out-in">
              <div v-if="messageBody.translatedText" class="translated-text cursor-default flex flex-col">
                <n-flex align="center" justify="space-between" class="mb-6px">
                  <n-flex align="center" :size="4">
                    <span class="text-(12px --tjg-text-tertiary)">
                      {{ messageBody.translatedText.provider }}
                    </span>
                    <svg class="size-12px">
                      <use href="#success"></use>
                    </svg>

                    <n-tooltip trigger="hover">
                      <template #trigger>
                        <svg
                          class="pl-6px size-10px cursor-pointer hover:color-[--tjg-text-tertiary] hover:transition-colors"
                          @click="handleCopyTranslation(messageBody.translatedText.text)">
                          <use href="#copy"></use>
                        </svg>
                      </template>
                      <span>{{ t('message_container.copy_translation') }}</span>
                    </n-tooltip>
                  </n-flex>
                  <svg class="size-10px cursor-pointer" @click="messageBody.translatedText = null">
                    <use href="#close"></use>
                  </svg>
                </n-flex>
                <p class="select-text cursor-text">{{ messageBody.translatedText.text }}</p>
              </div>
            </Transition>
          </ContextMenu>

          <!-- 回复的内容 -->
          <n-flex
            align="center"
            :size="6"
            v-if="messageBody.reply"
            @click="emit('jump2Reply', messageBody.reply.id)"
            :class="
              isMobileRef
                ? 'bg-[--tjg-surface-app] text-[length:var(--tjg-font-size-md)]'
                : 'bg-[--tjg-surface-subtle] text-[length:var(--tjg-font-size-sm)]'
            "
            class="reply-bubble relative w-fit custom-shadow select-none chat-message-max-width"
            :style="{ 'max-width': bubbleMaxWidth }">
            <svg class="size-14px">
              <use href="#to-top"></use>
            </svg>
            <n-avatar
              class="reply-avatar"
              round
              :size="20"
              color="var(--tjg-surface-panel)"
              :fallback-src="settingStore.themeContent === ThemeEnum.DARK ? '/logoL.png' : '/logoD.png'"
              :src="getAvatarSrc(messageBody.reply.uid ?? '')" />
            <span>{{ `${messageBody.reply.username}: ` }}</span>
            <span class="content-span">
              {{ messageBody.reply.body }}
            </span>
            <div v-if="messageBody.reply.imgCount" class="reply-img-sub">
              {{ messageBody.reply.imgCount }}
            </div>
          </n-flex>

          <!-- 动态渲染所有回复表情反应 -->
          <div
            v-if="message.message"
            class="flex-y-center gap-6px flex-wrap w-270px"
            :class="{ 'justify-end': isSingleLineEmojis(message) }">
            <template v-for="emoji in emojiList" :key="emoji.value">
              <!-- 根据表情类型获取对应的计数属性名 -->
              <div class="flex-y-center" v-if="message && getEmojiCount(message, emoji.value) > 0">
                <div
                  class="emoji-reply-bubble"
                  :class="{ 'emoji-reply-bubble--active': hasUserMarkedEmoji(message, emoji.value) }"
                  @click.stop="message && cancelReplyEmoji(message, emoji.value)">
                  <img :title="emoji.title" class="size-18px" :src="emoji.url" :alt="emoji.title" />
                  <span
                    :class="
                      hasUserMarkedEmoji(message, emoji.value)
                        ? 'text-[--tjg-color-warning-400]'
                        : 'text-(12px [--tjg-text-inverse])'
                    ">
                    {{ message ? getEmojiCount(message, emoji.value) : 0 }}
                  </span>
                </div>
              </div>
            </template>
          </div>

          <!-- 线程指示器 -->
          <component
            :is="ThreadIndicator"
            v-if="!historyMode && !isThreadReply"
            :room-id="message.message.roomId"
            :event-id="message.message.id"
            @open-thread="handleOpenThread" />

          <TjgMessageMeta
            v-if="!historyMode"
            :message-id="message.message.id"
            :room-id="message.message.roomId"
            :sender-id="senderUid"
            :timestamp="message.message.sendTime"
            :status="message.message.status"
            :is-me="isMe"
            :is-last-message="isLastRoomMessage"
            @retry="handleRetry(message)" />
        </n-flex>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { vOnLongPress } from '@vueuse/components'
import type { Component } from 'vue'
import { useI18n } from 'vue-i18n'
import BurnMessage from '@/components/burn/BurnMessage.vue'
import ThreadIndicatorDesktop from '@/components/thread/ThreadIndicator.vue'
import { chatMainInjectionKey, useChatMain } from '@/composables/chat/useChatMain'
import { useMitt } from '@/composables/common/useMitt'
import { usePopover } from '@/composables/common/usePopover'
import { MittEnum, MsgEnum, ThemeEnum } from '@/enums'
import ThreadIndicatorMobile from '@/mobile/components/thread/ThreadIndicator.vue'
import router from '@/router'
import { matrixThreadService } from '@/services/matrix/messaging/MatrixThreadService'
import type { MessageBody, MessageType } from '@/stores/domains/chat/chat'
import { useChatStore } from '@/stores/domains/chat/chat'
import { useGroupStore } from '@/stores/domains/chat/group'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { isMessageMultiSelectEnabled } from '@/utils/MessageSelect'
import { isMobile } from '@/utils/PlatformConstants'
import Emoji from './Emoji.vue'
import Image from './Image.vue'
import MessageActionBar from './MessageActionBar.vue'
import ReactionPicker from './ReactionPicker.vue'
import RecallMessage from './special/RecallMessage.vue'
import SystemMessage from './special/SystemMessage.vue'
import Text from './Text.vue'
import TjgMessageMeta from './TjgMessageMeta.vue'
import { useMessageActions } from './useMessageActions'
import { useMessageContextMenu } from './useMessageContextMenu'
import { useMessageUser } from './useMessageUser'

const Announcement = defineAsyncComponent(() => import('./Announcement.vue'))
const AudioCall = defineAsyncComponent(() => import('./AudioCall.vue'))
const Beacon = defineAsyncComponent(() => import('./Beacon.vue'))
const File = defineAsyncComponent(() => import('./File.vue'))
const LinkPreview = defineAsyncComponent(() => import('./LinkPreview.vue'))
const Location = defineAsyncComponent(() => import('./Location.vue'))
const MergeMessage = defineAsyncComponent(() => import('./MergeMessage.vue'))
const BotMessage = defineAsyncComponent(() => import('./special/BotMessage.vue'))
const Video = defineAsyncComponent(() => import('./Video.vue'))
const VideoCall = defineAsyncComponent(() => import('./VideoCall.vue'))
const Voice = defineAsyncComponent(() => import('./Voice.vue'))

type ShowablePopover = {
  setShow: (show: boolean) => void
}

const isShowablePopover = (value: unknown): value is ShowablePopover => {
  return typeof value === 'object' && value !== null && 'setShow' in value && typeof value.setShow === 'function'
}

const ThreadIndicator = computed(() => (isMobile() ? ThreadIndicatorMobile : ThreadIndicatorDesktop))

const isMobileRef = computed(() => isMobile())

const props = withDefaults(
  defineProps<{
    message: MessageType
    uploadProgress?: number
    isGroup: boolean
    fromUser?: {
      uid?: string
    }
    onImageClick?: (url: string) => void
    onVideoClick?: (url: string) => void
    searchKeyword?: string
    historyMode?: boolean
  }>(),
  {
    historyMode: false
  }
)

const emit = defineEmits(['jump2Reply'])
const { t } = useI18n()
const globalStore = useGlobalStore()
const senderUid = computed(() => props.fromUser?.uid || props.message?.fromUser?.uid || '')

const messageBody = computed((): MessageBody => {
  const body = props.message?.message?.body
  if (typeof body === 'object' && body !== null) {
    return body as MessageBody
  }
  return { content: String(body || '') }
})

const selectKey = ref(senderUid.value || props.message.message.id)
const infoPopoverRefs = reactive<Record<string, ShowablePopover | null>>({})
const { handlePopoverUpdate } = usePopover(selectKey, 'image-chat-main')
const setInfoPopoverRef = (messageId: string, el: unknown) => {
  infoPopoverRefs[messageId] = isShowablePopover(el) ? el : null
}

const messageUserInput: Parameters<typeof useMessageUser>[0] = {
  message: props.message,
  fromUser: props.fromUser,
  isGroup: props.isGroup
}

const { isMe, getAvatarSrc, senderDisplayName, handleMentionUser, handleAvatarClick } = useMessageUser(
  messageUserInput,
  {
    selectKey
  }
)

const activeReply = ref<string>('')
const settingStore = useSettingStore()
const injectedChatMain = inject(chatMainInjectionKey, null)
const chatMainApi = injectedChatMain ?? useChatMain()
const {
  optionsList,
  report,
  activeBubble,
  handleItemType,
  emojiList,
  specialMenuList,
  handleMsgClick,
  handleCopy,
  tips,
  modalShow,
  delIndex,
  delRoomId
} = chatMainApi
const groupStore = useGroupStore()
const chatStore = useChatStore()
const isMultiSelectDisabled = computed(() => !isMessageMultiSelectEnabled(props.message.message.type))
const isLastRoomMessage = computed(() => {
  const lastMessage = chatStore.chatMessageList.at(-1)
  return lastMessage?.message.id === props.message.message.id
})
const bubbleMaxWidth = computed(() => {
  if (isMobile()) {
    return '84%'
  }
  return props.isGroup ? '32vw' : '50vw'
})

const {
  handleRetry,
  handleCopyTranslation,
  isSingleLineEmojis,
  cancelReplyEmoji,
  getEmojiCount,
  hasUserMarkedEmoji,
  handleEmojiSelect
} = useMessageActions({ isMe, emojiList })

const isHovered = ref(false)
const showReactionPickerId = ref('')

const { recordSelectionBeforeContext, handleContextMenuSelection, longPressOption, handleLongPress } =
  useMessageContextMenu({ activeBubble })

const handleForwardAction = (item: MessageType) => {
  if (!item?.message?.id) return
  const target = chatStore.getMessage(item.message.id)
  if (!target) return
  chatStore.clearMsgCheck()
  target.isCheck = true
  chatStore.setMsgMultiChoose(true, 'forward')
  nextTick(() => {
    useMitt.emit(MittEnum.MSG_MULTI_CHOOSE, {
      action: 'open-forward',
      mergeType: 'single' as const
    })
  })
}

const handleCopyAction = (item: MessageType) => {
  handleCopy(item.message.body.content || item.message.body.url || '', true, item.message.id)
}

const handleDeleteAction = (item: MessageType) => {
  tips.value = t('home.chat_main.delete.confirm')
  modalShow.value = true
  delIndex.value = item.message.id
  delRoomId.value = item.message.roomId
}

const { isBodyInThread } = matrixThreadService

const isThreadReply = computed(() => {
  const msg = props.message?.message
  if (!msg) return false
  return isBodyInThread(msg.body)
})

const handleOpenThread = (eventId: string) => {
  if (isMobile()) {
    const roomId = props.message?.message?.roomId || globalStore.currentSessionRoomId
    router.push(`/mobile/chatRoom/thread/${roomId}/${eventId}`)
  } else {
    useMitt.emit(MittEnum.OPEN_THREAD, { eventId, roomId: props.message?.message?.roomId })
  }
}

defineExpose({ isThreadReply, handleOpenThread })

const componentMap: Partial<Record<MsgEnum, Component>> = {
  [MsgEnum.TEXT]: Text,
  [MsgEnum.IMAGE]: Image,
  [MsgEnum.EMOJI]: Emoji,
  [MsgEnum.VIDEO]: Video,
  [MsgEnum.VOICE]: Voice,
  [MsgEnum.FILE]: File,
  [MsgEnum.NOTICE]: Announcement,
  [MsgEnum.VIDEO_CALL]: VideoCall,
  [MsgEnum.AUDIO_CALL]: AudioCall,
  [MsgEnum.SYSTEM]: SystemMessage,
  [MsgEnum.RECALL]: RecallMessage,
  [MsgEnum.BOT]: BotMessage,
  [MsgEnum.MERGE]: MergeMessage,
  [MsgEnum.LOCATION]: Location,
  [MsgEnum.BEACON]: Beacon,
  [MsgEnum.LINK_PREVIEW]: LinkPreview
}

const isSpecialMsgType = (type: number): boolean => {
  return (
    type === MsgEnum.IMAGE ||
    type === MsgEnum.EMOJI ||
    type === MsgEnum.NOTICE ||
    type === MsgEnum.VIDEO ||
    type === MsgEnum.FILE ||
    type === MsgEnum.MERGE ||
    type === MsgEnum.LOCATION
  )
}

const hasBubble = (type: MsgEnum) => {
  return !(type === MsgEnum.RECALL || type === MsgEnum.SYSTEM || type === MsgEnum.BOT)
}

useMitt.on(`${MittEnum.INFO_POPOVER}-Main`, (event: { uid: string }) => {
  const messageId = event.uid
  selectKey.value = messageId
  const popover = infoPopoverRefs[messageId]
  if (popover) {
    popover.setShow(true)
    handlePopoverUpdate(messageId)
  }
})
</script>
<style scoped lang="scss">
@use '@/styles/scss/render-message';
</style>
