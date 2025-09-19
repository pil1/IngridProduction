/**
 * Advanced chunk optimization utilities for reducing bundle sizes
 * Implements dynamic imports with intelligent prefetching and caching
 */

interface ChunkConfig {
  priority: 'high' | 'medium' | 'low';
  preload?: boolean;
  prefetchOnHover?: boolean;
  cacheStrategy?: 'aggressive' | 'normal' | 'minimal';
}

interface ChunkModule<T = unknown> {
  loader: () => Promise<T>;
  config: ChunkConfig;
  name: string;
}

class ChunkOptimizer {
  private loadedModules = new Map<string, unknown>();
  private loadingPromises = new Map<string, Promise<unknown>>();
  private preloadQueue = new Set<string>();

  /**
   * Register a chunk for optimized loading
   */
  registerChunk<T>(name: string, loader: () => Promise<T>, config: ChunkConfig): ChunkModule<T> {
    const module: ChunkModule<T> = { loader, config, name };

    // Immediately start preloading high-priority chunks
    if (config.priority === 'high' && config.preload) {
      this.preloadChunk(name, loader);
    }

    return module;
  }

  /**
   * Load a chunk with caching and error handling
   */
  async loadChunk<T>(name: string, loader: () => Promise<T>): Promise<T> {
    // Return cached module if available
    if (this.loadedModules.has(name)) {
      return this.loadedModules.get(name);
    }

    // Return existing loading promise to avoid duplicate requests
    if (this.loadingPromises.has(name)) {
      return this.loadingPromises.get(name);
    }

    // Start loading
    const loadingPromise = this.performLoad(name, loader);
    this.loadingPromises.set(name, loadingPromise);

    try {
      const module = await loadingPromise;
      this.loadedModules.set(name, module);
      this.loadingPromises.delete(name);
      return module;
    } catch (error) {
      this.loadingPromises.delete(name);
      console.error(`Failed to load chunk ${name}:`, error);
      throw error;
    }
  }

  /**
   * Preload a chunk without blocking
   */
  private async preloadChunk<T>(name: string, loader: () => Promise<T>): Promise<void> {
    if (this.preloadQueue.has(name) || this.loadedModules.has(name)) {
      return;
    }

    this.preloadQueue.add(name);

    try {
      // Use requestIdleCallback for non-blocking preload
      if ('requestIdleCallback' in window) {
        await new Promise(resolve =>
          window.requestIdleCallback(() => resolve(undefined))
        );
      }

      await this.loadChunk(name, loader);
    } catch (error) {
      console.warn(`Preload failed for chunk ${name}:`, error);
    } finally {
      this.preloadQueue.delete(name);
    }
  }

  /**
   * Perform the actual loading with retry logic
   */
  private async performLoad<T>(name: string, loader: () => Promise<T>): Promise<T> {
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await loader();
      } catch (error) {
        lastError = error as Error;

        if (attempt < maxRetries) {
          // Exponential backoff
          await new Promise(resolve =>
            setTimeout(resolve, Math.pow(2, attempt) * 1000)
          );
        }
      }
    }

    throw lastError;
  }

  /**
   * Get loading statistics
   */
  getStats() {
    return {
      loaded: this.loadedModules.size,
      loading: this.loadingPromises.size,
      preloading: this.preloadQueue.size
    };
  }

  /**
   * Clear cache for memory management
   */
  clearCache(selective?: string[]) {
    if (selective) {
      selective.forEach(name => this.loadedModules.delete(name));
    } else {
      this.loadedModules.clear();
    }
  }
}

// Global chunk optimizer instance
export const chunkOptimizer = new ChunkOptimizer();

/**
 * Create an optimized dynamic import with advanced features
 */
export function createOptimizedImport<T>(
  name: string,
  loader: () => Promise<{ default: T } | T>,
  config: ChunkConfig = { priority: 'medium' }
): () => Promise<T> {
  chunkOptimizer.registerChunk(name, loader, config);

  return async () => {
    const module = await chunkOptimizer.loadChunk(name, loader);

    // Handle both default exports and named exports
    if (module && typeof module === 'object' && 'default' in module) {
      return module.default;
    }

    return module;
  };
}

/**
 * Prefetch chunks that are likely to be needed soon
 */
export function prefetchChunks(chunks: string[]): void {
  chunks.forEach(chunkName => {
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(() => {
        // Trigger prefetch by accessing the chunk
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = `/${chunkName}`;
        document.head.appendChild(link);
      });
    }
  });
}

/**
 * Monitor and report chunk loading performance
 */
export function monitorChunkPerformance(): void {
  if ('performance' in window && 'getEntriesByType' in performance) {
    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        if (entry.name.includes('chunk') || entry.name.includes('lazy')) {
          console.log(`Chunk loaded: ${entry.name} (${entry.duration}ms)`);

          // Report slow chunks
          if (entry.duration > 3000) {
            console.warn(`Slow chunk detected: ${entry.name} took ${entry.duration}ms`);
          }
        }
      });
    });

    observer.observe({ entryTypes: ['navigation', 'resource'] });
  }
}

// Initialize performance monitoring in development
if (process.env.NODE_ENV === 'development') {
  monitorChunkPerformance();
}