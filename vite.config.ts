import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rolldownOptions: {
      input: {
        game: fileURLToPath(new URL("./index.html", import.meta.url)),
        video: fileURLToPath(new URL("./video.html", import.meta.url)),
      },
    },
  },
});
