import type { MatrixClient } from '../sdk'

/**
 * 读取地图瓦片样式 URL，按优先级回退：
 *
 * 1. 服务端 `.well-known/matrix/client` 下发的 `m.tile_server.map_style_url`（权威来源，Phase A4/B3）；
 * 2. 客户端本地配置的瓦片样式 URL（对齐 element-web `SdkConfig.get().map_style_url`）。
 *
 * Tjg 的 matrix-js-sdk fork（v40.x）未导出 SdkConfig，且当前无客户端侧瓦片样式配置来源，
 * 因此第 2 层 `getConfigMapStyleUrl` 暂返回 undefined；后续引入客户端配置时在此接入。
 *
 * @returns 瓦片样式 URL；两层都缺失时返回 undefined，调用方应回退到 StaticProxyMap（腾讯静态代理）。
 */
export function getMapStyleUrl(client: MatrixClient): string | undefined {
  const wellKnownUrl = client.getClientWellKnown()?.['m.tile_server']?.map_style_url
  if (wellKnownUrl) return wellKnownUrl
  return getConfigMapStyleUrl()
}

/**
 * 回退链第 2 层：客户端本地配置的瓦片样式 URL。
 *
 * 对齐 element-web 的 `SdkConfig.get().map_style_url`。当前 Tjg fork 无此配置项，
 * 恒返回 undefined，留作未来接入客户端侧瓦片样式配置的扩展点。
 */
function getConfigMapStyleUrl(): string | undefined {
  return undefined
}
