export const GUEST = {
  /** @deprecated 游客注册未接入产品流程，仅保留路径常量 */
  REGISTER: '/register/guest',
  /** @deprecated Use MatrixAuthService.login() instead */
  LOGIN: '/login',
  INFO: '/account/guest'
} as const
