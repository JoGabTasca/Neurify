import React, { useRef, useState } from 'react';
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  animate,
} from 'framer-motion';
import { FastForward, Headphones } from 'lucide-react';
import { NeuralVisual } from '../components/NeuralVisual';

interface WelcomeProps {
  onStartGeneration: () => void;
  serviceMode: 'mock' | 'api';
}

export const Welcome: React.FC<WelcomeProps> = ({ onStartGeneration}) => {
  const [isActivating, setIsActivating] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const trackRef = useRef<HTMLDivElement | null>(null);
  const dragX = useMotionValue(0);

  // Fade the center label as the user swipes the thumb to the right
  const labelOpacity = useTransform(dragX, [0, 140], [1, 0]);
  const fillOpacity = useTransform(dragX, [0, 220], [0.04, 0.22]);

  const triggerStart = (maxSlide: number) => {
    if (isActivating) return;
    setIsActivating(true);
    animate(dragX, maxSlide, {
      type: 'spring',
      stiffness: 340,
      damping: 28,
      onComplete: () => {
        onStartGeneration();
      },
    });
  };

  const handleDragEnd = () => {
    if (isActivating) return;
    const containerWidth = trackRef.current?.clientWidth ?? 320;
    const maxSlide = Math.max(120, containerWidth - 76);
    const current = dragX.get();

    if (current >= maxSlide * 0.52) {
      triggerStart(maxSlide);
    } else {
      animate(dragX, 0, { type: 'spring', stiffness: 400, damping: 30 });
    }
  };

  const handleDirectClick = () => {
    if (isActivating) return;
    // Allow instant tap/click activation as well as swipe
    if (Math.abs(dragX.get()) < 8) {
      const containerWidth = trackRef.current?.clientWidth ?? 320;
      const maxSlide = Math.max(120, containerWidth - 76);
      triggerStart(maxSlide);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={
        prefersReducedMotion
          ? { opacity: 0 }
          : { opacity: 0, scale: 0.98, filter: 'blur(8px)' }
      }
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="relative h-dvh w-full bg-[#080A09] text-[#F5F7F4] flex items-center justify-center overflow-hidden select-none"
    >
      {/* Ambient deep olive-lime atmospheric background */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 50% 38%, rgba(131, 217, 76, 0.16) 0%, rgba(22, 34, 14, 0.45) 45%, #080A09 80%)',
        }}
        aria-hidden="true"
      />

      {/* Centered Clean Vertical Stage (Full screen on mobile, sculpted card feel on desktop) */}
      <div className="relative z-10 w-full max-w-[430px] h-full sm:h-[min(850px,94dvh)] sm:rounded-[44px] sm:border sm:border-[rgba(255,255,255,0.08)] sm:bg-[#0D130B]/80 sm:backdrop-blur-xl sm:shadow-[0_32px_100px_rgba(0,0,0,0.85)] flex flex-col justify-between px-7 pt-8 pb-7 safe-top safe-bottom overflow-hidden">
        {/* Soft inner top-to-bottom gradient matching Reference Image 2 */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(28, 42, 14, 0.55) 0%, rgba(16, 24, 11, 0.82) 55%, rgba(8, 10, 9, 0.98) 100%)',
          }}
          aria-hidden="true"
        />

        {/* 1. Top Center Clean Brand Name */}
        <header className="relative z-10 w-full flex flex-col items-center justify-center pt-1">
          <motion.span
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="font-display font-medium text-xl sm:text-[22px] tracking-[-0.02em] text-[#D4FF8A]"
          >
            Neurify
          </motion.span>
        </header>

        {/* 2. Center Visual Effect Below the Brand Name */}
        <div className="relative z-10 flex items-center justify-center my-auto py-1">
          <NeuralVisual isActivating={isActivating} />
        </div>

        {/* 3. Highlighted Editorial Text + Swipe CTA Bar */}
        <div className="relative z-10 w-full space-y-6">
          {/* Left-aligned strong headline & subtitle */}
          <motion.div
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 14 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="text-left space-y-2.5 px-1"
          >
            <h1 className="font-display font-semibold text-[34px] sm:text-[38px] leading-[1.08] tracking-[-0.03em] text-[#F5F7F4]">
              Music that
              <br />
              never existed.
            </h1>
          </motion.div>

          {/* Interactive Swipe-to-Generate Pill Button */}
          <div className="space-y-2.5">
            <div
              ref={trackRef}
              onClick={handleDirectClick}
              role="button"
              tabIndex={0}
              aria-label="Swipe or press Enter to generate your first track"
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleDirectClick();
                }
              }}
              className="focus-ring relative w-full h-[68px] rounded-full bg-[#162011]/90 border border-[rgba(184,255,101,0.14)] p-2 flex items-center justify-between overflow-hidden shadow-[inset_0_1px_12px_rgba(0,0,0,0.55)] cursor-pointer"
            >
              {/* Progressive highlight fill */}
              <motion.div
                className="pointer-events-none absolute inset-0 bg-[#B8FF65]"
                style={{ opacity: fillOpacity }}
              />

              {/* Draggable Lime Thumb (Left) */}
              <motion.div
                drag="x"
                dragConstraints={trackRef}
                dragElastic={0.04}
                dragMomentum={false}
                onDragEnd={handleDragEnd}
                style={{ x: dragX }}
                whileTap={{ scale: 0.96 }}
                className="relative z-20 w-[52px] h-[52px] rounded-full bg-[#B8FF65] text-[#080A09] flex items-center justify-center shadow-[0_0_24px_rgba(184,255,101,0.45)] cursor-grab active:cursor-grabbing shrink-0"
              >
                <FastForward className="w-5 h-5 fill-current" strokeWidth={2.2} />
              </motion.div>

              {/* Center Prompt Text */}
              <motion.span
                style={{ opacity: labelOpacity }}
                className="pointer-events-none absolute inset-0 flex items-center justify-center text-[13.5px] sm:text-[14px] font-medium text-[#F5F7F4]/90 tracking-[-0.01em] px-16 text-center"
              >
                Generate your first track
              </motion.span>

              {/* Right Target Circle with Headphones Icon */}
              <div
                className="relative z-10 w-[52px] h-[52px] rounded-full border border-[rgba(255,255,255,0.12)] bg-[#1B2614]/60 flex items-center justify-center text-[#F5F7F4]/85 shrink-0 pointer-events-none"
                aria-hidden="true"
              >
                <Headphones className="w-[18px] h-[18px]" strokeWidth={1.9} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
