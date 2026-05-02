export interface WorkerTask<I = unknown, O = unknown> {
  name: string
  execute(input: I): Promise<O> | O
}

export interface WorkerTaskDefinition<I = unknown, O = unknown> {
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

export async function executeTask<I, O>(name: string, input: I): Promise<O> {
  const task = taskRegistry.get(name)
  if (!task) {
    throw new Error(`[WorkerRegistry] 未注册的任务: ${name}`)
  }
  return task.handler(input) as Promise<O>
}

export function listTasks(): string[] {
  return Array.from(taskRegistry.keys())
}

export function clearTasks(): void {
  taskRegistry.clear()
}

export function createTask<I, O>(name: string, handler: (input: I) => Promise<O> | O): WorkerTaskDefinition<I, O> {
  return { name, handler }
}
