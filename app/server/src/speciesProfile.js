// 「我的观点画像」构建器：把用户自己的创作逐条喂给已有的 annotator，
// 统计他本人属于哪种观点物种。纯函数、零网络，方便测试直接喂假数据。
// 立场/策略模型与生态缸完全同源（同一个 annotator.js），不新增第二套智能层。

import { annotateOne, STANCES, STRATEGIES } from './annotator.js';

// 与前端 Tank.tsx 的 isStrategyUnidentified 同一条判定线：标注器对完全没命中
// 策略特征的文本会兜底返回「数据论证」，evidence.strategy 为空即说明是兜底而非真判定。
function isUnidentified(annotation) {
  const ev = annotation?.evidence?.strategy || [];
  return ev.length === 0 || ev[0].term === '特征不足';
}

export function buildSpeciesProfile(contents) {
  const items = (Array.isArray(contents) ? contents : []).map((item) => ({
    title: item.title,
    url: item.url,
    // question 用该内容自己的标题：回答的标题就是它所属的问题
    ...annotateOne(item.title || '', { excerpt: item.excerpt || '' }),
  }));

  // 分布先按全量标签初始化为 0，前端直方图不需要猜缺省键
  const stanceDist = Object.fromEntries(STANCES.map((s) => [s, 0]));
  const strategyDist = Object.fromEntries(STRATEGIES.map((s) => [s, 0]));

  let unidentified = 0;
  for (const item of items) {
    stanceDist[item.stance] = (stanceDist[item.stance] || 0) + 1;
    if (isUnidentified(item)) {
      // 兜底标签不算真判定：不计入策略分布，否则「数据论证」会被虚假放大
      unidentified += 1;
    } else {
      strategyDist[item.strategy] = (strategyDist[item.strategy] || 0) + 1;
    }
  }

  // 平票时按词典声明顺序取先出现的，结果稳定可复现（不依赖对象键序之类的隐性行为）
  const dominantOf = (dist, order) => {
    let best = null;
    for (const label of order) {
      if (dist[label] > 0 && (best === null || dist[label] > dist[best])) best = label;
    }
    return best;
  };

  return {
    total: items.length,
    dominantStrategy: dominantOf(strategyDist, STRATEGIES),
    dominantStance: dominantOf(stanceDist, STANCES),
    strategyDist,
    stanceDist,
    // 样本按置信度取前 5：评委/用户最想看的是「判得最肯定」的几条及其依据
    samples: [...items]
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5)
      .map(({ title, url, stance, strategy, confidence, evidence }) => ({ title, url, stance, strategy, confidence, evidence })),
    unidentified,
    analyzedAt: Date.now(),
  };
}
