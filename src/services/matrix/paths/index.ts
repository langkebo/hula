import { matrixExtensionEndpoints } from '@/services/backend/endpoints'
import { ACCOUNT_DATA } from './accountData'
import { ADMIN } from './admin'
import { AI } from './ai'
import { AUTH } from './auth'
import { BURN } from './burn'
import { CLIENT_CONFIG } from './clientConfig'
import { CRYPTO } from './crypto'
import { DM } from './dm'
import { FRIENDS } from './friends'
import { GUEST } from './guest'
import { MEDIA } from './media'
import { MODERATION } from './moderation'
import { NOTIFICATION } from './notification'
import { RELATIONS } from './relations'
import { RENDEZVOUS } from './rendezvous'
import { ROOM } from './room'
import { SPACE } from './space'
import { SYNC } from './sync'
import { USER } from './user'
import { VOICE } from './voice'
import { WELL_KNOWN } from './wellKnown'
import { WIDGET } from './widget'

export { PREFIX_V1, PREFIX_V3 } from './prefixes'

export const MATRIX_PATHS = {
  AUTH,
  ROOM,
  BURN,
  FRIENDS,
  CRYPTO,
  SPACE,
  AI,
  SYNC,
  NOTIFICATION,
  MEDIA,
  USER,
  ADMIN,
  RENDEZVOUS,
  VOICE,
  WELL_KNOWN,
  CLIENT_CONFIG,
  GUEST,
  ACCOUNT_DATA,
  RELATIONS,
  WIDGET,
  DM,
  MODERATION,
  EXTENSIONS: matrixExtensionEndpoints
} as const
