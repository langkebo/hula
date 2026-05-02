import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

/**
 * CI Script to check for unauthorized v-html usage.
 * Should be run in the CI pipeline to prevent XSS vulnerabilities.
 */

const ALLOWED_V_HTML_FILES = [
  // List files here if they have a valid reason to use v-html and are audited.
  // Example: 'src/components/AuditedComponent.vue'
];

function checkVHtml() {
  console.log('--- Checking for unauthorized v-html usage ---');
  
  try {
    // Search for v-html in .vue files
    const output = execSync('grep -r "v-html" src --include="*.vue" || true').toString();
    
    const lines = output.split('\n').filter(line => line.trim() !== '');
    const unauthorized = [];

    for (const line of lines) {
      const filePath = line.split(':')[0];
      if (!ALLOWED_V_HTML_FILES.some(allowed => filePath.includes(allowed))) {
        unauthorized.push(line);
      }
    }

    if (unauthorized.length > 0) {
      console.error('\x1b[31mError: Found unauthorized v-html usage:\x1b[0m');
      unauthorized.forEach(line => console.error(`  ${line}`));
      console.error('\n\x1b[33mPlease use v-safe-html directive instead or add the file to ALLOWED_V_HTML_FILES in scripts/check-v-html.mjs if it is audited.\x1b[0m');
      process.exit(1);
    } else {
      console.log('\x1b[32mSuccess: No unauthorized v-html usage found.\x1b[0m');
    }
  } catch (e) {
    console.error('Failed to run check:', e.message);
    process.exit(1);
  }
}

checkVHtml();
