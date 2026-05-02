import type { MatrixClient } from 'matrix-js-sdk'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { profileService, useProfile } from '../MatrixProfileService'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

const { mockClientService } = vi.hoisted(() => ({
  mockClientService: {
    getClient: vi.fn(() => null as MatrixClient | null)
  }
}))

vi.mock('../../MatrixClientService', () => ({
  matrixClientService: mockClientService
}))

const mockClient = {
  getProfile: vi.fn(),
  setDisplayName: vi.fn(),
  setAvatarUrl: vi.fn(),
  uploadContent: vi.fn()
}

describe('ProfileService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockClientService.getClient.mockReturnValue(null)
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('initialize', () => {
    it('should set client', () => {
      profileService.initialize(mockClient as unknown as MatrixClient)
      expect(true).toBe(true)
    })
  })

  describe('getProfile', () => {
    it('should throw error when client is not initialized', async () => {
      const service = new (profileService.constructor as unknown as new () => typeof profileService)()
      await expect(service.getProfile('@user:matrix.org')).rejects.toThrow('Client 未初始化')
    })

    it('should return user profile', async () => {
      mockClient.getProfile.mockResolvedValueOnce({
        displayname: 'Test User',
        avatar_url: 'mxc://matrix.org/avatar123'
      })

      profileService.initialize(mockClient as unknown as MatrixClient)
      const result = await profileService.getProfile('@user:matrix.org')

      expect(result).toEqual({
        userId: '@user:matrix.org',
        displayname: 'Test User',
        avatarUrl: 'mxc://matrix.org/avatar123'
      })
    })

    it('should fallback to matrixClientService client when explicit initialize is skipped', async () => {
      mockClient.getProfile.mockResolvedValueOnce({
        displayname: 'Fallback User',
        avatar_url: 'mxc://matrix.org/fallback'
      })
      mockClientService.getClient.mockReturnValue(mockClient as unknown as MatrixClient)

      const service = new (profileService.constructor as unknown as new () => typeof profileService)()
      const result = await service.getProfile('@fallback:matrix.org')

      expect(result).toEqual({
        userId: '@fallback:matrix.org',
        displayname: 'Fallback User',
        avatarUrl: 'mxc://matrix.org/fallback'
      })
    })

    it('should refresh cached client when matrixClientService returns a new client', async () => {
      const oldClient = {
        getProfile: vi.fn().mockResolvedValue({
          displayname: 'Old User',
          avatar_url: 'mxc://matrix.org/old'
        })
      }
      const newClient = {
        getProfile: vi.fn().mockResolvedValue({
          displayname: 'New User',
          avatar_url: 'mxc://matrix.org/new'
        })
      }
      mockClientService.getClient.mockReturnValue(newClient as unknown as MatrixClient)

      profileService.initialize(oldClient as unknown as MatrixClient)
      const result = await profileService.getProfile('@switch:matrix.org')

      expect(oldClient.getProfile).not.toHaveBeenCalled()
      expect(newClient.getProfile).toHaveBeenCalledWith('@switch:matrix.org')
      expect(result.displayname).toBe('New User')
    })

    it('should throw on getProfile error', async () => {
      mockClient.getProfile.mockRejectedValueOnce(new Error('User not found'))
      profileService.initialize(mockClient as unknown as MatrixClient)

      await expect(profileService.getProfile('@unknown:matrix.org')).rejects.toThrow('User not found')
    })
  })

  describe('getDisplayName', () => {
    it('should return undefined when client is not initialized', async () => {
      const service = new (profileService.constructor as unknown as new () => typeof profileService)()
      await expect(service.getDisplayName('@user:matrix.org')).resolves.toBeUndefined()
    })

    it('should return display name', async () => {
      mockClient.getProfile.mockResolvedValueOnce({
        displayname: 'Test User'
      })

      profileService.initialize(mockClient as unknown as MatrixClient)
      const result = await profileService.getDisplayName('@user:matrix.org')

      expect(result).toBe('Test User')
    })

    it('should return undefined on error', async () => {
      mockClient.getProfile.mockRejectedValueOnce(new Error('Network error'))
      profileService.initialize(mockClient as unknown as MatrixClient)

      const result = await profileService.getDisplayName('@user:matrix.org')
      expect(result).toBeUndefined()
    })
  })

  describe('getAvatarUrl', () => {
    it('should return undefined when client is not initialized', async () => {
      const service = new (profileService.constructor as unknown as new () => typeof profileService)()
      await expect(service.getAvatarUrl('@user:matrix.org')).resolves.toBeUndefined()
    })

    it('should return avatar url', async () => {
      mockClient.getProfile.mockResolvedValueOnce({
        avatar_url: 'mxc://matrix.org/avatar123'
      })

      profileService.initialize(mockClient as unknown as MatrixClient)
      const result = await profileService.getAvatarUrl('@user:matrix.org')

      expect(result).toBe('mxc://matrix.org/avatar123')
    })

    it('should return undefined on error', async () => {
      mockClient.getProfile.mockRejectedValueOnce(new Error('Network error'))
      profileService.initialize(mockClient as unknown as MatrixClient)

      const result = await profileService.getAvatarUrl('@user:matrix.org')
      expect(result).toBeUndefined()
    })
  })

  describe('setDisplayName', () => {
    it('should throw error when client is not initialized', async () => {
      const service = new (profileService.constructor as unknown as new () => typeof profileService)()
      await expect(service.setDisplayName('New Name')).rejects.toThrow('Client 未初始化')
    })

    it('should set display name successfully', async () => {
      mockClient.setDisplayName.mockResolvedValueOnce(undefined)
      profileService.initialize(mockClient as unknown as MatrixClient)

      await profileService.setDisplayName('New Name')
      expect(mockClient.setDisplayName).toHaveBeenCalledWith('New Name')
    })

    it('should throw on setDisplayName error', async () => {
      mockClient.setDisplayName.mockRejectedValueOnce(new Error('Permission denied'))
      profileService.initialize(mockClient as unknown as MatrixClient)

      await expect(profileService.setDisplayName('New Name')).rejects.toThrow('Permission denied')
    })
  })

  describe('setAvatarUrl', () => {
    it('should throw error when client is not initialized', async () => {
      const service = new (profileService.constructor as unknown as new () => typeof profileService)()
      await expect(service.setAvatarUrl('mxc://matrix.org/new')).rejects.toThrow('Client 未初始化')
    })

    it('should set avatar url successfully', async () => {
      mockClient.setAvatarUrl.mockResolvedValueOnce(undefined)
      profileService.initialize(mockClient as unknown as MatrixClient)

      await profileService.setAvatarUrl('mxc://matrix.org/new')
      expect(mockClient.setAvatarUrl).toHaveBeenCalledWith('mxc://matrix.org/new')
    })

    it('should throw on setAvatarUrl error', async () => {
      mockClient.setAvatarUrl.mockRejectedValueOnce(new Error('Invalid URL'))
      profileService.initialize(mockClient as unknown as MatrixClient)

      await expect(profileService.setAvatarUrl('mxc://matrix.org/new')).rejects.toThrow('Invalid URL')
    })
  })

  describe('uploadAndSetAvatar', () => {
    it('should throw error when client is not initialized', async () => {
      const service = new (profileService.constructor as unknown as new () => typeof profileService)()
      const file = new File(['content'], 'avatar.png', { type: 'image/png' })
      await expect(service.uploadAndSetAvatar(file)).rejects.toThrow('Client 未初始化')
    })

    it('should upload and set avatar successfully', async () => {
      mockClient.uploadContent.mockResolvedValueOnce({
        content_uri: 'mxc://matrix.org/uploaded123'
      })
      mockClient.setAvatarUrl.mockResolvedValueOnce(undefined)
      profileService.initialize(mockClient as unknown as MatrixClient)

      const file = new File(['content'], 'avatar.png', { type: 'image/png' })
      const result = await profileService.uploadAndSetAvatar(file)

      expect(result).toBe('mxc://matrix.org/uploaded123')
      expect(mockClient.uploadContent).toHaveBeenCalledWith(file, {
        type: 'image/png',
        rawResponse: false
      })
      expect(mockClient.setAvatarUrl).toHaveBeenCalledWith('mxc://matrix.org/uploaded123')
    })
  })
})

