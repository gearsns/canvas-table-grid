import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

export default defineConfig({
  plugins: [solid()],
  base: "./",
  root: "example",
  build: {
    outDir: "../dist-example",
  },
});
