import { useRef, useState } from 'react';
import { emptyDataset, isValidDataset, pruneCoverage } from '../data/model.js';
import { askConfirm } from '../components/ConfirmDialog.jsx';

export default function DataTab({ data, setData, demoData }) {
  const fileRef = useRef();
  const [msg, setMsg] = useState('');

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `coverage-cube-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Downloads are blocked in some sandboxed hosts, so also offer the JSON as text.
  const [jsonText, setJsonText] = useState('');
  const copyJson = async () => {
    const text = JSON.stringify(data, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      setJsonText('');
      setMsg('Copied the dataset JSON to your clipboard.');
    } catch {
      setJsonText(text);
      setMsg('Clipboard access is blocked here. Select the JSON below and copy it manually.');
    }
  };

  const importJson = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (!isValidDataset(parsed)) throw new Error('File is not a Coverage Cube dataset.');
      setData(pruneCoverage(parsed));
      setMsg(
        `Imported ${parsed.risks.length} risks, ${parsed.tools.length} controls, ${parsed.environments.length} environments.`,
      );
    } catch (err) {
      setMsg(`Import failed: ${err.message}`);
    }
  };

  return (
    <div className="ed-section">
      <h2>Import / export</h2>
      <p className="muted">
        Input-mode data is saved automatically to this browser's local storage. Export it to share or back it up.
      </p>
      <div className="empty-actions">
        <button className="btn primary" onClick={exportJson}>
          Export JSON
        </button>
        <button className="btn" onClick={copyJson}>
          Copy JSON
        </button>
        <button className="btn" onClick={() => fileRef.current?.click()}>
          Import JSON…
        </button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={importJson} />
        <button
          className="btn"
          onClick={() =>
            askConfirm('Replace your input data with the demo dataset?', { confirmLabel: 'Replace' }).then(
              (ok) => ok && setData(structuredClone(demoData)),
            )
          }
        >
          Replace with demo data
        </button>
        <button
          className="btn danger"
          onClick={() =>
            askConfirm('Delete all input-mode data? This cannot be undone.', { confirmLabel: 'Clear all' }).then(
              (ok) => ok && setData(emptyDataset()),
            )
          }
        >
          Clear all data
        </button>
      </div>
      {msg && <p className="small">{msg}</p>}
      {jsonText && (
        <textarea id="json-out" className="json-out" readOnly value={jsonText} onFocus={(e) => e.target.select()} />
      )}
    </div>
  );
}
