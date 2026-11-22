import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import './TextEffect.css';

// A small JSX/CSS adaptation of Motion Primitives' word-based Text Effect.

export default function TextEffect({
  children,
  className = '',
  speedReveal = 1,
  speedSegment = 1,
}) {
  const reducedMotion = useReducedMotion();
  const text = String(children ?? '');
  const tokens = text.split(/(\s+)/).filter(Boolean);
  const revealSpeed = Math.max(0.1, Number(speedReveal) || 1);
  const segmentSpeed = Math.max(0.1, Number(speedSegment) || 1);
  const variants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.07 / revealSpeed } },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 8, filter: 'blur(4px)' },
    visible: {
      opacity: 1,
      y: 0,
      filter: 'blur(0px)',
      transition: { duration: 0.34 / segmentSpeed, ease: [0.22, 1, 0.36, 1] },
    },
  };

  return (
    <motion.span
      className={`text-effect ${className}`.trim()}
      aria-label={text}
      initial={reducedMotion ? false : 'hidden'}
      animate="visible"
      variants={variants}
    >
      {tokens.map((token, index) => /\s+/.test(token)
        ? <React.Fragment key={`space-${index}`}>{token}</React.Fragment>
        : <motion.span className="text-effect-word" aria-hidden="true" key={`word-${index}`} variants={itemVariants}>{token}</motion.span>)}
    </motion.span>
  );
}
