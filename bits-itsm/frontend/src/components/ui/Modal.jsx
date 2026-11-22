import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
const openDialogs = [];

export default function Modal({ isOpen, onClose, title, children, footer, maxWidth = '560px', className = '' }) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const titleId = useId();
  const dialogRef = useRef(null);
  useEffect(() => {
    if (!isOpen) return;
    const dialog = dialogRef.current;
    const previous = document.activeElement;
    if (!dialog.open) dialog.showModal();
    openDialogs.push(dialog);
    dialog?.querySelector('button')?.focus();
    function handleKeyDown(e) {
      if (openDialogs.at(-1) !== dialog) return;
      if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); closeRef.current(); }
      if (e.key === 'Tab') {
        const elements = [...dialog.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]')].filter(el => el.getClientRects().length);
        const first = elements[0], last = elements.at(-1);
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => { window.removeEventListener('keydown', handleKeyDown); dialog.close(); const index = openDialogs.indexOf(dialog); if (index >= 0) openDialogs.splice(index, 1); if (previous?.isConnected) previous.focus(); };
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <dialog className="bits-modal-overlay" onCancel={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); }} onClick={(e) => { e.stopPropagation(); onClose(); }} role="dialog" aria-modal="true" aria-labelledby={titleId} ref={dialogRef}>
      <div className={`bits-modal-content ${className}`} style={{ maxWidth }} onClick={(e) => e.stopPropagation()}>
        <div className="bits-modal-header">
          <h2 id={titleId} className="bits-modal-title">{title}</h2>
          <button className="bits-modal-close" onClick={onClose} aria-label="Close dialog" type="button">
            &times;
          </button>
        </div>
        <div className="bits-modal-body">{children}</div>
        {footer && <div className="bits-modal-footer">{footer}</div>}
      </div>
    </dialog>, document.body
  );
}
