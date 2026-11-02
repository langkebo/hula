/**
 * 移动端产物中 `@/stores/domains/admin/bridge` 的替身实现（见 vite.config.ts 的 alias）。
 *
 * 移动端按 R2 硬性约束裁剪后台管理：不存在 requiresAdmin 路由，也没有 admin 状态需要清理，
 * 因此这里不引用 admin store。
 */

/** 移动端不注入 admin 校验器，authGuard 对 requiresAdmin 路由一律拒绝 */
export const verifyAdminAccess: (() => Promise<boolean>) | undefined = undefined

/** 移动端不存在 admin 状态，登出清理为空实现 */
export const resetAdminState = async (): Promise<void> => {}
