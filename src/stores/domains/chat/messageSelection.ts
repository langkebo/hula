import { defineStore } from 'pinia'
import { ref } from 'vue'
import { StoresEnum } from '@/enums'
import type { CustomForwardTask, MessageType } from './chat/types'

export const useMessageSelectionStore = defineStore(StoresEnum.MESSAGE_SELECTION, () => {
  const isMsgMultiChoose = ref<boolean>(false)
  const msgMultiChooseMode = ref<'normal' | 'forward'>('normal')
  const customForwardTask = ref<CustomForwardTask | null>(null)
  const currentMsgReply = ref<Partial<MessageType>>({})

  const setMsgMultiChoose = (flag: boolean, mode: 'normal' | 'forward' = 'normal') => {
    isMsgMultiChoose.value = flag
    msgMultiChooseMode.value = flag ? mode : 'normal'
  }

  const setCustomForwardTask = (task: CustomForwardTask | null) => {
    customForwardTask.value = task
  }

  const clearMsgCheck = (chatMessageList: MessageType[]) => {
    chatMessageList.forEach((msg) => (msg.isCheck = false))
  }

  return {
    isMsgMultiChoose,
    msgMultiChooseMode,
    customForwardTask,
    currentMsgReply,
    setMsgMultiChoose,
    setCustomForwardTask,
    clearMsgCheck
  }
})
