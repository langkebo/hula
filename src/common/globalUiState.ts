import { ref } from 'vue'

const isTrayMenuShow = ref<boolean>(false)

export function setTrayMenuShow(visible: boolean): boolean {
  isTrayMenuShow.value = visible
  return isTrayMenuShow.value
}
