export const WELL_KNOWN = {
  CLIENT: '/.well-known/matrix/client',
  /** @deprecated Unused - will be removed in a future version */
  SERVER: '/.well-known/matrix/server',
  OIDC_DISCOVERY: '/.well-known/openid-configuration'
} as const
