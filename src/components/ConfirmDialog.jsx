import { useEffect, useRef, useSyncExternalStore } from 'react';

// In-page replacement for window.confirm(), which some hosts (e.g. sandboxed
// iframes) silently block. Call askConfirm() anywhere; <ConfirmHost /> renders it.
let pending = null;
const listeners = new Set();
const emit = () => listeners.forEach((l) => l());

export function askConfirm(message, { confirmLabel = 'Delete', danger = true } = {}) {
  return new Promise((resolve) => {
    pending?.resolve(false);
    pending = { message, confirmLabel, danger, resolve };
    emit();
  });
}

function settle(result) {
  if (!pending) return;
  pending.resolve(result);
  pending = null;
  emit();
}

const subscribe = (l) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export default function ConfirmHost() {
  const req = useSyncExternalStore(subscribe, () => pending);
  const okRef = useRef();

  useEffect(() => {
    if (!req) return;
    okRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && settle(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [req]);

  if (!req) return null;
  return (
    <div className="modal-backdrop" onClick={() => settle(false)}>
      <div className="card modal" role="alertdialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <p>{req.message}</p>
        <div className="empty-actions">
          <button className="btn" onClick={() => settle(false)}>
            Cancel
          </button>
          <button ref={okRef} className={`btn ${req.danger ? 'danger solid' : 'primary'}`} onClick={() => settle(true)}>
            {req.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
