/**
 * @deprecated 此文件已废弃，Matrix 不需要七牛配置
 * 请使用 Matrix 媒体服务器配置
 * 迁移完成后此文件将被删除
 */
import { defineStore } from 'pinia'
import { StoresEnum } from '@/enums'

export const useConfigStore = defineStore(StoresEnum.CONFIG, () => {
  const config = ref<any>({})

  const initConfig = async () => {
    config.value = {}
  }

  const getQiNiuConfig = () => config.value.qiNiu

  return { config, initConfig, getQiNiuConfig }
})
