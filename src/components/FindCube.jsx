import { useEffect, useState } from 'react';
import { AXIS_COLOR } from './Scene.jsx';

// Pick one value per axis to pin a single cube, e.g. MCP discovery × Wiz × Cloud.
export default function FindCube({ data, zAxis, selection, setSelection }) {
  const [pick, setPick] = useState({ riskId: '', toolId: '', zId: '' });

  // Mirror whatever is selected in the scene (clicks, gap queue, drill-down).
  useEffect(() => {
    setPick({
      riskId: selection?.riskId || '',
      toolId: selection?.toolId || '',
      zId: selection?.zId || '',
    });
  }, [selection]);

  const choose = (field, value) => {
    const next = { ...pick, [field]: value };
    setPick(next);
    if (next.riskId && next.toolId && next.zId) setSelection(next);
  };

  const axes = [
    { field: 'riskId', axis: 'x', label: 'Risk', items: data.risks },
    { field: 'toolId', axis: 'y', label: 'Tool / process', items: data.tools },
    { field: 'zId', axis: 'z', label: zAxis.title, items: zAxis.items },
  ];

  return (
    <div className="card find">
      <div className="find-head">
        <span className="lbl">Find a cube</span>
        {(pick.riskId || pick.toolId || pick.zId) && (
          <button
            className="btn ghost small"
            onClick={() => {
              setPick({ riskId: '', toolId: '', zId: '' });
              setSelection(null);
            }}
          >
            Clear
          </button>
        )}
      </div>
      <div className="find-row">
        {axes.map(({ field, axis, label, items }, i) => (
          <label key={field} className="find-field" style={{ '--axis': AXIS_COLOR[axis] }}>
            <span className="find-axis">{label}</span>
            <select id={`find-${field}`} value={pick[field]} onChange={(e) => choose(field, e.target.value)}>
              <option value="">Any</option>
              {items.map((it) => (
                <option key={it.id} value={it.id}>
                  {it.name}
                </option>
              ))}
            </select>
            {i < 2 && (
              <span className="find-x" aria-hidden>
                ×
              </span>
            )}
          </label>
        ))}
      </div>
    </div>
  );
}
