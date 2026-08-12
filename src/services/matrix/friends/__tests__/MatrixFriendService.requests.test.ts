import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * FT-107: getIncomingRequests/getOutgoingRequests 必须使用 normalizeSynapseFriendRequest
 * 而非 as unknown as FriendRequest[] 强转（字段名不匹配：requester/created_ts vs user_id/timestamp）
 */
describe('FT-107: getIncomingRequests/getOutgoingRequests 使用 normalizeSynapseFriendRequest', () => {
  const sourcePath = resolve(process.cwd(), 'src/services/matrix/friends/MatrixFriendService.ts')
  const sourceContent = readFileSync(sourcePath, 'utf8')

  it('getIncomingRequests 回退路径使用 normalizeSynapseFriendRequest 而非 as unknown as', () => {
    const methodMatch = sourceContent.match(/async getIncomingRequests[\s\S]*?\n {2}\}/)
    expect(methodMatch).toBeTruthy()
    const methodBody = methodMatch![0]

    // 应该使用 normalizeSynapseFriendRequest
    expect(methodBody).toMatch(/normalizeSynapseFriendRequest/)
    // 不应该使用 as unknown as FriendRequest[] 强转
    expect(methodBody).not.toMatch(/as\s+unknown\s+as\s+FriendRequest/)
  })

  it('getOutgoingRequests 回退路径使用 normalizeSynapseFriendRequest 而非 as unknown as', () => {
    const methodMatch = sourceContent.match(/async getOutgoingRequests[\s\S]*?\n {2}\}/)
    expect(methodMatch).toBeTruthy()
    const methodBody = methodMatch![0]

    // 应该使用 normalizeSynapseFriendRequest
    expect(methodBody).toMatch(/normalizeSynapseFriendRequest/)
    // 不应该使用 as unknown as FriendRequest[] 强转
    expect(methodBody).not.toMatch(/as\s+unknown\s+as\s+FriendRequest/)
  })

  it('normalizeSynapseFriendRequest 支持方向参数（incoming 用 requester，outgoing 用 recipient）', () => {
    // FT-107: normalizeSynapseFriendRequest 已抽到 friendUtils.ts 纯函数模块
    const utilsPath = resolve(process.cwd(), 'src/services/matrix/friends/friendUtils.ts')
    const utilsContent = readFileSync(utilsPath, 'utf8')
    const methodMatch = utilsContent.match(/function normalizeSynapseFriendRequest[\s\S]*?\n}/)
    expect(methodMatch).toBeTruthy()
    const methodBody = methodMatch![0]

    // 应该接受 direction 参数
    expect(methodBody).toMatch(/direction/)
    // 对于 outgoing 应该使用 recipient 而非 requester
    expect(methodBody).toMatch(/recipient/)
  })
})
