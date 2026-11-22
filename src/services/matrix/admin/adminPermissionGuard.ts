/**
 * 非管理员用户的权限拒绝标记。
 *
 * 各 admin 子服务在 catch 中统一识别该错误并降级为 debug：这是正常业务流
 * （普通用户访问管理接口），不是服务异常。
 */
const ADMIN_PERMISSION_DENIED_MSG = 'ADMIN_PERMISSION_DENIED'

export const isAdminPermissionDenied = (err: unknown): boolean => {
  return err instanceof Error && err.message === ADMIN_PERMISSION_DENIED_MSG
}
