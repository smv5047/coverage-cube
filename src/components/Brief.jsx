import { useMemo, useState } from 'react';
import { STATUS_LABEL, coverageCss, coverageHue, formatNumber, pct } from '../data/model.js';
import { briefToRows, briefToText, computeBrief, makeSnapshot, sampleHistory } from '../data/report.js';
import { toCsv } from '../data/csv.js';
import { copyText, downloadText, today } from '../data/download.js';

// Slightly softer than the cube's colours so dark figures stay easy to read.
const heatCss = (v) => `hsl(${coverageHue(v).toFixed(0)}, 72%, 54%)`;

const fmtDate = (iso) => {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
};
const fmtLong = (d) => d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });

function Delta({ now, prev, goodWhen = 'up', unit = '' }) {
  if (prev == null) return null;
  const d = Math.round((now - prev) * 10) / 10;
  if (!d) return <span className="delta flat">no change</span>;
  const good = goodWhen === 'up' ? d > 0 : d < 0;
  return (
    <span className={`delta ${good ? 'good' : 'bad'}`}>
      {d > 0 ? '▲' : '▼'} {Math.abs(d)}
      {unit} <span className="delta-vs">vs last snapshot</span>
    </span>
  );
}

function Tile({ label, value, sub, tone, children }) {
  return (
    <div className="tile">
      <span className="tile-label">{label}</span>
      <span className={`tile-value ${tone || ''}`}>{value}</span>
      {sub && <span className="tile-sub">{sub}</span>}
      {children}
    </div>
  );
}

function HeatCell({ value, status, label, onClick, noneText = '—' }) {
  if (value == null) {
    const unaddressed = status === 'unaddressed';
    const inner = unaddressed ? 'No control' : noneText;
    return (
      <td className={`heat ${unaddressed ? 'heat-none' : 'heat-na'}`} title={label}>
        {onClick && unaddressed ? <button onClick={onClick}>{inner}</button> : <span>{inner}</span>}
      </td>
    );
  }
  const body = (
    <>
      {Math.round(value)}
      <small>%</small>
    </>
  );
  return (
    <td className="heat" style={{ background: heatCss(value) }} title={label}>
      {onClick ? <button onClick={onClick}>{body}</button> : <span>{body}</span>}
    </td>
  );
}

