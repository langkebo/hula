import { type Ref, ref } from 'vue'
import { adminInvitePolicyService } from '@/services/matrix/admin'

interface UseAdminInvitePolicyResult {
  blocklist: Ref<string[]>
  allowlist: Ref<string[]>
  loading: Ref<boolean>
  savingBlocklist: Ref<boolean>
  savingAllowlist: Ref<boolean>
  error: Ref<string | null>

  loadLists: (roomId: string) => Promise<boolean>
  saveBlocklist: (roomId: string, userIds: string[]) => Promise<boolean>
  saveAllowlist: (roomId: string, userIds: string[]) => Promise<boolean>
}

function toMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

/**
 * 房间邀请黑白名单 composable。
 *
 * 覆盖 ADM-05 组 c 的 4 条邀请策略端点：黑名单读/写、白名单读/写。
 * 写入是整体替换语义，故页面按「全量编辑后保存」组织，而不是逐条增删。
 */
export function useAdminInvitePolicy(): UseAdminInvitePolicyResult {
  const blocklist = ref<string[]>([])
  const allowlist = ref<string[]>([])
  const loading = ref(false)
  const savingBlocklist = ref(false)
  const savingAllowlist = ref(false)
  const error = ref<string | null>(null)

  async function loadLists(roomId: string): Promise<boolean> {
    loading.value = true
    error.value = null
    blocklist.value = []
    allowlist.value = []
    try {
      const [blocked, allowed] = await Promise.all([
        adminInvitePolicyService.getBlocklist(roomId),
        adminInvitePolicyService.getAllowlist(roomId)
      ])
      blocklist.value = blocked
      allowlist.value = allowed
      return true
    } catch (err) {
      error.value = toMessage(err)
      return false
    } finally {
      loading.value = false
    }
  }

  async function saveBlocklist(roomId: string, userIds: string[]): Promise<boolean> {
    savingBlocklist.value = true
    error.value = null
    try {
      const result = await adminInvitePolicyService.setBlocklist(roomId, userIds)
      blocklist.value = result.blocklist
      return true
    } catch (err) {
      error.value = toMessage(err)
      return false
    } finally {
      savingBlocklist.value = false
    }
  }

  async function saveAllowlist(roomId: string, userIds: string[]): Promise<boolean> {
    savingAllowlist.value = true
    error.value = null
    try {
      const result = await adminInvitePolicyService.setAllowlist(roomId, userIds)
      allowlist.value = result.allowlist
      return true
    } catch (err) {
      error.value = toMessage(err)
      return false
    } finally {
      savingAllowlist.value = false
    }
  }

  return {
    blocklist,
    allowlist,
    loading,
    savingBlocklist,
    savingAllowlist,
    error,
    loadLists,
    saveBlocklist,
    saveAllowlist
  }
}
