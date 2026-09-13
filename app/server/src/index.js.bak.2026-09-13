// 观点进化缸 · 服务端入口
// 职责：持有 Access Secret、代理知乎开放平台、构建生态缸、放生分析、额度守卫。
// 未配置 Access Secret 时自动进入「演示数据」模式（前端有醒目标识）。

import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { hasSecret, fetchHot, fetchQuota, zhidaCount, hashKey, ecoCache, ECO_TTL, loadEcoCache, persistEcoCacheEntry, dedup } from './zhihu.js';
import { buildEcosystem, analyzeRelease } from './ecosystem.js';
import { survivalRule } from './ruleModel.js';
import { demoHot, demoEcosystem } from './demoData.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 8787;

// 读取可选 .env（无 dotenv 依赖，保持零轮子）
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const app = express();
app.use(express.json({ limit: '1mb' }));

const live = () => hasSecret();

// 启动时恢复磁盘缓存（服务重启不丢已消耗额度换来的数据）
loadEcoCache();

// 放生分析缓存：同一问题+同一草稿 1 小时内复用，防误触重复消耗直答
const releaseCache = new Map();
const RELEASE_TTL = 60 * 60 * 1000;

app.get('/api/status', (req, res) => {
  res.json({
    liveMode: live(),
    zhidaUsedToday: live() ? zhidaCount() : 0,
    ecoCacheCount: ecoCache.size,
    time: Date.now(),
  });
});

app.get('/api/hot', async (req, res) => {
  if (!live()) return res.json({ ...demoHot, source: 'demo' });
  try {
    const data = await fetchHot();
    if (!data.items.length) {
      // 热榜额度耗尽时官方返回空列表：降级为演示热榜并如实告知
      return res.json({ ...demoHot, source: 'demo', warning: '今日热榜额度已耗尽，以下为演示数据（明日 0 点额度重置）' });
    }
    res.json({ ...data, source: 'live' });
  } catch (e) {
    res.status(502).json({ error: `热榜获取失败：${e.message}`, code: e.code });
  }
});

app.post('/api/ecosystem', async (req, res) => {
  const question = String(req.body?.question || '').trim().slice(0, 120);
  const questionUrl = String(req.body?.url || '').trim().slice(0, 200);
  if (!question) return res.status(400).json({ error: '请提供问题标题' });

  if (!live()) return res.json(demoEcosystem(question));

  const key = hashKey(question + '|' + questionUrl);
  const hit = ecoCache.get(key);
  if (hit && Date.now() - hit.ts < ECO_TTL) {
    return res.json({ ...hit.data, cached: true });
  }
  try {
    // dedup：并发同请求只构建一次
    const data = await dedup(`eco:${key}`, () => buildEcosystem(question, questionUrl));
    if (data.species.length > 0) {
      ecoCache.set(key, { data, ts: Date.now() });
      persistEcoCacheEntry(key, data);
    }
    res.json(data);
  } catch (e) {
    res.status(502).json({ error: `生态缸构建失败：${e.message}`, code: e.code });
  }
});

app.post('/api/release', async (req, res) => {
  const question = String(req.body?.question || '').trim().slice(0, 120);
  const draft = String(req.body?.draft || '').trim().slice(0, 4000);
  const species = Array.isArray(req.body?.species) ? req.body.species : [];
  if (!question || !draft) return res.status(400).json({ error: '需要 question 与 draft' });
  if (draft.length < 20) return res.status(400).json({ error: '草稿太短，至少 20 字再放生' });

  const cacheKey = hashKey(question + '|' + draft);
  const hit = releaseCache.get(cacheKey);
  if (hit && Date.now() - hit.ts < RELEASE_TTL) {
    return res.json({ ...hit.report, cached: true });
  }

  if (!live()) {
    // 演示模式：直接用规则模型（可解释、零额度消耗）
    const rule = survivalRule(species, { stance: '中立', strategy: '数据论证' });
    const report = {
      stance: rule.stance,
      strategy: rule.strategy,
      summary: '（演示模式：规则模型结果）',
      survivalProbability: rule.probability,
      ruleProbability: rule.probability,
      aiProbability: null,
      suppressedBy: rule.suppressedBy,
      risks: rule.risks,
      attractComments: ['（演示数据）这条说到点子上了', '（演示数据）建议补充数据来源'],
      hybridAdvice: rule.advice,
      narrative: rule.narrative,
      analysisSource: 'rule-only-demo',
      simulatedAt: Date.now(),
    };
    releaseCache.set(cacheKey, { report, ts: Date.now() });
    return res.json(report);
  }

  try {
    const report = await dedup(`release:${cacheKey}`, () => analyzeRelease(question, species, draft));
    releaseCache.set(cacheKey, { report, ts: Date.now() });
    res.json(report);
  } catch (e) {
    res.status(502).json({ error: `放生分析失败：${e.message}`, code: e.code });
  }
});

app.get('/api/quota', async (req, res) => {
  if (!live()) return res.json({ liveMode: false, items: [] });
  try {
    res.json({ liveMode: true, items: await fetchQuota() });
  } catch (e) {
    res.status(502).json({ error: `额度查询失败：${e.message}` });
  }
});

// 生产模式：托管前端构建产物（SPA 回退）
const distDir = path.join(__dirname, '..', '..', 'web', 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get(/^(?!\/api\/).*/, (req, res) => res.sendFile(path.join(distDir, 'index.html')));
}

app.listen(PORT, () => {
  const mode = live() ? 'LIVE（知乎开放平台）' : 'DEMO（演示数据）';
  console.log(`[观点进化缸] http://localhost:${PORT} · 模式: ${mode}`);
});
