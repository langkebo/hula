import { type Ref, ref } from 'vue'
import { adminService } from '@/services/matrix/admin'

export interface SpaceInfo {
  spaceId: string
  name?: string
  creator?: string
  memberCount?: number
  roomCount?: number
  createdAt?: number
  [key: string]: unknown
}

interface SpaceDetail {
  name?: string
  topic?: string
  creator?: string
  visibility?: string
  joinRule?: string
  memberCount?: number
  [key: string]: unknown
}

export interface SpaceStats {
  joinedMembers?: number
  joinedLocalMembers?: number
  rooms?: number
  [key: string]: unknown
}

interface UseAdminSpacesResult {
  spaces: Ref<SpaceInfo[]>
  spacesLoading: Ref<boolean>
  selectedSpace: Ref<SpaceDetail | null>
  selectedSpaceId: Ref<string | null>
  spaceUsers: Ref<Array<Record<string, unknown>>>
  spaceRooms: Ref<Array<Record<string, unknown>>>
  spaceStats: Ref<SpaceStats | null>
  detailLoading: Ref<boolean>

  loadSpaces: () => Promise<void>
  selectSpace: (spaceId: string) => Promise<void>
  deleteSpace: (spaceId: string) => Promise<boolean>
  clearSelection: () => void
}

export function useAdminSpaces(): UseAdminSpacesResult {
  const spaces = ref<SpaceInfo[]>([])
  const spacesLoading = ref(false)

  const selectedSpace = ref<SpaceDetail | null>(null)
  const selectedSpaceId = ref<string | null>(null)
  const spaceUsers = ref<Array<Record<string, unknown>>>([])
  const spaceRooms = ref<Array<Record<string, unknown>>>([])
  const spaceStats = ref<SpaceStats | null>(null)
  const detailLoading = ref(false)

  async function loadSpaces() {
    spacesLoading.value = true
    try {
      const result = await adminService.adminGetSpaces()
      spaces.value = (result.spaces ?? []).map((s) => {
        const raw = s as Record<string, unknown>
        return {
          spaceId: (raw.room_id as string) ?? (raw.space_id as string) ?? '',
          name: raw.name as string | undefined,
          creator: raw.creator as string | undefined,
          memberCount: (raw.joined_members as number | undefined) ?? (raw.member_count as number | undefined),
          roomCount: raw.room_count as number | undefined,
          createdAt: (raw.created_ts as number | undefined) ?? (raw.created_at as number | undefined),
          ...raw
        }
      })
    } finally {
      spacesLoading.value = false
    }
  }

  async function selectSpace(spaceId: string) {
    selectedSpaceId.value = spaceId
    detailLoading.value = true
    try {
      const [detail, users, rooms, stats] = await Promise.all([
        adminService.getSpaceDetails(spaceId),
        adminService.getSpaceUsers(spaceId),
        adminService.getSpaceRooms(spaceId),
        adminService.getSpaceStats(spaceId)
      ])
      selectedSpace.value = detail as SpaceDetail | null
      spaceUsers.value = users
      spaceRooms.value = rooms
      spaceStats.value = stats as SpaceStats | null
    } finally {
      detailLoading.value = false
    }
  }

  async function deleteSpace(spaceId: string): Promise<boolean> {
    await adminService.adminDeleteSpace(spaceId)
    await loadSpaces()
    if (selectedSpaceId.value === spaceId) {
      clearSelection()
    }
    return true
  }

  function clearSelection() {
    selectedSpace.value = null
    selectedSpaceId.value = null
    spaceUsers.value = []
    spaceRooms.value = []
    spaceStats.value = null
  }

  return {
    spaces,
    spacesLoading,
    selectedSpace,
    selectedSpaceId,
    spaceUsers,
    spaceRooms,
    spaceStats,
    detailLoading,
    loadSpaces,
    selectSpace,
    deleteSpace,
    clearSelection
  }
}
