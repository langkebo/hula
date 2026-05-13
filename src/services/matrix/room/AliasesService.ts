import { error, info } from '@tauri-apps/plugin-log'
import { BaseMatrixService } from '../BaseMatrixService'

/**
 * Room aliases domain service.
 *
 * Canonical + alternative aliases are read from the local Room state cache.
 * Writes go through `createAlias` / `deleteAlias` on the client.
 */
export class MatrixRoomAliasesService extends BaseMatrixService {
  async getAliases(roomId: string): Promise<string[]> {
    const client = this.getClient()
    try {
      const room = client.getRoom(roomId)
      if (!room) return []
      const aliases = room.getAltAliases() ?? []
      const canonical = room.getCanonicalAlias()
      if (canonical) aliases.unshift(canonical)
      return aliases
    } catch (err) {
      error(`[MatrixRoom] 获取房间别名失败: ${err}`)
      throw err
    }
  }

  async setAlias(roomId: string, alias: string): Promise<void> {
    const client = this.getClient()
    try {
      await client.createAlias(alias, roomId)
      info(`[MatrixRoom] 设置房间别名成功: ${alias}`)
    } catch (err) {
      error(`[MatrixRoom] 设置房间别名失败: ${err}`)
      throw err
    }
  }

  async deleteAlias(alias: string): Promise<void> {
    const client = this.getClient()
    try {
      await client.deleteAlias(alias)
      info(`[MatrixRoom] 删除房间别名成功: ${alias}`)
    } catch (err) {
      error(`[MatrixRoom] 删除房间别名失败: ${err}`)
      throw err
    }
  }
}

export const matrixRoomAliasesService = new MatrixRoomAliasesService()
