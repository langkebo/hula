import { ref } from 'vue'

const isTrayMenuShow = ref<boolean>(false)

export function useGlobalUiState() {
  return {
    isTrayMenuShow
  }
}

export function setTrayMenuShow(visible: boolean): boolean {
  isTrayMenuShow.value = visible
  return isTrayMenuShow.value
}

export function getTrayMenuShow(): boolean {
  return isTrayMenuShow.value
}

export function resetGlobalUiStateForTests(): void {
  isTrayMenuShow.value = false
}
