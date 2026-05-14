#!/usr/bin/env node
/**
 * verify-env — CLI wrapper around build/validateEnv.mjs.
 *
 * Called from `pnpm verify:env` and from pre-build CI jobs. Loads the
 * dotenv chain exactly like Vite does (.env, .env.<mode>, .env.local,
 * .env.<mode>.local) and runs the shared validator. Spec: plan §16.3.2.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { formatIssues, validateEnv } from '../build/validateEnv.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function parseDotenv(body) {
  const out = {}
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq < 0) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
      value = value.slice(1, -1)
    } else if (value.startsWith("'") && value.endsWith("'") && value.length >= 2) {
      value = value.slice(1, -1)
    }
    out[key] = value
  }
  return out
}

function loadEnvChain(mode) {
  const files = ['.env', `.env.${mode}`, '.env.local', `.env.${mode}.local`]
  const merged = {}
  for (const f of files) {
    const p = path.join(repoRoot, f)
    if (fs.existsSync(p)) {
      Object.assign(merged, parseDotenv(fs.readFileSync(p, 'utf8')))
    }
  }
  for (const key of Object.keys(process.env)) {
    if (key.startsWith('VITE_')) merged[key] = process.env[key]
  }
  return merged
}

function main() {
  const mode = process.env.NODE_ENV || process.env.VITE_HULA_ENV || 'development'
  const bag = loadEnvChain(mode)
  const hulaEnv = bag.VITE_HULA_ENV || 'dev-local'
  const result = validateEnv(bag)
  const formatted = formatIssues(result)
  if (!result.ok) {
    process.stderr.write(`${formatted}\n`)
    process.exit(1)
  }
  process.stdout.write(`${formatted} (env=${hulaEnv})\n`)
}

main()
