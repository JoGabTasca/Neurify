import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useMusicPlayer } from './hooks/useMusicPlayer';
import { Player } from './pages/Player';
import { Welcome } from './pages/Welcome';

type AppView = 'welcome' | 'transition' | 'player';

export const App: React.FC = () => {
  const [view, setView] = useState<AppView>('welcome');
  const prefersReducedMotion = useReducedMotion();
  const transitionTimerRef = useRef<number | null>(null);

  const {
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
    serviceMode,
    generateNextTrack,
    togglePlayPause,
    toggleLoop,
    seekTo,
    setVolumeLevel,
    toggleMute,
    cancelGeneration,
  } = useMusicPlayer();

  useEffect(() => {
    return () => {
      if (transitionTimerRef.current !== null) {
        window.clearTimeout(transitionTimerRef.current);
      }
    };
  }, []);

  const handleStartFirstTrack = useCallback(() => {
    // Trigger track generation in the background while showing the interstitial message
    if (!currentTrack && !isGenerating) {
      void generateNextTrack(true);
    } else if (currentTrack && !isPlaying) {
      void togglePlayPause();
    }

    setView('transition');

    if (transitionTimerRef.current !== null) {
      window.clearTimeout(transitionTimerRef.current);
    }

    transitionTimerRef.current = window.setTimeout(() => {
      setView('player');
      transitionTimerRef.current = null;
    }, 2600);
  }, [currentTrack, isGenerating, isPlaying, generateNextTrack, togglePlayPause]);

  const handleBackToWelcome = useCallback(() => {
    if (transitionTimerRef.current !== null) {
      window.clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = null;
    }
    if (isGenerating) {
      cancelGeneration();
    }
    setView('welcome');
  }, [isGenerating, cancelGeneration]);

  const handleSkipToNewTrack = useCallback(() => {
    void generateNextTrack(true);
  }, [generateNextTrack]);

  return (
    <div className="min-h-dvh w-full bg-[#080A09] text-[#F5F7F4] overflow-hidden">
      <AnimatePresence mode="wait">
        {view === 'welcome' && (
          <Welcome
            key="welcome-screen"
            onStartGeneration={handleStartFirstTrack}
            serviceMode={serviceMode}
          />
        )}

        {view === 'transition' && (
          <motion.div
            key="transition-screen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="h-dvh w-full bg-black text-[#F5F7F4] flex items-center justify-center px-8 select-none overflow-hidden"
          >
            <motion.p
              initial={
                prefersReducedMotion
                  ? { opacity: 0 }
                  : { opacity: 0, y: 14, filter: 'blur(8px)' }
              }
              animate={
                prefersReducedMotion
                  ? { opacity: 1 }
                  : { opacity: 1, y: 0, filter: 'blur(0px)' }
              }
              exit={
                prefersReducedMotion
                  ? { opacity: 0 }
                  : { opacity: 0, y: -8, filter: 'blur(6px)' }
              }
              transition={{ duration: 0.9, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
              className="max-w-md text-center font-display font-medium text-2xl sm:text-3xl leading-[1.3] tracking-[-0.02em] text-[#F5F7F4]"
            >
              The music can be only played once, so{' '}
              <span className="text-[#B8FF65]">enjoy the ride.</span>
            </motion.p>
          </motion.div>
        )}

        {view === 'player' && (
          <Player
            key="player-screen"
            currentTrack={currentTrack}
            isGenerating={isGenerating}
            generationMessage={generationMessage}
            generationProgress={generationProgress}
            generationPhase={generationPhase}
            isPlaying={isPlaying}
            isLooping={isLooping}
            currentTime={currentTime}
            duration={duration}
            volume={volume}
            isMuted={isMuted}
            error={error}
            serviceMode={serviceMode}
            onBackToWelcome={handleBackToWelcome}
            onTogglePlayPause={togglePlayPause}
            onToggleLoop={toggleLoop}
            onSkipToNewTrack={handleSkipToNewTrack}
            onSeek={seekTo}
            onVolumeChange={setVolumeLevel}
            onToggleMute={toggleMute}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;
