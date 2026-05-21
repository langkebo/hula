import crypto from 'node:crypto'
import type { Plugin, ResolvedConfig } from 'vite'

function generateNonce(): string {
  return crypto.randomBytes(24).toString('base64')
}

export function cspNoncePlugin(): Plugin {
  let config: ResolvedConfig
  let nonce: string

  return {
    name: 'vite-plugin-csp-nonce',
    enforce: 'post',

    configResolved(resolvedConfig) {
      config = resolvedConfig
      nonce = generateNonce()
    },

    transformIndexHtml: {
      order: 'post',
      handler(html: string) {
        if (config.command === 'serve') {
          return html
        }

        let result = html

        result = result.replace(/<style([^>]*)>/g, (match, attrs: string) => {
          if (attrs.includes('nonce=')) return match
          return `<style${attrs} nonce="${nonce}">`
        })

        result = result.replace(/<script([^>]*)>/g, (match, attrs: string) => {
          if (attrs.includes('nonce=')) return match
          return `<script${attrs} nonce="${nonce}">`
        })

        result = result.replace(
          /<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]*)"/,
          (_match, cspContent: string) => {
            let updated = cspContent

            updated = updated.replace(/script-src\s+([^;]+)/, (_directive: string, values: string) => {
              let scriptSrc = values
                .replace(/'unsafe-inline'/g, `'nonce-${nonce}'`)
                .replace(/'unsafe-eval'/g, '')
                .replace(/\s+/g, ' ')
                .trim()
              if (!scriptSrc.includes(`'nonce-${nonce}'`)) {
                scriptSrc = `'nonce-${nonce}' ${scriptSrc}`
              }
              return `script-src ${scriptSrc}`
            })

            updated = updated.replace(/style-src\s+([^;]+)/, (_directive: string, values: string) => {
              let styleSrc = values.replace(/'unsafe-inline'/g, `'nonce-${nonce}'`).trim()
              if (!styleSrc.includes(`'nonce-${nonce}'`)) {
                styleSrc = `'nonce-${nonce}' ${styleSrc}`
              }
              return `style-src ${styleSrc}`
            })

            updated = updated.replace(/connect-src\s+([^;]+)/, (_directive: string, values: string) => {
              const connectSrc = values
                .replace(/https:\/\/localhost:\*/g, '')
                .replace(/http:\/\/localhost:\*/g, '')
                .replace(/https:\/\/127\.0\.0\.1:\*/g, '')
                .replace(/http:\/\/127\.0\.0\.1:\*/g, '')
                .replace(/\s+/g, ' ')
                .trim()
              return `connect-src ${connectSrc}`
            })

            updated = updated.replace(/img-src\s+([^;]+)/, (_directive: string, values: string) => {
              const imgSrc = values.replace(/http:/g, '').replace(/\s+/g, ' ').trim()
              return `img-src ${imgSrc}`
            })

            return `<meta http-equiv="Content-Security-Policy" content="${updated}"`
          }
        )

        const nonceBootstrap = `<script nonce="${nonce}">window.__VUE_NONCE__="${nonce}";(function(){var _ce=document.createElement.bind(document);document.createElement=function(t,o){var e=_ce(t,o);if(t==='style'||t==='script'){e.nonce=window.__VUE_NONCE__}return e}})()</script>`
        result = result.replace('</head>', `${nonceBootstrap}</head>`)

        return result
      }
    }
  }
}
