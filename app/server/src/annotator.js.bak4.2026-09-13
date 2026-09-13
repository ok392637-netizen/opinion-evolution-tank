export const STANCES = ['支持', '反对', '中立', '解构', '反讽', '补充'];
export const STRATEGIES = ['数据论证', '情绪共鸣', '故事叙事', '身份站队', '抖机灵', '引用权威'];

const QUESTION_PATTERNS = [
  {
    type: 'judgement',
    patterns: ['如何看待', '怎么看', '是不是', '该不该', '值不值', '算不算', '对不对', /吗[？?]?$/],
  },
  {
    type: 'why',
    patterns: ['为什么', '为何', '原因', '是何原因'],
  },
  {
    type: 'howto',
    patterns: [/如何.+/, '怎么办', '怎样', '有哪些', '推荐'],
  },
];

// 词典按语言现象分组：同一类词不是同义词表，而是中文知乎回答里常见的表态、转向和修辞信号。
const STANCE_FEATURES = {
  反对: [
    feature('不敢苟同', 3.2, '显式否定对方观点'),
    feature('并非', 1.4, '解释中常用的反向限定'),
    feature('未必', 1.3, '弱否定会降低原命题确定性'),
    feature('恰恰相反', 2.8, '直接反转原命题'),
    feature('我不信', 3.2, '第一人称不采信'),
    feature('不靠谱', 3, '口语化否定判断'),
    feature('站不住脚', 2.8, '论证有效性否定'),
    feature('纯属', 1.8, '贬低式归因'),
    feature('所谓的', 1.8, '对概念合法性降格'),
    feature('翻译一下就是', 2.2, '把漂亮叙事还原成负面含义'),
    feature('说得好听', 2.2, '识别包装话术'),
    feature('有些不同看法', 2.2, '温和反对在知乎长答里很常见'),
    feature('很难让人感动', 2.2, '否定情怀包装的说服力'),
    feature('评论区早炸了', 1.6, '借公众反应表达反对'),
    feature(/不可能|不能|不是|没有意义|无意义/g, 0.9, '高频否定推动反对分'),
  ],
  支持: [
    feature('确实', 1.8, '确认前文判断'),
    feature('的确', 1.8, '确认前文判断'),
    feature('没错', 2.4, '直接同意'),
    feature('说得对', 2.6, '直接同意'),
    feature('同意', 2.4, '直接同意'),
    feature('我赞成', 3, '显式站队'),
    feature('值得肯定', 2.8, '正向评价'),
    feature('已经属于', 2.1, '把行为纳入正面范畴'),
    feature('属实是好事', 3, '明确正向结论'),
    feature('承担社会责任', 2.6, '替被评价对象辩护'),
    feature('更好', 1.8, '比较型支持常通过优劣判断出现'),
    feature('一定是', 1.5, '强断言通常服务于站队'),
    feature('不再认同', 1.4, '在归因题中常用于认同题干里的反感对象'),
    feature('拒绝', 1.1, '归因题里会用拒绝复述题干立场'),
    feature('反感', 1.1, '归因题里会用反感复述题干立场'),
  ],
  解构: [
    feature('这个问题本身', 3, '把讨论对象转移到问题框架'),
    feature('伪命题', 3, '否定题目成立方式'),
    feature('问错了', 3, '直接重设问题'),
    feature('真正的问题是', 3, '显式重构讨论焦点'),
    feature('换个角度', 2.4, '提示框架切换'),
    feature('先别急着', 2.1, '延迟站队以重设前提'),
    feature('我们先定义', 2.6, '先定义说明回答在拆概念'),
    feature('本质原因是什么', 2.8, '把表层事件转为原因分析'),
    feature('本质上是', 2.4, '抽象出底层机制'),
    feature('拆解一下', 2.8, '明确进入拆解姿态'),
    feature('其实是', 2.2, '把表象翻译成另一套机制'),
    feature('原因很简单', 1.4, '归因式改写常从这里进入'),
    feature('哪个好听一点', 2.6, '用措辞比较揭穿框架包装'),
    feature('阳谋', 1.8, '将事件解释成策略安排'),
    feature('先来看', 1.2, '结构化拆解的开场信号'),
  ],
  反讽: [
    feature('懂的都懂', 3.2, '社媒反讽固定表达'),
    feature('多谢款待', 3, '以感谢包装负面评价'),
    feature('狗头', 2.8, '中文互联网反讽标记'),
    feature('学会了', 2.7, '把坏做法说成经验学习'),
    feature('支个招', 2.7, '用建议姿态包裹嘲讽'),
    feature('熟悉的配方', 2.8, '梗式套话通常带嘲讽'),
    feature(/[“"「](格局大|情怀|高效|遥遥领先)[”"」]/g, 2.6, '引号包裹褒义词常表示反话'),
    feature(/[？！?!]{2,}/g, 1.6, '强情绪标点常与反讽共现'),
    feature(/(高效|先进|领先|格局大|情怀).{0,24}(不|没|无|却|只是|直接用外包)/g, 2.2, '褒义词后接否定会形成反语'),
  ],
  补充: [
    feature('补充一点', 3, '显式补充已有答案'),
    feature('另外', 2.3, '追加维度'),
    feature('顺便', 2.2, '顺手扩展讨论'),
    feature('还有一个角度', 3, '显式增加视角'),
    feature('以上答案', 2.6, '站在既有回答之后补足'),
    feature('没人提到', 2.8, '指出遗漏'),
    feature('我再说一个', 2.8, '追加案例'),
    feature('对比一下', 2.4, '用参照系补充说明'),
    feature('应对方式', 1.7, '横向拿其他主体作补充参照'),
    feature('对上', 1.4, '补充组织内外视角时常见'),
    feature('对内', 1.4, '补充组织内外视角时常见'),
  ],
};

