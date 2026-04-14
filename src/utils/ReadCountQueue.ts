import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { useMitt } from '@/hooks/useMitt.ts'
import { matrixClientService } from '@/services/matrix'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('ReadCountQueue')

type MsgReadUnReadCountType = {
  msgId: string
  readCount: number
  unReadCount: number | null
}

type ReadCountQueue = Set<number>
interface AbortableRequest extends Promise<MsgReadUnReadCountType[]> {
  abort: () => void
}

const INTERVAL_DELAY = 10000

const queue: ReadCountQueue = new Set<number>()
let timerWorker: Worker | null = null
let request: AbortableRequest | null = null
let isTimerActive = false

interface ReadCountTaskEvent {
  msgId: number
}

const onAddReadCountTask = ({ msgId }: ReadCountTaskEvent) => {
  if (typeof msgId !== 'number') return
  queue.add(msgId)
}

const onRemoveReadCountTask = ({ msgId }: ReadCountTaskEvent) => {
  if (typeof msgId !== 'number') return
  queue.delete(msgId)
}

const checkUserAuthentication = (): boolean => {
  const currentWindow = WebviewWindow.getCurrent()
  if (currentWindow.label === 'login') {
    return false
  }
  return true
}

const getMsgReadCount = async (_msgIds: number[]): Promise<MsgReadUnReadCountType[]> => {
  const client = matrixClientService.getClient()
  if (!client) return []

  try {
    const result: MsgReadUnReadCountType[] = []
    for (const msgId of _msgIds) {
      const room = client.getRoom(msgId.toString())
      if (room) {
        const unreadCount = room.getUnreadNotificationCount()
        const highlightCount = room.getHighlightCount()
        result.push({
          msgId: msgId.toString(),
          readCount: highlightCount,
          unReadCount: unreadCount
        })
      }
    }
    return result
  } catch (error) {
    logger.error('获取消息已读计数失败:', error)
    return []
  }
}

const task = async () => {
  try {
    if (request) {
      request.abort()
      request = null
    }

    if (queue.size === 0) return

    const canSendRequest = checkUserAuthentication()
    if (!canSendRequest) {
      logger.debug('用户未登录或在登录窗口，跳过消息已读计数请求')
      clearQueue()
      return
    }

    request = getMsgReadCount(Array.from(queue)) as AbortableRequest
    const res = await request

    if (!Array.isArray(res)) {
      logger.error('Invalid response format:', res)
      return
    }

    const result = new Map<string, MsgReadUnReadCountType>()
    for (const item of res) {
      if (typeof item.msgId === 'string') {
        result.set(item.msgId, item)
      }
    }

    useMitt.emit('onGetReadCount', result)
  } catch (error) {
    logger.error('无法获取消息读取计数:', error)
  } finally {
    request = null
  }
}

export const initListener = () => {
  useMitt.on('onAddReadCountTask', onAddReadCountTask)
  useMitt.on('onRemoveReadCountTask', onRemoveReadCountTask)
  clearQueue()
}

export const clearListener = () => {
  useMitt.off('onAddReadCountTask', onAddReadCountTask)
  useMitt.off('onRemoveReadCountTask', onRemoveReadCountTask)
  if (request) {
    request.abort()
    request = null
  }
  stopTimer()
  terminateWorker()
}

const stopTimer = () => {
  if (timerWorker && isTimerActive) {
    timerWorker.postMessage({ type: 'stop' })
    isTimerActive = false
  }
}

const terminateWorker = () => {
  if (timerWorker) {
    stopTimer()
    timerWorker.terminate()
    timerWorker = null
  }
}

const clearQueue = () => {
  queue.clear()
}

const startTimer = () => {
  if (isTimerActive) return
  initWorker()
  isTimerActive = true
}

const initWorker = () => {
  if (timerWorker) return

  const workerCode = `
    let timer = null;
    self.onmessage = function(e) {
      if (e.data.type === 'start') {
        timer = setInterval(() => {
          self.postMessage({ type: 'timeout', msgId: 'readCountQueue' });
        }, ${INTERVAL_DELAY});
      } else if (e.data.type === 'stop') {
        if (timer) {
          clearInterval(timer);
          timer = null;
        }
      }
    };
  `

  const blob = new Blob([workerCode], { type: 'application/javascript' })
  const workerUrl = URL.createObjectURL(blob)
  timerWorker = new Worker(workerUrl)

  timerWorker.onmessage = (event: MessageEvent) => {
    const { type, msgId } = event.data
    if (type === 'timeout' && msgId === 'readCountQueue') {
      void task()
    }
  }
}

export const readCountQueue = () => {
  initWorker()
  void task()
  startTimer()
}
