import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

const ADMIN_PERMISSION_DENIED = 'ADMIN_PERMISSION_DENIED'

export function useAdminErrorHandler() {
  const router = useRouter()
  const { t } = useI18n()

  function handleAdminError(err: unknown, fallbackMessage?: string): string {
    if (err instanceof Error && err.message === ADMIN_PERMISSION_DENIED) {
      router.replace('/404')
      return ''
    }
    return fallbackMessage || t('common.error')
  }

  return { handleAdminError, ADMIN_PERMISSION_DENIED }
}
