// Browser-only authentication renewal. Never attach credentials to third-party URLs.
// Access/order capabilities are session-scoped: persistent authentication is carried
// only by the server-managed HttpOnly refresh cookie.
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4002';
const keys = { customer: 'mandemarket_customer_token', staff: 'admin_token' };
type Portal = keyof typeof keys;
const pending: Partial<Record<Portal, Promise<string | null>>> = {};
async function renew(portal: Portal, oldToken: string): Promise<string | null> {
  if (pending[portal]) return pending[portal]!;
  const run = async () => {
    const current = sessionStorage.getItem(keys[portal]);
    if (current && current !== oldToken) return current;
    const response = await globalThis.fetch(`${API}/api/auth/refresh`, {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ portal }),
    });
    if (!response.ok) {
      if (sessionStorage.getItem(keys[portal]) === oldToken) sessionStorage.removeItem(keys[portal]);
      return null;
    }
    const data = await response.json();
    sessionStorage.setItem(keys[portal], data.accessToken);
    return data.accessToken as string;
  };
  const task = Promise.resolve(navigator.locks ? navigator.locks.request(`mm-refresh-${portal}`, run) : run())
    .finally(() => { delete pending[portal]; });
  pending[portal] = task;
  return task;
}
export function rememberOrderAccess(reference: string, token: string) {
  sessionStorage.setItem(`mm_order_access_${reference}`, token);
}
export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  if (typeof window === 'undefined' || input instanceof Request) return globalThis.fetch(input, init);
  const url = new URL(String(input), window.location.origin);
  if ((url.origin !== new URL(API).origin && url.origin !== window.location.origin) || !url.pathname.startsWith('/api/')) return globalThis.fetch(input, init);
  const headers = new Headers(init.headers);
  const staffPath = /^\/api\/(admin|dashboard|sellers|support)\b/.test(url.pathname);
  const staffToken = sessionStorage.getItem(keys.staff);
  const supplied = headers.get('Authorization')?.replace(/^Bearer /, '');
  // This hint selects a refresh cookie only; the server still validates every JWT.
  // A component can keep an older access token after another tab has refreshed it.
  let suppliedStaff = false;
  try {
    const payload = supplied?.split('.')[1];
    if (payload) suppliedStaff = ['admin', 'manager', 'support', 'seller'].includes(JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))).role);
  } catch { /* invalid tokens are rejected by the server */ }
  const portal: Portal = (supplied && supplied === staffToken) || suppliedStaff || staffPath ? 'staff' : 'customer';
  const token = supplied || sessionStorage.getItem(keys[portal]);
  const isPublicAuth = /^\/api\/(auth|account)\/(login|register|signup|signup-seller|verify-email|resend-verification|forgot-password|reset-password|refresh)$/.test(url.pathname);
  if (token && !isPublicAuth) headers.set('Authorization', `Bearer ${token}`);
  if (isPublicAuth) headers.delete('Authorization');
  // An emailed order link uses a fragment so neither the server nor referrers see it.
  if (window.location.pathname.startsWith('/commande/') && window.location.hash) {
    const linkToken = new URLSearchParams(window.location.hash.slice(1)).get('token');
    if (linkToken) {
      rememberOrderAccess(decodeURIComponent(window.location.pathname.split('/').pop()!), linkToken);
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }
  let reference = url.pathname.match(/\/api\/(?:orders\/reference|payment\/status)\/([^/]+)/)?.[1];
  if (!reference && typeof init.body === 'string' && url.pathname === '/api/payment/initiate') {
    try { reference = JSON.parse(init.body).orderId; } catch { /* invalid JSON handled by API */ }
  }
  if (!reference && url.pathname.startsWith('/api/payment/verify/')) reference = url.pathname.split('/').pop();
  if (reference) {
    const orderToken = sessionStorage.getItem(`mm_order_access_${decodeURIComponent(reference)}`);
    if (orderToken) headers.set('X-Order-Token', orderToken);
  }
  const options = { ...init, headers, credentials: 'include' as RequestCredentials };
  let response = await globalThis.fetch(input, options);
  if (response.status === 401 && token && !isPublicAuth) {
    const refreshed = await renew(portal, token);
    if (refreshed) {
      headers.set('Authorization', `Bearer ${refreshed}`);
      response = await globalThis.fetch(input, { ...options, headers });
    }
  }
  return response;
}
export async function logoutSession(portal: Portal) {
  const token = sessionStorage.getItem(keys[portal]);
  if (token) {
    // Renew if necessary before revocation, but do not clear local state on a network failure.
    const response = await apiFetch(`${API}/api/auth/logout`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error('Deconnexion non confirmee. Reessayez.');
  }
  sessionStorage.removeItem(keys[portal]);
  if (portal === 'staff') sessionStorage.removeItem('admin_user');
}
