import { nextTick, onMounted, type Ref } from 'vue'
import { MittEnum, MsgEnum } from '@/enums'
import { useMitt } from '@/hooks/useMitt.ts'
import type { MessageType } from '@/stores/domains/chat/chat'
import { createLogger } from '@/utils/Logger'
import { getReplyContent } from '@/utils/MessageReply.ts'

const logger = createLogger('MsgInputEvents')

interface ReplyState {
  avatar: string
  accountName: string
  content: string
  key: string | number
  imgCount: number
}

interface GroupStoreLike {
  getUserInfo: (uid: string) => { name?: string; avatar?: string } | null
}

export interface UseMsgInputEventsOptions {
  messageInputDom: Ref<HTMLElement>
  msgInput: Ref<string>
  reply: Ref<ReplyState>
  isChinese: Ref<boolean>
  aitKey: Ref<string>
  aiKeyword: Ref<string>
  groupStore: GroupStoreLike
  focusOn: (el: HTMLElement) => void
  insertNode: (type: MsgEnum, payload: Record<string, unknown>, container: HTMLElement) => void
  triggerInputEvent: (el: HTMLElement) => void
  getEditorRange: () => { range: Range; selection: Selection } | null
  updateSelectionRange: (snapshot: { range: Range; selection: Selection } | null) => void
}

/**
 * 消息输入框的生命周期事件：RE_EDIT 重新编辑、REPLY_MEG 引用回复、
 * IME 拼音 composition 监听。
 *
 * 从 useMsgInput 抽出。onMounted 内的整块监听集中管理，行为与原实现一致。
 */
export const useMsgInputEvents = ({
  messageInputDom,
  msgInput,
  reply,
  isChinese,
  aitKey,
  aiKeyword,
  groupStore,
  focusOn,
  insertNode,
  triggerInputEvent,
  getEditorRange,
  updateSelectionRange
}: UseMsgInputEventsOptions) => {
  const onReEdit = async (event: string) => {
    messageInputDom.value.focus()
    await nextTick(() => {
      messageInputDom.value.innerHTML = event
      msgInput.value = event
      const selection = window.getSelection()
      const range = document.createRange()
      range.selectNodeContents(messageInputDom.value)
      range.collapse(false)
      selection?.removeAllRanges()
      selection?.addRange(range)
    })
  }

  const onReplyMeg = (event: MessageType) => {
    if (!messageInputDom.value) return

    try {
      const userInfo = groupStore.getUserInfo(event.fromUser.uid)
      if (!userInfo) return
      const accountName = userInfo.name ?? ''
      const avatar = userInfo.avatar ?? ''

      focusOn(messageInputDom.value)

      const existingReplyDiv = document.getElementById('replyDiv')
      existingReplyDiv?.remove()

      reply.value = { avatar: '', imgCount: 0, accountName: '', content: '', key: 0 }

      const content = getReplyContent(event.message)
      reply.value = {
        imgCount: 0,
        avatar,
        accountName,
        content,
        key: event.message.id
      }

      nextTick().then(() => {
        try {
          focusOn(messageInputDom.value)
          insertNode(MsgEnum.REPLY, { avatar, accountName, content: reply.value.content }, {} as HTMLElement)
          updateSelectionRange(getEditorRange())
          focusOn(messageInputDom.value)
          triggerInputEvent(messageInputDom.value)
        } catch (err) {
          logger.error('插入回复框时错误:', err)
        }
      })
    } catch (err) {
      logger.error('回复_meg处理程序错误:', err)
    }
  }

  const onCompositionStart = () => {
    isChinese.value = true
  }

  const onCompositionEnd = (e: CompositionEvent) => {
    setTimeout(() => {
      isChinese.value = false
      aitKey.value = e.data
      aiKeyword.value = e.data
    }, 10)
  }

  onMounted(() => {
    useMitt.on(MittEnum.RE_EDIT, onReEdit as (event: unknown) => void)
    if (messageInputDom.value) {
      messageInputDom.value.addEventListener('compositionstart', onCompositionStart)
      messageInputDom.value.addEventListener('compositionend', onCompositionEnd as EventListener)
    }
    useMitt.on(MittEnum.REPLY_MEG, onReplyMeg as (event: unknown) => void)
  })

  return { onReEdit, onReplyMeg, onCompositionStart, onCompositionEnd }
}
