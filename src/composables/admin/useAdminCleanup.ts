import { type Ref, ref } from 'vue'
import {
  adminCleanupService,
  type CleanupAllResponse,
  type CleanupRoomsResponse,
  type CleanupTokensResponse
} from '@/services/matrix/admin'

/** 清理动作的类型。 */
export type CleanupKind = 'all' | 'rooms' | 'tokens'

/** 最近一次清理的结果（按动作区分响应形状）。 */
type CleanupOutcome =
  | { kind: 'all'; result: CleanupAllResponse }
  | { kind: 'rooms'; result: CleanupRoomsResponse }
  | { kind: 'tokens'; result: CleanupTokensResponse }

interface UseAdminCleanupResult {
  running: Ref<boolean>
  error: Ref<string | null>
  outcome: Ref<CleanupOutcome | null>
  runCleanupAll: (minAgeMs?: number) => Promise<boolean>
  runCleanupRooms: (minAgeMs?: number) => Promise<boolean>
  runCleanupTokens: () => Promise<boolean>
}

function toMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

/**
 * 数据库清理 composable。
 *
 * 覆盖 ADM-05 组 b 的 3 条清理端点：全局清理、房间清理、令牌清理。
 * 三条均为破坏性操作，二次确认由页面承担。
 */
export function useAdminCleanup(): UseAdminCleanupResult {
  const running = ref(false)
  const error = ref<string | null>(null)
  const outcome = ref<CleanupOutcome | null>(null)

  async function run(action: CleanupKind, minAgeMs?: number): Promise<boolean> {
    running.value = true
    error.value = null
    try {
      if (action === 'all') {
        outcome.value = {
          kind: 'all',
          result: await adminCleanupService.cleanupAll(minAgeMs === undefined ? undefined : { min_age_ms: minAgeMs })
        }
      } else if (action === 'rooms') {
        outcome.value = {
          kind: 'rooms',
          result: await adminCleanupService.cleanupRooms(minAgeMs === undefined ? undefined : { min_age_ms: minAgeMs })
        }
      } else {
        outcome.value = { kind: 'tokens', result: await adminCleanupService.cleanupTokens() }
      }
      return true
    } catch (err) {
      error.value = toMessage(err)
      return false
    } finally {
      running.value = false
    }
  }

  async function runCleanupAll(minAgeMs?: number): Promise<boolean> {
    return run('all', minAgeMs)
  }

  async function runCleanupRooms(minAgeMs?: number): Promise<boolean> {
    return run('rooms', minAgeMs)
  }

  async function runCleanupTokens(): Promise<boolean> {
    return run('tokens')
  }

  return { running, error, outcome, runCleanupAll, runCleanupRooms, runCleanupTokens }
}
