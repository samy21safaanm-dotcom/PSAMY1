import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      "/upload": "http://localhost:4000",
      "/files": "http://localhost:4000",
      "/extract": "http://localhost:4000",
      "/translate": "http://localhost:4000",
      "/generate-lesson": "http://localhost:4000",
    },
  },
});
