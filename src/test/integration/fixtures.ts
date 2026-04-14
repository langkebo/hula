/**
 * 集成测试 Fixtures
 * 提供测试用户、房间等资源的创建和清理
 */

import { getTestHomeserverUrl } from './config'

export interface TestUser {
  userId: string
  accessToken: string
  deviceId: string
  password: string
}

export interface TestRoom {
  roomId: string
  name: string
  creator: TestUser
}

let createdUsers: TestUser[] = []
let createdRooms: TestRoom[] = []

export async function createTestUser(username?: string, password?: string): Promise<TestUser> {
  const testUsername = username || `test_${Date.now()}_${Math.random().toString(36).substring(7)}`
  const testPassword = password || `TestPass_${Date.now()}!`

  const response = await fetch(`${getTestHomeserverUrl()}/_matrix/client/v3/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: testUsername,
      password: testPassword,
      auth: {
        type: 'm.login.dummy'
      }
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to create test user: ${error}`)
  }

  const data = await response.json()
  const user: TestUser = {
    userId: data.user_id,
    accessToken: data.access_token,
    deviceId: data.device_id,
    password: testPassword
  }

  createdUsers.push(user)
  return user
}

export async function loginTestUser(username: string, password: string): Promise<TestUser> {
  const response = await fetch(`${getTestHomeserverUrl()}/_matrix/client/v3/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'm.login.password',
      user: username,
      password: password
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to login test user: ${error}`)
  }

  const data = await response.json()
  return {
    userId: data.user_id,
    accessToken: data.access_token,
    deviceId: data.device_id,
    password: password
  }
}

export async function createTestRoom(
  creator: TestUser,
  name?: string,
  options?: {
    isPublic?: boolean
    preset?: 'private_chat' | 'public_chat' | 'trusted_private_chat'
  }
): Promise<TestRoom> {
  const roomName = name || `Test Room ${Date.now()}`
  const preset = options?.preset || 'private_chat'

  const response = await fetch(`${getTestHomeserverUrl()}/_matrix/client/v3/createRoom`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${creator.accessToken}`
    },
    body: JSON.stringify({
      name: roomName,
      preset: preset,
      visibility: options?.isPublic ? 'public' : 'private'
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to create test room: ${error}`)
  }

  const data = await response.json()
  const room: TestRoom = {
    roomId: data.room_id,
    name: roomName,
    creator: creator
  }

  createdRooms.push(room)
  return room
}

export async function cleanupTestResources(): Promise<void> {
  for (const room of createdRooms) {
    try {
      await fetch(`${getTestHomeserverUrl()}/_matrix/client/v3/rooms/${room.roomId}/leave`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${room.creator.accessToken}`
        }
      })
    } catch {
      // Ignore cleanup errors
    }
  }

  for (const user of createdUsers) {
    try {
      await fetch(`${getTestHomeserverUrl()}/_matrix/client/v3/account/deactivate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${user.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          auth: {
            type: 'm.login.password',
            user: user.userId,
            password: user.password
          }
        })
      })
    } catch {
      // Ignore cleanup errors
    }
  }

  createdUsers = []
  createdRooms = []
}

export async function checkServerHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${getTestHomeserverUrl()}/_matrix/client/versions`, {
      method: 'GET'
    })
    return response.ok
  } catch {
    return false
  }
}

export async function getServerVersion(): Promise<{ server: { name: string; version: string } } | null> {
  try {
    const response = await fetch(`${getTestHomeserverUrl()}/_matrix/client/versions`)
    if (response.ok) {
      return await response.json()
    }
    return null
  } catch {
    return null
  }
}
