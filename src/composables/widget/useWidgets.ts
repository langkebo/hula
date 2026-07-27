import { type Ref, ref } from 'vue'
import { matrixWidgetService, type Widget } from '@/services/matrix/widget/MatrixWidgetService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('useWidgets')

interface CreateWidgetInput {
  widgetType: string
  url: string
  name: string
  data?: Record<string, unknown>
}

interface UseWidgetsResult {
  widgets: Ref<Widget[]>
  loading: Ref<boolean>
  mutating: Ref<boolean>
  error: Ref<string | null>
  load: () => Promise<void>
  create: (input: CreateWidgetInput) => Promise<Widget | null>
  remove: (widgetId: string) => Promise<boolean>
  update: (widgetId: string, updates: Partial<Widget>) => Promise<Widget | null>
  createWidgetSession: (
    widgetId: string,
    options?: { deviceId?: string; expiresInMs?: number },
    throwOnError?: boolean
  ) => Promise<Record<string, unknown> | null>
  terminateWidgetSession: (sessionId: string, throwOnError?: boolean) => Promise<boolean>
}

/**
 * Room-scoped widget list state. Shared by desktop `WidgetManager.vue` and its mobile counterpart.
 * `load` uses non-throwing mode so list view always resolves; individual errors surface via `error`.
 */
export function useWidgets(roomId: () => string): UseWidgetsResult {
  const widgets = ref<Widget[]>([])
  const loading = ref(false)
  const mutating = ref(false)
  const error = ref<string | null>(null)

  const load = async () => {
    const id = roomId()
    if (!id) {
      widgets.value = []
      return
    }
    loading.value = true
    error.value = null
    try {
      widgets.value = await matrixWidgetService.getWidgets(id, false)
    } catch (err) {
      logger.error('load widgets failed', err)
      error.value = err instanceof Error ? err.message : String(err)
    } finally {
      loading.value = false
    }
  }

  const create = async (input: CreateWidgetInput): Promise<Widget | null> => {
    const id = roomId()
    if (!id) return null
    mutating.value = true
    error.value = null
    try {
      const result = await matrixWidgetService.createWidget(id, input, true)
      await load()
      return result
    } catch (err) {
      logger.error('create widget failed', err)
      error.value = err instanceof Error ? err.message : String(err)
      return null
    } finally {
      mutating.value = false
    }
  }

  const remove = async (widgetId: string): Promise<boolean> => {
    mutating.value = true
    error.value = null
    try {
      const ok = await matrixWidgetService.deleteWidget(widgetId, true)
      if (ok) await load()
      return ok
    } catch (err) {
      logger.error('delete widget failed', err)
      error.value = err instanceof Error ? err.message : String(err)
      return false
    } finally {
      mutating.value = false
    }
  }

  const update = async (widgetId: string, updates: Partial<Widget>): Promise<Widget | null> => {
    mutating.value = true
    error.value = null
    try {
      const result = await matrixWidgetService.updateWidget(widgetId, updates, true)
      if (result) await load()
      return result
    } catch (err) {
      logger.error('update widget failed', err)
      error.value = err instanceof Error ? err.message : String(err)
      return null
    } finally {
      mutating.value = false
    }
  }

  const createWidgetSession = async (
    widgetId: string,
    options?: { deviceId?: string; expiresInMs?: number },
    throwOnError = false
  ): Promise<Record<string, unknown> | null> => {
    try {
      const result = await matrixWidgetService.createWidgetSession(widgetId, options, throwOnError)
      return result as Record<string, unknown> | null
    } catch (err) {
      logger.error('create widget session failed', err)
      error.value = err instanceof Error ? err.message : String(err)
      return null
    }
  }

  const terminateWidgetSession = async (sessionId: string, throwOnError = false): Promise<boolean> => {
    try {
      return await matrixWidgetService.terminateWidgetSession(sessionId, throwOnError)
    } catch (err) {
      logger.error('terminate widget session failed', err)
      error.value = err instanceof Error ? err.message : String(err)
      return false
    }
  }

  return {
    widgets,
    loading,
    mutating,
    error,
    load,
    create,
    remove,
    update,
    createWidgetSession,
    terminateWidgetSession
  }
}
