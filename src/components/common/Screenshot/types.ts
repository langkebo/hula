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

export interface SelectionAreaStyle {
  left: string
  top: string
  width: string
  height: string
  borderRadius: string
  border: string
  [key: `--${string}`]: string | number | undefined
}

export type DrawToolType = 'rect' | 'circle' | 'arrow' | 'mosaic' | null

export interface MagnifierConfig {
  width: number
  height: number
  zoomFactor: number
}
