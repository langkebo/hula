import { execSync } from 'child_process';
try {
  const fn = 'deleteFriend';
  const cmd = `grep -rnE "(ImRequestUtils\\\\.${fn}\\\\b|\\\\b${fn}\\\\s*\\\\()" src/ | grep -v "src/utils/ImRequestUtils.ts"`;
  const res = execSync(cmd, { encoding: 'utf-8' });
  console.log('Success!', res);
} catch (e) {
  console.log('Failed!', e.status, e.message);
}
