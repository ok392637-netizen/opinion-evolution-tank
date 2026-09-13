import type { Ecosystem, HotItem, ReleaseReport, Species } from './types';

async function json<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({ error: '响应解析失败' }));
  if (!res.ok) throw new Error((body as { error?: string }).error || `HTTP ${res.status}`);
  return body as T;
}

export interface Status {
  liveMode: boolean;
  zhidaUsedToday: number;
}

export const api = {
  status: () => fetch('/api/status').then((r) => json<Status>(r)),
  hot: () =>
    fetch('/api/hot').then((r) =>
      json<{ items: HotItem[]; source: 'live' | 'demo'; fetchedAt: number; cached?: boolean }>(r),
    ),
  ecosystem: (question: string, url?: string) =>
    fetch('/api/ecosystem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, url }),
    }).then((r) => json<Ecosystem>(r)),
  release: (question: string, draft: string, species: Species[]) =>
    fetch('/api/release', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, draft, species }),
    }).then((r) => json<ReleaseReport>(r)),
  quota: () =>
    fetch('/api/quota').then((r) =>
      json<{ liveMode: boolean; items: { APIID: string; APIName: string; TotalQuota: number; TotalUsed: number; RemainingQuota: number }[] }>(r),
    ),
};
