import { computed } from 'vue'

export interface GalleryAvatar {
  id: number
  url: string
  name: string
}

const AVATAR_COUNT = 22
const padId = (id: number) => String(id).padStart(3, '0')

const avatarList = computed<GalleryAvatar[]>(() =>
  Array.from({ length: AVATAR_COUNT }, (_, i) => {
    const id = i + 1
    return { id, url: `/avatar/${padId(id)}.webp`, name: `Avatar ${id}` }
  })
)

function selectAvatar(id: number): string {
  if (id < 1 || id > AVATAR_COUNT || !Number.isInteger(id)) {
    throw new Error(`Invalid avatar id: ${id}. Must be 1-${AVATAR_COUNT}`)
  }
  return `/avatar/${padId(id)}.webp`
}

export function useAvatarGallery() {
  return { avatarList, selectAvatar }
}
