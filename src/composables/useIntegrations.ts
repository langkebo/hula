import { computed, getCurrentScope, onScopeDispose, type Ref, ref } from 'vue'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('useIntegrations')

const STORAGE_KEYS = {
  state: 'hula-integrations-state',
  enabled: 'hula-integrations-enabled',
  permissions: 'hula-integrations-permissions'
} as const

export interface IntegrationCatalogItem {
  id: string
  name: string
  description: string
  version: string
  icon?: string
}

export interface Integration extends IntegrationCatalogItem {
  enabled: boolean
}

export interface IntegrationPermissions {
  userInfo: boolean
  roomList: boolean
  sendMessage: boolean
}

interface PersistedIntegrationState {
  version: 1
  enabled: boolean
  permissions: IntegrationPermissions
  installed: Array<{ id: string; enabled: boolean }>
  availableIds: string[]
}

interface IntegrationCatalog {
  installed: Integration[]
  available: IntegrationCatalogItem[]
}

interface UseIntegrationsResult {
  loading: Ref<boolean>
  integrationsEnabled: Ref<boolean>
  searchQuery: Ref<string>
  integrations: Ref<Integration[]>
  availableIntegrations: Ref<IntegrationCatalogItem[]>
  filteredAvailableIntegrations: Ref<IntegrationCatalogItem[]>
  permissions: Ref<IntegrationPermissions>
  setIntegrationsEnabled: (value: boolean) => void
  setSearchQuery: (value: string) => void
  setIntegrationEnabled: (id: string, enabled: boolean) => boolean
  installIntegration: (id: string, delayMs?: number) => Promise<Integration | null>
  removeIntegration: (id: string) => boolean
  setPermission: (key: keyof IntegrationPermissions, value: boolean) => void
  searchAvailableIntegrations: (query?: string) => number
}

interface CreateDefaultIntegrationsCatalogOptions {
  translate?: (key: string) => string
}

const defaultPermissions: IntegrationPermissions = {
  userInfo: true,
  roomList: false,
  sendMessage: false
}

const clonePermissions = (value: IntegrationPermissions): IntegrationPermissions => ({
  userInfo: Boolean(value.userInfo),
  roomList: Boolean(value.roomList),
  sendMessage: Boolean(value.sendMessage)
})

const uniqueStrings = (values: string[]) => {
  const result: string[] = []
  const seen = new Set<string>()
  for (const value of values) {
    if (!value || seen.has(value)) continue
    seen.add(value)
    result.push(value)
  }
  return result
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })

const isBrowser = () => typeof window !== 'undefined' && typeof localStorage !== 'undefined'

const readJson = <T>(key: string): T | null => {
  if (!isBrowser()) return null
  const raw = localStorage.getItem(key)
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch (error) {
    logger.error(`Failed to parse localStorage key: ${key}`, error)
    return null
  }
}

const writeJson = (key: string, value: unknown) => {
  if (!isBrowser()) return
  localStorage.setItem(key, JSON.stringify(value))
}

export function createDefaultIntegrationsCatalog(
  options: CreateDefaultIntegrationsCatalogOptions = {}
): IntegrationCatalog {
  const t = (key: string, fallback: string) => options.translate?.(key) || fallback

  return {
    installed: [
      {
        id: 'github',
        name: 'GitHub',
        description: t('mobile_integrations.integration_github', '接收 GitHub 通知和问题更新'),
        version: '1.2.0',
        icon: 'mdi:github',
        enabled: true
      },
      {
        id: 'giphy',
        name: 'Giphy',
        description: t('mobile_integrations.integration_giphy', '搜索和发送 GIF 动图'),
        version: '2.0.1',
        icon: 'mdi:gif',
        enabled: false
      }
    ],
    available: [
      {
        id: 'jira',
        name: 'Jira',
        description: t('mobile_integrations.integration_jira', '接收 Jira 任务更新'),
        version: '1.0.0',
        icon: 'mdi:jira'
      },
      {
        id: 'google-calendar',
        name: 'Google Calendar',
        description: t('mobile_integrations.integration_calendar', '同步日历事件和提醒'),
        version: '1.1.0',
        icon: 'mdi:calendar'
      }
    ]
  }
}

