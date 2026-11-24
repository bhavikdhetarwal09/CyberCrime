import React from 'react';

interface BrandMarkProps {
  compact?: boolean;
  darkSurface?: boolean;
}

export const BrandMark: React.FC<BrandMarkProps> = ({ compact = false, darkSurface = true }) => {
  return (
    <div className="flex items-center gap-2.5 select-none whitespace-nowrap shrink-0">
      <svg
        width="28"
        height="28"
        viewBox="0 0 28 28"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0"
      >
        <rect
          x="1"
          y="1"
          width="26"
          height="26"
          rx="4"
          fill={darkSurface ? '#17243B' : '#101A30'}
          stroke="#C5A66A"
          strokeWidth="1.25"
        />
        <path
          d="M7 9.5H21M14 9.5V20"
          stroke="#F4F5F7"
          strokeWidth="2"
          strokeLinecap="square"
        />
        <circle cx="9" cy="17.5" r="1.75" fill="#C5A66A" />
        <circle cx="19" cy="17.5" r="1.75" fill="#C5A66A" />
        <path d="M10.75 17.5H17.25" stroke="#C5A66A" strokeWidth="1.25" strokeDasharray="2 2" />
      </svg>
      {!compact && (
        <span
          className={`font-semibold tracking-[0.08em] text-sm whitespace-nowrap ${
            darkSurface ? 'text-[#F4F5F7]' : 'text-[#101A30]'
          }`}
          style={{ fontFamily: 'var(--font-display)' }}
        >
          TRACE INTEL
        </span>
      )}
    </div>
  );
};
