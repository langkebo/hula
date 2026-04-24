import { ref, type Ref } from 'vue'
import { adminService } from '@/services/matrix'

export interface UseAdminSecurityResult {
  events: Ref<Array<Record<string, unknown>>>
  eventsLoading: Ref<boolean>
  ipBlocks: Ref<Array<Record<string, unknown>>>
  ipBlocksLoading: Ref<boolean>

  loadEvents: (limit?: number, from?: string, filters?: Record<string, unknown>) => Promise<void>
  loadIpBlocks: () => Promise<void>

  blockIp: (ip: string, options?: { cidr?: number; expireAt?: number; reason?: string }) => Promise<void>
  unblockIp: (ip: string) => Promise<void>
  getIpReputation: (ip: string) => Promise<Record<string, unknown> | null>
}

/**
 * Admin security composable.
 *
 * Wraps `adminService.getSecurityEvents` / `getIpBlocks` / `blockIp` /
 * `unblockIp` / `getIpReputation`. Backend feature is UX-gated —
 * `AdminSecurity.vue` currently shows the "not ready" banner.
 */
export function useAdminSecurity(): UseAdminSecurityResult {
  const events = ref<Array<Record<string, unknown>>>([])
  const eventsLoading = ref(false)
  const ipBlocks = ref<Array<Record<string, unknown>>>([])
  const ipBlocksLoading = ref(false)

  async function loadEvents(limit = 100, from?: string, filters?: Record<string, unknown>) {
    eventsLoading.value = true
    try {
      const result = await adminService.getSecurityEvents(limit, from, filters)
      events.value = result?.events ?? []
    } finally {
      eventsLoading.value = false
    }
  }

  async function loadIpBlocks() {
    ipBlocksLoading.value = true
    try {
      ipBlocks.value = (await adminService.getIpBlocks()) ?? []
    } finally {
      ipBlocksLoading.value = false
    }
  }

  async function blockIp(ip: string, options?: { cidr?: number; expireAt?: number; reason?: string }) {
    await adminService.blockIp(ip, options)
    await loadIpBlocks()
  }

  async function unblockIp(ip: string) {
    await adminService.unblockIp(ip)
    await loadIpBlocks()
  }

  async function getIpReputation(ip: string) {
    return await adminService.getIpReputation(ip)
  }

  return {
    events,
    eventsLoading,
    ipBlocks,
    ipBlocksLoading,
    loadEvents,
    loadIpBlocks,
    blockIp,
    unblockIp,
    getIpReputation
  }
}
