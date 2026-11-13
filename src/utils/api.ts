const SESSION_STORAGE_KEY = 'danesh_sid_token';

let csrfTokenStore: string | null = null;
let sessionTokenStore: string | null = (() => {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage.getItem(SESSION_STORAGE_KEY) : null;
  } catch {
    return null;
  }
})();
let unauthorizedHandler: (() => void) | null = null;

export function setCsrfToken(token: string | null): void {
  csrfTokenStore = token;
}

export function setSessionToken(token: string | null): void {
  sessionTokenStore = token;
  try {
    if (typeof window !== 'undefined') {
      if (token) {
        window.sessionStorage.setItem(SESSION_STORAGE_KEY, token);
      } else {
        window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
      }
    }
  } catch {
    // ignore storage restriction
  }
}

export function getSessionToken(): string | null {
  return sessionTokenStore;
}

export function registerUnauthorizedHandler(fn: (() => void) | null): void {
  unauthorizedHandler = fn;
}

export async function apiRequest<T = any>(url: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();
  const headers = new Headers(options.headers || {});

  if (!(options.body instanceof FormData) && !headers.has('Content-Type') && method !== 'GET') {
    headers.set('Content-Type', 'application/json');
  }

  if (sessionTokenStore && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${sessionTokenStore}`);
  }

  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && csrfTokenStore) {
    headers.set('X-CSRF-Token', csrfTokenStore);
  }

  const res = await fetch(url, {
    ...options,
    credentials: 'include',
    headers,
  });

  if (res.status === 401 && url !== '/api/auth/login') {
    setSessionToken(null);
    setCsrfToken(null);
    unauthorizedHandler?.();
  }

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return {} as T;
  }

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return data as T;
}

export async function uploadFile(file: File): Promise<{ url: string; original_name: string; mime_type: string; file_size: number }> {
  const form = new FormData();
  form.append('file', file);
  return apiRequest('/api/admin/upload', { method: 'POST', body: form });
}

export async function uploadImage(file: File): Promise<{ url: string; original_name: string; mime_type: string; file_size: number }> {
  const form = new FormData();
  form.append('file', file);
  return apiRequest('/api/admin/upload-image', { method: 'POST', body: form });
}

export async function downloadAuthenticatedFile(url: string, fallbackName = 'download'): Promise<void> {
  const headers = new Headers();
  if (sessionTokenStore) {
    headers.set('Authorization', `Bearer ${sessionTokenStore}`);
  }
  const res = await fetch(url, {
    method: 'GET',
    credentials: 'include',
    headers,
  });
  if (res.status === 401) {
    setSessionToken(null);
    setCsrfToken(null);
    unauthorizedHandler?.();
    throw new Error('Authentication required');
  }
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const blob = await res.blob();
  const disp = res.headers.get('content-disposition') || '';
  const match = /filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i.exec(disp);
  const fileName = match ? decodeURIComponent(match[1]) : fallbackName;
  const objUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(objUrl), 5000);
}
