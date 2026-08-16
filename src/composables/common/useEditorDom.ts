/**
 * Editor DOM construction hook split out of `useCommon`.
 *
 * Owns the chain `insertNode` → `insertNodeAtRange` and the small `isSafeUrl`
 * URL guard. The reply preview is now rendered by the standalone
 * `ReplyComposer.vue` component (driven by the `reply` ref in `useCommon`), so
 * this hook no longer injects a `#replyDiv` node into the contenteditable.
 *
 * Behaviour is locked in by `src/hooks/__tests__/useCommon.insertNodeAtRange.test.ts`.
 */
import type { Ref } from 'vue'
import { MsgEnum } from '@/enums'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { getEditorRange, triggerInputEvent } from './editorDomBasics'
import type { SelectionRange } from './useCommon'

type AitMentionData = { name?: string; text?: string; label?: string; uid?: string }
type ReplyData = { accountName: string; content: string; avatar: string; name?: string }
type InsertNodeData = AitMentionData | ReplyData | string

type ReplyState = {
  avatar: string
  accountName: string
  content: string
  key: string | number
  imgCount: number
}

type UseEditorDomOptions = {
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
      spanNode.classList.add('text-[--tjg-brand]')
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
      color: var(--tjg-color-primary-500);
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
      color: var(--tjg-text-muted);
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

  return {
    isSafeUrl,
    insertNode,
    insertNodeAtRange
  }
}
