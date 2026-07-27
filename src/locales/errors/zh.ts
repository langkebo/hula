/**
 * §9.3.5 错误文案中心化 — 中文文案（按 errcode 维度）
 *
 * 作为 errcode → 用户可读文案的单一事实源，供 useActionFeedback 及
 * 其他需要在 i18n 加载前/外展示错误文案的场景使用。
 */
export const errorMessagesZh: Record<string, string> = {
  // 认证类
  M_FORBIDDEN: '权限不足，无法执行此操作',
  M_UNKNOWN_TOKEN: '会话已过期，请重新登录',
  M_MISSING_TOKEN: '未登录或会话丢失，请重新登录',
  UNAUTHORIZED: '会话已过期，请重新登录',
  FORBIDDEN: '权限不足，无法执行此操作',
  M_GUEST_ACCESS_FORBIDDEN: '访客无法执行此操作，请注册或登录',

  // 限流类
  M_LIMIT_EXCEEDED: '请求过于频繁，请稍后重试',

  // 资源不存在
  M_NOT_FOUND: '请求的资源不存在',
  M_THREEPID_NOT_FOUND: '未找到该邮箱/手机号',

  // 参数校验类
  M_BAD_JSON: '请求参数有误',
  M_NOT_JSON: '请求参数有误',
  M_USER_IN_USE: '用户名已被占用',
  M_INVALID_USERNAME: '用户名格式无效',
  M_WEAK_PASSWORD: '密码强度不足',
  M_EXCLUSIVE: '该操作为排他性操作',
  M_THREEPID_IN_USE: '该邮箱/手机号已被占用',
  M_ROOM_IN_USE: '房间已被占用',
  M_INVALID_ROOM_STATE: '房间状态无效',
  M_UNSUPPORTED_ROOM_VERSION: '不支持的房间版本',
  M_INCOMPATIBLE_ROOM_VERSION: '不兼容的房间版本',

  // 好友扩展
  FRIEND_ALREADY_EXISTS: '好友关系已存在',
  FRIEND_REQUEST_PENDING: '好友请求待处理中',

  // 传输类
  NETWORK_ERROR: '网络连接中断，请检查网络设置',
  TIMEOUT: '请求超时，请稍后重试',
  ABORT: '请求已取消',
  TLS_ERROR: '安全连接失败，请检查证书配置',

  // 服务端
  HTTP_500: '服务器暂时不可用，请稍后重试',
  HTTP_502: '网关错误，请稍后重试',
  HTTP_503: '服务暂不可用，请稍后重试',
  HTTP_504: '网关超时，请稍后重试',

  // 兜底
  UNKNOWN: '操作失败，请稍后重试'
}
