// 生态缸构建与放生分析管线
// 逐条判别不能依赖检索问答的输出格式，因此本地标注与可选的直答叙事分开。

import { searchZhihu, fetchQuestionAnswers, zhidaChat } from './zhihu.js';
import { survivalRule } from './ruleModel.js';
import { annotateAll, annotateOne } from './annotator.js';

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
export async function buildEcosystem(question, questionUrl, options = {}) {
  // 数据获取也提供替身入口，测试才能覆盖整个构建流程而不消耗任何上游额度。
  const { search = searchZhihu, answers = fetchQuestionAnswers } = options;
  const trimmedUrl = typeof questionUrl === 'string' ? questionUrl.trim() : '';

  if (trimmedUrl && QUESTION_URL_RE.test(trimmedUrl)) {
    const { items } = await answers(trimmedUrl, 0, 10);
    if (items.length === 0) {
      // 空缸同样返回完整契约，前端不需要猜测字段缺失是否代表 AI 出错。
      return completeEcosystem({ question, questionUrl: trimmedUrl, source: 'live', dataSource: 'question_answers', createdAt: Date.now(), species: [], note: '该问题下暂未获取到回答' }, options);
    }
    // 富化：question_answers 无赞同数字段，用知乎搜索同题结果做 LCS 匹配
    //（20+ 连续相同汉字才判定为同一回答，保证赞同数可溯源；失败不阻断，能量按热序近似）
    let searchItems = [];
    try {
      searchItems = await search(question, 10);
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
    const { items: species, annotationWarning } = annotateSpecies(question, shaped);
    // question_answers 返回顺序 ≈ 相关性/热度序，作为无赞同数时的能量近似
    species.forEach((s, i) => (s.heatRank = species.length - i));
    return completeEcosystem({
      question,
      questionUrl: trimmedUrl,
      source: 'live',
      dataSource: 'question_answers',
      createdAt: Date.now(),
      species,
      annotationWarning,
    }, options);
  }

  // 通道 B：关键词搜索汇聚
  const raw = await search(question, 10);

  // 相关性过滤：2-gram 重现率 >= 0.25 视为同题；不足 3 条时放宽取前 6
  const scored = raw
    .map((it) => ({ ...it, relevance: relevanceScore(it.title, question) }))
    .sort((x, y) => y.relevance - x.relevance);
  let picked = scored.filter((it) => it.relevance >= 0.25);
  if (picked.length < 3) picked = scored.slice(0, 6);

  if (picked.length === 0) {
    // 搜索失败与搜索成功但无结果不同，后者可以安全返回一个完整的空缸。
    return completeEcosystem({ question, source: 'live', dataSource: 'search', createdAt: Date.now(), species: [], note: '搜索未返回可用回答' }, options);
  }

  // 证据必须能在展示摘要中找到，两个入口都先截断再标注，避免隐藏后文决定标签。
  const { items: annotated, annotationWarning } = annotateSpecies(question, picked.map(it => ({ ...it, excerpt: it.excerpt.slice(0, 300) })));

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
    confidence: it.confidence,
    evidence: it.evidence,
    heatRank: 0,
  }));
  // 能量近似序：赞同数缺失时按 heatRank
  const byVotes = [...species].sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0));
  byVotes.forEach((s, i) => (s.heatRank = species.length - i));

  return completeEcosystem({
    question,
    source: 'live',
    dataSource: 'search',
    createdAt: Date.now(),
    species,
    annotationWarning,
  }, options);
}

// 本地标签不再依赖检索问答的输出格式，避免一次直答失败把整缸变成同一类。
function annotateSpecies(question, items) {
  const result = annotateAll(question, items);
  return { ...result, items: result.items.map(item => ({ ...item, summary: item.summary || '', annotationSource: 'local-heuristic' })) };
}

