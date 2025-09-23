import { beforeAll } from 'vitest'

beforeAll(async () => {
  if (!globalThis.crypto || !globalThis.crypto.subtle) {
    const { webcrypto } = await import('node:crypto')
    Object.assign(globalThis, { crypto: webcrypto })
  }

  if (!globalThis.navigator) {
    Object.assign(globalThis, {
      navigator: {
        clipboard: {
          writeText: async () => Promise.resolve(),
        },
      },
    })
  }
})
