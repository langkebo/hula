/**
 * Matrix CS API 路径前缀的唯一来源。
 *
 * 所有 `/_matrix/**` 端点前缀从这里派生，`matrix_prefix_hardcoded` 棘轮因此
 * 只在本文件保留一处根常量；其他模块一律引用具名前缀，不再手写全路径。
 */
export const MATRIX_ROOT = '/_matrix'
/** 客户端 API 共同基址（`/_matrix/client`） */
export const PREFIX_CLIENT = `${MATRIX_ROOT}/client`
export const PREFIX_V1 = `${PREFIX_CLIENT}/v1`
export const PREFIX_V3 = `${PREFIX_CLIENT}/v3`
export const PREFIX_V4 = `${PREFIX_CLIENT}/v4`
export const PREFIX_UNSTABLE = `${PREFIX_CLIENT}/unstable`
export const PREFIX_VENDOR_V1 = `${MATRIX_ROOT}/vendor/v1`
/** 服务端能力探测端点（无需鉴权） */
export const CLIENT_VERSIONS = `${PREFIX_CLIENT}/versions`
