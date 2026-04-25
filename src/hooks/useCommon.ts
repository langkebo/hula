import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { info } from '@tauri-apps/plugin-log'
import GraphemeSplitter from 'grapheme-splitter'
import { MittEnum } from '@/enums'
import { useMessage } from '@/hooks/useMessage.ts'
import { useMitt } from '@/hooks/useMitt.ts'
import router from '@/router'
import { useChatStore } from '@/stores/domains/chat/chat'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { useUserStore } from '@/stores/domains/user/user'
import { matrixSessionService } from '@/services/matrix'
import { invokeWithErrorHandler } from '../utils/TauriInvokeHandler'
import type { SessionItem } from '@/stores/domains/chat/chat/session'
import { useEditorPaste } from './common/useEditorPaste'
import { getEditorRange, getMessageContentType, triggerInputEvent } from './common/editorDomBasics'
import { useEditorDom } from './common/useEditorDom'

const domParser = new DOMParser()

export interface SelectionRange {
  range: Range
  selection: Selection
}

/**
 * 返回dom指定id的文本
 * @param dom 指定dom
 * @param id 元素id
 */
export const parseInnerText = (dom: string, id: string): string | undefined => {
  const doc = domParser.parseFromString(dom, 'text/html')
  return doc.getElementById(id)?.innerText
}

/** 常用工具类 */
export const useCommon = () => {
  const globalStore = useGlobalStore()
  const chatStore = useChatStore()
  const userStore = useUserStore()
  const { handleMsgClick } = useMessage()
  /** 当前登录用户的uid */
  const userUid = computed(() => userStore.userInfo!.uid)
  /** 回复消息 */
  const reply = ref({
    avatar: '',
    accountName: '',
    content: '',
    key: '' as string | number,
    imgCount: 0
  })

  // 编辑器 DOM 构造（抽离到 useEditorDom）
  const { insertNode, insertNodeAtRange } = useEditorDom({ reply })

  // 粘贴/文件处理（抽离到 useEditorPaste）
  const { saveCacheFile, imgPaste, FileOrVideoPaste, handleConfirmFiles, processFiles, handlePaste } = useEditorPaste({
    userUid,
    triggerInputEvent,
    insertNode
  })

  /** 计算字符长度 */
  const countGraphemes = (value: string) => {
    const splitter = new GraphemeSplitter()
    return splitter.countGraphemes(value)
  }

  /**
   * 打开消息会话(右键发送消息功能)
   * @param uid 用户id
   * @param type
   */
  const openMsgSession = async (uid: string, type: number = 2) => {
    const label = WebviewWindow.getCurrent().label
    if (router.currentRoute.value.name !== '/message' && label === 'home') {
      router.push('/message')
    }

    info('打开消息会话')
    const res = await matrixSessionService.getSessionDetailWithFriends({ id: uid, roomType: type })
    if (!res) {
      window.$message.error('获取会话详情失败')
      return
    }
    try {
      await invokeWithErrorHandler('hide_contact_command', { data: { roomId: res.roomId, hide: false } })
    } catch {
      window.$message.error('显示会话失败')
    }

    const existingSession = chatStore.getSession(res.roomId)
    if (!existingSession) {
      chatStore.updateSessionLastActiveTime(res.roomId)
      await chatStore.getSessionList(true)
    }
    globalStore.updateCurrentSessionRoomId(res.roomId)

    useMitt.emit(MittEnum.LOCATE_SESSION, { roomId: res.roomId })
    handleMsgClick(res as unknown as SessionItem)
    useMitt.emit(MittEnum.TO_SEND_MSG, { url: 'message' })
  }

  return {
    imgPaste,
    getEditorRange,
    getMessageContentType,
    insertNode,
    triggerInputEvent,
    handlePaste,
    FileOrVideoPaste,
    handleConfirmFiles,
    countGraphemes,
    openMsgSession,
    insertNodeAtRange,
    reply,
    userUid,
    processFiles,
    saveCacheFile
  }
}
