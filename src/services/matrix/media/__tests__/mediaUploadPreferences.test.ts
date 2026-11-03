import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { matrixMediaService } from '../MatrixMediaService'
import { applyMediaUploadPreferences } from '../mediaUploadPreferences'

describe('applyMediaUploadPreferences', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.restoreAllMocks()
  })

  it('把三项偏好施加到媒体服务', () => {
    const setEnableCompression = vi.spyOn(matrixMediaService, 'setEnableCompression')
    const setCompressOptions = vi.spyOn(matrixMediaService, 'setCompressOptions')
    const setEnableChunkUpload = vi.spyOn(matrixMediaService, 'setEnableChunkUpload')

    applyMediaUploadPreferences()

    expect(setEnableCompression).toHaveBeenCalledWith(true)
    expect(setCompressOptions).toHaveBeenCalledWith({ quality: 0.8 })
    expect(setEnableChunkUpload).toHaveBeenCalledWith(true)
  })

  it('关闭压缩与分块时同样透传', () => {
    const store = useSettingStore()
    store.setUploadCompressEnabled(false)
    store.setUploadCompressQuality(0.6)
    store.setUploadChunkEnabled(false)
    const setEnableCompression = vi.spyOn(matrixMediaService, 'setEnableCompression')
    const setCompressOptions = vi.spyOn(matrixMediaService, 'setCompressOptions')
    const setEnableChunkUpload = vi.spyOn(matrixMediaService, 'setEnableChunkUpload')

    applyMediaUploadPreferences()

    expect(setEnableCompression).toHaveBeenCalledWith(false)
    expect(setCompressOptions).toHaveBeenCalledWith({ quality: 0.6 })
    expect(setEnableChunkUpload).toHaveBeenCalledWith(false)
  })
})
