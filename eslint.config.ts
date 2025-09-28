import { defineConfig } from "eslint/config";
import raycastConfig from "@raycast/eslint-config";

export default defineConfig([
  ...raycastConfig,
  {
    // Override for Node.js utility files that need require() for compatibility
    files: ["*.js", "init-*.js", "test-*.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
]);
