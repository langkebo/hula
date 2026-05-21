import type { RobotPermissionDescriptor } from './types'

class RobotPermissionService {
  private descriptors = new Map<string, RobotPermissionDescriptor>()

  private buildKey(descriptor: Pick<RobotPermissionDescriptor, 'permission' | 'roomId' | 'botId' | 'userId'>): string {
    return [descriptor.roomId || '*', descriptor.botId || '*', descriptor.userId || '*', descriptor.permission].join(
      ':'
    )
  }

  setPermission(descriptor: RobotPermissionDescriptor): void {
    this.descriptors.set(this.buildKey(descriptor), descriptor)
  }

  hasPermission(input: Pick<RobotPermissionDescriptor, 'permission' | 'roomId' | 'botId' | 'userId'>): boolean {
    const exact = this.descriptors.get(this.buildKey(input))
    if (exact) {
      return exact.allowed
    }

    const fallback = this.descriptors.get(this.buildKey({ ...input, userId: undefined }))
    return fallback?.allowed ?? false
  }

  listPermissions(roomId?: string): RobotPermissionDescriptor[] {
    const all = [...this.descriptors.values()]
    return roomId ? all.filter((descriptor) => descriptor.roomId === roomId) : all
  }
}

export const robotPermissionService = new RobotPermissionService()