export function useIntegrations(catalog: IntegrationCatalog): UseIntegrationsResult {
  const loading = ref(false)
  const integrationsEnabled = ref(true)
  const searchQuery = ref('')
  const permissions = ref<IntegrationPermissions>({ ...defaultPermissions })

  const catalogMap = new Map<string, IntegrationCatalogItem>()
  for (const item of [...catalog.installed, ...catalog.available]) {
    catalogMap.set(item.id, {
      id: item.id,
      name: item.name,
      description: item.description,
      version: item.version,
      icon: item.icon
    })
  }

  const defaultInstalledStates = uniqueStrings(catalog.installed.map((item) => item.id)).map((id) => ({
    id,
    enabled: Boolean(catalog.installed.find((item) => item.id === id)?.enabled)
  }))
  const defaultAvailableIds = uniqueStrings(catalog.available.map((item) => item.id)).filter(
    (id) => !defaultInstalledStates.some((item) => item.id === id)
  )

  const installedStates = ref<Array<{ id: string; enabled: boolean }>>(defaultInstalledStates)
  const availableIds = ref<string[]>(defaultAvailableIds)

  const normalizeInstalled = (items: Array<{ id: string; enabled: boolean }>) =>
    uniqueStrings(items.map((item) => item.id))
      .filter((id) => catalogMap.has(id))
      .map((id) => ({
        id,
        enabled: Boolean(items.find((item) => item.id === id)?.enabled)
      }))

  const normalizeAvailable = (ids: string[], nextInstalled = installedStates.value) =>
    uniqueStrings(ids).filter((id) => catalogMap.has(id) && !nextInstalled.some((item) => item.id === id))

  const persistState = () => {
    if (!isBrowser()) return
    const state: PersistedIntegrationState = {
      version: 1,
      enabled: integrationsEnabled.value,
      permissions: clonePermissions(permissions.value),
      installed: installedStates.value.map((item) => ({ ...item })),
      availableIds: [...availableIds.value]
    }
    writeJson(STORAGE_KEYS.state, state)
    localStorage.setItem(STORAGE_KEYS.enabled, String(integrationsEnabled.value))
    writeJson(STORAGE_KEYS.permissions, permissions.value)
  }

  const loadState = () => {
    if (!isBrowser()) return

    const persisted = readJson<PersistedIntegrationState>(STORAGE_KEYS.state)
    if (persisted && persisted.version === 1) {
      integrationsEnabled.value = Boolean(persisted.enabled)
      permissions.value = clonePermissions(persisted.permissions || defaultPermissions)
      installedStates.value = normalizeInstalled(Array.isArray(persisted.installed) ? persisted.installed : [])
      availableIds.value = normalizeAvailable(Array.isArray(persisted.availableIds) ? persisted.availableIds : [])
      return
    }

    const legacyEnabled = localStorage.getItem(STORAGE_KEYS.enabled)
    if (legacyEnabled) {
      integrationsEnabled.value = legacyEnabled === 'true'
    }

    const legacyPermissions = readJson<IntegrationPermissions>(STORAGE_KEYS.permissions)
    if (legacyPermissions) {
      permissions.value = clonePermissions(legacyPermissions)
    }
  }

  const integrations = computed<Integration[]>(() =>
    installedStates.value
      .map((state) => {
        const item = catalogMap.get(state.id)
        if (!item) return null
        return { ...item, enabled: state.enabled }
      })
      .filter((item): item is Integration => Boolean(item))
  )

  const availableIntegrations = computed<IntegrationCatalogItem[]>(() =>
    availableIds.value
      .map((id) => catalogMap.get(id) || null)
      .filter((item): item is IntegrationCatalogItem => Boolean(item))
  )

  const filteredAvailableIntegrations = computed<IntegrationCatalogItem[]>(() => {
    const query = searchQuery.value.trim().toLowerCase()
    if (!query) return availableIntegrations.value
    return availableIntegrations.value.filter(
      (item) => item.name.toLowerCase().includes(query) || item.description.toLowerCase().includes(query)
    )
  })

  const setIntegrationsEnabled = (value: boolean) => {
    integrationsEnabled.value = value
    persistState()
  }

  const setSearchQuery = (value: string) => {
    searchQuery.value = value
  }

  const setIntegrationEnabled = (id: string, enabled: boolean) => {
    const target = installedStates.value.find((item) => item.id === id)
    if (!target) return false
    target.enabled = enabled
    persistState()
    return true
  }

  const installIntegration = async (id: string, delayMs = 0): Promise<Integration | null> => {
    const item = catalogMap.get(id)
    if (!item) return null

    loading.value = true
    try {
      if (delayMs > 0) {
        await sleep(delayMs)
      }

      const existing = installedStates.value.find((entry) => entry.id === id)
      if (existing) {
        existing.enabled = true
      } else {
        installedStates.value = [...installedStates.value, { id, enabled: true }]
      }
      availableIds.value = normalizeAvailable(availableIds.value.filter((entryId) => entryId !== id))
      persistState()
      return { ...item, enabled: true }
    } finally {
      loading.value = false
    }
  }

  const removeIntegration = (id: string) => {
    if (!installedStates.value.some((item) => item.id === id)) return false
    installedStates.value = installedStates.value.filter((item) => item.id !== id)
    availableIds.value = normalizeAvailable([...availableIds.value, id], installedStates.value)
    persistState()
    return true
  }

  const setPermission = (key: keyof IntegrationPermissions, value: boolean) => {
    permissions.value = {
      ...permissions.value,
      [key]: value
    }
    persistState()
  }

  const searchAvailableIntegrations = (query = searchQuery.value) => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) {
      return availableIntegrations.value.length
    }
    return availableIntegrations.value.filter(
      (item) => item.name.toLowerCase().includes(normalized) || item.description.toLowerCase().includes(normalized)
    ).length
  }

  loadState()

  if (isBrowser()) {
    const handleStorage = (event: StorageEvent) => {
      if (event.storageArea !== localStorage) return
      if (
        !event.key ||
        Object.values(STORAGE_KEYS).includes(event.key as (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS])
      ) {
        loadState()
      }
    }

    window.addEventListener('storage', handleStorage)
    if (getCurrentScope()) {
      onScopeDispose(() => {
        window.removeEventListener('storage', handleStorage)
      })
    }
  }

  return {
    loading,
    integrationsEnabled,
    searchQuery,
    integrations,
    availableIntegrations,
    filteredAvailableIntegrations,
    permissions,
    setIntegrationsEnabled,
    setSearchQuery,
    setIntegrationEnabled,
    installIntegration,
    removeIntegration,
    setPermission,
    searchAvailableIntegrations
  }
}
