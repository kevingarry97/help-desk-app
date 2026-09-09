import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config.ts";

// Extends the app's own Vite config so tests resolve "@/..." and the `core` workspace
// package exactly the way the bundler does.
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: ["./src/test/setup.ts"],
      include: ["src/**/*.test.{ts,tsx}"],
    },
  }),
);
