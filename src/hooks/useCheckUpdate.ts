import { useSettingStore } from '@/stores/domains/settings/setting'

/**
 * 检查更新
 * 注意：自动更新功能已禁用
 */
export const useCheckUpdate = () => {
  const _settingStore = useSettingStore()
  // 检查更新周期
  const CHECK_UPDATE_TIME = 30 * 60 * 1000
  // 在未登录情况下缩短检查周期
  const CHECK_UPDATE_LOGIN_TIME = 5 * 60 * 1000

  /**
   * 检查更新
   * 注意：自动更新功能已禁用，此函数目前不执行任何操作
   * @param _closeWin 需要关闭的窗口（未使用）
   * @param _initialCheck 是否是初始检查（未使用）
   */
  const checkUpdate = async (_closeWin: string, _initialCheck: boolean = false) => {
    // 自动更新功能已禁用
  }

  return {
    checkUpdate,
    CHECK_UPDATE_TIME,
    CHECK_UPDATE_LOGIN_TIME
  }
}
