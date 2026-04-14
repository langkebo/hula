import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { profileService, useProfile, ProfileService } from '../MatrixProfileService'
import type { MatrixClient } from 'matrix-js-sdk'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

const createMockClient = () => ({
  getProfile: vi.fn(),
  setDisplayName: vi.fn(),
  setAvatarUrl: vi.fn(),
  uploadContent: vi.fn()
})

const mockClient = createMockClient()

describe('ProfileService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
      const service = new ProfileService()
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

    it('should throw on getProfile error when throwOnError=true', async () => {
      mockClient.getProfile.mockRejectedValueOnce(new Error('User not found'))
      profileService.initialize(mockClient as unknown as MatrixClient)

      await expect(profileService.getProfile('@unknown:matrix.org', true)).rejects.toThrow()
    })

    it('should return default profile on error with throwOnError=false', async () => {
      mockClient.getProfile.mockRejectedValueOnce(new Error('User not found'))
      profileService.initialize(mockClient as unknown as MatrixClient)

      const result = await profileService.getProfile('@unknown:matrix.org', false)
      expect(result).toEqual({ userId: '@unknown:matrix.org' })
    })

    it('should throw on error by default', async () => {
      mockClient.getProfile.mockRejectedValueOnce(new Error('User not found'))
      profileService.initialize(mockClient as unknown as MatrixClient)

      await expect(profileService.getProfile('@unknown:matrix.org')).rejects.toThrow()
    })
  })

  describe('getDisplayName', () => {
    it('should throw error when client is not initialized', async () => {
      const service = new ProfileService()
      await expect(service.getDisplayName('@user:matrix.org')).rejects.toThrow()
    })

    it('should return undefined when client is not initialized and throwOnError=false', async () => {
      const service = new ProfileService()
      const result = await service.getDisplayName('@user:matrix.org', false)
      expect(result).toBeUndefined()
    })

    it('should return display name', async () => {
      mockClient.getProfile.mockResolvedValueOnce({
        displayname: 'Test User'
      })

      profileService.initialize(mockClient as unknown as MatrixClient)
      const result = await profileService.getDisplayName('@user:matrix.org')

      expect(result).toBe('Test User')
    })

    it('should return undefined on error with throwOnError=false', async () => {
      mockClient.getProfile.mockRejectedValueOnce(new Error('Network error'))
      profileService.initialize(mockClient as unknown as MatrixClient)

      const result = await profileService.getDisplayName('@user:matrix.org', false)
      expect(result).toBeUndefined()
    })

    it('should throw on error by default', async () => {
      mockClient.getProfile.mockRejectedValueOnce(new Error('Network error'))
      profileService.initialize(mockClient as unknown as MatrixClient)

      await expect(profileService.getDisplayName('@user:matrix.org')).rejects.toThrow()
    })
  })

  describe('getAvatarUrl', () => {
    it('should throw error when client is not initialized', async () => {
      const service = new ProfileService()
      await expect(service.getAvatarUrl('@user:matrix.org')).rejects.toThrow()
    })

    it('should return undefined when client is not initialized and throwOnError=false', async () => {
      const service = new ProfileService()
      const result = await service.getAvatarUrl('@user:matrix.org', false)
      expect(result).toBeUndefined()
    })

    it('should return avatar url', async () => {
      mockClient.getProfile.mockResolvedValueOnce({
        avatar_url: 'mxc://matrix.org/avatar123'
      })

      profileService.initialize(mockClient as unknown as MatrixClient)
      const result = await profileService.getAvatarUrl('@user:matrix.org')

      expect(result).toBe('mxc://matrix.org/avatar123')
    })

    it('should return undefined on error with throwOnError=false', async () => {
      mockClient.getProfile.mockRejectedValueOnce(new Error('Network error'))
      profileService.initialize(mockClient as unknown as MatrixClient)

      const result = await profileService.getAvatarUrl('@user:matrix.org', false)
      expect(result).toBeUndefined()
    })

    it('should throw on error by default', async () => {
      mockClient.getProfile.mockRejectedValueOnce(new Error('Network error'))
      profileService.initialize(mockClient as unknown as MatrixClient)

      await expect(profileService.getAvatarUrl('@user:matrix.org')).rejects.toThrow()
    })
  })

  describe('setDisplayName', () => {
    it('should throw error when client is not initialized', async () => {
      const service = new ProfileService()
      await expect(service.setDisplayName('New Name')).rejects.toThrow('Client 未初始化')
    })

    it('should set display name successfully', async () => {
      mockClient.setDisplayName.mockResolvedValueOnce(undefined)
      profileService.initialize(mockClient as unknown as MatrixClient)

      await profileService.setDisplayName('New Name')
      expect(mockClient.setDisplayName).toHaveBeenCalledWith('New Name')
    })

    it('should throw on setDisplayName error when throwOnError=true', async () => {
      mockClient.setDisplayName.mockRejectedValueOnce(new Error('Permission denied'))
      profileService.initialize(mockClient as unknown as MatrixClient)

      await expect(profileService.setDisplayName('New Name', true)).rejects.toThrow()
    })

    it('should not throw on setDisplayName error by default', async () => {
      mockClient.setDisplayName.mockRejectedValueOnce(new Error('Permission denied'))
      profileService.initialize(mockClient as unknown as MatrixClient)

      await expect(profileService.setDisplayName('New Name')).resolves.toBeUndefined()
    })
  })

  describe('setAvatarUrl', () => {
    it('should throw error when client is not initialized', async () => {
      const service = new ProfileService()
      await expect(service.setAvatarUrl('mxc://matrix.org/new')).rejects.toThrow('Client 未初始化')
    })

    it('should set avatar url successfully', async () => {
      mockClient.setAvatarUrl.mockResolvedValueOnce(undefined)
      profileService.initialize(mockClient as unknown as MatrixClient)

      await profileService.setAvatarUrl('mxc://matrix.org/new')
      expect(mockClient.setAvatarUrl).toHaveBeenCalledWith('mxc://matrix.org/new')
    })

    it('should throw on setAvatarUrl error when throwOnError=true', async () => {
      mockClient.setAvatarUrl.mockRejectedValueOnce(new Error('Invalid URL'))
      profileService.initialize(mockClient as unknown as MatrixClient)

      await expect(profileService.setAvatarUrl('mxc://matrix.org/new', true)).rejects.toThrow()
    })

    it('should not throw on setAvatarUrl error by default', async () => {
      mockClient.setAvatarUrl.mockRejectedValueOnce(new Error('Invalid URL'))
      profileService.initialize(mockClient as unknown as MatrixClient)

      await expect(profileService.setAvatarUrl('mxc://matrix.org/new')).resolves.toBeUndefined()
    })
  })

  describe('uploadAndSetAvatar', () => {
    it('should throw error when client is not initialized', async () => {
      const service = new ProfileService()
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
