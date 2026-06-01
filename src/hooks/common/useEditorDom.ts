/**
 * Editor DOM construction hook split out of `useCommon`.
 *
 * Owns the chain `insertNode` → `insertNodeAtRange` → `createReplyDom` and
 * the small `isSafeUrl` URL guard. The reactive `reply` state is injected
 * via `UseEditorDomOptions` so this hook can be unit-tested without a full
 * Pinia setup, and so its mutations to `reply.value` (e.g. inside the AI
 * close-button handler) stay observable from the outer composable.
 *
 * Behaviour is locked in by `src/hooks/__tests__/useCommon.insertNodeAtRange.test.ts`.
 */
import type { Ref } from 'vue'
import { MsgEnum } from '@/enums'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { removeTag } from '@/utils/Formatting'
import { isMobile } from '@/utils/PlatformConstants'
import type { SelectionRange } from '../useCommon'
import { getEditorRange, triggerInputEvent } from './editorDomBasics'

const REPLY_NODE_ID = 'replyDiv'

type AitMentionData = { name?: string; text?: string; label?: string; uid?: string }
type ReplyData = { accountName: string; content: string; avatar: string; name?: string }
type InsertNodeData = AitMentionData | ReplyData | string

export type ReplyState = {
  avatar: string
  accountName: string
  content: string
  key: string | number
  imgCount: number
}

export type UseEditorDomOptions = {
  reply: Ref<ReplyState>
}

