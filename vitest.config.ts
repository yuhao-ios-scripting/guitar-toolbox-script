import { defineConfig } from "vitest/config"

export default defineConfig({
  oxc: { jsx: { runtime: "classic", pragma: "h", pragmaFrag: "Fragment" } },
  resolve: { alias: { scripting: new URL("./tests/scripting-stub.ts", import.meta.url).pathname } },
  test: { include: ["tests/**/*.test.ts"], setupFiles: ["tests/setup.ts"] },
})
