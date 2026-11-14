import React, { useCallback, useRef, useState } from 'react';

interface ProgressBarProps {
  currentTime: number;
  duration: number;
  disabled?: boolean;
  onSeek: (timeInSeconds: number) => void;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const totalSeconds = Math.floor(seconds);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Geometry for the curved console arc (viewBox 0 0 360 112)
const ARC_CX = 180;
const ARC_CY = 226;
const ARC_RADIUS = 196;
const START_DEG = -138; // Left end of the arc
const END_DEG = -42;    // Right end of the arc

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function polarToCartesian(deg: number): { x: number; y: number } {
  const rad = degToRad(deg);
  return {
    x: ARC_CX + ARC_RADIUS * Math.cos(rad),
    y: ARC_CY + ARC_RADIUS * Math.sin(rad),
  };
}

function describeArc(startDeg: number, endDeg: number): string {
  const start = polarToCartesian(startDeg);
  const end = polarToCartesian(endDeg);
  const largeArcFlag = endDeg - startDeg <= 180 ? '0' : '1';
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${ARC_RADIUS} ${ARC_RADIUS} 0 ${largeArcFlag} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  currentTime,
  duration,
  disabled = false,
  onSeek,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragTime, setDragTime] = useState<number | null>(null);

  const effectiveTime = isDragging && dragTime !== null ? dragTime : currentTime;
  const safeDuration = duration > 0 ? duration : 1;
  const progressRatio = disabled
    ? 0
    : Math.min(1, Math.max(0, effectiveTime / safeDuration));

  const currentAngleDeg = START_DEG + progressRatio * (END_DEG - START_DEG);
  const thumbPos = polarToCartesian(currentAngleDeg);
  const fullArcPath = describeArc(START_DEG, END_DEG);
  const activeArcPath = describeArc(START_DEG, Math.max(START_DEG + 0.5, currentAngleDeg));

  const calculateTimeFromPointer = useCallback(
    (clientX: number, clientY: number): number => {
      const svg = svgRef.current;
      if (!svg || duration <= 0) return 0;
      const rect = svg.getBoundingClientRect();
      const vx = ((clientX - rect.left) / rect.width) * 360;
      const vy = ((clientY - rect.top) / rect.height) * 112;

      const angleRad = Math.atan2(vy - ARC_CY, vx - ARC_CX);
      const angleDeg = (angleRad * 180) / Math.PI;
      const clampedDeg = Math.max(START_DEG, Math.min(END_DEG, angleDeg));
      const ratio = (clampedDeg - START_DEG) / (END_DEG - START_DEG);
      return ratio * duration;
    },
    [duration]
  );

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (disabled || duration <= 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const nextTime = calculateTimeFromPointer(e.clientX, e.clientY);
    setIsDragging(true);
    setDragTime(nextTime);
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isDragging || disabled) return;
    const nextTime = calculateTimeFromPointer(e.clientX, e.clientY);
    setDragTime(nextTime);
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isDragging || disabled) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    const finalTime = calculateTimeFromPointer(e.clientX, e.clientY);
    setIsDragging(false);
    setDragTime(null);
    onSeek(finalTime);
  };

  const handleKeyDown = (e: React.KeyboardEvent<SVGSVGElement>) => {
    if (disabled || duration <= 0) return;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      onSeek(Math.min(duration, currentTime + 5));
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      onSeek(Math.max(0, currentTime - 5));
    }
  };

  return (
    <div className="relative w-full flex flex-col items-center select-none">
      {/* Curved Interactive SVG Arc */}
      <svg
        ref={svgRef}
        viewBox="0 0 360 112"
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label="Track playback progress"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(effectiveTime)}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onKeyDown={handleKeyDown}
        className={`w-full max-w-[360px] h-auto overflow-visible focus-ring rounded-xl ${
          disabled ? 'opacity-45 cursor-not-allowed' : 'cursor-pointer'
        }`}
      >
        {/* Background unplayed arc */}
        <path
          d={fullArcPath}
          fill="none"
          stroke="rgba(255, 255, 255, 0.16)"
          strokeWidth="2.2"
          strokeLinecap="round"
        />

        {/* Active played arc */}
        {!disabled && (
          <path
            d={activeArcPath}
            fill="none"
            stroke="#F5F7F4"
            strokeWidth="2.8"
            strokeLinecap="round"
          />
        )}

        {/* Glowing circular thumb on the arc */}
        {!disabled && (
          <g transform={`translate(${thumbPos.x}, ${thumbPos.y})`}>
            <circle r="11" fill="rgba(245, 247, 244, 0.16)" />
            <circle
              r="6"
              fill="#F5F7F4"
              style={{ filter: 'drop-shadow(0 0 8px rgba(255,255,255,0.8))' }}
            />
          </g>
        )}
      </svg>

      {/* Timestamp tucked cleanly under the apex of the arc */}
      <div className="-mt-11 flex flex-col items-center z-10">
        <p className="font-mono-tech text-[12px] tracking-[0.08em] tabular-nums text-[#F5F7F4]/90">
          {disabled ? '0:00 / --:--' : `${formatTime(effectiveTime)} / ${formatTime(duration)}`}
        </p>
      </div>
    </div>
  );
};
