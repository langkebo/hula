/**
 * 桌面端 admin 桥接层。
 *
 * 后台管理只在桌面端存在；移动端按 R2 硬性约束不得引用 admin store。
 * 移动端生产构建通过 alias 把本模块替换为 `src/mobile/stores/adminBridge.ts`
 * （见 vite.config.ts），因此这里对 admin store 的引用不会进入移动端产物。
 */

/** 校验当前用户是否具备后台管理权限（authGuard 对 requiresAdmin 路由使用） */
export const verifyAdminAccess = async (): Promise<boolean> => {
  const { useAdminStore } = await import('@/stores/domains/admin/admin')
  return useAdminStore().verifyAdminAccess()
}

/** 登出时清理后台管理状态，避免下一位登录用户看到上一位的管理数据 */
export const resetAdminState = async (): Promise<void> => {
  const { useAdminStore } = await import('@/stores/domains/admin/admin')
  useAdminStore().clearAdminState()
}