// 策略词典分组围绕“回答靠什么说服人”，权威、数据、叙事、情绪、身份和机锋应彼此竞争。
const STRATEGY_FEATURES = {
  数据论证: [
    feature(/\d+(?:\.\d+)?%?/g, 0.9, '数字密度是算账型回答的主要表层信号'),
    feature(/[一二三四五六七八九十\d]+[、.．]/g, 1.2, '编号列点说明回答在结构化归因'),
    feature(/[万亿倍元]/g, 0.35, '金额量级词会加强数据论证感'),
    feature(/月薪\s*\d+/g, 2.2, '薪资数字通常服务于算账'),
    feature('数据显示', 2.8, '直接引用数据'),
    feature('统计', 2.4, '数据来源或统计口吻'),
    feature('占比', 2.2, '比例论证'),
    feature('平均', 1.8, '统计描述'),
    feature(/根据.{0,12}报告/g, 2.6, '来源化的数据论证'),
    feature('离职率', 2.2, '企业话题里的量化指标'),
    feature('算一笔', 2, '中文长答里的算账提示词'),
    feature('换算', 1.8, '比较成本时常用'),
    feature('计划', 1.1, '事实计划会把回答推向证据说明'),
  ],
  引用权威: [
    feature(/《[^》]{2,40}》/g, 3.6, '书名号常指法律、书籍或正式文件'),
    feature(/第\s*\d+\s*条/g, 3.2, '法条编号比普通数字更能说明引用权威'),
    feature('法律规定', 3, '显式诉诸制度文本'),
    feature('劳动合同法', 3.4, '本题语料里最关键的法律依据'),
    feature('劳动法', 2.8, '劳动权益语境里的权威来源'),
    feature('专家', 2.1, '诉诸专业身份'),
    feature('教授', 2.1, '诉诸专业身份'),
    feature('论文', 2.3, '学术来源'),
    feature('官方', 2.1, '制度或机构来源'),
    feature('白皮书', 2.6, '正式文件来源'),
    feature(/\[\d+\]/g, 2.8, '脚注标记比正文数字更像引用'),
    feature('法律法规', 1.8, '概括性制度依据'),
    feature('法条', 2.6, '明确进入法律文本'),
  ],
  故事叙事: [
    feature(/我.{0,24}(那年|当年|后来|记得|有一次|\d{4}年)/g, 3.2, '第一人称过去时是叙事骨架'),
    feature(/\d{4}年[，,]?\s*我/g, 3.4, '具体年份加第一人称强烈指向故事'),
    feature('那年', 2.2, '回忆叙事时间词'),
    feature('当年', 2.2, '回忆叙事时间词'),
    feature('后来', 1.9, '时间推进'),
    feature('记得', 2.1, '回忆开场'),
    feature('有一次', 2.5, '个案叙事开场'),
    feature(/老[陈王李张刘]|室友|同事|朋友/g, 1.8, '具体人物关系让回答进入故事'),
    feature(/先.{0,40}然后.{0,80}后来/g, 3, '时间推进链'),
    feature(/烤鱼|深圳|实验室|饭桌|房租/g, 1.1, '具体场景细节增强叙事可信度'),
  ],
  情绪共鸣: [
    feature('累', 1.4, '身体感受会把回答推向共鸣'),
    feature('熬', 1.7, '加班语境里的痛感词'),
    feature('心疼', 2.3, '情感认同'),
    feature('委屈', 2.3, '情感认同'),
    feature('愤怒', 2.1, '强情绪表达'),
    feature('无奈', 1.9, '情绪表达'),
    feature('扛不住', 2.3, '身体化压力描述'),
    feature('真心觉得', 2.6, '主观感受显式化'),
    feature('说出了心声', 2.8, '共鸣固定表达'),
    feature('极其反感', 2.4, '强情绪立场'),
    feature('拖垮', 1.8, '伤害感表达'),
    feature('毁掉', 1.8, '后果情绪化'),
    feature('没有价值', 1.3, '价值否定配合情绪动员'),
    feature('我们都', 1.8, '共同体共鸣'),
    feature(/！/g, 0.7, '感叹号增加情绪密度'),
  ],
  身份站队: [
    feature(/作为一个.{1,8}/g, 2.6, '显式身份声明'),
    feature(/我们.{1,4}人/g, 2.2, '群体身份自称'),
    feature('打工人', 2.4, '中文职场身份标签'),
    feature('985', 3, '学历身份边界'),
    feature('211', 3, '学历身份边界'),
    feature('文科生', 2.5, '专业身份标签'),
    feature('过来人', 2.3, '经验身份标签'),
    feature('在单位待久了', 2.4, '组织内部身份视角'),
    feature('同行', 2.2, '行业共同体'),
    feature(/老一辈.{0,40}年轻人|年轻人.{0,40}老一辈/g, 2.7, '代际对立构成站队'),
    feature(/甲方.{0,30}乙方|乙方.{0,30}甲方/g, 2.7, '交易身份对立构成站队'),
    feature(/你能进(腾讯|阿里|美团)吗/g, 2.8, '用平台门槛划定学历群体位置'),
  ],
  抖机灵: [
    feature('熟悉的配方，熟悉的味道', 3.6, '梗式表达优先视作抖机灵'),
    feature('支个招', 2.8, '建议姿态包裹玩笑或嘲讽'),
    feature('阳谋', 2.2, '把复杂事压成梗式解释'),
    feature('降降温', 1.8, '轻巧口语收尾'),
    feature('就这么简单', 1.9, '短促断言形成机锋'),
    feature('遥遥领先', 2.4, '社媒梗词'),
    feature(/[（(][^）)]{2,24}[）)]/g, 1.4, '括号吐槽强化机锋感'),
  ],
};

