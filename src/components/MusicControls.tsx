import React, { useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Pause, Play, Repeat, SkipForward, Volume2, VolumeX } from 'lucide-react';

interface MusicControlsProps {
  isPlaying: boolean;
  isGenerating: boolean;
  isLooping: boolean;
  volume: number;
  isMuted: boolean;
  onTogglePlayPause: () => void;
  onToggleLoop: () => void;
  onSkipToNewTrack: () => void;
  onVolumeChange: (val: number) => void;
  onToggleMute: () => void;
}

export const MusicControls: React.FC<MusicControlsProps> = ({
  isPlaying,
  isGenerating,
  isLooping,
  volume,
  isMuted,
  onTogglePlayPause,
  onToggleLoop,
  onSkipToNewTrack,
  onVolumeChange,
  onToggleMute,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const orbCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Render organic swirling lime-green energy ribbons around the central Play/Pause button
  useEffect(() => {
    const canvas = orbCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    let phase = 2.5;

    const size = 168;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const drawOrb = () => {
      const cx = size / 2;
      const cy = size / 2;
      ctx.clearRect(0, 0, size, size);

      // Soft inner green radial glow
      const glow = ctx.createRadialGradient(cx, cy, 24, cx, cy, 72);
      glow.addColorStop(
        0,
        isPlaying || isGenerating ? 'rgba(184, 255, 101, 0.35)' : 'rgba(184, 255, 101, 0.16)'
      );
      glow.addColorStop(0.65, 'rgba(131, 217, 76, 0.14)');
      glow.addColorStop(1, 'rgba(8, 10, 9, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, size, size);

      // Organic swirling wave ribbons around the central button
      const ribbons = 9;
      const steps = 96;
      for (let r = 0; r < ribbons; r++) {
        const norm = r / (ribbons - 1);
        const baseRadius = 44 + norm * 17;
        const speed = (r % 2 === 0 ? 1 : -1) * (0.8 + norm * 0.6);

        ctx.beginPath();
        for (let s = 0; s <= steps; s++) {
          const theta = (s / steps) * Math.PI * 2;
          const wave1 = Math.sin(theta * 3 + phase * speed + r * 0.7) * (isPlaying ? 4.2 : 2.2);
          const wave2 = Math.cos(theta * 5 - phase * 0.9 + r) * (isPlaying ? 2.8 : 1.4);
          const rad = baseRadius + wave1 + wave2;
          const x = cx + Math.cos(theta) * rad;
          const y = cy + Math.sin(theta) * rad;
          if (s === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();

        const alpha = 0.22 + Math.sin(norm * Math.PI) * 0.55;
        ctx.strokeStyle =
          r === 4
            ? `rgba(184, 255, 101, ${isPlaying ? 0.9 : 0.6})`
            : `rgba(145, 232, 84, ${alpha})`;
        ctx.lineWidth = r === 4 ? 1.8 : 1.15;
        ctx.stroke();
      }

      if ((isPlaying || isGenerating) && !prefersReducedMotion) {
        phase += isGenerating ? 0.05 : 0.024;
        animId = window.requestAnimationFrame(drawOrb);
      }
    };

    drawOrb();

    return () => {
      if (animId) {
        window.cancelAnimationFrame(animId);
      }
    };
  }, [isPlaying, isGenerating, prefersReducedMotion]);

  const effectiveVolume = isMuted ? 0 : volume;

  return (
    <div className="relative w-full max-w-[340px] mx-auto flex flex-col items-center select-none">
      {/* Main Transport Row: Loop Button — Central Play/Pause with Green Waves — Skip (New Track) */}
      <div className="w-full flex items-center justify-between px-4">
        {/* Left Button: Loop Current Track (stops generation & repeats current music) */}
        <motion.button
          type="button"
          onClick={onToggleLoop}
          whileTap={!prefersReducedMotion ? { scale: 0.9 } : undefined}
          title={
            isLooping
              ? 'Loop active — playing current track continuously'
              : 'Loop current track (pause new generation)'
          }
          aria-label="Toggle loop for current track"
          aria-pressed={isLooping}
          className={`focus-ring w-11 h-11 rounded-full border flex items-center justify-center transition-colors cursor-pointer ${
            isLooping
              ? 'bg-[#B8FF65]/20 border-[#B8FF65]/60 text-[#B8FF65] shadow-[0_0_16px_rgba(184,255,101,0.25)]'
              : 'bg-white/[0.04] hover:bg-white/[0.09] border-white/[0.08] text-[#F5F7F4]/80 hover:text-[#B8FF65]'
          }`}
        >
          <Repeat className="w-4 h-4" />
        </motion.button>

        {/* Central Play/Pause Button with Organic Swirling Green Waves (no black circle or top cap) */}
        <div className="relative flex items-center justify-center w-[168px] h-[168px]">
          {/* Swirling Green Ribbons Canvas */}
          <canvas
            ref={orbCanvasRef}
            className="pointer-events-none absolute inset-0 w-full h-full"
            aria-hidden="true"
          />

          {/* Crisp White Play / Pause Center Button */}
          <motion.button
            type="button"
            disabled={isGenerating}
            onClick={onTogglePlayPause}
            whileHover={!prefersReducedMotion && !isGenerating ? { scale: 1.05 } : undefined}
            whileTap={!prefersReducedMotion && !isGenerating ? { scale: 0.94 } : undefined}
            className={`focus-ring relative z-10 w-[76px] h-[76px] rounded-full bg-[#F5F7F4] text-[#080A09] flex items-center justify-center shadow-[0_0_28px_rgba(184,255,101,0.35)] transition-opacity ${
              isGenerating ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
            }`}
            aria-label={isPlaying ? 'Pause composition' : 'Play composition'}
          >
            {isPlaying ? (
              <Pause className="w-7 h-7 fill-current" strokeWidth={2.4} />
            ) : (
              <Play className="w-7 h-7 fill-current ml-1" strokeWidth={2.4} />
            )}
          </motion.button>
        </div>

        {/* Right Transport Button: Skip / Compose Brand New Track */}
        <motion.button
          type="button"
          onClick={onSkipToNewTrack}
          whileTap={!prefersReducedMotion ? { scale: 0.9 } : undefined}
          title="Skip — Generate a brand new track with GPT-2"
          aria-label="Skip and generate a brand new AI track"
          className="focus-ring w-11 h-11 rounded-full flex items-center justify-center text-[#F5F7F4] hover:text-[#B8FF65] transition-colors cursor-pointer"
        >
          <SkipForward className="w-5 h-5 fill-current" />
        </motion.button>
      </div>

      {/* Subtle Desktop Volume Bar */}
      <div className="hidden sm:flex items-center gap-2.5 mt-2 px-6 w-48 opacity-65 hover:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={onToggleMute}
          className="text-[#8A938D] hover:text-[#F5F7F4] cursor-pointer"
          aria-label={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted || effectiveVolume === 0 ? (
            <VolumeX className="w-3.5 h-3.5" />
          ) : (
            <Volume2 className="w-3.5 h-3.5" />
          )}
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={effectiveVolume}
          onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
          aria-label="Audio volume"
          className="w-full h-1 bg-white/15 rounded-full appearance-none cursor-pointer accent-[#B8FF65]"
        />
      </div>
    </div>
  );
};
