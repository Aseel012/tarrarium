import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  worker: {
    // The simulation runs inside an ES module Web Worker so it can use
    // normal `import` statements for the shared, pure simulation logic.
    format: "es",
  },
});
