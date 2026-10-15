import { useEffect, useState } from 'react';
import { askConfirm } from '../components/ConfirmDialog.jsx';

// Number input that keeps a local string while typing and commits a clamped
// number on blur / Enter. Empty commits `null` when allowEmpty is set.
export function NumInput({ value, onCommit, min, max, step = 1, allowEmpty = false, className = '', ...rest }) {
  const [text, setText] = useState(value == null ? '' : String(value));
  useEffect(() => {
    setText(value == null ? '' : String(value));
  }, [value]);

  const commit = () => {
    const trimmed = text.trim();
    if (trimmed === '') {
      if (allowEmpty) onCommit(null);
      else setText(value == null ? '' : String(value));
      return;
    }
    let n = Number(trimmed);
    if (Number.isNaN(n)) {
      setText(value == null ? '' : String(value));
      return;
    }
    if (min != null) n = Math.max(min, n);
    if (max != null) n = Math.min(max, n);
    if (n !== value) onCommit(n);
    setText(String(n));
  };

  return (
    <input
      type="number"
      inputMode="decimal"
      className={`num ${className}`}
      value={text}
      min={min}
      max={max}
      step={step}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') {
          setText(value == null ? '' : String(value));
          e.currentTarget.blur();
        }
      }}
      {...rest}
    />
  );
}

export function TextInput({ value, onChange, ...rest }) {
  return <input type="text" value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...rest} />;
}

export function confirmDelete(what, onConfirm) {
  askConfirm(`Delete ${what}? Any coverage recorded against it will also be removed.`).then((ok) => ok && onConfirm());
}
