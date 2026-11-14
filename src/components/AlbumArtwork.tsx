import React, { useEffect, useRef } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { TrackMetadata } from '../types/music';

interface AlbumArtworkProps {
  track: TrackMetadata;
  isPlaying: boolean;
}

function createSeededRand(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export const AlbumArtwork: React.FC<AlbumArtworkProps> = ({ track, isPlaying }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const prefersReducedMotion = useReducedMotion();
  const phaseRef = useRef<number>(track.artwork.seed % 100);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    const { artwork, bpm } = track;
    const pulseRate = (bpm / 60) * 0.45;

    const rand = createSeededRand(artwork.seed);
    const staticNodes = Array.from({ length: artwork.nodeCount }, () => ({
      angle: rand() * Math.PI * 2,
      radiusNorm: 0.16 + rand() * 0.72,
      speed: (rand() - 0.5) * 0.38,
      size: 1.5 + rand() * 2.4,
      isAccent: rand() > 0.58,
    }));

    // Bokeh / ambient light orbs inspired by the warm depth of Reference Image 1
    const bokehOrbs = Array.from({ length: 12 }, () => ({
      xNorm: 0.1 + rand() * 0.8,
      yNorm: 0.1 + rand() * 0.65,
      r: 14 + rand() * 34,
      drift: (rand() - 0.5) * 0.3,
      alpha: 0.04 + rand() * 0.09,
      isLime: rand() > 0.4,
    }));

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener('resize', resize);

    const render = () => {
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      if (w === 0 || h === 0) return;

      const cx = w / 2;
      const cy = h * 0.42;
      const maxR = Math.min(w, h) * 0.38;
      const t = phaseRef.current;

      ctx.clearRect(0, 0, w, h);

      // 1. Rich atmospheric background gradient
      const bgGrad = ctx.createRadialGradient(cx, cy, maxR * 0.08, cx, cy, Math.max(w, h) * 0.85);
      bgGrad.addColorStop(0, `rgba(184, 255, 101, ${isPlaying ? 0.18 : 0.1})`);
      bgGrad.addColorStop(0.45, 'rgba(32, 46, 22, 0.55)');
      bgGrad.addColorStop(1, 'rgba(8, 10, 9, 0.98)');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      // 2. Soft out-of-focus bokeh light spheres
      for (const orb of bokehOrbs) {
        const ox = orb.xNorm * w + Math.sin(t * 0.7 + orb.r) * 14 * orb.drift;
        const oy = orb.yNorm * h + Math.cos(t * 0.6 + orb.r) * 10 * orb.drift;
        const orbGrad = ctx.createRadialGradient(ox, oy, 1, ox, oy, orb.r);
        if (orb.isLime) {
          orbGrad.addColorStop(0, `rgba(184, 255, 101, ${orb.alpha * 1.4})`);
          orbGrad.addColorStop(0.6, `rgba(131, 217, 76, ${orb.alpha * 0.5})`);
        } else {
          orbGrad.addColorStop(0, `rgba(245, 247, 244, ${orb.alpha * 1.2})`);
          orbGrad.addColorStop(0.6, `rgba(245, 247, 244, ${orb.alpha * 0.35})`);
        }
        orbGrad.addColorStop(1, 'rgba(8, 10, 9, 0)');
        ctx.fillStyle = orbGrad;
        ctx.beginPath();
        ctx.arc(ox, oy, orb.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // 3. Procedural Generative Pattern per Track Seed
      const pattern = artwork.pattern;

      if (pattern === 'harmonic-rings') {
        for (let r = 0; r < artwork.ringCount; r++) {
          const norm = (r + 1) / artwork.ringCount;
          const baseR = maxR * (0.2 + norm * 0.78);
          ctx.beginPath();
          const steps = 128;
          for (let i = 0; i <= steps; i++) {
            const theta = (i / steps) * Math.PI * 2;
            const mod =
              Math.sin(theta * artwork.symmetry + t * (r % 2 === 0 ? 1 : -1)) * (4 + r * 1.8) +
              Math.cos(theta * (artwork.symmetry + 2) - t * 0.7) * 3.5;
            const rad = baseR + mod * (isPlaying ? 1.2 : 0.7);
            const x = cx + Math.cos(theta) * rad;
            const y = cy + Math.sin(theta) * rad;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.closePath();
          ctx.strokeStyle =
            r === artwork.ringCount - 2
              ? 'rgba(184, 255, 101, 0.75)'
              : r % 2 === 0
                ? `rgba(131, 217, 76, ${0.18 + norm * 0.25})`
                : `rgba(245, 247, 244, ${0.1 + norm * 0.14})`;
          ctx.lineWidth = r === artwork.ringCount - 2 ? 1.6 : 1.05;
          ctx.stroke();
        }
      } else if (pattern === 'synaptic-mesh') {
        const pts = staticNodes.map((n, idx) => {
          const angle = n.angle + t * n.speed + (idx % 2 === 0 ? 0.15 : -0.15);
          const r = maxR * n.radiusNorm + Math.sin(t * 1.4 + idx) * (isPlaying ? 8 : 3);
          return {
            x: cx + Math.cos(angle) * r,
            y: cy + Math.sin(angle) * r,
            isAccent: n.isAccent,
            size: n.size,
          };
        });

        for (let i = 0; i < pts.length; i++) {
          for (let j = i + 1; j < pts.length; j++) {
            const dist = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
            if (dist < maxR * 0.7) {
              const alpha = (1 - dist / (maxR * 0.7)) * 0.4;
              ctx.beginPath();
              ctx.moveTo(pts[i].x, pts[i].y);
              ctx.lineTo(pts[j].x, pts[j].y);
              ctx.strokeStyle =
                pts[i].isAccent || pts[j].isAccent
                  ? `rgba(184, 255, 101, ${alpha})`
                  : `rgba(245, 247, 244, ${alpha * 0.65})`;
              ctx.lineWidth = 0.95;
              ctx.stroke();
            }
          }
        }

        for (const p of pts) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.isAccent ? p.size * 1.2 : p.size * 0.85, 0, Math.PI * 2);
          ctx.fillStyle = p.isAccent ? '#B8FF65' : '#F5F7F4';
          ctx.fill();
        }
      } else if (pattern === 'spectral-waves') {
        const lines = 14;
        const span = maxR * 1.85;
        for (let l = 0; l < lines; l++) {
          const normL = l / (lines - 1);
          const baseY = cy - span * 0.38 + normL * span * 0.76;
          ctx.beginPath();
          const segments = 90;
          for (let s = 0; s <= segments; s++) {
            const normX = s / segments;
            const x = cx - span * 0.55 + normX * span * 1.1;
            const centerBell = Math.exp(-Math.pow((normX - 0.5) * 3.1, 2));
            const wave =
              Math.sin(normX * artwork.waveFrequency * 5 + t * 1.8 + l * 0.55) *
              Math.cos(normX * 7 - t * 1.1 + l * 0.3) *
              26 *
              centerBell *
              (isPlaying ? 1.2 : 0.72);
            const y = baseY - wave;
            if (s === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.strokeStyle =
            l === Math.floor(lines / 2)
              ? '#B8FF65'
              : l % 3 === 0
                ? 'rgba(131, 217, 76, 0.48)'
                : 'rgba(245, 247, 244, 0.18)';
          ctx.lineWidth = l === Math.floor(lines / 2) ? 1.65 : 1;
          ctx.stroke();
        }
      } else if (pattern === 'orbital-lattice') {
        const petals = artwork.symmetry;
        for (let layer = 0; layer < 4; layer++) {
          ctx.beginPath();
          const totalSteps = 220;
          const layerScale = maxR * (0.48 + layer * 0.17);
          for (let i = 0; i <= totalSteps; i++) {
            const theta = (i / totalSteps) * Math.PI * 2;
            const r =
              layerScale *
              (0.62 +
                0.38 *
                  Math.cos(petals * theta + t * (layer % 2 === 0 ? 0.8 : -0.6)) *
                  Math.sin(artwork.harmonicRatio * theta - t * 0.4));
            const x = cx + Math.cos(theta) * r;
            const y = cy + Math.sin(theta) * r;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.closePath();
          ctx.strokeStyle =
            layer === 1
              ? 'rgba(184, 255, 101, 0.7)'
              : layer % 2 === 0
                ? 'rgba(131, 217, 76, 0.36)'
                : 'rgba(245, 247, 244, 0.18)';
          ctx.lineWidth = layer === 1 ? 1.5 : 1;
          ctx.stroke();
        }
      } else {
        const rings = 5;
        const spokes = artwork.symmetry * 4;
        for (let r = 1; r <= rings; r++) {
          const rad = (r / rings) * maxR * 0.9;
          for (let s = 0; s < spokes; s++) {
            const baseAngle = (s / spokes) * Math.PI * 2;
            const deflection =
              Math.sin(baseAngle * artwork.symmetry + t * 1.4 + r * 0.6) *
              0.16 *
              (isPlaying ? 1.2 : 0.65);
            const x1 = cx + Math.cos(baseAngle) * (rad - 9);
            const y1 = cy + Math.sin(baseAngle) * (rad - 9);
            const x2 = cx + Math.cos(baseAngle + deflection) * (rad + 9);
            const y2 = cy + Math.sin(baseAngle + deflection) * (rad + 9);

            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            const isHighlight = (s + r) % 5 === 0;
            ctx.strokeStyle = isHighlight
              ? 'rgba(184, 255, 101, 0.78)'
              : 'rgba(245, 247, 244, 0.22)';
            ctx.lineWidth = isHighlight ? 1.45 : 1;
            ctx.stroke();
          }
        }
      }

      // Central core node
      ctx.beginPath();
      ctx.arc(cx, cy, isPlaying ? 3.8 : 2.8, 0, Math.PI * 2);
      ctx.fillStyle = '#B8FF65';
      ctx.fill();

      if (isPlaying && !prefersReducedMotion) {
        phaseRef.current += 0.014 * pulseRate;
        animId = window.requestAnimationFrame(render);
      }
    };

    render();

    return () => {
      window.removeEventListener('resize', resize);
      if (animId) {
        window.cancelAnimationFrame(animId);
      }
    };
  }, [track, isPlaying, prefersReducedMotion]);

  return (
    <div className="relative w-full h-full overflow-hidden select-none">
      <AnimatePresence mode="wait">
        <motion.div
          key={track.id}
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 1.04, filter: 'blur(8px)' }}
          animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1, filter: 'blur(0px)' }}
          exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97, filter: 'blur(6px)' }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="relative w-full h-full"
        >
          <canvas
            ref={canvasRef}
            className="w-full h-full block"
            aria-label={`Procedural visual artwork for ${track.title}`}
          />
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
