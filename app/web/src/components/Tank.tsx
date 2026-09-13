import { useEffect, useMemo, useRef, useState } from 'react';
import type { Species, Stance, Strategy } from '../types';
import { STANCES, STRATEGIES } from '../types';
import { buildLayout } from '../lib/force';
import type { VizNode } from '../lib/force';

const W = 880;
const H = 540;

// ---------- 立场配色（深色观测窗专用，组件内局部常量） ----------
// types.ts 被 spec 锁定（下游有并行模块在改），且原 STANCE_DARK 里
// 中立/解构/补充 在 #0D1B2E 底上几乎同色。这里按色相间隔 ≥45° 重排六色，
// 保持「低饱和 + 半透明填充 + 亮描边」的既有质感，不变糖果色。
// 色盲友好兜底：填充透明度分两档——支持/反对/解构 用 0.24 档，
// 中立/反讽/补充 用 0.13 档，即使色相难辨也能按明暗分组。
const TANK_STANCE: Record<Stance, { fill: string; stroke: string; text: string }> = {
  支持: { fill: 'rgba(96, 148, 230, 0.24)', stroke: '#8FB8F2', text: '#B7D0F7' }, // 蓝 ~215°
  反对: { fill: 'rgba(232, 120, 84, 0.24)', stroke: '#F09A80', text: '#F7C2AE' }, // 橙红 ~12°
  解构: { fill: 'rgba(72, 200, 160, 0.24)', stroke: '#77D8B4', text: '#ACE7D0' }, // 青绿 ~165°
  中立: { fill: 'rgba(180, 194, 210, 0.13)', stroke: '#CBD4DF', text: '#DDE4EC' }, // 无彩色，靠明度区分
  反讽: { fill: 'rgba(146, 126, 232, 0.13)', stroke: '#B9AAEF', text: '#D2C9F6' }, // 紫 ~262°
  补充: { fill: 'rgba(216, 188, 110, 0.13)', stroke: '#E3CD8C', text: '#EFE0B4' }, // 琥珀 ~48°
};

// 权威等级 → 描边粗细（第四维编码）：1 / 1.4 / 2 / 2.8px，
// 大 V 在缸里一眼可辨，不需要读文字。
const AUTHORITY_STROKE = [1, 1.4, 2, 2.8];

