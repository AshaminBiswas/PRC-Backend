/**
 * ⚡ Concurrency & Parallel Execution Utilities
 */

/**
 * Runs array mapping asynchronously with bounded max concurrency
 * to prevent saturating database connection pools or API rate limits.
 */
export const concurrentMap = async <T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> => {
  const results: R[] = new Array(items.length);
  let index = 0;

  const worker = async () => {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i], i);
    }
  };

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
};

/**
 * Safely executes parallel promises with Promise.allSettled and logs partial errors
 * without unhandled rejections or cascade crashes.
 */
export const safeParallel = async <T extends readonly unknown[] | []>(
  promises: T
): Promise<{ [K in keyof T]: T[K] extends Promise<infer U> ? U | null : T[K] }> => {
  const results = await Promise.allSettled(promises);
  return results.map((res, i) => {
    if (res.status === 'fulfilled') {
      return res.value;
    } else {
      console.error(`[safeParallel Error at index ${i}]:`, res.reason);
      return null;
    }
  }) as any;
};
