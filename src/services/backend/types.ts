export interface MatrixEndpointConfig {
  homeserverUrl: string
  identityServerUrl: string
}

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}
