import { convertFileSrc } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useI18nGlobal } from '@/services/i18n'
import { matrixMediaService } from '@/services/matrix/media/MatrixMediaService'
import { hasTauriRuntime } from '@/utils/AppHarness'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('AvatarUpload')

interface AvatarUploadOptions {
  // 上传成功后的回调函数，参数为 mxc:// URI
  onSuccess?: (mxcUrl: string) => void
  // 文件大小限制（KB），默认为 5MB（与 Matrix 上传限制一致）
  sizeLimit?: number
}

/**
 * 上传头像的hook
 * 通过 Matrix 媒体上传接口上传头像，返回 mxc:// URI
 * @param options 上传配置
 */
export const useAvatarUpload = (options: AvatarUploadOptions = {}) => {
  const { onSuccess, sizeLimit = 5120 } = options
  const { t } = useI18nGlobal()
  const { showFeedback } = useActionFeedback()

  const fileInput = ref<HTMLInputElement>()
  const localImageUrl = ref('')
  const showCropper = ref(false)
  const cropperRef = ref()

  // 处理选中的图片文件（File 对象），加载到裁剪器
  const processImageFile = (file: File) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      localImageUrl.value = url
      nextTick(() => {
        showCropper.value = true
      })
    }
    img.onerror = () => {
      showFeedback(t('hooks.avatar_upload.image_load_failed'), 'error')
      URL.revokeObjectURL(url)
    }
    img.src = url
  }

  // 打开文件选择器（浏览器环境）
  const openFileSelector = () => {
    fileInput.value?.click()
  }

  // 处理文件选择（浏览器环境的 <input type="file"> 回调）
  const handleFileChange = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (file) {
      processImageFile(file)
    }
  }

  // 通过 Tauri dialog 打开文件选择器并读取图片
  const openAvatarCropperViaTauri = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: 'Images',
            extensions: ['jpeg', 'jpg', 'png', 'webp']
          }
        ]
      })

      if (!selected) return

      const filePath = typeof selected === 'string' ? selected : (selected as string)

      // 直接使用 convertFileSrc 将本地路径转为 WebView 可访问的 asset URL
      // vue-cropper 的 img 属性支持 URL，无需手动读取文件内容
      const assetUrl = convertFileSrc(filePath)
      localImageUrl.value = assetUrl
      nextTick(() => {
        showCropper.value = true
      })
    } catch (error) {
      logger.error('打开文件选择器失败:', error)
      showFeedback(t('hooks.avatar_upload.image_load_failed'), 'error')
    }
  }

  // 校验头像更改条件并打开文件选择器
  const openAvatarCropper = () => {
    if (hasTauriRuntime()) {
      // Tauri 环境：使用系统原生文件选择器
      openAvatarCropperViaTauri()
    } else {
      // 浏览器环境：使用 HTML <input type="file">
      fileInput.value?.click()
    }
  }

  // 处理裁剪 - 通过 Matrix 媒体上传接口上传，返回 mxc:// URI
  const handleCrop = async (cropBlob: Blob) => {
    try {
      const mimeType = cropBlob.type || 'image/png'
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
      if (!allowedTypes.includes(mimeType)) {
        showFeedback(t('hooks.avatar_upload.format_not_supported'), 'error')
        cropperRef.value?.finishLoading()
        return
      }

      // 检查裁剪后的文件大小
      if (cropBlob.size > sizeLimit * 1024) {
        showFeedback(
          t('hooks.avatar_upload.size_exceeded', { sizeLimit, currentSize: Math.round(cropBlob.size / 1024) }),
          'error'
        )
        cropperRef.value?.finishLoading()
        return
      }

      const ext = mimeType.split('/')[1] || 'png'
      const fileName = `avatar_${Date.now()}.${ext}`
      const file = new File([cropBlob], fileName, { type: mimeType })

      // 通过 Matrix 媒体上传接口上传到 Homeserver，获取 mxc:// URI
      const uploadResult = await matrixMediaService.uploadImage(file)
      const mxcUrl = uploadResult.contentUri

      // 调用成功回调
      if (onSuccess) {
        onSuccess(mxcUrl)
      }

      // 清理资源
      if (localImageUrl.value) {
        URL.revokeObjectURL(localImageUrl.value)
      }
      localImageUrl.value = ''
      if (fileInput.value) {
        fileInput.value.value = ''
      }

      // 结束加载状态
      cropperRef.value?.finishLoading()
      // 关闭裁剪窗口
      showCropper.value = false
    } catch (error) {
      logger.error('上传头像失败:', error)
      showFeedback(t('hooks.avatar_upload.upload_failed'), 'error')
      cropperRef.value?.finishLoading()
    }
  }

  return {
    fileInput,
    localImageUrl,
    showCropper,
    cropperRef,
    openFileSelector,
    handleFileChange,
    handleCrop,
    openAvatarCropper
  }
}
