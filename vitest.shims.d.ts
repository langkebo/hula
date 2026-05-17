/// <reference types="@vitest/browser-playwright" />

declare module '@storybook/addon-vitest/vitest-plugin' {
  export function storybookTest(options: { configDir: string }): unknown
}
