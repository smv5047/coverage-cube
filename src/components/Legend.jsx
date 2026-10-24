import { AXIS_COLOR } from './Scene.jsx';

export default function Legend({ metric, threshold, zTitle }) {
  return (
    <div className="overlay bottom-left card legend">
      <div className="legend-row">
        <span className="lbl">Each cube is one</span>
        <div className="axis-key">
          <span style={{ '--axis': AXIS_COLOR.x }}>Risk</span>×<span style={{ '--axis': AXIS_COLOR.y }}>Tool</span>×
          <span style={{ '--axis': AXIS_COLOR.z }}>{zTitle}</span>
        </div>
      </div>
      <div className="legend-row">
        <span className="lbl">Color · coverage</span>
        <div className="gradient">
          <span className="tick" style={{ left: `${threshold}%` }} title={`Gap threshold ${threshold}%`} />
        </div>
        <div className="gradient-scale">
          <span>0%</span>
          <span>50%</span>
          <span>100%</span>
        </div>
      </div>
      <div className="legend-row sizes">
        <span className="lbl">Size · {metric === 'assets' ? 'asset volume' : 'risk magnitude'}</span>
        <span className="sz s1" />
        <span className="sz s2" />
        <span className="sz s3" />
        <span className="nc" title="No control mapped" />
        <span className="muted">no control</span>
      </div>
      <div className="hint">
        Drag to rotate · scroll/pinch to zoom · right-drag/two-finger to pan · click a cube for detail · double-click to
        drill
      </div>
    </div>
  );
}
