import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Proxy /api to the Express server so the browser sees a single origin.
    proxy: {
      "/api": { target: "http://localhost:4000", changeOrigin: true },
    },
  },
});
