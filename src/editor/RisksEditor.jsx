import { useState } from 'react';
import { uid } from '../data/model.js';
import { NumInput, TextInput, confirmDelete } from './fields.jsx';

const blank = { name: '', category: '', magnitude: 5, description: '' };

export default function RisksEditor({ data, update }) {
  const [draft, setDraft] = useState(blank);

  const add = (e) => {
    e.preventDefault();
    if (!draft.name.trim()) return;
    update((d) => d.risks.push({ id: uid('risk'), ...draft, name: draft.name.trim() }));
    setDraft(blank);
  };

  const set = (id, field, value) =>
    update((d) => {
      const r = d.risks.find((x) => x.id === id);
      if (r) r[field] = value;
    });

  const move = (idx, dir) =>
    update((d) => {
      const j = idx + dir;
      if (j < 0 || j >= d.risks.length) return;
      [d.risks[idx], d.risks[j]] = [d.risks[j], d.risks[idx]];
    });

  return (
    <div className="ed-section">
      <h2>Risks</h2>
      <p className="muted">
        Risks form the X axis. Magnitude (1–10, e.g. likelihood × impact) is the default risk magnitude for new coverage
        records and can be overridden per account.
      </p>
      <form className="add-form" onSubmit={add}>
        <TextInput
          placeholder="Risk name, e.g. Ransomware"
          value={draft.name}
          onChange={(v) => setDraft({ ...draft, name: v })}
          required
        />
        <TextInput
          placeholder="Category"
          value={draft.category}
          onChange={(v) => setDraft({ ...draft, category: v })}
        />
        <label className="inline">
          Magnitude
          <NumInput
            value={draft.magnitude}
            min={1}
            max={10}
            step={0.5}
            onCommit={(v) => setDraft({ ...draft, magnitude: v })}
          />
        </label>
        <button className="btn primary" type="submit">
          + Add risk
        </button>
      </form>
      <div className="table-wrap">
        <table className="ed-table">
          <thead>
            <tr>
              <th />
              <th>Name</th>
              <th>Category</th>
              <th>Magnitude</th>
              <th>Description</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data.risks.map((r, i) => (
              <tr key={r.id}>
                <td className="order">
                  <button className="icon-btn" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">
                    ▲
                  </button>
                  <button
                    className="icon-btn"
                    onClick={() => move(i, 1)}
                    disabled={i === data.risks.length - 1}
                    aria-label="Move down"
                  >
                    ▼
                  </button>
                </td>
                <td>
                  <TextInput value={r.name} onChange={(v) => set(r.id, 'name', v)} />
                </td>
                <td>
                  <TextInput value={r.category} onChange={(v) => set(r.id, 'category', v)} />
                </td>
                <td>
                  <NumInput
                    value={r.magnitude}
                    min={1}
                    max={10}
                    step={0.5}
                    onCommit={(v) => set(r.id, 'magnitude', v)}
                  />
                </td>
                <td>
                  <TextInput value={r.description} onChange={(v) => set(r.id, 'description', v)} />
                </td>
                <td>
                  <button
                    className="btn danger small"
                    onClick={() =>
                      confirmDelete(`risk “${r.name}”`, () =>
                        update((d) => (d.risks = d.risks.filter((x) => x.id !== r.id))),
                      )
                    }
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {!data.risks.length && (
              <tr>
                <td colSpan={6} className="muted center">
                  No risks yet — add one above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
