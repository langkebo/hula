import { PREFIX_V1 } from './prefixes'

export const SPACE = {
  HIERARCHY: (spaceId: string) => `${PREFIX_V1}/spaces/${encodeURIComponent(spaceId)}/hierarchy`,
  HIERARCHY_V1: (spaceId: string) => `${PREFIX_V1}/spaces/${encodeURIComponent(spaceId)}/hierarchy/v1`,
  ROOM_HIERARCHY: (spaceId: string) => `${PREFIX_V1}/rooms/${encodeURIComponent(spaceId)}/hierarchy`,
  /** @deprecated Use MatrixSpaceService.createSpace() instead */
  CREATE: '/spaces',
  /** @deprecated Use MatrixSpaceService.getSpace() instead */
  BY_ID: (spaceId: string) => `/spaces/${encodeURIComponent(spaceId)}`,
  /** @deprecated Use MatrixSpaceService.updateSpace() instead */
  UPDATE: (spaceId: string) => `/spaces/${encodeURIComponent(spaceId)}`,
  /** @deprecated Use MatrixSpaceService.deleteSpace() instead */
  DELETE: (spaceId: string) => `/spaces/${encodeURIComponent(spaceId)}`,
  BY_ROOM: (roomId: string) => `/spaces/room/${encodeURIComponent(roomId)}`,
  /** @deprecated Use MatrixSpaceService.getPublicSpaces() instead */
  PUBLIC: '/spaces/public',
  SEARCH: '/spaces/search',
  STATISTICS: '/spaces/statistics',
  USER: '/spaces/user',
  /** @deprecated Use MatrixSpaceService space children methods instead */
  CHILDREN: (spaceId: string) => `/spaces/${encodeURIComponent(spaceId)}/children`,
  /** @deprecated Use MatrixSpaceService space children methods instead */
  CHILD_BY_ID: (spaceId: string, roomId: string) =>
    `/spaces/${encodeURIComponent(spaceId)}/children/${encodeURIComponent(roomId)}`,
  MEMBERS: (spaceId: string) => `/spaces/${encodeURIComponent(spaceId)}/members`,
  ROOMS: (spaceId: string) => `/spaces/${encodeURIComponent(spaceId)}/rooms`,
  SUMMARY_WITH_CHILDREN: (spaceId: string) => `/spaces/${encodeURIComponent(spaceId)}/summary/with_children`,
  TREE_PATH: (spaceId: string) => `/spaces/${encodeURIComponent(spaceId)}/tree_path`,
  PARENTS: (roomId: string) => `/spaces/room/${encodeURIComponent(roomId)}/parents`
} as const
