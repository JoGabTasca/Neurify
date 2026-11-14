import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

interface LogoProps {
  onClick?: () => void;
  isActive?: boolean;
  size?: 'sm' | 'md';
}

export const Logo: React.FC<LogoProps> = ({ onClick, isActive = false, size = 'md' }) => {
  const prefersReducedMotion = useReducedMotion();
  const isSmall = size === 'sm';

  const content = (
    <span className="inline-flex items-center gap-2.5 select-none group">
      <span
        className={`relative flex items-center justify-center rounded-lg bg-[#121614] border border-[rgba(255,255,255,0.08)] transition-colors duration-300 group-hover:border-[#B8FF65]/40 ${
          isSmall ? 'w-7 h-7' : 'w-8 h-8'
        }`}
      >
        <svg
          viewBox="0 0 28 28"
          fill="none"
          className={isSmall ? 'w-4 h-4' : 'w-[18px] h-[18px]'}
          aria-hidden="true"
        >
          {/* Subtle neural connection curve */}
          <path
            d="M5 14C8.5 9 11 19 14 14C17 9 19.5 19 23 14"
            stroke="rgba(184,255,101,0.28)"
            strokeWidth="1.2"
            strokeLinecap="round"
          />

          {/* Harmonic wave bars */}
          <motion.line
            x1="6"
            y1="18"
            x2="6"
            y2="10"
            stroke="#83D94C"
            strokeWidth="1.8"
            strokeLinecap="round"
            animate={
              isActive && !prefersReducedMotion
                ? { y1: [18, 19.5, 17, 18], y2: [10, 8.5, 11, 10] }
                : undefined
            }
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.line
            x1="10"
            y1="21"
            x2="10"
            y2="7"
            stroke="#B8FF65"
            strokeWidth="1.8"
            strokeLinecap="round"
            animate={
              isActive && !prefersReducedMotion
                ? { y1: [21, 18.5, 21.5, 21], y2: [7, 9.5, 6.5, 7] }
                : undefined
            }
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut', delay: 0.15 }}
          />
          <motion.line
            x1="14"
            y1="17"
            x2="14"
            y2="11"
            stroke="#F5F7F4"
            strokeWidth="1.8"
            strokeLinecap="round"
            animate={
              isActive && !prefersReducedMotion
                ? { y1: [17, 20, 16.5, 17], y2: [11, 8, 11.5, 11] }
                : undefined
            }
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
          />
          <motion.line
            x1="18"
            y1="21.5"
            x2="18"
            y2="6.5"
            stroke="#B8FF65"
            strokeWidth="1.8"
            strokeLinecap="round"
            animate={
              isActive && !prefersReducedMotion
                ? { y1: [21.5, 18, 22, 21.5], y2: [6.5, 10, 6, 6.5] }
                : undefined
            }
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut', delay: 0.1 }}
          />
          <motion.line
            x1="22"
            y1="17.5"
            x2="22"
            y2="10.5"
            stroke="#83D94C"
            strokeWidth="1.8"
            strokeLinecap="round"
            animate={
              isActive && !prefersReducedMotion
                ? { y1: [17.5, 19, 16.5, 17.5], y2: [10.5, 9, 11.5, 10.5] }
                : undefined
            }
            transition={{ duration: 1.9, repeat: Infinity, ease: 'easeInOut', delay: 0.25 }}
          />

          {/* Neural synaptic nodes */}
          <circle cx="10" cy="7" r="1.5" fill="#B8FF65" />
          <circle cx="18" cy="6.5" r="1.5" fill="#B8FF65" />
        </svg>
      </span>

      <span
        className={`font-display font-semibold tracking-[-0.02em] text-[#F5F7F4] ${
          isSmall ? 'text-base' : 'text-[17px]'
        }`}
      >
        Neurify
      </span>
    </span>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="focus-ring rounded-lg py-1 px-1.5 -ml-1.5 text-left transition-opacity hover:opacity-90 cursor-pointer"
        aria-label="Neurify — Return to welcome screen"
      >
        {content}
      </button>
    );
  }

  return content;
};
