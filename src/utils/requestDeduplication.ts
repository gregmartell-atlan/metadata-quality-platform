/**
 * Request deduplication utility
 * Prevents duplicate API calls for the same endpoint
 */

interface PendingRequest<T> {
  promise: Promise<T>;
  timestamp: number;
}

const pendingRequests = new Map<string, PendingRequest<unknown>>();
const REQUEST_DEDUP_WINDOW = 1000; // 1 second window

/**
 * Deduplicate requests - if same request is made within window, return existing promise
 */
export function deduplicateRequest<T>(
  key: string,
  requestFn: () => Promise<T>,
  windowMs: number = REQUEST_DEDUP_WINDOW
): Promise<T> {
  const now = Date.now();
  const existing = pendingRequests.get(key);
  
  // If request exists and is within window, return existing promise
  if (existing && (now - existing.timestamp) < windowMs) {
    return existing.promise as Promise<T>;
  }
  
  // Create new request
  const promise = requestFn().finally(() => {
    // Clean up after request completes
    pendingRequests.delete(key);
  });
  
  pendingRequests.set(key, { promise, timestamp: now });
  
  return promise;
}

/**
 * Clear all pending requests (useful for testing or cleanup)
 */
export function clearPendingRequests(): void {
  pendingRequests.clear();
}


