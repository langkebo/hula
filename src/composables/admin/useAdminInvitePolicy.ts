import { type Ref, ref } from 'vue'
import { adminInvitePolicyService } from '@/services/matrix/admin'
import type { GlobalInviteListKind } from '@/services/matrix/admin/AdminInvitePolicyService'

interface UseAdminInvitePolicyResult {
  blocklist: Ref<string[]>
  allowlist: Ref<string[]>
  loading: Ref<boolean>
  savingBlocklist: Ref<boolean>
  savingAllowlist: Ref<boolean>
  globalAllowlist: Ref<string[]>
  globalBlocklist: Ref<string[]>
  globalLoading: Ref<boolean>
  globalMutating: Ref<boolean>
  error: Ref<string | null>

  loadLists: (roomId: string) => Promise<boolean>
  saveBlocklist: (roomId: string, userIds: string[]) => Promise<boolean>
  saveAllowlist: (roomId: string, userIds: string[]) => Promise<boolean>
  loadGlobalLists: () => Promise<boolean>
  addGlobalUser: (kind: GlobalInviteListKind, userId: string) => Promise<boolean>
  removeGlobalUser: (kind: GlobalInviteListKind, userId: string) => Promise<boolean>
  importGlobalUsers: (kind: GlobalInviteListKind, userIds: string[]) => Promise<{ success: number; failed: number }>
  replaceGlobalUsers: (kind: GlobalInviteListKind, userIds: string[]) => Promise<boolean>
}

function toMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

/**
 * 邀请黑白名单 composable。
 *
 * 房间级覆盖 ADM-05 组 c 的 4 条邀请策略端点（读/写 × 黑/白名单），写入为整体替换语义，
 * 故页面按「全量编辑后保存」组织。全局名单复用 SDK `AdminManager.config` 的增量端点，
 * 支持单条增删与粘贴文本批量导入。
 */
export function useAdminInvitePolicy(): UseAdminInvitePolicyResult {
  const blocklist = ref<string[]>([])
  const allowlist = ref<string[]>([])
  const loading = ref(false)
  const savingBlocklist = ref(false)
  const savingAllowlist = ref(false)
  const globalAllowlist = ref<string[]>([])
  const globalBlocklist = ref<string[]>([])
  const globalLoading = ref(false)
  const globalMutating = ref(false)
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

  async function loadGlobalLists(): Promise<boolean> {
    globalLoading.value = true
    error.value = null
    try {
      const lists = await adminInvitePolicyService.getGlobalLists()
      globalAllowlist.value = lists.allowlist
      globalBlocklist.value = lists.blocklist
      return true
    } catch (err) {
      error.value = toMessage(err)
      return false
    } finally {
      globalLoading.value = false
    }
  }

  /** 增删会触发白/黑名单互斥迁移，统一回读两份名单。 */
  async function refreshGlobalLists(): Promise<void> {
    const lists = await adminInvitePolicyService.getGlobalLists()
    globalAllowlist.value = lists.allowlist
    globalBlocklist.value = lists.blocklist
  }

  async function addGlobalUser(kind: GlobalInviteListKind, userId: string): Promise<boolean> {
    const normalized = userId.trim()
    if (!normalized) return false
    globalMutating.value = true
    error.value = null
    try {
      await adminInvitePolicyService.addGlobalUser(kind, normalized)
      await refreshGlobalLists()
      return true
    } catch (err) {
      error.value = toMessage(err)
      return false
    } finally {
      globalMutating.value = false
    }
  }

  async function removeGlobalUser(kind: GlobalInviteListKind, userId: string): Promise<boolean> {
    const normalized = userId.trim()
    if (!normalized) return false
    globalMutating.value = true
    error.value = null
    try {
      await adminInvitePolicyService.removeGlobalUser(kind, normalized)
      await refreshGlobalLists()
      return true
    } catch (err) {
      error.value = toMessage(err)
      return false
    } finally {
      globalMutating.value = false
    }
  }

  /** 整体替换全局名单（服务端为全量语义），成功后回读两侧名单。 */
  async function replaceGlobalUsers(kind: GlobalInviteListKind, userIds: string[]): Promise<boolean> {
    const normalized = Array.from(new Set(userIds.map((userId) => userId.trim()).filter(Boolean)))
    globalMutating.value = true
    error.value = null
    try {
      await adminInvitePolicyService.setGlobalList(kind, normalized)
      await refreshGlobalLists()
      return true
    } catch (err) {
      error.value = toMessage(err)
      return false
    } finally {
      globalMutating.value = false
    }
  }

  async function importGlobalUsers(
    kind: GlobalInviteListKind,
    userIds: string[]
  ): Promise<{ success: number; failed: number }> {
    const normalized = Array.from(new Set(userIds.map((userId) => userId.trim()).filter(Boolean)))
    const result = { success: 0, failed: 0 }
    if (normalized.length === 0) return result

    globalMutating.value = true
    error.value = null
    try {
      for (const userId of normalized) {
        try {
          await adminInvitePolicyService.addGlobalUser(kind, userId)
          result.success += 1
        } catch {
          result.failed += 1
        }
      }
      try {
        await refreshGlobalLists()
      } catch {
        // 回读失败不回滚已成功的增量写入，列表由下次刷新修正。
      }
      return result
    } finally {
      globalMutating.value = false
    }
  }

  return {
    blocklist,
    allowlist,
    loading,
    savingBlocklist,
    savingAllowlist,
    globalAllowlist,
    globalBlocklist,
    globalLoading,
    globalMutating,
    error,
    loadLists,
    saveBlocklist,
    saveAllowlist,
    loadGlobalLists,
    addGlobalUser,
    removeGlobalUser,
    importGlobalUsers,
    replaceGlobalUsers
  }
}
