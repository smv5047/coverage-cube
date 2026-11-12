export default function EmptyState({ onImport, onEdit, onLoadDemo }) {
  return (
    <div className="empty">
      <div className="card empty-card">
        <h2>Add your coverage data</h2>
        <p>
          Nothing here yet. The quickest route is a spreadsheet: download the template, fill one row per risk, tool and
          environment, and import it. You can then adjust any value in the app. Your data stays in this browser.
        </p>
        <div className="empty-actions">
          <button className="btn primary" onClick={onImport}>
            Import a spreadsheet
          </button>
          <button className="btn" onClick={onLoadDemo}>
            Start from the demo
          </button>
          <button className="btn ghost" onClick={onEdit}>
            Enter it by hand
          </button>
        </div>
      </div>
    </div>
  );
}
