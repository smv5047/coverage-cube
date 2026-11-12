import { useRef, useState } from 'react';
import { allAccounts, emptyDataset, isValidDataset, pruneCoverage } from '../data/model.js';
import { COLUMNS, REQUIRED_KEYS, datasetToCsv, importCsvText, templateCsv } from '../data/csv.js';
import { copyText, downloadText, today } from '../data/download.js';
import { askConfirm } from '../components/ConfirmDialog.jsx';

const hasData = (d) => d.risks.length + d.tools.length + d.environments.length > 0;

export default function ImportExport({ data, setData, demoData, onImported }) {
  const fileRef = useRef();
  const [msg, setMsg] = useState(null); // { tone, text }
  const [pending, setPending] = useState(null); // { name, kind, text | json }
  const [mode, setMode] = useState(hasData(data) ? 'merge' : 'replace');
  const [dragging, setDragging] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [jsonText, setJsonText] = useState('');

  const say = (text, tone = 'ok') => setMsg({ text, tone });

  const stage = (name, text) => {
    setMsg(null);
    const trimmed = text.trim();
    if (!trimmed) return say(`${name} is empty.`, 'bad');
    if (trimmed[0] === '{') {
      try {
        const json = JSON.parse(trimmed);
        if (!isValidDataset(json)) throw new Error('not a Coverage Cube backup');
        setPending({ name, kind: 'json', json: pruneCoverage(json) });
        setMode('replace');
      } catch (err) {
        say(`${name} could not be read: ${err.message}.`, 'bad');
      }
      return;
    }
    const check = importCsvText(text, data, 'replace');
    if (check.error) return say(`${name}: ${check.error}`, 'bad');
    setPending({ name, kind: 'csv', text });
    setMode(hasData(data) ? 'merge' : 'replace');
  };

  const readFile = async (file) => {
    if (!file) return;
    stage(file.name, await file.text());
  };

  // Preview is recomputed for the chosen mode so the counts are exact.
  const preview = pending?.kind === 'csv' ? importCsvText(pending.text, data, mode) : null;

  const apply = () => {
    if (pending.kind === 'json') {
      setData(pending.json);
      onImported?.(`Restored ${pending.name}.`);
    } else {
      setData(pruneCoverage(preview.data));
      const s = preview.stats;
      onImported?.(
        `Imported ${pending.name}: ${s.records} new and ${s.updated} updated coverage values. Review and adjust them below.`,
      );
    }
    setPending(null);
    setPasteText('');
  };

  const accountCount = allAccounts(data).length;
  const combos = data.risks.length * data.tools.length * accountCount;

  return (
    <div className="ed-section io">
      <h2>Import & export</h2>
      <p className="muted">
        Work in a spreadsheet, then bring it here. Download a template, fill one row per risk, tool and environment,
        import it, and fine-tune the numbers in the other tabs. Everything stays in this browser.
      </p>

      {msg && (
        <p className={`notice ${msg.tone}`} role="status">
          {msg.text}
        </p>
      )}

      <section className="card io-step">
        <h3>
          <span className="step">1</span> Get a spreadsheet
        </h3>
        <div className="io-options">
          <div>
            <button
              className="btn primary"
              onClick={() => downloadText('coverage-cube-template.csv', templateCsv(), 'text/csv')}
            >
              Download template
            </button>
            <p className="muted small">Column headers plus six example rows to overwrite. Opens in Excel or Sheets.</p>
          </div>
          <div>
            <button
              className="btn"
              disabled={!hasData(data)}
              onClick={() => downloadText(`coverage-cube-data-${today()}.csv`, datasetToCsv(data), 'text/csv')}
            >
              Export my data
            </button>
            <p className="muted small">Your current coverage as a spreadsheet, ready to edit and re-import.</p>
          </div>
          <div>
            <button
              className="btn"
              disabled={!combos}
              onClick={() =>
                downloadText(
                  `coverage-cube-fill-in-${today()}.csv`,
                  datasetToCsv(data, { includeBlank: true }),
                  'text/csv',
                )
              }
            >
              Export fill-in sheet
            </button>
            <p className="muted small">
              Every risk × tool × account combination{combos ? ` (${combos.toLocaleString()} rows)` : ''}, with blanks
              where nothing is recorded yet.
            </p>
          </div>
        </div>
        <details className="io-guide">
          <summary>What goes in each column</summary>
          <div className="table-wrap">
            <table className="ed-table compact">
              <thead>
                <tr>
                  <th>Column</th>
                  <th>Required</th>
                  <th>What to enter</th>
                </tr>
              </thead>
              <tbody>
                {COLUMNS.map((c) => (
                  <tr key={c.key}>
                    <td>
                      <b>{c.header}</b>
                    </td>
                    <td>{REQUIRED_KEYS.includes(c.key) ? 'Yes' : ''}</td>
                    <td>{c.help}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted small">
            Column order does not matter and extra columns are ignored. Common names such as “Control”, “Env” or
            “Coverage” are recognized. A high-level sheet needs only Risk, Tool / process, Environment and Coverage %.
          </p>
        </details>
      </section>

      <section className="card io-step">
        <h3>
          <span className="step">2</span> Import
        </h3>
        <div
          className={`dropzone ${dragging ? 'over' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            readFile(e.dataTransfer.files?.[0]);
          }}
        >
          <p>
            Drop a <b>.csv</b> file here, or a <b>.json</b> backup
          </p>
          <button className="btn primary" onClick={() => fileRef.current?.click()}>
            Choose file…
          </button>
          <input
            id="import-file"
            ref={fileRef}
            type="file"
            accept=".csv,.tsv,.txt,.json,text/csv,application/json"
            hidden
            onChange={(e) => {
              readFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </div>
        <details className="io-guide">
          <summary>Or paste rows copied from a spreadsheet</summary>
          <textarea
            id="import-paste"
            className="json-out"
            placeholder={'Risk\tTool / process\tEnvironment\tCoverage %\nRansomware\tCrowdStrike\tWorkstation\t92'}
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
          />
          <button className="btn" disabled={!pasteText.trim()} onClick={() => stage('Pasted rows', pasteText)}>
            Check pasted rows
          </button>
        </details>

        {pending && (
          <div className="preview" role="region" aria-label="Import preview">
            <h4>Ready to import: {pending.name}</h4>
            {pending.kind === 'json' ? (
              <p>
                Full backup with {pending.json.risks.length} risks, {pending.json.tools.length} tools and processes,{' '}
                {allAccounts(pending.json).length} accounts and {Object.keys(pending.json.coverage).length} coverage
                values. Restoring it replaces your current data.
              </p>
            ) : (
              <>
                {hasData(data) && (
                  <div className="seg" role="radiogroup" aria-label="How to import">
                    <button className={mode === 'merge' ? 'on' : ''} onClick={() => setMode('merge')}>
                      Add to my data
                    </button>
                    <button className={mode === 'replace' ? 'on' : ''} onClick={() => setMode('replace')}>
                      Replace my data
                    </button>
                  </div>
                )}
                <p className="muted small">
                  {mode === 'merge' && hasData(data)
                    ? 'Rows are matched to your existing risks, tools and accounts by name. Matching values are updated; everything else is kept.'
                    : 'Your current risks, tools, environments and coverage are replaced. The report title and saved snapshots are kept.'}
                </p>
                <dl className="stats">
                  <div>
                    <dt>Rows read</dt>
                    <dd>{preview.stats.rows}</dd>
                  </div>
                  <div>
                    <dt>New coverage values</dt>
                    <dd>{preview.stats.records}</dd>
                  </div>
                  <div>
                    <dt>Updated values</dt>
                    <dd>{preview.stats.updated}</dd>
                  </div>
                  <div>
                    <dt>New risks</dt>
                    <dd>{preview.stats.risks}</dd>
                  </div>
                  <div>
                    <dt>New tools</dt>
                    <dd>{preview.stats.tools}</dd>
                  </div>
                  <div>
                    <dt>New accounts</dt>
                    <dd>{preview.stats.accounts}</dd>
                  </div>
                  <div>
                    <dt>Blank (not mapped)</dt>
                    <dd>{preview.stats.blank}</dd>
                  </div>
                  <div>
                    <dt>Skipped</dt>
                    <dd className={preview.stats.skipped ? 'bad' : ''}>{preview.stats.skipped}</dd>
                  </div>
                </dl>
                {preview.warnings.length > 0 && (
                  <details className="warnings" open={preview.warnings.length <= 6}>
                    <summary>
                      {preview.warnings.length} thing{preview.warnings.length > 1 ? 's' : ''} to check
                    </summary>
                    <ul>
                      {preview.warnings.slice(0, 50).map((w, i) => (
                        <li key={i}>
                          {w.row ? <b>Row {w.row}: </b> : null}
                          {w.msg}
                        </li>
                      ))}
                      {preview.warnings.length > 50 && <li>…and {preview.warnings.length - 50} more.</li>}
                    </ul>
                  </details>
                )}
              </>
            )}
            <div className="empty-actions">
              <button className="btn primary" onClick={apply}>
                {pending.kind === 'json'
                  ? 'Restore backup'
                  : mode === 'merge' && hasData(data)
                    ? 'Add to my data'
                    : 'Import'}
              </button>
              <button className="btn" onClick={() => setPending(null)}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="card io-step">
        <h3>
          <span className="step">3</span> Back up or start over
        </h3>
        <div className="empty-actions">
          <button
            className="btn"
            disabled={!hasData(data)}
            onClick={() =>
              downloadText(`coverage-cube-backup-${today()}.json`, JSON.stringify(data, null, 2), 'application/json')
            }
          >
            Download full backup (JSON)
          </button>
          <button
            className="btn"
            disabled={!hasData(data)}
            onClick={async () => {
              const text = JSON.stringify(data, null, 2);
              if (await copyText(text)) {
                setJsonText('');
                say('Backup copied to your clipboard.');
              } else {
                setJsonText(text);
                say('Clipboard access is blocked here. Select the text below and copy it.', 'bad');
              }
            }}
          >
            Copy backup
          </button>
          <button
            className="btn"
            onClick={() =>
              (hasData(data)
                ? askConfirm('Replace your data with the current demo dataset?', { confirmLabel: 'Replace' })
                : Promise.resolve(true)
              ).then((ok) => {
                if (!ok) return;
                setData({ ...structuredClone(demoData), meta: data.meta || { title: '' }, snapshots: [] });
                onImported?.('Demo data loaded as your starting point. Adjust it below.');
              })
            }
          >
            Start from demo data
          </button>
          <button
            className="btn danger"
            disabled={!hasData(data)}
            onClick={() =>
              askConfirm('Delete all of your data, including saved snapshots? This cannot be undone.', {
                confirmLabel: 'Clear all',
              }).then((ok) => ok && (setData(emptyDataset()), say('All data cleared.')))
            }
          >
            Clear all data
          </button>
        </div>
        <p className="muted small">
          The backup keeps everything, including the report title and saved snapshots. The spreadsheet export keeps
          risks, tools, environments and coverage.
        </p>
        {jsonText && (
          <textarea id="json-out" className="json-out" readOnly value={jsonText} onFocus={(e) => e.target.select()} />
        )}
      </section>
    </div>
  );
}
