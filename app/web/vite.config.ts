import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // 本 worktree 的后端跑在 8788（主仓是 8787），spec 明确允许且必须改这一处
      '/api': 'http://localhost:8788',
    },
  },
});
