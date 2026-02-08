/**
 * Simple in-memory Cache Store to persist data across component remounts.
 * Following a singleton pattern to ensure a unified state.
 */

class CacheStore {
  private static instance: CacheStore;
  private cache: Map<string, any>;

  private constructor() {
    this.cache = new Map();
  }

  public static getInstance(): CacheStore {
    if (!CacheStore.instance) {
      CacheStore.instance = new CacheStore();
    }
    return CacheStore.instance;
  }

  /**
   * Set a value in the cache
   */
  public set(key: string, value: any): void {
    this.cache.set(key, value);
  }

  /**
   * Get a value from the cache
   */
  public get(key: string): any | undefined {
    return this.cache.get(key);
  }

  /**
   * Check if a key exists in cache
   */
  public has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * Clear specific key or entire cache
   */
  public clear(key?: string): void {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }
}

export const cacheStore = CacheStore.getInstance();
