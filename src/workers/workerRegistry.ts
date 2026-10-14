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

export function createTask<I, O>(name: string, handler: (input: I) => Promise<O> | O): WorkerTaskDefinition<I, O> {
  return { name, handler }
}
