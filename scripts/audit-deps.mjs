import { execSync } from 'child_process';

/**
 * CI Script to audit dependencies for vulnerabilities (npm & cargo).
 */

function auditDependencies() {
  console.log('--- Auditing Dependencies ---');
  let hasVulnerabilities = false;

  // 1. Audit npm dependencies
  console.log('\n[1/2] Auditing NPM dependencies...');
  try {
    // We use --audit-level high to block CI on serious vulnerabilities
    execSync('pnpm audit --audit-level high', { stdio: 'inherit' });
    console.log('\x1b[32mNPM Audit Passed.\x1b[0m');
  } catch (e) {
    console.error('\x1b[31mNPM Audit Failed: Found high/critical vulnerabilities.\x1b[0m');
    hasVulnerabilities = true;
  }

  // 2. Audit Cargo dependencies
  console.log('\n[2/2] Auditing Cargo dependencies...');
  try {
    // Check if cargo-audit is installed
    execSync('cargo audit --version', { stdio: 'ignore' });
    execSync('cargo audit', { stdio: 'inherit', cwd: 'src-tauri' });
    console.log('\x1b[32mCargo Audit Passed.\x1b[0m');
  } catch (e) {
    if (e.message && e.message.includes('not found')) {
      console.warn('\x1b[33mWarning: cargo-audit not found. Skipping Cargo audit.\x1b[0m');
      console.warn('Please install it with: cargo install cargo-audit');
    } else {
      console.error('\x1b[31mCargo Audit Failed: Found vulnerabilities in Rust dependencies.\x1b[0m');
      hasVulnerabilities = true;
    }
  }

  if (hasVulnerabilities) {
    console.error('\n\x1b[31mAudit Failed. Please fix the vulnerabilities before merging.\x1b[0m');
    process.exit(1);
  } else {
    console.log('\n\x1b[32mAll dependency audits passed.\x1b[0m');
  }
}

auditDependencies();
