import type { Ref } from 'vue'
import type { SizePayload } from './useContextMenuTypes'

interface MenuPositionInput {
  x: number
  y: number
  w: number
  h: number
  vw: number
  vh: number
  margin?: number
}

/**
 * 主菜单位置计算：右侧溢出则向左翻转，随后钳制在视口内
 * 触屏上菜单宽度接近屏幕宽度，只翻转不钳制会把菜单推到屏幕外
 */
export const clampMenuPosition = ({ x, y, w, h, vw, vh, margin = 8 }: MenuPositionInput) => {
  const maxX = Math.max(margin, vw - w - margin)
  const maxY = Math.max(margin, vh - h - margin)
  const wantX = x > vw - w ? x - w : x
  const wantY = y > vh - h ? vh - h : y

  return {
    posX: Math.min(Math.max(wantX, margin), maxX),
    posY: Math.min(Math.max(wantY, margin), maxY)
  }
}

/**
 * 右键菜单位置与尺寸计算逻辑
 *
 * 负责：
 * - 跟踪菜单实际尺寸（通过 v-resize 回调）
 * - 计算主菜单位置（避免溢出视口右下边界）
 * - 计算表情菜单位置（在主菜单上方/下方自适应，左右边界回退）
 */
export const useContextMenuPosition = (options: {
  x: Ref<number>
  y: Ref<number>
  vw: Ref<number>
  vh: Ref<number>
  showAllEmojis: Ref<boolean>
  emojiCount: Ref<number>
}) => {
  const { x, y, vw, vh, showAllEmojis, emojiCount } = options

  /** 菜单实际尺寸 */
  const w = ref(0)
  const h = ref(0)

  /** v-resize 回调：更新菜单尺寸 */
  const handleSize = ({ width, height }: SizePayload) => {
    w.value = width
    h.value = height
  }

  /** 计算主菜单位置（避免溢出视口） */
  const pos = computed(() =>
    clampMenuPosition({
      x: x.value,
      y: y.value,
      w: w.value,
      h: h.value,
      vw: vw.value,
      vh: vh.value
    })
  )

  /** 表情菜单的固定宽度（与 .emoji-container max-w-180px 对齐） */
  const emojiWidth = ref(180)

  /** 根据是否展开全部表情动态计算菜单高度 */
  const emojiHeight = computed(() => {
    return showAllEmojis.value ? 114 : 40
  })

  /** 计算表情菜单位置（在主菜单上方/下方自适应，左右边界回退） */
  const emojiMenuPosition = computed(() => {
    let posX = pos.value.posX
    let posY = pos.value.posY - emojiHeight.value

    const isRightSideMessage = x.value > vw.value / 2

    if (isRightSideMessage) {
      posX = pos.value.posX + w.value - emojiWidth.value
      if (posX < 10) {
        posX = 10
      }
    } else {
      posX = pos.value.posX
      if (posX + emojiWidth.value > vw.value) {
        posX = vw.value - emojiWidth.value - 10
      }
    }

    if (posY < 10) {
      posY = pos.value.posY + 10
    }

    return {
      left: `${posX}px`,
      top: `${posY}px`
    }
  })

  /** 是否需要显示展开更多按钮（表情数量超过 4 个时） */
  const showMoreButton = computed(() => !showAllEmojis.value && emojiCount.value > 4)

  return {
    w,
    h,
    pos,
    emojiWidth,
    emojiHeight,
    emojiMenuPosition,
    showMoreButton,
    handleSize
  }
}
