// 生态缸构建与放生分析管线
// 标注用 zhida-fast-1p5（快、省额度），放生分析用 zhida-thinking-1p5（深度）。
// 所有 LLM 输出强制 JSON 并做健壮解析；解析失败降级为「未标注」，绝不编造数据。

import { searchZhihu, fetchQuestionAnswers, zhidaChat } from './zhihu.js';
import { survivalRule } from './ruleModel.js';

export const STANCES = ['支持', '反对', '中立', '解构', '反讽', '补充'];
export const STRATEGIES = ['数据论证', '情绪共鸣', '故事叙事', '身份站队', '抖机灵', '引用权威'];

// ---------- 工具 ----------

function extractJson(text) {
  // 剥离 ```json 围栏、前后杂文本，取第一个平衡的 JSON 结构
  const cleaned = text.replace(/```(?:json)?/gi, '').trim();
  const start = cleaned.search(/[[{]/);
  if (start === -1) throw new Error('输出中未找到 JSON');
  const open = cleaned[start];
  const close = open === '[' ? ']' : '}';
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return JSON.parse(cleaned.slice(start, i + 1));
    }
  }
  throw new Error('JSON 未闭合');
}

// 标题与查询词的 2-gram 重现率，用于过滤跑题搜索结果
export function relevanceScore(title, query) {
  const grams = (s) => {
    const t = s.replace(/\s+/g, '');
    const set = new Set();
    for (let i = 0; i < t.length - 1; i++) set.add(t.slice(i, i + 2));
    return set;
  };
  const a = grams(query);
  const b = grams(title || '');
  if (a.size === 0) return 0;
  let hit = 0;
  for (const g of a) if (b.has(g)) hit++;
  return hit / a.size;
}

// ---------- 生态缸构建 ----------

const QUESTION_URL_RE = /^https?:\/\/(www\.)?zhihu\.com\/question\/\d+\/?$/;

// 归一化正文：去空白与常见标点（跨接口匹配用）
function normText(text) {
  return String(text || '').replace(/[\s，。、？！：；“”‘’（）【】《》「」·…—,.:;?!()[\]{}"']/g, '');
}

// 最长公共子串长度（搜索摘要为查询偏置片段，只能用 LCS 做同一回答判定）
function lcsLen(a, b) {
  let best = 0;
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      let k = 0;
      while (i + k < a.length && j + k < b.length && a[i + k] === b[j + k]) k++;
      if (k > best) best = k;
    }
  }
  return best;
}

// 同一回答判定阈值：20 个连续相同汉字，误配概率可忽略
const LCS_THRESHOLD = 20;

// 双通道数据源：
//  A) 问题 URL → question_answers 直取该问题下的回答（2026-09-13 实测可用），再用知乎搜索富化赞同数等字段
//  B) 仅标题 → 知乎搜索汇聚相关回答样本（相关性过滤）
export async function buildEcosystem(question, questionUrl) {
  const trimmedUrl = typeof questionUrl === 'string' ? questionUrl.trim() : '';

  if (trimmedUrl && QUESTION_URL_RE.test(trimmedUrl)) {
    const { items } = await fetchQuestionAnswers(trimmedUrl, 0, 10);
    if (items.length === 0) {
      return { question, source: 'live', createdAt: Date.now(), species: [], narrative: '', note: '该问题下暂未获取到回答' };
    }
    // 富化：question_answers 无赞同数字段，用知乎搜索同题结果做 LCS 匹配
    //（20+ 连续相同汉字才判定为同一回答，保证赞同数可溯源；失败不阻断，能量按热序近似）
    let searchItems = [];
    try {
      searchItems = await searchZhihu(question, 10);
    } catch {
      // 搜索额度耗尽或失败 → 仅用 question_answers 基础字段
    }
    const sNorm = searchItems.map((s) => ({ s, txt: normText(s.excerpt).slice(0, 200) }));
    const findEnrich = (excerpt) => {
      const a = normText(excerpt).slice(0, 120);
      if (a.length < 20) return null;
      for (const { s, txt } of sNorm) {
        if (lcsLen(a, txt) >= LCS_THRESHOLD) return s;
      }
      return null;
    };
    const shaped = items.map((it) => {
      const e = findEnrich(it.excerpt);
      return {
        id: it.id,
        title: question,
        excerpt: it.excerpt.slice(0, 300),
        author: e?.author || '知乎用户',
        badgeText: e?.badgeText || '',
        authority: e?.authority || 1,
          votes: e ? e.votes : null, // null = 能量按热序近似
          enriched: !!e,
          comments: e ? e.comments : 0,
        editTime: e ? e.editTime : 0,
        url: it.url,
        featuredComments: e ? e.featuredComments : [],
      };
    });
    const species = await annotateSpecies(question, shaped);
    // question_answers 返回顺序 ≈ 相关性/热度序，作为无赞同数时的能量近似
    species.forEach((s, i) => (s.heatRank = species.length - i));
    return {
      question,
      questionUrl: trimmedUrl,
      source: 'live',
      dataSource: 'question_answers',
      createdAt: Date.now(),
      species,
      narrative: buildNarrative(question, species),
    };
  }

  // 通道 B：关键词搜索汇聚
  const raw = await searchZhihu(question, 10);

  // 相关性过滤：2-gram 重现率 >= 0.25 视为同题；不足 3 条时放宽取前 6
  const scored = raw
    .map((it) => ({ ...it, relevance: relevanceScore(it.title, question) }))
    .sort((x, y) => y.relevance - x.relevance);
  let picked = scored.filter((it) => it.relevance >= 0.25);
  if (picked.length < 3) picked = scored.slice(0, 6);

  if (picked.length === 0) {
    return { question, source: 'live', createdAt: Date.now(), species: [], narrative: '', note: '搜索未返回可用回答' };
  }

  const annotated = await annotateSpecies(question, picked);

  const species = annotated.map((it) => ({
    id: String(it.id),
    title: it.title,
    excerpt: it.excerpt.slice(0, 300),
    author: it.author,
    badgeText: it.badgeText,
    authority: it.authority,
    votes: it.votes,
    comments: it.comments,
    editTime: it.editTime,
    url: it.url,
    featuredComments: it.featuredComments,
    stance: it.stance,
    strategy: it.strategy,
    summary: it.summary || '',
    annotationSource: it.annotationSource,
    heatRank: 0,
  }));
  // 能量近似序：赞同数缺失时按 heatRank
  const byVotes = [...species].sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0));
  byVotes.forEach((s, i) => (s.heatRank = species.length - i));

  return {
    question,
    source: 'live',
    createdAt: Date.now(),
    species,
    narrative: buildNarrative(question, species),
  };
}

async function annotateSpecies(question, items) {
  const payload = items.map((it, i) => ({
    n: i,
    excerpt: it.excerpt.slice(0, 180),
    votes: it.votes,
    comments: it.comments,
  }));
  const sys = [
    '你是观点生态分析师。用户给你一个知乎问题与该问题下若干回答的摘要（含赞同数/评论数）。',
    `对每条回答输出两个标注维度：stance（立场）只能取：${STANCES.join('、')}；strategy（生存策略）只能取：${STRATEGIES.join('、')}。`,
    '并给出一句话 summary（不超过 20 字，概括该回答的核心主张）。',
    '严格只输出 JSON 数组，格式：[{"n":0,"stance":"…","strategy":"…","summary":"…"}, …]，不要任何其他文字或代码围栏。',
  ].join('\n');
  const user = `问题：${question}\n回答列表：${JSON.stringify(payload)}`;

  // 直答额度极稀缺（实测 2 次/日）：标注只尝试一次，失败直接降级为未标注，把余量留给放生分析
  try {
    const text = await zhidaChat('zhida-fast-1p5', [
      { role: 'system', content: sys },
      { role: 'user', content: user },
    ]);
    const arr = extractJson(text);
    if (!Array.isArray(arr)) throw new Error('非数组');
    return items.map((it, i) => {
      const hit = arr.find((o) => Number(o?.n) === i);
      const stance = STANCES.includes(hit?.stance) ? hit.stance : null;
      const strategy = STRATEGIES.includes(hit?.strategy) ? hit.strategy : null;
      return {
        ...it,
        stance: stance || '中立',
        strategy: strategy || '数据论证',
        summary: typeof hit?.summary === 'string' ? hit.summary.slice(0, 30) : '',
        annotationSource: stance && strategy ? 'ai' : 'none',
      };
    });
  } catch {
    // 降级：保留真实数据，仅标注缺失，不编造
    return items.map((it) => ({
      ...it,
      stance: '中立',
      strategy: '数据论证',
      summary: '',
      annotationSource: 'none',
    }));
  }
}

function buildNarrative(question, species) {
  // 生态剖面叙事用本地模板生成（零直答消耗），数据全部来自真实标注
  if (!species.length) return '';
  const byStance = {};
  for (const s of species) byStance[s.stance] = (byStance[s.stance] || 0) + 1;
  const dominant = Object.entries(byStance).sort((a, b) => b[1] - a[1])[0];
  const top = [...species].sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0))[0];
  const byStrategy = {};
  for (const s of species) byStrategy[s.strategy] = (byStrategy[s.strategy] || 0) + 1;
  const bestStrategy = Object.entries(byStrategy).sort((a, b) => b[1] - a[1])[0];
  return [
    `「${question}」的生态缸中采集到 ${species.length} 个观点物种。`,
    `${dominant ? `优势立场是「${dominant[0]}」（${dominant[1]} 个物种）；` : ''}`,
    top ? `当前能量最高的是「${top.strategy}」型回答（${top.votes ?? '热序'} 赞同）${top.summary ? `：${top.summary}。` : '。'}` : '',
    bestStrategy ? `本问题下最常见的生存策略是「${bestStrategy[0]}」——在这个生态位，它比其他策略更容易存活。` : '',
  ].join('');
}

// ---------- 放生实验 ----------

export async function analyzeRelease(question, species, draft) {
  // 1) 直答深度分析
  const brief = species.map((s) => ({
    stance: s.stance,
    strategy: s.strategy,
    votes: s.votes,
    summary: s.summary || s.excerpt.slice(0, 60),
  }));
  const sys = [
    '你是观点生态模拟器。给定一个知乎问题、当前回答生态（立场/策略/赞同数）与用户要「放生」的新回答草稿。',
    '请模拟这段草稿在该生态中的命运，严格只输出 JSON 对象，不要任何其他文字或代码围栏，格式：',
    '{"stance":"支持|反对|中立|解构|反讽|补充","strategy":"数据论证|情绪共鸣|故事叙事|身份站队|抖机灵|引用权威","summary":"新回答一句话主张(<=20字)","suppressedBy":"最可能压制它的现有物种描述","risks":["风险1","风险2"],"attractComments":["可能收到的评论1","评论2"],"hybridAdvice":["具体可操作的改写建议1","建议2"],"narrative":"一句话命运判词"}',
  ].join('\n');
  const user = `问题：${question}\n当前生态：${JSON.stringify(brief)}\n用户草稿：${draft.slice(0, 1500)}`;

  let ai = null;
  try {
    const text = await zhidaChat('zhida-thinking-1p5', [
      { role: 'system', content: sys },
      { role: 'user', content: user },
    ]);
    const obj = extractJson(text);
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) ai = obj;
  } catch (e) {
    // 直答失败 → 纯规则模型兜底，仍可交付（标注来源）
  }

  // 2) 透明规则模型（与 AI 结果按 6:4 混合）
  const rule = survivalRule(species, {
    stance: ai?.stance || '中立',
    strategy: ai?.strategy || '数据论证',
  });

  const aiP = Number.isFinite(Number(ai?.survivalProbability)) ? Math.max(0, Math.min(100, Number(ai.survivalProbability))) : null;
  const finalP = aiP === null ? rule.probability : Math.round(aiP * 0.6 + rule.probability * 0.4);

  return {
    stance: ai?.stance || rule.stance,
    strategy: ai?.strategy || rule.strategy,
    summary: ai?.summary || '（AI 分析不可用，以下为规则模型结果）',
    survivalProbability: finalP,
    ruleProbability: rule.probability,
    aiProbability: aiP,
    suppressedBy: ai?.suppressedBy || rule.suppressedBy,
    risks: Array.isArray(ai?.risks) ? ai.risks.slice(0, 4) : rule.risks,
    attractComments: Array.isArray(ai?.attractComments) ? ai.attractComments.slice(0, 3) : [],
    hybridAdvice: Array.isArray(ai?.hybridAdvice) ? ai.hybridAdvice.slice(0, 4) : rule.advice,
    narrative: ai?.narrative || rule.narrative,
    analysisSource: ai ? 'ai+rule' : 'rule-only',
    simulatedAt: Date.now(),
  };
}

// 透明存活概率模型见 ruleModel.js（公式在 UI 中展示）
