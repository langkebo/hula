import fs from 'fs';
import { execSync } from 'child_process';
import { Project } from 'ts-morph';

const project = new Project();
project.addSourceFilesAtPaths("src/utils/ImRequestUtils.ts");
const sourceFile = project.getSourceFileOrThrow("src/utils/ImRequestUtils.ts");

const exportedFunctions = Array.from(sourceFile.getExportedDeclarations().keys());

const allFiles = execSync('find src -type f \\( -name "*.ts" -o -name "*.vue" \\) -not -path "src/utils/ImRequestUtils.ts"', { encoding: 'utf-8' }).trim().split('\n');

const usedFunctions = new Set();

for (const file of allFiles) {
  if (!file) continue;
  const content = fs.readFileSync(file, 'utf-8');
  
  for (const fn of exportedFunctions) {
    const regex1 = new RegExp(`import\\s+{[^}]*\\b${fn}\\b[^}]*}\\s+from`, 'g');
    const regex2 = new RegExp(`(?:ImRequestUtils|imRequestUtils|utils)\\.${fn}\\b`, 'g');
    
    if (regex1.test(content) || regex2.test(content)) {
      usedFunctions.add(fn);
    }
  }
}

const unusedFunctions = [];
for (const fn of exportedFunctions) {
  if (fn === 'imRequest' || fn === 'imRequestSilent' || fn === 'imRequestWithRetry' || fn === 'StreamCallbacks') continue;
  if (!usedFunctions.has(fn)) {
    unusedFunctions.push(fn);
  }
}

console.log('Unused functions: ' + unusedFunctions.length);
console.log(unusedFunctions.join('\n'));

for (const fn of unusedFunctions) {
  const func = sourceFile.getFunction(fn);
  if (func) {
    func.remove();
  } else {
    const varDecl = sourceFile.getVariableDeclaration(fn);
    if (varDecl) {
        varDecl.getVariableStatement().remove();
    } else {
      const typeAlias = sourceFile.getTypeAlias(fn);
      if (typeAlias) typeAlias.remove();
      const intf = sourceFile.getInterface(fn);
      if (intf) intf.remove();
    }
  }
}

sourceFile.saveSync();
console.log('Removed from ImRequestUtils.ts');
