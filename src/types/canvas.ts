/**
 * Canvas 工具类型定义
 */

/** Canvas 配置 */
export interface ScreenConfig {
  startX: number
  endX: number
  startY: number
  endY: number
}

/** Canvas 绘制上下文 */
export interface CanvasContexts {
  drawCanvas: HTMLCanvasElement | null
  drawCtx: CanvasRenderingContext2D | null
  imgCtx: CanvasRenderingContext2D | null
}

/** 绘制配置 */
export interface DrawConfig {
  startX: number
  startY: number
  endX: number
  endY: number
  scaleX: number
  scaleY: number
  lineWidth: number
  color: string
  isDrawing: boolean
  brushSize: number
  actions: DrawAction[]
  undoStack: DrawAction[]
}

/** 绘制动作 */
export interface DrawAction {
  type: 'draw' | 'clear' | 'undo'
  data?: ImageData
  startX?: number
  startY?: number
  endX?: number
  endY?: number
  color?: string
  lineWidth?: number
}

/** 缩放配置 */
export interface ZoomConfig {
  scale: number
  translateX: number
  translateY: number
}