import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

/**
 * eslint-config-next 16 ships flat configs directly, so there is no FlatCompat
 * shim here — passing these through `@eslint/eslintrc` throws on a circular
 * plugin reference.
 */
const eslintConfig = [
  ...coreWebVitals,
  ...typescript,
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "ml/**",
      "data/**",
      "public/**",
      "lib/spacetime/module_bindings/**",
      "spacetimedb/dist/**",
      "spacetimedb/node_modules/**",
    ],
  },
];

export default eslintConfig;