export function classifyQuestion(title) {
  const text = String(title || '');
  for (const group of QUESTION_PATTERNS) {
    const matched = group.patterns.filter((pattern) => patternMatches(pattern, text)).map(patternLabel);
    if (matched.length) return { type: group.type, matched };
  }
  return { type: 'open', matched: [] };
}

export function annotateOne(question, item, ctx = {}) {
  const questionType = normalizeQuestionType(ctx.questionType || classifyQuestion(question));
  const stanceText = String(item?.excerpt || '');
  const strategyText = [item?.excerpt, item?.badgeText].filter(Boolean).join('\n');
  const stanceScores = scoreFeatures(stanceText, STANCE_FEATURES);
  const strategyScores = scoreFeatures(strategyText, STRATEGY_FEATURES);

  addDerivedSignals(stanceText, strategyText, stanceScores, strategyScores);
  applyQuestionPrior(questionType, stanceScores);
  // 反讽必须依赖组合语境；单个梗词容易只是普通口语，两个以上信号才允许它参与竞争。
  if ((stanceScores.hits.反讽 || []).length < 2) stanceScores.scores.反讽 = 0;
  applyMutualExclusion(strategyScores);

  const stancePick = pickWinner(stanceScores.scores, '中立', 1.15);
  const strategyPick = pickWinner(strategyScores.scores, '数据论证', 0.35);
  let stance = stancePick.label;
  const strategy = strategyPick.label;

  const stanceConf = confidenceFor(stancePick, stanceScores.hits[stance] || []);
  const strategyConf = confidenceFor(strategyPick, strategyScores.hits[strategy] || []);
  const confidence = round3(Math.min(stanceConf, strategyConf));
  const lowConfidence = confidence < 0.15;

  if (lowConfidence) stance = '中立';

  return {
    stance,
    strategy,
    confidence,
    evidence: {
      stance: lowConfidence ? [{ term: '特征不足', weight: 0 }] : topEvidence(stanceScores.hits[stance] || []),
      strategy: topEvidence(strategyScores.hits[strategy] || []),
    },
  };
}