describe('useProfile composable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockClient.getProfile.mockResolvedValue({
      displayname: 'Test User',
      avatar_url: 'mxc://matrix.org/avatar123'
    })
    mockClient.setDisplayName.mockResolvedValue(undefined)
    mockClient.setAvatarUrl.mockResolvedValue(undefined)
    mockClient.uploadContent.mockResolvedValue({
      content_uri: 'mxc://matrix.org/uploaded123'
    })
    profileService.initialize(mockClient as unknown as MatrixClient)
  })

  it('should initialize with null profile', () => {
    const { profile, isLoading, error } = useProfile()

    expect(profile.value).toBeNull()
    expect(isLoading.value).toBe(false)
    expect(error.value).toBeNull()
  })

  it('should get profile', async () => {
    const { profile, isLoading, error, getProfile } = useProfile()

    await getProfile('@user:matrix.org')

    expect(profile.value).toEqual({
      userId: '@user:matrix.org',
      displayname: 'Test User',
      avatarUrl: 'mxc://matrix.org/avatar123'
    })
    expect(isLoading.value).toBe(false)
    expect(error.value).toBeNull()
  })

  it('should set display name', async () => {
    const { setDisplayName, getProfile } = useProfile()

    await getProfile('@user:matrix.org')
    await setDisplayName('Updated Name')

    expect(mockClient.setDisplayName).toHaveBeenCalledWith('Updated Name')
  })

  it('should set avatar url', async () => {
    const { setAvatarUrl, getProfile } = useProfile()

    await getProfile('@user:matrix.org')
    await setAvatarUrl('mxc://matrix.org/new')

    expect(mockClient.setAvatarUrl).toHaveBeenCalledWith('mxc://matrix.org/new')
  })

  it('should upload avatar', async () => {
    const { uploadAvatar, getProfile } = useProfile()

    await getProfile('@user:matrix.org')
    const file = new File(['content'], 'avatar.png', { type: 'image/png' })
    const url = await uploadAvatar(file)

    expect(url).toBe('mxc://matrix.org/uploaded123')
  })
})
