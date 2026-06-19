import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:4100",
        changeOrigin: true
      },
      "/health": {
        target: "http://127.0.0.1:4100",
        changeOrigin: true
      },
      "/ready": {
        target: "http://127.0.0.1:4100",
        changeOrigin: true
      }
    }
  }
});
