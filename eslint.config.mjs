import nextVitals from "eslint-config-next/core-web-vitals.js";
import nextTs from "eslint-config-next/typescript.js";

const config = [
  { ignores: [".next/**", "node_modules/**", "supabase/functions/**", "next-env.d.ts"] },
  ...nextVitals,
  ...nextTs,
  { rules: { "react-hooks/set-state-in-effect": "off", "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }] } },
];

export default config;
