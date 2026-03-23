#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const templates = {
  service: `import { info, error } from '@tauri-apps/plugin-log'
import { Result, ok, err } from '@/utils/Result'

export class {{name}} {
  async initialize(): Promise<Result<boolean>> {
    try {
      info('[{{name}}] Initializing...')
      // Implementation
      return ok(true)
    } catch (e) {
      error(\`[{{name}}] Failed to initialize: \${e}\`)
      return err(e as Error)
    }
  }
}

export const {{camelName}} = new {{name}}()
export default {{camelName}}
`,
  component: `<script setup lang="ts">
import { ref } from 'vue'

defineProps<{
  title: string
}>()

const emit = defineEmits<{
  (e: 'click', id: string): void
}>()
</script>

<template>
  <div class="{{kebabName}}" @click="emit('click', title)">
    {{ title }}
  </div>
</template>

<style scoped lang="scss">
.{{kebabName}} {
  @apply p-4 rounded-lg bg-white dark:bg-gray-800 shadow;
}
</style>
`,
  store: `import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const use{{name}}Store = defineStore('{{camelName}}', () => {
  const data = ref<any[]>([])
  
  const count = computed(() => data.value.length)
  
  function add(item: any) {
    data.value.push(item)
  }

  return { data, count, add }
})
`
};

function toCamelCase(str) {
  return str.replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
    return index === 0 ? word.toLowerCase() : word.toUpperCase();
  }).replace(/\s+/g, '');
}

function toKebabCase(str) {
  return str.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
}

console.log('🚀 Welcome to @hula/refactor Scaffolding Tool!');

rl.question('What do you want to generate? (service/component/store): ', (type) => {
  if (!['service', 'component', 'store'].includes(type)) {
    console.error('❌ Invalid type. Please choose service, component, or store.');
    process.exit(1);
  }

  rl.question('Enter the name (e.g., MatrixUserService / UserCard / UserSession): ', (name) => {
    if (!name) {
      console.error('❌ Name cannot be empty.');
      process.exit(1);
    }

    const camelName = toCamelCase(name);
    const kebabName = toKebabCase(name);
    let targetDir = '';
    let ext = '.ts';

    if (type === 'service') {
      targetDir = 'src/services';
    } else if (type === 'component') {
      targetDir = 'src/components';
      ext = '.vue';
    } else if (type === 'store') {
      targetDir = 'src/stores';
    }

    const fullPath = path.join(process.cwd(), targetDir, \`\${name}\${ext}\`);
    
    if (fs.existsSync(fullPath)) {
      console.error(\`❌ File \${fullPath} already exists!\`);
      process.exit(1);
    }

    let content = templates[type]
      .replace(/{{name}}/g, name)
      .replace(/{{camelName}}/g, camelName)
      .replace(/{{kebabName}}/g, kebabName);

    fs.mkdirSync(path.join(process.cwd(), targetDir), { recursive: true });
    fs.writeFileSync(fullPath, content, 'utf-8');

    console.log(\`✅ Successfully created \${type} at: \${fullPath}\`);
    
    // Create corresponding test file
    if (type === 'service' || type === 'store') {
      const testPath = path.join(process.cwd(), targetDir, \`\${name}.test.ts\`);
      const testContent = \`import { describe, it, expect } from 'vitest'
import { \${type === 'store' ? 'use' + name + 'Store' : camelName} } from './\${name}'

describe('\${name}', () => {
  it('should be defined', () => {
    expect(\${type === 'store' ? 'use' + name + 'Store' : camelName}).toBeDefined()
  })
})
\`;
      fs.writeFileSync(testPath, testContent, 'utf-8');
      console.log(\`✅ Successfully created test file at: \${testPath}\`);
    }

    process.exit(0);
  });
});
