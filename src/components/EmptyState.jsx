export default function EmptyState({ data, onEdit, onLoadDemo }) {
  const missing = [];
  if (!data.risks.length) missing.push('risks');
  if (!data.tools.length) missing.push('tools or processes');
  if (!data.environments.length) missing.push('environments');
  return (
    <div className="empty">
      <div className="card empty-card">
        <h2>Your coverage cube is empty</h2>
        <p>
          Input mode stores your own data in this browser. To render the cube, add at least one of each:{' '}
          {missing.join(', ')}— then set coverage per account in the coverage matrix.
        </p>
        <div className="empty-actions">
          <button className="btn primary" onClick={onEdit}>
            Start adding data
          </button>
          <button className="btn" onClick={onLoadDemo}>
            Start from demo data
          </button>
        </div>
      </div>
    </div>
  );
}