function Trend({ points, threshold }) {
  const W = 460;
  const H = 170;
  const m = { l: 34, r: 26, t: 22, b: 26 };
  const x = (i) => m.l + (points.length === 1 ? 0.5 : i / (points.length - 1)) * (W - m.l - m.r);
  const y = (v) => m.t + (1 - v / 100) * (H - m.t - m.b);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.coverage).toFixed(1)}`).join(' ');
  const last = points[points.length - 1];
  return (
    <svg className="trend" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Overall coverage over time">
      {[0, 25, 50, 75, 100].map((t) => (
        <g key={t}>
          <line x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} className="grid" />
          <text x={m.l - 6} y={y(t) + 3.5} textAnchor="end" className="axis">
            {t}
          </text>
        </g>
      ))}
      <line x1={m.l} x2={W - m.r} y1={y(threshold)} y2={y(threshold)} className="target" />
      <text x={m.l + 4} y={y(threshold) - 5} className="axis">
        Target {threshold}%
      </text>
      <path d={path} className="line" />
      {points.map((p, i) => (
        <g key={p.id}>
          <circle cx={x(i)} cy={y(p.coverage)} r={i === points.length - 1 ? 5 : 4} className="dot">
            <title>
              {p.now ? 'Today' : fmtDate(p.date)}: {Math.round(p.coverage)}% coverage, {p.gaps} gaps, {p.unmapped}{' '}
              unmapped
            </title>
          </circle>
          <text x={x(i)} y={H - 8} textAnchor="middle" className="axis">
            {p.now ? 'Today' : fmtDate(p.date)}
          </text>
        </g>
      ))}
      <text
        x={x(points.length - 1)}
        y={y(last.coverage) + (last.coverage >= threshold ? -11 : 20)}
        textAnchor="middle"
        className="end-label"
      >
        {Math.round(last.coverage)}%
      </text>
    </svg>
  );
}

const TONE_ICON = { good: '✓', warn: '!', bad: '✕', info: 'i' };

export default function Brief({
  data,
  threshold,
  editable,
  onTitle,
  onSaveSnapshot,
  onDeleteSnapshot,
  onOpenCube,
  sample,
}) {
  const brief = useMemo(() => computeBrief(data, threshold), [data, threshold]);
  const [msg, setMsg] = useState('');
  const [showAll, setShowAll] = useState(false);

  const title = data.meta?.title || 'Security control coverage';
  const asOf = fmtLong(new Date());
  const saved = sample ? sampleHistory(brief) : data.snapshots || [];
  const prev = saved[saved.length - 1];
  const points = [...saved.slice(-7), { ...makeSnapshot(brief), id: 'now', now: true }];
  const priorities = showAll ? brief.priorities : brief.priorities.slice(0, 8);
  const flash = (t) => {
    setMsg(t);
    setTimeout(() => setMsg(''), 4000);
  };

  return (
    <main className="brief-wrap">
      <article className="brief">
        <header className="brief-head">
          <div className="brief-title">
            {editable ? (
              <input
                id="report-title"
                className="title-input"
                value={data.meta?.title || ''}
                placeholder="Security control coverage"
                aria-label="Report title"
                onChange={(e) => onTitle(e.target.value)}
              />
            ) : (
              <h2>{title}</h2>
            )}
            <p className="muted">
              As of {asOf} · {brief.counts.risks} risks · {brief.counts.tools} tools & processes ·{' '}
              {brief.counts.environments} environments · {brief.counts.accounts} accounts
              {sample && <span className="sample-tag">Sample data</span>}
            </p>
          </div>
          <div className="brief-actions no-print">
            <button className="btn primary" onClick={() => window.print()}>
              Print / save PDF
            </button>
            <button
              className="btn"
              onClick={async () =>
                flash(
                  (await copyText(briefToText(brief, title, asOf)))
                    ? 'Summary copied — paste it into an email or slide.'
                    : 'Copying is blocked in this browser.',
                )
              }
            >
              Copy summary
            </button>
            <button
              className="btn"
              onClick={() => downloadText(`coverage-summary-${today()}.csv`, toCsv(briefToRows(brief)), 'text/csv')}
            >
              Export tables (CSV)
            </button>
          </div>
        </header>
        {msg && <p className="flash no-print">{msg}</p>}

        <section className="tiles">
          <Tile
            label="Overall coverage"
            value={pct(brief.overall)}
            sub={`Target ${threshold}% · strongest control per risk`}
            tone={brief.overall >= threshold ? 'good' : 'warn'}
          >
            <Delta now={Math.round(brief.overall * 10) / 10} prev={prev?.coverage} unit=" pts" />
          </Tile>
          <Tile
            label="Risks on target"
            value={`${brief.risksMeetingTarget} / ${brief.counts.risks}`}
            sub="Meet the target in every environment"
            tone={brief.risksMeetingTarget === brief.counts.risks ? 'good' : ''}
          >
            <Delta now={brief.risksMeetingTarget} prev={prev?.risksMeetingTarget} />
          </Tile>
          <Tile
            label="Below target"
            value={brief.belowTarget.length}
            sub={`Of ${brief.pairs.length} risk / environment pairs`}
            tone={brief.belowTarget.length ? 'warn' : 'good'}
          >
            <Delta now={brief.belowTarget.length} prev={prev?.gaps} goodWhen="down" />
          </Tile>
          <Tile
            label="No control mapped"
            value={brief.unmapped.length}
            sub="Risk / environment pairs"
            tone={brief.unmapped.length ? 'bad' : 'good'}
          >
            <Delta now={brief.unmapped.length} prev={prev?.unmapped} goodWhen="down" />
          </Tile>
          <Tile label="Single control" value={brief.singleControl.length} sub="Pairs with no second layer">
            <Delta now={brief.singleControl.length} prev={prev?.singleControl} goodWhen="down" />
          </Tile>
        </section>

        <section className="brief-two">
          <div className="brief-card">
            <h3>Key findings</h3>
            <ul className="findings">
              {brief.findings.map((f, i) => (
                <li key={i}>
                  <span className={`tone ${f.tone}`} aria-hidden>
                    {TONE_ICON[f.tone]}
                  </span>
                  <span>{f.text}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="brief-card">
            <div className="card-head">
              <h3>Overall coverage over time</h3>
              {editable && (
                <button
                  className="btn small no-print"
                  onClick={() => {
                    onSaveSnapshot(makeSnapshot(brief));
                    flash('Snapshot saved. Future summaries show the change since today.');
                  }}
                >
                  Save snapshot
                </button>
              )}
            </div>
            <Trend points={points} threshold={threshold} />
            {sample ? (
              <p className="muted small">
                Illustrative history. With your own data, save a snapshot each review cycle.
              </p>
            ) : saved.length ? (
              <ul className="snaps no-print">
                {saved.map((s) => (
                  <li key={s.id}>
                    {s.date} · {Math.round(s.coverage)}% · {s.gaps} below target
                    {editable && (
                      <button
                        className="icon-btn"
                        aria-label={`Delete snapshot ${s.date}`}
                        onClick={() => onDeleteSnapshot(s.id)}
                      >
                        ×
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted small">
                No snapshots yet. Save one after each review to track progress and show the change since last time.
              </p>
            )}
          </div>
        </section>

        <section className="brief-card">
          <div className="card-head">
            <h3>Risk coverage by environment</h3>
            <div className="scale" aria-hidden>
              <span>0%</span>
              <i />
              <span>100%</span>
            </div>
          </div>
          <p className="muted small">
            Coverage from the strongest control for each risk, weighted by assets. Accounts with nothing mapped count as
            0%. Select a cell to open it in the cube.
          </p>
          <div className="table-scroll">
            <table className="heatmap">
              <thead>
                <tr>
                  <th>Risk</th>
                  {brief.envs.map((e) => (
                    <th key={e.id}>{e.name}</th>
                  ))}
                  <th className="overall">Overall</th>
                </tr>
              </thead>
              <tbody>
                {brief.riskEnv.map((r) => (
                  <tr key={r.risk.id}>
                    <th>{r.risk.name}</th>
                    {r.row.map((c) => (
                      <HeatCell
                        key={c.env.id}
                        value={c.value}
                        status={c.status}
                        label={
                          c.value == null
                            ? `${r.risk.name} in ${c.env.name}: no control mapped`
                            : `${r.risk.name} in ${c.env.name}: ${Math.round(c.value)}% (${STATUS_LABEL[c.status]}), ${c.controls} control${c.controls > 1 ? 's' : ''}, strongest ${c.bestTool.name}`
                        }
                        onClick={() => onOpenCube(r.risk.id, c.bestTool?.id || null, c.env.id)}
                      />
                    ))}
                    <HeatCell value={r.overall} status={r.status} label={`${r.risk.name} overall`} />
                  </tr>
                ))}
                <tr className="foot">
                  <th>All risks (average)</th>
                  {brief.envOverall.map((e) => (
                    <HeatCell key={e.env.id} value={e.value} status={e.status} label={`${e.env.name} average`} />
                  ))}
                  <td className="heat heat-na" />
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="brief-card">
          <h3>Tool and process coverage by environment</h3>
          <p className="muted small">
            Average coverage each tool or process delivers for the risks it is mapped to. A dash means it is not used
            there.
          </p>
          <div className="table-scroll">
            <table className="heatmap">
              <thead>
                <tr>
                  <th>Tool / process</th>
                  {brief.envs.map((e) => (
                    <th key={e.id}>{e.name}</th>
                  ))}
                  <th className="overall">Overall</th>
                </tr>
              </thead>
              <tbody>
                {brief.toolEnv.map((t) => (
                  <tr key={t.tool.id}>
                    <th>
                      {t.tool.name}
                      {t.tool.kind === 'process' && <span className="kind-tag">process</span>}
                    </th>
                    {t.row.map((c) => (
                      <HeatCell
                        key={c.env.id}
                        value={c.value}
                        status={c.status}
                        label={
                          c.value == null
                            ? `${t.tool.name} is not used in ${c.env.name}`
                            : `${t.tool.name} in ${c.env.name}: ${Math.round(c.value)}%`
                        }
                      />
                    ))}
                    <HeatCell value={t.overall} status={t.status} label={`${t.tool.name} overall`} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="brief-card">
          <h3>Priorities</h3>
          <p className="muted small">
            Risk and environment pairs that miss the target, ranked by exposure: risk magnitude × assets × the share
            left uncovered.
          </p>
          {brief.priorities.length ? (
            <div className="table-scroll">
              <table className="prio">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Risk</th>
                    <th>Environment</th>
                    <th className="num">Coverage</th>
                    <th>Status</th>
                    <th>Strongest control</th>
                    <th className="num">Controls</th>
                    <th className="num">Assets</th>
                    <th>Notes</th>
                    <th className="no-print" />
                  </tr>
                </thead>
                <tbody>
                  {priorities.map((p, i) => (
                    <tr key={p.key}>
                      <td>{i + 1}</td>
                      <td>
                        <b>{p.risk.name}</b>
                      </td>
                      <td>{p.env.name}</td>
                      <td className="num">
                        {p.value == null ? (
                          '—'
                        ) : (
                          <>
                            <span className="swatch" style={{ background: coverageCss(p.value) }} />
                            {pct(p.value)}
                          </>
                        )}
                      </td>
                      <td>
                        <span className={`chip ${p.status}`}>{STATUS_LABEL[p.status]}</span>
                      </td>
                      <td>{p.bestTool?.name || 'None'}</td>
                      <td className="num">{p.controls}</td>
                      <td className="num">{formatNumber(p.assets)}</td>
                      <td className="notes">{p.notes}</td>
                      <td className="no-print">
                        <button
                          className="btn ghost small"
                          onClick={() => onOpenCube(p.risk.id, p.bestTool?.id || null, p.env.id)}
                        >
                          Cube ›
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>Every risk meets the {threshold}% target in every environment.</p>
          )}
          {brief.priorities.length > 8 && (
            <button className="btn ghost small no-print" onClick={() => setShowAll((s) => !s)}>
              {showAll ? 'Show top 8' : `Show all ${brief.priorities.length}`}
            </button>
          )}
        </section>

        <footer className="brief-foot muted small">
          Coverage is recorded per account and rolled up weighted by assets. “On target” means at or above {threshold}
          %. Generated by Coverage Cube on {asOf}.
        </footer>
      </article>
    </main>
  );
}
