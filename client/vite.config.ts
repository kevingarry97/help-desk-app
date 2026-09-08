import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

// Read from process.env rather than import.meta.env: .env files are loaded into the client
// bundle, not into the config's own process. The E2E harness sets this to the test server
// (4001) so the suite can run while `bun run dev` still holds 4000/5173.
const apiTarget = process.env.VITE_API_URL ?? "http://localhost:4000";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 5173,
    // Proxy /api to the Express server so the browser sees a single origin.
    proxy: {
      "/api": { target: apiTarget, changeOrigin: true },
    },
  },
});