export const useEditorDom = (options: UseEditorDomOptions) => {
  const { reply } = options

  const isSafeUrl = (url: string) => {
    return /^(https?:\/\/|\/)/.test(url) && !/^javascript:/i.test(url) && !/^data:/i.test(url)
  }

  const insertNode = (type: MsgEnum, dom: InsertNodeData, target: HTMLElement) => {
    const sr = getEditorRange()!
    if (!sr) return
    insertNodeAtRange(type, dom, target, sr)
  }

  const insertNodeAtRange = (type: MsgEnum, dom: InsertNodeData, _target: HTMLElement, sr: SelectionRange) => {
    const { range, selection } = sr

    range?.deleteContents()

    if (type === MsgEnum.AIT) {
      const domObj = dom as AitMentionData
      const mentionText =
        typeof dom === 'object' && dom !== null ? domObj.name || domObj.text || domObj.label || '' : dom || ''
      const mentionUid = typeof dom === 'object' && dom !== null ? domObj.uid : undefined
      const spanNode = document.createElement('span')
      spanNode.id = 'aitSpan'
      spanNode.contentEditable = 'false'
      spanNode.classList.add('text-[--hula-brand]')
      spanNode.classList.add('select-none')
      spanNode.classList.add('cursor-default')
      spanNode.style.userSelect = 'text'
      if (mentionUid) {
        spanNode.dataset.aitUid = String(mentionUid)
      }
      spanNode.appendChild(document.createTextNode(`@${mentionText}`))
      range?.insertNode(spanNode)
      range?.collapse(false)
      const spaceNode = document.createTextNode(' ')
      range?.insertNode(spaceNode)
    } else if (type === MsgEnum.TEXT) {
      range?.insertNode(document.createTextNode(String(dom)))
    } else if (type === MsgEnum.REPLY) {
      const inputElement = document.getElementById('message-input')
      if (!inputElement) return

      inputElement.focus()

      const replyNode = createReplyDom(dom as ReplyData)

      const preReplyNode = document.getElementById('replyDiv')
      if (preReplyNode) {
        preReplyNode.replaceWith(replyNode)
      } else {
        const hasChildNodes =
          inputElement.childNodes.length > 0 &&
          !(
            inputElement.childNodes.length === 1 &&
            inputElement.childNodes[0].nodeType === Node.TEXT_NODE &&
            !inputElement.childNodes[0].textContent?.trim()
          )
        inputElement.insertBefore(replyNode, inputElement.firstChild)

        if (hasChildNodes) {
          let nextNode = replyNode.nextSibling
          let position = 0

          if (nextNode) {
            if (nextNode.nodeType === Node.TEXT_NODE) {
              position = 0
            } else {
              while (nextNode && nextNode.nodeType !== Node.TEXT_NODE) {
                nextNode = nextNode.nextSibling
              }
              if (!nextNode) {
                nextNode = document.createTextNode(' ')
                inputElement.appendChild(nextNode)
              }
              position = 0
            }

            selection.removeAllRanges()
            const rangeAfter = document.createRange()
            rangeAfter.setStart(nextNode, position)
            rangeAfter.setEnd(nextNode, position)
            selection.addRange(rangeAfter)
          } else {
            nextNode = document.createTextNode(' ')
            inputElement.appendChild(nextNode)

            selection.removeAllRanges()
            const rangeAfter = document.createRange()
            rangeAfter.setStart(nextNode, 0)
            rangeAfter.setEnd(nextNode, 0)
            selection.addRange(rangeAfter)
          }
        } else {
          const spaceNode = document.createElement('span')
          spaceNode.textContent = ' '
          spaceNode.contentEditable = 'false'
          spaceNode.style.userSelect = 'none'

          const afterRange = document.createRange()
          afterRange.selectNode(replyNode)
          afterRange.collapse(false)
          afterRange.insertNode(spaceNode)

          const textNode = document.createTextNode('')
          afterRange.selectNode(spaceNode)
          afterRange.collapse(false)
          afterRange.insertNode(textNode)

          selection.removeAllRanges()
          const newRangeAfter = document.createRange()
          newRangeAfter.setStart(textNode, 0)
          newRangeAfter.setEnd(textNode, 0)
          selection.addRange(newRangeAfter)
        }
      }

      triggerInputEvent(inputElement)
      return
    } else if (type === MsgEnum.AI) {
      const startContainer = range.startContainer
      if (startContainer.nodeType === Node.TEXT_NODE) {
        const text = startContainer.textContent || ''
        const lastIndex = text.lastIndexOf('/')
        if (lastIndex !== -1) {
          startContainer.textContent = text.substring(0, lastIndex)
        }
      }

      const divNode = document.createElement('div')
      divNode.id = 'AIDiv'
      divNode.contentEditable = 'false'
      divNode.tabIndex = -1
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
      const author = (dom as ReplyData).name
      const imgNode = document.createElement('img')
      const avatarUrl = AvatarUtils.getAvatarUrl((dom as ReplyData).avatar)
      if (isSafeUrl(avatarUrl)) {
        imgNode.src = avatarUrl
      } else {
        imgNode.src = '/avatar/001.png'
      }
      imgNode.style.cssText = `
      width: 20px;
      height: 20px;
      border-radius: 50%;
      object-fit: contain;
      `
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
        divNode.remove()

        const messageInput = document.getElementById('message-input') as HTMLElement
        if (!messageInput) return

        messageInput.focus()

        reply.value = { avatar: '', imgCount: 0, accountName: '', content: '', key: 0 }

        const selection = window.getSelection()
        if (selection) {
          const range = document.createRange()

          if (messageInput.textContent && messageInput.textContent.trim() === '') {
            messageInput.textContent = ''
          }

          range.selectNodeContents(messageInput)
          range.collapse(false)

          selection.removeAllRanges()
          selection.addRange(range)

          triggerInputEvent(messageInput)
        }
      })
      const headerContainer = document.createElement('div')
      headerContainer.style.cssText = `
      display: flex;
      align-items: center;
      gap: 2px;
      `
      headerContainer.appendChild(imgNode)
      headerContainer.appendChild(headerNode)
      headerContainer.appendChild(closeBtn)

      divNode.appendChild(headerContainer)
      range?.insertNode(divNode)
      range?.collapse(false)
      const spaceNode = document.createElement('span')
      spaceNode.textContent = ' '
      spaceNode.contentEditable = 'false'
      spaceNode.style.userSelect = 'none'
      const brNode = document.createElement('br')
      range?.insertNode(brNode)
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
    selection?.collapseToEnd()
  }

  function createReplyDom(dom: { accountName: string; content: string; avatar: string }) {
    const replyNode = document.createElement('div')
    replyNode.id = REPLY_NODE_ID
    replyNode.contentEditable = 'false'
    replyNode.tabIndex = -1
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
    const author = dom.accountName + '：'
    let content = dom.content
    const imgNode = document.createElement('img')
    const avatarUrl = AvatarUtils.getAvatarUrl(dom.avatar)
    if (isSafeUrl(avatarUrl)) {
      imgNode.src = avatarUrl
    } else {
      imgNode.src = 'avatar/001.png'
    }
    imgNode.style.cssText = `
      width: 20px;
      height: 20px;
      border-radius: 50%;
      `
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
    const contentNode = document.createElement('div')
    contentNode.style.cssText = `
      display: flex;
      justify-content: space-between;
      border-radius: 8px;
      padding: 2px;
      margin-top: 4px;
      min-width: 0;
    `
    let contentBox: HTMLElement
    if (Array.isArray(content)) {
      const imageCount = content.length
      content = content.find((item: string) => item.startsWith('data:image/'))
      reply.value.imgCount = imageCount
    }

    if (content.startsWith('http')) {
      contentBox = document.createElement('img')
      ;(contentBox as HTMLImageElement).src = content
      contentBox.style.cssText = `
        max-width: 55px;
        max-height: 55px;
        border-radius: 4px;
        cursor: default;
        user-select: none;
        pointer-events: none;
      `
      replyNode.appendChild(contentBox)
      reply.value.content = content
    } else {
      if (content.includes('id="aitSpan"')) {
        content = removeTag(content)
      }
      contentBox = document.createElement('span')
      contentBox.style.cssText = `
      font-size: 12px;
      color: var(--hula-text-primary);
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
      replyNode.remove()

      const messageInput = document.getElementById('message-input') as HTMLElement
      if (!messageInput) return

      messageInput.focus()

      reply.value = { avatar: '', imgCount: 0, accountName: '', content: '', key: 0 }

      const selection = window.getSelection()
      if (selection) {
        const range = document.createRange()

        if (messageInput.textContent && messageInput.textContent.trim() === '') {
          messageInput.textContent = ''
        }

        range.selectNodeContents(messageInput)
        range.collapse(false)

        selection.removeAllRanges()
        selection.addRange(range)

        triggerInputEvent(messageInput)
      }
    })
    const headerContainer = document.createElement('div')
    headerContainer.style.cssText = `
      display: flex;
      align-items: center;
      gap: 2px;
      `
    headerContainer.appendChild(imgNode)
    headerContainer.appendChild(headerNode)

    replyNode.appendChild(headerContainer)
    replyNode.appendChild(contentNode)
    contentNode.appendChild(contentBox)
    contentNode.appendChild(closeBtn)
    return replyNode
  }

  return {
    isSafeUrl,
    insertNode,
    insertNodeAtRange,
    createReplyDom
  }
}
