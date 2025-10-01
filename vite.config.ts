import { defineConfig } from "vite";
import dyadComponentTagger from "@dyad-sh/react-vite-component-tagger";
import react from "@vitejs/plugin-react-swc";
import { visualizer } from "rollup-plugin-visualizer";
import path from "path";

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    open: false, // Don't auto-open browser
    cors: true,
    // Allow external hosts
    allowedHosts: ["dev.onbb.ca", "localhost", "127.0.0.1", "::1"],
    // Enhanced HMR configuration
    hmr: {
      port: 8080,
    },
    // Proxy configuration for development
    proxy:
      mode === "development"
        ? {
            "/api": {
              target: "http://localhost:3001",
              changeOrigin: true,
              secure: false,
            },
          }
        : {},
  },
  plugins: [
    dyadComponentTagger(),
    react({
      // Fast refresh optimization
      fastRefresh: true,
      // Only include development plugins in dev mode
      ...(mode === "development" && {
        babel: {
          plugins: [
            // Add any development-specific babel plugins here
          ],
        },
      }),
    }),
    // Bundle analyzer - only in analyze mode
    mode === "analyze" &&
      visualizer({
        filename: "dist/stats.html",
        open: true,
        gzipSize: true,
      }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Development optimizations
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-router-dom",
      "@tanstack/react-query",
      "lucide-react",
      "clsx",
      "tailwind-merge",
    ],
    exclude: [
      // Exclude large dependencies that don't need pre-bundling
      "pdfjs-dist",
    ],
  },
  // Enhanced caching for faster rebuilds
  cacheDir: ".vite",
  build: {
    // Optimize chunk splitting
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React chunks
          "react-vendor": ["react", "react-dom", "react-router-dom"],

          // UI components - only include what's actually installed
          "radix-vendor": [
            "@radix-ui/react-accordion",
            "@radix-ui/react-alert-dialog",
            "@radix-ui/react-avatar",
            "@radix-ui/react-checkbox",
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-label",
            "@radix-ui/react-popover",
            "@radix-ui/react-select",
            "@radix-ui/react-tabs",
            "@radix-ui/react-toast",
            "@radix-ui/react-tooltip",
          ],

          // Heavy libraries
          "query-vendor": ["@tanstack/react-query"],
          "charts-vendor": ["recharts"],
          "pdf-vendor": ["pdfjs-dist"],
          "dnd-vendor": [
            "@dnd-kit/core",
            "@dnd-kit/sortable",
            "@dnd-kit/utilities",
          ],
          "form-vendor": ["react-hook-form", "@hookform/resolvers", "zod"],

          // Utilities
          "utils-vendor": [
            "clsx",
            "tailwind-merge",
            "class-variance-authority",
            "date-fns",
            "lucide-react",
          ],
        },
      },
    },
    // Increase chunk size warning limit
    chunkSizeWarningLimit: 1000,
    // Enable source maps for better debugging based on mode
    sourcemap: mode === "development" || mode === "local",
    // Faster builds for development
    minify: mode === "development" ? false : "esbuild",
  },
}));
