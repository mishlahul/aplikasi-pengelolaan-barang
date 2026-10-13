const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export type Role = 'ADMIN' | 'OPERATOR';
export type SessionUser = { id: number; username: string; name: string; role: Role };
export type PageResult<T> = {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};
export type Category = {
  id: number;
  categoryCode: string;
  categoryName: string;
};
export type SubCategory = {
  id: number;
  categoryId: number;
  categoryName: string;
  categoryCode: string;
  name: string;
  priceLimit: number;
};
export type User = {
  id: number;
  username: string;
  name: string;
  email: string;
  role: Role;
  isLocked: boolean;
};
export type IncomingItem = {
  id: number;
  name: string;
  price: number;
  quantity: number;
  total: number;
  unit: string;
  verified: boolean;
  expiresAt: string | null;
};
export type Incoming = {
  id: number;
  operatorId: number;
  operatorName: string;
  categoryId: number;
  categoryCode: string;
  categoryName: string;
  subCategoryId: number;
  subCategoryName: string;
  priceLimit: number;
  source: string;
  letterNumber: string | null;
  attachmentUrl: string | null;
  createdAt: string;
  total: number;
  items: IncomingItem[];
};

type RequestOptions = RequestInit & { auth?: boolean };

export async function getHttpError(response: Response): Promise<Error> {
  const body = await response.json().catch(() => null) as {
    message?: string | string[];
    error?: string;
  } | null;
  const message = Array.isArray(body?.message) ? body.message.join(', ') : body?.message;
  const description = message || body?.error || response.statusText || 'Permintaan gagal';
  return new Error(`${description} (HTTP ${response.status})`);
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { auth = true, headers: customHeaders, ...requestOptions } = options;
  const headers = new Headers(customHeaders);
  const token = localStorage.getItem('inventory-token');
  if (auth && token) headers.set('Authorization', `Bearer ${token}`);
  if (requestOptions.body && !(requestOptions.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_URL}${path}`, { ...requestOptions, headers });
  if (!response.ok) {
    throw await getHttpError(response);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function downloadIncomingAttachment(id: number): Promise<{ blob: Blob; filename: string }> {
  const headers = new Headers();
  const token = localStorage.getItem('inventory-token');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(`${API_URL}/incoming/${id}/attachment`, { headers });
  if (!response.ok) throw await getHttpError(response);
  const filename = response.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/i)?.[1] ?? 'lampiran';
  return { blob: await response.blob(), filename };
}

export function queryString(values: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && String(value).trim() !== '') params.set(key, String(value));
  });
  const query = params.toString();
  return query ? `?${query}` : '';
}

export async function fetchAll<T>(path: string): Promise<T[]> {
  const first = await api<PageResult<T>>(path);
  const pages = await Promise.all(
    Array.from({ length: Math.max(0, first.totalPages - 1) }, (_, index) =>
      api<PageResult<T>>(`${path}${path.includes('?') ? '&' : '?'}page=${index + 2}`),
    ),
  );
  return [first, ...pages].flatMap((page) => page.data);
}

export const money = (value: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value);
