import { resolve } from "path";
import { defineConfig } from "electron-vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        input: {
          index: resolve("src/main/index.ts"),
        },
      },
    },
    resolve: {
      alias: {
        "@shared": resolve("src/shared"),
        "@preprocessing": resolve("src/preprocessing"),
      },
    },
  },
  preload: {
    build: {
      rollupOptions: {
        input: {
          index: resolve("src/preload/index.ts"),
        },
      },
    },
    resolve: {
      alias: {
        "@shared": resolve("src/shared"),
        "@preprocessing": resolve("src/preprocessing"),
      },
    },
  },
  renderer: {
    root: "src/renderer",
    build: {
      rollupOptions: {
        input: {
          index: resolve("src/renderer/index.html"),
        },
      },
    },
    resolve: {
      alias: {
        "@renderer": resolve("src/renderer/src"),
        "@shared": resolve("src/shared"),
        "@preprocessing": resolve("src/preprocessing"),
      },
    },
    plugins: [react(), tailwindcss()],
  },
});
