import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";

export default defineConfig({
  test: { exclude: ["tests/e2e/**", "node_modules/**", "dist/**"] },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg"],
      manifest: {
        name: "ServiceSlot",
        short_name: "ServiceSlot",
        description: "Online booking for service businesses",
        theme_color: "#0a0a0a",
        background_color: "#0a0a0a",
        display: "standalone",
        start_url: "/",
        icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" }]
      },
      workbox: {
        navigateFallback: "/index.html",
        runtimeCaching: [{
          urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\//,
          handler: "NetworkOnly"
        }, {
          urlPattern: /^https:\/\/images\.unsplash\.com\//,
          handler: "CacheFirst",
          options: { cacheName: "tenant-images", expiration: { maxEntries: 30, maxAgeSeconds: 604800 } }
        }]
      }
    })
  ],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  server: { port: 5173 }
});
