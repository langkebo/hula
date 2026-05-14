/**
 * Build-time .env schema validator (canonical JS implementation).
 *
 * Keep this file dependency-free so both `pnpm verify:env` (plain node) and
 * the Vite plugin (via the .ts re-export) can share the same rules. Spec:
 * plan §16.3.2.
 *
 * @typedef {'dev-local'|'dev-shared'|'qa'|'preprod'|'prod'} HulaEnv
 * @typedef {'legacy'|'hybrid'|'next'} SdkMode
 * @typedef {{severity:'error'|'warn', key:string, message:string}} EnvValidationIssue
 * @typedef {{issues:EnvValidationIssue[], ok:boolean, resolvedEnv:HulaEnv}} EnvValidationResult
 */

const ALL_ENVS = ['dev-local', 'dev-shared', 'qa', 'preprod', 'prod']
const SDK_MODES = ['legacy', 'hybrid', 'next']

function isStrictHttps(url) {
  return /^https:\/\//i.test(url)
}

function isLocalHttp(url) {
  return /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/|$)/i.test(url)
}

/**
 * @param {Record<string, string|undefined>} bag
 * @returns {EnvValidationResult}
 */
export function validateEnv(bag) {
  const issues = []
  const push = (severity, key, message) => issues.push({ severity, key, message })

  const resolvedEnv = bag.VITE_HULA_ENV ?? 'dev-local'
  if (!ALL_ENVS.includes(resolvedEnv)) {
    push('error', 'VITE_HULA_ENV', `must be one of ${ALL_ENVS.join(', ')}`)
  }

  const homeserver = bag.VITE_HOMESERVER_URL
  if (!homeserver) {
    push('error', 'VITE_HOMESERVER_URL', 'required')
  } else if (!isStrictHttps(homeserver) && !isLocalHttp(homeserver)) {
    push('error', 'VITE_HOMESERVER_URL', `must be https:// or http://localhost (got: ${homeserver})`)
  } else if (!isStrictHttps(homeserver) && isLocalHttp(homeserver) && resolvedEnv !== 'dev-local') {
    push('error', 'VITE_HOMESERVER_URL', `http:// is only allowed when VITE_HULA_ENV=dev-local`)
  }

  if (!bag.VITE_APP_NAME) push('error', 'VITE_APP_NAME', 'required')

  const sdkMode = bag.VITE_MATRIX_SDK_MODE ?? 'next'
  if (!SDK_MODES.includes(sdkMode)) {
    push('error', 'VITE_MATRIX_SDK_MODE', `must be one of ${SDK_MODES.join(', ')}`)
  }
  if (resolvedEnv === 'prod' && sdkMode !== 'next') {
    push('error', 'VITE_MATRIX_SDK_MODE', `prod releases must run in 'next' mode (got '${sdkMode}')`)
  }

  const strictEnvs = ['qa', 'preprod', 'prod']
  if (strictEnvs.includes(resolvedEnv)) {
    if (!bag.VITE_MATRIX_SDK_COMMIT) {
      push('error', 'VITE_MATRIX_SDK_COMMIT', `required when VITE_HULA_ENV=${resolvedEnv}`)
    }
    if (!bag.VITE_TELEMETRY_DSN) {
      push(
        resolvedEnv === 'prod' ? 'error' : 'warn',
        'VITE_TELEMETRY_DSN',
        `telemetry DSN recommended for ${resolvedEnv}, required for prod`,
      )
    }
  }

  if (bag.VITE_TELEMETRY_SAMPLE_RATE !== undefined && bag.VITE_TELEMETRY_SAMPLE_RATE !== '') {
    const n = Number(bag.VITE_TELEMETRY_SAMPLE_RATE)
    if (!Number.isFinite(n) || n < 0 || n > 1) {
      push(
        'error',
        'VITE_TELEMETRY_SAMPLE_RATE',
        `must be a number in [0, 1] (got '${bag.VITE_TELEMETRY_SAMPLE_RATE}')`,
      )
    }
  }

  const flagKeys = [
    'VITE_FF_VOIP',
    'VITE_FF_E2EE_BACKUP',
    'VITE_FF_ADMIN_CONSOLE',
    'VITE_FF_AI_OPENCLAW',
  ]
  for (const key of flagKeys) {
    const v = bag[key]
    if (v !== undefined && v !== '' && v !== 'on' && v !== 'off') {
      push('error', key, `must be 'on' or 'off' (got '${v}')`)
    }
  }

  const budget = bag.VITE_PERF_BUDGET_PROFILE
  if (budget !== undefined && budget !== '' && budget !== 'desktop' && budget !== 'mobile') {
    push('error', 'VITE_PERF_BUDGET_PROFILE', `must be 'desktop' or 'mobile' (got '${budget}')`)
  }

  return {
    issues,
    ok: issues.every((i) => i.severity !== 'error'),
    resolvedEnv,
  }
}

/**
 * @param {EnvValidationResult} result
 * @returns {string}
 */
export function formatIssues(result) {
  if (result.issues.length === 0) {
    return `validateEnv: all checks passed for VITE_HULA_ENV=${result.resolvedEnv}`
  }
  const lines = result.issues.map((i) => `  [${i.severity}] ${i.key}: ${i.message}`).join('\n')
  return `validateEnv: ${result.issues.length} issue(s) for VITE_HULA_ENV=${result.resolvedEnv}\n${lines}`
}
