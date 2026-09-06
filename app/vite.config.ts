import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Browser calls same-origin /rpc → avoids CORS; Vite forwards to the
// pending→pre_confirmed proxy (or Devnet directly if proxy is down).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/rpc": {
        target: process.env.VITE_RPC_PROXY || "http://127.0.0.1:5051",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/rpc/, "") || "/",
      },
      "/is_alive": {
        target: process.env.VITE_RPC_PROXY || "http://127.0.0.1:5051",
        changeOrigin: true,
      },
    },
  },
});
