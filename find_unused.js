import fs from 'fs'
import { execSync } from 'child_process'

const fileContent = fs.readFileSync('src/utils/ImRequestUtils.ts', 'utf-8')
const exportRegex = /export\s+(?:async\s+)?function\s+(\w+)/g
let match
const functions = []

while ((match = exportRegex.exec(fileContent)) !== null) {
  functions.push(match[1])
}

const unusedFunctions = []

for (const fn of functions) {
  try {
    // Match ImRequestUtils.fn or fn( or fn (
    const cmd = `grep -rnE "(ImRequestUtils\\\\.${fn}\\\\b|\\\\b${fn}\\\\s*\\\\()" src/ | grep -v "src/utils/ImRequestUtils.ts"`
    const _res = execSync(cmd, { encoding: 'utf-8' })
  } catch (_e) {
    unusedFunctions.push(fn)
  }
}
