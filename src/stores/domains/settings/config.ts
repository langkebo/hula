/**
 * @deprecated 此文件已废弃，Matrix 不需要旧对象存储配置
 * 请使用 Matrix 媒体服务器配置
 * 迁移完成后此文件将被删除
 */
import { defineStore } from 'pinia'
import { StoresEnum } from '@/enums'

export const useConfigStore = defineStore(StoresEnum.CONFIG, () => {
  const config = ref<Record<string, unknown>>({})

  const initConfig = async () => {
    config.value = {}
  }

  return { config, initConfig }
})
