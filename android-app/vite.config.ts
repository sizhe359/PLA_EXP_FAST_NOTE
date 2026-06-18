import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  envPrefix: ["VITE_", "NEXT_PUBLIC_"],
  plugins: [react()],
  root: __dirname,
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "../src"),
      "@android": path.resolve(__dirname, "src"),
    },
  },
  build: {
    outDir: "../android-dist",
    emptyOutDir: true,
  },
});
