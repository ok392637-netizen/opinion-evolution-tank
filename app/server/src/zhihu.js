// 知乎开放平台 API 客户端
// 鉴权：Authorization: Bearer <Access Secret> + X-Request-Timestamp（秒级）
// 设计要点：统一超时、错误归一化、多级缓存（内存+磁盘）、并发去重、直答调用计数（额度守卫）。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = 'https://developer.zhihu.com';
const TIMEOUT_MS = 20000;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function hasSecret() {
  return Boolean(process.env.ZHIHU_ACCESS_SECRET);
}

function authHeaders() {
  return {
    Authorization: `Bearer ${process.env.ZHIHU_ACCESS_SECRET}`,
    'X-Request-Timestamp': String(Math.floor(Date.now() / 1000)),
  };
}

async function request(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    const text = await res.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text.slice(0, 500) };
    }
    if (!res.ok) {
      const err = new Error(body?.Message || body?.error?.message || `HTTP ${res.status}`);
      err.code = body?.Code || body?.error?.code || res.status;
      throw err;
    }
    return body;
  } finally {
    clearTimeout(timer);
  }
}

// ---------- 并发去重与磁盘持久化 ----------

// 同 key 并发请求只发一次（防止双击/前端重试导致额度双倍消耗）
const inflight = new Map();
export function dedup(key, fn) {
  if (inflight.has(key)) return inflight.get(key);
  const p = (async () => {
    try {
      return await fn();
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}

// 生态缸缓存磁盘持久化：服务重启不丢已消耗额度换来的数据
const CACHE_DIR = path.join(__dirname, '..', 'data');
const CACHE_FILE = path.join(CACHE_DIR, 'eco-cache.json');
const CACHE_MAX_ENTRIES = 100;

export function loadEcoCache() {
  try {
    if (!fs.existsSync(CACHE_FILE)) return;
    const arr = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    for (const { k, ts, data } of arr) {
      if (Date.now() - ts < ECO_TTL) ecoCache.set(k, { data, ts });
    }
  } catch {
    // 缓存文件损坏不影响服务
  }
}

export function persistEcoCacheEntry(key, data) {
  try {
    if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
    const entries = [];
    if (fs.existsSync(CACHE_FILE)) {
      try {
        entries.push(...JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')));
      } catch {
        // 忽略旧文件
      }
    }
    const next = [{ k: key, ts: Date.now(), data }, ...entries.filter((e) => e.k !== key)].slice(0, CACHE_MAX_ENTRIES);
    fs.writeFileSync(CACHE_FILE, JSON.stringify(next), 'utf8');
  } catch {
    // 磁盘写入失败不影响内存缓存
  }
}

// ---------- 缓存 ----------

const hotCache = { data: null, ts: 0 };
const HOT_TTL = Number(process.env.HOT_TTL_HOURS || 12) * 60 * 60 * 1000; // 实测热榜额度仅 2 次/日，长缓存

const ecoCache = new Map(); // key: question hash → { data, ts }
const ECO_TTL = 24 * 60 * 60 * 1000; // 24 小时

function hashKey(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  return String(h);
}

// ---------- 直答额度守卫（实测该账号仅 2 次/日，env 可调） ----------

const ZHIDA_DAILY_LIMIT = Number(process.env.ZHIDA_DAILY_LIMIT || 2);
const zhidaUsage = { date: new Date().toISOString().slice(0, 10), count: 0 };
export function zhidaCount() {
  const today = new Date().toISOString().slice(0, 10);
  if (zhidaUsage.date !== today) {
    zhidaUsage.date = today;
    zhidaUsage.count = 0;
  }
  return zhidaUsage.count;
}

const quotaCache = { remaining: null, ts: 0 };
async function zhidaRemaining(force = false) {
  if (!force && quotaCache.remaining !== null && Date.now() - quotaCache.ts < 60 * 1000) {
    return quotaCache.remaining;
  }
  try {
    const body = await request(`${BASE}/api/v1/quota?APIIDs=zhida_openai`, {
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    });
    const item = (body?.Data || []).find((d) => d.APIID === 'zhida_openai');
    quotaCache.remaining = item ? Number(item.RemainingQuota) : null;
    quotaCache.ts = Date.now();
    return quotaCache.remaining;
  } catch {
    return null; // 查询失败不阻断，交给本地计数兜底
  }
}

// ---------- 业务调用 ----------

export async function fetchHot() {
  return dedup('hot', async () => {
    if (hotCache.data && Date.now() - hotCache.ts < HOT_TTL) {
      return { ...hotCache.data, cached: true };
    }
    try {
      const body = await request(`${BASE}/api/v1/content/hot_list?Limit=30`, {
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      });
      const items = (body?.Data?.Items || []).map((it) => ({
        title: it.Title,
        url: it.Url,
        summary: it.Summary || '',
        thumbnail: it.ThumbnailUrl || '',
      }));
      const data = { items, fetchedAt: Date.now() };
      hotCache.data = data;
      hotCache.ts = Date.now();
      return { ...data, cached: false };
    } catch (e) {
      // stale-while-error：额度耗尽或网络故障时回退上次缓存
      if (hotCache.data) return { ...hotCache.data, cached: true, stale: true, warning: e.message };
      throw e;
    }
  });
}

// 按问题 URL 拉取该问题下的回答列表（2026-09-13 实测发现的隐藏端点，不在官方文档中）
// 字段：ContentType / ContentToken / Url / Summary；分页 {IsEnd, NextOffset}
const qaCache = new Map(); // key: questionUrl|offset|limit → { data, ts }
const QA_TTL = 6 * 60 * 60 * 1000; // 6 小时

export async function fetchQuestionAnswers(questionUrl, offset = 0, limit = 10) {
  const key = `qa:${questionUrl}|${offset}|${limit}`;
  const hit = qaCache.get(key);
  if (hit && Date.now() - hit.ts < QA_TTL) return hit.data;
  const data = await dedup(key, async () => {
    const url = `${BASE}/api/v1/content/question_answers?QuestionUrl=${encodeURIComponent(questionUrl)}&Offset=${offset}&Limit=${limit}`;
    const body = await request(url, {
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    });
    return {
      items: (body?.Data?.Items || []).map((it) => ({
        id: String(it.ContentToken),
        contentType: it.ContentType,
        url: it.Url,
        excerpt: (it.Summary || '').replace(/<[^>]+>/g, '').trim(),
      })),
      paging: body?.Data?.Paging || null,
    };
  });
  qaCache.set(key, { data, ts: Date.now() });
  return data;
}

const searchCache = new Map(); // key: query → { data, ts }
const SEARCH_TTL = 6 * 60 * 60 * 1000; // 6 小时，保护 10 次/日额度

export async function searchZhihu(query, count = 10) {
  const key = `search:${query}`;
  const hit = searchCache.get(key);
  if (hit && Date.now() - hit.ts < SEARCH_TTL) return hit.data;
  const data = await dedup(key, async () => {
    const url = `${BASE}/api/v1/content/zhihu_search?Query=${encodeURIComponent(query)}&Count=${count}`;
    const body = await request(url, {
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    });
    return (body?.Data?.Items || []).map((it) => ({
      id: it.ContentID,
      title: it.Title,
      contentType: it.ContentType,
      excerpt: (it.ContentText || '').replace(/<[^>]+>/g, '').trim(),
      url: it.Url,
      votes: it.VoteUpCount ?? 0,
      comments: it.CommentCount ?? 0,
      author: it.AuthorName || '知乎用户',
      avatar: it.AuthorAvatar || '',
      badgeText: it.AuthorBadgeText || '',
      authority: Number(it.AuthorityLevel) || 1,
      editTime: Number(it.EditTime) || 0,
      featuredComments: (it.CommentInfoList || []).map((c) => c.Content).filter(Boolean),
    }));
  });
  searchCache.set(key, { data, ts: Date.now() });
  return data;
}

export async function zhidaChat(model, messages, { timeoutMs = 60000 } = {}) {
  if (!hasSecret()) throw Object.assign(new Error('未配置 Access Secret'), { code: 'NO_SECRET' });
  if (zhidaCount() >= ZHIDA_DAILY_LIMIT) {
    throw Object.assign(new Error('今日直答额度已用尽（本地守卫）'), { code: 'QUOTA_GUARD' });
  }
  const remaining = await zhidaRemaining();
  if (remaining !== null && remaining <= 0) {
    throw Object.assign(new Error('今日直答额度已用尽（服务端确认）'), { code: 'QUOTA_GUARD' });
  }
  zhidaUsage.count += 1;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}/v1/chat/completions`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({ model, messages, stream: false }),
    });
    const text = await res.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      throw new Error(`直答返回非 JSON（HTTP ${res.status}）`);
    }
    if (body?.error) {
      throw Object.assign(new Error(body.error.message || '直答调用失败'), { code: body.error.code });
    }
    const content = body?.choices?.[0]?.message?.content;
    if (!content) throw new Error('直答返回缺少 content');
    return content;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchQuota() {
  const body = await request(`${BASE}/api/v1/quota`, {
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
  });
  return body?.Data || [];
}

export { hashKey, ecoCache, ECO_TTL };
