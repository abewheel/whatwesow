import js from "@eslint/js";
import tseslint from "typescript-eslint";
export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "test-results/**",
      "playwright-report/**",
      // Self-contained prototype with its own tests; the game imports it as data.
      "crisis-layer/**",
    ],
  },
  ...["micro", "macro"].map((domain) => ({
    files: [`src/${domain}/**/*.ts`],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                `**/${domain === "micro" ? "macro" : "micro"}/**`,
                "**/game/**",
                "**/storage/**",
                "**/dev/**",
                "phaser",
              ],
              message:
                "Domain rules stay independent. Coordinate through src/game.",
            },
          ],
        },
      ],
    },
  })),
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.mjs"],
    languageOptions: { globals: { process: "readonly", console: "readonly" } },
  },
);
