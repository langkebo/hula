/**
 * Pure DOM helpers used by the message editor.
 *
 * Extracted from `useCommon` so they can be imported independently and unit-
 * tested without instantiating Pinia stores. None of these touch reactive
 * state — they only read/write DOM nodes and the global Selection.
 */
import type { Ref } from 'vue'
import { MsgEnum } from '@/enums'
import type { SelectionRange } from '../useCommon'

/**
 * Read the current editor selection. Falls back to placing the caret at the
 * end of `#message-input` when nothing is selected, so callers always get a
 * valid `(range, selection)` pair if the input exists.
 */
export const getEditorRange = (): SelectionRange | null => {
  if (!window.getSelection) return null
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) {
    const inputElement = document.getElementById('message-input')
    if (inputElement) {
      inputElement.focus()
      const range = document.createRange()
      range.selectNodeContents(inputElement)
      range.collapse(false)
      selection?.removeAllRanges()
      selection?.addRange(range)
    }
  }
  if (selection?.rangeCount) {
    const range = selection.getRangeAt(0)
    return { range, selection }
  }
  return null
}

/**
 * Classify the editor input children into a single MsgEnum by precedence:
 * voice > file > video > emoji-only > mixed (text+image / text+emoji) >
 * image > text.
 */
export const getMessageContentType = (messageInputDom: Ref): MsgEnum => {
  let hasText = false
  let hasImage = false
  let hasVideo = false
  let hasFile = false
  let hasEmoji = false
  let hasVoice = false

  const elements = messageInputDom.value.childNodes
  for (const element of elements) {
    if (element.nodeType === Node.TEXT_NODE && element.nodeValue.trim() !== '') {
      hasText = true
    } else if (element.tagName === 'IMG') {
      if (element.dataset.type === 'file-canvas') {
        hasFile = true
      } else if (element.dataset.type === 'emoji') {
        hasEmoji = true
      } else {
        hasImage = true
      }
    } else if (element.tagName === 'VIDEO' || (element.tagName === 'A' && element.href.match(/\.(mp4|webm)$/i))) {
      hasVideo = true
    } else if (element.tagName === 'DIV' && element.className === 'voice-message-placeholder') {
      hasVoice = true
    }
  }

  if (hasVoice) return MsgEnum.VOICE
  if (hasFile) return MsgEnum.FILE
  if (hasVideo) return MsgEnum.VIDEO
  if (hasEmoji && !hasText && !hasImage) return MsgEnum.EMOJI
  if ((hasText && hasImage) || (hasText && hasEmoji)) return MsgEnum.MIXED
  if (hasImage) return MsgEnum.IMAGE
  return MsgEnum.TEXT
}

/**
 * Dispatch a synthetic bubbling `input` event so contentEditable consumers
 * (debounced model bindings, autosizers) re-run their handlers after a
 * programmatic mutation like paste / image drop.
 */
export const triggerInputEvent = (element: HTMLElement) => {
  if (!element) return
  const event = new Event('input', { bubbles: true, cancelable: true })
  element.dispatchEvent(event)
}
