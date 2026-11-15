import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths so the built game works from any folder (GitHub Pages, itch.io, a USB stick...)
  base: './',
  plugins: [react(), tailwindcss()],
});
