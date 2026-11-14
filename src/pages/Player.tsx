import React, { useEffect } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { AlertCircle, ChevronLeft } from 'lucide-react';
import { AlbumArtwork } from '../components/AlbumArtwork';
import { GenerationState } from '../components/GenerationState';
import { MusicControls } from '../components/MusicControls';
import { ProgressBar } from '../components/ProgressBar';
import type { GenerationPhase, TrackMetadata } from '../types/music';

interface PlayerProps {
  currentTrack: TrackMetadata | null;
  isGenerating: boolean;
  generationMessage: string;
  generationProgress: number;
  generationPhase: GenerationPhase;
  isPlaying: boolean;
  isLooping: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  error: string | null;
  serviceMode: 'mock' | 'api';
  onBackToWelcome: () => void;
  onTogglePlayPause: () => void;
  onToggleLoop: () => void;
  onSkipToNewTrack: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (val: number) => void;
  onToggleMute: () => void;
}

export const Player: React.FC<PlayerProps> = ({
  currentTrack,
  isGenerating,
  generationMessage,
  generationProgress,
  generationPhase,
  isPlaying,
  isLooping,
  currentTime,
  duration,
  volume,
  isMuted,
  error,
  onBackToWelcome,
  onTogglePlayPause,
  onToggleLoop,
  onSkipToNewTrack,
  onSeek,
  onVolumeChange,
  onToggleMute,
}) => {
  const prefersReducedMotion = useReducedMotion();

  // Spacebar shortcut for Play / Pause
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tagName = target?.tagName.toLowerCase();
      if (
        tagName === 'button' ||
        tagName === 'input' ||
        target?.getAttribute('role') === 'slider'
      ) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        onTogglePlayPause();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onTogglePlayPause]);

  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.985 }}
      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
      exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.985 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="relative h-dvh w-full bg-[#080A09] text-[#F5F7F4] flex items-center justify-center overflow-hidden select-none"
    >
      {/* Ambient backdrop glow on desktop */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 50% 50%, rgba(131, 217, 76, 0.14) 0%, rgba(18, 26, 12, 0.45) 45%, #080A09 80%)',
        }}
        aria-hidden="true"
      />

      {/* Sculpted Player Frame (Full viewport on mobile, sleek vertical console on desktop) */}
      <div className="relative z-10 w-full max-w-[430px] h-full sm:h-[min(860px,94dvh)] sm:rounded-[44px] sm:border sm:border-[rgba(255,255,255,0.09)] bg-[#0B0F09] sm:shadow-[0_32px_100px_rgba(0,0,0,0.85)] flex flex-col justify-between overflow-hidden">
        {/* =========================================================
            UPPER STAGE: Clean Full-bleed Generative Artwork + Floating Nav
           ========================================================= */}
        <div className="relative w-full h-[55%] shrink-0 overflow-hidden">
          {/* Procedural Artwork OR Neural Generation State */}
          <AnimatePresence mode="wait">
            {isGenerating || !currentTrack ? (
              <GenerationState
                key="generating-backdrop"
                message={generationMessage}
                progress={generationProgress}
                phase={generationPhase}
                onRetry={onSkipToNewTrack}
              />
            ) : (
              <AlbumArtwork
                key={`artwork-${currentTrack.id}`}
                track={currentTrack}
                isPlaying={isPlaying}
              />
            )}
          </AnimatePresence>

          {/* Warm olive bottom vignette blending seamlessly into the dome */}
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-40"
            style={{
              background:
                'linear-gradient(180deg, rgba(11, 15, 9, 0) 0%, rgba(22, 33, 12, 0.68) 65%, rgba(20, 30, 11, 0.96) 100%)',
            }}
            aria-hidden="true"
          />

          {/* Floating Top Header (Back `<` on left, centered status pill, balanced right spacer) */}
          <header className="absolute top-0 inset-x-0 z-30 flex items-center justify-between px-6 pt-5 safe-top">
            <button
              type="button"
              onClick={onBackToWelcome}
              aria-label="Return to welcome screen"
              className="focus-ring w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-md border border-white/15 flex items-center justify-center text-[#F5F7F4] transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5 -ml-0.5" />
            </button>

            {currentTrack?.isMock && !isGenerating && (
              <div
                title="Running in local MOCK demonstration mode while awaiting GPT-2 checkpoint"
                className="px-2.5 py-1 rounded-full bg-black/35 backdrop-blur-md border border-white/10 font-mono-tech text-[10px] tracking-[0.14em] uppercase text-[#B8FF65]/90"
              >
                MOCK · DEMO
              </div>
            )}

            {/* Invisible spacer for optical centering */}
            <div className="w-10 h-10" aria-hidden="true" />
          </header>
        </div>

        {/* =========================================================
            LOWER STAGE: Curved Convex Dome Console + Arc Progress + Energy Orb
           ========================================================= */}
        <div className="relative z-20 w-[134%] -ml-[17%] h-[53%] -mt-12 rounded-t-[100%] bg-[#12190D] border-t border-[rgba(184,255,101,0.22)] shadow-[0_-20px_60px_rgba(0,0,0,0.75)] flex flex-col items-center justify-between pt-3 pb-6 safe-bottom px-[14%] overflow-hidden">
          {/* Intense radial lime-green spotlight inside the dome */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(circle at 50% 34%, rgba(184, 255, 101, 0.34) 0%, rgba(131, 217, 76, 0.14) 36%, rgba(12, 17, 10, 0.94) 72%, #080A09 100%)',
            }}
            aria-hidden="true"
          />

          {/* Error Notification (if any) */}
          {error && (
            <div
              role="alert"
              className="relative z-30 mb-1 px-3 py-1.5 rounded-full bg-red-500/15 border border-red-500/30 flex items-center gap-2 text-[11px] text-red-200"
            >
              <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
              <span className="truncate max-w-[200px]">{error}</span>
              <button
                type="button"
                onClick={onSkipToNewTrack}
                className="underline text-[#B8FF65] font-medium cursor-pointer"
              >
                Retry
              </button>
            </div>
          )}

          {/* Curved Arc Progress Bar + Timestamp */}
          <div className="relative z-10 w-full">
            <ProgressBar
              currentTime={currentTime}
              duration={duration}
              disabled={isGenerating || !currentTrack}
              onSeek={onSeek}
            />
          </div>

          {/* Central Play/Pause Orb with Green Energy Ribbons + Loop & Skip Buttons */}
          <div className="relative z-10 w-full my-auto">
            <MusicControls
              isPlaying={isPlaying}
              isGenerating={isGenerating}
              isLooping={isLooping}
              volume={volume}
              isMuted={isMuted}
              onTogglePlayPause={onTogglePlayPause}
              onToggleLoop={onToggleLoop}
              onSkipToNewTrack={onSkipToNewTrack}
              onVolumeChange={onVolumeChange}
              onToggleMute={onToggleMute}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
};
