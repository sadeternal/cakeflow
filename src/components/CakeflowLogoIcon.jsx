import React, { useId } from 'react';
import { cn } from '@/lib/utils';

export default function CakeflowLogoIcon({ className }) {
  const gradientId = useId();
  const glowId = useId();

  return (
    <svg
      viewBox="0 0 64 64"
      aria-hidden="true"
      className={cn('h-10 w-10', className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={gradientId} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F43469" />
          <stop offset="1" stopColor="#D91B4F" />
        </linearGradient>
        <filter id={glowId} x="8" y="12" width="48" height="40" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#8E1B3B" floodOpacity="0.35" />
        </filter>
      </defs>

      <rect x="2" y="2" width="60" height="60" rx="14" fill={`url(#${gradientId})`} />

      <g filter={`url(#${glowId})`}>
        <path
          d="M12 34L28.8 16.3C30.4 14.6 32.7 13.6 35 13.6C37.3 13.6 39.6 14.6 41.2 16.3L58 34H12Z"
          fill="white"
        />
        <rect x="12" y="37.2" width="46" height="6.4" fill="white" />
        <rect x="12" y="48.2" width="46" height="6.4" fill="white" />
      </g>
    </svg>
  );
}
