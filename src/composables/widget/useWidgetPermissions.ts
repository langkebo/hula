import { type Ref, ref } from 'vue'
import { matrixWidgetService } from '@/services/matrix/widget/MatrixWidgetService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('useWidgetPermissions')

export interface PermissionRow {
  userId: string
  permissions: string[]
}

interface UseWidgetPermissionsResult {
  rows: Ref<PermissionRow[]>
  loading: Ref<boolean>
  mutating: Ref<boolean>
  error: Ref<string | null>
  load: (widgetId: string) => Promise<void>
  grant: (widgetId: string, userId: string, permissions: string[]) => Promise<boolean>
  revoke: (widgetId: string, userId: string) => Promise<boolean>
}

/**
 * Accept both `{ permissions: [{ user_id, permissions|actions }] }` list-shape and
 * `{ <userId>: string[] }` map-shape backends. Discard entries that don't match either.
 */
export function parsePermissionsResponse(response: unknown): PermissionRow[] {
  if (!response || typeof response !== 'object') return []
  const obj = response as Record<string, unknown>
  const list = obj.permissions
  if (Array.isArray(list)) {
    return list
      .map((entry) => {
        if (!entry || typeof entry !== 'object') return null
        const e = entry as Record<string, unknown>
        const userId = (e.user_id ?? e.userId) as string | undefined
        const perms = (e.permissions ?? e.actions) as string[] | undefined
        if (!userId || !Array.isArray(perms)) return null
        return { userId, permissions: perms }
      })
      .filter((x): x is PermissionRow => x !== null)
  }
  return Object.entries(obj)
    .filter(([, v]) => Array.isArray(v))
    .map(([userId, v]) => ({ userId, permissions: v as string[] }))
}

export function useWidgetPermissions(): UseWidgetPermissionsResult {
  const rows = ref<PermissionRow[]>([])
  const loading = ref(false)
  const mutating = ref(false)
  const error = ref<string | null>(null)

  const load = async (widgetId: string) => {
    loading.value = true
    error.value = null
    try {
      const response = await matrixWidgetService.getWidgetPermissions(widgetId, false)
      rows.value = parsePermissionsResponse(response)
    } catch (err) {
      logger.error('load permissions failed', err)
      error.value = err instanceof Error ? err.message : String(err)
    } finally {
      loading.value = false
    }
  }

  const grant = async (widgetId: string, userId: string, permissions: string[]): Promise<boolean> => {
    mutating.value = true
    error.value = null
    try {
      await matrixWidgetService.setWidgetPermission(widgetId, userId, permissions, true)
      await load(widgetId)
      return true
    } catch (err) {
      logger.error('grant permission failed', err)
      error.value = err instanceof Error ? err.message : String(err)
      return false
    } finally {
      mutating.value = false
    }
  }

  const revoke = async (widgetId: string, userId: string): Promise<boolean> => {
    mutating.value = true
    error.value = null
    try {
      const ok = await matrixWidgetService.deleteWidgetPermission(widgetId, userId, true)
      if (ok) await load(widgetId)
      return ok
    } catch (err) {
      logger.error('revoke permission failed', err)
      error.value = err instanceof Error ? err.message : String(err)
      return false
    } finally {
      mutating.value = false
    }
  }

  return { rows, loading, mutating, error, load, grant, revoke }
}
