import { ref } from 'vue'

const isTrayMenuShow = ref<boolean>(false)

function _useGlobalUiState() {
  return {
    isTrayMenuShow
  }
}

export function setTrayMenuShow(visible: boolean): boolean {
  isTrayMenuShow.value = visible
  return isTrayMenuShow.value
}

function _getTrayMenuShow(): boolean {
  return isTrayMenuShow.value
}

function _resetGlobalUiStateForTests(): void {
  isTrayMenuShow.value = false
}
