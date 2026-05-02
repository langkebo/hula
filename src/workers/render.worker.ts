import { getTask } from './workerRegistry'
import './computeTasks'
import './hashTask'
import './highlightTask'

self.onmessage = async (e: MessageEvent) => {
  const { id, name, input } = e.data

  try {
    const task = getTask(name)
    if (!task) {
      throw new Error(`Task ${name} not found`)
    }

    const result = await task.handler(input)
    self.postMessage({ id, result })
  } catch (error: unknown) {
    self.postMessage({ id, error: (error as Error).message })
  }
}