export function annotateAll(question, items) {
  const questionType = classifyQuestion(question);
  const annotated = (items || []).map((item) => ({
    ...item,
    ...annotateOne(question, item, { questionType }),
    annotationSource: 'local-heuristic',
  }));

  return {
    items: annotated,
    annotationWarning: distributionWarning(annotated),
  };
}

function feature(pattern, weight, note) {
  return { pattern, weight, note };
}

function normalizeQuestionType(questionType) {
  // 调用方可能为了省一次 classifyQuestion 只传字符串；归一化能避免同一先验在集成层失效。
  if (typeof questionType === 'string') return { type: questionType, matched: [] };
  return questionType && typeof questionType === 'object' ? questionType : { type: 'open', matched: [] };
}

function applyQuestionPrior(questionType, stanceScores) {
  // 先验必须在派生特征之后统一施加；否定密度也是 stance 证据，不能绕过 why/howto 衰减。
  if (questionType.type !== 'why' && questionType.type !== 'howto') return;
  scaleLabel(stanceScores, '支持', 0.55);
  scaleLabel(stanceScores, '反对', 0.55);
}

function scaleLabel(scored, label, ratio) {
  // evidence 给前端看的是最终依据，所以权重需要跟随先验衰减，而不是保留原始词典分。
  scored.scores[label] = round3(scored.scores[label] * ratio);
  scored.hits[label] = (scored.hits[label] || []).map((hit) => ({ ...hit, weight: round3(hit.weight * ratio) }));
}

function patternMatches(pattern, text) {
  if (typeof pattern === 'string') return text.includes(pattern);
  pattern.lastIndex = 0;
  return pattern.test(text);
}

function patternLabel(pattern) {
  return typeof pattern === 'string' ? pattern : pattern.source;
}

