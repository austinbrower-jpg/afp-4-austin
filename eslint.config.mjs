import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Electron main/preload processes are intentionally plain CommonJS
    // Node scripts outside the Next.js/React app - not subject to the
    // TS/React lint rules meant for src/**.
    "electron/**",
  ]),
]);

export default eslintConfig;
