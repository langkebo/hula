<template>
  <main class="multi-msg" @click.stop="openMultiMsgWindow">
    <p class="text-(14px [--hula-text-primary]) select-none pb-12px truncate">{{ chatRecordTitle }}</p>

    <div class="max-h-90px overflow-hidden mx-6px select-none">
      <p v-for="content in processedContentList" class="text-(12px [--hula-text-tertiary]) leading-22px truncate">
        {{ content }}
      </p>
    </div>

    <p class="w-full h-1px bg-[--hula-border-default] my-6px select-none"></p>

    <p class="text-(10px [--hula-text-tertiary]) ml-4px select-none">
      {{ t('chat.multi_msg.view_forwarded', { count: msgIds.length }) }}
    </p>
  </main>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { MSG_REPLY_TEXT_MAP } from '@/common/message'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { EventEnum, MsgEnum, RoomTypeEnum } from '@/enums'
import { useWindow } from '@/hooks/useWindow'
import { useChatStore } from '@/stores/domains/chat/chat'
import { useGroupStore } from '@/stores/domains/chat/group'
import { useUserStore } from '@/stores/domains/user/user'
import { useGlobalStore } from '@/stores/domains/widget/global'
import type { MsgId } from '@/typings/global'
import { createLogger } from '@/utils/Logger'
import { getBodyContent } from '@/utils/messageBody'

const { t } = useI18n()

const logger = createLogger('ChatMultiMsg')
const { showFeedback } = useActionFeedback()

const { contentList, msgIds, msgId } = defineProps<{
  contentList: string[]
  msgIds: MsgId[]
  msgId?: string
}>()

const { createWebviewWindow, sendWindowPayload } = useWindow()
const globalStore = useGlobalStore()
const userStore = useUserStore()
const chatStore = useChatStore()
const groupStore = useGroupStore()

// 安全获取消息 body 内容
const getMsgBodyContent = (message: { message: { body: unknown } }): string => {
  return getBodyContent(message.message.body)
}

// 计算聊天记录标题
const chatRecordTitle = computed(() => {
  if (globalStore.currentSession?.type === RoomTypeEnum.GROUP) {
    return '群聊的聊天记录'
  } else {
    // 单聊显示好友名称和自己名称的拼接
    const friendName = globalStore.currentSession?.name || ''
    const myName = userStore.userInfo?.name || ''
    return `${friendName}和${myName}的聊天记录`
  }
})

// 根据消息类型处理显示内容
const processedContentList = computed(() => {
  // 如果没有msgIds，直接返回原contentList
  if (!msgIds || msgIds.length === 0) {
    return contentList
  }

  // 尝试通过msgIds获取完整消息信息
  return msgIds.map((msgId, index) => {
    // 尝试从当前聊天消息中找到对应消息
    const message = chatStore.currentMessageMap?.[msgId.msgId]

    if (message) {
      const userInfo = groupStore.getUserInfo(message.fromUser.uid)
      const userName = userInfo?.name || ''
      const msgType = message.message.type

      // 获取消息显示内容
      let content = ''

      // 排除不需要显示的消息类型
      if (msgType === MsgEnum.UNKNOWN || msgType === MsgEnum.RECALL || msgType === MsgEnum.BOT) {
        content = getMsgBodyContent(message)
      } else if (MSG_REPLY_TEXT_MAP[msgType]) {
        // 对于特殊类型消息，显示对应的文本提示
        content = MSG_REPLY_TEXT_MAP[msgType]
      } else {
        // 文本消息或其他消息
        content = getMsgBodyContent(message)
      }

      return userName + ': ' + content
    } else {
      // 如果找不到消息详情，使用原始contentList
      return contentList[index] || ''
    }
  })
})

const openMultiMsgWindow = async () => {
  const label = msgId ? `${EventEnum.MULTI_MSG}${msgId}` : EventEnum.MULTI_MSG
  try {
    // 创建窗口
    await createWebviewWindow('聊天记录', label, 600, 600, undefined, true, 600, 400, undefined, undefined, {
      key: label
    })

    // 向窗口发送消息数据
    await sendWindowPayload(label, { msgIds })
  } catch (e) {
    logger.error('创建聊天记录窗口失败:', e)
    showFeedback('打开聊天记录失败', 'error')
  }
}
</script>

<style scoped lang="scss">
.multi-msg {
  cursor: default;
  @apply: w-230px flex flex-col h-fit bg-[--hula-surface-panel-muted]
  border-(1px solid [--hula-border-default])
  hover:bg-[--hula-surface-panel] rounded-8px p-8px box-border
  custom-shadow transition-colors duration-200;
}
</style>
