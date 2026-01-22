import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  const isLib = mode === 'lib';

  return {
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
      },
    },

    build: isLib
      ? {
          lib: {
            entry: resolve(__dirname, 'src/index.ts'),
            name: 'ThinkingTraceViewer',
            fileName: 'thinking-trace-viewer',
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
      port: 3000,
      open: true,
    },

    test: {
      globals: true,
      environment: 'jsdom',
      include: ['src/**/*.{test,spec}.{js,ts}'],
    },
  };
});
