import { nextTick, type Ref, ref } from 'vue'
import type { DrawToolType, ScreenConfig, SelectionAreaStyle } from '../types'

interface UseSelectionDragResizeOptions {
  screenConfig: Ref<ScreenConfig>
  selectionAreaStyle: Ref<SelectionAreaStyle>
  currentDrawTool: Ref<DrawToolType>
  borderRadius: Ref<number>
  selectionBorderColor: string
  showButtonGroup: Ref<boolean>
  redrawSelection: () => void
  updateButtonGroupPosition: () => void
  hideMagnifier: () => void
  onResizeMouseMove: (event: MouseEvent) => void
}

/**
 * Selection drag (move) and 8-direction resize state machine.
 * Manages document-level mousemove/mouseup listeners.
 */
export const useSelectionDragResize = ({
  screenConfig,
  selectionAreaStyle,
  currentDrawTool,
  borderRadius,
  selectionBorderColor,
  showButtonGroup,
  redrawSelection,
  updateButtonGroupPosition,
  hideMagnifier,
  onResizeMouseMove
}: UseSelectionDragResizeOptions) => {
  const isDragging = ref(false)
  const isResizing = ref(false)
  const dragOffset = ref({ x: 0, y: 0 })
  const resizeDirection = ref('')
  const resizeStartPosition = ref({ x: 0, y: 0, width: 0, height: 0, left: 0, top: 0 })

  // --- Drag (move) ---

  const handleSelectionDragStart = (event: MouseEvent) => {
    if (currentDrawTool.value) return
    isDragging.value = true
    dragOffset.value = {
      x: event.clientX - parseFloat(selectionAreaStyle.value.left),
      y: event.clientY - parseFloat(selectionAreaStyle.value.top)
    }
    document.addEventListener('mousemove', handleSelectionDragMove)
    document.addEventListener('mouseup', handleSelectionDragEnd)
  }

  const handleSelectionDragMove = (event: MouseEvent) => {
    if (!isDragging.value) return
    event.preventDefault()

    const newLeft = event.clientX - dragOffset.value.x
    const newTop = event.clientY - dragOffset.value.y
    const selectionWidth = parseFloat(selectionAreaStyle.value.width)
    const selectionHeight = parseFloat(selectionAreaStyle.value.height)
    const maxLeft = window.innerWidth - selectionWidth
    const maxTop = window.innerHeight - selectionHeight
    const constrainedLeft = Math.max(0, Math.min(newLeft, maxLeft))
    const constrainedTop = Math.max(0, Math.min(newTop, maxTop))

    selectionAreaStyle.value.left = `${constrainedLeft}px`
    selectionAreaStyle.value.top = `${constrainedTop}px`

    const { scaleX, scaleY } = screenConfig.value
    screenConfig.value.startX = constrainedLeft * scaleX
    screenConfig.value.startY = constrainedTop * scaleY
    screenConfig.value.endX = (constrainedLeft + selectionWidth) * scaleX
    screenConfig.value.endY = (constrainedTop + selectionHeight) * scaleY

    redrawSelection()
  }

  const handleSelectionDragEnd = () => {
    isDragging.value = false
    document.removeEventListener('mousemove', handleSelectionDragMove)
    document.removeEventListener('mouseup', handleSelectionDragEnd)
    hideMagnifier()
    nextTick(updateButtonGroupPosition)
  }

  // --- Resize (8-direction) ---

  const handleResizeStart = (event: MouseEvent, direction: string) => {
    if (currentDrawTool.value) return
    isResizing.value = true
    resizeDirection.value = direction
    resizeStartPosition.value = {
      x: event.clientX,
      y: event.clientY,
      width: parseFloat(selectionAreaStyle.value.width),
      height: parseFloat(selectionAreaStyle.value.height),
      left: parseFloat(selectionAreaStyle.value.left),
      top: parseFloat(selectionAreaStyle.value.top)
    }
    document.addEventListener('mousemove', handleResizeMove)
    document.addEventListener('mouseup', handleResizeEnd)
  }

  const handleResizeMove = (event: MouseEvent) => {
    if (!isResizing.value) return
    event.preventDefault()
    onResizeMouseMove(event)

    const deltaX = event.clientX - resizeStartPosition.value.x
    const deltaY = event.clientY - resizeStartPosition.value.y

    let newLeft = resizeStartPosition.value.left
    let newTop = resizeStartPosition.value.top
    let newWidth = resizeStartPosition.value.width
    let newHeight = resizeStartPosition.value.height

    switch (resizeDirection.value) {
      case 'nw':
        newLeft += deltaX
        newTop += deltaY
        newWidth -= deltaX
        newHeight -= deltaY
        break
      case 'ne':
        newTop += deltaY
        newWidth += deltaX
        newHeight -= deltaY
        break
      case 'sw':
        newLeft += deltaX
        newWidth -= deltaX
        newHeight += deltaY
        break
      case 'se':
        newWidth += deltaX
        newHeight += deltaY
        break
      case 'n':
        newTop += deltaY
        newHeight -= deltaY
        break
      case 'e':
        newWidth += deltaX
        break
      case 's':
        newHeight += deltaY
        break
      case 'w':
        newLeft += deltaX
        newWidth -= deltaX
        break
    }

    const minSize = 20
    if (newWidth < minSize) {
      if (resizeDirection.value.includes('w')) {
        newLeft = resizeStartPosition.value.left + resizeStartPosition.value.width - minSize
      }
      newWidth = minSize
    }
    if (newHeight < minSize) {
      if (resizeDirection.value.includes('n')) {
        newTop = resizeStartPosition.value.top + resizeStartPosition.value.height - minSize
      }
      newHeight = minSize
    }

    newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - newWidth))
    newTop = Math.max(0, Math.min(newTop, window.innerHeight - newHeight))

    selectionAreaStyle.value = {
      left: `${newLeft}px`,
      top: `${newTop}px`,
      width: `${newWidth}px`,
      height: `${newHeight}px`,
      borderRadius: `${borderRadius.value}px`,
      border: `2px solid ${selectionBorderColor}`
    }

    const { scaleX, scaleY } = screenConfig.value
    screenConfig.value.startX = newLeft * scaleX
    screenConfig.value.startY = newTop * scaleY
    screenConfig.value.endX = (newLeft + newWidth) * scaleX
    screenConfig.value.endY = (newTop + newHeight) * scaleY

    redrawSelection()
    if (showButtonGroup.value) {
      updateButtonGroupPosition()
    }
  }

  const handleResizeEnd = () => {
    isResizing.value = false
    resizeDirection.value = ''
    document.removeEventListener('mousemove', handleResizeMove)
    document.removeEventListener('mouseup', handleResizeEnd)
    hideMagnifier()
    nextTick(() => {
      if (showButtonGroup.value) {
        updateButtonGroupPosition()
      }
    })
  }

  const cleanup = () => {
    document.removeEventListener('mousemove', handleSelectionDragMove)
    document.removeEventListener('mouseup', handleSelectionDragEnd)
    document.removeEventListener('mousemove', handleResizeMove)
    document.removeEventListener('mouseup', handleResizeEnd)
  }

  return {
    isDragging,
    isResizing,
    handleSelectionDragStart,
    handleResizeStart,
    cleanup
  }
}
