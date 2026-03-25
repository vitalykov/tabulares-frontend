import { defineConfig } from "vite";

export default defineConfig({
  server: {
    proxy: {
      // Forward all /game/* requests from Vite dev server to the Go backend.
      "/game": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
});

