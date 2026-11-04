import { ref } from 'vue'

/**
 * 运行时会话快照：**不含 access token**。
 *
 * AR-07b / B1：access token 的唯一读入口是 `matrixClientAccessor.getMatrixAccessToken()`。
 * 此前这里存了一份 Vue ref 副本，但 `MatrixTokenManager.refresh()` 只回写 Rust 侧
 * 与 SDK client，**不回写本副本** ⇒ 刷新后必然陈旧。删掉副本后不存在「两份真相」，
 * 也就不需要「记得同步」这种靠人守的约定。
 */
interface MatrixSessionSnapshot {
  userId: string | null
  deviceId: string | null
  homeserverUrl: string | null
}

const userId = ref<string | null>(null)
const deviceId = ref<string | null>(null)
const homeserverUrl = ref<string | null>(null)

export function getMatrixSessionSnapshot(): MatrixSessionSnapshot {
  return {
    userId: userId.value,
    deviceId: deviceId.value,
    homeserverUrl: homeserverUrl.value
  }
}

export function patchMatrixSessionSnapshot(snapshot: Partial<MatrixSessionSnapshot>): MatrixSessionSnapshot {
  if ('userId' in snapshot) {
    userId.value = snapshot.userId ?? null
  }
  if ('deviceId' in snapshot) {
    deviceId.value = snapshot.deviceId ?? null
  }
  if ('homeserverUrl' in snapshot) {
    homeserverUrl.value = snapshot.homeserverUrl ?? null
  }

  return getMatrixSessionSnapshot()
}
