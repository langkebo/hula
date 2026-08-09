/**
 * 截图选区绘制的纯函数工具：圆角矩形描边 + 尺寸标注。
 * 从 ScreenshotRoot 下沉，供蒙版框选与初始化描边共用。
 */

export interface RectangleStyle {
  /** 选区边框颜色（--tjg-color-primary-500） */
  borderColor: string
  /** 选区圆角（CSS 像素，需乘 scaleX 换算到画布像素） */
  borderRadius: number
  /** CSS 像素到画布像素的横向缩放比 */
  scaleX: number
}

/** 在选区左上角外侧绘制「宽 x 高」尺寸文本 */
export const drawSizeText = (
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number
) => {
  const roundedWidth = Math.round(Math.abs(width))
  const roundedHeight = Math.round(Math.abs(height))
  const sizeText = `${roundedWidth} x ${roundedHeight}`

  const textX = width >= 0 ? x : x + width
  const textY = height >= 0 ? y : y + height

  context.font = '14px Arial'
  context.fillStyle = 'white'
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.fillText(sizeText, textX + 5, textY - 10)
}

/** 描边选区矩形（支持圆角），并附带尺寸标注 */
export const drawRectangle = (
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  style: RectangleStyle,
  lineWidth: number = 2
) => {
  context.strokeStyle = style.borderColor || 'black'
  context.lineWidth = lineWidth

  if (style.borderRadius > 0) {
    const radius = style.borderRadius * style.scaleX
    const adjustedRadius = Math.min(radius, Math.abs(width) / 2, Math.abs(height) / 2)

    context.beginPath()

    const rectX = width >= 0 ? x : x + width
    const rectY = height >= 0 ? y : y + height
    const rectWidth = Math.abs(width)
    const rectHeight = Math.abs(height)

    context.moveTo(rectX + adjustedRadius, rectY)
    context.lineTo(rectX + rectWidth - adjustedRadius, rectY)
    context.quadraticCurveTo(rectX + rectWidth, rectY, rectX + rectWidth, rectY + adjustedRadius)
    context.lineTo(rectX + rectWidth, rectY + rectHeight - adjustedRadius)
    context.quadraticCurveTo(
      rectX + rectWidth,
      rectY + rectHeight,
      rectX + rectWidth - adjustedRadius,
      rectY + rectHeight
    )
    context.lineTo(rectX + adjustedRadius, rectY + rectHeight)
    context.quadraticCurveTo(rectX, rectY + rectHeight, rectX, rectY + rectHeight - adjustedRadius)
    context.lineTo(rectX, rectY + adjustedRadius)
    context.quadraticCurveTo(rectX, rectY, rectX + adjustedRadius, rectY)
    context.closePath()

    context.stroke()
  } else {
    context.strokeRect(x, y, width, height)
  }

  drawSizeText(context, x, y, width, height)
}
