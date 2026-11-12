import { useState } from 'react';
import RisksEditor from './RisksEditor.jsx';
import ToolsEditor from './ToolsEditor.jsx';
import EnvironmentsEditor from './EnvironmentsEditor.jsx';
import CoverageEditor from './CoverageEditor.jsx';
import ImportExport from './ImportExport.jsx';
import { allAccounts, pruneCoverage } from '../data/model.js';

const TABS = [
  ['data', 'Import & export'],
  ['risks', 'Risks'],
  ['tools', 'Tools & processes'],
  ['envs', 'Environments'],
  ['coverage', 'Coverage & metrics'],
];

export default function Editor({ data, setData, demoData, onDone, initialTab }) {
  const [tab, setTab] = useState(() => initialTab || (data.risks.length ? 'coverage' : 'data'));

  const [notice, setNotice] = useState('');

  // Apply a mutation to a deep copy, then drop orphaned coverage records.
  const update = (fn) =>
    setData((d) => {
      const next = structuredClone(d);
      fn(next);
      return pruneCoverage(next);
    });

  const counts = {
    risks: data.risks.length,
    tools: data.tools.length,
    envs: allAccounts(data).length,
    coverage: Object.keys(data.coverage).length,
  };

  return (
    <main className="editor">
      <nav className="editor-tabs">
        {TABS.map(([id, label]) => (
          <button key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
            {label}
            {counts[id] != null && <span className="count">{counts[id]}</span>}
          </button>
        ))}
        <span className="spacer" />
        <button className="btn primary small" onClick={onDone}>
          View summary ›
        </button>
      </nav>
      <section className="editor-body">
        {notice && tab !== 'data' && (
          <p className="notice ok" role="status">
            {notice}
            <button className="icon-btn" aria-label="Dismiss" onClick={() => setNotice('')}>
              ×
            </button>
          </p>
        )}
        {tab === 'risks' && <RisksEditor data={data} update={update} />}
        {tab === 'tools' && <ToolsEditor data={data} update={update} />}
        {tab === 'envs' && <EnvironmentsEditor data={data} update={update} />}
        {tab === 'coverage' && <CoverageEditor data={data} update={update} goTo={setTab} />}
        {tab === 'data' && (
          <ImportExport
            data={data}
            setData={setData}
            demoData={demoData}
            onImported={(text) => {
              setNotice(text);
              setTab('coverage');
            }}
          />
        )}
      </section>
    </main>
  );
}
