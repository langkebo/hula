/**
 * Profile 域测试夹具。
 *
 * 类型来源是 `MatrixClient` 的**真实签名**（`IProfile` / `UploadResponse` 未在本仓 sdk 门面导出，
 * 因此从 client 方法返回推导），避免测试手抄字段造成漂移。
 */
import type { MatrixClient } from 'matrix-js-sdk'
import type { profileService } from '@/services/matrix/user/MatrixProfileService'

/** `client.getProfileInfo(userId)` 的响应。 */
export type ProfileInfoFixture = Awaited<ReturnType<MatrixClient['getProfileInfo']>>

/** `client.uploadContent(file, { rawResponse: false })` 的响应。 */
export type UploadContentFixture = Awaited<ReturnType<MatrixClient['uploadContent']>>

/** `profileService.getProfile(userId)` 的响应（服务层补齐 `userId`，字段为驼峰）。 */
export type ProfileFixture = Awaited<ReturnType<typeof profileService.getProfile>>

/** `profileService.getExtendedProfile(userId)` 的扩展资料。 */
export type ExtendedProfileFixture = Awaited<ReturnType<typeof profileService.getExtendedProfile>>

export function makeExtendedProfile(overrides: Partial<ExtendedProfileFixture> = {}): ExtendedProfileFixture {
  return {
    sex: 0,
    resume: '',
    region: '',
    birthday: '',
    displayBirthdayTag: true,
    displayAge: true,
    displayConstellation: true,
    ...overrides
  }
}

export function makeProfile(overrides: Partial<ProfileFixture> = {}): ProfileFixture {
  return {
    userId: '@test:matrix.org',
    displayname: 'Test User',
    avatarUrl: 'mxc://matrix.org/avatar123',
    ...overrides
  }
}

export function makeProfileInfo(overrides: Partial<ProfileInfoFixture> = {}): ProfileInfoFixture {
  return { displayname: 'Test User', avatar_url: 'mxc://matrix.org/avatar123', ...overrides }
}

export function makeUploadResponse(overrides: Partial<UploadContentFixture> = {}): UploadContentFixture {
  return { content_uri: 'mxc://matrix.org/uploaded123', ...overrides }
}
