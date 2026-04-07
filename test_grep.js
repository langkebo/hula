import { execSync } from 'child_process'
try {
  const fn = 'deleteFriend'
  const cmd = `grep -rnE "(ImRequestUtils\\\\.${fn}\\\\b|\\\\b${fn}\\\\s*\\\\()" src/ | grep -v "src/utils/ImRequestUtils.ts"`
  const _res = execSync(cmd, { encoding: 'utf-8' })
} catch (_e) {}