// ---------- 生存策略符号（第三维编码） ----------
// 14×14 纯描边极简符号，替代原来圆下方的一行小字：
// 10 个节点 = 10 行小字的视觉噪音被压缩成圆内图形。
function StrategyGlyph({ s, x, y, color }: { s: Strategy; x: number; y: number; color: string }) {
  const line = {
    stroke: color,
    strokeWidth: 1.3,
    fill: 'none',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  const dot = (cx: number, cy: number) => <circle cx={cx} cy={cy} r={1.3} fill={color} />;
  return (
    <g transform={`translate(${x - 7} ${y - 7})`} aria-hidden="true">
      {s === '数据论证' && <path {...line} d="M2.5 11.5 V7.5 M7 11.5 V4.5 M11.5 11.5 V2" />}
      {s === '情绪共鸣' && <path {...line} d="M1.5 7 C3.5 4 5.5 4 7 7 S10.5 10 12.5 7" />}
      {s === '故事叙事' && (
        <>
          {dot(2.5, 10.5)}
          <path {...line} d="M4 10 L7 4.5 L10 8 L12.5 3" />
        </>
      )}
      {s === '身份站队' && (
        <>
          <path {...line} d="M7 1.5 V12.5" />
          {dot(3.2, 7)}
          {dot(10.8, 7)}
        </>
      )}
      {s === '抖机灵' && <path {...line} d="M8 1.5 L4.5 7.5 H7.2 L6 12.5 L10 5.8 H7.4 Z" />}
      {s === '引用权威' && (
        <>
          <path {...line} d="M5 3 C3.8 4.2 3.2 5.4 3.2 7" />
          {dot(3.2, 8.8)}
          <path {...line} d="M9.8 3 C8.6 4.2 8 5.4 8 7" />
          {dot(8, 8.8)}
        </>
      )}
    </g>
  );
}

// ---------- 节点入场 / 重算过渡 ----------
// 时间轴拖动、环境参数切换时，节点从上一状态（新节点从 r=0）缓动到目标，
// 180ms 内完成，让「重算」肉眼可见；运动只由用户操作触发，符合红线（禁循环动画）。
// cubic-bezier(.22,.61,.36,1) 与 easeOutCubic 视觉上几乎一致，
// 用多项式近似可避免引入贝塞尔求解代码。
function useTweenNodes(target: VizNode[]): VizNode[] {
  const [rendered, setRendered] = useState<VizNode[]>(target);
  const prevRef = useRef<Map<string, VizNode>>(new Map());

  useEffect(() => {
    const prev = prevRef.current;
    const from = new Map(target.map((n) => [n.id, prev.get(n.id) ?? { ...n, r: 0 }]));
    const DUR = 180;
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    let raf = 0;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / DUR);
      const k = ease(t);
      setRendered(
        target.map((n) => {
          const f = from.get(n.id)!;
          return { ...n, x: f.x + (n.x - f.x) * k, y: f.y + (n.y - f.y) * k, r: f.r + (n.r - f.r) * k };
        }),
      );
      if (t < 1) {
        raf = requestAnimationFrame(step);
      } else {
        prevRef.current = new Map(target.map((n) => [n.id, n]));
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);

  return rendered;
}

export function Tank({
  species,
  all,
  params,
  question,
  sourceLabel,
}: {
  species: Species[];
  all: Species[];
  params: { rankMode: 'votes' | 'recent'; climate: 'rational' | 'emotional'; authorityBoost: boolean };
  question: string;
  sourceLabel: string;
}) {
  const [selected, setSelected] = useState<Species | null>(null);
  // hover 只用于「非 Top3 节点悬浮时才显示策略标签」，不影响任何数据逻辑
  const [hovered, setHovered] = useState<string | null>(null);

  const { nodes, links } = useMemo(
    () => buildLayout(species, all, params, W, H),
    [species, all, params],
  );

  const tweened = useTweenNodes(nodes);

  // 连线端点改从补间后的节点取坐标，否则节点在动、连线跳变，两者会脱节
  const resolved = useMemo(
    () =>
      links.map((l) => ({
        kind: l.kind,
        a: tweened.find((n) => n.id === (typeof l.source === 'object' ? l.source.id : l.source))!,
        b: tweened.find((n) => n.id === (typeof l.target === 'object' ? l.target.id : l.target))!,
      })),
    [links, tweened],
  );

  // 文字标签规则：只有能量 Top 3 常驻策略标签，其余 hover / 点击才显示，
  // 避免 10 个节点 10 行小字的噪音（spec 4.3）
  const top3 = useMemo(
    () => new Set([...nodes].sort((a, b) => b.energy - a.energy).slice(0, 3).map((n) => n.id)),
    [nodes],
  );

  const dominant = useMemo(() => {
    if (!nodes.length) return null;
    return nodes.reduce((a, b) => ((b.votes ?? -1) > (a.votes ?? -1) ? b : a));
  }, [nodes]);

  if (!species.length) {
    return (
      <div className="tank-svg-wrap">
        <div className="loading" style={{ color: 'var(--tank-dim)' }}>该问题暂无可用回答样本，换一个问题试试。</div>
      </div>
    );
  }

  return (
    <div>
      <div className="tank-svg-wrap">
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`${question} 的观点生态缸`}>
          <title>观点生态缸</title>
          <defs>
            <pattern id="dots" width="26" height="26" patternUnits="userSpaceOnUse">
              <circle cx="1.2" cy="1.2" r="1.2" fill="rgba(148, 178, 216, 0.13)" />
            </pattern>
          </defs>
          <rect width={W} height={H} fill="url(#dots)" />

          {resolved.map((l, i) => {
            const a = l.a;
            const b = l.b;
            if (l.kind === 'camp') {
              return (
                <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="rgba(148, 178, 216, 0.28)" strokeWidth={1} />
              );
            }
            return (
              <line
                key={i}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke="#E89A7E"
                strokeOpacity={0.55}
                strokeWidth={1.3}
                strokeDasharray="7 6"
              />
            );
          })}

          {tweened.map((n) => {
            const c = TANK_STANCE[n.stance];
            const isSel = selected?.id === n.id;
            const showTag = top3.has(n.id) || isSel || hovered === n.id;
            // 权威等级映射到描边档位，超出 1–4 的值收敛到端点，避免异常数据画爆
            const ai = Math.min(4, Math.max(1, Math.round(n.authority || 1))) - 1;
            const sw = isSel ? AUTHORITY_STROKE[ai] + 1 : AUTHORITY_STROKE[ai];
            // 小圆（r<26）内不放任何文字：原来小圆塞「中立」两字直接溢出圆外，
            // 改为只放策略符号；文字只在圆够大时出现
            const hasText = n.r >= 26;
            return (
              <g
                key={n.id}
                className="node-g"
                onClick={() => setSelected(isSel ? null : n)}
                onMouseEnter={() => setHovered(n.id)}
                onMouseLeave={() => setHovered((h) => (h === n.id ? null : h))}
              >
                <circle cx={n.x} cy={n.y} r={n.r + 7} fill={c.fill} opacity={0.35} />
                <circle
                  className="core"
                  cx={n.x}
                  cy={n.y}
                  r={n.r}
                  fill={c.fill}
                  stroke={isSel ? '#FFFFFF' : c.stroke}
                  strokeWidth={sw}
                />
                <StrategyGlyph s={n.strategy} x={n.x} y={hasText ? n.y - n.r * 0.26 : n.y} color={c.stroke} />
                {hasText && (
                  <text
                    x={n.x}
                    y={n.y + n.r * 0.3}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={Math.min(13, Math.max(11, n.r * 0.3))}
                    fill={c.text}
                    fontWeight={500}
                  >
                    {n.stance}
                  </text>
                )}
                {showTag && (
                  <text className="node-tag" x={n.x} y={n.y + n.r + 16} textAnchor="middle" fontSize={11.5} fill="#8FA3BD">
                    {n.strategy} · {n.votes ?? '热序'}
                  </text>
                )}
                <title>{`【${n.stance} · ${n.strategy}】${n.author}\n${n.summary || n.excerpt.slice(0, 80)}\n赞同 ${n.votes ?? '（按热序近似）'} · 评论 ${n.comments} · 权威等级 ${n.authority}`}</title>
              </g>
            );
          })}
        </svg>

        {/* 取景框四角刻度线：观测窗是「仪器」而非卡片，角标是最便宜的仪器感 */}
        <div className="tank-frame" aria-hidden="true">
          <i className="tl" />
          <i className="tr" />
          <i className="bl" />
          <i className="br" />
        </div>

        <div className="hud">
          <span className="hud-chip">{sourceLabel}</span>
          <span className="hud-chip">物种 <b>{nodes.length}</b></span>
          {dominant && (
            <span className="hud-chip">
              优势 <b>{dominant.stance}·{dominant.strategy}</b>
            </span>
          )}
          {resolved.some((l) => l.kind === 'rival') && <span className="hud-chip">虚线 = 对立竞争</span>}
        </div>

        {/* 图例与节点编码同步：立场色 + 策略符号都要能在这里查到 */}
        <div className="legend">
          {STANCES.map((s) => (
            <span key={s}>
              <i style={{ background: TANK_STANCE[s].fill, borderColor: TANK_STANCE[s].stroke }} />
              {s}
            </span>
          ))}
          {STRATEGIES.map((s) => (
            <span key={s}>
              <svg width="12" height="12" viewBox="0 0 14 14" style={{ display: 'block' }}>
                <StrategyGlyph s={s} x={7} y={7} color="#8FA3BD" />
              </svg>
              {s}
            </span>
          ))}
          <span className="note">圆面积 = 能量 · 描边粗细 = 权威等级 · 点击物种查看详情</span>
        </div>
      </div>

      {selected && (
        <div className="detail-card">
          <div>
            <div className="name">
              【{selected.stance} · {selected.strategy}】{selected.summary || '（未标注）'}
              <span style={{ fontWeight: 400, color: 'var(--ink-3)' }}>　— {selected.author}</span>
            </div>
            <p>{selected.excerpt}</p>
            <div className="meta-line">
              赞同 {selected.votes ?? '（按热序近似）'} · 评论 {selected.comments} · 发布/编辑 {selected.editTime > 0 ? new Date(selected.editTime * 1000).toLocaleDateString('zh-CN') : '未知'} · 权威等级 {selected.authority}
              {selected.badgeText ? ` · ${selected.badgeText}` : ''}
            </div>
            {selected.featuredComments.length > 0 && (
              <div style={{ marginTop: 10 }}>
                {selected.featuredComments.slice(0, 2).map((c, i) => (
                  <div key={i} className="quote">
                    精选评论：{c}
                  </div>
                ))}
              </div>
            )}
            <a href={selected.url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--primary)' }}>
              查看原文（知乎）
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
