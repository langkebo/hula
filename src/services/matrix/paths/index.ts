import { matrixExtensionEndpoints } from '@/services/backend/endpoints'
import { ADMIN } from './admin'
import { AI } from './ai'
import { AUTH } from './auth'
import { BURN } from './burn'
import { CLIENT_CONFIG } from './clientConfig'
import { CRYPTO } from './crypto'
import { DEHYDRATED_DEVICE } from './dehydratedDevice'
import { EVENT_REPORT } from './eventReport'
import { FRIENDS } from './friends'
import { GUEST } from './guest'
import { MEDIA } from './media'
import { NOTIFICATION } from './notification'
import { RENDEZVOUS } from './rendezvous'
import { ROOM } from './room'
import { SPACE } from './space'
import { SYNC } from './sync'
import { USER } from './user'
import { VOICE } from './voice'
import { WELL_KNOWN } from './wellKnown'

export const MATRIX_PATHS = {
  AUTH,
  ROOM,
  BURN,
  FRIENDS,
  CRYPTO,
  DEHYDRATED_DEVICE,
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
  EVENT_REPORT,
  GUEST,
  EXTENSIONS: matrixExtensionEndpoints
} as const
