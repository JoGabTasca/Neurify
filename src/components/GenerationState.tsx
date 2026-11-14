import React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { GenerationPhase } from '../types/music';

interface GenerationStateProps {
  message: string;
  progress: number;
  phase: GenerationPhase;
  onRetry?: () => void;
}

const PHASE_LABELS: Record<GenerationPhase, string> = {
  idle: 'INITIALIZING ENGINE',
  sampling_tokens: 'GPT-2 TOKEN SAMPLING',
  decoding_midi: 'MIDITOK SEQUENCE DECODING',
  synthesizing_audio: 'WAVEFORM SYNTHESIS',
  ready: 'SEQUENCE COMPLETE',
  error: 'GENERATION INTERRUPTED',
};

const HARMONIC_BARS = Array.from({ length: 23 }, (_, idx) => {
  const distFromCenter = Math.abs(idx - 11) / 11;
  const maxHeight = Math.round((1 - distFromCenter * 0.65) * 64);
  const minHeight = Math.max(8, Math.round(maxHeight * 0.2));
  return { idx, minHeight, maxHeight, isHighlight: idx % 3 === 0 };
});

export const GenerationState: React.FC<GenerationStateProps> = ({
  message,
  progress,
  phase,
  onRetry,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const isError = phase === 'error';
  const percent = Math.min(100, Math.max(8, Math.round(progress * 100)));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      className="relative w-full h-full flex flex-col items-center justify-center px-6 pb-12 overflow-hidden select-none"
      role="status"
      aria-live="polite"
    >
      {/* Radial ambient lime field */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 50% 42%, rgba(184, 255, 101, 0.16) 0%, rgba(28, 42, 16, 0.45) 48%, rgba(8, 10, 9, 0.95) 85%)',
        }}
        aria-hidden="true"
      />

      {/* Harmonic wave equalizer */}
      <div className="relative z-10 flex flex-col items-center justify-center">
        <div className="flex items-center justify-center gap-[5px] h-20">
          {HARMONIC_BARS.map((bar) => (
            <motion.span
              key={bar.idx}
              className="w-[3px] rounded-full"
              style={{
                backgroundColor: bar.isHighlight ? '#B8FF65' : 'rgba(245, 247, 244, 0.35)',
              }}
              initial={{ height: bar.minHeight }}
              animate={
                isError
                  ? { height: bar.minHeight, opacity: 0.25 }
                  : prefersReducedMotion
                    ? { height: (bar.minHeight + bar.maxHeight) / 2 }
                    : {
                        height: [
                          bar.minHeight,
                          bar.maxHeight,
                          Math.round(bar.maxHeight * 0.42),
                          bar.minHeight,
                        ],
                        opacity: bar.isHighlight ? [0.65, 1, 0.75, 0.65] : [0.25, 0.55, 0.3, 0.25],
                      }
              }
              transition={
                isError
                  ? { duration: 0.3 }
                  : {
                      duration: 1.25,
                      repeat: Infinity,
                      ease: 'easeInOut',
                      delay: bar.idx * 0.05,
                    }
              }
            />
          ))}
        </div>

        {/* Dynamic Status Message */}
        <div className="mt-5 h-7 flex items-center justify-center text-center">
          <AnimatePresence mode="wait">
            <motion.p
              key={message}
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
              animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="text-sm sm:text-[15px] font-medium text-[#F5F7F4] tracking-[-0.01em]"
            >
              {message}
            </motion.p>
          </AnimatePresence>
        </div>

        {/* Phase & Percentage Pill */}
        <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.05] border border-white/[0.08] font-mono-tech text-[10px] tracking-[0.14em] uppercase text-[#B8FF65]">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isError ? 'bg-red-400' : 'bg-[#B8FF65] animate-ping'
            }`}
          />
          <span>{PHASE_LABELS[phase]}</span>
          {!isError && <span className="text-[#F5F7F4]/70 tabular-nums">· {percent}%</span>}
          {isError && onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="ml-1 underline text-[#F5F7F4] hover:text-[#B8FF65] cursor-pointer"
            >
              RETRY
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
};
