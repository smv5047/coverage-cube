import { useMemo, useState } from 'react';
import {
  STATUS_LABEL,
  accountIndex,
  aggregate,
  bestCoverageForLeaf,
  cellKey,
  coverageCss,
  formatNumber,
  pct,
  statusOf,
} from '../data/model.js';

function CovBar({ value, threshold }) {
  const v = value ?? 0;
  return (
    <span className="covbar" title={pct(value)}>
      <span className="fill" style={{ width: `${Math.max(2, v)}%`, background: coverageCss(v) }} />
      {threshold != null && <span className="thr" style={{ left: `${threshold}%` }} />}
    </span>
  );
}

function StatusChip({ status }) {
  return <span className={`chip ${status}`}>{STATUS_LABEL[status]}</span>;
}

// Children one level below a z item, each with leaf ids.
function childrenOf(zItem) {
  if (zItem.level === 'environment') {
    return zItem.ref.providers.map((p) => ({
      id: p.id,
      name: p.name,
      level: 'provider',
      leafIds: p.accounts.map((a) => a.id),
      ref: p,
    }));
  }
  if (zItem.level === 'provider') {
    return zItem.ref.accounts.map((a) => ({
      id: a.id,
      name: a.name,
      level: 'account',
      tag: a.type === 'management' ? 'MGMT' : null,
      leafIds: [a.id],
      ref: a,
    }));
  }
  return [];
}

const LEVEL_NAME = { environment: 'environment', provider: 'provider', account: 'account' };

