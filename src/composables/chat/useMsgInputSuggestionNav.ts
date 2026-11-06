import { onKeyStroke } from '@vueuse/core'
import type { VirtualListInst } from 'naive-ui'
import type { Ref } from 'vue'
import type { AIModel, UserItem } from '@/services/types.ts'

interface Options {
  ait: Ref<boolean>
  aiDialogVisible: Ref<boolean>
  personList: Ref<UserItem[]>
  groupedAIModels: Ref<AIModel[]>
  selectedAitKey: Ref<string | null>
  selectedAIKey: Ref<string | null>
  virtualListInstAit: Ref<VirtualListInst | undefined>
  virtualListInstAI: Ref<VirtualListInst | undefined>
  handleAit: (item: UserItem) => void
}

/**
 * @ 提及框与 / 指令框的键盘导航、候选列表回位、弹层外部点击关闭与全选拦截。
 */
export const useMsgInputSuggestionNav = ({
  ait,
  aiDialogVisible,
  personList,
  groupedAIModels,
  selectedAitKey,
  selectedAIKey,
  virtualListInstAit,
  virtualListInstAI,
  handleAit
}: Options) => {
  const keyStrokeStops: Array<() => void> = []

  const handleAitKeyChange = <T extends { uid: string }>(
    direction: 1 | -1,
    list: Ref<T[]>,
    virtualListInst: VirtualListInst | undefined,
    key: Ref<string | null>
  ) => {
    const currentIndex = list.value.findIndex((item) => item.uid === key.value)
    const newIndex = Math.max(0, Math.min(currentIndex + direction, list.value.length - 1))
    const item = list.value[newIndex]
    if (item) {
      key.value = item.uid
      virtualListInst?.scrollTo({ index: newIndex })
    }
  }

  watch(personList, (newList) => {
    if (newList.length > 0) {
      virtualListInstAit.value?.scrollTo({ key: newList[0].uid })
      selectedAitKey.value = newList[0].uid
    } else {
      ait.value = false
    }
  })

  const closeMenu = (event: MouseEvent) => {
    if (event.target instanceof HTMLElement && !event.target.matches('#message-input, #message-input *')) {
      ait.value = false
    }
  }

  const disableSelectAll = (e: KeyboardEvent) => {
    if (e.ctrlKey && e.key === 'a') {
      const inputDiv = document.getElementById('message-input')
      const hasFocus = document.activeElement === inputDiv
      const hasContent = inputDiv?.textContent && inputDiv.textContent.trim().length > 0
      if (!hasFocus || !hasContent) e.preventDefault()
    }
  }

  onMounted(() => {
    keyStrokeStops.push(
      onKeyStroke('Enter', () => {
        if (ait.value && Number(selectedAitKey.value) > -1) {
          const item = personList.value.find((item) => item.uid === selectedAitKey.value)
          if (item) handleAit(item)
        }
      })
    )
    keyStrokeStops.push(
      onKeyStroke('ArrowUp', (e) => {
        e.preventDefault()
        if (ait.value) {
          handleAitKeyChange(-1, personList, virtualListInstAit.value, selectedAitKey)
        } else if (aiDialogVisible.value) {
          handleAitKeyChange(-1, groupedAIModels, virtualListInstAI.value, selectedAIKey)
        }
      })
    )
    keyStrokeStops.push(
      onKeyStroke('ArrowDown', (e) => {
        e.preventDefault()
        if (ait.value) {
          handleAitKeyChange(1, personList, virtualListInstAit.value, selectedAitKey)
        } else if (aiDialogVisible.value) {
          handleAitKeyChange(1, groupedAIModels, virtualListInstAI.value, selectedAIKey)
        }
      })
    )
    window.addEventListener('click', closeMenu, true)
    window.addEventListener('keydown', disableSelectAll)
  })

  onUnmounted(() => {
    window.removeEventListener('click', closeMenu, true)
    window.removeEventListener('keydown', disableSelectAll)
    keyStrokeStops.forEach((stop) => stop())
    keyStrokeStops.length = 0
  })
}
