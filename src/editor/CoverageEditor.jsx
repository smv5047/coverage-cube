import { useMemo, useState } from 'react';
import { allAccounts, cellKey, coverageCss } from '../data/model.js';
import { NumInput } from './fields.jsx';
import { askConfirm } from '../components/ConfirmDialog.jsx';

const FIELDS = {
  coverage: { label: 'Coverage %', min: 0, max: 100, step: 5 },
  assets: { label: 'Asset volume', min: 0, step: 1 },
  magnitude: { label: 'Risk magnitude', min: 1, max: 10, step: 0.5 },
};

export default function CoverageEditor({ data, update, goTo }) {
  const accounts = useMemo(() => allAccounts(data), [data]);
  const [accountId, setAccountId] = useState(accounts[0]?.id || '');
  const [field, setField] = useState('coverage');
  const [copyFrom, setCopyFrom] = useState('');
  const [fill, setFill] = useState(50);

  const acct = accounts.find((a) => a.id === accountId) || accounts[0];

  if (!data.risks.length || !data.tools.length || !accounts.length) {
    return (
      <div className="ed-section">
        <h2>Coverage & metrics</h2>
        <p className="muted">
          You need at least one risk, one tool/process and one account before you can record coverage.
        </p>
        <div className="empty-actions">
          {!data.risks.length && (
            <button className="btn" onClick={() => goTo('risks')}>
              Add risks
            </button>
          )}
          {!data.tools.length && (
            <button className="btn" onClick={() => goTo('tools')}>
              Add tools & processes
            </button>
          )}
          {!accounts.length && (
            <button className="btn" onClick={() => goTo('envs')}>
              Add environments & accounts
            </button>
          )}
        </div>
      </div>
    );
  }

  const record = (riskId, toolId) => data.coverage[cellKey(riskId, toolId, acct.id)];

  const setCell = (risk, toolId, value) =>
    update((d) => {
      const k = cellKey(risk.id, toolId, acct.id);
      if (field === 'coverage') {
        if (value == null) {
          delete d.coverage[k];
          return;
        }
        const existing = d.coverage[k];
        d.coverage[k] = existing
          ? { ...existing, coverage: value }
          : { coverage: value, assets: acct.assets || 0, magnitude: risk.magnitude ?? 5, notes: '' };
      } else if (d.coverage[k] && value != null) {
        d.coverage[k][field] = value;
      }
    });

  const copyMapping = () => {
    if (!copyFrom || copyFrom === acct.id) return;
    update((d) => {
      for (const r of d.risks) {
        for (const t of d.tools) {
          const src = d.coverage[cellKey(r.id, t.id, copyFrom)];
          const k = cellKey(r.id, t.id, acct.id);
          if (src)
            d.coverage[k] = {
              ...src,
              assets: Math.round(
                (src.assets / Math.max(1, accounts.find((a) => a.id === copyFrom)?.assets || 1)) * (acct.assets || 0),
              ),
            };
          else delete d.coverage[k];
        }
      }
    });
  };

  const fillBlanks = () =>
    update((d) => {
      for (const r of d.risks) {
        for (const t of d.tools) {
          const k = cellKey(r.id, t.id, acct.id);
          if (!d.coverage[k])
            d.coverage[k] = { coverage: fill, assets: acct.assets || 0, magnitude: r.magnitude ?? 5, notes: '' };
        }
      }
    });

  const clearAccount = async () => {
    if (!(await askConfirm(`Remove all coverage records for “${acct.name}”?`, { confirmLabel: 'Clear' }))) return;
    update((d) => {
      for (const k of Object.keys(d.coverage)) if (k.endsWith(`|${acct.id}`)) delete d.coverage[k];
    });
  };

  const f = FIELDS[field];
  const mapped = data.risks.reduce((n, r) => n + data.tools.filter((t) => record(r.id, t.id)).length, 0);

  return (
    <div className="ed-section">
      <h2>Coverage & metrics</h2>
      <p className="muted">
        Pick an account, then enter coverage per risk × control. A blank coverage cell means the control is{' '}
        <b>not mapped</b> to that risk there; <b>0</b> means mapped but providing no coverage. Asset volume and risk
        magnitude default to the account's total assets and the risk's magnitude — switch the field to adjust them.
      </p>

      <div className="cov-controls card">
        <label>
          Account
          <select value={acct.id} onChange={(e) => setAccountId(e.target.value)}>
            {data.environments.map((env) =>
              env.providers.map((p) => (
                <optgroup key={p.id} label={`${env.name} › ${p.name}`}>
                  {p.accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                      {a.type === 'management' ? ' (management)' : ''}
                    </option>
                  ))}
                </optgroup>
              )),
            )}
          </select>
        </label>
        <div className="seg small" role="tablist" aria-label="Field">
          {Object.entries(FIELDS).map(([id, def]) => (
            <button key={id} className={field === id ? 'on' : ''} onClick={() => setField(id)}>
              {def.label}
            </button>
          ))}
        </div>
        <span className="muted small">
          {mapped} of {data.risks.length * data.tools.length} mapped
        </span>
      </div>

      <div className="cov-bulk">
        <label className="inline">
          Copy mapping from
          <select value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)}>
            <option value="">— choose account —</option>
            {accounts
              .filter((a) => a.id !== acct.id)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.env.name} › {a.provider.name} › {a.name}
                </option>
              ))}
          </select>
        </label>
        <button className="btn small" disabled={!copyFrom} onClick={copyMapping}>
          Copy
        </button>
        <label className="inline">
          Fill blanks with
          <NumInput value={fill} min={0} max={100} onCommit={(v) => setFill(v)} />%
        </label>
        <button className="btn small" onClick={fillBlanks}>
          Fill
        </button>
        <button className="btn danger small" onClick={clearAccount}>
          Clear account
        </button>
      </div>

      <div className="table-wrap">
        <table className="matrix">
          <thead>
            <tr>
              <th className="corner">Risk ↓ / Control →</th>
              {data.tools.map((t) => (
                <th key={t.id} title={t.vendor}>
                  <span className="vert">{t.name}</span>
                  <span className="kind">{t.kind === 'process' ? 'P' : 'T'}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.risks.map((r) => (
              <tr key={r.id}>
                <th className="rowhead">
                  {r.name}
                  <span className="muted small"> · {r.magnitude}</span>
                </th>
                {data.tools.map((t) => {
                  const rec = record(r.id, t.id);
                  const value = rec ? rec[field] : null;
                  const disabled = field !== 'coverage' && !rec;
                  return (
                    <td
                      key={t.id}
                      style={rec ? { boxShadow: `inset 0 -3px 0 ${coverageCss(rec.coverage)}` } : undefined}
                      className={rec ? 'mapped' : 'unmapped'}
                    >
                      {disabled ? (
                        <span className="muted">—</span>
                      ) : (
                        <NumInput
                          value={value}
                          min={f.min}
                          max={f.max}
                          step={f.step}
                          allowEmpty={field === 'coverage'}
                          placeholder="·"
                          aria-label={`${r.name} × ${t.name} ${f.label}`}
                          onCommit={(v) => setCell(r, t.id, v)}
                        />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
