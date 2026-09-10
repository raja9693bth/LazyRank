import React from 'react';

export interface LazyLogoProps {
  variant?: 'horizontal' | 'icon' | 'wordmark';
  theme?: 'light' | 'dark' | 'mono';
  size?: 'sm' | 'md' | 'lg' | 'custom';
  className?: string;
}

/**
 * Official LAZY Brand Logo Component
 * - Horizontal: Icon + Custom "LAZY" Wordmark
 * - Icon: The Slouch Step (Deep Charcoal foundation + Warm Amber Gold Rank #1 Step)
 * - Wordmark: Geometric LAZY Wordmark with Slouch Z
 */
export const LazyLogo: React.FC<LazyLogoProps> = ({
  variant = 'horizontal',
  theme = 'light',
  size = 'md',
  className = ''
}) => {
  // Brand Color Palette
  const isDark = theme === 'dark';
  const isMono = theme === 'mono';

  // Specific Brand Tokens (v1.2)
  // Icon: Warm Amber Gold (#F4C542)
  // Wordmark: Deep Charcoal / Navy (#20242C)
  const iconColor = isMono ? (isDark ? '#FFFFFF' : '#20242C') : '#F4C542';
  const textColor = isDark ? '#FFFFFF' : '#20242C';

  // Size mapping
  const dimensions = {
    horizontal: {
      sm: { width: 100, height: 24 },
      md: { width: 124, height: 30 },
      lg: { width: 148, height: 36 },
      custom: {}
    },
    icon: {
      sm: { width: 22, height: 22 },
      md: { width: 28, height: 28 },
      lg: { width: 36, height: 36 },
      custom: {}
    },
    wordmark: {
      sm: { width: 75, height: 22 },
      md: { width: 92, height: 28 },
      lg: { width: 110, height: 34 },
      custom: {}
    }
  };

  const dim = dimensions[variant][size];

  if (variant === 'icon') {
    return (
      <svg
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`inline-block shrink-0 transition-transform ${className}`}
        {...dim}
        aria-label="LAZY Icon"
      >
        {/* Ground Foundation Bar (Slumped flat) */}
        <rect x="2" y="21" width="26" height="6" rx="3" fill={iconColor} />
        {/* Reclining Slouch Diagonal */}
        <path
          d="M19.5 9.5L9.5 22.5"
          stroke={iconColor}
          strokeWidth="6.5"
          strokeLinecap="round"
        />
        {/* Rank #1 Golden Step (Offset right) */}
        <rect x="11" y="5" width="17" height="6" rx="3" fill={iconColor} />
      </svg>
    );
  }

  if (variant === 'wordmark') {
    return (
      <svg
        viewBox="0 0 92 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`inline-block shrink-0 ${className}`}
        {...dim}
        aria-label="LAZY Wordmark"
      >
        <g transform="translate(0, 5)" fill={textColor}>
          {/* L */}
          <path d="M1 1H6.5V16.8H18V22H1V1Z" />
          {/* A */}
          <path d="M21 22L29.5 1H35.5L44 22H38.2L36.8 17.6H28.2L26.8 22H21ZM29.6 13.2H35.4L32.5 4.5L29.6 13.2Z" />
          {/* Z (Slouch Angle Signature) */}
          <path d="M47 1H63V5.8L54.8 16.8H63.5V22H46.5V17.2L54.8 6.2H47V1Z" />
          {/* Y */}
          <path d="M65.5 1H71.8L76.5 9.6L81.2 1H87.5L79.8 13.2V22H73.2V13.2L65.5 1Z" />
        </g>
      </svg>
    );
  }

  // Default: Primary Horizontal Logo (Icon + Wordmark)
  return (
    <svg
      viewBox="0 0 134 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`inline-block shrink-0 ${className}`}
      {...dim}
      aria-label="LAZY Brand Logo"
    >
      {/* ICON (32x32): Warm Amber Gold */}
      <g transform="translate(0, 0)">
        <rect x="2" y="21" width="26" height="6" rx="3" fill={iconColor} />
        <path
          d="M19.5 9.5L9.5 22.5"
          stroke={iconColor}
          strokeWidth="6.5"
          strokeLinecap="round"
        />
        <rect x="11" y="5" width="17" height="6" rx="3" fill={iconColor} />
      </g>

      {/* WORDMARK: LAZY in Deep Charcoal */}
      <g transform="translate(38, 5)" fill={textColor}>
        {/* L */}
        <path d="M1 1H6.5V16.8H18V22H1V1Z" />
        {/* A */}
        <path d="M21 22L29.5 1H35.5L44 22H38.2L36.8 17.6H28.2L26.8 22H21ZM29.6 13.2H35.4L32.5 4.5L29.6 13.2Z" />
        {/* Z */}
        <path d="M47 1H63V5.8L54.8 16.8H63.5V22H46.5V17.2L54.8 6.2H47V1Z" />
        {/* Y */}
        <path d="M65.5 1H71.8L76.5 9.6L81.2 1H87.5L79.8 13.2V22H73.2V13.2L65.5 1Z" />
      </g>
    </svg>
  );
};

export default LazyLogo;
