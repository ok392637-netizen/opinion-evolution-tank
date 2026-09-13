import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildEcosystem } from '../src/ecosystem.js';
import { fetchQuota, hashKey, isEcoCacheEntryReady } from '../src/zhihu.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DATA_DIR = path.join(__dirname, '..', 'data');

// 串行预构建要给上游额度系统留缓冲，避免连续请求被误判为突发流量。
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 预构建资产可能尚未生成，缺文件时返回空数组能让脚本从空状态安全启动。
async function readJsonArray(file, fallback = []) {
  try {
    const parsed = JSON.parse(await fs.readFile(file, 'utf8'));
    return Array.isArray(parsed) ? parsed : fallback;
  } catch (error) {
    if (error?.code === 'ENOENT') return fallback;
    throw error;
  }
}

async function ensureQuestionFile(file) {
  try {
    await fs.access(file);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
    // 问题清单缺失时只创建空数组模板，避免脚本第一次运行因为目录资产未准备而失败。
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, '[]', 'utf8');
  }
}

// quota 返回是按 APIID 平铺的数组，集中解析可以让“不足哪个额度”报告更明确。
function remainingOf(quotaItems, apiId) {
  const item = quotaItems.find((quota) => quota?.APIID === apiId);
  const remaining = Number(item?.RemainingQuota);
  return Number.isFinite(remaining) ? remaining : null;
}

// QA/search 是构建必需额度，直答只影响 AI 解说，因此两类额度要分开决策。
function quotaDecision(quotaItems) {
  const qa = remainingOf(quotaItems, 'question_answers');
  const search = remainingOf(quotaItems, 'zhihu_search');
  const zhida = remainingOf(quotaItems, 'zhida_openai');
  if (qa !== null && qa <= 0) return { ok: false, includeAi: false, apiId: 'question_answers' };
  if (search !== null && search <= 0) return { ok: false, includeAi: false, apiId: 'zhihu_search' };
  return { ok: true, includeAi: zhida === null || zhida > 0, apiId: null };
}

// 预构建日志要让人工快速判断缸是否退化，分布摘要比完整物种列表更适合终端输出。
function distributions(species, field) {
  const counts = {};
  for (const item of species || []) counts[item[field]] = (counts[item[field]] || 0) + 1;
  return counts;
}

async function savePrebuiltEntry(file, entry) {
  const entries = await readJsonArray(file);
  const next = [entry, ...entries.filter((item) => item.k !== entry.k)];
  // 每个成功缸立刻落盘，脚本中途停止时也能保住已经消耗额度换来的成果。
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(next, null, 2), 'utf8');
}

export async function prebuildTanks({
  dataDir = DEFAULT_DATA_DIR,
  sleepMs = 2000,
  fetchImpl,
  fetchQuotaImpl = (options = {}) => fetchQuota({ ...options, fetchImpl }),
  buildEcosystemImpl = buildEcosystem,
  log = () => {},
} = {}) {
  const questionsFile = path.join(dataDir, 'prebuilt-questions.json');
  const tanksFile = path.join(dataDir, 'prebuilt-tanks.json');
  await ensureQuestionFile(questionsFile);
  const questions = await readJsonArray(questionsFile);
  const existing = await readJsonArray(tanksFile);
  const readyKeys = new Set(existing.filter((entry) => isEcoCacheEntryReady(entry)).map((entry) => entry.k));

  const result = { total: questions.length, saved: 0, skippedCached: 0, stoppedReason: null, message: '' };
  for (const item of questions) {
    const question = String(item?.question || '').trim();
    const url = String(item?.url || '').trim();
    if (!question) continue;
    const key = hashKey(`${question}|${url}`);
    if (readyKeys.has(key)) {
      result.skippedCached += 1;
      log(`SKIP cached ${question}`);
      continue;
    }

    const quotaItems = await fetchQuotaImpl({ fetchImpl });
    const decision = quotaDecision(quotaItems || []);
    if (!decision.ok) {
      result.stoppedReason = 'quota_insufficient';
      result.message = `quota insufficient: ${decision.apiId}`;
      log(result.message);
      break;
    }

    const data = await buildEcosystemImpl(question, url, { fetchImpl, includeAi: decision.includeAi });
    await savePrebuiltEntry(tanksFile, { k: key, ts: Date.now(), data });
    readyKeys.add(key);
    result.saved += 1;
    log(
      [
        `SAVE ${question}`,
        `species=${data?.species?.length || 0}`,
        `stance=${JSON.stringify(distributions(data?.species, 'stance'))}`,
        `strategy=${JSON.stringify(distributions(data?.species, 'strategy'))}`,
        `aiNarrative=${Boolean(data?.aiNarrative)}`,
      ].join(' '),
    );
    if (sleepMs > 0) await sleep(sleepMs);
  }

  if (!result.message) result.message = 'prebuild complete';
  return result;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  prebuildTanks({ log: console.log }).then((result) => {
    console.log(JSON.stringify(result, null, 2));
  }).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
