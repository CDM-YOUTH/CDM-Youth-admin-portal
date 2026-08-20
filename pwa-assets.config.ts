import { defineConfig } from "@vite-pwa/assets-generator/config";

export default defineConfig({
  headLinkOptions: { preset: "2023" },
  preset: {
    transparent: {
      sizes: [192, 512],
      favicons: [[48, "favicon.ico"]],
      padding: 0.05,
      resizeOptions: { fit: "contain", background: "#ffffff" },
    },
    maskable: {
      sizes: [512],
      padding: 0.3,
      resizeOptions: { fit: "contain", background: "#ffffff" },
    },
    apple: {
      sizes: [180],
      padding: 0.05,
      resizeOptions: { fit: "contain", background: "#ffffff" },
    },
  },
  images: ["src/assets/cdm-logo.jpeg"],
});

// Generates into src/assets/ (next to the source image) — move the output into public/
// afterwards (pwa-192x192.png, pwa-512x512.png, maskable-icon-512x512.png, favicon.ico,
// apple-touch-icon-180x180.png → rename to apple-touch-icon.png), it's a one-off step, not
// wired into the build.
