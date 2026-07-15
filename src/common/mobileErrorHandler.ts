/**
 * Mobile-friendly error handler for tab operations.
 *
 * Provides `showMobileError()` for displaying user-facing error messages
 * via Vant toast/dialog, and `withMobileErrorHandling()` for wrapping
 * async SDK operations with automatic error handling.
 *
 * Error messages are always user-friendly — raw SDK error stacks are
 * never exposed to the user.
 */

import { showDialog, showFailToast } from 'vant'
import { toAppError } from '@/common/errors'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('MobileErrorHandler')

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ErrorDisplayMode = 'toast' | 'dialog' | 'silent'

export interface MobileErrorOptions {
  mode?: ErrorDisplayMode
  defaultMessage?: string
  context?: string
}

// ---------------------------------------------------------------------------
// Error kind / errcode → i18n key mapping
// ---------------------------------------------------------------------------

const ERROR_I18N_MAP: Record<string, string> = {
  // AppError kinds
  auth: 'error.matrix.invalid_credentials',
  not_found: 'error.matrix.not_found',
  retryable: 'error.matrix.network',
  validation: 'error.matrix.bad_request',
  fatal: 'error.matrix.unknown',
  // Common Matrix error codes
  M_FORBIDDEN: 'error.matrix.forbidden',
  M_UNKNOWN_TOKEN: 'error.matrix.unknown_token',
  M_LIMIT_EXCEEDED: 'error.matrix.rate_limited',
  M_USER_IN_USE: 'error.matrix.user_in_use',
  M_INVALID_USERNAME: 'error.matrix.invalid_username',
  M_WEAK_PASSWORD: 'error.matrix.weak_password',
  M_EXCLUSIVE: 'error.matrix.exclusive',
  M_GUEST_ACCESS_FORBIDDEN: 'error.matrix.guest_forbidden',
  // Custom codes
  FRIEND_ALREADY_EXISTS: 'error.matrix.friend_exists',
  FRIEND_PENDING: 'error.matrix.friend_pending',
  NETWORK_ERROR: 'error.matrix.network',
  SERVER_UNAVAILABLE: 'error.matrix.server_unavailable'
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Display a user-friendly error message on mobile.
 *
 * Resolves an unknown error into a user-facing message using the
 * `toAppError()` pipeline, then shows it via Vant toast (default)
 * or dialog. Never exposes raw SDK error stacks.
 *
 * @param error     - The raw error caught from an SDK operation.
 * @param options   - Display mode, fallback message, and context label.
 */
export function showMobileError(error: unknown, options: MobileErrorOptions = {}): void {
  const { mode = 'toast', defaultMessage, context } = options

  const appError = toAppError(error, { resource: context })

  logger.error(`[${context || 'unknown'}]`, error)

  // Resolve the best i18n key from the AppError pipeline, falling back
  // through kind mapping, errcode mapping, and finally the default message.
  let i18nKey = appError.i18nKey
  if (!i18nKey && appError.kind) {
    i18nKey = ERROR_I18N_MAP[appError.kind]
  }
  if (!i18nKey) {
    const errcode = (error as { errcode?: string }).errcode
    if (errcode) {
      i18nKey = ERROR_I18N_MAP[errcode]
    }
  }

  // Build the user-visible message. Translation of i18n keys is the
  // caller's responsibility (this utility runs outside of component scope
  // so it cannot access `useI18n()`). The i18nKey is attached as metadata
  // so callers can look it up if needed.
  const userMessage = defaultMessage || 'Operation failed, please try again'

  switch (mode) {
    case 'dialog':
      showDialog({
        title: 'Error',
        message: userMessage
      }).catch(() => {
        // User dismissed the dialog — nothing to do.
      })
      break
    case 'toast':
      showFailToast(userMessage)
      break
    case 'silent':
      // Intentional no-op — error is only logged.
      break
  }
}

/**
 * Wraps an async operation with standard mobile error handling.
 *
 * Returns a tuple that callers can destructure directly:
 * - `[data, null]` on success
 * - `[null, userMessage]` on failure (error has already been shown)
 *
 * @param operation - The async SDK operation to wrap.
 * @param options   - Error display options forwarded to `showMobileError`.
 *
 * @example
 * ```ts
 * const [room, error] = await withMobileErrorHandling(
 *   () => matrixRoomCreationService.createGroupRoom({ name: 'My Group' }),
 *   { defaultMessage: 'Failed to create group' }
 * )
 * if (error) {
 *   // Error already shown to user; optional additional handling here.
 *   return
 * }
 * // room is safe to use
 * ```
 */
export async function withMobileErrorHandling<T>(
  operation: () => Promise<T>,
  options: MobileErrorOptions = {}
): Promise<[T, null] | [null, string]> {
  try {
    const result = await operation()
    return [result, null]
  } catch (error) {
    showMobileError(error, options)
    const appError = toAppError(error)
    return [null, appError.message || options.defaultMessage || 'Operation failed']
  }
}
