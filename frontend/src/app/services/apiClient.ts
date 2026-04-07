import { authService } from './authService';

let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (error: Error) => void }> = [];

const processQueue = (error: Error | null, token: string | null = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else if (token) {
      prom.resolve(token);
    }
  });
  
  failedQueue = [];
};

/**
 * Wrapper around fetch that automatically adds authorization headers
 */
export async function fetchWithAuth(
  url: string,
  options: RequestInit = {},
  retryCount: number = 0
): Promise<Response> {
  const token = authService.getAccessToken();
  
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let response = await fetch(url, {
    ...options,
    headers,
  });

  // Handle token expiration with automatic refresh
  if (response.status === 401 && retryCount === 0) {
    if (isRefreshing) {
      // Wait for token refresh to complete
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then(newToken => {
        // Retry the request with new token
        const newHeaders = new Headers(options.headers);
        if (!newHeaders.has('Content-Type')) {
          newHeaders.set('Content-Type', 'application/json');
        }
        newHeaders.set('Authorization', `Bearer ${newToken}`);
        return fetch(url, {
          ...options,
          headers: newHeaders,
        });
      }).catch(() => {
        authService.clearTokens();
        window.location.href = '/';
        return response;
      });
    }

    isRefreshing = true;

    try {
      const { accessToken: newToken } = await authService.refreshAccessToken();
      processQueue(null, newToken);
      isRefreshing = false;
      
      // Retry the original request with new token
      return fetchWithAuth(url, options, retryCount + 1);
    } catch (error) {
      processQueue(error as Error, null);
      isRefreshing = false;
      
      // Refresh failed, redirect to login
      authService.clearTokens();
      window.location.href = '/';
      return response;
    }
  }

  return response;
}

/**
 * Create axios-like interceptor for fetch requests
 */
export const apiClient = {
  get: (url: string, options?: RequestInit) =>
    fetchWithAuth(url, { ...options, method: 'GET' }),

  post: (url: string, data?: unknown, options?: RequestInit) =>
    fetchWithAuth(url, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    }),

  put: (url: string, data?: unknown, options?: RequestInit) =>
    fetchWithAuth(url, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    }),

  patch: (url: string, data?: unknown, options?: RequestInit) =>
    fetchWithAuth(url, {
      ...options,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    }),

  delete: (url: string, options?: RequestInit) =>
    fetchWithAuth(url, { ...options, method: 'DELETE' }),
};
