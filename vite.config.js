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
        circular_queue: resolve(__dirname, "src/html/circular_queue.html"),
        deque: resolve(__dirname, "src/html/deque.html"),
        token_bucket: resolve(__dirname, "src/html/token_bucket.html"),
        leaky_bucket: resolve(__dirname, "src/html/leaky_bucket.html"),
      },
    },
  },
});
