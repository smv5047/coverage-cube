import { coverageCss, formatNumber, pct } from '../data/model.js';

export default function KpiBar({ summary, threshold }) {
  return (
    <div className="card kpis">
      <div className="kpi">
        <span className="kpi-val" style={{ color: coverageCss(summary.coverage) }}>
          {pct(summary.coverage)}
        </span>
        <span className="kpi-lbl">Weighted coverage</span>
      </div>
      <div className="kpi">
        <span className="kpi-val">{formatNumber(summary.cells)}</span>
        <span className="kpi-lbl">Cells</span>
      </div>
      <div className="kpi">
        <span className="kpi-val warn">{summary.gap}</span>
        <span className="kpi-lbl">Gaps &lt;{threshold}%</span>
      </div>
      <div className="kpi">
        <span className="kpi-val bad">{summary.none}</span>
        <span className="kpi-lbl">No coverage</span>
      </div>
      <div className="kpi">
        <span className="kpi-val bad">{summary.unaddressed}</span>
        <span className="kpi-lbl">Unmapped risks</span>
      </div>
    </div>
  );
}
