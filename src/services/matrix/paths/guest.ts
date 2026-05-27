export const GUEST = {
  REGISTER: '/_matrix/client/v3/register/guest',
  LOGIN: '/_matrix/client/v3/login',
  INFO: '/_matrix/client/v3/account/guest',
  VALIDATE: '/_matrix/client/v3/guest/validate',
  UPGRADE: '/_matrix/client/v3/account/guest/upgrade',
  ROOMS: '/_matrix/client/v3/guest/rooms'
} as const
