/**
 * 异步生成任务的轮询定时器登记表。
 *
 * 三种生成（图像 / 视频 / 音频）走同一份 Map 管理 setInterval 句柄，
 * 抽出来是为了：
 * - `stopAll()` / `stopByConversation()` 的语义集中、易测；
 * - useRobotChat 的 onUnmounted 与 conversation watch 不再直接操作 Map 结构。
 *
 * 任务 ID 类型为 `number`（来自后端 task id），不与会话 id 混用。
 */

export interface PollingTaskMeta {
  timerId: number
  conversationId: string
  startedAt: number
}

export const usePollingTasks = () => {
  const tasks = new Map<number, PollingTaskMeta>()

  const register = (id: number, conversationId: string, timerId: number) => {
    tasks.set(id, { timerId, conversationId, startedAt: Date.now() })
  }

  const unregister = (id: number) => {
    tasks.delete(id)
  }

  const get = (id: number) => tasks.get(id)
  const has = (id: number) => tasks.has(id)

  const stop = (id: number) => {
    const task = tasks.get(id)
    if (!task) return
    window.clearInterval(task.timerId)
    tasks.delete(id)
  }

  const stopAll = () => {
    tasks.forEach(({ timerId }) => window.clearInterval(timerId))
    tasks.clear()
  }

  const stopByConversation = (conversationId: string) => {
    const tasksToStop: number[] = []
    tasks.forEach(({ timerId, conversationId: taskConversationId }, taskId) => {
      if (taskConversationId === conversationId) {
        window.clearInterval(timerId)
        tasksToStop.push(taskId)
      }
    })
    tasksToStop.forEach((taskId) => tasks.delete(taskId))
  }

  return {
    register,
    unregister,
    get,
    has,
    stop,
    stopAll,
    stopByConversation
  }
}
