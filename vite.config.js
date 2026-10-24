import { defineConfig } from 'vite';

// 相對路徑：不論 GitHub 儲存庫叫什麼名字，部署在 /<repo>/ 底下都能正常載入
export default defineConfig({
  base: './',
});
