import type { SelectionRange } from '../useCommon'

export interface CursorManager {
  getCursorSelectionRange: () => SelectionRange | null
  updateSelectionRange: (sr: SelectionRange | null) => void
  focusOn: (editor: HTMLElement) => void
}

/**
 * Keeps a private reference to the editor's last known selection range so that
 * focus-restore callers can refocus without losing caret position.
 */
export function useCursorManager(): CursorManager {
  let cursorSelectionRange: SelectionRange | null = null

  const updateSelectionRange = (sr: SelectionRange | null) => {
    cursorSelectionRange = sr
  }

  const getCursorSelectionRange = () => cursorSelectionRange

  const focusOn = (editor: HTMLElement) => {
    editor.focus()
    const selection = window.getSelection()
    if (!selection) return
    const selectionRange = getCursorSelectionRange()
    if (!selectionRange) return
    const range = document.createRange()
    range.selectNodeContents(editor)
    range.collapse(false)
    selection.removeAllRanges()
    selection.addRange(selectionRange.range)
  }

  return { getCursorSelectionRange, updateSelectionRange, focusOn }
}
