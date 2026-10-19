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
       * لا نوافذ المتصفح الأصلية (alert/confirm/prompt): التأكيد والإدخال
       * عبر useConfirm()/usePrompt() من DialogProvider، والرسائل عبر toast.
       */
      "no-alert": "error",

      /*
       * جديدة في eslint-config-next 16.3. كل استخداماتنا لـ window.location.href
       * هي انتقال كامل مقصود عند حدود المصادقة (انتهاء الجلسة/الخروج ← /login،
       * وتأكيد البريد ← /dashboard بعد ضبط الكوكي): يمسح حالة وكاش العميل
       * للجلسة السابقة ويجعل الخادم يقرأ الكوكي الجديد. router.push يبقي تلك
       * الحالة، فلا يُستبدل بها.
       */
      "@next/next/no-location-assign-relative-destination": "off",

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