function scoreFeatures(text, dictionary) {
  const scores = Object.fromEntries(Object.keys(dictionary).map((label) => [label, 0]));
  const hits = Object.fromEntries(Object.keys(dictionary).map((label) => [label, []]));

  for (const [label, features] of Object.entries(dictionary)) {
    for (const { pattern, weight, note } of features) {
      const matches = findMatches(pattern, text);
      if (!matches.length) continue;
      const capped = matches.slice(0, 4);
      const contribution = round3(weight * capped.length);
      scores[label] += contribution;
      hits[label].push({ term: capped.join(' / '), weight: contribution, note });
    }
  }

  return { scores, hits };
}

function findMatches(pattern, text) {
  // 正则 source 对用户没有解释价值；保留真实命中文本才能支撑“可解释标注”的产品承诺。
  if (!text) return [];
  if (typeof pattern === 'string') {
    const matches = [];
    let index = text.indexOf(pattern);
    while (index !== -1) {
      matches.push(pattern);
      index = text.indexOf(pattern, index + pattern.length);
    }
    return matches;
  }

  const source = pattern.global ? pattern : new RegExp(pattern.source, `${pattern.flags}g`);
  source.lastIndex = 0;
  return [...text.matchAll(source)].map((match) => match[0]);
}

function addDerivedSignals(stanceText, strategyText, stanceScores, strategyScores) {
  const lengthBase = Math.max(1, [...stanceText].length / 100);
  const negationDensity = (stanceText.match(/[不没别无]/g) || []).length / lengthBase;
  if (negationDensity > 3) addHit(stanceScores, '反对', '否定副词密度>3/百字', 1.4);

  const sentences = strategyText.split(/[。！？!?\n]+/).map((s) => s.trim()).filter(Boolean);
  const avgSentenceLength = sentences.length ? sentences.reduce((sum, s) => sum + [...s].length, 0) / sentences.length : 999;
  if (avgSentenceLength < 18 && /但|却|不过|那就|这样|直接/.test(strategyText)) {
    addHit(strategyScores, '抖机灵', '短句+转折收尾', 2.2);
  }

  if (/我|我们/.test(strategyText) && /(那年|当年|后来|记得|有一次|\d{4}年)/.test(strategyText)) {
    addHit(strategyScores, '故事叙事', '第一人称+过去时间', 2.8);
  }

  if (
    /我|我们/.test(strategyText) &&
    /(老[陈王李张刘]|室友|同事|朋友|同学|老师|老板)/.test(strategyText) &&
    /(北京|上海|广州|深圳|成都|杭州|武汉|西安|南京|元|块|月薪|工资)/.test(strategyText)
  ) {
    addHit(strategyScores, '故事叙事', '第一人称+人物地点金额同现', 2.6);
  }

  if (/建议.{0,16}(直接|全部|都|一律|干脆|外包|辞退|开除|躺平)/.test(strategyText)) {
    addHit(strategyScores, '抖机灵', '荒诞建议', 2.4);
  }

  if (/(心薪|薪心|班味|卷王|摸鱼)/.test(strategyText)) {
    addHit(strategyScores, '抖机灵', strategyText.match(/心薪|薪心|班味|卷王|摸鱼/)?.[0] || '谐音/双关', 2.2);
  }
}

function applyMutualExclusion(strategyScores) {
  // 法条、书名号和脚注是来源结构，不只是普通数字；共现时提高权威侧避免被数字密度吞掉。
  if (strategyScores.scores.引用权威 > 0 && strategyScores.scores.数据论证 > 0) {
    const hasHardAuthority = (strategyScores.hits.引用权威 || []).some((hit) =>
      /《|第\s*\d+\s*条|劳动合同法|劳动法|\[\d+\]|法律|法条/.test(hit.term),
    );
    if (hasHardAuthority) ensurePriority(strategyScores, '引用权威', '数据论证', '权威来源优先');
  }

  // 亲历时间线比情绪词更能解释说服方式；强叙事存在时不让痛感词抢走类别。
  if (strategyScores.scores.故事叙事 >= 4 && strategyScores.scores.情绪共鸣 > 0) {
    ensurePriority(strategyScores, '故事叙事', '情绪共鸣', '亲历叙事优先');
  }

  if (strategyScores.scores.身份站队 >= 5 && strategyScores.scores.数据论证 > 0) {
    strategyScores.scores.身份站队 += 1.2;
  }
}

