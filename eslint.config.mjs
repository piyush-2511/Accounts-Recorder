
import { FlatCompat } from "@eslint/eslintrc";
import js from "@eslint/js";

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
  recommendedConfig: js.configs.recommended,
});

const config = [
  ...compat.config({
    extends: ["next/core-web-vitals", "next/typescript"],
  }),

  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "supabase/functions/**",
      "next-env.d.ts",
    ],
  },

  {
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
    },
  },
];

export default config;
