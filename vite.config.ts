import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],

  // 开发服务器配置
  server: {
    port: 3000,
    open: true,
  },

  // 路径别名
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },

  build: {
    // 现代浏览器
    target: "esnext",
    // 生产环境压缩
    minify: "esbuild",
    // 开发时生成 sourcemap
    sourcemap: true,
  },
});
