import { createLogger } from '@/utils/Logger'

const logger = createLogger('TimerWorker')

let timerWorker: Worker | null = null

export const getTimerWorker = (): Worker => {
  if (!timerWorker) {
    timerWorker = new Worker(new URL('@/workers/timer.worker.ts', import.meta.url))
    timerWorker.onerror = (err) => {
      logger.error('Worker Error', err)
    }
  }
  return timerWorker
}
