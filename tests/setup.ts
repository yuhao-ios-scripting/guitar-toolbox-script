// index.tsx 直接使用的全域 API（正式環境由 Scripting 提供）
const store = new Map<string, unknown>()
Object.assign(globalThis, {
  h: () => null, Fragment: null,
  Storage: { get: (k: string) => store.get(k) ?? null, set: (k: string, v: unknown) => { store.set(k, v) } },
})
