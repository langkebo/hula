export interface MatrixEndpointConfig {
  homeserverUrl: string
  identityServerUrl: string
}

export interface MatrixDiscoveryResult extends MatrixEndpointConfig {
  source: 'explicit_url' | 'well_known' | 'fallback' | 'derived_server_name' | 'sdk_discovery'
  serverName?: string
}

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}
