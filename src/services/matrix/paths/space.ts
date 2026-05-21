export const SPACE = {
  HIERARCHY: (spaceId: string) => `/_matrix/client/v1/spaces/${encodeURIComponent(spaceId)}/hierarchy`,
  HIERARCHY_V1: (spaceId: string) => `/_matrix/client/v1/spaces/${encodeURIComponent(spaceId)}/hierarchy/v1`,
  ROOM_HIERARCHY: (spaceId: string) => `/_matrix/client/v1/rooms/${encodeURIComponent(spaceId)}/hierarchy`,
  CREATE: '/_matrix/client/v3/spaces',
  BY_ID: (spaceId: string) => `/_matrix/client/v3/spaces/${encodeURIComponent(spaceId)}`,
  UPDATE: (spaceId: string) => `/_matrix/client/v3/spaces/${encodeURIComponent(spaceId)}`,
  DELETE: (spaceId: string) => `/_matrix/client/v3/spaces/${encodeURIComponent(spaceId)}`,
  BY_ROOM: (roomId: string) => `/_matrix/client/v3/spaces/room/${encodeURIComponent(roomId)}`,
  PUBLIC: '/_matrix/client/v3/spaces/public',
  SEARCH: '/_matrix/client/v3/spaces/search',
  STATISTICS: '/_matrix/client/v3/spaces/statistics',
  USER: '/_matrix/client/v3/spaces/user',
  CHILDREN: (spaceId: string) => `/_matrix/client/v3/spaces/${encodeURIComponent(spaceId)}/children`,
  CHILD_BY_ID: (spaceId: string, roomId: string) =>
    `/_matrix/client/v3/spaces/${encodeURIComponent(spaceId)}/children/${encodeURIComponent(roomId)}`,
  MEMBERS: (spaceId: string) => `/_matrix/client/v3/spaces/${encodeURIComponent(spaceId)}/members`,
  ROOMS: (spaceId: string) => `/_matrix/client/v3/spaces/${encodeURIComponent(spaceId)}/rooms`,
  STATE: (spaceId: string) => `/_matrix/client/v3/spaces/${encodeURIComponent(spaceId)}/state`,
  INVITE: (spaceId: string) => `/_matrix/client/v3/spaces/${encodeURIComponent(spaceId)}/invite`,
  JOIN: (spaceId: string) => `/_matrix/client/v3/spaces/${encodeURIComponent(spaceId)}/join`,
  LEAVE: (spaceId: string) => `/_matrix/client/v3/spaces/${encodeURIComponent(spaceId)}/leave`,
  SUMMARY: (spaceId: string) => `/_matrix/client/v3/spaces/${encodeURIComponent(spaceId)}/summary`,
  SUMMARY_WITH_CHILDREN: (spaceId: string) =>
    `/_matrix/client/v3/spaces/${encodeURIComponent(spaceId)}/summary/with_children`,
  TREE_PATH: (spaceId: string) => `/_matrix/client/v3/spaces/${encodeURIComponent(spaceId)}/tree_path`,
  PARENTS: (roomId: string) => `/_matrix/client/v3/spaces/room/${encodeURIComponent(roomId)}/parents`
} as const
