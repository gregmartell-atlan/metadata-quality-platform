/**
 * Security utilities for sanitizing user input and error messages
 */

/**
 * Sanitize error messages to prevent XSS
 * Removes HTML tags and limits length
 */
export function sanitizeError(error: string | Error): string {
  const message = error instanceof Error ? error.message : String(error);
  
  // Remove HTML tags
  let sanitized = message.replace(/<[^>]*>/g, '');
  
  // Remove script tags and event handlers
  sanitized = sanitized.replace(/javascript:/gi, '');
  sanitized = sanitized.replace(/on\w+\s*=/gi, '');
  
  // Limit length to prevent DoS
  sanitized = sanitized.substring(0, 500);
  
  return sanitized;
}

/**
 * Sanitize user input for display
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
    .substring(0, 1000); // Limit length
}


