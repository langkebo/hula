import type { RobotDefinition, RobotPluginModule } from './types'

class RobotPluginRegistry {
  private plugins = new Map<string, RobotPluginModule>()

  register(plugin: RobotPluginModule): void {
    this.plugins.set(plugin.definition.id, plugin)
  }

  unregister(botId: string): void {
    this.plugins.delete(botId)
  }

  get(botId: string): RobotPluginModule | null {
    return this.plugins.get(botId) ?? null
  }

  listDefinitions(): RobotDefinition[] {
    return [...this.plugins.values()].map((plugin) => plugin.definition)
  }

  async activate(botId: string): Promise<void> {
    await this.plugins.get(botId)?.activate?.()
  }

  async deactivate(botId: string): Promise<void> {
    await this.plugins.get(botId)?.deactivate?.()
  }
}

export const robotPluginRegistry = new RobotPluginRegistry()
