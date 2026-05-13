import type { MatrixClient } from 'matrix-js-sdk'
import { matrixClientService } from './MatrixClientService'

export abstract class BaseMatrixService {
  protected getClient(): MatrixClient {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('客户端未初始化')
    }
    return client
  }
}
