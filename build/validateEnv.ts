/**
 * Type-safe re-export over build/validateEnv.mjs so Vite plugins and tsc
 * consumers get proper types. The canonical logic lives in the .mjs file
 * so plain Node scripts can import it without a TS loader. Spec: plan §16.3.2.
 */

// @ts-expect-error — .mjs sibling, no declaration file
import * as impl from './validateEnv.mjs'

export type HulaEnv = 'dev-local' | 'dev-shared' | 'qa' | 'preprod' | 'prod'
export type SdkMode = 'legacy' | 'hybrid' | 'next'

export interface EnvValidationIssue {
  severity: 'error' | 'warn'
  key: string
  message: string
}

export interface EnvValidationResult {
  issues: EnvValidationIssue[]
  ok: boolean
  resolvedEnv: HulaEnv
}

export const validateEnv: (bag: Record<string, string | undefined>) => EnvValidationResult = impl.validateEnv

export const formatIssues: (result: EnvValidationResult) => string = impl.formatIssues
