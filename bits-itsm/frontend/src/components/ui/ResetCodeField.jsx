import React, { useId, useState } from 'react';

// Watermelon Form 1's verification field, adapted for BITSolve's 43-character reset codes.
export default function ResetCodeField({ value, onChange, disabled, error }) {
  const id = useId();
  const [visible, setVisible] = useState(false);

  return (
    <div className="reset-code-field">
      <label htmlFor={id}>Single-use reset code</label>
      <div className="reset-code-control">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          autoComplete="one-time-code"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          maxLength={128}
          required
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={`${id}-hint${error ? ` ${id}-error` : ''}`}
        />
        <button type="button" onClick={() => setVisible((current) => !current)} disabled={disabled} aria-label={visible ? 'Hide reset code' : 'Show reset code'}>
          {visible ? 'Hide' : 'Show'}
        </button>
      </div>
      <p id={`${id}-hint`} className="reset-code-hint">Paste the code shared by your administrator. It expires after 30 minutes.</p>
      {error && <p id={`${id}-error`} className="reset-code-error" role="alert">{error}</p>}
    </div>
  );
}
