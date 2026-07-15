const vw = ref(document.documentElement.clientWidth)
const vh = ref(document.documentElement.clientHeight)

let listenerRegistered = false
const onResize = () => {
  vw.value = document.documentElement.clientWidth
  vh.value = document.documentElement.clientHeight
}

/** 获取视口的宽高 */
export const useViewport = () => {
  if (!listenerRegistered) {
    window.addEventListener('resize', onResize)
    listenerRegistered = true
  }

  if (getCurrentScope()) {
    onScopeDispose(() => {
      window.removeEventListener('resize', onResize)
      listenerRegistered = false
    })
  }

  return {
    vw,
    vh
  }
}
