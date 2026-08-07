import { describe, expect, it } from 'vitest'
import { useAvatarGallery } from '../useAvatarGallery'

describe('useAvatarGallery', () => {
  it('returns 22 built-in avatars', () => {
    const { avatarList } = useAvatarGallery()
    expect(avatarList.value).toHaveLength(22)
  })

  it('avatars have sequential ids 1-22 and webp URLs', () => {
    const { avatarList } = useAvatarGallery()
    expect(avatarList.value[0]).toEqual({ id: 1, url: '/avatar/001.webp', name: 'Avatar 1' })
    expect(avatarList.value[21]).toEqual({ id: 22, url: '/avatar/022.webp', name: 'Avatar 22' })
  })

  it('selectAvatar returns the webp URL for given id', () => {
    const { selectAvatar } = useAvatarGallery()
    expect(selectAvatar(5)).toBe('/avatar/005.webp')
    expect(selectAvatar(22)).toBe('/avatar/022.webp')
  })

  it('selectAvatar throws for invalid id', () => {
    const { selectAvatar } = useAvatarGallery()
    expect(() => selectAvatar(0)).toThrow('Invalid avatar id')
    expect(() => selectAvatar(23)).toThrow('Invalid avatar id')
  })
})