function addHit(scored, label, term, weight) {
  scored.scores[label] += weight;
  scored.hits[label].push({ term, weight, note: '组合特征比单个词更能说明语用功能' });
}

function ensurePriority(scored, winner, loser, reason) {
  // 互斥规则是硬约束；只加固定小分无法覆盖数字极多或情绪极多的对抗文本。
  const gap = scored.scores[loser] - scored.scores[winner] + 0.001;
  const bonus = round3(Math.max(0, gap));
  scored.scores[winner] = round3(Math.max(scored.scores[winner], scored.scores[loser] + 0.001));
  boostTopHit(scored, winner, bonus, reason);
}

function boostTopHit(scored, label, bonus, reason) {
  // 把优先修正落到最强真实证据上，避免 evidence 展示一个看不见的“隐形加分”。
  if (!bonus) return;
  const hits = scored.hits[label] || [];
  if (!hits.length) return;
  hits.sort((a, b) => b.weight - a.weight);
  hits[0] = { ...hits[0], weight: round3(hits[0].weight + bonus), note: `${hits[0].note}；${reason}` };
}

function pickWinner(scores, fallback, threshold) {
  // 阈值让弱命中回到默认类，避免一个孤立低权重词决定整条回答的物种类型。
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [topLabel, topScore] = sorted[0] || [fallback, 0];
  const [, secondScore] = sorted[1] || [fallback, 0];
  if (topScore < threshold) return { label: fallback, topScore: 0, secondScore: topScore };
  return { label: topLabel, topScore, secondScore };
}

function confidenceFor(pick, hits) {
  // 置信度看“领先幅度”和“证据数量”，单一词命中即使分高也不该显得特别确定。
  if (!pick.topScore || !hits.length) return 0;
  const margin = Math.max(0, (pick.topScore - pick.secondScore) / (pick.topScore + 1e-6));
  const hitFactor = Math.min(1, hits.length / 3);
  return margin * hitFactor;
}

function topEvidence(hits) {
  // 同一段文本可能被多个特征命中（如《劳动合同法》与“劳动合同法”）；
  // 合并到最长命中文本并累加权重，前端看到的才是“这一段文字总共贡献了多少证据”，
  // 而不是两条看似独立、实则重叠的证据。
  const merged = [];
  for (const hit of [...hits].sort((a, b) => b.term.length - a.term.length || b.weight - a.weight)) {
    const host = merged.find((kept) => kept.term.includes(hit.term));
    if (host) host.weight = round3(host.weight + hit.weight);
    else merged.push({ ...hit });
  }
  // 只返回前五条让 UI 可读；完整调试可从词典和测试复现，不把页面塞成规则转储。
  return merged
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 5)
    .map(({ term, weight }) => ({ term, weight: round3(weight) }));
}

function distributionWarning(items) {
  // 分布坍缩比单条误判更伤产品观感；这里让“全部同色”的系统性失败显性化。
  if (!items.length) return null;
  const stanceWarning = isCollapsed(items, 'stance');
  const strategyWarning = isCollapsed(items, 'strategy');
  if (stanceWarning) return '立场特征稀疏，多数物种落入同一类，标注可信度低';
  if (strategyWarning) return '策略特征稀疏，多数物种落入同一类，标注可信度低';
  return null;
}

function isCollapsed(items, key) {
  // 80% 阈值按整缸观察，不要求每类均匀，只拦截明显退化到单一标签的情况。
  const counts = new Map();
  for (const item of items) counts.set(item[key], (counts.get(item[key]) || 0) + 1);
  return Math.max(...counts.values()) / items.length >= 0.8;
}

function round3(value) {
  // 固定三位小数避免测试和前端展示受浮点尾差影响。
  return Math.round(value * 1000) / 1000;
}
