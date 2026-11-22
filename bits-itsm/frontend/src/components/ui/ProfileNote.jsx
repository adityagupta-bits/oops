import React from 'react';

// Adapted from Watermelon UI's compact Alert pattern for the BITSolve profile pages.
export default function ProfileNote({ title, children }) {
  return (
    <section className="profile-note" aria-label={title}>
      <svg className="profile-note-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v5M12 8h.01" />
      </svg>
      <div>
        <h4>{title}</h4>
        <p>{children}</p>
      </div>
    </section>
  );
}
