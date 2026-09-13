import { useEffect, useState } from 'react';
import { api } from '../api';
import type { HotItem } from '../types';

export function HotBoard({
  liveMode,
  loading,
  onOpen,
}: {
  liveMode: boolean;
  loading: boolean;
  onOpen: (q: string, url?: string) => void;
}) {
  const [items, setItems] = useState<HotItem[]>([]);
  const [warning, setWarning] = useState('');
  const [query, setQuery] = useState('');
  const [err, setErr] = useState('');
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    setFetching(true);
    api
      .hot()
      .then((d) => {
        setItems(d.items);
        setWarning((d as { warning?: string }).warning || '');
      })
      .catch((e) => setErr((e as Error).message))
      .finally(() => setFetching(false));
  }, []);

  const submit = () => {
    const q = query.trim();
    if (q.length < 4) return;
    const m = q.match(/https?:\/\/(www\.)?zhihu\.com\/question\/(\d+)/);
    if (m) {
      onOpen(`知乎问题 ${m[2]}`, `https://www.zhihu.com/question/${m[2]}`);
    } else {
      onOpen(q);
    }
  };

  return (
    <div>
      <section className="hero">
        <div className="kicker">ZHIHU HACKATHON 2026 · OPINION EVOLUTION TANK</div>
        <h2>
          每一个问题，都是一片观点厮杀的生态缸。
          <br />
          现在，你可以亲眼看见这场进化。
        </h2>
        <p>
          赞同是能量，评论是繁殖，折叠是灭绝，热榜是气候突变。高赞回答不一定是正确的，而是最适应生态位的那个物种——我们把它可视化给你看。
        </p>
        {/* 三个能力锚点：评委只有 3 分钟，要让他们在滚动前就知道产品能做什么；
            用细描边分隔的横排，不抢 hero 主张的视觉层级 */}
        <div className="hero-caps">
          <span>观点物种识别</span>
          <span>演化时间轴重建</span>
          <span>放生存活预测</span>
        </div>
      </section>

      <div className="searchbar">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="输入知乎问题标题，或直接粘贴问题链接（zhihu.com/question/…）…"
        />
        <button className="btn primary" onClick={submit} disabled={loading || query.trim().length < 4}>
          {loading ? '构建中…' : '创建生态缸'}
        </button>
      </div>

      {err && <div className="err">{err}</div>}
      {warning && <div className="warn-banner">{warning}</div>}

      <div className="section-head">
        <h3>热榜选题</h3>
        <span className="hint">
          {liveMode ? '来自知乎热榜 · 服务端缓存 12 小时' : '演示数据 · 配置 Access Secret 后切换实时热榜'}
        </span>
      </div>

      {fetching ? (
        <div className="loading">正在获取热榜…</div>
      ) : (
        <div className="hot-list">
          {items.map((it, i) => (
            <div className="hot-row" key={i}>
              <div className="hot-rank">{String(i + 1).padStart(2, '0')}</div>
              <div className="hot-main">
                <div className="hot-title">{it.title}</div>
                <div className="hot-summary">{it.summary || '（无摘要）'}</div>
              </div>
              <div className="hot-actions">
                <a className="hot-link" href={it.url} target="_blank" rel="noreferrer">
                  原问题
                </a>
                <button className="btn primary" disabled={loading} onClick={() => onOpen(it.title, it.url)}>
                  {loading ? '构建中…' : '创建生态缸'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
