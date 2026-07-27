/**
 * §9.3.5 错误文案中心化 — English messages (by errcode).
 *
 * Single source of truth for errcode → user-readable copy, used by
 * useActionFeedback and any caller needing error copy before/outside i18n.
 */
export const errorMessagesEn: Record<string, string> = {
  // Auth
  M_FORBIDDEN: 'You do not have permission to perform this action',
  M_UNKNOWN_TOKEN: 'Your session has expired, please log in again',
  M_MISSING_TOKEN: 'You are not logged in, please log in again',
  UNAUTHORIZED: 'Your session has expired, please log in again',
  FORBIDDEN: 'You do not have permission to perform this action',
  M_GUEST_ACCESS_FORBIDDEN: 'Guests cannot perform this action, please register or log in',

  // Rate limiting
  M_LIMIT_EXCEEDED: 'Too many requests, please try again later',

  // Not found
  M_NOT_FOUND: 'The requested resource was not found',
  M_THREEPID_NOT_FOUND: 'Email/phone not found',

  // Validation
  M_BAD_JSON: 'Invalid request parameters',
  M_NOT_JSON: 'Invalid request parameters',
  M_USER_IN_USE: 'Username is already taken',
  M_INVALID_USERNAME: 'Invalid username format',
  M_WEAK_PASSWORD: 'Password is too weak',
  M_EXCLUSIVE: 'This is an exclusive operation',
  M_THREEPID_IN_USE: 'Email/phone is already in use',
  M_ROOM_IN_USE: 'Room is already in use',
  M_INVALID_ROOM_STATE: 'Invalid room state',
  M_UNSUPPORTED_ROOM_VERSION: 'Unsupported room version',
  M_INCOMPATIBLE_ROOM_VERSION: 'Incompatible room version',

  // Friend extensions
  FRIEND_ALREADY_EXISTS: 'Friendship already exists',
  FRIEND_REQUEST_PENDING: 'Friend request is pending',

  // Transport
  NETWORK_ERROR: 'Network connection lost, please check your network settings',
  TIMEOUT: 'Request timed out, please try again later',
  ABORT: 'Request was cancelled',
  TLS_ERROR: 'Secure connection failed, please check certificate settings',

  // Server
  HTTP_500: 'Server is temporarily unavailable, please try again later',
  HTTP_502: 'Bad gateway, please try again later',
  HTTP_503: 'Service unavailable, please try again later',
  HTTP_504: 'Gateway timeout, please try again later',

  // Fallback
  UNKNOWN: 'Operation failed, please try again later'
}
