import { defineConfig } from "vite";

import dts from "vite-plugin-dts";

export default defineConfig({
  server: {
    port: 8000,
  },
  assetsInclude: ["**/*.hdr"],
  plugins: [
    dts({
      insertTypesEntry: true,
    }),
  ],

  build: {
    rollupOptions: {
      external: ["three", "dat.gui"],
    },
    lib: {
      entry: "./src/main.ts",
      name: "main",
      fileName: "main",
    },
  },
});