function GapQueue({ cells, unaddressed, threshold, filter, setSelection, zAxis }) {
  const queue = useMemo(() => {
    const list = cells
      .filter((c) => (filter === 'none' ? c.status === 'none' : c.status !== 'ok'))
      .map((c) => ({ ...c, exposure: c.magnitude * c.assets * (1 - c.coverage / 100) }))
      .sort((a, b) => b.exposure - a.exposure);
    return list.slice(0, 40);
  }, [cells, filter]);
  const maxExp = queue[0]?.exposure || 1;

  return (
    <>
      <p className="muted small">
        Prioritized by residual exposure = magnitude × assets × (1 − coverage), for this {zAxis.title.toLowerCase()}{' '}
        view. Click an item to inspect it.
      </p>
      {unaddressed.length > 0 && filter !== 'all' && (
        <>
          <h4>No control mapped ({unaddressed.length})</h4>
          <ul className="list">
            {unaddressed.map((u) => (
              <li key={u.key}>
                <button onClick={() => setSelection({ riskId: u.risk.id, toolId: null, zId: u.z.id })}>
                  <span className="li-main">
                    <b>{u.risk.name}</b>
                    <span className="muted"> in {u.z.name}</span>
                  </span>
                  <StatusChip status="unaddressed" />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      <h4>Gap queue ({queue.length})</h4>
      {!queue.length && <p className="muted small">No gaps below {threshold}% in this view. 🎉</p>}
      <ol className="list queue">
        {queue.map((c, i) => (
          <li key={c.key}>
            <button onClick={() => setSelection({ riskId: c.risk.id, toolId: c.tool.id, zId: c.z.id })}>
              <span className="rank">{i + 1}</span>
              <span className="li-main">
                <b>{c.risk.name}</b> <span className="muted">×</span> {c.tool.name}
                <span className="muted small block">
                  {c.z.name} · {formatNumber(c.assets)} assets · mag {c.magnitude.toFixed(1)}
                </span>
                <span className="expbar">
                  <span style={{ width: `${(c.exposure / maxExp) * 100}%` }} />
                </span>
              </span>
              <span className="li-val" style={{ color: coverageCss(c.coverage) }}>
                {pct(c.coverage)}
              </span>
            </button>
          </li>
        ))}
      </ol>
      {unaddressed.length > 0 && filter === 'all' && (
        <p className="muted small">
          {unaddressed.length} risk/{zAxis.title.toLowerCase()} pairs have no control mapped — switch Highlight to
          “Gaps” to list them.
        </p>
      )}
    </>
  );
}

export default function DetailPanel({
  data,
  zAxis,
  cells,
  unaddressed,
  selection,
  setSelection,
  threshold,
  filter,
  drillInto,
  startCollapsed = false,
  mode,
  onEdit,
}) {
  const [collapsed, setCollapsed] = useState(startCollapsed);
  const accounts = useMemo(() => accountIndex(data), [data]);

  const risk = selection && data.risks.find((r) => r.id === selection.riskId);
  const tool = selection?.toolId ? data.tools.find((t) => t.id === selection.toolId) : null;
  const zItem = selection?.zId ? zAxis.items.find((z) => z.id === selection.zId) : null;
  const valid = selection && risk && (selection.toolId ? tool : true) && (selection.zId ? zItem : true);

  let title = 'Gap queue';
  let body;

  if (!valid) {
    body = (
      <GapQueue
        cells={cells}
        unaddressed={unaddressed}
        threshold={threshold}
        filter={filter}
        setSelection={setSelection}
        zAxis={zAxis}
      />
    );
  } else if (!tool) {
    // Risk with no control mapped in a z item.
    title = `${risk.name} · no control`;
    const leaves = zItem ? zItem.leafIds.map((id) => accounts.get(id)).filter(Boolean) : [];
    body = (
      <>
        <div className="scope-line">
          <StatusChip status="unaddressed" /> in <b>{zItem?.name}</b>
        </div>
        <p className="small">
          No tool or process in the inventory is mapped to <b>{risk.name}</b> anywhere in this{' '}
          {LEVEL_NAME[zItem?.level] || 'scope'}. Inherent magnitude {risk.magnitude}/10.
        </p>
        {risk.description && <p className="muted small">{risk.description}</p>}
        <h4>Exposed scope ({leaves.length})</h4>
        <ul className="list compact">
          {leaves.map((a) => (
            <li key={a.id}>
              <span className="li-main">
                {a.name} {a.type === 'management' && <span className="tag">MGMT</span>}
                <span className="muted small block">
                  {a.provider.name} · {a.owner || 'unowned'}
                </span>
              </span>
              <span className="li-val">{formatNumber(a.assets)}</span>
            </li>
          ))}
        </ul>
        {mode === 'input' && (
          <button className="btn primary small" onClick={onEdit}>
            Map a control in the coverage matrix
          </button>
        )}
      </>
    );
  } else if (!zItem) {
    // Focus on risk × tool across the current z axis.
    title = `${risk.name} × ${tool.name}`;
    const rows = zAxis.items.map((z) => ({ z, agg: aggregate(data, risk.id, tool.id, z.leafIds) }));
    body = (
      <>
        <p className="muted small">Across each {zAxis.title.toLowerCase()} in this view. Click a row to inspect it.</p>
        <ul className="list">
          {rows.map(({ z, agg }) => (
            <li key={z.id}>
              <button disabled={!agg} onClick={() => setSelection({ ...selection, zId: z.id })}>
                <span className="li-main">
                  {z.name} {z.tag && <span className="tag">{z.tag}</span>}
                  {agg ? (
                    <CovBar value={agg.coverage} threshold={threshold} />
                  ) : (
                    <span className="muted small block">not applicable</span>
                  )}
                </span>
                <span className="li-val" style={{ color: agg ? coverageCss(agg.coverage) : undefined }}>
                  {agg ? pct(agg.coverage) : '—'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </>
    );
  } else {
    title = `${risk.name} × ${tool.name}`;
    const agg = aggregate(data, risk.id, tool.id, zItem.leafIds);
    const status = statusOf(agg?.coverage, threshold);
    const children = childrenOf(zItem).map((c) => ({ c, agg: aggregate(data, risk.id, tool.id, c.leafIds) }));
    const isAccount = zItem.level === 'account';
    const acct = isAccount ? accounts.get(zItem.id) : null;
    const rec = isAccount ? data.coverage[cellKey(risk.id, tool.id, zItem.id)] : null;
    const otherControls = data.tools
      .map((t) => ({ t, agg: aggregate(data, risk.id, t.id, zItem.leafIds) }))
      .filter((o) => o.agg)
      .sort((a, b) => b.agg.coverage - a.agg.coverage);
    // Best single-control coverage per leaf, asset-weighted across the scope.
    let bestW = 0;
    let bestSum = 0;
    for (const id of zItem.leafIds) {
      const b = bestCoverageForLeaf(data, risk.id, id);
      const a = accounts.get(id)?.assets || 1;
      if (b != null) {
        bestSum += b * a;
        bestW += a;
      }
    }
    const best = bestW ? bestSum / bestW : null;

    body = (
      <>
        <div className="scope-line">
          <span className="muted">{LEVEL_NAME[zItem.level]}:</span> <b>{zItem.name}</b>
          {zItem.tag && <span className="tag">{zItem.tag}</span>}
        </div>
        {agg ? (
          <>
            <div className="metrics">
              <div>
                <span className="m-val" style={{ color: coverageCss(agg.coverage) }}>
                  {pct(agg.coverage)}
                </span>
                <span className="m-lbl">coverage</span>
              </div>
              <div>
                <span className="m-val">{formatNumber(agg.assets)}</span>
                <span className="m-lbl">assets in scope</span>
              </div>
              <div>
                <span className="m-val">{agg.magnitude.toFixed(1)}</span>
                <span className="m-lbl">risk magnitude</span>
              </div>
            </div>
            <div className="scope-line">
              <StatusChip status={status} />
              <span className="muted small">
                {tool.kind === 'process' ? 'Process' : 'Tool'} · {tool.vendor || '—'}
                {!isAccount && ` · ${agg.count} account${agg.count === 1 ? '' : 's'} mapped`}
                {agg.zeroCount > 0 && ` · ${agg.zeroCount} with 0%`}
              </span>
            </div>
          </>
        ) : (
          <p className="muted small">This control is not mapped to this risk here.</p>
        )}

        {isAccount && acct && (
          <>
            <h4>{acct.type === 'management' ? 'Management account' : 'Account'} detail</h4>
            <dl className="kv">
              <dt>Name</dt>
              <dd>{acct.name}</dd>
              <dt>ID</dt>
              <dd className="mono">{acct.id}</dd>
              <dt>Path</dt>
              <dd>
                {acct.env.name} › {acct.provider.name}
              </dd>
              <dt>Type</dt>
              <dd>{acct.type === 'management' ? 'Management / org root' : 'Member account'}</dd>
              <dt>Owner</dt>
              <dd>{acct.owner || '—'}</dd>
              <dt>Region</dt>
              <dd>{acct.region || '—'}</dd>
              <dt>Total assets</dt>
              <dd>{formatNumber(acct.assets)}</dd>
              {rec?.notes && (
                <>
                  <dt>Notes</dt>
                  <dd>{rec.notes}</dd>
                </>
              )}
            </dl>
          </>
        )}

        {!isAccount && children.length > 0 && (
          <>
            <h4>
              Drill down · by{' '}
              {zItem.level === 'environment'
                ? zItem.ref.providerLabel || 'provider'
                : zItem.ref?.accountLabel || 'account'}
            </h4>
            <ul className="list">
              {children.map(({ c, agg: ca }) => (
                <li key={c.id}>
                  <button onClick={() => drillInto(zItem, risk.id, tool.id, c.id)}>
                    <span className="li-main">
                      {c.name} {c.tag && <span className="tag">{c.tag}</span>}
                      {ca ? (
                        <CovBar value={ca.coverage} threshold={threshold} />
                      ) : (
                        <span className="muted small block">not mapped</span>
                      )}
                    </span>
                    <span className="li-val" style={{ color: ca ? coverageCss(ca.coverage) : undefined }}>
                      {ca ? pct(ca.coverage) : '—'} ›
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <button className="btn primary small" onClick={() => drillInto(zItem, risk.id, tool.id)}>
              Open {zItem.name} in 3D ›
            </button>
          </>
        )}

        <h4>
          All controls for {risk.name}
          {best != null && <span className="muted small"> · best-control coverage {pct(best)}</span>}
        </h4>
        <ul className="list compact">
          {otherControls.map(({ t, agg: oa }) => (
            <li key={t.id} className={t.id === tool.id ? 'active' : ''}>
              <button onClick={() => setSelection({ ...selection, toolId: t.id })}>
                <span className="li-main">
                  {t.name} <span className="muted small">{t.kind === 'process' ? 'process' : 'tool'}</span>
                  <CovBar value={oa.coverage} threshold={threshold} />
                </span>
                <span className="li-val" style={{ color: coverageCss(oa.coverage) }}>
                  {pct(oa.coverage)}
                </span>
              </button>
            </li>
          ))}
        </ul>
        {mode === 'input' && (
          <button className="btn ghost small" onClick={onEdit}>
            Edit in coverage matrix
          </button>
        )}
      </>
    );
  }

  return (
    <aside className={`panel ${collapsed ? 'collapsed' : ''}`}>
      <header className="panel-head">
        {valid && (
          <button className="icon-btn" onClick={() => setSelection(null)} title="Back to gap queue" aria-label="Back">
            ‹
          </button>
        )}
        <h3>{title}</h3>
        <button
          className="icon-btn"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Expand panel' : 'Collapse panel'}
        >
          {collapsed ? '▴' : '▾'}
        </button>
      </header>
      {!collapsed && <div className="panel-body">{body}</div>}
    </aside>
  );
}
