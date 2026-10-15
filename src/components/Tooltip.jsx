import { STATUS_LABEL, coverageCss, formatNumber, pct, statusOf } from '../data/model.js';

export default function Tooltip({ hover, threshold }) {
  const { item, x, y } = hover;
  const isCell = !!item.tool;
  const style = {
    left: Math.min(x + 14, window.innerWidth - 250),
    top: Math.min(y + 14, window.innerHeight - 140),
  };
  return (
    <div className="tooltip" style={style}>
      <div className="tt-title">
        {item.risk.name} <span className="muted">×</span> {isCell ? item.tool.name : 'No control'}
      </div>
      <div className="muted small">{item.z.name}</div>
      {isCell ? (
        <div className="tt-grid">
          <span>Coverage</span>
          <b style={{ color: coverageCss(item.coverage) }}>
            {pct(item.coverage)} · {STATUS_LABEL[statusOf(item.coverage, threshold)]}
          </b>
          <span>Assets</span>
          <b>{formatNumber(item.assets)}</b>
          <span>Magnitude</span>
          <b>{item.magnitude.toFixed(1)} / 10</b>
        </div>
      ) : (
        <div className="small bad">No tool or process mapped to this risk here.</div>
      )}
    </div>
  );
}
