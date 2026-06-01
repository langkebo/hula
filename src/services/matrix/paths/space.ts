export const SPACE = {
  HIERARCHY: (spaceId: string) => `/_matrix/client/v1/spaces/${encodeURIComponent(spaceId)}/hierarchy`,
  HIERARCHY_V1: (spaceId: string) => `/_matrix/client/v1/spaces/${encodeURIComponent(spaceId)}/hierarchy/v1`,
  ROOM_HIERARCHY: (spaceId: string) => `/_matrix/client/v1/rooms/${encodeURIComponent(spaceId)}/hierarchy`,
  /** @deprecated Use MatrixSpaceService.createSpace() instead */
  CREATE: '/_matrix/client/v3/spaces',
  /** @deprecated Use MatrixSpaceService.getSpace() instead */
  BY_ID: (spaceId: string) => `/_matrix/client/v3/spaces/${encodeURIComponent(spaceId)}`,
  /** @deprecated Use MatrixSpaceService.updateSpace() instead */
  UPDATE: (spaceId: string) => `/_matrix/client/v3/spaces/${encodeURIComponent(spaceId)}`,
  /** @deprecated Use MatrixSpaceService.deleteSpace() instead */
  DELETE: (spaceId: string) => `/_matrix/client/v3/spaces/${encodeURIComponent(spaceId)}`,
  BY_ROOM: (roomId: string) => `/_matrix/client/v3/spaces/room/${encodeURIComponent(roomId)}`,
  /** @deprecated Use MatrixSpaceService.getPublicSpaces() instead */
  PUBLIC: '/_matrix/client/v3/spaces/public',
  SEARCH: '/_matrix/client/v3/spaces/search',
  STATISTICS: '/_matrix/client/v3/spaces/statistics',
  USER: '/_matrix/client/v3/spaces/user',
  /** @deprecated Use MatrixSpaceService space children methods instead */
  CHILDREN: (spaceId: string) => `/_matrix/client/v3/spaces/${encodeURIComponent(spaceId)}/children`,
  /** @deprecated Use MatrixSpaceService space children methods instead */
  CHILD_BY_ID: (spaceId: string, roomId: string) =>
    `/_matrix/client/v3/spaces/${encodeURIComponent(spaceId)}/children/${encodeURIComponent(roomId)}`,
  MEMBERS: (spaceId: string) => `/_matrix/client/v3/spaces/${encodeURIComponent(spaceId)}/members`,
  ROOMS: (spaceId: string) => `/_matrix/client/v3/spaces/${encodeURIComponent(spaceId)}/rooms`,
  /** @deprecated Use MatrixSpaceService.getState() instead */
  STATE: (spaceId: string) => `/_matrix/client/v3/spaces/${encodeURIComponent(spaceId)}/state`,
  /** @deprecated Use MembershipService.invite() instead */
  INVITE: (spaceId: string) => `/_matrix/client/v3/spaces/${encodeURIComponent(spaceId)}/invite`,
  /** @deprecated Use MembershipService.join() instead */
  JOIN: (spaceId: string) => `/_matrix/client/v3/spaces/${encodeURIComponent(spaceId)}/join`,
  /** @deprecated Use MembershipService.leave() instead */
  LEAVE: (spaceId: string) => `/_matrix/client/v3/spaces/${encodeURIComponent(spaceId)}/leave`,
  /** @deprecated Use MatrixSpaceService.getSummary() instead */
  SUMMARY: (spaceId: string) => `/_matrix/client/v3/spaces/${encodeURIComponent(spaceId)}/summary`,
  SUMMARY_WITH_CHILDREN: (spaceId: string) =>
    `/_matrix/client/v3/spaces/${encodeURIComponent(spaceId)}/summary/with_children`,
  TREE_PATH: (spaceId: string) => `/_matrix/client/v3/spaces/${encodeURIComponent(spaceId)}/tree_path`,
  PARENTS: (roomId: string) => `/_matrix/client/v3/spaces/room/${encodeURIComponent(roomId)}/parents`
} as const
