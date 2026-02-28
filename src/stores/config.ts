/**
 * @deprecated 此文件已废弃，Matrix 不需要七牛配置
 * 请使用 Matrix 媒体服务器配置
 * 迁移完成后此文件将被删除
 */
import { defineStore } from 'pinia'
import { StoresEnum } from '@/enums'
import type { ConfigType } from '@/services/types'
import * as ImRequestUtils from '@/utils/ImRequestUtils'

export const useConfigStore = defineStore(StoresEnum.CONFIG, () => {
  const config = ref<ConfigType>({} as any)

  /** 初始化配置 */
  const initConfig = async () => {
    const res = await ImRequestUtils.initConfig()
    config.value = res
  }

  /** 获取七牛配置 */
  const getQiNiuConfig = () => config.value.qiNiu

  return { config, initConfig, getQiNiuConfig }
})
