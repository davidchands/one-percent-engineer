import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    // The browser talks to one origin; Vite forwards /api to the Node server.
    proxy: { "/api": "http://127.0.0.1:4100" },
  },
});
