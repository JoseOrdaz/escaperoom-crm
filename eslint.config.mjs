import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],

    // ✅ Aquí añadimos las reglas personalizadas
    rules: {
      "@typescript-eslint/no-explicit-any": "off", // 🔧 Desactiva los errores de "any"
      "@typescript-eslint/no-unused-vars": "warn", // Solo aviso si defines variables no usadas
      "react-hooks/exhaustive-deps": "warn",       // Solo aviso, no bloquea el build
      "prefer-const": "warn",                      // Sugerencia, no error
      "@next/next/no-img-element": "off",          // Permite usar <img> sin romper build
    },
  },
];

export default eslintConfig;
