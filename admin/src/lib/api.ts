/**
 * Client for the obisflow admin API (/admin on the API). The admin token is
 * kept in sessionStorage: it lasts for this tab and is gone when the browser
 * closes.
 */

export const API_URL = ((import.meta.env.VITE_API_URL as string | undefined) ?? 'https://backend-xv27.onrender.com').replace(/\/$/, '')

const TOKEN_KEY = 'obisflow.admin.token'

export function loadToken() {
  try {
    return sessionStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function saveToken(token: string | null) {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token)
    else sessionStorage.removeItem(TOKEN_KEY)
  } catch {
    // Storage blocked: the token lasts until reload.
  }
}

export class AdminError extends Error {
  readonly status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function request<T>(method: 'GET' | 'POST', path: string, token: string, body?: unknown): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_URL}/admin${path}`, {
      method,
      headers: { authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new AdminError(`Can't reach the API at ${API_URL}. It may be waking up, or ADMIN_URL on the API is not this site's address.`, 0)
  }
  const data = (await response.json().catch(() => ({}))) as T & { detail?: string }
  if (response.status === 404 && path === '/overview') throw new AdminError('The admin API is off. Set ADMIN_TOKEN on the API server.', 404)
  if (!response.ok) throw new AdminError(typeof data.detail === 'string' ? data.detail : `API error ${response.status}`, response.status)
  return data
}

export const adminGet = <T>(path: string, token: string) => request<T>('GET', path, token)
export const adminPost = <T>(path: string, token: string, body: unknown = {}) => request<T>('POST', path, token, body)
