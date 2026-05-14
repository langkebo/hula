import { type Ref, ref } from 'vue'
import type { FederationBlacklistEntry, FederationDestination } from '@/services/matrix/admin'
import { adminService } from '@/services/matrix/admin'

export interface FederationBlacklistView {
  domain: string
  reason?: string
  addedBy?: string
  addedAt?: number
}

export interface UseAdminFederationResult {
  destinations: Ref<FederationDestination[]>
  destinationsLoading: Ref<boolean>
  selectedDestination: Ref<FederationDestination | null>

  blacklist: Ref<FederationBlacklistView[]>
  blacklistLoading: Ref<boolean>

  loadDestinations: () => Promise<void>
  selectDestination: (destination: FederationDestination | null) => void
  resetFederationConnection: (destination: string) => Promise<void>
  reconnectFederation: (destination: string) => Promise<void>

  loadBlacklist: () => Promise<void>
  addToBlacklist: (domain: string, reason?: string) => Promise<boolean>
  removeFromBlacklist: (domain: string) => Promise<boolean>
}

export function useAdminFederation(): UseAdminFederationResult {
  const destinations = ref<FederationDestination[]>([])
  const destinationsLoading = ref(false)
  const selectedDestination = ref<FederationDestination | null>(null)

  const blacklist = ref<FederationBlacklistView[]>([])
  const blacklistLoading = ref(false)

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

  return {
    destinations,
    destinationsLoading,
    selectedDestination,
    blacklist,
    blacklistLoading,
    loadDestinations,
    selectDestination,
    resetFederationConnection,
    reconnectFederation,
    loadBlacklist,
    addToBlacklist,
    removeFromBlacklist
  }
}
