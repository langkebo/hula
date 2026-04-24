import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { info } from '@tauri-apps/plugin-log'
import GraphemeSplitter from 'grapheme-splitter'
import { MittEnum, MsgEnum } from '@/enums'
import { useMessage } from '@/hooks/useMessage.ts'
import { useMitt } from '@/hooks/useMitt.ts'
import router from '@/router'
import { useChatStore } from '@/stores/domains/chat/chat'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { useUserStore } from '@/stores/domains/user/user'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { removeTag } from '@/utils/Formatting'
import { matrixSessionService } from '@/services/matrix'
import { isMobile } from '@/utils/PlatformConstants'
import { invokeWithErrorHandler } from '../utils/TauriInvokeHandler'
import { createLogger } from '@/utils/Logger'
import type { SessionItem } from '@/stores/domains/chat/chat/session'
import { useEditorPaste } from './common/useEditorPaste'
import { getEditorRange, getMessageContentType, triggerInputEvent } from './common/editorDomBasics'

interface AitMentionData {
  name?: string
  text?: string
  label?: string
  uid?: string
}

interface ReplyData {
  accountName: string
  content: string
  avatar: string
  name?: string
}

type InsertNodeData = AitMentionData | ReplyData | string
const _logger = createLogger('Common')

export interface SelectionRange {
  range: Range
  selection: Selection
}
const domParser = new DOMParser()

