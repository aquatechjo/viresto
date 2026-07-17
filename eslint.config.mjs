import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,

  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "dist/**",
    "coverage/**",
    "public/**",
    "next-env.d.ts",
    "lint-*.txt",
  ]),

  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",

      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],

      "@next/next/no-img-element": "off",

      /*
       * تعطيل مؤقت لقواعد React Compiler
       * لحين ترحيل المكونات القديمة تدريجيًا.
       */
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/static-components": "off",
      "react-hooks/purity": "off",
      "react-hooks/immutability": "off",
      "react-hooks/preserve-manual-memoization": "off",
    },
  },

  /*
   * ملفات JavaScript في المشروع هي سكربتات Node/CommonJS
   * أو اختبارات k6، لذلك require مسموح فيها.
   */
  {
    files: ["**/*.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      "import/no-anonymous-default-export": "off",
    },
  },
]);
