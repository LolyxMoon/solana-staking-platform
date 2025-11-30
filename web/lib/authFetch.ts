// ====================================================================
// AUTHENTICATED FETCH WRAPPER
// Automatically includes JWT token in all admin API requests
// Usage: Replace fetch() with authFetch() in your admin panel
// ====================================================================

/**
 * Makes an authenticated fetch request with JWT token from localStorage
 * 
 * @param url - The URL to fetch
 * @param options - Standard fetch options (method, body, etc.)
 * @returns Promise with the fetch response
 * 
 * @example
 * // Instead of:
 * fetch('/api/admin/pools', { method: 'POST', ... })
 * 
 * // Use:
 * authFetch('/api/admin/pools', { method: 'POST', ... })
 */
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  // Get token from localStorage
  const token = localStorage.getItem('admin_token');
  
  // Merge authorization header with existing headers
  const headers = new Headers(options.headers);
  
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  
  // Make the request with token included
  return fetch(url, {
    ...options,
    headers,
  });
}

/**
 * Hook version for React components
 * Returns a fetch function that automatically includes the JWT token
 * 
 * @example
 * const authFetch = useAuthFetch();
 * const response = await authFetch('/api/admin/pools', { method: 'POST', ... });
 */
export function useAuthFetch() {
  return authFetch;
}
