import React, { useEffect, useRef } from 'react';
import { useReducedMotion } from 'framer-motion';

interface NeuralVisualProps {
  isActivating?: boolean;
}

export const NeuralVisual: React.FC<NeuralVisualProps> = ({ isActivating = false }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const prefersReducedMotion = useReducedMotion();
  const pointerRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId = 0;
    let time = 8.4;

    const handleResize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    const drawFrame = () => {
      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      if (width === 0 || height === 0) return;

      const cx = width / 2;
      const cy = height * 0.54;
      const scale = Math.min(width, height) * 0.36;

      ctx.clearRect(0, 0, width, height);

      pointerRef.current.x += (pointerRef.current.targetX - pointerRef.current.x) * 0.05;
      pointerRef.current.y += (pointerRef.current.targetY - pointerRef.current.y) * 0.05;

      const px = pointerRef.current.x * 12;
      const py = pointerRef.current.y * 12;

      // 1. Deep metallic lime-olive ambient glow behind the sculptural form
      const ambient = ctx.createRadialGradient(
        cx + px * 0.4,
        cy + py * 0.4,
        scale * 0.1,
        cx,
        cy,
        scale * 1.25
      );
      ambient.addColorStop(0, isActivating ? 'rgba(184, 255, 101, 0.28)' : 'rgba(184, 255, 101, 0.18)');
      ambient.addColorStop(0.5, 'rgba(131, 217, 76, 0.08)');
      ambient.addColorStop(1, 'rgba(8, 10, 9, 0)');
      ctx.fillStyle = ambient;
      ctx.fillRect(0, 0, width, height);

      // 2. Floor shadow ellipse (gives floating 3D depth like the reference)
      const shadowY = cy + scale * 0.92;
      const shadowGrad = ctx.createRadialGradient(cx, shadowY, 4, cx, shadowY, scale * 0.75);
      shadowGrad.addColorStop(0, 'rgba(0, 0, 0, 0.65)');
      shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.save();
      ctx.translate(cx, shadowY);
      ctx.scale(1, 0.22);
      ctx.beginPath();
      ctx.arc(0, 0, scale * 0.75, 0, Math.PI * 2);
      ctx.fillStyle = shadowGrad;
      ctx.fill();
      ctx.restore();

      // 3. Sculpted 3D Torus / Neural Acoustic Arch + Resonator Chambers
      // Upper acoustic arc ribbons (metallic anodized lime gradient)
      const archRibbons = 18;
      for (let i = 0; i < archRibbons; i++) {
        const norm = i / (archRibbons - 1);
        const radiusX = scale * (0.72 + norm * 0.16);
        const radiusY = scale * (0.78 + norm * 0.14);
        const offsetY = cy + scale * 0.08 + py * (0.2 + norm * 0.3);
        const offsetX = cx + px * (0.2 + norm * 0.3);

        ctx.beginPath();
        const steps = 80;
        for (let s = 0; s <= steps; s++) {
          const tStep = s / steps;
          // Arc from PI*0.92 to PI*2.08 (over-ear arch silhouette)
          const angle = Math.PI * 0.92 + tStep * Math.PI * 1.16;
          const wave =
            Math.sin(tStep * Math.PI * 6 + time * 1.6 + i * 0.35) *
            Math.sin(tStep * Math.PI) *
            (isActivating ? 6 : 3.2);
          const x = offsetX + Math.cos(angle) * (radiusX + wave);
          const y = offsetY + Math.sin(angle) * (radiusY + wave);
          if (s === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }

        const alpha = 0.15 + Math.sin(norm * Math.PI) * 0.55;
        ctx.strokeStyle =
          i === Math.floor(archRibbons / 2)
            ? '#B8FF65'
            : i % 2 === 0
              ? `rgba(184, 255, 101, ${alpha})`
              : `rgba(131, 217, 76, ${alpha * 0.75})`;
        ctx.lineWidth = i === Math.floor(archRibbons / 2) ? 2.2 : 1.2;
        ctx.stroke();
      }

      // 4. Left & Right Acoustic Neural Pods (3D layered concentric harmonic shells)
      const pods = [
        { side: -1, baseX: cx - scale * 0.52, baseY: cy + scale * 0.2, tilt: -0.22 },
        { side: 1, baseX: cx + scale * 0.52, baseY: cy + scale * 0.2, tilt: 0.22 },
      ];

      for (const pod of pods) {
        const podRings = 14;
        for (let r = 0; r < podRings; r++) {
          const rNorm = r / (podRings - 1);
          const shellRx = scale * (0.14 + rNorm * 0.24) * 0.72;
          const shellRy = scale * (0.2 + rNorm * 0.34);
          const depthShift = (rNorm - 0.5) * 18 * pod.side;
          const ringX = pod.baseX + depthShift + px * (0.3 + rNorm * 0.4);
          const ringY = pod.baseY + py * (0.3 + rNorm * 0.4);

          ctx.save();
          ctx.translate(ringX, ringY);
          ctx.rotate(pod.tilt + Math.sin(time * 0.8 + r * 0.2) * 0.03);

          ctx.beginPath();
          const segs = 72;
          for (let s = 0; s <= segs; s++) {
            const theta = (s / segs) * Math.PI * 2;
            const ripple =
              Math.sin(theta * 5 + time * 2 * pod.side + r * 0.4) *
              (isActivating ? 3.5 : 1.6) *
              (1 - rNorm * 0.5);
            const x = Math.cos(theta) * (shellRx + ripple);
            const y = Math.sin(theta) * (shellRy + ripple);
            if (s === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.closePath();

          // Metallic lime highlight on outer-middle rings, deep shadow inside
          const brightness = Math.sin(rNorm * Math.PI);
          if (r === podRings - 3) {
            ctx.strokeStyle = '#B8FF65';
            ctx.lineWidth = 2;
          } else {
            ctx.strokeStyle = `rgba(184, 255, 101, ${0.12 + brightness * 0.55})`;
            ctx.lineWidth = 1.15;
          }
          ctx.stroke();
          ctx.restore();
        }
      }

      // 5. Central Neural Wave Stream bridging the two acoustic chambers
      const streamLines = 5;
      for (let l = 0; l < streamLines; l++) {
        ctx.beginPath();
        const spanStart = cx - scale * 0.42;
        const spanEnd = cx + scale * 0.42;
        const steps = 64;
        for (let s = 0; s <= steps; s++) {
          const norm = s / steps;
          const x = spanStart + norm * (spanEnd - spanStart);
          const env = Math.sin(norm * Math.PI);
          const y =
            cy +
            scale * 0.2 +
            Math.sin(norm * 10 - time * 2.4 + l * 0.8) *
              scale *
              0.16 *
              env *
              (isActivating ? 1.4 : 1) +
            py * 0.35;
          if (s === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle =
          l === 2
            ? 'rgba(184, 255, 101, 0.78)'
            : `rgba(131, 217, 76, ${0.18 + (l % 2) * 0.16})`;
        ctx.lineWidth = l === 2 ? 1.6 : 1;
        ctx.stroke();
      }

      if (!prefersReducedMotion) {
        time += isActivating ? 0.045 : 0.016;
        animationFrameId = window.requestAnimationFrame(drawFrame);
      }
    };

    drawFrame();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId);
      }
    };
  }, [isActivating, prefersReducedMotion]);

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (prefersReducedMotion) return;
    const rect = e.currentTarget.getBoundingClientRect();
    pointerRef.current.targetX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    pointerRef.current.targetY = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
  };

  const handlePointerLeave = () => {
    pointerRef.current.targetX = 0;
    pointerRef.current.targetY = 0;
  };

  return (
    <div
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className="relative w-[290px] h-[270px] sm:w-[340px] sm:h-[310px] flex items-center justify-center select-none"
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  );
};
