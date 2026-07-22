import { execSync } from 'node:child_process';

const ALLOWLIST = new Set([
  'src/services/matrix/network/runtimeFetch.ts',   // the fetch wrapper itself
  'src/workers/matrixSdk.worker.ts',                // worker bridge needs raw fetch for SDK proxying
  'src/App.vue',                                     // apple.com favicon reachability check (no-cors)
  'src/strategy/strategies/video.ts',                // blob: URL requires browser-native fetch
  'src/services/matrix/auth/MatrixOidcService.ts',   // discoverOidc() at line 62 (not in scope of Task 2 migration)
  'src/services/siliconflow/SiliconFlowService.ts',  // pre-existing ping/sendChatCompletion (not in scope of Task 6)
  'src/views/openclaw/OpenClawView.vue',             // OpenClawService doesn't exist (noted in Task 6)
  'src/services/trendradar/TrendRadarService.ts',    // was never in the migration plan
  'src/services/matrix/room/RoomCapabilitiesService.ts', // was never in the migration plan
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