const REPLY_NODE_ID = 'replyDiv'

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
  /**
   * 判断 URL 是否安全
   * @param url URL 字符串
   * @returns 是否安全
   */
  const isSafeUrl = (url: string) => {
    // 只允许 http/https 协议，且不能包含 javascript: 或 data:
    return /^(https?:\/\/|\/)/.test(url) && !/^javascript:/i.test(url) && !/^data:/i.test(url)
  }

  /**
   *  将指定节点插入到光标位置
   * @param { MsgEnum } type 插入的类型
   * @param dom dom节点
   * @param target 目标节点
   */
  const insertNode = (type: MsgEnum, dom: InsertNodeData, target: HTMLElement) => {
    const sr = getEditorRange()!
    if (!sr) return

    insertNodeAtRange(type, dom, target, sr)
  }

  /**
   *  将指定节点插入到光标位置
   * @param { MsgEnum } type 插入的类型
   * @param dom dom节点
   * @param target 目标节点
   * @param sr 选区
   */
  const insertNodeAtRange = (type: MsgEnum, dom: InsertNodeData, _target: HTMLElement, sr: SelectionRange) => {
    const { range, selection } = sr

    // 删除选中的内容
    range?.deleteContents()

    // 将节点插入范围最前面添加节点
    if (type === MsgEnum.AIT) {
      const domObj = dom as AitMentionData
      const mentionText =
        typeof dom === 'object' && dom !== null ? domObj.name || domObj.text || domObj.label || '' : dom || ''
      const mentionUid = typeof dom === 'object' && dom !== null ? domObj.uid : undefined
      // 创建一个span标签节点
      const spanNode = document.createElement('span')
      spanNode.id = 'aitSpan' // 设置id为aitSpan
      spanNode.contentEditable = 'false' // 设置为不可编辑
      spanNode.classList.add('text-#13987f')
      spanNode.classList.add('select-none')
      spanNode.classList.add('cursor-default')
      spanNode.style.userSelect = 'text' // 允许全选选中
      if (mentionUid) {
        spanNode.dataset.aitUid = String(mentionUid)
      }
      spanNode.appendChild(document.createTextNode(`@${mentionText}`))
      // 将span标签插入到光标位置
      range?.insertNode(spanNode)
      // 将光标折叠到Range的末尾(true表示折叠到Range的开始位置,false表示折叠到Range的末尾)
      range?.collapse(false)
      // 创建一个空格文本节点
      const spaceNode = document.createTextNode('\u00A0')
      // 将空格文本节点插入到光标位置
      range?.insertNode(spaceNode)
    } else if (type === MsgEnum.TEXT) {
      range?.insertNode(document.createTextNode(String(dom)))
    } else if (type === MsgEnum.REPLY) {
      // 获取消息输入框元素
      const inputElement = document.getElementById('message-input')
      if (!inputElement) return

      // 确保输入框获得焦点
      inputElement.focus()

      // 创建回复节点
      const replyNode = createReplyDom(dom as ReplyData)

      // 如果已经存在回复框，则替换它
      const preReplyNode = document.getElementById('replyDiv')
      if (preReplyNode) {
        preReplyNode.replaceWith(replyNode)
      } else {
        // 检查输入框是否有内容
        const hasChildNodes =
          inputElement.childNodes.length > 0 &&
          !(
            inputElement.childNodes.length === 1 &&
            inputElement.childNodes[0].nodeType === Node.TEXT_NODE &&
            !inputElement.childNodes[0].textContent?.trim()
          )
        // 插入回复节点
        inputElement.insertBefore(replyNode, inputElement.firstChild)

        // 如果输入框已有内容，需要确保光标位置正确
        if (hasChildNodes) {
          // 获取回复框后的第一个文本节点
          let nextNode = replyNode.nextSibling
          let position = 0

          // 将选择范围设置在回复框之后
          if (nextNode) {
            if (nextNode.nodeType === Node.TEXT_NODE) {
              position = 0 // 文本节点的开始位置
            } else {
              // 如果不是文本节点，找到下一个文本节点
              while (nextNode && nextNode.nodeType !== Node.TEXT_NODE) {
                nextNode = nextNode.nextSibling
              }
              if (!nextNode) {
                // 如果没有找到文本节点，创建一个
                nextNode = document.createTextNode(' ')
                inputElement.appendChild(nextNode)
              }
              position = 0
            }

            // 设置选区在回复框之后
            selection.removeAllRanges()
            const rangeAfter = document.createRange()
            rangeAfter.setStart(nextNode, position)
            rangeAfter.setEnd(nextNode, position)
            selection.addRange(rangeAfter)
          } else {
            // 没有后续节点，创建一个
            nextNode = document.createTextNode(' ')
            inputElement.appendChild(nextNode)

            // 设置选区在新创建的节点
            selection.removeAllRanges()
            const rangeAfter = document.createRange()
            rangeAfter.setStart(nextNode, 0)
            rangeAfter.setEnd(nextNode, 0)
            selection.addRange(rangeAfter)
          }
        } else {
          // 如果输入框没有内容，添加一个空格节点以便于后续编辑
          const spaceNode = document.createElement('span')
          spaceNode.textContent = '\u00A0'
          spaceNode.contentEditable = 'false'
          spaceNode.style.userSelect = 'none'

          // 在回复框后插入空格节点
          const afterRange = document.createRange()
          afterRange.selectNode(replyNode)
          afterRange.collapse(false) // 折叠到结束位置
          afterRange.insertNode(spaceNode)

          // 在空格节点后插入一个空的文本节点，便于光标定位
          const textNode = document.createTextNode('')
          afterRange.selectNode(spaceNode)
          afterRange.collapse(false)
          afterRange.insertNode(textNode)

          // 设置光标位置在文本节点处
          selection.removeAllRanges()
          const newRangeAfter = document.createRange()
          newRangeAfter.setStart(textNode, 0)
          newRangeAfter.setEnd(textNode, 0)
          selection.addRange(newRangeAfter)
        }
      }

      // 触发输入事件，确保UI更新
      triggerInputEvent(inputElement)
      return
    } else if (type === MsgEnum.AI) {
      // 删除触发字符 "/"
      const startContainer = range.startContainer
      if (startContainer.nodeType === Node.TEXT_NODE) {
        const text = startContainer.textContent || ''
        const lastIndex = text.lastIndexOf('/')
        if (lastIndex !== -1) {
          startContainer.textContent = text.substring(0, lastIndex)
        }
      }

      // 创建一个div标签节点
      const divNode = document.createElement('div')
      divNode.id = 'AIDiv' // 设置id为replyDiv
      divNode.contentEditable = 'false' // 设置为不可编辑
      divNode.tabIndex = -1 // 防止被focus
      divNode.style.cssText = `
      background-color: var(--reply-bg);
      font-size: 12px;
      padding: 4px 6px;
      width: fit-content;
      max-height: 86px;
      border-radius: 8px;
      margin-bottom: 2px;
      user-select: none;
      pointer-events: none; /* 防止鼠标事件 */
      cursor: default;
      outline: none; /* 移除focus时的轮廓 */
    `
      // 把dom中的value值作为回复信息的作者，dom中的content作为回复信息的内容
      const author = (dom as ReplyData).name
      // 创建一个img标签节点作为头像
      const imgNode = document.createElement('img')
      const avatarUrl = AvatarUtils.getAvatarUrl((dom as ReplyData).avatar)
      if (isSafeUrl(avatarUrl)) {
        imgNode.src = avatarUrl
      } else {
        // 设置为默认头像或空
        imgNode.src = '/avatar/001.png'
      }
      imgNode.style.cssText = `
      width: 20px;
      height: 20px;
      border-radius: 50%;
      object-fit: contain;
      `
      // 创建一个div标签节点作为回复信息的头部
      const headerNode = document.createElement('div')
      headerNode.style.cssText = `
      line-height: 1.5;
      font-size: 12px;
      padding: 0 4px;
      color: rgba(19, 152, 127);
      cursor: default;
      user-select: none;
      pointer-events: none;
    `
      headerNode.appendChild(document.createTextNode(author || ''))
      // 在回复信息的右边添加一个关闭信息的按钮
      const closeBtn = document.createElement('span')
      closeBtn.id = 'closeBtn'
      closeBtn.style.cssText = `
      display: flex;
      align-items: center;
      font-size: 12px;
      color: #999;
      cursor: pointer;
      margin-left: 10px;
      flex-shrink: 0;
      user-select: none;
      pointer-events: auto; /* 确保关闭按钮可以点击 */
    `
      closeBtn.textContent = '关闭'
      closeBtn.addEventListener('click', () => {
        // 首先移除回复节点
        divNode.remove()

        // 获取消息输入框
        const messageInput = document.getElementById('message-input') as HTMLElement
        if (!messageInput) return

        // 确保输入框获得焦点
        messageInput.focus()

        // 完全清空reply状态
        reply.value = { avatar: '', imgCount: 0, accountName: '', content: '', key: 0 }

        // 优化光标处理
        const selection = window.getSelection()
        if (selection) {
          const range = document.createRange()

          // 处理输入框内容，如果只有空格，则清空它
          if (messageInput.textContent && messageInput.textContent.trim() === '') {
            messageInput.textContent = ''
          }

          // 将光标移动到输入框的末尾
          range.selectNodeContents(messageInput)
          range.collapse(false) // 折叠到末尾

          selection.removeAllRanges()
          selection.addRange(range)

          // 触发输入事件以更新UI状态
          triggerInputEvent(messageInput)
        }
      })
      // 为头像和标题创建容器
      const headerContainer = document.createElement('div')
      headerContainer.style.cssText = `
      display: flex;
      align-items: center;
      gap: 2px;
      `
      // 在容器中添加头像和标题
      headerContainer.appendChild(imgNode)
      headerContainer.appendChild(headerNode)
      headerContainer.appendChild(closeBtn)

      // 将容器添加到主div中
      divNode.appendChild(headerContainer)
      // 将div标签节点插入到光标位置
      range?.insertNode(divNode)
      // 将光标折叠到Range的末尾(true表示折叠到Range的开始位置,false表示折叠到Range的末尾)
      range?.collapse(false)
      // 创建一个span节点作为空格
      const spaceNode = document.createElement('span')
      spaceNode.textContent = '\u00A0'
      // 设置不可编辑
      spaceNode.contentEditable = 'false'
      // 不可以选中
      spaceNode.style.userSelect = 'none'
      // 插入一个br标签节点作为换行
      const brNode = document.createElement('br')
      // 将br标签节点插入到光标位置
      range?.insertNode(brNode)
      // 将空格节点插入到光标位置
      range?.insertNode(spaceNode)
      range?.collapse(false)
    } else {
      if (typeof dom === 'string') {
        const textNode = document.createTextNode(dom)
        range?.insertNode(textNode)
      } else {
        range?.insertNode(dom as unknown as Node)
      }
      range?.collapse(false)
    }
    // 将光标移到选中范围的最后面
    selection?.collapseToEnd()
  }

  /**
   * create a reply element
   */
  function createReplyDom(dom: { accountName: string; content: string; avatar: string }) {
    // 创建一个div标签节点
    const replyNode = document.createElement('div')
    replyNode.id = REPLY_NODE_ID // 设置id为replyDiv
    replyNode.contentEditable = 'false' // 设置为不可编辑
    replyNode.tabIndex = -1 // 防止被focus
    replyNode.style.cssText = `
      background-color: var(--reply-bg);
      font-size: 12px;
      padding: 4px 6px;
      width: fit-content;
      max-height: 86px;
      border-radius: 8px;
      margin-bottom: 2px;
      user-select: none;
      pointer-events: none; /* 防止鼠标事件 */
      cursor: default;
      outline: none; /* 移除focus时的轮廓 */
      `
    if (isMobile()) {
      replyNode.style.cssText += `max-width: 170px;`
    }
    // 把dom中的value值作为回复信息的作者，dom中的content作为回复信息的内容
    const author = dom.accountName + '：'
    let content = dom.content
    // 创建一个img标签节点作为头像
    const imgNode = document.createElement('img')
    const avatarUrl = AvatarUtils.getAvatarUrl(dom.avatar)
    if (isSafeUrl(avatarUrl)) {
      imgNode.src = avatarUrl
    } else {
      // 设置为默认头像或空
      imgNode.src = 'avatar/001.png'
    }
    imgNode.style.cssText = `
      width: 20px;
      height: 20px;
      border-radius: 50%;
      `
    // 创建一个div标签节点作为回复信息的头部
    const headerNode = document.createElement('div')
    headerNode.style.cssText = `
      line-height: 1.5;
      font-size: 12px;
      padding: 0 4px;
      color: rgba(19, 152, 127);
      cursor: default;
      user-select: none;
      pointer-events: none;
    `
    headerNode.appendChild(document.createTextNode(author))
    // 创建一个div标签节点包裹正文内容
    const contentNode = document.createElement('div')
    contentNode.style.cssText = `
      display: flex;
      justify-content: space-between;
      border-radius: 8px;
      padding: 2px;
      margin-top: 4px;
      min-width: 0;
    `
    let contentBox
    // 判断content内容是否是data:image/开头的数组
    if (Array.isArray(content)) {
      // 获取总共有多少张图片
      const imageCount = content.length
      // 获取第一个data:image/开头的图片
      content = content.find((item: string) => item.startsWith('data:image/'))
      reply.value.imgCount = imageCount
    }

    // 使用 http 判断网络图片，后续可优化为检测 URL 格式
    if (content.startsWith('http')) {
      // 再创建一个img标签节点，并设置src属性为base64编码的图片
      contentBox = document.createElement('img')
      contentBox.src = content
      contentBox.style.cssText = `
        max-width: 55px;
        max-height: 55px;
        border-radius: 4px;
        cursor: default;
        user-select: none;
        pointer-events: none;
      `
      // 将img标签节点插入到div标签节点中
      replyNode.appendChild(contentBox)
      // 把图片传入到reply的content属性中
      reply.value.content = content
    } else {
      // 判断是否有@标签
      if (content.includes('id="aitSpan"')) {
        // 去掉content中的标签
        content = removeTag(content)
      }
      // 把正文放到span标签中，并设置span标签的样式
      contentBox = document.createElement('span')
      contentBox.style.cssText = `
      font-size: 12px;
      color: var(--text-color);
      cursor: default;
      width: fit-content;
      max-width: 350px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      user-select: none;
      pointer-events: none;
    `
      contentBox.appendChild(document.createTextNode(content))
    }
    // 在回复信息的右边添加一个关闭信息的按钮
    const closeBtn = document.createElement('span')
    closeBtn.id = 'closeBtn'
    closeBtn.style.cssText = `
      display: flex;
      align-items: center;
      font-size: 12px;
      color: #999;
      cursor: pointer;
      margin-left: 10px;
      flex-shrink: 0;
      user-select: none;
      pointer-events: auto; /* 确保关闭按钮可以点击 */
    `
    closeBtn.textContent = '关闭'
    closeBtn.addEventListener('click', () => {
      // 首先移除回复节点
      replyNode.remove()

      // 获取消息输入框
      const messageInput = document.getElementById('message-input') as HTMLElement
      if (!messageInput) return

      // 确保输入框获得焦点
      messageInput.focus()

      // 完全清空reply状态
      reply.value = { avatar: '', imgCount: 0, accountName: '', content: '', key: 0 }

      // 优化光标处理
      const selection = window.getSelection()
      if (selection) {
        const range = document.createRange()

        // 处理输入框内容，如果只有空格，则清空它
        if (messageInput.textContent && messageInput.textContent.trim() === '') {
          messageInput.textContent = ''
        }

        // 将光标移动到输入框的末尾
        range.selectNodeContents(messageInput)
        range.collapse(false) // 折叠到末尾

        selection.removeAllRanges()
        selection.addRange(range)

        // 触发输入事件以更新UI状态
        triggerInputEvent(messageInput)
      }
    })
    // 为头像和标题创建容器
    const headerContainer = document.createElement('div')
    headerContainer.style.cssText = `
      display: flex;
      align-items: center;
      gap: 2px;
      `
    // 在容器中添加头像和标题
    headerContainer.appendChild(imgNode)
    headerContainer.appendChild(headerNode)

    // 将容器添加到主div中
    replyNode.appendChild(headerContainer)
    replyNode.appendChild(contentNode)
    contentNode.appendChild(contentBox)
    contentNode.appendChild(closeBtn)
    return replyNode
  }

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
    // 获取home窗口实例
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
    // 把隐藏的会话先显示
    try {
      await invokeWithErrorHandler('hide_contact_command', { data: { roomId: res.roomId, hide: false } })
    } catch {
      window.$message.error('显示会话失败')
    }

    // 先检查会话是否已存在
    const existingSession = chatStore.getSession(res.roomId)
    if (!existingSession) {
      // 只有当会话不存在时才更新会话列表顺序
      chatStore.updateSessionLastActiveTime(res.roomId)
      // 如果会话不存在，需要重新获取会话列表，但保持当前选中的会话
      await chatStore.getSessionList(true)
    }
    globalStore.updateCurrentSessionRoomId(res.roomId)

    // 发送消息定位
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
