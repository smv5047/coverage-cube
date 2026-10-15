export default function Toolbar({
  metric,
  setMetric,
  filter,
  setFilter,
  threshold,
  setThreshold,
  showUnaddressed,
  setShowUnaddressed,
  onResetView,
}) {
  return (
    <div className="card toolbar">
      <div className="row">
        <span className="lbl">Size</span>
        <div className="seg small">
          <button className={metric === 'assets' ? 'on' : ''} onClick={() => setMetric('assets')}>
            Asset volume
          </button>
          <button className={metric === 'magnitude' ? 'on' : ''} onClick={() => setMetric('magnitude')}>
            Risk magnitude
          </button>
        </div>
      </div>
      <div className="row">
        <span className="lbl">Highlight</span>
        <div className="seg small">
          <button className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>
            All
          </button>
          <button className={filter === 'gaps' ? 'on' : ''} onClick={() => setFilter('gaps')}>
            Gaps
          </button>
          <button className={filter === 'none' ? 'on' : ''} onClick={() => setFilter('none')}>
            No coverage
          </button>
        </div>
      </div>
      <div className="row">
        <label className="lbl" htmlFor="thr">
          Gap below
        </label>
        <input
          id="thr"
          type="range"
          min="10"
          max="95"
          step="5"
          value={threshold}
          onChange={(e) => setThreshold(Number(e.target.value))}
        />
        <span className="val">{threshold}%</span>
      </div>
      <div className="row">
        <label className="check">
          <input type="checkbox" checked={showUnaddressed} onChange={(e) => setShowUnaddressed(e.target.checked)} />
          Show risks with no control mapped
        </label>
        <button className="btn ghost small" onClick={onResetView} title="Reset camera">
          ⟲ View
        </button>
      </div>
    </div>
  );
}
