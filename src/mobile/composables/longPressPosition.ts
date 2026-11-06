interface LongPressMenuTopInput {
  anchorTop: number
  anchorHeight: number
  menuHeight: number
  viewportHeight: number
  margin?: number
}

/**
 * 长按菜单纵向定位：锚点上方 1/3 行高处起排，并钳制在视口内
 * menuHeight 传 0（尚未完成测量）时退化为「距底 margin」的上限
 */
export const resolveLongPressMenuTop = ({
  anchorTop,
  anchorHeight,
  menuHeight,
  viewportHeight,
  margin = 8
}: LongPressMenuTopInput) => {
  const wanted = anchorTop - anchorHeight / 3
  const maxTop = Math.max(margin, viewportHeight - menuHeight - margin)
  return Math.min(Math.max(wanted, margin), maxTop)
}
