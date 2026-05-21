import { ref } from 'vue'

export interface MatrixSessionSnapshot {
  userId: string | null
  deviceId: string | null
  accessToken: string | null
  homeserverUrl: string | null
}

const userId = ref<string | null>(null)
const deviceId = ref<string | null>(null)
const accessToken = ref<string | null>(null)
const homeserverUrl = ref<string | null>(null)

export function useMatrixSessionState() {
  return {
    userId,
    deviceId,
    accessToken,
    homeserverUrl
  }
}

export function getMatrixSessionSnapshot(): MatrixSessionSnapshot {
  return {
    userId: userId.value,
    deviceId: deviceId.value,
    accessToken: accessToken.value,
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
  if ('accessToken' in snapshot) {
    accessToken.value = snapshot.accessToken ?? null
  }
  if ('homeserverUrl' in snapshot) {
    homeserverUrl.value = snapshot.homeserverUrl ?? null
  }

  return getMatrixSessionSnapshot()
}

export function resetMatrixSessionSnapshotForTests(): void {
  userId.value = null
  deviceId.value = null
  accessToken.value = null
  homeserverUrl.value = null
}
