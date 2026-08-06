export {
  DEFAULT_MATRIX_HOMESERVER_URL,
  DEFAULT_MATRIX_IDENTITY_SERVER_URL,
  getDefaultMatrixEndpointConfig,
  isPotentialHomeserverInput,
  isValidHttpUrl,
  resolveMatrixEndpointConfig,
  resolveMatrixRuntimeEndpointConfig,
  resolveMatrixRuntimeHomeserverUrl,
  saveMatrixHomeserverUrl,
  saveMatrixIdentityServerUrl,
  saveMatrixSessionEndpointConfig
} from './config'
export { discoverAndSaveMatrixEndpoints } from './discovery'
export { matrixExtensionEndpoints } from './endpoints'
