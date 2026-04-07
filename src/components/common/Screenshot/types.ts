export interface ScreenConfig {
  startX: number
  startY: number
  endX: number
  endY: number
  scaleX: number
  scaleY: number
  isDrawing: boolean
  width: number
  height: number
}

export interface DragOffset {
  x: number
  y: number
}

export interface ResizeStartPosition {
  x: number
  y: number
  width: number
  height: number
  left: number
  top: number
}

export interface SelectionAreaStyle {
  left: string
  top: string
  width: string
  height: string
  borderRadius: string
  border: string
}

export type DrawToolType = 'rect' | 'circle' | 'arrow' | 'mosaic' | null

export interface DrawTools {
  draw: (type: DrawToolType) => void
  stopDrawing: () => void
  resetState: () => void
  clearEvents: () => void
  clearAll: () => void
  undo: () => void
  drawMosaicBrushSize: (size: number) => void
  canUndo?: Ref<boolean>
}

export interface ScreenshotEmitPayload {
  type: 'image'
  buffer: number[]
  mimeType: 'image/png'
}

export interface MagnifierConfig {
  width: number
  height: number
  zoomFactor: number
}

import type { Ref } from 'vue'
