import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  const isLib = mode === 'lib';

  return {
    // Use repo name as base for GitHub Pages, otherwise '/'
    base: process.env.GITHUB_PAGES ? '/thinking-tracer/' : '/',

    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
      },
    },

    build: isLib
      ? {
          lib: {
            entry: resolve(__dirname, 'src/index.ts'),
            name: 'ThinkingTracer',
            fileName: 'thinking-tracer',
            formats: ['es'],
          },
          rollupOptions: {
            external: ['three'],
            output: {
              globals: {
                three: 'THREE',
              },
            },
          },
        }
      : {
          outDir: 'dist',
          sourcemap: true,
        },

    server: {
      // Default to localhost for security; use `npm run dev:network` for LAN/Tailscale access
      port: 3000,
      open: true,
      // Allow all hosts when VITE_NETWORK_MODE is set (for Tailscale/LAN access)
      allowedHosts: process.env.VITE_NETWORK_MODE ? true : undefined,
    },

    test: {
      globals: true,
      environment: 'jsdom',
      include: ['src/**/*.{test,spec}.{js,ts}'],
      setupFiles: ['./src/test-setup.ts'],
    },
  };
});
