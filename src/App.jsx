import { useCallback, useEffect, useMemo, useState } from 'react';
import Scene from './components/Scene.jsx';
import Toolbar from './components/Toolbar.jsx';
import KpiBar from './components/KpiBar.jsx';
import Legend from './components/Legend.jsx';
import DetailPanel from './components/DetailPanel.jsx';
import Tooltip from './components/Tooltip.jsx';
import Breadcrumb from './components/Breadcrumb.jsx';
import EmptyState from './components/EmptyState.jsx';
import Editor from './editor/Editor.jsx';
import ConfirmHost from './components/ConfirmDialog.jsx';
import { DEMO_SETS } from './data/demo.js';
import FindCube from './components/FindCube.jsx';
import { buildCells, resolveDrill, summarize } from './data/model.js';
import { loadInputData, loadPrefs, saveInputData, savePrefs } from './data/storage.js';

const prefs0 = loadPrefs();
const isSmallScreen = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 600px)').matches;

export default function App() {
  const [demoSet, setDemoSet] = useState(DEMO_SETS[prefs0.demoSet] ? prefs0.demoSet : 'overview');
  const demoData = useMemo(() => DEMO_SETS[demoSet].build(), [demoSet]);
  const [inputData, setInputData] = useState(() => loadInputData());
  const [mode, setMode] = useState(prefs0.mode === 'input' ? 'input' : 'demo');
  const [view, setView] = useState('visualize');
  const [metric, setMetric] = useState(prefs0.metric === 'magnitude' ? 'magnitude' : 'assets');
  const [filter, setFilter] = useState('all');
  const [threshold, setThreshold] = useState(Number(prefs0.threshold) || 60);
  const [showUnaddressed, setShowUnaddressed] = useState(prefs0.showUnaddressed !== false);
  const [drill, setDrill] = useState({ envId: null, providerId: null });
  const [selection, setSelection] = useState(null);
  const [hover, setHover] = useState(null);
  const [fitKey, setFitKey] = useState(0);
  const [saveState, setSaveState] = useState('saved');
  const [controlsOpen, setControlsOpen] = useState(() => !isSmallScreen());

  const data = mode === 'demo' ? demoData : inputData;

  useEffect(() => {
    savePrefs({ mode, demoSet, metric, threshold, showUnaddressed });
  }, [mode, demoSet, metric, threshold, showUnaddressed]);

  useEffect(() => {
    setSaveState(saveInputData(inputData) ? 'saved' : 'error');
  }, [inputData]);

  // Keep drill path valid if edits removed its target.
  const { env: drillEnv, provider: drillProvider } = resolveDrill(data, drill);
  useEffect(() => {
    if ((drill.envId && !drillEnv) || (drill.providerId && !drillProvider)) {
      setDrill({ envId: drillEnv?.id ?? null, providerId: drillProvider?.id ?? null });
      setSelection(null);
    }
  }, [drill, drillEnv, drillProvider]);

  const { z, cells, unaddressed } = useMemo(() => buildCells(data, drill, threshold), [data, drill, threshold]);
  const summary = useMemo(() => summarize(cells, unaddressed), [cells, unaddressed]);

  const switchMode = (m) => {
    setMode(m);
    setDrill({ envId: null, providerId: null });
    setSelection(null);
    setHover(null);
    if (m === 'demo') setView('visualize');
    setFitKey((k) => k + 1);
  };

  const switchDemoSet = (set) => {
    setDemoSet(set);
    setDrill({ envId: null, providerId: null });
    setSelection(null);
    setHover(null);
    setFitKey((k) => k + 1);
  };

  const drillTo = useCallback((next, nextSelection) => {
    setDrill(next);
    setSelection(nextSelection);
    setHover(null);
    setFitKey((k) => k + 1);
  }, []);

  // Go one level deeper into a z item (environment → provider → account).
  const drillInto = useCallback(
    (zItem, riskId, toolId, childId = null) => {
      const keep = riskId ? { riskId, toolId: toolId ?? null, zId: childId } : null;
      if (zItem.level === 'environment') drillTo({ envId: zItem.id, providerId: null }, keep);
      else if (zItem.level === 'provider') drillTo({ envId: drill.envId, providerId: zItem.id }, keep);
    },
    [drill.envId, drillTo],
  );

  const handleSelect = useCallback((item) => {
    setSelection({ riskId: item.risk.id, toolId: item.tool ? item.tool.id : null, zId: item.z.id });
  }, []);

  const handleDrill = useCallback(
    (cell) => {
      if (cell.z.level === 'account') handleSelect(cell);
      else drillInto(cell.z, cell.risk.id, cell.tool.id);
    },
    [drillInto, handleSelect],
  );

  const handleHover = useCallback((item, ev) => {
    if (!item) setHover(null);
    else setHover({ item, x: ev.clientX, y: ev.clientY });
  }, []);

  const goToLevel = (level) => {
    const keep = selection ? { riskId: selection.riskId, toolId: selection.toolId } : null;
    if (level === 'root') {
      drillTo({ envId: null, providerId: null }, keep ? { ...keep, zId: drill.envId } : null);
    } else if (level === 'env') {
      drillTo({ envId: drill.envId, providerId: null }, keep ? { ...keep, zId: drill.providerId } : null);
    }
  };

  const loadDemoIntoInput = () => {
    setInputData(structuredClone(demoData));
    setMode('input');
    setDrill({ envId: null, providerId: null });
    setSelection(null);
    setFitKey((k) => k + 1);
  };

  const isEmpty = !data.risks.length || !data.tools.length || !data.environments.length;
  const showEditor = mode === 'input' && view === 'edit';

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo" aria-hidden>
            <i style={{ background: '#ef4444' }} />
            <i style={{ background: '#eab308' }} />
            <i style={{ background: '#22c55e' }} />
            <i style={{ background: '#22c55e' }} />
          </span>
          <div>
            <h1>Coverage Cube</h1>
            <p className="subtitle">Risk × control × environment coverage</p>
          </div>
        </div>
        <div className="topbar-actions">
          <div className="seg" role="tablist" aria-label="Mode">
            <button className={mode === 'demo' ? 'on' : ''} onClick={() => switchMode('demo')}>
              Demo
            </button>
            <button className={mode === 'input' ? 'on' : ''} onClick={() => switchMode('input')}>
              Input
            </button>
          </div>
          {mode === 'input' && (
            <div className="seg" aria-label="View">
              <button className={view === 'visualize' ? 'on' : ''} onClick={() => setView('visualize')}>
                Visualize
              </button>
              <button className={view === 'edit' ? 'on' : ''} onClick={() => setView('edit')}>
                Edit data
              </button>
            </div>
          )}
          {mode === 'demo' && (
            <div className="seg" aria-label="Demo dataset">
              {Object.entries(DEMO_SETS).map(([id, def]) => (
                <button key={id} className={demoSet === id ? 'on' : ''} onClick={() => switchDemoSet(id)}>
                  {def.label}
                </button>
              ))}
            </div>
          )}
          {mode === 'demo' && (
            <button
              className="btn ghost small hide-sm"
              onClick={loadDemoIntoInput}
              title="Copy demo data into Input mode to edit it"
            >
              Copy to Input
            </button>
          )}
          {mode === 'input' && (
            <span className={`save-pill ${saveState}`} title="Input-mode data persists to this browser's local storage">
              {saveState === 'saved' ? 'Saved locally' : 'Save failed'}
            </span>
          )}
        </div>
      </header>

      {showEditor ? (
        <Editor data={inputData} setData={setInputData} demoData={demoData} onDone={() => setView('visualize')} />
      ) : (
        <main className="stage">
          {isEmpty ? (
            <EmptyState data={data} onEdit={() => setView('edit')} onLoadDemo={loadDemoIntoInput} />
          ) : (
            <>
              <Scene
                data={data}
                zAxis={z}
                cells={cells}
                unaddressed={unaddressed}
                showUnaddressed={showUnaddressed}
                metric={metric}
                filter={filter}
                selection={selection}
                fitKey={fitKey}
                onSelect={handleSelect}
                onDrill={handleDrill}
                onHover={handleHover}
                onClear={() => setSelection(null)}
              />
              <div className="overlay top-left">
                <Breadcrumb env={drillEnv} provider={drillProvider} zTitle={z.title} onGo={goToLevel} />
                <FindCube data={data} zAxis={z} selection={selection} setSelection={setSelection} />
                <KpiBar summary={summary} threshold={threshold} metric={metric} />
                <button className="btn small controls-toggle" onClick={() => setControlsOpen((o) => !o)}>
                  {controlsOpen ? 'Hide controls ▴' : 'Size, highlight & filters ▾'}
                </button>
                {controlsOpen && (
                  <Toolbar
                    metric={metric}
                    setMetric={setMetric}
                    filter={filter}
                    setFilter={setFilter}
                    threshold={threshold}
                    setThreshold={setThreshold}
                    showUnaddressed={showUnaddressed}
                    setShowUnaddressed={setShowUnaddressed}
                    onResetView={() => setFitKey((k) => k + 1)}
                  />
                )}
              </div>
              <Legend metric={metric} threshold={threshold} zTitle={z.title} />
              <DetailPanel
                data={data}
                zAxis={z}
                cells={cells}
                unaddressed={unaddressed}
                selection={selection}
                setSelection={setSelection}
                threshold={threshold}
                filter={filter}
                drillInto={drillInto}
                startCollapsed={isSmallScreen()}
                mode={mode}
                onEdit={() => setView('edit')}
              />
              {hover && <Tooltip hover={hover} threshold={threshold} />}
            </>
          )}
        </main>
      )}
      <ConfirmHost />
    </div>
  );
}
