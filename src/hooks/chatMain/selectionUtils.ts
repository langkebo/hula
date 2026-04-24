/**
 * Text-selection helpers tied to chat message bubbles.
 *
 * Chat messages are rendered with `data-key` attributes of the form
 * `<letter><msgId>` (e.g. `T1700000000`). These utilities let UI handlers
 * answer "did the user select text inside a single message bubble?" without
 * couplingto the hook layer.
 *
 * All functions read live browser DOM / Selection state and are side-effect
 * free apart from `clearSelection`.
 */

/**
 * Strip the single leading letter prefix from a `data-key` value.
 * Returns '' if `dataKey` is missing.
 */
export function extractMsgIdFromDataKey(dataKey?: string | null): string {
  if (!dataKey) return ''
  return dataKey.replace(/^[A-Za-z]/, '')
}

/**
 * Resolve a Selection to the shared message id of its anchor+focus elements.
 *
 * - Returns '' if anchor and focus are not inside the same `[data-key]` host.
 * - If a chat root element with id `image-chat-main` exists in the document,
 *   both endpoints must be inside it; otherwise returns ''.
 */
export function resolveSelectionMessageId(selection: Selection): string {
  const resolveElement = (node: Node | null): Element | null => {
    if (!node) return null
    return node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement
  }

  const anchorElement = resolveElement(selection.anchorNode)
  const focusElement = resolveElement(selection.focusNode)
  if (!anchorElement || !focusElement) return ''

  const anchorKey = anchorElement.closest('[data-key]')?.getAttribute('data-key')
  const focusKey = focusElement.closest('[data-key]')?.getAttribute('data-key')

  if (!anchorKey || !focusKey || anchorKey !== focusKey) return ''

  const chatMainElement = document.getElementById('image-chat-main')
  if (chatMainElement && (!chatMainElement.contains(anchorElement) || !chatMainElement.contains(focusElement))) {
    return ''
  }

  return extractMsgIdFromDataKey(anchorKey)
}

/**
 * Return the text the user has selected inside a single chat bubble.
 *
 * - Returns '' when there is no selection, an empty selection, or the
 *   selection spans multiple bubbles.
 * - If `messageId` is passed, also returns '' when the selected bubble's
 *   id does not match.
 */
export function getSelectedText(messageId?: string): string {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return ''

  const text = selection.toString().trim()
  if (!text) return ''

  const selectedMessageId = resolveSelectionMessageId(selection)
  if (!selectedMessageId) return ''
  if (messageId && selectedMessageId !== messageId) return ''

  return text
}

export function hasSelectedText(messageId?: string): boolean {
  return getSelectedText(messageId).length > 0
}

export function clearSelection(): void {
  const selection = window.getSelection()
  if (selection) selection.removeAllRanges()
}
