import { defineConfig } from "vite";

export default defineConfig(({ command, isPreview }) => ({
  base: command === "serve" && !isPreview ? "/" : "/world-map/",
  build: {
    rollupOptions: {
      output: {
        assetFileNames(assetInfo) {
          const labels = [...(assetInfo.names ?? []), ...(assetInfo.originalFileNames ?? [])];
          if (labels.some((name) => name.endsWith(".mjs"))) return "assets/[name]-[hash].js";
          return "assets/[name]-[hash][extname]";
        },
      },
    },
  },
}));
