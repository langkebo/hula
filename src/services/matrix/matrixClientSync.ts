import { type MatrixClient, SlidingSync } from 'matrix-js-sdk'
import { PendingEventOrdering } from '@/types/matrix-js-sdk'
import { createLogger } from '@/utils/Logger'
import type { ConnectionState, MatrixClientConfig } from './MatrixClientService'

const logger = createLogger('MatrixClient')

type StartClientOptions = Parameters<MatrixClient['startClient']>[0]

export function createSlidingSyncInstance(client: MatrixClient, config: MatrixClientConfig): SlidingSync {
  const slidingSyncConfig = config.slidingSync ?? {}
  const roomRangeEnd = slidingSyncConfig.roomRangeEnd ?? 49
  const timelineLimit = slidingSyncConfig.timelineLimit ?? 10
  const pollTimeout = slidingSyncConfig.pollTimeout ?? 30000

  const requiredState: Array<[string, string]> = [
    ['m.room.name', ''],
    ['m.room.avatar', ''],
    ['m.room.encryption', ''],
    ['m.room.create', ''],
    ['m.room.power_levels', ''],
    ['m.room.member', '*']
  ]

  const lists = new Map()
  lists.set('default', {
    ranges: [[0, roomRangeEnd]],
    sort: ['by_recency'],
    timeline_limit: timelineLimit,
    required_state: requiredState
  })

  const slidingSync = new SlidingSync(
    config.homeserverUrl,
    lists,
    {
      timeline_limit: timelineLimit,
      required_state: requiredState
    },
    client,
    pollTimeout
  )

  logger.info(
    `Sliding Sync 实例已创建 (rooms=${roomRangeEnd + 1}, timeline=${timelineLimit}, timeout=${pollTimeout}ms)`
  )
  return slidingSync
}

export function createStartClientOptions(
  initialSyncLimit: number,
  slidingSync?: SlidingSync | null
): StartClientOptions {
  const startOpts: StartClientOptions = {
    initialSyncLimit,
    pendingEventOrdering: PendingEventOrdering.Detached
  }

  if (slidingSync) {
    startOpts.slidingSync = slidingSync
  }

  return startOpts
}

export function mapSyncStateToConnectionState(state: string): ConnectionState | null {
  switch (state) {
    case 'PREPARED':
    case 'SYNCING':
    case 'CATCHUP':
      return 'CONNECTED'
    case 'RECONNECTING':
      return 'RECONNECTING'
    case 'ERROR':
      return 'ERROR'
    case 'STOPPED':
      return 'DISCONNECTED'
    default:
      return null
  }
}
