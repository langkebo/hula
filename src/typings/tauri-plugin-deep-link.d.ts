declare module '@tauri-apps/plugin-deep-link' {
  export type DeepLinkHandler = (urls: string[]) => void

  export function onOpenUrl(handler: DeepLinkHandler): Promise<() => void>
}
