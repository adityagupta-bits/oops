import React from 'react';

export default function Button27({ isOpen, onToggle, controls = 'student-sidebar' }) {
  return (
    <button className="menu-toggle" type="button" onClick={onToggle}
      aria-label={isOpen ? 'Close menu' : 'Open menu'} aria-expanded={isOpen} aria-controls={controls}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <path d={isOpen ? 'M6 6l12 12M6 18L18 6' : 'M4 6h16M4 12h16M4 18h16'} />
      </svg>
    </button>
  );
}
