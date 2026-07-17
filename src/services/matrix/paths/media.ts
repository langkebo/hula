import { PREFIX_V1 } from './prefixes'

export const MEDIA = {
  /** @deprecated Use client.uploadContent() instead */
  UPLOAD: '/_matrix/media/v3/upload',
  UPLOAD_WITH_ID: (serverName: string, mediaId: string) =>
    `/_matrix/media/v3/upload/${encodeURIComponent(serverName)}/${encodeURIComponent(mediaId)}`,
  CONFIG: '/_matrix/media/v3/config',
  DELETE: (serverName: string, mediaId: string) =>
    `/_matrix/media/v3/delete/${encodeURIComponent(serverName)}/${encodeURIComponent(mediaId)}`,
  QUOTA_ALERTS: '/_matrix/media/v1/quota/alerts',
  QUOTA_CHECK: '/_matrix/media/v1/quota/check',
  QUOTA_STATS: '/_matrix/media/v1/quota/stats',
  CLIENT_MEDIA_CONFIG: PREFIX_V1 + '/media/config',
  PREVIEW_URL: '/_matrix/media/r0/preview_url',
  DOWNLOAD_PREFIX: '/_matrix/media/r0/download/',
  MEDIA_PREFIX: '/_matrix/media/'
} as const
