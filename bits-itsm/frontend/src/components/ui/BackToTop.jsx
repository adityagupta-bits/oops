/*
From Uiverse.io by satyamchaudharydev - https://uiverse.io/satyamchaudharydev/hungry-parrot-44
MIT License, Copyright (c) satyamchaudharydev (satyam)
*/

import React, { useEffect, useState } from 'react';
import './BackToTop.css';

export default function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > 250);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  return (
    <div className={`bits-back-to-top-wrapper ${visible ? 'is-visible' : ''}`}>
      <button
        type="button"
        className="bits-back-to-top"
        onClick={scrollToTop}
        aria-label="Back to top"
        title="Back to top"
      >
        <div className="text" aria-hidden="true">
          <span>Back</span>
          <span>to</span>
          <span>top</span>
        </div>
        <div className="clone" aria-hidden="true">
          <span>Back</span>
          <span>to</span>
          <span>top</span>
        </div>
        <svg
          strokeWidth="2"
          stroke="currentColor"
          viewBox="0 0 24 24"
          fill="none"
          className="h-6 w-6"
          xmlns="http://www.w3.org/2000/svg"
          width="20px"
          aria-hidden="true"
        >
          <path
            d="M14 5l7 7m0 0l-7 7m7-7H3"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}
