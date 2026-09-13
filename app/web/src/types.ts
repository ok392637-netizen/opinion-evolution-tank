export const STANCES = ['支持', '反对', '中立', '解构', '反讽', '补充'] as const;
export const STRATEGIES = ['数据论证', '情绪共鸣', '故事叙事', '身份站队', '抖机灵', '引用权威'] as const;

export type Stance = (typeof STANCES)[number];
export type Strategy = (typeof STRATEGIES)[number];

export interface Species {
  id: string;
  title: string;
  excerpt: string;
  author: string;
  badgeText?: string;
  authority: number;
  votes: number | null; // null = question_answers 通道无赞同数字段，能量按热序近似
  enriched?: boolean; // 赞同数经 LCS 匹配自搜索接口
  comments: number;
  editTime: number; // unix 秒；0 = 未知
  heatRank?: number; // 能量近似序（越大越热）
  url: string;
  featuredComments: string[];
  stance: Stance;
  strategy: Strategy;
  summary: string;
  annotationSource: 'ai' | 'demo' | 'none';
}

export interface Ecosystem {
  question: string;
  questionUrl?: string;
  source: 'live' | 'demo';
  dataSource?: 'question_answers' | 'search';
  createdAt: number;
  species: Species[];
  narrative: string;
  cached?: boolean;
  note?: string;
}

export interface ReleaseReport {
  stance: Stance;
  strategy: Strategy;
  summary: string;
  survivalProbability: number;
  ruleProbability: number;
  aiProbability: number | null;
  suppressedBy: string;
  risks: string[];
  attractComments: string[];
  hybridAdvice: string[];
  narrative: string;
  analysisSource: 'ai+rule' | 'rule-only' | 'rule-only-demo';
  simulatedAt: number;
}

export interface HotItem {
  title: string;
  url: string;
  summary: string;
  thumbnail: string;
}

export interface EnvParams {
  rankMode: 'votes' | 'recent';
  climate: 'rational' | 'emotional';
  authorityBoost: boolean;
}

// 立场配色（浅底 + 深描边，扁平商务风）
export const STANCE_COLORS: Record<Stance, { fill: string; stroke: string; text: string }> = {
  支持: { fill: '#E6F1FB', stroke: '#185FA5', text: '#0C447C' },
  反对: { fill: '#FAECE7', stroke: '#993C1D', text: '#712B13' },
  中立: { fill: '#F1EFE8', stroke: '#888780', text: '#444441' },
  解构: { fill: '#E1F5EE', stroke: '#0F6E56', text: '#085041' },
  反讽: { fill: '#EEEDFE', stroke: '#534AB7', text: '#3C3489' },
  补充: { fill: '#EAF3DE', stroke: '#3B6D11', text: '#27500A' },
};

// 深色生态缸画布用：半透明填充 + 亮描边（扁平，无渐变）
export const STANCE_DARK: Record<Stance, { fill: string; stroke: string; text: string }> = {
  支持: { fill: 'rgba(66, 133, 244, 0.20)', stroke: '#7FAAF0', text: '#A8C8F5' },
  反对: { fill: 'rgba(224, 110, 74, 0.20)', stroke: '#E89A7E', text: '#F0BBA6' },
  中立: { fill: 'rgba(150, 160, 175, 0.18)', stroke: '#A8B2C0', text: '#C4CCD8' },
  解构: { fill: 'rgba(46, 196, 143, 0.18)', stroke: '#7FD8B8', text: '#A8E5CF' },
  反讽: { fill: 'rgba(139, 125, 224, 0.22)', stroke: '#A79DE8', text: '#C6BFF2' },
  补充: { fill: 'rgba(118, 190, 66, 0.20)', stroke: '#9BD37E', text: '#BFE5A8' },
};
