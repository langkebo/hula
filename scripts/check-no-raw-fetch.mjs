import { execSync } from 'node:child_process';

const ALLOWLIST = new Set([
  'src/services/matrix/network/runtimeFetch.ts',   // the fetch wrapper itself
  'src/workers/workerProbeHandlers.ts',             // worker pre-login server diagnostics (versions/loginFlows/CORS/capabilities) — runs before SDK client exists
  'src/App.vue',                                     // apple.com favicon reachability check (no-cors)
  'src/strategy/strategies/video.ts',                // blob: URL requires browser-native fetch
  'src/views/openclaw/OpenClawView.vue',             // OpenClawService doesn't exist yet — needs new service
  'src/composables/user/useAvatarUpload.ts',          // gallery avatar is a webview-local static asset (/avatar/*.webp), not a network request
]);

const output = execSync(
  `grep -rln '\\bfetch(' src/ --include='*.ts' --include='*.tsx' --include='*.vue'`,
  { encoding: 'utf-8' }
);

const files = output.trim().split('\n').filter(Boolean);
const nonTestFiles = files.filter((f) => !f.includes('__tests__'));
const violations = nonTestFiles.filter((f) => !ALLOWLIST.has(f));

if (violations.length > 0) {
  console.error(`ERROR: ${violations.length} file(s) use raw fetch() outside the allowlist:`);
  violations.forEach((f) => console.error(`  ${f}`));
  console.error('Use HttpClient from @/utils/HttpClient, an SDK manager method, or add to the allowlist with justification.');
  process.exit(1);
}

console.log(`OK: ${nonTestFiles.length} file(s) with fetch() — all in allowlist`);
