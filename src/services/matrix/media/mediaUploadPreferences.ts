import { useSettingStore } from '@/stores/domains/settings/setting'
import { matrixMediaService } from './MatrixMediaService'

/**
 * 把用户的媒体上传偏好施加到服务层。
 *
 * 服务层不 import Pinia：由启动期与设置页显式调用本胶水层，
 * 保证 `MatrixMediaService` 仍可脱离 store 单测。
 */
export function applyMediaUploadPreferences(): void {
  const settingStore = useSettingStore()
  matrixMediaService.setEnableCompression(settingStore.uploadCompressEnabled)
  matrixMediaService.setCompressOptions({ quality: settingStore.uploadCompressQuality })
  matrixMediaService.setEnableChunkUpload(settingStore.uploadChunkEnabled)
}
