import { useCallback, useEffect, useRef, useState } from 'react';
import { GENERATION_MESSAGES, musicService } from '../services/musicService';
import type { GenerationPhase, TrackMetadata } from '../types/music';

export interface UseMusicPlayerReturn {
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
  generateNextTrack: (autoPlay?: boolean) => Promise<void>;
  togglePlayPause: () => Promise<void>;
  toggleLoop: () => void;
  seekTo: (timeInSeconds: number) => void;
  setVolumeLevel: (value: number) => void;
  toggleMute: () => void;
  cancelGeneration: () => void;
  clearError: () => void;
}

export function useMusicPlayer(): UseMusicPlayerReturn {
  const [currentTrack, setCurrentTrack] = useState<TrackMetadata | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationMessage, setGenerationMessage] = useState<string>(GENERATION_MESSAGES[0]);
  const [generationProgress, setGenerationProgress] = useState<number>(0);
  const [generationPhase, setGenerationPhase] = useState<GenerationPhase>('idle');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isLooping, setIsLooping] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolume] = useState<number>(0.85);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isGeneratingRef = useRef<boolean>(false);
  const isLoopingRef = useRef<boolean>(false);
  const currentTrackRef = useRef<TrackMetadata | null>(null);
  const generateNextRef = useRef<(autoPlay?: boolean) => Promise<void>>(async () => {});

  useEffect(() => {
    currentTrackRef.current = currentTrack;
  }, [currentTrack]);

  // Initialize and clean up the single HTML5 Audio instance
  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'auto';
    audio.volume = 0.85;
    audioRef.current = audio;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleLoadedMetadata = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      }
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    const handleEnded = () => {
      if (isLoopingRef.current) {
        audio.currentTime = 0;
        setCurrentTime(0);
        void audio.play();
        return;
      }
      setIsPlaying(false);
      setCurrentTime(0);
      // Automatically compose the next track in the infinite stream when loop is off
      void generateNextRef.current(true);
    };

    const handleError = () => {
      if (!audio.getAttribute('src')) return;
      setIsPlaying(false);
      setError('Unable to decode or play the audio stream. Try generating a new composition.');
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('durationchange', handleLoadedMetadata);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      abortControllerRef.current?.abort();
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('durationchange', handleLoadedMetadata);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, []);

  const cancelGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    isGeneratingRef.current = false;
    setIsGenerating(false);
    setGenerationPhase('idle');
  }, []);

  const toggleLoop = useCallback(() => {
    setIsLooping((prev) => {
      const next = !prev;
      isLoopingRef.current = next;
      const audio = audioRef.current;
      if (audio) {
        audio.loop = next;
      }

      // If turning loop ON while a new track is being generated and a current track exists,
      // stop the generation and keep playing the current track in loop
      if (next && isGeneratingRef.current && currentTrackRef.current) {
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
          abortControllerRef.current = null;
        }
        isGeneratingRef.current = false;
        setIsGenerating(false);
        setGenerationPhase('ready');
        if (audio && audio.paused) {
          void audio.play();
        }
      }

      return next;
    });
  }, []);

  const generateNextTrack = useCallback(async (autoPlay = true) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    isGeneratingRef.current = true;

    const audio = audioRef.current;
    if (audio && !audio.paused) {
      audio.pause();
    }

    setError(null);
    setIsGenerating(true);
    setGenerationMessage(GENERATION_MESSAGES[0]);
    setGenerationProgress(0.12);
    setGenerationPhase('sampling_tokens');

    try {
      const track = await musicService.requestGeneration({
        signal: controller.signal,
        onStatusUpdate: (status) => {
          setGenerationMessage(status.message);
          setGenerationProgress(status.progress);
          setGenerationPhase(status.phase);
        },
      });

      if (controller.signal.aborted) return;

      setCurrentTrack(track);
      setCurrentTime(0);
      setDuration(track.durationSeconds);
      setIsGenerating(false);
      setGenerationPhase('ready');
      isGeneratingRef.current = false;

      if (audio) {
        audio.src = track.audioUrl;
        audio.loop = isLoopingRef.current;
        audio.currentTime = 0;
        audio.load();

        if (autoPlay) {
          try {
            await audio.play();
          } catch (playErr) {
            if (playErr instanceof DOMException && playErr.name === 'NotAllowedError') {
              setIsPlaying(false);
            } else {
              setIsPlaying(false);
            }
          }
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }
      isGeneratingRef.current = false;
      setIsGenerating(false);
      setGenerationPhase('error');
      setError(
        err instanceof Error
          ? err.message
          : 'An unexpected error occurred while composing your track.'
      );
    }
  }, []);

  useEffect(() => {
    generateNextRef.current = generateNextTrack;
  }, [generateNextTrack]);

  const togglePlayPause = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || isGeneratingRef.current) return;

    if (!currentTrack) {
      await generateNextTrack(true);
      return;
    }

    setError(null);
    if (audio.paused) {
      try {
        await audio.play();
      } catch {
        setError('Playback could not start. Please interact with the controls or generate a new track.');
      }
    } else {
      audio.pause();
    }
  }, [currentTrack, generateNextTrack]);

  const seekTo = useCallback(
    (timeInSeconds: number) => {
      const audio = audioRef.current;
      if (!audio || !currentTrack) return;
      const maxDur = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : duration;
      const clamped = Math.max(0, Math.min(maxDur, timeInSeconds));
      audio.currentTime = clamped;
      setCurrentTime(clamped);
    },
    [currentTrack, duration]
  );

  const setVolumeLevel = useCallback((value: number) => {
    const clamped = Math.max(0, Math.min(1, value));
    setVolume(clamped);
    if (clamped > 0) {
      setIsMuted(false);
    }
    const audio = audioRef.current;
    if (audio) {
      audio.muted = false;
      audio.volume = clamped;
    }
  }, []);

  const toggleMute = useCallback(() => {
    const audio = audioRef.current;
    setIsMuted((prev) => {
      const next = !prev;
      if (audio) {
        audio.muted = next;
      }
      return next;
    });
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return {
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
    serviceMode: musicService.mode,
    generateNextTrack,
    togglePlayPause,
    toggleLoop,
    seekTo,
    setVolumeLevel,
    toggleMute,
    cancelGeneration,
    clearError,
  };
}
