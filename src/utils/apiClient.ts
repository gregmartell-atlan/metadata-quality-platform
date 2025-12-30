/**
 * Enhanced API client with retry logic, timeouts, and error handling
 */

import { logger } from './logger';

export interface ApiRequestOptions extends RequestInit {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  signal?: AbortSignal;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  status: number;
}

const DEFAULT_TIMEOUT = 30000; // 30 seconds
const DEFAULT_RETRIES = 3;
const DEFAULT_RETRY_DELAY = 1000; // 1 second

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if error is retryable
 */
function isRetryableError(status: number, error: unknown): boolean {
  // Retry on network errors, timeouts, and 5xx server errors
  if (status === 0) return true; // Network error
  if (status >= 500 && status < 600) return true; // Server error
  if (status === 429) return true; // Rate limit
  return false;
}

/**
 * Calculate exponential backoff delay
 */
function calculateRetryDelay(attempt: number, baseDelay: number): number {
  return baseDelay * Math.pow(2, attempt);
}

/**
 * Enhanced fetch with timeout, retry, and error handling
 */
export async function apiFetch<T>(
  url: string,
  options: ApiRequestOptions = {}
): Promise<ApiResponse<T>> {
  const {
    timeout = DEFAULT_TIMEOUT,
    retries = DEFAULT_RETRIES,
    retryDelay = DEFAULT_RETRY_DELAY,
    signal: externalSignal,
    ...fetchOptions
  } = options;

  let lastError: ApiResponse<T> | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, timeout);

    // Combine external signal with timeout signal
    const combinedSignal = externalSignal
      ? (() => {
          const combined = new AbortController();
          externalSignal.addEventListener('abort', () => combined.abort());
          controller.signal.addEventListener('abort', () => combined.abort());
          return combined.signal;
        })()
      : controller.signal;

    try {
      logger.debug(`API request attempt ${attempt + 1}/${retries + 1}`, { url, method: fetchOptions.method || 'GET' });

      const response = await fetch(url, {
        ...fetchOptions,
        signal: combinedSignal,
      });

      clearTimeout(timeoutId);

      // Handle non-OK responses
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `API error: ${response.status}`;

        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.message || errorJson.error || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }

        const errorResponse: ApiResponse<T> = {
          error: errorMessage,
          status: response.status,
        };

        // Retry if error is retryable and we have attempts left
        if (isRetryableError(response.status, errorMessage) && attempt < retries) {
          const delay = calculateRetryDelay(attempt, retryDelay);
          logger.warn(`Request failed, retrying in ${delay}ms`, {
            url,
            status: response.status,
            attempt: attempt + 1,
          });
          await sleep(delay);
          lastError = errorResponse;
          continue;
        }

        return errorResponse;
      }

      // Success - parse and return data
      const data = await response.json();
      logger.debug('API request successful', { url, status: response.status });
      return { data, status: response.status };
    } catch (error) {
      clearTimeout(timeoutId);

      // Check if request was aborted
      if (error instanceof DOMException && error.name === 'AbortError') {
        if (externalSignal?.aborted) {
          return {
            error: 'Request cancelled',
            status: 0,
          };
        }
        // Timeout
        const timeoutError: ApiResponse<T> = {
          error: `Request timeout after ${timeout}ms`,
          status: 0,
        };

        if (attempt < retries) {
          const delay = calculateRetryDelay(attempt, retryDelay);
          logger.warn(`Request timed out, retrying in ${delay}ms`, {
            url,
            attempt: attempt + 1,
          });
          await sleep(delay);
          lastError = timeoutError;
          continue;
        }

        return timeoutError;
      }

      // Network errors
      if (error instanceof TypeError) {
        const networkError: ApiResponse<T> = {
          error: error.message.includes('fetch')
            ? 'Network error: Unable to connect to server'
            : error.message,
          status: 0,
        };

        if (attempt < retries) {
          const delay = calculateRetryDelay(attempt, retryDelay);
          logger.warn(`Network error, retrying in ${delay}ms`, {
            url,
            attempt: attempt + 1,
            error: error.message,
          });
          await sleep(delay);
          lastError = networkError;
          continue;
        }

        return networkError;
      }

      // Unknown error
      const unknownError: ApiResponse<T> = {
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        status: 0,
      };

      logger.error('API request failed with unknown error', {
        url,
        error,
        attempt: attempt + 1,
      });

      return unknownError;
    }
  }

  // All retries exhausted
  logger.error('API request failed after all retries', {
    url,
    retries,
    lastError,
  });

  return (
    lastError || {
      error: 'Request failed after all retry attempts',
      status: 0,
    }
  );
}






