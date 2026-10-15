import { useState } from 'react';
import { uid } from '../data/model.js';
import { TextInput, confirmDelete } from './fields.jsx';

const blank = { name: '', kind: 'tool', vendor: '', description: '' };

export default function ToolsEditor({ data, update }) {
  const [draft, setDraft] = useState(blank);

  const add = (e) => {
    e.preventDefault();
    if (!draft.name.trim()) return;
    update((d) =>
      d.tools.push({ id: uid(draft.kind === 'process' ? 'proc' : 'tool'), ...draft, name: draft.name.trim() }),
    );
    setDraft(blank);
  };

  const set = (id, field, value) =>
    update((d) => {
      const t = d.tools.find((x) => x.id === id);
      if (t) t[field] = value;
    });

  const move = (idx, dir) =>
    update((d) => {
      const j = idx + dir;
      if (j < 0 || j >= d.tools.length) return;
      [d.tools[idx], d.tools[j]] = [d.tools[j], d.tools[idx]];
    });

  return (
    <div className="ed-section">
      <h2>Tools & processes</h2>
      <p className="muted">
        Controls form the Y axis. Use “process” for people/procedural controls such as access reviews.
      </p>
      <form className="add-form" onSubmit={add}>
        <TextInput
          placeholder="Name, e.g. EDR"
          value={draft.name}
          onChange={(v) => setDraft({ ...draft, name: v })}
          required
        />
        <select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value })}>
          <option value="tool">Tool</option>
          <option value="process">Process</option>
        </select>
        <TextInput
          placeholder="Vendor / owner"
          value={draft.vendor}
          onChange={(v) => setDraft({ ...draft, vendor: v })}
        />
        <button className="btn primary" type="submit">
          + Add
        </button>
      </form>
      <div className="table-wrap">
        <table className="ed-table">
          <thead>
            <tr>
              <th />
              <th>Name</th>
              <th>Kind</th>
              <th>Vendor / owner</th>
              <th>Description</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data.tools.map((t, i) => (
              <tr key={t.id}>
                <td className="order">
                  <button className="icon-btn" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">
                    ▲
                  </button>
                  <button
                    className="icon-btn"
                    onClick={() => move(i, 1)}
                    disabled={i === data.tools.length - 1}
                    aria-label="Move down"
                  >
                    ▼
                  </button>
                </td>
                <td>
                  <TextInput value={t.name} onChange={(v) => set(t.id, 'name', v)} />
                </td>
                <td>
                  <select value={t.kind} onChange={(e) => set(t.id, 'kind', e.target.value)}>
                    <option value="tool">Tool</option>
                    <option value="process">Process</option>
                  </select>
                </td>
                <td>
                  <TextInput value={t.vendor} onChange={(v) => set(t.id, 'vendor', v)} />
                </td>
                <td>
                  <TextInput value={t.description} onChange={(v) => set(t.id, 'description', v)} />
                </td>
                <td>
                  <button
                    className="btn danger small"
                    onClick={() =>
                      confirmDelete(`“${t.name}”`, () =>
                        update((d) => (d.tools = d.tools.filter((x) => x.id !== t.id))),
                      )
                    }
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {!data.tools.length && (
              <tr>
                <td colSpan={6} className="muted center">
                  No tools or processes yet — add one above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
