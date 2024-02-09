import js from "@eslint/js";
import typescriptPlugin from "@typescript-eslint/eslint-plugin";
import typescriptParser from "@typescript-eslint/parser";
import unicorn from "eslint-plugin-unicorn";

export default [
  js.configs.recommended,
  typescriptPlugin.configs["eslint-recommended"].overrides[0],
  unicorn.configs["flat/recommended"],
  {
    languageOptions: {
      parser: typescriptParser,
    },
    plugins: {
      "@typescript-eslint": typescriptPlugin,
    },
    rules: typescriptPlugin.configs.strict.rules,
  },
  {
    files: ["src/**.ts"],
    rules: {
      "unicorn/prevent-abbreviations": 0,
      "eqeqeq": 2,
    },
  },
];
