import { useMemo, useState } from 'react';
import type { Species } from '../types';
import { STANCE_DARK, STANCES } from '../types';
import { buildLayout } from '../lib/force';

const W = 880;
const H = 540;

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

  const { nodes, links } = useMemo(
    () => buildLayout(species, all, params, W, H),
    [species, all, params],
  );

  const resolved = useMemo(
    () =>
      links.map((l) => ({
        kind: l.kind,
        a: typeof l.source === 'object' ? l.source : nodes.find((n) => n.id === l.source)!,
        b: typeof l.target === 'object' ? l.target : nodes.find((n) => n.id === l.target)!,
      })),
    [links, nodes],
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

          {nodes.map((n) => {
            const c = STANCE_DARK[n.stance];
            const isSel = selected?.id === n.id;
            return (
              <g key={n.id} className="node-g" onClick={() => setSelected(isSel ? null : n)}>
                <circle cx={n.x} cy={n.y} r={n.r + 7} fill={c.fill} opacity={0.35} />
                <circle
                  className="core"
                  cx={n.x}
                  cy={n.y}
                  r={n.r}
                  fill={c.fill}
                  stroke={isSel ? '#FFFFFF' : c.stroke}
                  strokeWidth={isSel ? 2.2 : 1.2}
                />
                <circle cx={n.x} cy={n.y - n.r * 0.22} r={Math.max(2.5, n.r * 0.1)} fill={c.stroke} opacity={0.9} />
                <text
                  x={n.x}
                  y={n.y + n.r * 0.16}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={Math.max(12, n.r * 0.36)}
                  fill={c.text}
                  fontWeight={500}
                >
                  {n.stance}
                </text>
                <text
                  x={n.x}
                  y={n.y + n.r * 0.55}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={11}
                  fill={c.text}
                  opacity={0.8}
                >
                  {n.votes ?? '热序'}
                </text>
                <text x={n.x} y={n.y + n.r + 18} textAnchor="middle" fontSize={11.5} fill="#8FA3BD">
                  {n.strategy}
                </text>
                <title>{`【${n.stance} · ${n.strategy}】${n.author}\n${n.summary || n.excerpt.slice(0, 80)}\n赞同 ${n.votes ?? '（按热序近似）'} · 评论 ${n.comments} · 权威等级 ${n.authority}`}</title>
              </g>
            );
          })}
        </svg>

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

        <div className="legend">
          {STANCES.map((s) => (
            <span key={s}>
              <i style={{ background: STANCE_DARK[s].fill, borderColor: STANCE_DARK[s].stroke }} />
              {s}
            </span>
          ))}
          <span className="note">圆面积 = 当前环境能量 · 点击物种查看详情</span>
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
