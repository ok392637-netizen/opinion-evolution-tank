import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from './api';
import type { Ecosystem, EnvParams, ReleaseReport, Species } from './types';
import { HotBoard } from './components/HotBoard';
import { Tank } from './components/Tank';
import { Workspace } from './components/Workspace';

export default function App() {
  const [status, setStatus] = useState<{ liveMode: boolean } | null>(null);
  const [view, setView] = useState<'board' | 'tank'>('board');
  const [eco, setEco] = useState<Ecosystem | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.status().then(setStatus).catch(() => setStatus({ liveMode: false }));
  }, []);

  const openTank = useCallback(async (question: string, url?: string) => {
    setLoading(true);
    setError('');
    try {
      const data = await api.ecosystem(question, url);
      setEco(data);
      setView('tank');
      window.scrollTo(0, 0);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <svg className="brand-mark" viewBox="0 0 34 34" aria-hidden="true">
            <rect x="1.5" y="1.5" width="31" height="31" rx="9" fill="#0D1B2E" />
            <circle cx="12" cy="14" r="4.5" fill="rgba(66,133,244,0.45)" stroke="#7FAAF0" strokeWidth="1" />
            <circle cx="21.5" cy="20" r="3.2" fill="rgba(224,110,74,0.4)" stroke="#E89A7E" strokeWidth="1" />
            <circle cx="23" cy="10.5" r="2.2" fill="rgba(46,196,143,0.45)" stroke="#7FD8B8" strokeWidth="1" />
            <path d="M6 26c4-3 8-3 11 0s7 3 11 0" fill="none" stroke="#8FA3BD" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          <div>
            <h1>观点进化缸</h1>
            <div className="sub">Opinion Evolution Tank · 像生物学家一样围观知乎</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {view === 'tank' && (
            <button className="backlink" onClick={() => setView('board')}>
              ← 返回选题台
            </button>
          )}
          <span className={`source-badge ${status?.liveMode ? 'live' : 'demo'}`}>
            {status?.liveMode ? '实时数据 · 知乎开放平台' : '演示数据 · 未接入开放平台'}
          </span>
        </div>
      </header>

      {error && <div className="err" style={{ marginBottom: 14 }}>{error}</div>}

      {view === 'board' ? (
        <HotBoard liveMode={status?.liveMode ?? false} loading={loading} onOpen={openTank} />
      ) : eco ? (
        <TankView eco={eco} onOpen={openTank} />
      ) : null}

      <p className="footer-note">
        观点进化缸 · 知乎黑客松 2026 校园新锐季参赛作品 ｜ 数据来自知乎开放平台官方 API ｜
        时间轴为 AI 演化重建，放生结果为 AI 模拟预测，均非知乎平台历史数据
      </p>
    </div>
  );
}

function TankView({ eco, onOpen }: { eco: Ecosystem; onOpen: (q: string, url?: string) => void }) {
  const [params, setParams] = useState<EnvParams>({ rankMode: 'votes', climate: 'rational', authorityBoost: false });
  const [timeIdx, setTimeIdx] = useState<number>(eco.species.length);
  const [release, setRelease] = useState<ReleaseReport | null>(null);

  const sorted = useMemo(() => [...eco.species].sort((a, b) => a.editTime - b.editTime), [eco.species]);
  const visible = useMemo(() => sorted.slice(0, Math.max(1, timeIdx)), [sorted, timeIdx]);

  const dominant = useMemo(() => {
    if (!visible.length) return null;
    return visible.reduce((a, b) => ((b.votes ?? -1) > (a.votes ?? -1) ? b : a));
  }, [visible]);

  const isQa = (eco as { dataSource?: string }).dataSource === 'question_answers';
  const stanceCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of visible) m.set(s.stance, (m.get(s.stance) || 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  }, [visible]);

  return (
    <div className="tank-layout">
      <div>
        <div className="tank-head">
          <div style={{ minWidth: 0 }}>
            <div className="q">{eco.question}</div>
            <div className="tank-stats">
              <span className="stat-chip">物种 <b>{eco.species.length}</b></span>
              {dominant && (
                <span className="stat-chip">
                  优势 <b>{dominant.stance}·{dominant.strategy}</b>
                </span>
              )}
              <span className="stat-chip">立场 <b>{stanceCount.map(([k, v]) => `${k}×${v}`).join(' / ') || '—'}</b></span>
              {eco.cached && <span className="stat-chip">24h 缓存</span>}
              {isQa && <span className="stat-chip">问题回答直取</span>}
            </div>
          </div>
        </div>
        {eco.narrative && <div className="narrative">{eco.narrative}</div>}
        <Tank
          species={visible}
          all={eco.species}
          params={params}
          question={eco.question}
          sourceLabel={eco.source === 'live' ? (isQa ? '知乎问题回答 · 实时直取' : '知乎搜索 · 实时检索') : '内置演示数据集'}
        />
      </div>
      <Workspace
        eco={eco}
        sorted={sorted}
        timeIdx={timeIdx}
        onTimeIdx={setTimeIdx}
        params={params}
        onParams={setParams}
        release={release}
        onRelease={setRelease}
      />
    </div>
  );
}
