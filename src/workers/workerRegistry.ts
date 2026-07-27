interface WorkerTaskDefinition<I = unknown, O = unknown> {
  name: string
  handler: (input: I) => Promise<O> | O
}

const taskRegistry = new Map<string, WorkerTaskDefinition>()

export function registerTask<I, O>(definition: WorkerTaskDefinition<I, O>): void {
  if (taskRegistry.has(definition.name)) {
  }
  taskRegistry.set(definition.name, definition as WorkerTaskDefinition)
}

export function getTask(name: string): WorkerTaskDefinition | undefined {
  return taskRegistry.get(name)
}

async function _executeTask<I, O>(name: string, input: I): Promise<O> {
  const task = taskRegistry.get(name)
  if (!task) {
    throw new Error(`[WorkerRegistry] 未注册的任务: ${name}`)
  }
  return task.handler(input) as Promise<O>
}

function _listTasks(): string[] {
  return Array.from(taskRegistry.keys())
}

function _clearTasks(): void {
  taskRegistry.clear()
}

export function createTask<I, O>(name: string, handler: (input: I) => Promise<O> | O): WorkerTaskDefinition<I, O> {
  return { name, handler }
}
