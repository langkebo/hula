import { ref, computed, type Ref } from 'vue'
import type { ScreenConfig, SelectionAreaStyle, DragOffset, ResizeStartPosition } from '../types'

export function useScreenshotSelection(screenConfig: Ref<ScreenConfig>) {
  const isDragging = ref(false)
  const isResizing = ref(false)
  const resizeDirection = ref('')
  const dragOffset = ref<DragOffset>({ x: 0, y: 0 })
  const resizeStartPosition = ref<ResizeStartPosition>({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    left: 0,
    top: 0
  })
  const borderRadius = ref(0)
  const showButtonGroup = ref(false)

  const selectionAreaStyle = ref<SelectionAreaStyle>({
    left: '0px',
    top: '0px',
    width: '0px',
    height: '0px',
    borderRadius: '0px',
    border: '2px solid #13987f'
  })

  const selectionBounds = computed(() => {
    const { startX, startY, endX, endY, scaleX, scaleY } = screenConfig.value
    return {
      minX: Math.min(startX, endX) / scaleX,
      minY: Math.min(startY, endY) / scaleY,
      maxX: Math.max(startX, endX) / scaleX,
      maxY: Math.max(startY, endY) / scaleY
    }
  })

  const updateSelectionAreaPosition = () => {
    const { minX, minY, maxX, maxY } = selectionBounds.value
    selectionAreaStyle.value = {
      left: `${minX}px`,
      top: `${minY}px`,
      width: `${maxX - minX}px`,
      height: `${maxY - minY}px`,
      borderRadius: `${borderRadius.value}px`,
      border: '2px solid #13987f'
    }
  }

  const handleSelectionDragStart = (event: MouseEvent, currentDrawTool: string | null) => {
    if (currentDrawTool) {
      event.preventDefault()
      event.stopPropagation()
      return false
    }

    event.preventDefault()
    event.stopPropagation()

    isDragging.value = true
    dragOffset.value = {
      x: event.clientX - parseFloat(selectionAreaStyle.value.left),
      y: event.clientY - parseFloat(selectionAreaStyle.value.top)
    }

    document.addEventListener('mousemove', handleSelectionDragMove)
    document.addEventListener('mouseup', handleSelectionDragEnd)

    return true
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
    selectionAreaStyle.value.borderRadius = `${borderRadius.value}px`
    selectionAreaStyle.value.border = '2px solid #13987f'

    const { scaleX, scaleY } = screenConfig.value
    screenConfig.value.startX = constrainedLeft * scaleX
    screenConfig.value.startY = constrainedTop * scaleY
    screenConfig.value.endX = (constrainedLeft + selectionWidth) * scaleX
    screenConfig.value.endY = (constrainedTop + selectionHeight) * scaleY

    return { constrainedLeft, constrainedTop }
  }

  const handleSelectionDragEnd = () => {
    isDragging.value = false

    document.removeEventListener('mousemove', handleSelectionDragMove)
    document.removeEventListener('mouseup', handleSelectionDragEnd)

    return true
  }

  const handleResizeStart = (event: MouseEvent, direction: string, currentDrawTool: string | null) => {
    if (currentDrawTool) {
      event.preventDefault()
      event.stopPropagation()
      return false
    }

    event.preventDefault()
    event.stopPropagation()

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

    return true
  }

  const handleResizeMove = (event: MouseEvent) => {
    if (!isResizing.value) return

    event.preventDefault()

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
      border: '2px solid #13987f'
    }

    const { scaleX, scaleY } = screenConfig.value
    screenConfig.value.startX = newLeft * scaleX
    screenConfig.value.startY = newTop * scaleY
    screenConfig.value.endX = (newLeft + newWidth) * scaleX
    screenConfig.value.endY = (newTop + newHeight) * scaleY

    return { newLeft, newTop, newWidth, newHeight }
  }

  const handleResizeEnd = () => {
    isResizing.value = false
    resizeDirection.value = ''

    document.removeEventListener('mousemove', handleResizeMove)
    document.removeEventListener('mouseup', handleResizeEnd)

    return true
  }

  const handleBorderRadiusChange = (event: Event) => {
    const target = event.target as HTMLInputElement
    borderRadius.value = parseInt(target.value, 10)
    updateSelectionAreaPosition()
  }

  const resetSelection = () => {
    isDragging.value = false
    isResizing.value = false
    borderRadius.value = 0
    showButtonGroup.value = false
    selectionAreaStyle.value = {
      left: '0px',
      top: '0px',
      width: '0px',
      height: '0px',
      borderRadius: '0px',
      border: '2px solid #13987f'
    }
  }

  return {
    isDragging,
    isResizing,
    resizeDirection,
    borderRadius,
    showButtonGroup,
    selectionAreaStyle,
    selectionBounds,
    updateSelectionAreaPosition,
    handleSelectionDragStart,
    handleSelectionDragMove,
    handleSelectionDragEnd,
    handleResizeStart,
    handleResizeMove,
    handleResizeEnd,
    handleBorderRadiusChange,
    resetSelection
  }
}
