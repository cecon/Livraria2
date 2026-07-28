import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react(), tailwindcss()],

  resolve: {
    // UI compartilhada (ADR-0020): `@/components/ui/*` e `@/lib/utils` resolvem
    // para packages/ui (fonte única); o resto de `@` segue em ./src.
    alias: [
      { find: /^@livraria\/ui\/nav$/, replacement: path.resolve(__dirname, "packages/ui/src/nav") },
      { find: /^@\/lib\/utils$/, replacement: path.resolve(__dirname, "packages/ui/src/utils") },
      { find: /^@\/components\/ui\//, replacement: path.resolve(__dirname, "packages/ui/src/ui") + "/" },
      { find: /^@\//, replacement: path.resolve(__dirname, "src") + "/" },
    ],
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
