import { convertFileSrc } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import { computed, nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import defaultAvatarImg from '@/assets/img/win.png'
import { THUMBNAIL_SIZE_LARGE } from '@/common/constants'
import type { AvatarCropperInstance } from '@/components/common/AvatarCropper.vue'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { matrixMediaService } from '@/services/matrix/media/MatrixMediaService'
import { useUserStore } from '@/stores/domains/user/user'
import { hasTauriRuntime } from '@/utils/AppHarness'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('AccountAvatar')

/**
 * 账号设置页的头像展示、选择、裁剪与上传逻辑。
 * 从 `AccountSettings.vue` 下沉，组件只保留模板与跨区块组合。
 */
export function useAccountAvatar() {
  const { t } = useI18n()
  const { showFeedback } = useActionFeedback()
  const userStore = useUserStore()

  const avatarUploading = ref(false)
  const showCropper = ref(false)
  const localImageUrl = ref('')
  const fileInputRef = ref<HTMLInputElement>()
  const cropperRef = ref<AvatarCropperInstance>()

  const userAvatar = computed(() => userStore.currentUserAvatarUrl || '')
  const defaultAvatar = computed(() => defaultAvatarImg)

  const displayAvatarUrl = computed(() => {
    if (userAvatar.value?.startsWith('mxc://')) {
      // 解析统一由 matrixMediaService.getMediaUrl → media/mxcUrl 的 resolveMxcToHttp 承担（SDK 的 mxcUrlToHttp 在 ProfileManager 上，此前误调导致静默失效）。
      // 这里保留 try/catch 兜底：失败时返回 mxc 原值，naive-avatar 会降级到 placeholder。
      try {
        return (
          matrixMediaService.getMediaUrl(userAvatar.value, THUMBNAIL_SIZE_LARGE, THUMBNAIL_SIZE_LARGE) ||
          userAvatar.value
        )
      } catch (err) {
        logger.warn('Failed to resolve avatar mxc URL:', err)
        return userAvatar.value
      }
    }
    return userAvatar.value
  })

  function handleAvatarChange() {
    if (hasTauriRuntime()) {
      openAvatarCropperViaTauri()
    } else {
      fileInputRef.value?.click()
    }
  }

  async function openAvatarCropperViaTauri() {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: 'Images', extensions: ['jpeg', 'jpg', 'png', 'webp'] }]
      })
      if (!selected) return

      const filePath = typeof selected === 'string' ? selected : (selected as string)

      // 直接使用 convertFileSrc 将本地路径转为 WebView 可访问的 asset URL
      const assetUrl = convertFileSrc(filePath)
      localImageUrl.value = assetUrl
      nextTick(() => {
        showCropper.value = true
      })
    } catch (error) {
      logger.error('Failed to open file picker:', error)
    }
  }

  function processImageFile(file: File) {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      showFeedback(t('setting.account.avatar_format_invalid'), 'error')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      showFeedback(t('setting.account.avatar_too_large'), 'error')
      return
    }

    const url = URL.createObjectURL(file)
    localImageUrl.value = url
    showCropper.value = true
  }

  function handleFileSelect(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0]
    if (!file) return

    processImageFile(file)

    if (fileInputRef.value) {
      fileInputRef.value.value = ''
    }
  }

  async function handleCrop(blob: Blob) {
    avatarUploading.value = true

    try {
      const mimeType = blob.type || 'image/png'
      const ext = mimeType.split('/')[1] || 'png'
      const fileName = `avatar_${Date.now()}.${ext}`
      const file = new File([blob], fileName, { type: mimeType })

      const uploadResult = await matrixMediaService.uploadImage(file)

      const mxcUrl = uploadResult.contentUri

      // 只通过 userStore 更新头像（内部会调用 profileService.setAvatarUrl）
      await userStore.updateAvatar(mxcUrl)

      // 清除头像缓存，确保 UI 显示新头像
      AvatarUtils.clearCache()

      showFeedback(t('setting.account.avatar_updated'), 'success')
      showCropper.value = false

      if (localImageUrl.value) {
        URL.revokeObjectURL(localImageUrl.value)
        localImageUrl.value = ''
      }
    } catch (error) {
      logger.error('Failed to upload avatar', error)
      showFeedback(t('setting.account.avatar_update_failed_retry'), 'error')
      cropperRef.value?.finishLoading()
    } finally {
      avatarUploading.value = false
    }
  }

  return {
    avatarUploading,
    showCropper,
    localImageUrl,
    fileInputRef,
    cropperRef,
    defaultAvatar,
    displayAvatarUrl,
    handleAvatarChange,
    handleFileSelect,
    handleCrop
  }
}
