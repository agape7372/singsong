import { defineConfig } from "eslint/config";
import expoConfig from "eslint-config-expo/flat.js";

export default defineConfig([
  expoConfig,
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      // Reanimated SharedValue writes are its public API, not React state mutation.
      "react-hooks/immutability": "off",
      // Keep ticket text deterministic across Hermes, Node, and browser ICU builds.
      "no-restricted-syntax": [
        "error",
        {
          selector: "MemberExpression[object.name='Intl']",
          message: "Intl 대신 @singsong/domain의 순수 포맷터를 사용하세요.",
        },
        {
          selector:
            "CallExpression[callee.property.name=/^toLocale(String|DateString|TimeString)$/]",
          message: "toLocale* 대신 KST 고정 순수 포맷터를 사용하세요.",
        },
        {
          selector: "CallExpression[callee.property.name=/^toLocale(LowerCase|UpperCase)$/]",
          message: "로케일 casing 대신 toLowerCase()/toUpperCase()를 사용하세요.",
        },
        {
          selector: "CallExpression[callee.property.name='localeCompare']",
          message: "localeCompare 대신 결정적인 코드유닛 비교를 사용하세요.",
        },
      ],
    },
  },
  {
    ignores: ["dist/**"],
  },
]);
