import type { Ref } from 'vue'
import type { SizePayload } from './useContextMenuTypes'

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
  const pos = computed(() => {
    let posX = x.value
    let posY = y.value
    if (x.value > vw.value - w.value) {
      posX -= w.value
    }
    if (y.value > vh.value - h.value) {
      posY -= y.value - vh.value + h.value
    }
    return { posX, posY }
  })

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
