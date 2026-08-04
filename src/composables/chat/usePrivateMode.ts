import { computed, ref } from 'vue'
import { useMitt } from '@/composables/common/useMitt'
import { MittEnum } from '@/enums'

export function usePrivateMode() {
  const privateModeActive = ref(false)
  const showPrivateConfirm = ref(false)
  const burnEnabled = ref(false)
  const burnDuration = ref(60)

  const privateModeFeatures = computed(() => [
    {
      title: '端到端加密',
      description: '消息在发送端加密，仅收件人可解密',
      icon: '#lock',
      iconClass: 'text-[--tjg-color-primary-500]'
    },
    {
      title: '阅后即焚',
      description: '消息可设为自动销毁，阅读后即删除',
      icon: '#fire',
      iconClass: 'text-[--tjg-color-danger-500]'
    },
    {
      title: '防截屏',
      description: '启用截屏水印与防截屏保护',
      icon: '#shield',
      iconClass: 'text-[--tjg-color-warning-500]'
    },
    {
      title: '不留存',
      description: '服务器不存储消息内容，仅传输',
      icon: '#delete',
      iconClass: 'text-[--tjg-text-tertiary]'
    }
  ])

  function togglePrivateMode() {
    if (privateModeActive.value) {
      privateModeActive.value = false
      burnEnabled.value = false
      useMitt.emit(MittEnum.PRIVATE_MODE_CHANGED, false)
    } else {
      showPrivateConfirm.value = true
    }
  }

  function confirmPrivateMode() {
    privateModeActive.value = true
    showPrivateConfirm.value = false
    useMitt.emit(MittEnum.PRIVATE_MODE_CHANGED, true)
  }

  function cancelPrivateMode() {
    showPrivateConfirm.value = false
  }

  return {
    privateModeActive,
    showPrivateConfirm,
    burnEnabled,
    burnDuration,
    privateModeFeatures,
    togglePrivateMode,
    confirmPrivateMode,
    cancelPrivateMode
  }
}
