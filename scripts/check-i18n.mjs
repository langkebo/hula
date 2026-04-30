import fs from 'node:fs'
import path from 'node:path'

const localesDir = path.resolve(process.cwd(), 'locales')
const baseLocale = 'zh-CN'
const otherLocales = fs.readdirSync(localesDir).filter(l => l !== baseLocale && !l.startsWith('.'))

function getKeys(obj: any, prefix = ''): string[] {
  let keys: string[] = []
  for (const key in obj) {
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      keys = keys.concat(getKeys(obj[key], `${prefix}${key}.`))
    } else {
      keys.push(`${prefix}${key}`)
    }
  }
  return keys
}

function check() {
  console.log(`Checking i18n completeness (Base: ${baseLocale})...`)
  let hasError = false

  const baseFiles = fs.readdirSync(path.join(localesDir, baseLocale)).filter(f => f.endsWith('.json'))

  for (const locale of otherLocales) {
    console.log(`\nComparing ${locale} with ${baseLocale}:`)
    const otherFiles = fs.readdirSync(path.join(localesDir, locale)).filter(f => f.endsWith('.json'))

    // Check for missing files
    const missingFiles = baseFiles.filter(f => !otherFiles.includes(f))
    if (missingFiles.length > 0) {
      console.error(`  [Error] Missing files in ${locale}: ${missingFiles.join(', ')}`)
      hasError = true
    }

    for (const file of baseFiles) {
      if (!otherFiles.includes(file)) continue

      const baseContent = JSON.parse(fs.readFileSync(path.join(localesDir, baseLocale, file), 'utf-8'))
      const otherContent = JSON.parse(fs.readFileSync(path.join(localesDir, locale, file), 'utf-8'))

      const baseKeys = getKeys(baseContent)
      const otherKeys = getKeys(otherContent)

      const missingKeys = baseKeys.filter(k => !otherKeys.includes(k))
      const extraKeys = otherKeys.filter(k => !baseKeys.includes(k))

      if (missingKeys.length > 0) {
        console.error(`  [Error] ${file}: Missing keys in ${locale}:`)
        missingKeys.forEach(k => console.error(`    - ${k}`))
        hasError = true
      }

      if (extraKeys.length > 0) {
        console.warn(`  [Warn] ${file}: Extra keys in ${locale} (not in ${baseLocale}):`)
        extraKeys.forEach(k => console.warn(`    - ${k}`))
      }
    }
  }

  if (hasError) {
    console.log('\ni18n check failed.')
    process.exit(1)
  } else {
    console.log('\ni18n check passed!')
  }
}

check()
