import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
// @ts-expect-error -- plain ESM guard script, intentionally without type declarations
import { findUnauthorizedVHtml, findVHtmlUsages } from '../../scripts/check-v-html.mjs'

describe('check-v-html: comment awareness', () => {
  it('ignores a single-line HTML comment mentioning v-html', () => {
    const source = [
      '<template>',
      '  <!-- F-10 fix: replaced v-html injection with an inline SVG component -->',
      '  <InlineIcon name="theme" />',
      '</template>'
    ].join('\n')

    expect(findVHtmlUsages(source)).toEqual([])
  })

  it('ignores a multi-line comment that contains a full v-html binding', () => {
    const source = [
      '<template>',
      '  <!--',
      '    removed: <div v-html="unsafeSvg" />',
      '    reason: XSS risk',
      '  -->',
      '  <div class="safe" />',
      '</template>'
    ].join('\n')

    expect(findVHtmlUsages(source)).toEqual([])
  })

  it('reports a real directive with the original line number', () => {
    const source = [
      '<template>',
      '  <!--',
      '    a comment block',
      '  -->',
      '  <div v-html="payload" />',
      '</template>'
    ].join('\n')

    expect(findVHtmlUsages(source)).toEqual([{ line: 5, text: '<div v-html="payload" />' }])
  })

  it('reports only the real usage when a file has both comment and directive', () => {
    const source = [
      '<template>',
      '  <!-- do not use v-html="x" here -->',
      '  <div v-html="payload" />',
      '</template>'
    ].join('\n')

    const usages = findVHtmlUsages(source)

    expect(usages).toHaveLength(1)
    expect(usages[0].line).toBe(3)
  })

  it('ignores v-html inside script string literals', () => {
    const source = [
      '<script setup lang="ts">',
      'const doc = \'use v-html="x" to render html\'',
      'const directive = `v-html=`',
      '</script>',
      '<template>',
      '  <div class="safe" />',
      '</template>'
    ].join('\n')

    expect(findVHtmlUsages(source)).toEqual([])
  })

  it('does not flag v-safe-html', () => {
    const source = ['<template>', '  <div v-safe-html="payload" />', '</template>'].join('\n')

    expect(findVHtmlUsages(source)).toEqual([])
  })
})

describe('check-v-html: repository guard', () => {
  it('reports no unauthorized v-html usage in src', () => {
    expect(findUnauthorizedVHtml()).toEqual([])
  })
})

describe('check-v-html: ALLOWED_V_HTML_FILES', () => {
  it('skips audited files and still reports the others', () => {
    const dir = mkdtempSync(join(process.cwd(), 'tests/lint/.tmp-v-html-'))
    try {
      mkdirSync(join(dir, 'nested'))
      writeFileSync(join(dir, 'Audited.vue'), '<template><div v-html="audited" /></template>')
      writeFileSync(join(dir, 'nested', 'Unsafe.vue'), '<template><div v-html="unsafe" /></template>')

      expect(findUnauthorizedVHtml(dir, ['Audited.vue'])).toEqual([
        {
          file: expect.stringContaining('nested/Unsafe.vue'),
          line: 1,
          text: '<template><div v-html="unsafe" /></template>'
        }
      ])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
