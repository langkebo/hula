import { type Ref, ref } from 'vue'
import { adminService, matrixFederationBlacklistService } from '@/services/matrix'
import type { FederationDestination } from '@/services/matrix/admin/AdminTypes'

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

/**
 * Admin federation composable.
 *
 * Owns state + orchestration for the admin federation surface so that
 * desktop (`src/views/admin/AdminFederation.vue`) and mobile (pending)
 * render the same business logic.
 */
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
      const items = await matrixFederationBlacklistService.list()
      blacklist.value = items.map((e) => ({
        domain: e.domain,
        reason: e.reason,
        addedBy: e.addedBy,
        addedAt: e.addedAt
      }))
    } finally {
      blacklistLoading.value = false
    }
  }

  async function addToBlacklist(domain: string, reason?: string): Promise<boolean> {
    const ok = await matrixFederationBlacklistService.add({ domain, reason })
    if (ok) await loadBlacklist()
    return ok
  }

  async function removeFromBlacklist(domain: string): Promise<boolean> {
    const ok = await matrixFederationBlacklistService.remove(domain)
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
