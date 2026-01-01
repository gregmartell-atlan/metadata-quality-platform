/**
 * Environment variable validation
 * Validates required environment variables on app startup
 */

interface EnvConfig {
  VITE_API_BASE_URL?: string;
  [key: string]: string | undefined;
}

const REQUIRED_ENV_VARS: string[] = [];
const OPTIONAL_ENV_VARS: string[] = ['VITE_API_BASE_URL'];

export function validateEnvironment(): void {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required variables
  for (const varName of REQUIRED_ENV_VARS) {
    const value = import.meta.env[varName];
    if (!value || value.trim() === '') {
      errors.push(`Required environment variable ${varName} is missing or empty`);
    }
  }

  // Check optional variables and warn if missing
  for (const varName of OPTIONAL_ENV_VARS) {
    const value = import.meta.env[varName];
    if (!value || value.trim() === '') {
      warnings.push(`Optional environment variable ${varName} is not set (using default)`);
    }
  }

  // Validate VITE_API_BASE_URL format if provided (can be relative path or full URL)
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
  if (apiBaseUrl && apiBaseUrl.trim() !== '') {
    // Allow relative paths (e.g., "/api") or full URLs
    if (!apiBaseUrl.startsWith('/') && !apiBaseUrl.startsWith('http')) {
      errors.push(`VITE_API_BASE_URL must be a relative path (/api) or full URL: ${apiBaseUrl}`);
    }
  }

  // Log warnings in development
  if (import.meta.env.DEV && warnings.length > 0) {
    console.warn('Environment validation warnings:', warnings);
  }

  // Throw error if required vars are missing
  if (errors.length > 0) {
    const errorMessage = `Environment validation failed:\n${errors.join('\n')}`;
    if (import.meta.env.DEV) {
      console.error(errorMessage);
    }
    throw new Error(errorMessage);
  }
}

/**
 * Get environment variable with fallback
 */
export function getEnvVar(key: string, fallback: string): string {
  return import.meta.env[key] || fallback;
}

/**
 * Get required environment variable (throws if missing)
 */
export function getRequiredEnvVar(key: string): string {
  const value = import.meta.env[key];
  if (!value || value.trim() === '') {
    throw new Error(`Required environment variable ${key} is missing`);
  }
  return value;
}
