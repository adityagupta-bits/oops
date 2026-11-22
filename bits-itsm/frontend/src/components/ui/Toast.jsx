import React from 'react';

export default function Toast({ type = 'info', message, onDismiss }) {
  if (!message) return null;

  return (
    <div className={`bits-toast toast-${type}`} role="alert">
      <div className="toast-content">
        <span className="toast-dot" aria-hidden="true" />
        <span className="toast-message">{message}</span>
      </div>
      {onDismiss && (
        <button type="button" className="toast-dismiss" onClick={onDismiss} aria-label="Dismiss message">
          &times;
        </button>
      )}
    </div>
  );
}
