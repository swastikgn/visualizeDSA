import { defineConfig } from "vite";
import { resolve } from "path";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [tailwindcss()],
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, "index.html"),
        binary_search: resolve(__dirname, "src/html/binary_search.html"),
        binary_search_tree: resolve(
          __dirname,
          "src/html/binary_search_tree.html"
        ),
        brute_force_string_matching: resolve(
          __dirname,
          "src/html/brute_force_string_matching.html"
        ),
        bubble_sort: resolve(__dirname, "src/html/bubble_sort.html"),
        queue: resolve(__dirname, "src/html/queue.html"),
        selection_sort: resolve(__dirname, "src/html/selection_sort.html"),
        stack: resolve(__dirname, "src/html/stack.html"),
        merge_sort: resolve(__dirname, "src/html/merge_sort.html"),
      },
    },
  },
});
