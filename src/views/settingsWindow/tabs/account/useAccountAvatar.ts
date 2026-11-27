import { open } from '@tauri-apps/plugin-dialog'
import { readFile } from '@tauri-apps/plugin-fs'
import { computed, nextTick, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import defaultAvatarImg from '@/assets/img/win.png'
import { THUMBNAIL_SIZE_LARGE } from '@/common/constants'
import type { AvatarCropperInstance } from '@/components/common/AvatarCropper.vue'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useWindowSessionReady } from '@/composables/common/useWindowSessionReady'
import { matrixMediaService } from '@/services/matrix/media/MatrixMediaService'
import { useUserStore } from '@/stores/domains/user/user'
import { hasTauriRuntime } from '@/utils/AppHarness'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('AccountAvatar')

const MAX_AVATAR_FILE_SIZE = 5 * 1024 * 1024
const AVATAR_MIME_BY_EXT: Record<string, string> = {
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp'
}

function readBlobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('FileReader 读取失败'))
    reader.readAsDataURL(blob)
  })
}

function canDecodeImage(src: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(true)
    img.onerror = () => resolve(false)
    img.src = src
  })
}

/**
 * 账号设置页的头像展示、选择、裁剪与上传逻辑。
 * 从 `AccountSettings.vue` 下沉，组件只保留模板与跨区块组合。
 */
export function useAccountAvatar() {
  const { t } = useI18n()
  const { showFeedback } = useActionFeedback()
  const userStore = useUserStore()
  const { ready: sessionReady, ensureSessionReady } = useWindowSessionReady()

  const avatarUploading = ref(false)
  const showCropper = ref(false)
  const localImageUrl = ref('')
  const fileInputRef = ref<HTMLInputElement>()
  const cropperRef = ref<AvatarCropperInstance>()

  const userAvatar = computed(() => userStore.currentUserAvatarUrl || '')
  const defaultAvatar = computed(() => defaultAvatarImg)

  const displayAvatarUrl = computed(() => {
    // 设置窗口是独立 WebView，首帧时 client 尚未恢复，getMediaUrl 无法解析 mxc://。
    // 若此时返回原始 mxc，computed 只依赖 userAvatar，client 就绪后也不会重算，头像会一直空白。
    if (!sessionReady.value) return defaultAvatar.value

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
    return userAvatar.value || defaultAvatar.value
  })

  onMounted(async () => {
    // 独立窗口不执行登录 bootstrap，matrixProfile 为空；会话恢复完成后拉一次本人资料，
    // 保证头像与昵称来自服务端（持久化的 userInfo.avatar 可能为空或过期）。
    if ((await ensureSessionReady()) !== 'ready') return
    if (!userStore.matrixProfile) {
      void userStore.fetchUserProfile()
    }
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

      const filePath = typeof selected === 'string' ? selected : ''
      if (!filePath) return

      const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
      const mimeType = AVATAR_MIME_BY_EXT[ext]
      if (!mimeType) {
        showFeedback(t('setting.account.avatar_format_invalid'), 'error')
        return
      }

      // 与主窗口 useAvatarUpload 保持一致：先读成 data URL 再交给裁剪器。
      // asset:// URL 会被 vue-cropper 的 getCropChecked 当作跨域图片（crossOrigin=Anonymous），
      // 自定义协议不返回 CORS 头，导致画布空白、getCropBlob 回调不触发、上传按钮永久 loading。
      const bytes = await readFile(filePath)
      if (bytes.byteLength > MAX_AVATAR_FILE_SIZE) {
        showFeedback(t('setting.account.avatar_too_large'), 'error')
        return
      }

      const dataUrl = await readBlobAsDataUrl(new Blob([bytes], { type: mimeType }))
      if (!(await canDecodeImage(dataUrl))) {
        logger.warn('[AVATAR_DEBUG] image decode failed:', filePath)
        showFeedback(t('setting.account.avatar_format_invalid'), 'error')
        return
      }

      logger.info('[AVATAR_DEBUG] data URL created, length:', dataUrl.length, 'mime:', mimeType)
      localImageUrl.value = dataUrl
      nextTick(() => {
        showCropper.value = true
      })
    } catch (error) {
      logger.error('Failed to open file picker:', error)
      showFeedback(t('setting.account.avatar_update_failed_retry'), 'error')
    }
  }

  async function processImageFile(file: File) {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      showFeedback(t('setting.account.avatar_format_invalid'), 'error')
      return
    }

    if (file.size > MAX_AVATAR_FILE_SIZE) {
      showFeedback(t('setting.account.avatar_too_large'), 'error')
      return
    }

    const url = URL.createObjectURL(file)
    if (!(await canDecodeImage(url))) {
      URL.revokeObjectURL(url)
      showFeedback(t('setting.account.avatar_format_invalid'), 'error')
      return
    }

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