// 解析只生成附加视图；格式漂移时不能丢掉已经付额度取得的叙事原文。
export function parseAiNarrative(text) {
  const empty = { aiFactions: null, aiDominant: null };
  if (typeof text !== 'string' || !text.trim()) return empty;
  // 部分留证文本保留字面量换行，只在解析副本展开，不改变 aiNarrative。
  const normalized = text.replace(/\\n/g, '\n').replace(/\r\n/g, '\n');
  // 附录 A 的已验证 prompt 产出的标题允许“##一、”无空格写法，[ \t]* 容忍这类轻微排版漂移。
  const sections = [...normalized.matchAll(/^##[ \t]*([^\n]+)\n?/gm)];
  const factions = [];
  let dominant = null;
  for (let i = 0; i < sections.length; i++) {
    const heading = sections[i][1].trim();
    const body = normalized.slice(sections[i].index + sections[i][0].length, sections[i + 1]?.index ?? normalized.length).trim();
    // 优势结论不是一个派系，独立提取避免它被计入派系数量。
    if (/^(?:哪派最占上风|谁最占上风|占上风)/.test(heading)) {
      dominant = body.slice(0, 200) || null;
      continue;
    }
    const title = heading.match(/^(?:[一二三四五六七八九十]+、|\d+[.、])\s*(.+)$/);
    if (!title) continue;
    const name = title[1].split(/["“「]/)[0].replace(/[：:\s]+$/, '').trim();
    if (!name) continue;
    // 字段内部可以有加粗短语，结束边界必须是段落或下一个完整字段标签。
    const field = (label, limit) => {
      const match = body.match(new RegExp('\\*\\*' + label + '\\*\\*[：:][ \\t]*([\\s\\S]*?)(?=\\n[ \\t]*\\n|\\n[ \\t]*\\*\\*(?:代表观点|说服方式)\\*\\*[：:]|$)'));
      return match ? match[1].trim().slice(0, limit) : '';
    };
    factions.push({ name, claim: field('代表观点', 120), persuasion: field('说服方式', 80) });
  }
  return { aiFactions: factions.length ? factions : null, aiDominant: dominant };
}

// 单次失败只影响可选叙事，本地标注和模板已经足够组成可用生态缸。
export async function explainEcosystem(question, species, options = {}) {
  const empty = { aiNarrative: null, aiNarrativeSource: null, aiFactions: null, aiDominant: null };
  if (!species.length || options.includeAi === false) return empty;
  const { chat = zhidaChat, fetchImpl } = options;
  const prompt = `在知乎问题「${question}」下，目前主要存在哪几种不同立场的观点？
每一派分别靠什么方式说服读者——是摆数据、讲个人经历、调动情绪、诉诸身份认同、引用权威，还是靠抖机灵？
请分派说明，并指出哪一派目前最占上风。`;
  try {
    const text = await chat('zhida-thinking-1p5', [{ role: 'user', content: prompt }], { fetchImpl });
    if (typeof text !== 'string' || !text.trim()) throw new Error('直答返回缺少 content');
    return { aiNarrative: text, aiNarrativeSource: 'zhida-thinking-1p5', ...parseAiNarrative(text) };
  } catch (error) {
    return { ...empty, aiNarrativeError: error instanceof Error ? error.message : '直答解说失败' };
  }
}

// 两条采集通道共用收尾，避免 AI 出错时遗漏本地叙事或空值字段。
async function completeEcosystem(tank, options) {
  return { ...tank, narrative: buildNarrative(tank.question, tank.species), annotationWarning: tank.annotationWarning ?? null, ...await explainEcosystem(tank.question, tank.species, options) };
}

// 旧缓存仍可能是全灰物种；仅在内存重标，不联网，也不改写用户的原始留证文件。
export function refreshLocalAnnotations(tank) {
  if (tank.source === 'demo') return tank;
  const { items: species, annotationWarning } = annotateSpecies(tank.question, tank.species || []);
  const aiNarrative = typeof tank.aiNarrative === 'string' && tank.aiNarrative.trim() ? tank.aiNarrative : null;
  return { ...tank, species, annotationWarning, narrative: buildNarrative(tank.question, species), aiNarrative,
    aiNarrativeSource: aiNarrative ? tank.aiNarrativeSource || 'zhida-thinking-1p5' : null, ...parseAiNarrative(aiNarrative) };
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

export async function analyzeRelease(question, species, draft, options = {}) {
  // 数值模型只依赖本地标签，避免 AI 成败让同一草稿的规则概率漂移。
  const annotation = annotateOne(question, { excerpt: draft });
  const rule = survivalRule(species, annotation);
  const { chat = zhidaChat, fetchImpl } = options;
  let aiComment = null;
  if (options.includeAi !== false) {
    // 点评即便碰巧含 JSON，也不能覆盖概率、风险或建议；草稿截断用于控制问答长度。
    const prompt = `如果在知乎问题「${question}」下发布这样一条回答：「${draft.slice(0, 800)}」，
它可能会遭到哪些已有观点的反驳？读者最可能在评论区提出什么质疑？`;
    try {
      const text = await chat('zhida-thinking-1p5', [{ role: 'user', content: prompt }], { fetchImpl });
      if (typeof text === 'string' && text.trim()) aiComment = text;
    } catch {
      // 本地分析已经完成，点评失败不应阻断放生实验。
    }
  }
  return {
    stance: annotation.stance,
    strategy: annotation.strategy,
    summary: draft.slice(0, 30),
    survivalProbability: rule.probability,
    ruleProbability: rule.probability,
    aiProbability: null,
    suppressedBy: rule.suppressedBy,
    risks: rule.risks,
    attractComments: [],
    hybridAdvice: rule.advice,
    narrative: rule.narrative,
    aiComment,
    analysisSource: aiComment === null ? 'rule+local' : 'rule+local+ai',
    simulatedAt: Date.now(),
  };
}

// 透明存活概率模型见 ruleModel.js（公式在 UI 中展示）。
