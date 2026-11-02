/**
 * 检查更新
 * 注意：自动更新功能已禁用
 */
export const useCheckUpdate = () => {
  // 检查更新周期
  const CHECK_UPDATE_TIME = 30 * 60 * 1000
  // 在未登录情况下缩短检查周期
  const CHECK_UPDATE_LOGIN_TIME = 5 * 60 * 1000

  /**
   * 检查更新
   * 注意：自动更新功能已禁用，此函数目前不执行任何操作
   */
  const checkUpdate = async () => {
    // 自动更新功能已禁用
  }

  return {
    checkUpdate,
    CHECK_UPDATE_TIME,
    CHECK_UPDATE_LOGIN_TIME
  }
}
