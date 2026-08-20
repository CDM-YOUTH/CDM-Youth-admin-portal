// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  vite: {
    plugins: [
      VitePWA({
        // This app builds the client environment straight to .output/public (Vite's
        // Environment API) — vite-plugin-pwa doesn't detect that on its own and defaults
        // to a stale top-level dist/, so sw.js ends up in the wrong place unless told.
        outDir: ".output/public",
        // SSR app — no index.html for this plugin's html-transform hook to patch.
        // Manifest link + SW registration are wired manually, scoped to /admin only.
        injectRegister: false,
        manifest: {
          id: "/admin/dashboard",
          name: "CDM Youth Office — Admin",
          short_name: "CDM Admin",
          description: "Catholic Diocese of Murang'a Youth Office admin portal.",
          start_url: "/admin/dashboard",
          scope: "/admin/",
          display: "standalone",
          background_color: "#ffffff",
          theme_color: "#d01d21",
          icons: [
            { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
            { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
            {
              src: "/maskable-icon-512x512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
          ],
        },
        manifestFilename: "admin-manifest.webmanifest",
        scope: "/admin/",
        filename: "sw.js",
        registerType: "autoUpdate",
        strategies: "generateSW",
        includeAssets: ["favicon.ico", "apple-touch-icon.png"],
        workbox: {
          // Only precache built static assets — never cache Supabase/API responses,
          // and never intercept navigations (this is an SSR app, always hit the network).
          globPatterns: ["**/*.{js,css}"],
          navigateFallback: undefined,
          runtimeCaching: [],
        },
        devOptions: { enabled: false },
      }),
    ],
  },
});
