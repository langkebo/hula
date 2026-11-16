import { type Ref, ref } from 'vue'
import type {
  FederationBlacklistEntry,
  FederationCacheEntry,
  FederationDestination,
  PendingFederationServer
} from '@/services/matrix/admin'
import { adminFederationService, adminService } from '@/services/matrix/admin'

export type { FederationDestination } from '@/services/matrix/admin'

export interface FederationBlacklistView {
  domain: string
  reason?: string | undefined
  addedBy?: string | undefined
  addedAt?: number | undefined
}

interface UseAdminFederationResult {
  destinations: Ref<FederationDestination[]>
  destinationsLoading: Ref<boolean>
  selectedDestination: Ref<FederationDestination | null>

  blacklist: Ref<FederationBlacklistView[]>
  blacklistLoading: Ref<boolean>

  cacheEntries: Ref<FederationCacheEntry[]>
  cacheLoading: Ref<boolean>
  cacheError: Ref<string | null>

  pendingServers: Ref<PendingFederationServer[]>
  pendingLoading: Ref<boolean>
  pendingError: Ref<string | null>

  loadDestinations: () => Promise<void>
  selectDestination: (destination: FederationDestination | null) => void
  resetFederationConnection: (destination: string) => Promise<void>
  reconnectFederation: (destination: string) => Promise<void>

  loadBlacklist: () => Promise<void>
  addToBlacklist: (domain: string, reason?: string) => Promise<boolean>
  removeFromBlacklist: (domain: string) => Promise<boolean>

  loadCache: () => Promise<void>
  clearCache: () => Promise<boolean>
  removeCacheEntry: (key: string) => Promise<boolean>

  loadPending: () => Promise<void>
  confirmPending: (serverName: string, accept: boolean) => Promise<boolean>
}

function toErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

export function useAdminFederation(): UseAdminFederationResult {
  const destinations = ref<FederationDestination[]>([])
  const destinationsLoading = ref(false)
  const selectedDestination = ref<FederationDestination | null>(null)

  const blacklist = ref<FederationBlacklistView[]>([])
  const blacklistLoading = ref(false)

  const cacheEntries = ref<FederationCacheEntry[]>([])
  const cacheLoading = ref(false)
  const cacheError = ref<string | null>(null)

  const pendingServers = ref<PendingFederationServer[]>([])
  const pendingLoading = ref(false)
  const pendingError = ref<string | null>(null)

  async function loadDestinations() {
    destinationsLoading.value = true
    try {
      destinations.value = await adminService.getFederationDestinations()
    } finally {
      destinationsLoading.value = false
    }
  }

  function selectDestination(destination: FederationDestination | null) {
    selectedDestination.value = destination
  }

  async function resetFederationConnection(destination: string) {
    await adminService.resetFederationConnection(destination)
    await loadDestinations()
  }

  async function reconnectFederation(destination: string) {
    await adminService.reconnectFederation(destination)
    await loadDestinations()
  }

  async function loadBlacklist() {
    blacklistLoading.value = true
    try {
      const items = await adminService.getFederationBlacklist()
      blacklist.value = items.map(
        (e: FederationBlacklistEntry): FederationBlacklistView => ({
          domain: e.domain,
          reason: e.reason,
          addedBy: e.addedBy,
          addedAt: e.addedAt
        })
      )
    } finally {
      blacklistLoading.value = false
    }
  }

  async function addToBlacklist(domain: string, reason?: string): Promise<boolean> {
    const ok = await adminService.addToFederationBlacklist(domain, reason)
    if (ok) await loadBlacklist()
    return ok
  }

  async function removeFromBlacklist(domain: string): Promise<boolean> {
    const ok = await adminService.removeFromFederationBlacklist(domain)
    if (ok) await loadBlacklist()
    return ok
  }

  async function loadCache() {
    cacheLoading.value = true
    cacheError.value = null
    try {
      const page = await adminFederationService.getFederationCache()
      cacheEntries.value = page.entries
    } catch (err) {
      cacheError.value = toErrorMessage(err)
    } finally {
      cacheLoading.value = false
    }
  }

  async function clearCache(): Promise<boolean> {
    cacheError.value = null
    try {
      await adminFederationService.clearFederationCache()
      await loadCache()
      return true
    } catch (err) {
      cacheError.value = toErrorMessage(err)
      return false
    }
  }

  async function removeCacheEntry(key: string): Promise<boolean> {
    cacheError.value = null
    try {
      await adminFederationService.deleteFederationCacheEntry(key)
      await loadCache()
      return true
    } catch (err) {
      cacheError.value = toErrorMessage(err)
      return false
    }
  }

  async function loadPending() {
    pendingLoading.value = true
    pendingError.value = null
    try {
      const page = await adminFederationService.getPendingFederationServers()
      pendingServers.value = page.servers
    } catch (err) {
      pendingError.value = toErrorMessage(err)
    } finally {
      pendingLoading.value = false
    }
  }

  async function confirmPending(serverName: string, accept: boolean): Promise<boolean> {
    pendingError.value = null
    try {
      await adminFederationService.confirmFederation(serverName, accept)
      await loadPending()
      return true
    } catch (err) {
      pendingError.value = toErrorMessage(err)
      return false
    }
  }

  return {
    destinations,
    destinationsLoading,
    selectedDestination,
    blacklist,
    blacklistLoading,
    cacheEntries,
    cacheLoading,
    cacheError,
    pendingServers,
    pendingLoading,
    pendingError,
    loadDestinations,
    selectDestination,
    resetFederationConnection,
    reconnectFederation,
    loadBlacklist,
    addToBlacklist,
    removeFromBlacklist,
    loadCache,
    clearCache,
    removeCacheEntry,
    loadPending,
    confirmPending
  }
}
