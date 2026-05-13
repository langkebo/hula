// Runtime-only SDK sub-path imports without compiled type declarations
declare module 'matrix-js-sdk/src/profile/index' {
  export function extendMatrixClient(): void
  declare const defaultExport: typeof extendMatrixClient
  export default defaultExport
}
