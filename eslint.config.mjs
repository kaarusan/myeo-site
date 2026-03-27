import js from "@eslint/js";
import security from "eslint-plugin-security";
import globals from "globals";
import tsParser from "@typescript-eslint/parser";

export default [
  { ignores: ["node_modules/**", ".next/**", "public/**"] },
  {
    files: ["Cursor/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: { ...globals.browser },
    },
  },
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.node },
    },
  },
  {
    files: ["middleware.ts"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parser: tsParser,
      parserOptions: { ecmaVersion: "latest" },
      globals: { ...globals.node },
    },
  },
  js.configs.recommended,
  security.configs.recommended,
  {
    rules: {
      "no-console": ["warn", { allow: ["info", "warn", "error"] }],
      "security/detect-object-injection": "off",
    },
  },
  {
    files: ["scripts/**/*.mjs"],
    rules: {
      "no-console": "off",
      "security/detect-non-literal-fs-filename": "off",
    },
  },
];
