export {
  clearMatrixSessionEndpointConfig,
  DEFAULT_MATRIX_HOMESERVER_URL,
  DEFAULT_MATRIX_IDENTITY_SERVER_URL,
  getDefaultMatrixEndpointConfig,
  isValidHttpUrl,
  MATRIX_HOMESERVER_STORAGE_KEY,
  MATRIX_IDENTITY_SERVER_STORAGE_KEY,
  MATRIX_SESSION_HOMESERVER_STORAGE_KEY,
  MATRIX_SESSION_IDENTITY_SERVER_STORAGE_KEY,
  normalizeHttpUrl,
  resolveMatrixEndpointConfig,
  resolveMatrixRuntimeEndpointConfig,
  resolveMatrixRuntimeHomeserverUrl,
  resolveMatrixSessionEndpointConfig,
  saveMatrixHomeserverUrl,
  saveMatrixIdentityServerUrl,
  saveMatrixSessionEndpointConfig
} from './config'
export { discoverAndSaveMatrixEndpoints, discoverMatrixEndpoints } from './discovery'
export { matrixExtensionEndpoints } from './endpoints'
export type { MatrixDiscoveryResult, MatrixEndpointConfig, StorageLike } from './types'
